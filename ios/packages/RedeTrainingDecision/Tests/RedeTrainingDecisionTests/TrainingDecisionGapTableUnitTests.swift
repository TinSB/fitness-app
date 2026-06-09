// iOS-4B2 — deriveDecision gap-table unit tests (NO goldens).
//
// The 9 expanded goldens exercise only 3 of deriveDecision's gap branches
// (0-3 base, 14-27 reentry, 28+ restart). These synthetic unit tests lock the
// UNCOVERED branches (4-7 mild, 8-13 with and without overload/deload persisted,
// no-history) plus the exact boundary days, the analytics-session filter, and
// future-date clamping — so a porting bug in an untested branch cannot slip
// through golden parity. Drives the internal engine directly via @testable.

import XCTest
import RedeDomain
@testable import RedeTrainingDecision

final class TrainingDecisionGapTableUnitTests: XCTestCase {

    private func phase(
        gap: Int,
        plan: MesocyclePlan? = nil
    ) -> EffectiveTrainingPhase {
        EffectiveTrainingPhaseEngine.getEffectiveTrainingPhase(
            mesocyclePlan: plan,
            history: [CoreSliceTestKit.session(id: "g", gap: gap)],
            referenceDate: CoreSliceTestKit.referenceDateOnly
        )
    }

    // MARK: - Gap boundaries (no plan → persisted 'base')

    func test_gap_0to3_continue_none() {
        for gap in [0, 1, 3] {
            let p = phase(gap: gap)
            XCTAssertEqual(p.activePhase, .base, "gap \(gap)")
            XCTAssertEqual(p.mode, .cont, "gap \(gap)")
            XCTAssertEqual(p.severity, .none, "gap \(gap)")
            XCTAssertFalse(p.overridden, "gap \(gap)")
            XCTAssertTrue(p.hasHistory, "gap \(gap)")
            XCTAssertEqual(p.gapDays, gap, "gap \(gap)")
        }
    }

    func test_gap_4to7_continue_mild() {
        for gap in [4, 7] {
            let p = phase(gap: gap)
            XCTAssertEqual(p.activePhase, .base, "gap \(gap)")
            XCTAssertEqual(p.mode, .cont, "gap \(gap)")
            XCTAssertEqual(p.severity, .mild, "gap \(gap)")
            XCTAssertFalse(p.overridden, "gap \(gap)")
        }
    }

    func test_gap_8to13_base_persisted_continue_but_reentry_severity() {
        // The subtle branch: mode stays .cont but severity becomes .reentry when
        // persisted phase is NOT overload/deload.
        for gap in [8, 13] {
            let p = phase(gap: gap)
            XCTAssertEqual(p.activePhase, .base, "gap \(gap)")
            XCTAssertEqual(p.mode, .cont, "gap \(gap)")
            XCTAssertEqual(p.severity, .reentry, "gap \(gap)")
            XCTAssertFalse(p.overridden, "gap \(gap)")
        }
    }

    func test_gap_14to27_reentry_overridden() {
        for gap in [14, 27] {
            let p = phase(gap: gap)
            XCTAssertEqual(p.activePhase, .reentry, "gap \(gap)")
            XCTAssertEqual(p.mode, .reentry, "gap \(gap)")
            XCTAssertEqual(p.severity, .reentry, "gap \(gap)")
            XCTAssertTrue(p.overridden, "gap \(gap)")
        }
    }

    func test_gap_28plus_restart_overridden() {
        for gap in [28, 45] {
            let p = phase(gap: gap)
            XCTAssertEqual(p.activePhase, .restart, "gap \(gap)")
            XCTAssertEqual(p.mode, .restart, "gap \(gap)")
            XCTAssertEqual(p.severity, .restart, "gap \(gap)")
            XCTAssertTrue(p.overridden, "gap \(gap)")
        }
    }

    // MARK: - 8-13d on overload/deload persisted → reentry (the .75 path)

    func test_gap_8to13_overload_persisted_forces_reentry() {
        // Plan startDate 14 days before ref → weekIndex 2 → persisted 'overload'.
        let plan = MesocyclePlan(
            id: "m-overload",
            startDate: CoreSliceTestKit.dateOnly(daysBefore: 14),
            phase: nil,
            weeks: CoreSliceTestKit.standardWeeksJSON()
        )
        let p = phase(gap: 10, plan: plan)
        XCTAssertEqual(p.persistedPhase, .overload, "weekIndex 2 should resolve overload")
        XCTAssertEqual(p.activePhase, .reentry, "8-13d on overload persisted → reentry")
        XCTAssertEqual(p.mode, .reentry)
        XCTAssertEqual(p.severity, .reentry)
        XCTAssertTrue(p.overridden)
    }

    // MARK: - Non-base persisted phase passes through on a short gap

    func test_nonBase_persisted_overload_short_gap_passes_through() {
        let plan = MesocyclePlan(
            id: "m-overload",
            startDate: CoreSliceTestKit.dateOnly(daysBefore: 14),
            phase: nil,
            weeks: CoreSliceTestKit.standardWeeksJSON()
        )
        let p = phase(gap: 2, plan: plan)
        XCTAssertEqual(p.persistedPhase, .overload)
        XCTAssertEqual(p.activePhase, .overload, "short gap keeps persisted phase")
        XCTAssertEqual(p.mode, .cont)
        XCTAssertEqual(p.severity, .none)
        XCTAssertFalse(p.overridden)
    }

    // MARK: - No history → safe default

    func test_no_history_safe_default() {
        let p = EffectiveTrainingPhaseEngine.getEffectiveTrainingPhase(
            mesocyclePlan: nil,
            history: [],
            referenceDate: CoreSliceTestKit.referenceDateOnly
        )
        XCTAssertFalse(p.hasHistory)
        XCTAssertEqual(p.gapDays, 0)
        XCTAssertEqual(p.activePhase, .base)
        XCTAssertEqual(p.mode, .cont)
        XCTAssertEqual(p.severity, .none)
        XCTAssertFalse(p.overridden)
    }

    // MARK: - isAnalyticsSession filter (completed / dataFlag) affects the gap

    func test_trailing_incomplete_session_is_ignored() {
        // Latest by date is completed:false at gap 1 → ignored; gap 30 wins → restart.
        let history = [
            CoreSliceTestKit.session(id: "done", gap: 30, completed: true),
            CoreSliceTestKit.session(id: "abandoned", gap: 1, completed: false),
        ]
        let p = EffectiveTrainingPhaseEngine.getEffectiveTrainingPhase(
            mesocyclePlan: nil, history: history, referenceDate: CoreSliceTestKit.referenceDateOnly
        )
        XCTAssertEqual(p.gapDays, 30)
        XCTAssertEqual(p.activePhase, .restart)
    }

    func test_dataFlag_excluded_session_is_ignored() {
        let history = [
            CoreSliceTestKit.session(id: "real", gap: 30, completed: true),
            CoreSliceTestKit.session(id: "excluded", gap: 1, completed: true, dataFlag: "excluded"),
        ]
        let p = EffectiveTrainingPhaseEngine.getEffectiveTrainingPhase(
            mesocyclePlan: nil, history: history, referenceDate: CoreSliceTestKit.referenceDateOnly
        )
        XCTAssertEqual(p.gapDays, 30)
        XCTAssertEqual(p.activePhase, .restart)
    }

    // MARK: - Future-dated session clamps to gap 0

    func test_future_session_clamps_to_zero() {
        let history = [CoreSliceTestKit.session(id: "future", gap: -5)] // 5 days AFTER ref
        let p = EffectiveTrainingPhaseEngine.getEffectiveTrainingPhase(
            mesocyclePlan: nil, history: history, referenceDate: CoreSliceTestKit.referenceDateOnly
        )
        XCTAssertTrue(p.hasHistory)
        XCTAssertEqual(p.gapDays, 0, "negative diff clamps to 0")
        XCTAssertEqual(p.activePhase, .base)
    }

    // MARK: - sessionIntent branch ORDER (severeFlag beats phase)

    func test_sessionIntent_severeFlag_beats_reentry_phase() {
        // Even with a restart-inducing gap, severeFlag wins (branch 1 > branch 2).
        let restartPhase = phase(gap: 40)
        XCTAssertEqual(restartPhase.activePhase, .restart)
        let intent = sessionIntentFor(
            effectivePhase: restartPhase,
            severeFlag: true,
            explicitDeload: true,
            e1rmTrendUp: false,
            recoveryHigh: false
        )
        XCTAssertEqual(intent, .severeRest)
    }

    func test_sessionIntent_controlledReload_unreachable_when_readiness_false() {
        // With e1rmTrendUp/recoveryHigh false (the 4B2 deferral), branch 4 never
        // fires even when nothing else matches → normal-session.
        let base = phase(gap: 2)
        let intent = sessionIntentFor(
            effectivePhase: base,
            severeFlag: false,
            explicitDeload: false,
            e1rmTrendUp: false,
            recoveryHigh: false
        )
        XCTAssertEqual(intent, .normalSession)
        // Sanity: if readiness WERE wired true, branch 4 would fire (proves the
        // branch exists and is gated only by the deferred inputs).
        XCTAssertEqual(
            sessionIntentFor(effectivePhase: base, severeFlag: false, explicitDeload: false, e1rmTrendUp: true, recoveryHigh: true),
            .controlledReload
        )
    }
}
