// M3-3：完成会话构建器——把训练流终态变成 canonical TrainingSession 存储对象。
// 字段沿 legacy 词汇表（开门设计）；只记录用户事实（实际组/跳过/替换/收尾原因），
// 永不写入 engine 输出（处方目标值不落盘）。id/时间由调用方注入（无 clock）。

import Foundation
import XCTest
import RedeDomain
@testable import RedeTrainingDecision

final class CompletedSessionBuilderTests: XCTestCase {
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

    // 跳过后再换动作：跳过留痕必须归到最终动作 id（与 exercises 可对齐）
    func testSkipThenReplaceAlignsSkipRecordToFinalExercise() throws {
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
            .array([.object(["exerciseId": .string("db-bench-press"), "setIndex": .int(1), "reason": .string("equipmentBusy")])])
        )
        XCTAssertEqual(session.exercises.first?.exerciseId, "db-bench-press")
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
    }
}
