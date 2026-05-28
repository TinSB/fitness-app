// iOS-4B2 — field-subset parity for the TrainingDecision core slice.
//
// COMPUTE-NOT-DECODE: each test builds a synthetic engine INPUT (history at the
// fixture's known gap + flags) IN MEMORY, runs the real Swift engine, and asserts
// the COMPUTED {effectivePhase 6 fields, top-level activePhase, sessionIntent}
// EQUAL the golden's recorded values. The expected side is the literal golden;
// the actual side is the engine output reconstructed from raw session dates —
// never a field re-read off the decoded golden. Deleting the deriveDecision body
// makes restart-28d-gap-v1 and productive-floor-v1 fail (proof of compute).
//
// FIELD-SUBSET only: modes / riskLevel / finalVolumeMultiplier / perExercise /
// weeklyAdjustment / userFacing / full arbitrationTrace are NOT asserted (iOS-4B3+).
// controlled-reload-v1.sessionIntent is the one documented deferral.

import XCTest
import IronPathDomain
import IronPathDataHealth
@testable import IronPathTrainingDecision

final class TrainingDecisionCoreSliceParityTests: XCTestCase {

    /// Per-fixture engine INPUT spec (gap days + severe flag + explicit deload),
    /// declared independently of the golden so the comparison is real parity.
    private struct FixtureInput {
        let gap: Int
        let severe: Bool
        let explicitDeload: Bool
    }

    private static let inputs: [String: FixtureInput] = [
        "severe-rest-v1":          FixtureInput(gap: 2, severe: true, explicitDeload: false),
        "controlled-reload-v1":    FixtureInput(gap: 2, severe: false, explicitDeload: false),
        "deload-week-v1":          FixtureInput(gap: 2, severe: false, explicitDeload: true),
        "stale-today-status-v1":   FixtureInput(gap: 2, severe: false, explicitDeload: false),
        "stale-health-data-v1":    FixtureInput(gap: 2, severe: false, explicitDeload: false),
        "restart-28d-gap-v1":      FixtureInput(gap: 30, severe: false, explicitDeload: false),
        "productive-floor-v1":     FixtureInput(gap: 20, severe: false, explicitDeload: false),
        "no-legacy-advice-v1":     FixtureInput(gap: 2, severe: false, explicitDeload: false),
        "clean-input-contract-v1": FixtureInput(gap: 2, severe: false, explicitDeload: false),
    ]

    /// The fixture whose golden sessionIntent ('controlled-reload') is NOT matched
    /// in iOS-4B2 — it needs e1rmTrendUp && recoveryHigh (readiness + e1RM, iOS-4B3).
    private static let controlledReloadDeferredId = "controlled-reload-v1"

    private func slice(for id: String) -> TrainingDecisionCoreSlice {
        let spec = Self.inputs[id]!
        let input = CoreSliceTestKit.makeCleanInput(
            gap: spec.gap,
            acutePainReported: spec.severe,
            explicitDeloadAssigned: spec.explicitDeload
        )
        return buildTrainingDecisionFromCleanInput(input)
    }

    // MARK: - 1. effectivePhase field-subset parity (all 9 expanded goldens)

    func test_effectivePhase_fieldSubset_matches_goldens_on_9_expanded_fixtures() throws {
        XCTAssertEqual(TrainingDecisionGoldens.expandedIds.count, 9)
        for id in TrainingDecisionGoldens.expandedIds {
            let golden = try TrainingDecisionGoldens.decode(id)
            let ep = try XCTUnwrap(golden.effectivePhase, "\(id): expanded golden must carry effectivePhase")
            let computed = slice(for: id)

            XCTAssertEqual(computed.effectivePhase.activePhase.rawValue, ep.activePhase, "\(id) effectivePhase.activePhase")
            XCTAssertEqual(computed.effectivePhase.gapDays, ep.gapDays, "\(id) effectivePhase.gapDays")
            XCTAssertEqual(computed.effectivePhase.mode.rawValue, ep.mode, "\(id) effectivePhase.mode")
            XCTAssertEqual(computed.effectivePhase.severity.rawValue, ep.severity, "\(id) effectivePhase.severity")
            XCTAssertEqual(computed.effectivePhase.overridden, ep.overridden, "\(id) effectivePhase.overridden")
            XCTAssertEqual(computed.effectivePhase.hasHistory, ep.hasHistory, "\(id) effectivePhase.hasHistory")
            XCTAssertEqual(computed.activePhase.rawValue, golden.activePhase, "\(id) top-level activePhase")
        }
    }

    // MARK: - 2. sessionIntent parity (8 of 9; controlled-reload deferred)

    func test_sessionIntent_matches_goldens_except_controlledReload_deferred() throws {
        for id in TrainingDecisionGoldens.expandedIds where id != Self.controlledReloadDeferredId {
            let golden = try TrainingDecisionGoldens.decode(id)
            let computed = slice(for: id)
            XCTAssertEqual(computed.sessionIntent.rawValue, golden.sessionIntent, "\(id) sessionIntent")
        }

        // controlled-reload-v1: the golden says 'controlled-reload' but 4B2
        // (e1rmTrendUp=false, recoveryHigh=false) computes 'normal-session'. This
        // divergence is the DOCUMENTED readiness deferral, not a regression — when
        // iOS-4B3 wires readiness this assertion flips and must be revisited.
        let golden = try TrainingDecisionGoldens.decode(Self.controlledReloadDeferredId)
        let computed = slice(for: Self.controlledReloadDeferredId)
        XCTAssertEqual(golden.sessionIntent, "controlled-reload", "golden baseline unchanged")
        XCTAssertEqual(computed.sessionIntent, .normalSession, "4B2 deferral: controlled-reload computes normal-session")
        XCTAssertNotEqual(computed.sessionIntent.rawValue, golden.sessionIntent, "deferral is an intentional divergence")
    }

    // MARK: - 3. Anti-stub: discriminators force distinct branches

    func test_antiStub_phase_discriminators_differ_from_base() throws {
        let restart = slice(for: "restart-28d-gap-v1").effectivePhase
        let reentry = slice(for: "productive-floor-v1").effectivePhase
        let base = slice(for: "stale-today-status-v1").effectivePhase

        // A do-nothing base/continue/none stub would make these equal — they must not be.
        XCTAssertNotEqual(restart, base, "restart-28d must differ from a base fixture")
        XCTAssertNotEqual(reentry, base, "productive-floor must differ from a base fixture")
        XCTAssertNotEqual(restart, reentry, "restart and reentry must differ")

        XCTAssertEqual(restart.activePhase, .restart)
        XCTAssertEqual(reentry.activePhase, .reentry)
        XCTAssertEqual(base.activePhase, .base)
    }

    func test_antiStub_sessionIntent_discriminators_force_distinct_branches() throws {
        XCTAssertEqual(slice(for: "severe-rest-v1").sessionIntent, .severeRest)        // branch 1
        XCTAssertEqual(slice(for: "restart-28d-gap-v1").sessionIntent, .reentryProductive) // branch 2
        XCTAssertEqual(slice(for: "deload-week-v1").sessionIntent, .deloadWeek)         // branch 3
        XCTAssertEqual(slice(for: "stale-today-status-v1").sessionIntent, .normalSession) // branch 5
    }

    // MARK: - 4. Compute-not-decode: engine derives phase from raw history, no golden

    func test_computeNotDecode_engine_derives_phase_from_history() {
        // Built purely from synthetic gap inputs — NO golden is read here.
        XCTAssertEqual(buildTrainingDecisionFromCleanInput(CoreSliceTestKit.makeCleanInput(gap: 30)).effectivePhase.activePhase, .restart)
        XCTAssertEqual(buildTrainingDecisionFromCleanInput(CoreSliceTestKit.makeCleanInput(gap: 20)).effectivePhase.activePhase, .reentry)
        XCTAssertEqual(buildTrainingDecisionFromCleanInput(CoreSliceTestKit.makeCleanInput(gap: 2)).effectivePhase.activePhase, .base)
        XCTAssertEqual(buildTrainingDecisionFromCleanInput(CoreSliceTestKit.makeCleanInput(gap: 30)).effectivePhase.gapDays, 30)
    }

    // MARK: - 5. Deterministic-clock drift canary

    func test_goldens_pinned_to_expected_deterministic_clock() throws {
        for id in TrainingDecisionGoldens.expandedIds {
            let golden = try TrainingDecisionGoldens.decode(id)
            XCTAssertEqual(
                golden.parityGolden?.deterministicClockIso,
                CoreSliceTestKit.deterministicClockIso,
                "\(id): parity clock drifted — the core-slice gap math is pinned to this value"
            )
        }
    }
}
