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

    private func assertMoveRejected(
        _ state: inout TrainFlowState,
        targetExerciseId: String,
        file: StaticString = #filePath,
        line: UInt = #line
    ) {
        let before = state
        state.moveExerciseToCurrent(targetExerciseId)
        XCTAssertEqual(state, before, "rejected move must not mutate state or append an event", file: file, line: line)
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
        XCTAssertEqual(candidates, ["db-bench-press", "db-floor-press", "incline-barbell-press", "decline-barbell-press", "push-up", "hammer-chest-press", "incline-hammer-press", "smith-bench-press", "smith-incline-press", "band-chest-press", "decline-db-press"]) // wave-6/8/13/18

        state.replaceCurrentExercise(with: "db-bench-press")
        XCTAssertEqual(state.currentExercise?.exerciseId, "db-bench-press")
        XCTAssertEqual(state.replacements.first?.originalExerciseId, "bench-press")
        XCTAssertEqual(state.replacements.first?.actualExerciseId, "db-bench-press")
    }

    // 本次训练重排：选择一个尚未开始的已排动作，应稳定移动到当前；不是替换或跳过。
    func testMovingScheduledExerciseToCurrentPreservesPlanAndResetsTransientGuidance() throws {
        var state = try makeState()
        let originalPlan = state.plan
        let originalCurrent = try XCTUnwrap(originalPlan.exercises.first)
        let target = originalPlan.exercises[2]
        let expectedCandidates = originalPlan.exercises.dropFirst().map(\.exerciseId)

        XCTAssertEqual(state.moveToCurrentCandidates, expectedCandidates)
        state.skipAllWarmup()
        XCTAssertGreaterThan(state.warmupPointer, 0, "fixture must exercise warm-up reset")
        state.toggleHold()
        XCTAssertTrue(state.isHolding)

        state.moveExerciseToCurrent(target.exerciseId)

        let expectedOrder = [target, originalCurrent, originalPlan.exercises[1]]
            + Array(originalPlan.exercises.dropFirst(3))
        XCTAssertEqual(state.plan.exercises, expectedOrder)
        XCTAssertEqual(state.currentExercise, target, "moved exercise must keep its full planned parameters")
        XCTAssertEqual(state.exerciseIndex, 0)
        XCTAssertEqual(state.progress.exerciseTotal, originalPlan.exercises.count)
        XCTAssertFalse(state.isHolding, "hold belongs to the former current exercise")
        XCTAssertEqual(state.warmupPointer, 0, "new current exercise starts its own warm-up guidance")
        XCTAssertEqual(state.events, [.toggleHold, .moveExerciseToCurrent(target.exerciseId)])
        XCTAssertTrue(state.replacements.isEmpty)
        XCTAssertTrue(state.skippedSets.isEmpty)
        XCTAssertTrue(state.skippedExercises.isEmpty)
    }

    // 移入动作做完后，原当前动作应紧接着出现；稳定移动不能丢失或复制任何计划项。
    func testCompletingMovedExerciseReturnsToFormerCurrentExercise() throws {
        var state = try makeState()
        let originalPlan = state.plan
        let originalCurrentId = try XCTUnwrap(originalPlan.exercises.first?.exerciseId)
        let target = originalPlan.exercises[2]

        state.moveExerciseToCurrent(target.exerciseId)
        for _ in target.sets {
            state.logSet(obs(target.sets[0].targetWeightKg, target.sets[0].targetReps))
            XCTAssertEqual(state.phase, .resting)
            state.restFinished()
        }

        XCTAssertEqual(state.exerciseIndex, 1)
        XCTAssertEqual(state.currentExercise?.exerciseId, originalCurrentId)
        XCTAssertEqual(state.plan.exercises.map(\.exerciseId).count, originalPlan.exercises.count)
        XCTAssertEqual(Set(state.plan.exercises.map(\.exerciseId)).count, originalPlan.exercises.count)
        XCTAssertEqual(state.observationsByExercise[target.exerciseId]?.count, target.sets.count)
        XCTAssertNil(state.observationsByExercise[originalCurrentId])
        XCTAssertTrue(state.replacements.isEmpty)
        XCTAssertTrue(state.skippedExercises.isEmpty)
    }

    // 当前指针已越过首动作时，仍只在未完成后缀内稳定移动；完成前缀和既有事实必须原样保留。
    func testMovingAtLaterExercisePreservesCompletedPrefixAndRejectsEarlierTarget() throws {
        var state = try makeState()
        let completedExercise = try XCTUnwrap(state.currentExercise)
        for set in completedExercise.sets {
            state.logSet(obs(set.targetWeightKg, set.targetReps))
            state.restFinished()
        }
        XCTAssertEqual(state.exerciseIndex, 1)

        let beforeMove = state
        let targetIndex = 4
        let target = beforeMove.plan.exercises[targetIndex]
        var expectedOrder = beforeMove.plan.exercises
        expectedOrder.remove(at: targetIndex)
        expectedOrder.insert(target, at: beforeMove.exerciseIndex)

        state.moveExerciseToCurrent(target.exerciseId)

        XCTAssertEqual(state.exerciseIndex, 1)
        XCTAssertEqual(state.plan.exercises, expectedOrder)
        XCTAssertEqual(state.plan.exercises[0], beforeMove.plan.exercises[0])
        XCTAssertEqual(
            state.observationsByExercise[completedExercise.exerciseId],
            beforeMove.observationsByExercise[completedExercise.exerciseId]
        )

        let afterAcceptedMove = state
        assertMoveRejected(&state, targetExerciseId: completedExercise.exerciseId)
        XCTAssertEqual(state, afterAcceptedMove)
    }

    // 已有正式事实或不在 activeSet 时拒绝重排，拒绝必须是完全无副作用的。
    func testMoveRejectsAfterCompletedOrSkippedSetPendingPainAndWhileResting() throws {
        var completed = try makeState()
        let completedTarget = completed.plan.exercises[2].exerciseId
        completed.logSet(obs(60, 6))
        completed.restFinished()
        XCTAssertEqual(completed.phase, .activeSet)
        XCTAssertFalse(completed.completedInCurrentExercise.isEmpty)
        XCTAssertTrue(completed.moveToCurrentCandidates.isEmpty)
        assertMoveRejected(&completed, targetExerciseId: completedTarget)

        var skipped = try makeState()
        let skippedTarget = skipped.plan.exercises[2].exerciseId
        skipped.skipSet(reason: .equipmentBusy)
        XCTAssertGreaterThan(skipped.skippedInCurrentExercise, 0)
        XCTAssertTrue(skipped.moveToCurrentCandidates.isEmpty)
        assertMoveRejected(&skipped, targetExerciseId: skippedTarget)

        var pain = try makeState()
        let painTarget = pain.plan.exercises[2].exerciseId
        pain.reportPain()
        XCTAssertTrue(pain.painReportedForCurrentSet)
        XCTAssertTrue(pain.moveToCurrentCandidates.isEmpty)
        assertMoveRejected(&pain, targetExerciseId: painTarget)

        var resting = try makeState()
        let restingTarget = resting.plan.exercises[2].exerciseId
        resting.logSet(obs(60, 6))
        XCTAssertEqual(resting.phase, .resting)
        XCTAssertTrue(resting.moveToCurrentCandidates.isEmpty)
        assertMoveRejected(&resting, targetExerciseId: restingTarget)
    }

    // 目标必须在当前位置之后且只出现一次；当前、缺失和歧义目标全部 fail closed。
    func testMoveRejectsCurrentMissingAndAmbiguousTargets() throws {
        var state = try makeState()
        let currentId = try XCTUnwrap(state.currentExercise?.exerciseId)
        assertMoveRejected(&state, targetExerciseId: currentId)
        assertMoveRejected(&state, targetExerciseId: "no-such-exercise")

        let source = state.prescription
        let first = source.exercises[0]
        let repeated = source.exercises[1]
        var ambiguous = TrainFlowState(prescription: TodayPrescription(
            dayCode: source.dayCode,
            exercises: [first, repeated, repeated],
            dayReasons: source.dayReasons
        ))
        XCTAssertFalse(ambiguous.moveToCurrentCandidates.contains(repeated.exerciseId))
        assertMoveRejected(&ambiguous, targetExerciseId: repeated.exerciseId)
    }

    // 收尾确认与小结都是已冻结边界；重排请求必须连事件日志也完全不碰。
    func testMoveRejectsConfirmEndAndSummaryWithoutMutatingStateOrEvents() throws {
        var confirming = try makeState()
        let confirmingTarget = confirming.plan.exercises[2].exerciseId
        confirming.requestFinish()
        XCTAssertEqual(confirming.phase, .confirmEnd)
        assertMoveRejected(&confirming, targetExerciseId: confirmingTarget)

        var summary = try makeState()
        let summaryTarget = summary.plan.exercises[2].exerciseId
        summary.requestFinish()
        summary.confirmEnd(reason: .timeUp)
        XCTAssertEqual(summary.phase, .summary)
        assertMoveRejected(&summary, targetExerciseId: summaryTarget)
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

    // 换到纯自重/弹力带动作时重量必须归 0——否则原动作负重（如 30kg）随 PlannedSet 落进
    // observations、被 CompletedSessionBuilder 写成"自重 30kg"脏历史，污染下次自重处方（审计 MAJOR）。
    func testReplaceToBodyweightZeroesWeight() {
        let cat = ExerciseCatalog(catalogVersion: "test", entries: [
            ExerciseCatalogEntry(id: "db-press", movementPattern: "horizontal-press", primaryMuscle: "chest",
                equipment: "dumbbell", kind: "compound", substitutionGroups: ["g"], startWeightKg: 20, rank: 0),
            ExerciseCatalogEntry(id: "bw-pushup", movementPattern: "horizontal-press", primaryMuscle: "chest",
                equipment: "bodyweight", kind: "compound", substitutionGroups: ["g"], startWeightKg: 0,
                loadType: "bodyweight", rank: 10),
        ])
        let presc = TodayPrescription(dayCode: "push-a", exercises: [
            ExercisePrescriptionPlan(
                exerciseId: "db-press", sets: 3, restSeconds: 60, repLowerBound: 8, repUpperBound: 12,
                targetReps: 10, targetWeightKg: 30, targetRir: 2, previousWeightKg: nil,
                previousTopReps: nil, nextProjectedWeightKg: 32.5, progressionStepKg: 2.5,
                change: .start, reason: .firstExposure
            ),
        ], dayReasons: [])
        var state = TrainFlowState(prescription: presc, catalog: cat)
        XCTAssertTrue(state.replacementCandidates.contains("bw-pushup"))
        state.replaceCurrentExercise(with: "bw-pushup")
        XCTAssertEqual(state.currentExercise?.loadType, "bodyweight")
        for set in state.currentExercise?.sets ?? [] {
            XCTAssertEqual(set.targetWeightKg, 0, "换到自重后每组重量必须归 0（修前沿用原 30kg → 脏自重历史）")
        }
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
