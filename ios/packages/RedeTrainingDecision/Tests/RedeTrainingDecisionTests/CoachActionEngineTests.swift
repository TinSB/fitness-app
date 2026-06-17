// FR-T5 教练动作生成合同：优先级（修数据>换动作>补量）+ 补量守门（rest/deload/新用户/已达标不出）。

import XCTest
@testable import RedeTrainingDecision

final class CoachActionEngineTests: XCTestCase {
    private func make(
        call: TodayCall = .train, sessionsLast7: Int = 1, plannedDaysPerWeek: Int = 4,
        totalSessionCount: Int = 5, stalled: [String] = [], findings: Int = 0
    ) -> CoachActionInput {
        CoachActionInput(
            call: call, sessionsLast7: sessionsLast7, plannedDaysPerWeek: plannedDaysPerWeek,
            totalSessionCount: totalSessionCount, stalledExerciseIds: stalled, dataFindingCount: findings
        )
    }

    func testDataReviewFiresOnFindingsWithCount() {
        let actions = CoachActionEngine.actions(input: make(findings: 3))
        XCTAssertTrue(actions.contains { $0.kind == .dataReview && $0.reasonCode == "dataHasFindings" && $0.count == 3 })
    }

    func testExerciseSwapPerStalledInOrder() {
        let actions = CoachActionEngine.actions(input: make(stalled: ["pull-up", "dip"]))
        let swaps = actions.filter { $0.kind == .exerciseSwap }
        XCTAssertEqual(swaps.map(\.exerciseId), ["pull-up", "dip"], "按出现序、逐个到顶动作")
        XCTAssertTrue(swaps.allSatisfy { $0.reasonCode == "ceilingReached" })
    }

    func testVolumeBoostFiresWhenBehindAndActive() throws {
        let actions = CoachActionEngine.actions(input: make(call: .train, sessionsLast7: 1, plannedDaysPerWeek: 4))
        let boost = try XCTUnwrap(actions.first { $0.kind == .volumeBoost })
        XCTAssertEqual(boost.reasonCode, "belowWeeklyPlan")
        XCTAssertEqual(boost.count, 3, "本周还差 4-1=3 次")
    }

    func testVolumeBoostNotOnRestOrDeload() {
        for call in [TodayCall.rest, .deload] {
            let actions = CoachActionEngine.actions(input: make(call: call, sessionsLast7: 0, plannedDaysPerWeek: 5))
            XCTAssertFalse(actions.contains { $0.kind == .volumeBoost }, "\(call) 态绝不催补量")
        }
    }

    func testVolumeBoostNotForBrandNewUser() {
        let actions = CoachActionEngine.actions(input: make(sessionsLast7: 0, plannedDaysPerWeek: 4, totalSessionCount: 0))
        XCTAssertFalse(actions.contains { $0.kind == .volumeBoost }, "全新用户（无历史）不催补量")
    }

    func testVolumeBoostNotWhenWeeklyPlanMet() {
        let actions = CoachActionEngine.actions(input: make(sessionsLast7: 4, plannedDaysPerWeek: 4))
        XCTAssertFalse(actions.contains { $0.kind == .volumeBoost }, "已达标不催")
        let over = CoachActionEngine.actions(input: make(sessionsLast7: 5, plannedDaysPerWeek: 4))
        XCTAssertFalse(over.contains { $0.kind == .volumeBoost }, "超额也不催")
    }

    func testPriorityOrderDataThenSwapThenBoost() {
        let actions = CoachActionEngine.actions(input: make(
            call: .train, sessionsLast7: 1, plannedDaysPerWeek: 4, stalled: ["pull-up"], findings: 2
        ))
        XCTAssertEqual(actions.map(\.kind), [.dataReview, .exerciseSwap, .volumeBoost], "修数据>换动作>补量")
    }

    // 防御非法负输入（审查 M-2）：负 last7 不催补量、不产虚高 count。
    func testNegativeSessionsLast7DoesNotFireVolumeBoost() {
        let actions = CoachActionEngine.actions(input: make(call: .train, sessionsLast7: -1, plannedDaysPerWeek: 4))
        XCTAssertFalse(actions.contains { $0.kind == .volumeBoost }, "负 last7 被守门挡下，不产虚高 count")
    }

    func testNoSignalsYieldsEmpty() {
        let actions = CoachActionEngine.actions(input: make(sessionsLast7: 4, plannedDaysPerWeek: 4, stalled: [], findings: 0))
        XCTAssertTrue(actions.isEmpty, "无信号 → 无卡")
    }
}
