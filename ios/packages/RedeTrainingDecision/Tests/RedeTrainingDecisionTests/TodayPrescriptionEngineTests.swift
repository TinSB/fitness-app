// M2-2 验收：固定输入产出确定处方；可解释「为什么」字段（typed，零文案）。
// 引擎吃 CleanTrainingDecisionInput + M2-1 裁决（不重复判断练不练），kg 口径输出。

import Foundation
import XCTest
@testable import RedeTrainingDecision

final class TodayPrescriptionEngineTests: XCTestCase {
    private func makeVerdictAndInput(
        appDataJSON: String,
        today: String
    ) throws -> (TodayVerdict, CleanTrainingDecisionInput) {
        let input = try TestSupport.makeInput(appDataJSON: appDataJSON, todayISO: today)
        return (TodayVerdictEngine.evaluate(input), input)
    }

    private func plan(appDataJSON: String, today: String) throws -> TodayPrescription? {
        let (verdict, input) = try makeVerdictAndInput(appDataJSON: appDataJSON, today: today)
        return TodayPrescriptionEngine.plan(input: input, verdict: verdict)
    }

    // 裁决=休 → 无处方（不练就不开单）
    func testRestVerdictYieldsNoPrescription() throws {
        let json = TestSupport.appDataJSON(historyDates: ["2026-06-09"])
        XCTAssertNil(try plan(appDataJSON: json, today: "2026-06-09"))
    }

    // 零历史：首次接触——全部动作 start 档，重量=catalog 起始值，次数=repMin
    func testFirstExposureUsesCatalogStartWeights() throws {
        let prescription = try XCTUnwrap(try plan(appDataJSON: #"{"schemaVersion": 8}"#, today: "2026-06-09"))
        XCTAssertFalse(prescription.exercises.isEmpty)
        for exercise in prescription.exercises {
            XCTAssertEqual(exercise.change, .start)
            XCTAssertEqual(exercise.reason, .firstExposure)
            XCTAssertNil(exercise.previousWeightKg)
            let entry = try XCTUnwrap(ExerciseCatalog.minimal.entry(id: exercise.exerciseId))
            XCTAssertEqual(exercise.targetWeightKg, entry.startWeightKg)
            XCTAssertEqual(exercise.targetReps, exercise.repLowerBound, "首练次数目标 = 区间下限")
            XCTAssertEqual(exercise.targetRir, 2)
        }
    }

    // 训练日轮转：完成数取模；splitType 含 upper → upper/lower 序列
    func testDayRotationByCompletedSessionCount() throws {
        let zero = try XCTUnwrap(try plan(
            appDataJSON: #"{"schemaVersion": 8, "programTemplate": {"splitType": "upper-lower"}}"#,
            today: "2026-06-09"
        ))
        XCTAssertEqual(zero.dayCode, "upper")

        let one = try XCTUnwrap(try plan(
            appDataJSON: TestSupport.appDataJSON(historyDates: ["2026-06-07"], program: #"{"splitType": "upper-lower"}"#),
            today: "2026-06-09"
        ))
        XCTAssertEqual(one.dayCode, "lower")
    }

    func testPplSplitMapsToPushPullLegs() throws {
        let prescription = try XCTUnwrap(try plan(
            appDataJSON: #"{"schemaVersion": 8, "programTemplate": {"splitType": "push-pull-legs"}}"#,
            today: "2026-06-09"
        ))
        XCTAssertEqual(prescription.dayCode, "push-a")
    }

    func testUnknownSplitFallsBackToUpperLower() throws {
        let prescription = try XCTUnwrap(try plan(appDataJSON: #"{"schemaVersion": 8}"#, today: "2026-06-09"))
        XCTAssertEqual(prescription.dayCode, "upper")
    }

    // 双重渐进：全组打满 repMax 且 RIR 富余 → +2.5kg、次数重置 repMin
    func testProgressionIncreasesAfterRepCeiling() throws {
        // 两条已完成 session 让轮转落回 upper 日（2 % 2 = 0），从而能断言
        // db-bench-press 的渐进结果。
        let pushPrescription = try XCTUnwrap(try plan(
            appDataJSON: #"{"schemaVersion": 8, "programTemplate": {"splitType": "upper-lower"}, "history": [{"id": "s0", "date": "2026-06-05", "completed": true, "exercises": []}, {"id": "s1", "date": "2026-06-07", "completed": true, "exercises": [{"exerciseId": "db-bench-press", "sets": [{"weight": 30, "reps": 10, "rir": 2}, {"weight": 30, "reps": 10, "rir": 2}, {"weight": 30, "reps": 10, "rir": 2}]}]}]}"#,
            today: "2026-06-09"
        ))
        XCTAssertEqual(pushPrescription.dayCode, "upper")
        let bench = try XCTUnwrap(pushPrescription.exercises.first { $0.exerciseId == "db-bench-press" })
        XCTAssertEqual(bench.targetWeightKg, 32.5)
        XCTAssertEqual(bench.change, .increase)
        XCTAssertEqual(bench.reason, .repCeilingReached)
        XCTAssertEqual(bench.previousWeightKg, 30)
    }

    // 上次力竭（mean RIR ≤ 0.5）→ −2.5kg 回退
    func testProgressionEasesAfterNearFailure() throws {
        let json = #"{"schemaVersion": 8, "programTemplate": {"splitType": "upper-lower"}, "history": [{"id": "s0", "date": "2026-06-05", "completed": true, "exercises": []}, {"id": "s1", "date": "2026-06-04", "completed": true, "exercises": [{"exerciseId": "db-bench-press", "sets": [{"weight": 30, "reps": 8, "rir": 0}, {"weight": 30, "reps": 7, "rir": 0}]}]}]}"#
        let prescription = try XCTUnwrap(try plan(appDataJSON: json, today: "2026-06-09"))
        let bench = try XCTUnwrap(prescription.exercises.first { $0.exerciseId == "db-bench-press" })
        XCTAssertEqual(bench.targetWeightKg, 27.5)
        XCTAssertEqual(bench.change, .ease)
        XCTAssertEqual(bench.reason, .nearFailureLastTime)
    }

    // 区间内推进 → 持平冲上限
    func testProgressionHoldsMidRange() throws {
        let json = #"{"schemaVersion": 8, "programTemplate": {"splitType": "upper-lower"}, "history": [{"id": "s0", "date": "2026-06-05", "completed": true, "exercises": []}, {"id": "s1", "date": "2026-06-04", "completed": true, "exercises": [{"exerciseId": "db-bench-press", "sets": [{"weight": 30, "reps": 8, "rir": 2}, {"weight": 30, "reps": 7, "rir": 2}]}]}]}"#
        let prescription = try XCTUnwrap(try plan(appDataJSON: json, today: "2026-06-09"))
        let bench = try XCTUnwrap(prescription.exercises.first { $0.exerciseId == "db-bench-press" })
        XCTAssertEqual(bench.targetWeightKg, 30)
        XCTAssertEqual(bench.change, .hold)
        XCTAssertEqual(bench.reason, .holdProgressing)
    }

    // 裁决=轻 → 负重 ×0.9（2.5 取整），day-level 留痕
    func testLightVerdictReducesLoad() throws {
        // 停练 20 天 → light(longGapReentry)；db-bench-press 上次 30kg
        let json = #"{"schemaVersion": 8, "programTemplate": {"splitType": "upper-lower"}, "history": [{"id": "s0", "date": "2026-05-18", "completed": true, "exercises": []}, {"id": "s1", "date": "2026-05-20", "completed": true, "exercises": [{"exerciseId": "db-bench-press", "sets": [{"weight": 30, "reps": 8, "rir": 2}]}]}]}"#
        let (verdict, input) = try makeVerdictAndInput(appDataJSON: json, today: "2026-06-09")
        XCTAssertEqual(verdict.call, .light)
        let prescription = try XCTUnwrap(TodayPrescriptionEngine.plan(input: input, verdict: verdict))
        XCTAssertTrue(prescription.dayReasons.contains(.verdictLightReduced))
        let bench = try XCTUnwrap(prescription.exercises.first { $0.exerciseId == "db-bench-press" })
        XCTAssertEqual(bench.targetWeightKg, 27.5) // 30 × 0.9 = 27 → 2.5 取整 27.5

        // 小重量动作：×0.9 取整会弹回原值 → 强制下调一格（轻练必须真减）
        let lateral = try XCTUnwrap(prescription.exercises.first { $0.exerciseId == "lateral-raise" })
        XCTAssertEqual(lateral.targetWeightKg, 5.0) // 7.5 × 0.9 = 6.75 → 弹回 7.5 → 下调 5.0
    }

    // 槽位无法匹配：留痕 slotUnfilled，不静默、不崩溃，其余槽位照常出
    func testUnfillableSlotIsReportedNotSilent() throws {
        let tinyCatalog = ExerciseCatalog(
            catalogVersion: "test",
            entries: [ExerciseCatalog.minimal.entry(id: "db-bench-press")!]
        )
        let input = try TestSupport.makeInput(appDataJSON: #"{"schemaVersion": 8}"#, todayISO: "2026-06-09")
        let prescription = try XCTUnwrap(TodayPrescriptionEngine.plan(
            input: input,
            verdict: TodayVerdictEngine.evaluate(input),
            catalog: tinyCatalog
        ))
        XCTAssertEqual(prescription.exercises.map(\.exerciseId), ["db-bench-press"])
        XCTAssertTrue(prescription.dayReasons.contains { reason in
            if case .slotUnfilled = reason { return true }
            return false
        })
    }

    // 确定性 + 顺序稳定
    func testPrescriptionIsDeterministicWithStableOrder() throws {
        let json = #"{"schemaVersion": 8}"#
        let a = try XCTUnwrap(try plan(appDataJSON: json, today: "2026-06-09"))
        let b = try XCTUnwrap(try plan(appDataJSON: json, today: "2026-06-09"))
        XCTAssertEqual(a, b)
        XCTAssertEqual(a.exercises.map(\.exerciseId), b.exercises.map(\.exerciseId))
    }

    // 每个处方动作都来自 catalog（动作事实经 catalog）
    func testEveryPrescribedExerciseExistsInCatalog() throws {
        let prescription = try XCTUnwrap(try plan(appDataJSON: #"{"schemaVersion": 8}"#, today: "2026-06-09"))
        for exercise in prescription.exercises {
            XCTAssertNotNil(ExerciseCatalog.minimal.entry(id: exercise.exerciseId), exercise.exerciseId)
        }
    }
}
