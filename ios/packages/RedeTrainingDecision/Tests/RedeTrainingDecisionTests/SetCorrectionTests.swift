// 已记组更正（P0 数据可信，owner 2026-10-18 拍板「默认按目标记、休息时就地校正」）：
// 一键完成仍按处方目标记下这一组；记错了可以在本动作内改任意一组、在休息里撤销刚记的那组，
// 最后一组直接进小结时也能在小结里改。
//
// 实现口径：不新增事件——改写事件日志里那条 .logSet（或删掉它）后用 restore 从头重放。
// 这些测试钉住三件事：① 三份事实（当前组列表 / 按动作汇总 / occurrence 段）同步变化；
// ② 结果 ≡ 「当初就这样记」的状态（重放等价、draft 可恢复）；③ 不该动的时刻一律拒绝且零副作用。

import Foundation
import XCTest
import RedeDomain
@testable import RedeTrainingDecision

final class SetCorrectionTests: XCTestCase {
    private func makeState() throws -> TrainFlowState {
        let input = try TestSupport.makeInput(
            appDataJSON: #"{"schemaVersion": 8, "programTemplate": {"splitType": "push-pull-legs"}}"#,
            todayISO: "2026-06-09"
        )
        let verdict = TodayVerdictEngine.evaluate(input)
        let prescription = try XCTUnwrap(TodayPrescriptionEngine.plan(input: input, verdict: verdict))
        return TrainFlowState(prescription: prescription)
    }

    private func obs(_ w: Double, _ r: Int, rir: Double? = 2, pain: Bool = false, at: String? = nil) -> CompletedSetObservation {
        CompletedSetObservation(weightKg: w, reps: r, rir: rir, painReported: pain, completedAt: at)
    }

    /// 重放等价：同处方、同事件日志重建出的事实必须与就地状态一致（draft 恢复走的正是这条路）。
    private func assertReplayEquivalent(_ state: TrainFlowState, file: StaticString = #filePath, line: UInt = #line) throws {
        let replayed = try XCTUnwrap(
            TrainFlowState.restore(prescription: state.prescription, events: state.events),
            "改写后的事件日志必须能完整重放", file: file, line: line
        )
        XCTAssertEqual(replayed.phase, state.phase, file: file, line: line)
        XCTAssertEqual(replayed.exerciseIndex, state.exerciseIndex, file: file, line: line)
        XCTAssertEqual(replayed.plan, state.plan, file: file, line: line)
        XCTAssertEqual(replayed.completedInCurrentExercise, state.completedInCurrentExercise, file: file, line: line)
        XCTAssertEqual(replayed.observationsByExercise, state.observationsByExercise, file: file, line: line)
        XCTAssertEqual(replayed.exerciseFactSegments, state.exerciseFactSegments, file: file, line: line)
        XCTAssertEqual(replayed.skippedSets, state.skippedSets, file: file, line: line)
        XCTAssertEqual(replayed.endReason, state.endReason, file: file, line: line)
    }

    private func build(_ state: TrainFlowState) -> TrainingSession {
        CompletedSessionBuilder.build(
            from: state, sessionId: "s", dateISO: "2026-06-09",
            startedAtISO: "2026-06-09T10:00:00Z", finishedAtISO: "2026-06-09T10:40:00Z", durationMinutes: 40
        )
    }

    // MARK: - 更正

    // 休息时把刚记的组从「按目标 6 次 RIR 2」改成「6 次 RIR 0」：三份事实同步改，
    // 下一组建议随之重算（力竭 → 回退一档），休息不被打断、事件数不变。
    func testAmendJustLoggedSetWhileRestingRewritesAllFactsAndRecomputesNextSet() throws {
        var state = try makeState()
        state.logSet(obs(60, 6, rir: 2, at: "2026-06-09T10:05:00Z"))
        XCTAssertEqual(state.currentRecommendation?.reason, .onPlan)

        XCTAssertTrue(state.amendCompletedSet(at: 0, weightKg: 60, reps: 6, rir: 0))

        let amended = obs(60, 6, rir: 0, at: "2026-06-09T10:05:00Z")
        XCTAssertEqual(state.phase, .resting, "更正不打断休息")
        XCTAssertEqual(state.events, [.logSet(amended)], "改写原事件而不是追加事件")
        XCTAssertEqual(state.completedInCurrentExercise, [amended])
        XCTAssertEqual(state.observationsByExercise["bench-press"], [amended])
        XCTAssertEqual(state.exerciseFactSegments.map(\.observations), [[amended]])
        XCTAssertEqual(state.currentRecommendation?.reason, .lastSetNearFailure)
        XCTAssertEqual(state.currentRecommendation?.targetWeightKg, 57.5)
        try assertReplayEquivalent(state)
    }

    // 更正只改数值：记组时刻（心率曲线上的组刻线）与疼痛标记一律保留原值。
    func testAmendKeepsCompletedAtAndPreRegisteredPain() throws {
        var state = try makeState()
        state.reportPain()
        state.logSet(obs(60, 6, rir: 2, at: "2026-06-09T10:05:00Z"))

        XCTAssertTrue(state.amendCompletedSet(at: 0, weightKg: 57.5, reps: 5, rir: 1))

        let stored = try XCTUnwrap(state.completedInCurrentExercise.first)
        XCTAssertEqual(stored.weightKg, 57.5)
        XCTAssertEqual(stored.reps, 5)
        XCTAssertEqual(stored.rir, 1)
        XCTAssertTrue(stored.painReported, "疼痛预登记不能因为改数值被抹掉")
        XCTAssertEqual(stored.completedAt, "2026-06-09T10:05:00Z")
        try assertReplayEquivalent(state)
    }

    // 已经在做第 3 组时，回头改第 1 组：只动第 1 组，第 2 组与当前指针不变。
    func testAmendEarlierSetDuringActiveSetKeepsPointerAndOtherSets() throws {
        var state = try makeState()
        state.logSet(obs(60, 6))
        state.restFinished()
        state.logSet(obs(60, 6))
        state.restFinished()
        XCTAssertEqual(state.progress.setNumber, 3)

        XCTAssertTrue(state.amendCompletedSet(at: 0, weightKg: 62.5, reps: 7, rir: 3))

        XCTAssertEqual(state.phase, .activeSet)
        XCTAssertEqual(state.progress.setNumber, 3)
        XCTAssertEqual(state.completedInCurrentExercise.map(\.weightKg), [62.5, 60])
        XCTAssertEqual(state.completedInCurrentExercise.map(\.reps), [7, 6])
        XCTAssertFalse(state.isWarmingUp, "改组不能把热身翻出来")
        try assertReplayEquivalent(state)
    }

    // 最后一组打勾直接进小结：小结里仍可改这一组，阶段不回退、结束原因不变，落盘取改后的值。
    func testAmendFinalSetFromSummaryPersistsCorrectedValues() throws {
        var state = try makeState()
        while state.phase != .summary {
            switch state.phase {
            case .activeSet: state.logSet(obs(40, 10))
            case .resting: state.restFinished()
            default: return XCTFail("unexpected phase")
            }
        }
        let lastOffset = state.completedInCurrentExercise.count - 1
        let lastId = try XCTUnwrap(state.currentExercise?.exerciseId)

        XCTAssertTrue(state.amendCompletedSet(at: lastOffset, weightKg: 40, reps: 8, rir: 1))

        XCTAssertEqual(state.phase, .summary)
        XCTAssertEqual(state.endReason, .completedAll)
        let persisted = try XCTUnwrap(build(state).exercises.last { $0.exerciseId == lastId })
        XCTAssertEqual(persisted.sets.last?.reps, 8)
        XCTAssertEqual(persisted.sets.last?.rir, 1)
        try assertReplayEquivalent(state)
    }

    // 拒绝：越界下标、没有已记组、结束确认层里、与原值完全相同——一律不动状态、不动日志。
    func testAmendRejectsOutOfRangeConfirmEndAndNoOpWithoutSideEffects() throws {
        var state = try makeState()
        var before = state
        XCTAssertFalse(state.amendCompletedSet(at: 0, weightKg: 60, reps: 6, rir: 2), "还没有已记组")
        XCTAssertEqual(state, before)

        state.logSet(obs(60, 6))
        before = state
        XCTAssertFalse(state.amendCompletedSet(at: 1, weightKg: 60, reps: 6, rir: 2), "越界")
        XCTAssertFalse(state.amendCompletedSet(at: -1, weightKg: 60, reps: 6, rir: 2), "越界")
        XCTAssertFalse(state.amendCompletedSet(at: 0, weightKg: 60, reps: 6, rir: 2), "与原值相同 = 无事发生")
        XCTAssertEqual(state, before)

        state.requestFinish()
        before = state
        XCTAssertFalse(state.amendCompletedSet(at: 0, weightKg: 60, reps: 5, rir: 2), "结束确认层里不改组")
        XCTAssertEqual(state, before)
    }

    // 只能改**当前动作**的组：推进到下一个动作后，上一个动作的组不再可改（索引从新动作的第 1 组算）。
    func testAmendScopeIsCurrentExerciseOccurrenceOnly() throws {
        var state = try makeState()
        let firstId = try XCTUnwrap(state.currentExercise?.exerciseId)
        for _ in 0..<3 {
            state.logSet(obs(60, 6))
            state.restFinished()
        }
        XCTAssertNotEqual(state.currentExercise?.exerciseId, firstId)
        XCTAssertTrue(state.completedInCurrentExercise.isEmpty)
        let before = state
        XCTAssertFalse(state.amendCompletedSet(at: 0, weightKg: 50, reps: 6, rir: 2))
        XCTAssertEqual(state, before)
    }

    // MARK: - 撤销

    // 休息时撤销刚记的组 ≡ 这一组从没记过：回到同一组、休息结束、三份事实与日志全回到之前；
    // 热身不重来（这个动作已经热过了）。
    func testUndoJustLoggedSetIsIndistinguishableFromNeverLogged() throws {
        var fresh = try makeState()
        fresh.skipAllWarmup()
        var state = fresh

        state.logSet(obs(60, 6))
        XCTAssertTrue(state.canUndoLastSet)
        XCTAssertTrue(state.undoLastSet())

        XCTAssertEqual(state, fresh)
        XCTAssertEqual(state.phase, .activeSet)
        XCTAssertNil(state.observationsByExercise["bench-press"], "不留空数组——落盘层会把它当成一个 0 组动作")
        XCTAssertFalse(state.isWarmingUp)
    }

    // 撤销第 2 组：第 1 组原样保留，回到第 2 组。
    func testUndoSecondSetKeepsFirstSet() throws {
        var state = try makeState()
        state.logSet(obs(60, 6, at: "t1"))
        state.restFinished()
        state.logSet(obs(60, 6, at: "t2"))

        XCTAssertTrue(state.undoLastSet())

        XCTAssertEqual(state.phase, .activeSet)
        XCTAssertEqual(state.progress.setNumber, 2)
        XCTAssertEqual(state.completedInCurrentExercise, [obs(60, 6, at: "t1")])
        XCTAssertEqual(state.events, [.logSet(obs(60, 6, at: "t1")), .restFinished])
        try assertReplayEquivalent(state)
    }

    // 动作最后一组记完（休息后才进下一个动作）时撤销：仍停在这个动作的最后一组，不跳动作。
    func testUndoLastSetOfExerciseStaysOnThatExercise() throws {
        var state = try makeState()
        let firstId = try XCTUnwrap(state.currentExercise?.exerciseId)
        state.logSet(obs(60, 6)); state.restFinished()
        state.logSet(obs(60, 6)); state.restFinished()
        state.logSet(obs(60, 6))
        XCTAssertEqual(state.phase, .resting)

        XCTAssertTrue(state.undoLastSet())

        XCTAssertEqual(state.currentExercise?.exerciseId, firstId)
        XCTAssertEqual(state.progress.setNumber, 3)
        XCTAssertEqual(state.completedInCurrentExercise.count, 2)
        try assertReplayEquivalent(state)
    }

    // 记组前登记的疼痛属于「这一组」：撤销后回到这一组，疼痛登记仍在。
    func testUndoKeepsPainPreRegisteredForThatSet() throws {
        var state = try makeState()
        state.reportPain()
        state.logSet(obs(60, 6))
        XCTAssertTrue(state.undoLastSet())
        XCTAssertTrue(state.painReportedForCurrentSet)
        XCTAssertEqual(state.events, [.reportPain])
    }

    // 休息里点过「结束训练？」又选继续：撤销仍可用，结束确认的往返留在日志里。
    func testUndoAfterFinishRequestRoundTripStillWorks() throws {
        var state = try makeState()
        state.logSet(obs(60, 6))
        state.requestFinish()
        state.keepTraining()
        XCTAssertEqual(state.phase, .resting)

        XCTAssertTrue(state.undoLastSet())

        XCTAssertEqual(state.phase, .activeSet)
        XCTAssertEqual(state.events, [.requestFinish, .keepTraining])
        try assertReplayEquivalent(state)
    }

    // 只在休息里能撤销：没记过组、组中、结束确认层、小结里都拒绝且零副作用。
    // 小结里不撤销是有意的：小结 = 手表已收尾那场体能训练，退回训练中会在手表上另起一场。
    func testUndoOnlyAllowedWhileResting() throws {
        var state = try makeState()
        var before = state
        XCTAssertFalse(state.canUndoLastSet)
        XCTAssertFalse(state.undoLastSet())
        XCTAssertEqual(state, before)

        state.logSet(obs(60, 6))
        state.restFinished()
        before = state
        XCTAssertFalse(state.canUndoLastSet, "已经进入下一组：改组走更正，不走撤销")
        XCTAssertFalse(state.undoLastSet())
        XCTAssertEqual(state, before)

        state.logSet(obs(60, 6))
        state.requestFinish()
        before = state
        XCTAssertFalse(state.undoLastSet(), "结束确认层里不撤销")
        XCTAssertEqual(state, before)

        state.confirmEnd(reason: .timeUp)
        before = state
        XCTAssertFalse(state.canUndoLastSet)
        XCTAssertFalse(state.undoLastSet(), "小结里不撤销")
        XCTAssertEqual(state, before)
    }

    // 换动作后的新 occurrence 里撤销唯一一组：新段回到「零事实」，旧段（已封存）原样，
    // 落盘结果与「换过去还没做」完全一致。
    func testUndoInsideReplacementOccurrenceRestoresZeroFactSegment() throws {
        var state = try makeState()
        state.logSet(obs(60, 6))
        state.restFinished()
        let candidate = try XCTUnwrap(state.replacementCandidates.first)
        state.replaceCurrentExercise(with: candidate)
        XCTAssertFalse(state.isWarmingUp, "有事实后换动作本来就不重新热身")
        let beforeLog = state

        state.logSet(obs(30, 10))
        XCTAssertTrue(state.undoLastSet())

        // 整体相等不适用：撤销后热身指针被置为「已热过」，而换动作那一刻它是 0——两者行为相同
        //（这一 occurrence 不热身），所以逐项比事实。
        XCTAssertFalse(state.isWarmingUp)
        XCTAssertEqual(state.phase, beforeLog.phase)
        XCTAssertEqual(state.events, beforeLog.events)
        XCTAssertEqual(state.plan, beforeLog.plan)
        XCTAssertEqual(state.completedInCurrentExercise, beforeLog.completedInCurrentExercise)
        XCTAssertEqual(state.observationsByExercise, beforeLog.observationsByExercise)
        XCTAssertEqual(state.exerciseFactSegments, beforeLog.exerciseFactSegments)
        XCTAssertEqual(state.replacements, beforeLog.replacements)
        XCTAssertEqual(build(state), build(beforeLog))
        try assertReplayEquivalent(state)
    }

    // MARK: - 顺带修的旧缺口

    // 先登记疼痛再记组时，reducer 合并疼痛标记的那一步曾把记组时刻丢掉（心率曲线上这一组的刻线会消失）。
    func testPainMergedObservationKeepsCompletedAt() throws {
        var state = try makeState()
        state.reportPain()
        state.logSet(obs(60, 6, at: "2026-06-09T10:05:00Z"))
        XCTAssertEqual(state.completedInCurrentExercise.first?.completedAt, "2026-06-09T10:05:00Z")
        XCTAssertEqual(state.completedInCurrentExercise.first?.painReported, true)
    }
}
