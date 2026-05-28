// iOS-4B3 — controlled-reload unlock + sessionIntent branch-order tests.
//
// controlled-reload (sessionIntentFor branch 4) fires only when e1rmTrendUp &&
// recoveryHigh (readiness.level == .low). These tests lock the unlock conditions
// and that the higher-priority branches (severe / reentry-phase / deload) still win.

import XCTest
import IronPathDomain
@testable import IronPathTrainingDecision

final class TrainingDecisionControlledReloadTests: XCTestCase {

    /// 5 increasing-weight completed sessions, latest at `latestGap` (e1RM up).
    private func increasingSessions(latestGap: Int = 2) -> [TrainingSession] {
        let weights = [60.0, 62.5, 65.0, 67.5, 70.0]
        let gaps = [latestGap + 12, latestGap + 9, latestGap + 6, latestGap + 3, latestGap]
        return zip(gaps, weights).enumerated().map {
            CoreSliceTestKit.weightedSession(id: "cr\($0.offset)", gap: $0.element.0, topWeight: $0.element.1)
        }
    }

    private func intent(
        sleep: String, energy: String, latestGap: Int = 2,
        severe: Bool = false, deload: Bool = false, staleHealth: Bool = false,
        sessions: [TrainingSession]? = nil
    ) -> TrainingDecisionCoreSlice {
        let input = CoreSliceTestKit.makeCleanInput(
            sessions: sessions ?? increasingSessions(latestGap: latestGap),
            sleep: sleep, energy: energy,
            acutePainReported: severe, explicitDeloadAssigned: deload, staleHealthSample: staleHealth
        )
        return buildTrainingDecisionFromCleanInput(input)
    }

    // 2. e1RM up + recoveryHigh -> controlled-reload.
    func test_e1rmUp_and_recoveryHigh_unlocks_controlledReload() {
        let s = intent(sleep: "差", energy: "低")
        XCTAssertTrue(s.e1rmTrendUp)
        XCTAssertTrue(s.recoveryHigh)
        XCTAssertEqual(s.sessionIntent, .controlledReload)
    }

    // 3. e1RM false (flat weights) -> no unlock.
    func test_e1rmFalse_does_not_unlock() {
        let flat = (0..<5).map { CoreSliceTestKit.weightedSession(id: "f\($0)", gap: 14 - $0 * 3, topWeight: 60) }
        let s = intent(sleep: "差", energy: "低", sessions: flat)
        XCTAssertFalse(s.e1rmTrendUp)
        XCTAssertTrue(s.recoveryHigh)
        XCTAssertEqual(s.sessionIntent, .normalSession)
    }

    // 4. recoveryHigh false (good readiness) -> no unlock.
    func test_recoveryHighFalse_does_not_unlock() {
        let s = intent(sleep: "好", energy: "高")
        XCTAssertTrue(s.e1rmTrendUp)
        XCTAssertFalse(s.recoveryHigh) // high readiness
        XCTAssertEqual(s.sessionIntent, .normalSession)
        // medium readiness also does not unlock.
        XCTAssertEqual(intent(sleep: "一般", energy: "中").sessionIntent, .normalSession)
    }

    // 5. severeFlag overrides controlled-reload (branch 1 > branch 4).
    func test_severeFlag_overrides_controlledReload() {
        let s = intent(sleep: "差", energy: "低", severe: true)
        XCTAssertEqual(s.sessionIntent, .severeRest)
        XCTAssertEqual(s.riskLevel, .severe)
    }

    // 6. explicitDeload overrides controlled-reload (branch 3 > branch 4), but not severe.
    func test_deload_overrides_controlledReload_but_not_severe() {
        XCTAssertEqual(intent(sleep: "差", energy: "低", deload: true).sessionIntent, .deloadWeek)
        XCTAssertEqual(intent(sleep: "差", energy: "低", severe: true, deload: true).sessionIntent, .severeRest)
    }

    // 7. reentry phase (gap >= 14) overrides controlled-reload (branch 2 > branch 4).
    func test_reentry_phase_overrides_controlledReload() {
        let s = intent(sleep: "差", energy: "低", latestGap: 20)
        XCTAssertEqual(s.effectivePhase.activePhase, .reentry)
        XCTAssertEqual(s.sessionIntent, .reentryProductive)
    }

    // 8. stale health data does not block controlled-reload (subjective readiness stays low).
    func test_staleHealth_still_controlledReload() {
        let s = intent(sleep: "差", energy: "低", staleHealth: true)
        XCTAssertEqual(s.useHealthDataForReadiness, false, "stale sample resolves the gate to false")
        XCTAssertEqual(s.sessionIntent, .controlledReload)
    }

    // 9. Legacy advice on history exercises does not influence readiness / intent.
    func test_legacyAdvice_does_not_affect_intent() {
        let weights = [60.0, 62.5, 65.0, 67.5, 70.0]
        let gaps = [14, 11, 8, 5, 2]
        let sessions = zip(gaps, weights).enumerated().map { entry -> TrainingSession in
            let ex = ExercisePrescription(
                id: "la\(entry.offset)", exerciseId: "bench", name: "Bench",
                sets: [TrainingSetLog(weight: .double(entry.element.1))],
                suggestion: "历史建议（legacy）", adjustment: "历史调整（legacy）", warning: "历史警告（legacy）"
            )
            return TrainingSession(id: "la\(entry.offset)", date: CoreSliceTestKit.dateOnly(daysBefore: entry.element.0), completed: true, exercises: [ex])
        }
        let s = intent(sleep: "差", energy: "低", sessions: sessions)
        XCTAssertEqual(s.sessionIntent, .controlledReload, "legacy advice text must not change readiness/e1RM")
    }
}
