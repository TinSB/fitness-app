// M3-2 训练流状态机（纯 reducer，app 层只渲染+计时）：
// 当前组→打勾→休息→下一组/下一动作→…→收尾确认→小结；
// 跳过组/跳过动作/换动作/疼痛登记全部留痕；Hold = 暂停引擎微调按计划值。

import Foundation
import XCTest
@testable import RedeTrainingDecision

final class TrainFlowReducerTests: XCTestCase {
    private func makeState() throws -> TrainFlowState {
        let input = try TestSupport.makeInput(
            appDataJSON: #"{"schemaVersion": 8, "programTemplate": {"splitType": "push-pull-legs"}}"#,
            todayISO: "2026-06-09"
        )
        let verdict = TodayVerdictEngine.evaluate(input)
        let prescription = try XCTUnwrap(TodayPrescriptionEngine.plan(input: input, verdict: verdict))
        return TrainFlowState(prescription: prescription)
    }

    private func obs(_ w: Double, _ r: Int, rir: Double? = 2, pain: Bool = false) -> CompletedSetObservation {
        CompletedSetObservation(weightKg: w, reps: r, rir: rir, painReported: pain)
    }

    // 初始：push-a 第 1 动作第 1 组，phase = activeSet
    func testInitialStatePointsAtFirstSet() throws {
        let state = try makeState()
        XCTAssertEqual(state.phase, .activeSet)
        XCTAssertEqual(state.exerciseIndex, 0)
        XCTAssertEqual(state.currentExercise?.exerciseId, "bench-press")
        XCTAssertEqual(state.completedInCurrentExercise.count, 0)
        XCTAssertEqual(state.progress.exerciseNumber, 1)
        XCTAssertEqual(state.progress.exerciseTotal, 6)
        XCTAssertEqual(state.progress.setNumber, 1)
        XCTAssertEqual(state.progress.setTotal, 3)
    }

    // 打勾 → 进入休息，休息秒数 = 动作 restSeconds
    func testLogSetEntersRest() throws {
        var state = try makeState()
        state.logSet(obs(60, 6))
        XCTAssertEqual(state.phase, .resting)
        XCTAssertEqual(state.restSecondsPlanned, 180)
        XCTAssertEqual(state.completedInCurrentExercise.count, 1)
    }

    // 休息结束 → 下一组；下一组建议来自 NextSetEngine（延续执行事实）
    func testRestFinishedAdvancesToNextSet() throws {
        var state = try makeState()
        state.logSet(obs(65, 6))
        state.restFinished()
        XCTAssertEqual(state.phase, .activeSet)
        XCTAssertEqual(state.progress.setNumber, 2)
        XCTAssertEqual(state.currentRecommendation?.targetWeightKg, 65)
    }

    // Hold：暂停引擎微调，目标回计划值；跨组延续
    func testHoldOverridesRecommendationWithPlannedTarget() throws {
        var state = try makeState()
        state.logSet(obs(60, 6, rir: 0)) // 力竭 → 引擎会建议 57.5
        state.restFinished()
        XCTAssertEqual(state.currentRecommendation?.targetWeightKg, 57.5)
        state.toggleHold()
        XCTAssertEqual(state.currentTargetWeightKg, 60) // 计划值
        state.logSet(obs(60, 6))
        state.restFinished()
        XCTAssertTrue(state.isHolding) // 跨组延续
        XCTAssertEqual(state.currentTargetWeightKg, 60)
    }

    // 动作最后一组 → 休息后推进到下一动作第 1 组
    func testFinishingExerciseAdvancesToNextExercise() throws {
        var state = try makeState()
        for _ in 0..<3 { state.logSet(obs(60, 6)); state.restFinished() }
        XCTAssertEqual(state.exerciseIndex, 1)
        XCTAssertEqual(state.currentExercise?.exerciseId, "incline-db-press")
        XCTAssertEqual(state.progress.setNumber, 1)
        XCTAssertFalse(state.isHolding) // Hold 不跨动作
    }

    // 跳过当前组（带原因）→ 留痕并直接进下一组（无休息）
    func testSkipSetRecordsReasonAndAdvances() throws {
        var state = try makeState()
        state.skipSet(reason: .equipmentBusy)
        XCTAssertEqual(state.phase, .activeSet)
        XCTAssertEqual(state.progress.setNumber, 2)
        XCTAssertEqual(state.skippedSets.count, 1)
        XCTAssertEqual(state.skippedSets.first?.reason, .equipmentBusy)
    }

    // 跳过整个动作 → 留痕并推进到下一动作
    func testSkipExerciseAdvances() throws {
        var state = try makeState()
        state.skipExercise(reason: .painDiscomfort)
        XCTAssertEqual(state.exerciseIndex, 1)
        XCTAssertEqual(state.skippedExercises.first?.exerciseId, "bench-press")
        XCTAssertEqual(state.skippedExercises.first?.reason, .painDiscomfort)
    }

    // 换动作：同替代族 + 排除当日已排；换后记录归替代动作
    func testReplaceExerciseSwapsTargetAndKeepsAudit() throws {
        var state = try makeState()
        let candidates = state.replacementCandidates
        // push-a 当日已排 incline-db-press 与 machine-chest-press；wave-1/2/4 后
        // 同族还有 db-floor-press / incline-barbell-press / decline-barbell-press（rank 靠后追加）
        XCTAssertEqual(candidates, ["db-bench-press", "db-floor-press", "incline-barbell-press", "decline-barbell-press", "push-up", "hammer-chest-press", "incline-hammer-press"]) // wave-6

        state.replaceCurrentExercise(with: "db-bench-press")
        XCTAssertEqual(state.currentExercise?.exerciseId, "db-bench-press")
        XCTAssertEqual(state.replacements.first?.originalExerciseId, "bench-press")
        XCTAssertEqual(state.replacements.first?.actualExerciseId, "db-bench-press")
    }

    // 档位系统（2026-06-13）：换动作后步长按「换入动作器械 × 用户单位」重算
    // （哑铃 2.5kg → 选重机 5kg），组内疼痛回退立即按新档走。
    func testReplaceSwitchesStepPerEquipmentGrid() {
        let cat = ExerciseCatalog(catalogVersion: "test", entries: [
            ExerciseCatalogEntry(id: "db-x", movementPattern: "curl", primaryMuscle: "biceps",
                equipment: "dumbbell", kind: "isolation", substitutionGroups: ["g"], startWeightKg: 10, rank: 0),
            ExerciseCatalogEntry(id: "sel-x", movementPattern: "curl", primaryMuscle: "biceps",
                equipment: "selectorized", kind: "isolation", substitutionGroups: ["g"], startWeightKg: 20, rank: 10),
        ])
        let presc = TodayPrescription(dayCode: "push-a", exercises: [
            ExercisePrescriptionPlan(
                exerciseId: "db-x", sets: 3, restSeconds: 60, repLowerBound: 8, repUpperBound: 12,
                targetReps: 10, targetWeightKg: 30, targetRir: 2, previousWeightKg: nil,
                previousTopReps: nil, nextProjectedWeightKg: 32.5, progressionStepKg: 2.5,
                change: .start, reason: .firstExposure
            ),
        ], dayReasons: [])
        var state = TrainFlowState(prescription: presc, catalog: cat) // 默认 kg
        XCTAssertEqual(state.currentExercise?.stepKg, 2.5) // 哑铃 kg 档

        state.replaceCurrentExercise(with: "sel-x")
        XCTAssertEqual(state.currentExercise?.stepKg, 5, "选重机 kg 档 = 5（宁大勿小），步长跟器械走")
        state.logSet(obs(30, 6, rir: 2, pain: true))
        state.restFinished()
        XCTAssertEqual(state.currentRecommendation?.targetWeightKg, 25, "疼痛回退一档 = 选重机 5kg")
    }

    // 疼痛登记：当前组事实留痕 + 下一组建议自动保守（引擎安全瀑布）
    func testPainReportFlowsIntoNextRecommendation() throws {
        var state = try makeState()
        state.reportPain()
        XCTAssertTrue(state.painReportedForCurrentSet)
        state.logSet(obs(60, 6, rir: 2, pain: true))
        state.restFinished()
        XCTAssertEqual(state.currentRecommendation?.reason, .painReported)
        XCTAssertEqual(state.currentRecommendation?.targetWeightKg, 57.5)
    }

    // 最后动作最后一组打勾 → 直接进小结（无休息，原型口径）
    func testLastSetOfLastExerciseEndsSession() throws {
        var state = try makeState()
        while state.phase != .summary {
            switch state.phase {
            case .activeSet: state.logSet(obs(40, 10))
            case .resting: state.restFinished()
            default: return XCTFail("unexpected phase")
            }
        }
        XCTAssertEqual(state.phase, .summary)
        XCTAssertEqual(state.endReason, .completedAll)
    }

    // Finish 请求 → confirm；keep training 返回原态；end 进小结
    func testFinishConfirmFlow() throws {
        var state = try makeState()
        state.logSet(obs(60, 6))
        state.requestFinish()
        XCTAssertEqual(state.phase, .confirmEnd)
        state.keepTraining()
        XCTAssertEqual(state.phase, .resting) // 回到请求前的状态
        state.requestFinish()
        state.confirmEnd(reason: .timeUp)
        XCTAssertEqual(state.phase, .summary)
        XCTAssertEqual(state.endReason, .timeUp)
    }
}
