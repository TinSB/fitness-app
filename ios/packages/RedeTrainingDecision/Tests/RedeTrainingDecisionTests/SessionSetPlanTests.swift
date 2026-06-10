// M3-1 验收①：固定场景产出确定的逐组序列与休息建议。
// MVP 组形 = straight sets（每组同重同次）；组形学习/top-backoff 明示后置（§6.3）。

import Foundation
import XCTest
@testable import RedeTrainingDecision

final class SessionSetPlanTests: XCTestCase {
    private func makePlan(appDataJSON: String = #"{"schemaVersion": 8}"#, today: String = "2026-06-09") throws -> SessionSetPlan {
        let input = try TestSupport.makeInput(appDataJSON: appDataJSON, todayISO: today)
        let verdict = TodayVerdictEngine.evaluate(input)
        let prescription = try XCTUnwrap(TodayPrescriptionEngine.plan(input: input, verdict: verdict))
        return SessionSetPlanner.expand(prescription)
    }

    func testStraightSetExpansionForFirstExposureUpperDay() throws {
        let plan = try makePlan()
        XCTAssertEqual(plan.dayCode, "upper")
        XCTAssertEqual(plan.exercises.count, 7)

        let first = try XCTUnwrap(plan.exercises.first)
        XCTAssertEqual(first.exerciseId, "db-bench-press")
        XCTAssertEqual(first.sets.count, 3)
        XCTAssertEqual(first.restSeconds, 150)
        XCTAssertEqual(first.repLowerBound, 6)
        XCTAssertEqual(first.repUpperBound, 10)
        for (index, set) in first.sets.enumerated() {
            XCTAssertEqual(set.index, index + 1)
            XCTAssertEqual(set.targetWeightKg, 30)
            XCTAssertEqual(set.targetReps, 6)
            XCTAssertEqual(set.targetRir, 2)
        }
    }

    func testEveryExerciseHasPositiveRestSeconds() throws {
        let plan = try makePlan()
        for exercise in plan.exercises {
            XCTAssertGreaterThan(exercise.restSeconds, 0, exercise.exerciseId)
        }
    }

    func testExpansionIsDeterministic() throws {
        XCTAssertEqual(try makePlan(), try makePlan())
    }

    func testSetCountsFollowPrescription() throws {
        let plan = try makePlan()
        XCTAssertEqual(plan.exercises.map { $0.sets.count }, [3, 3, 3, 3, 3, 2, 2])
    }

    // 休息建议是验收的一部分：五个训练日的 rest 序列逐一精确锁定（slot 合同）
    func testRestSecondsLockedForAllFiveTrainingDays() throws {
        XCTAssertEqual(try makePlan().exercises.map(\.restSeconds), [150, 120, 120, 90, 60, 60, 60]) // upper
        XCTAssertEqual(
            try makePlan(appDataJSON: TestSupport.appDataJSON(historyDates: ["2026-06-07"])).exercises.map(\.restSeconds),
            [150, 120, 120, 75, 60] // lower
        )
        let ppl = #"{"schemaVersion": 8, "programTemplate": {"splitType": "push-pull-legs"}}"#
        XCTAssertEqual(try makePlan(appDataJSON: ppl).exercises.map(\.restSeconds), [180, 120, 120, 75, 60, 75]) // push-a
        let pplOne = #"{"schemaVersion": 8, "programTemplate": {"splitType": "push-pull-legs"}, "history": \#(TestSupport.historyJSON(dates: ["2026-06-07"]))}"#
        XCTAssertEqual(try makePlan(appDataJSON: pplOne).exercises.map(\.restSeconds), [120, 120, 150, 60, 75, 75]) // pull-a
        let pplTwo = #"{"schemaVersion": 8, "programTemplate": {"splitType": "push-pull-legs"}, "history": \#(TestSupport.historyJSON(dates: ["2026-06-05", "2026-06-07"]))}"#
        XCTAssertEqual(try makePlan(appDataJSON: pplTwo).exercises.map(\.restSeconds), [210, 180, 120, 75, 60]) // legs-a
    }
}
