// M3-3：完成会话构建器——把训练流终态变成 canonical TrainingSession 存储对象。
// 字段沿 legacy 词汇表（开门设计）；只记录用户事实（实际组/跳过/替换/收尾原因），
// 永不写入 engine 输出（处方目标值不落盘）。id/时间由调用方注入（无 clock）。

import Foundation
import XCTest
import RedeDomain
@testable import RedeTrainingDecision

final class CompletedSessionBuilderTests: XCTestCase {
    private struct CompletedSessionGoldenInput: Decodable {
        let baselineCommit: String
        let appDataJSON: String
        let todayISO: String
        let sessionId: String
        let dateISO: String
        let startedAtISO: String
        let finishedAtISO: String
        let durationMinutes: Int
    }

    private func expectedGoldenBytes(_ name: String) throws -> Data {
        var data = try Data(contentsOf: TestSupport.fixtureURL(name))
        while let last = data.last, last == 0x0A || last == 0x0D {
            data.removeLast()
        }
        return data
    }

    private func finishedFlow() throws -> TrainFlowState {
        let input = try TestSupport.makeInput(
            appDataJSON: #"{"schemaVersion": 8, "programTemplate": {"splitType": "push-pull-legs"}}"#,
            todayISO: "2026-06-09"
        )
        let verdict = TodayVerdictEngine.evaluate(input)
        let prescription = try XCTUnwrap(TodayPrescriptionEngine.plan(input: input, verdict: verdict))
        var flow = TrainFlowState(prescription: prescription)
        // 第 1 动作：2 完成 + 1 跳过；然后换到第 2 动作打 1 组后提前结束
        flow.logSet(CompletedSetObservation(weightKg: 60, reps: 6, rir: 2, painReported: false))
        flow.restFinished()
        flow.skipSet(reason: .equipmentBusy)
        flow.logSet(CompletedSetObservation(weightKg: 60, reps: 7, rir: 1, painReported: true))
        flow.restFinished()
        flow.logSet(CompletedSetObservation(weightKg: 22.5, reps: 8, rir: 2, painReported: false))
        flow.requestFinish()
        flow.confirmEnd(reason: .timeUp)
        return flow
    }

    func testBuildsCanonicalSessionWithLegacyVocabulary() throws {
        let flow = try finishedFlow()
        let session = CompletedSessionBuilder.build(
            from: flow,
            sessionId: "session-test-1",
            dateISO: "2026-06-09",
            startedAtISO: "2026-06-09T10:00:00Z",
            finishedAtISO: "2026-06-09T10:47:00Z",
            durationMinutes: 47
        )

        XCTAssertEqual(session.id, "session-test-1")
        XCTAssertEqual(session.date, "2026-06-09")
        XCTAssertEqual(session.completed, true)
        XCTAssertEqual(session.storage["startedAt"], .string("2026-06-09T10:00:00Z"))
        XCTAssertEqual(session.storage["finishedAt"], .string("2026-06-09T10:47:00Z"))
        XCTAssertEqual(session.storage["durationMin"], .int(47))
        XCTAssertEqual(session.storage["templateId"], .string("push-a"))
        XCTAssertEqual(session.storage["endReason"], .string("timeUp"))

        // 只记录有实际组的动作；处方目标值不落盘
        XCTAssertEqual(session.exercises.count, 2)
        let bench = session.exercises[0]
        XCTAssertEqual(bench.exerciseId, "bench-press")
        XCTAssertEqual(bench.sets.count, 2)
        XCTAssertEqual(bench.sets[0].weight, 60)
        XCTAssertEqual(bench.sets[0].reps, 6)
        XCTAssertEqual(bench.sets[0].rir, 2)
        XCTAssertEqual(bench.sets[0].setIndex, 1)
        XCTAssertEqual(bench.sets[1].storage["painFlag"], .bool(true))

        // 跳过留痕（open-bag 字段）
        XCTAssertEqual(
            session.storage["skippedSets"],
            .array([.object(["exerciseId": .string("bench-press"), "setIndex": .int(2), "reason": .string("equipmentBusy")])])
        )
    }

    // 公开行为回归锁：当前 slot 练完 2/3 后换动作，旧动作事实与新动作事实都必须落盘；
    // slot 仍是动作 1/6，但新动作只承接剩余 1 组并从第 1 组开始。
    func testMidExerciseReplacementPersistsBothExercisesAndRestartsRemainingWorkAtSetOne() throws {
        let input = try TestSupport.makeInput(
            appDataJSON: #"{"schemaVersion": 8, "programTemplate": {"splitType": "push-pull-legs"}}"#,
            todayISO: "2026-06-09"
        )
        let verdict = TodayVerdictEngine.evaluate(input)
        let prescription = try XCTUnwrap(TodayPrescriptionEngine.plan(input: input, verdict: verdict))
        var flow = TrainFlowState(prescription: prescription)

        XCTAssertEqual(flow.currentExercise?.exerciseId, "bench-press")
        XCTAssertEqual(flow.currentExercise?.sets.count, 3)
        let originalRemainingSet = try XCTUnwrap(flow.currentExercise?.sets.last)
        flow.logSet(CompletedSetObservation(weightKg: 60, reps: 6, rir: 2, painReported: false))
        flow.restFinished()
        flow.logSet(CompletedSetObservation(weightKg: 60, reps: 7, rir: 1, painReported: true))
        flow.restFinished()

        flow.replaceCurrentExercise(with: "db-bench-press")

        XCTAssertEqual(flow.currentExercise?.exerciseId, "db-bench-press")
        XCTAssertEqual(flow.progress.exerciseNumber, 1)
        XCTAssertEqual(flow.progress.exerciseTotal, 6)
        XCTAssertEqual(flow.progress.setNumber, 1, "replacement starts at its own first set")
        XCTAssertEqual(flow.progress.setTotal, 1, "two completed facts leave exactly one planned set")
        XCTAssertTrue(flow.completedInCurrentExercise.isEmpty)
        XCTAssertEqual(flow.currentExercise?.sets.map(\.index), [1])
        XCTAssertEqual(
            flow.currentExercise?.sets.first?.targetWeightKg,
            originalRemainingSet.targetWeightKg,
            "external-load replacement keeps the existing load transform semantics"
        )

        flow.logSet(CompletedSetObservation(weightKg: 30, reps: 8, rir: 2, painReported: false))
        flow.requestFinish()
        flow.confirmEnd(reason: .timeUp)

        let session = CompletedSessionBuilder.build(
            from: flow,
            sessionId: "mid-swap",
            dateISO: "2026-06-09",
            startedAtISO: "t0",
            finishedAtISO: "t1",
            durationMinutes: 12
        )

        XCTAssertEqual(
            session.exercises.map(\.exerciseId),
            ["bench-press", "db-bench-press"],
            "facts before and after replacement remain independently attributable"
        )
        let original = try XCTUnwrap(
            session.exercises.first(where: { $0.exerciseId == "bench-press" })
        )
        XCTAssertEqual(original.sets.count, 2)
        XCTAssertEqual(original.sets.map(\.setIndex), [1, 2])
        XCTAssertEqual(original.sets.map(\.reps), [6, 7])
        XCTAssertEqual(original.sets[1].storage["painFlag"], .bool(true))
        XCTAssertEqual(original.storage["replacementRole"], .string("original"))
        XCTAssertEqual(original.storage["originalExerciseId"], .string("bench-press"))
        XCTAssertEqual(original.storage["actualExerciseId"], .string("db-bench-press"))

        let replacement = try XCTUnwrap(
            session.exercises.first(where: { $0.exerciseId == "db-bench-press" })
        )
        XCTAssertEqual(replacement.sets.count, 1)
        XCTAssertEqual(replacement.sets.first?.setIndex, 1)
        XCTAssertEqual(replacement.sets.first?.reps, 8)
        XCTAssertNil(replacement.sets.first?.storage["painFlag"], "pain fact must not leak into the new exercise")
        XCTAssertEqual(replacement.storage["replacementRole"], .string("actual"))
        XCTAssertEqual(replacement.storage["originalExerciseId"], .string("bench-press"))
        XCTAssertEqual(replacement.storage["actualExerciseId"], .string("db-bench-press"))
        XCTAssertNil(session.storage["skippedSets"])
    }

    // 完成 + 跳过混合也属于旧动作已经发生的事实；换动作不得把旧 skip 重写到新 id。
    func testMidExerciseReplacementKeepsCompletedAndSkippedFactsWithOriginalExercise() throws {
        let input = try TestSupport.makeInput(
            appDataJSON: #"{"schemaVersion": 8, "programTemplate": {"splitType": "push-pull-legs"}}"#,
            todayISO: "2026-06-09"
        )
        let verdict = TodayVerdictEngine.evaluate(input)
        let prescription = try XCTUnwrap(TodayPrescriptionEngine.plan(input: input, verdict: verdict))
        var flow = TrainFlowState(prescription: prescription)

        flow.logSet(CompletedSetObservation(weightKg: 60, reps: 6, rir: 2, painReported: false))
        flow.restFinished()
        flow.skipSet(reason: .equipmentBusy)
        flow.replaceCurrentExercise(with: "db-bench-press")

        XCTAssertEqual(flow.progress.setNumber, 1)
        XCTAssertEqual(flow.progress.setTotal, 1)
        flow.logSet(CompletedSetObservation(weightKg: 30, reps: 8, rir: 2, painReported: false))
        flow.requestFinish()
        flow.confirmEnd(reason: .timeUp)

        let session = CompletedSessionBuilder.build(
            from: flow,
            sessionId: "mixed-mid-swap",
            dateISO: "2026-06-09",
            startedAtISO: "t0",
            finishedAtISO: "t1",
            durationMinutes: 8
        )

        XCTAssertEqual(session.exercises.map(\.exerciseId), ["bench-press", "db-bench-press"])
        XCTAssertEqual(
            session.storage["skippedSets"],
            .array([
                .object([
                    "exerciseId": .string("bench-press"),
                    "setIndex": .int(2),
                    "reason": .string("equipmentBusy"),
                ]),
            ])
        )
        XCTAssertEqual(
            session.exercises.first(where: { $0.exerciseId == "bench-press" })?.sets.count,
            1
        )
        XCTAssertEqual(
            session.exercises.first(where: { $0.exerciseId == "db-bench-press" })?.sets.count,
            1
        )
    }

    func testReplacingBackToOriginalPersistsEachOccurrenceOnceWithUniqueIds() throws {
        let input = try TestSupport.makeInput(
            appDataJSON: #"{"schemaVersion": 8, "programTemplate": {"splitType": "push-pull-legs"}}"#,
            todayISO: "2026-06-09"
        )
        let verdict = TodayVerdictEngine.evaluate(input)
        let prescription = try XCTUnwrap(TodayPrescriptionEngine.plan(input: input, verdict: verdict))
        var flow = TrainFlowState(prescription: prescription)

        flow.logSet(CompletedSetObservation(weightKg: 60, reps: 6, rir: 2, painReported: false))
        flow.restFinished()
        flow.replaceCurrentExercise(with: "db-bench-press")
        flow.logSet(CompletedSetObservation(weightKg: 30, reps: 8, rir: 2, painReported: false))
        flow.restFinished()
        XCTAssertTrue(flow.replacementCandidates.contains("bench-press"))
        flow.replaceCurrentExercise(with: "bench-press")
        flow.logSet(CompletedSetObservation(weightKg: 60, reps: 7, rir: 1, painReported: false))
        flow.requestFinish()
        flow.confirmEnd(reason: .timeUp)

        let session = CompletedSessionBuilder.build(
            from: flow,
            sessionId: "swap-back",
            dateISO: "2026-06-09",
            startedAtISO: "t0",
            finishedAtISO: "t1",
            durationMinutes: 14
        )

        XCTAssertEqual(
            session.exercises.map(\.exerciseId),
            ["bench-press", "db-bench-press", "bench-press"],
            "persistence order follows fact occurrence segments, not exercise-id aggregation"
        )
        XCTAssertEqual(session.exercises.map { $0.sets.count }, [1, 1, 1])
        XCTAssertEqual(session.exercises.map { $0.sets.first?.reps }, [6, 8, 7])

        let exerciseRecordIds = session.exercises.compactMap(\.id)
        let setRecordIds = session.exercises.flatMap(\.sets).compactMap(\.id)
        XCTAssertEqual(Set(exerciseRecordIds).count, 3, "each repeated exercise occurrence needs a unique record id")
        XCTAssertEqual(Set(setRecordIds).count, 3, "each repeated exercise set needs a unique record id")

        XCTAssertEqual(session.exercises[0].storage["replacementRole"], .string("original"))
        XCTAssertEqual(session.exercises[0].storage["originalExerciseId"], .string("bench-press"))
        XCTAssertEqual(session.exercises[0].storage["actualExerciseId"], .string("db-bench-press"))
        XCTAssertEqual(
            session.exercises[1].storage["replacementLinks"],
            .array([
                .object([
                    "originalExerciseId": .string("bench-press"),
                    "actualExerciseId": .string("db-bench-press"),
                    "replacementRole": .string("actual"),
                ]),
                .object([
                    "originalExerciseId": .string("db-bench-press"),
                    "actualExerciseId": .string("bench-press"),
                    "replacementRole": .string("original"),
                ]),
            ]),
            "the middle occurrence preserves both incoming and outgoing replacement relations"
        )
        XCTAssertEqual(session.exercises[2].storage["replacementRole"], .string("actual"))
        XCTAssertEqual(session.exercises[2].storage["originalExerciseId"], .string("db-bench-press"))
        XCTAssertEqual(session.exercises[2].storage["actualExerciseId"], .string("bench-press"))
    }

    func testMovingFutureExerciseAfterReplacementKeepsEarlierFactsAheadOfMovedExercise() throws {
        let input = try TestSupport.makeInput(
            appDataJSON: #"{"schemaVersion": 8, "programTemplate": {"splitType": "push-pull-legs"}}"#,
            todayISO: "2026-06-09"
        )
        let verdict = TodayVerdictEngine.evaluate(input)
        let prescription = try XCTUnwrap(TodayPrescriptionEngine.plan(input: input, verdict: verdict))
        var flow = TrainFlowState(prescription: prescription)

        flow.logSet(CompletedSetObservation(weightKg: 60, reps: 6, rir: 2, painReported: false))
        flow.restFinished()
        flow.replaceCurrentExercise(with: "db-bench-press")
        let movedExerciseId = flow.plan.exercises[2].exerciseId
        XCTAssertTrue(flow.moveToCurrentCandidates.contains(movedExerciseId))
        flow.moveExerciseToCurrent(movedExerciseId)
        flow.logSet(CompletedSetObservation(weightKg: 40, reps: 10, rir: 2, painReported: false))
        flow.requestFinish()
        flow.confirmEnd(reason: .timeUp)

        let session = CompletedSessionBuilder.build(
            from: flow,
            sessionId: "swap-then-move",
            dateISO: "2026-06-09",
            startedAtISO: "t0",
            finishedAtISO: "t1",
            durationMinutes: 7
        )

        XCTAssertEqual(
            session.exercises.map(\.exerciseId),
            ["bench-press", movedExerciseId],
            "moving untouched future work must not reorder already completed facts"
        )
        XCTAssertEqual(session.exercises.map { $0.sets.count }, [1, 1])
        XCTAssertEqual(session.exercises.map { $0.sets.first?.reps }, [6, 10])
    }

    func testZeroFactReplacementAuditSurvivesMovingAnotherExerciseAhead() throws {
        let input = try TestSupport.makeInput(
            appDataJSON: #"{"schemaVersion": 8, "programTemplate": {"splitType": "push-pull-legs"}}"#,
            todayISO: "2026-06-09"
        )
        let verdict = TodayVerdictEngine.evaluate(input)
        let prescription = try XCTUnwrap(TodayPrescriptionEngine.plan(input: input, verdict: verdict))
        var flow = TrainFlowState(prescription: prescription)

        flow.replaceCurrentExercise(with: "db-bench-press")
        let movedExerciseId = flow.plan.exercises[2].exerciseId
        flow.moveExerciseToCurrent(movedExerciseId)
        let movedPlan = try XCTUnwrap(flow.currentExercise)
        for set in movedPlan.sets {
            flow.logSet(CompletedSetObservation(
                weightKg: set.targetWeightKg,
                reps: set.targetReps,
                rir: 2,
                painReported: false
            ))
            flow.restFinished()
        }
        XCTAssertEqual(flow.currentExercise?.exerciseId, "db-bench-press")
        flow.logSet(CompletedSetObservation(weightKg: 30, reps: 8, rir: 2, painReported: false))
        flow.requestFinish()
        flow.confirmEnd(reason: .timeUp)

        let session = CompletedSessionBuilder.build(
            from: flow,
            sessionId: "zero-swap-move",
            dateISO: "2026-06-09",
            startedAtISO: "t0",
            finishedAtISO: "t1",
            durationMinutes: 12
        )
        let replacement = try XCTUnwrap(
            session.exercises.first(where: { $0.exerciseId == "db-bench-press" })
        )
        XCTAssertEqual(replacement.storage["originalExerciseId"], .string("bench-press"))
        XCTAssertEqual(replacement.storage["actualExerciseId"], .string("db-bench-press"))
        XCTAssertNil(
            replacement.storage["replacementRole"],
            "zero-fact move keeps the exact pre-split audit vocabulary"
        )
    }

    func testSplitReplacementActualRoleSurvivesMovingAnotherExerciseAhead() throws {
        let input = try TestSupport.makeInput(
            appDataJSON: #"{"schemaVersion": 8, "programTemplate": {"splitType": "push-pull-legs"}}"#,
            todayISO: "2026-06-09"
        )
        let verdict = TodayVerdictEngine.evaluate(input)
        let prescription = try XCTUnwrap(TodayPrescriptionEngine.plan(input: input, verdict: verdict))
        var flow = TrainFlowState(prescription: prescription)

        flow.logSet(CompletedSetObservation(weightKg: 60, reps: 6, rir: 2, painReported: false))
        flow.restFinished()
        flow.replaceCurrentExercise(with: "db-bench-press")
        let movedExerciseId = flow.plan.exercises[2].exerciseId
        flow.moveExerciseToCurrent(movedExerciseId)
        let movedPlan = try XCTUnwrap(flow.currentExercise)
        for set in movedPlan.sets {
            flow.logSet(CompletedSetObservation(
                weightKg: set.targetWeightKg,
                reps: set.targetReps,
                rir: 2,
                painReported: false
            ))
            flow.restFinished()
        }
        XCTAssertEqual(flow.currentExercise?.exerciseId, "db-bench-press")
        flow.logSet(CompletedSetObservation(weightKg: 30, reps: 8, rir: 2, painReported: false))
        flow.requestFinish()
        flow.confirmEnd(reason: .timeUp)

        let session = CompletedSessionBuilder.build(
            from: flow,
            sessionId: "split-swap-move",
            dateISO: "2026-06-09",
            startedAtISO: "t0",
            finishedAtISO: "t1",
            durationMinutes: 14
        )
        XCTAssertEqual(
            session.exercises.map(\.exerciseId),
            ["bench-press", movedExerciseId, "db-bench-press"]
        )
        let replacement = try XCTUnwrap(
            session.exercises.first(where: { $0.exerciseId == "db-bench-press" })
        )
        XCTAssertEqual(replacement.storage["originalExerciseId"], .string("bench-press"))
        XCTAssertEqual(replacement.storage["actualExerciseId"], .string("db-bench-press"))
        XCTAssertEqual(replacement.storage["replacementRole"], .string("actual"))
    }

    // 跳过本身就是已发生事实：换动作后仍归旧动作，新动作只承接尚未发生的剩余组。
    func testSkipThenReplaceKeepsSkipRecordWithOriginalExercise() throws {
        let input = try TestSupport.makeInput(
            appDataJSON: #"{"schemaVersion": 8, "programTemplate": {"splitType": "push-pull-legs"}}"#,
            todayISO: "2026-06-09"
        )
        let verdict = TodayVerdictEngine.evaluate(input)
        let prescription = try XCTUnwrap(TodayPrescriptionEngine.plan(input: input, verdict: verdict))
        var flow = TrainFlowState(prescription: prescription)
        flow.skipSet(reason: .equipmentBusy)              // bench-press 第 1 组跳过
        flow.replaceCurrentExercise(with: "db-bench-press")
        flow.logSet(CompletedSetObservation(weightKg: 30, reps: 8, rir: 2, painReported: false))
        flow.requestFinish()
        flow.confirmEnd(reason: .timeUp)

        let session = CompletedSessionBuilder.build(
            from: flow, sessionId: "s", dateISO: "2026-06-09",
            startedAtISO: "t0", finishedAtISO: "t1", durationMinutes: 5
        )
        XCTAssertEqual(
            session.storage["skippedSets"],
            .array([.object(["exerciseId": .string("bench-press"), "setIndex": .int(1), "reason": .string("equipmentBusy")])])
        )
        XCTAssertEqual(session.exercises.map(\.exerciseId), ["bench-press", "db-bench-press"])
        XCTAssertTrue(session.exercises[0].sets.isEmpty)
        XCTAssertEqual(session.exercises[0].storage["replacementRole"], .string("original"))
        XCTAssertEqual(session.exercises[1].sets.count, 1)
        XCTAssertEqual(session.exercises[1].storage["replacementRole"], .string("actual"))
    }

    func testReplacementAuditFieldsAreRecorded() throws {
        let input = try TestSupport.makeInput(
            appDataJSON: #"{"schemaVersion": 8, "programTemplate": {"splitType": "push-pull-legs"}}"#,
            todayISO: "2026-06-09"
        )
        let verdict = TodayVerdictEngine.evaluate(input)
        let prescription = try XCTUnwrap(TodayPrescriptionEngine.plan(input: input, verdict: verdict))
        var flow = TrainFlowState(prescription: prescription)
        flow.replaceCurrentExercise(with: "db-bench-press")
        flow.logSet(CompletedSetObservation(weightKg: 30, reps: 8, rir: 2, painReported: false))
        flow.requestFinish()
        flow.confirmEnd(reason: .fatigue)

        let session = CompletedSessionBuilder.build(
            from: flow, sessionId: "s", dateISO: "2026-06-09",
            startedAtISO: "t0", finishedAtISO: "t1", durationMinutes: 10
        )
        let exercise = try XCTUnwrap(session.exercises.first)
        XCTAssertEqual(exercise.exerciseId, "db-bench-press")
        XCTAssertEqual(exercise.storage["originalExerciseId"], .string("bench-press"))
        XCTAssertEqual(exercise.storage["actualExerciseId"], .string("db-bench-press"))
        XCTAssertNil(exercise.storage["replacementRole"], "zero-fact replacement keeps the existing bytes")

        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        let encoded = try encoder.encode(session.storage)
        XCTAssertEqual(
            encoded,
            Data(#"{"completed":true,"date":"2026-06-09","durationMin":10,"endReason":"fatigue","exercises":[{"actualExerciseId":"db-bench-press","exerciseId":"db-bench-press","id":"s-db-bench-press","originalExerciseId":"bench-press","sets":[{"completionStatus":"completed","done":true,"exerciseId":"db-bench-press","id":"s-db-bench-press-1","reps":8,"rir":2,"setIndex":1,"weight":30}]}],"finishedAt":"t1","id":"s","startedAt":"t0","templateId":"push-a"}"#.utf8),
            "zero-fact replacement must remain byte-identical to the frozen pre-fix output"
        )
    }

    // 重排是队列事实而非动作替换：完成记录按实际执行顺序输出，且不产生替换/跳过审计。
    func testMovedExerciseBuildsInExecutionOrderWithoutReplacementOrSkipAudit() throws {
        let input = try TestSupport.makeInput(
            appDataJSON: #"{"schemaVersion": 8, "programTemplate": {"splitType": "push-pull-legs"}}"#,
            todayISO: "2026-06-09"
        )
        let verdict = TodayVerdictEngine.evaluate(input)
        let prescription = try XCTUnwrap(TodayPrescriptionEngine.plan(input: input, verdict: verdict))
        var flow = TrainFlowState(prescription: prescription)
        let originalCurrentId = try XCTUnwrap(flow.currentExercise?.exerciseId)
        let movedPlan = flow.plan.exercises[2]

        flow.moveExerciseToCurrent(movedPlan.exerciseId)
        for _ in movedPlan.sets {
            flow.logSet(CompletedSetObservation(
                weightKg: movedPlan.sets[0].targetWeightKg,
                reps: movedPlan.sets[0].targetReps,
                rir: 2,
                painReported: false
            ))
            flow.restFinished()
        }
        XCTAssertEqual(flow.currentExercise?.exerciseId, originalCurrentId)
        flow.logSet(CompletedSetObservation(weightKg: 60, reps: 6, rir: 2, painReported: false))
        flow.requestFinish()
        flow.confirmEnd(reason: .timeUp)

        let session = CompletedSessionBuilder.build(
            from: flow,
            sessionId: "moved-order",
            dateISO: "2026-06-09",
            startedAtISO: "t0",
            finishedAtISO: "t1",
            durationMinutes: 12
        )

        XCTAssertEqual(session.exercises.map(\.exerciseId), [movedPlan.exerciseId, originalCurrentId])
        for exercise in session.exercises {
            XCTAssertNil(exercise.storage["originalExerciseId"])
            XCTAssertNil(exercise.storage["actualExerciseId"])
        }
        XCTAssertNil(session.storage["skippedSets"])
        XCTAssertNil(session.storage["skippedExercises"])
        XCTAssertTrue(flow.replacements.isEmpty)
        XCTAssertTrue(flow.skippedSets.isEmpty)
        XCTAssertTrue(flow.skippedExercises.isEmpty)
    }

    func testSessionEditsPersistAddedAndRemovedAuditWithoutCallingRemovalASkip() throws {
        let input = try TestSupport.makeInput(
            appDataJSON: #"{"schemaVersion": 8, "programTemplate": {"splitType": "push-pull-legs"}}"#,
            todayISO: "2026-06-09"
        )
        let verdict = TodayVerdictEngine.evaluate(input)
        let prescription = try XCTUnwrap(TodayPrescriptionEngine.plan(input: input, verdict: verdict))
        var flow = TrainFlowState(prescription: prescription)
        let added = ExerciseSetPlan(
            exerciseId: "db-bench-press",
            restSeconds: 90,
            repLowerBound: 8,
            repUpperBound: 12,
            stepKg: 2.5,
            loadType: "external",
            sets: (1...3).map {
                PlannedSet(index: $0, targetWeightKg: 30, targetReps: 10, targetRir: 2)
            }
        )
        flow.addExercise(added)
        let removed = try XCTUnwrap(flow.removal(at: 3))
        flow.removeExercise(removed)
        flow.skipExercise(reason: .timeShort)
        flow.logSet(CompletedSetObservation(weightKg: 30, reps: 10, rir: 2, painReported: false))
        flow.requestFinish()
        flow.confirmEnd(reason: .timeUp)

        let session = CompletedSessionBuilder.build(
            from: flow, sessionId: "session-edit", dateISO: "2026-06-09",
            startedAtISO: "t0", finishedAtISO: "t1", durationMinutes: 8
        )

        XCTAssertEqual(session.exercises.map(\.exerciseId), ["db-bench-press"])
        XCTAssertEqual(
            session.storage["sessionEdits"],
            .object([
                "added": .array([
                    .object(["exerciseId": .string("db-bench-press"), "position": .int(1)]),
                ]),
                "removed": .array([
                    .object([
                        "exerciseId": .string(removed.exercise.exerciseId),
                        "position": .int(Int64(removed.index)),
                    ]),
                ]),
            ])
        )
        XCTAssertEqual(
            session.storage["skippedExercises"],
            .array([.object(["exerciseId": .string("bench-press"), "reason": .string("timeShort")])])
        )
        XCTAssertFalse(
            session.storage["skippedExercises"]?.asArray?.contains {
                $0.asObject?["exerciseId"] == .string(removed.exercise.exerciseId)
            } ?? true,
            "neutral removal must never become a skipped exercise"
        )
    }

    func testDuplicateExerciseIdMayAuditOneRemovedOccurrenceAndSkipAnother() throws {
        let input = try TestSupport.makeInput(
            appDataJSON: #"{"schemaVersion": 8, "programTemplate": {"splitType": "push-pull-legs"}}"#,
            todayISO: "2026-06-09"
        )
        let verdict = TodayVerdictEngine.evaluate(input)
        let base = try XCTUnwrap(TodayPrescriptionEngine.plan(input: input, verdict: verdict))
        let repeated = try XCTUnwrap(base.exercises.first)
        let trailing = try XCTUnwrap(base.exercises.dropFirst().first)
        var flow = TrainFlowState(prescription: TodayPrescription(
            dayCode: base.dayCode,
            exercises: [repeated, repeated, trailing],
            dayReasons: base.dayReasons
        ))
        let removal = try XCTUnwrap(flow.removal(at: 1))

        flow.removeExercise(removal)
        flow.skipExercise(reason: .timeShort)
        flow.requestFinish()
        flow.confirmEnd(reason: .timeUp)

        let session = CompletedSessionBuilder.build(
            from: flow,
            sessionId: "duplicate-occurrence",
            dateISO: "2026-06-09",
            startedAtISO: "t0",
            finishedAtISO: "t1",
            durationMinutes: 2
        )

        XCTAssertEqual(
            session.storage["sessionEdits"],
            .object([
                "removed": .array([
                    .object([
                        "exerciseId": .string(repeated.exerciseId),
                        "position": .int(1),
                    ]),
                ]),
            ])
        )
        XCTAssertEqual(
            session.storage["skippedExercises"],
            .array([
                .object([
                    "exerciseId": .string(repeated.exerciseId),
                    "reason": .string("timeShort"),
                ]),
            ]),
            "event-level mutual exclusion permits another occurrence with the same id to be skipped"
        )
    }

    func testNoSessionEditMatchesOriginMainCompletedSessionByteGolden() throws {
        let inputData = try Data(contentsOf: TestSupport.fixtureURL(
            "completed-session-no-edits.origin-main.input.json"
        ))
        let golden = try JSONDecoder().decode(CompletedSessionGoldenInput.self, from: inputData)
        XCTAssertEqual(
            golden.baselineCommit,
            "420a8d60816a8624bde9e26341ae85f7fef6698a"
        )
        let input = try TestSupport.makeInput(
            appDataJSON: golden.appDataJSON,
            todayISO: golden.todayISO
        )
        let verdict = TodayVerdictEngine.evaluate(input)
        let prescription = try XCTUnwrap(TodayPrescriptionEngine.plan(
            input: input,
            verdict: verdict
        ))
        var flow = TrainFlowState(prescription: prescription)
        flow.logSet(CompletedSetObservation(
            weightKg: 60, reps: 6, rir: 2, painReported: false
        ))
        flow.restFinished()
        flow.skipSet(reason: .equipmentBusy)
        flow.logSet(CompletedSetObservation(
            weightKg: 60, reps: 7, rir: 1, painReported: true
        ))
        flow.restFinished()
        flow.logSet(CompletedSetObservation(
            weightKg: 22.5, reps: 8, rir: 2, painReported: false
        ))
        flow.requestFinish()
        flow.confirmEnd(reason: .timeUp)
        let session = CompletedSessionBuilder.build(
            from: flow,
            sessionId: golden.sessionId,
            dateISO: golden.dateISO,
            startedAtISO: golden.startedAtISO,
            finishedAtISO: golden.finishedAtISO,
            durationMinutes: golden.durationMinutes
        )
        XCTAssertNil(session.storage["sessionEdits"])
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        let encoded = try encoder.encode(session.storage)
        XCTAssertEqual(
            encoded,
            try expectedGoldenBytes("completed-session-no-edits.origin-main.expected.json"),
            "no-edit completed-session bytes must stay identical to the frozen origin/main output"
        )
    }
}
