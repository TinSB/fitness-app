// FR-PL3 计划调整提案合同（频率/依从）：持续落后才提、降到可持续中位数、四道不提守门 + 中位数 + 确定性。

import XCTest
@testable import RedeTrainingDecision

final class PlanAdjustmentEngineTests: XCTestCase {
    private func proposal(planned: Int, weeks: [Int]) -> PlanAdjustmentProposal? {
        PlanAdjustmentEngine.frequencyProposal(plannedDaysPerWeek: planned, recentWeeklySessionCounts: weeks)
    }

    func testProposesReduceWhenSustainedBelowPlan() {
        let p = proposal(planned: 4, weeks: [2, 3, 2, 2])  // 4 周中位数 2 ≤ 4-1
        XCTAssertEqual(p?.kind, .reduceFrequency)
        XCTAssertEqual(p?.reasonCode, "belowPlanSustained")
        XCTAssertEqual(p?.fromDaysPerWeek, 4)
        XCTAssertEqual(p?.toDaysPerWeek, 2, "降到可持续中位数")
    }

    func testNilWhenOnTrack() {
        XCTAssertNil(proposal(planned: 4, weeks: [4, 4, 3, 4]), "中位数 4 > 4-1，未持续落后")
        XCTAssertNil(proposal(planned: 3, weeks: [3, 3, 3, 3]), "完全达标")
    }

    func testNilWhenInsufficientData() {
        XCTAssertNil(proposal(planned: 4, weeks: [1, 1, 1]), "只有 3 周 < 4，数据不足不提")
    }

    func testNilWhenAlreadyAtMinimum() {
        XCTAssertNil(proposal(planned: 2, weeks: [0, 0, 1, 0]), "已是最低频率，不再降")
    }

    func testFloorsAtMinimumDaysPerWeek() {
        let p = proposal(planned: 5, weeks: [0, 1, 0, 1])  // 中位数 0，但不建议低于 2
        XCTAssertEqual(p?.toDaysPerWeek, 2, "目标不低于每周 2 次下限")
    }

    func testMedianOddAndEven() {
        XCTAssertEqual(PlanAdjustmentEngine.median([2, 3, 2, 2]), 2, "偶数取中间两数向下")
        XCTAssertEqual(PlanAdjustmentEngine.median([1, 2, 3]), 2, "奇数取中")
        XCTAssertEqual(PlanAdjustmentEngine.median([]), 0)
    }

    func testDeterministic() {
        XCTAssertEqual(proposal(planned: 4, weeks: [2, 2, 3, 2]), proposal(planned: 4, weeks: [2, 2, 3, 2]))
    }
}
