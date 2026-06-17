// FR-TR10 切片2：热身在专注训练流里的 overlay 行为 + 零回归不变量。
// 核心：热身是 .activeSet 上的内存叠加——advance/skip 绝不碰 observations/events/exerciseIndex，
// 不影响 NextSetEngine 首个工作组建议（code-regression-guard：既有流行为不变）。

import Foundation
import XCTest
@testable import RedeTrainingDecision

final class WarmupFlowTests: XCTestCase {
    private func makeState() throws -> TrainFlowState {
        let input = try TestSupport.makeInput(
            appDataJSON: #"{"schemaVersion": 8, "programTemplate": {"splitType": "push-pull-legs"}}"#,
            todayISO: "2026-06-09"
        )
        let verdict = TodayVerdictEngine.evaluate(input)
        let prescription = try XCTUnwrap(TodayPrescriptionEngine.plan(input: input, verdict: verdict))
        return TrainFlowState(prescription: prescription)
    }

    private func obs(_ w: Double, _ r: Int, rir: Double? = 2) -> CompletedSetObservation {
        CompletedSetObservation(weightKg: w, reps: r, rir: rir, painReported: false)
    }

    func testWarmupShownAtExerciseStart() throws {
        let state = try makeState()
        XCTAssertEqual(state.currentExercise?.exerciseId, "bench-press", "首动作=杠铃复合，应有热身")
        XCTAssertFalse(state.warmupStepsForCurrentExercise.isEmpty, "杠铃复合工作重应产出热身阶梯")
        XCTAssertTrue(state.isWarmingUp)
        XCTAssertEqual(state.warmupPointer, 0)
        XCTAssertEqual(state.currentWarmupStep, state.warmupStepsForCurrentExercise.first)
        XCTAssertEqual(state.phase, .activeSet, "热身期 phase 仍是 activeSet（不新增相位）")
    }

    func testAdvanceWarmupNeverTouchesWorkingSetState() throws {
        var state = try makeState()
        let total = state.warmupStepsForCurrentExercise.count
        for _ in 0..<total { state.advanceWarmupStep() }
        XCTAssertFalse(state.isWarmingUp, "走完全部热身 → 退出热身")
        XCTAssertEqual(state.warmupPointer, total)
        // 零回归不变量：热身全程不碰这些。
        XCTAssertTrue(state.observationsByExercise.isEmpty, "热身不进 observations")
        XCTAssertTrue(state.completedInCurrentExercise.isEmpty, "热身不计工作组")
        XCTAssertTrue(state.events.isEmpty, "热身不进事件日志（draft 不受影响）")
        XCTAssertEqual(state.exerciseIndex, 0, "热身不动下标")
        XCTAssertEqual(state.phase, .activeSet)
    }

    func testSkipAllWarmupExitsImmediately() throws {
        var state = try makeState()
        state.skipAllWarmup()
        XCTAssertFalse(state.isWarmingUp)
        XCTAssertEqual(state.warmupPointer, state.warmupStepsForCurrentExercise.count)
        XCTAssertTrue(state.events.isEmpty)
        XCTAssertTrue(state.observationsByExercise.isEmpty)
    }

    func testWarmupGoneAfterFirstWorkingSetEvenIfNotTicked() throws {
        var state = try makeState()
        XCTAssertTrue(state.isWarmingUp)
        state.logSet(obs(60, 6)) // 直接打首个工作组（没走热身）
        XCTAssertFalse(state.isWarmingUp, "做过工作组后不再展示热身")
    }

    // 回归核心：热身交互不影响首个工作组的引擎建议/计划目标（与不碰热身完全一致）。
    func testWarmupInteractionDoesNotAffectFirstWorkingSet() throws {
        let plain = try makeState()
        var touched = try makeState()
        touched.advanceWarmupStep()
        touched.skipAllWarmup()
        XCTAssertEqual(touched.currentTargetWeightKg, plain.currentTargetWeightKg, "首个工作组目标重量不受热身影响")
        XCTAssertEqual(touched.currentRecommendation?.targetWeightKg, plain.currentRecommendation?.targetWeightKg)
        XCTAssertEqual(touched.completedInCurrentExercise, plain.completedInCurrentExercise)
        XCTAssertEqual(touched.events, plain.events, "两者事件日志都为空")
        XCTAssertEqual(touched.progress, plain.progress, "进度计数不受热身影响")
    }

    func testWarmupMethodsAreNoOpWhenNotWarmingUp() throws {
        var state = try makeState()
        state.logSet(obs(60, 6)) // 退出热身（已做工作组）
        let before = state.warmupPointer
        state.advanceWarmupStep()
        state.skipAllWarmup()
        XCTAssertEqual(state.warmupPointer, before, "非热身期 advance/skip 是 no-op")
    }

    func testAdvanceExerciseResetsWarmupPointer() throws {
        var state = try makeState()
        state.skipAllWarmup()
        // 打满首动作 3 组推进到下一动作。
        for _ in 0..<3 {
            state.logSet(obs(60, 6))
            if state.phase == .resting { state.restFinished() }
        }
        XCTAssertEqual(state.exerciseIndex, 1, "已推进到第二动作")
        XCTAssertEqual(state.warmupPointer, 0, "新动作热身指针归零")
    }

    // 热身不进 events → 含热身交互的会话仍可正常 draft 恢复（replay 不受影响）。
    func testWarmupDoesNotBreakDraftReplay() throws {
        let prescription = try makeState().prescription
        var live = TrainFlowState(prescription: prescription)
        live.advanceWarmupStep()   // 热身交互（无 event）
        live.logSet(obs(60, 6))    // 首个工作组（有 event）
        let restored = try XCTUnwrap(
            TrainFlowState.restore(prescription: prescription, events: live.events),
            "热身不进 events，replay 应成功恢复"
        )
        XCTAssertEqual(restored.completedInCurrentExercise, live.completedInCurrentExercise)
        XCTAssertEqual(restored.events, live.events)
    }
}
