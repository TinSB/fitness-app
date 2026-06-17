// FR-T5 教练动作生成合同：优先级（修数据>换动作>补量）+ 补量守门（rest/deload/新用户/已达标不出）。

import XCTest
@testable import RedeTrainingDecision

final class CoachActionEngineTests: XCTestCase {
    private func make(
        call: TodayCall = .train, sessionsLast7: Int = 1, plannedDaysPerWeek: Int = 4,
        totalSessionCount: Int = 5, stalled: [String] = [], findings: Int = 0,
        weekStartISO: String = "2026-06-15", dismissals: [String: Int] = [:], adopted: Bool = false
    ) -> CoachActionInput {
        CoachActionInput(
            call: call, sessionsLast7: sessionsLast7, plannedDaysPerWeek: plannedDaysPerWeek,
            totalSessionCount: totalSessionCount, stalledExerciseIds: stalled, dataFindingCount: findings,
            weekStartISO: weekStartISO, dismissals: dismissals, volumeBoostAdoptedThisWeek: adopted
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

    // MARK: 降频（切片6a，温和政策）+ actionKey

    func testActionKeysAreStable() {
        let actions = CoachActionEngine.actions(input: make(
            sessionsLast7: 1, plannedDaysPerWeek: 4, stalled: ["pull-up"], findings: 1, weekStartISO: "2026-06-15"
        ))
        XCTAssertEqual(actions.first { $0.kind == .dataReview }?.actionKey, "dataReview")
        XCTAssertEqual(actions.first { $0.kind == .exerciseSwap }?.actionKey, "exerciseSwap:pull-up")
        XCTAssertEqual(actions.first { $0.kind == .volumeBoost }?.actionKey, "volumeBoost:2026-06-15")
    }

    func testSwapSuppressedAfterTwoDismissals() {
        let once = CoachActionEngine.actions(input: make(stalled: ["pull-up"], dismissals: ["exerciseSwap:pull-up": 1]))
        XCTAssertTrue(once.contains { $0.kind == .exerciseSwap }, "1 次暂不处理仍出")
        let twice = CoachActionEngine.actions(input: make(stalled: ["pull-up"], dismissals: ["exerciseSwap:pull-up": 2]))
        XCTAssertFalse(twice.contains { $0.kind == .exerciseSwap }, "连续 2 次暂不处理后不再出")
    }

    func testDataReviewSuppressedAfterTwoDismissals() {
        let once = CoachActionEngine.actions(input: make(findings: 3, dismissals: ["dataReview": 1]))
        XCTAssertTrue(once.contains { $0.kind == .dataReview })
        let twice = CoachActionEngine.actions(input: make(findings: 3, dismissals: ["dataReview": 2]))
        XCTAssertFalse(twice.contains { $0.kind == .dataReview }, "连续 2 次后不再出")
    }

    func testVolumeBoostSuppressedWhenAdoptedOrDismissedThisWeek() {
        let adopted = CoachActionEngine.actions(input: make(sessionsLast7: 1, plannedDaysPerWeek: 4, adopted: true))
        XCTAssertFalse(adopted.contains { $0.kind == .volumeBoost }, "本周已采纳 → 不再出")
        let dismissed = CoachActionEngine.actions(input: make(
            sessionsLast7: 1, plannedDaysPerWeek: 4, weekStartISO: "2026-06-15",
            dismissals: ["volumeBoost:2026-06-15": 1]
        ))
        XCTAssertFalse(dismissed.contains { $0.kind == .volumeBoost }, "本周已暂不处理（≥1）→ 本周不再出")
    }
}
