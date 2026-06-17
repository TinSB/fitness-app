// FR-PL2 计划页周排期投影：复用 daySequence/slots 的只读派生，固定输入固定输出。
// 同源守护：第一天必须 == 今日页此刻的训练日（sessions.count % sequence.count）。

import Foundation
import XCTest
@testable import RedeTrainingDecision

final class PlanWeekProjectionTests: XCTestCase {
    func testUpperLowerTwoWeeksFromStart() {
        let weeks = PlanWeekProjection.weeks(
            splitType: "upper-lower", daysPerWeek: 4, completedSessionCount: 0, weeks: 2
        )
        XCTAssertEqual(weeks.count, 2)
        XCTAssertEqual(weeks[0].map(\.dayCode), ["upper", "lower", "upper", "lower"])
        XCTAssertEqual(weeks[1].map(\.dayCode), ["upper", "lower", "upper", "lower"])
        for day in weeks.flatMap({ $0 }) {
            XCTAssertGreaterThan(day.exerciseCount, 0)
            XCTAssertFalse(day.patternCodes.isEmpty)
        }
    }

    func testRotationOffsetByCompletedCount() {
        // 6 天 PPL：完成 2 次 → 下一个训练日 = legs-a（sequence[2]）。
        let weeks = PlanWeekProjection.weeks(
            splitType: "push-pull-legs", daysPerWeek: 6, completedSessionCount: 2, weeks: 1
        )
        XCTAssertEqual(weeks[0].first?.dayCode, "legs-a")
        XCTAssertEqual(weeks[0].count, 6)
    }

    func testPatternCodesDedupedPerDay() throws {
        // push-a 含两处 horizontal-press（compound + accessory）→ 投影去重，只出现一次。
        let weeks = PlanWeekProjection.weeks(
            splitType: "push-pull-legs", daysPerWeek: 6, completedSessionCount: 0, weeks: 1
        )
        let pushA = try XCTUnwrap(weeks[0].first { $0.dayCode == "push-a" })
        XCTAssertEqual(pushA.patternCodes.count, Set(pushA.patternCodes).count, "模式码未去重")
        XCTAssertEqual(pushA.patternCodes.filter { $0 == "horizontal-press" }.count, 1)
    }

    func testFirstDayMatchesTodayEngineDayCode() {
        // 同源：投影第一天 == 今日处方引擎此刻会选的训练日。
        let split = "upper-lower"
        let completed = 5
        let seq = TodayPrescriptionEngine.daySequence(splitType: split)
        let weeks = PlanWeekProjection.weeks(
            splitType: split, daysPerWeek: 4, completedSessionCount: completed, weeks: 1
        )
        XCTAssertEqual(weeks[0].first?.dayCode, seq[completed % seq.count])
    }

    func testEdgeCasesReturnEmpty() {
        XCTAssertTrue(PlanWeekProjection.weeks(splitType: "upper-lower", daysPerWeek: 0, completedSessionCount: 0).isEmpty)
        XCTAssertTrue(PlanWeekProjection.weeks(splitType: "upper-lower", daysPerWeek: 4, completedSessionCount: 0, weeks: 0).isEmpty)
        XCTAssertTrue(PlanWeekProjection.weeks(splitType: "upper-lower", daysPerWeek: 4, completedSessionCount: -1).isEmpty)
    }
}
