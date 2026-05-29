// iOS-4B5 — productive-floor / deload / restart prescription discriminators, driven
// through the full engine via the push-a clean inputs (CoreSliceTestKit).

import XCTest
import IronPathDomain
@testable import IronPathTrainingDecision

final class TrainingDecisionProductiveFloorTests: XCTestCase {

    private func twoSessions(_ a: Int, _ b: Int) -> [TrainingSession] {
        [CoreSliceTestKit.session(id: "s-late", gap: a), CoreSliceTestKit.session(id: "s-early", gap: b)]
    }

    // reentry (gap 20) -> productive floor: compounds held at 2.
    func test_productiveFloor_reentry_exact() {
        let s = buildTrainingDecisionFromCleanInput(CoreSliceTestKit.makeCleanInput(sessions: twoSessions(20, 34)))
        XCTAssertEqual(s.sessionIntent, .reentryProductive)
        XCTAssertEqual(s.allTargetSets, [2, 2, 1, 1, 2, 1])
        XCTAssertEqual(s.exerciseRoleFloors[.secondaryCompound], 2)
    }

    // restart (gap 30) -> restart floor; differs from reentry (lateral 2 -> 1 at 0.5 mult).
    func test_restart_exact_and_differs_from_reentry() {
        let restart = buildTrainingDecisionFromCleanInput(CoreSliceTestKit.makeCleanInput(sessions: twoSessions(30, 44)))
        XCTAssertEqual(restart.sessionIntent, .reentryProductive)
        XCTAssertEqual(restart.activePhase, .restart)
        XCTAssertEqual(restart.allTargetSets, [2, 2, 1, 1, 1, 1])
        let reentry = buildTrainingDecisionFromCleanInput(CoreSliceTestKit.makeCleanInput(sessions: twoSessions(20, 34)))
        XCTAssertNotEqual(restart.allTargetSets, reentry.allTargetSets) // restart 0.5 vs reentry 0.65
    }

    // deliberate deload-week (explicitDeloadAssigned, base phase) -> NORMAL floors,
    // prescription differs from reentry/restart (no productive floor lift).
    func test_deloadWeek_prescription_differs_from_reentry_restart() {
        let deload = buildTrainingDecisionFromCleanInput(
            CoreSliceTestKit.makeCleanInput(sessions: twoSessions(2, 5), explicitDeloadAssigned: true)
        )
        XCTAssertEqual(deload.sessionIntent, .deloadWeek)
        XCTAssertEqual(deload.allTargetSets, [2, 2, 1, 1, 3, 2]) // base-shaped, NOT reentry-floored
        XCTAssertEqual(deload.exerciseRoleFloors[.secondaryCompound], 1) // NORMAL floors
        let restart = buildTrainingDecisionFromCleanInput(CoreSliceTestKit.makeCleanInput(sessions: twoSessions(30, 44)))
        XCTAssertNotEqual(deload.allTargetSets, restart.allTargetSets)
    }

    // controlled-reload remains controlled-reload AND its prescription matches golden.
    func test_controlledReload_prescription() {
        let sessions = [60.0, 62.5, 65.0, 67.5, 70.0].enumerated().map { i, w in
            CoreSliceTestKit.weightedSession(id: "cr\(i)", gap: 14 - i * 3, topWeight: w)
        }
        let s = buildTrainingDecisionFromCleanInput(
            CoreSliceTestKit.makeCleanInput(sessions: sessions, sleep: "差", energy: "低")
        )
        XCTAssertEqual(s.sessionIntent, .controlledReload)
        XCTAssertEqual(s.allTargetSets, [1, 1, 1, 1, 2, 1]) // 差/低 crushes most to 1
    }

    // severe-rest all-1 is legitimate; base/normal never all-1 (no regression).
    func test_severe_all_one_but_base_not() {
        let severe = buildTrainingDecisionFromCleanInput(
            CoreSliceTestKit.makeCleanInput(sessions: twoSessions(2, 5), acutePainReported: true)
        )
        XCTAssertEqual(severe.allTargetSets, [1, 1, 1, 1, 1, 1])
        let base = buildTrainingDecisionFromCleanInput(CoreSliceTestKit.makeCleanInput(sessions: twoSessions(2, 5)))
        XCTAssertEqual(base.allTargetSets, [2, 2, 1, 1, 3, 2])
        XCTAssertNotEqual(severe.allTargetSets, base.allTargetSets)
    }
}
