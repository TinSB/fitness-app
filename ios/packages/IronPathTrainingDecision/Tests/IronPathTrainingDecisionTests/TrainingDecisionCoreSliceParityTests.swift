// iOS-4B2/4B3 — field-subset parity for the TrainingDecision core slice.
//
// COMPUTE-NOT-DECODE: each test builds a synthetic engine INPUT (history + today
// status + flags mirroring the fixture) IN MEMORY, runs the real Swift engine, and
// asserts the COMPUTED {effectivePhase 6 fields, top-level activePhase,
// sessionIntent, riskLevel} EQUAL the golden's recorded values. The expected side
// is the literal golden; the actual side is the engine output reconstructed from
// raw inputs — never re-read off the decoded golden. Deleting deriveDecision makes
// restart-28d-gap-v1 / productive-floor-v1 fail; deleting the readiness/e1RM port
// makes controlled-reload-v1 fail (proof of compute).
//
// iOS-4B3 unlocks controlled-reload-v1.sessionIntent (readiness low + e1RM up) and
// adds riskLevel parity. Still NOT asserted (iOS-4B4+): volume/intensity/progression
// modes, finalVolumeMultiplier, perExercise, weeklyAdjustment, userFacing, full
// arbitrationTrace.

import XCTest
import IronPathDomain
import IronPathDataHealth
@testable import IronPathTrainingDecision

final class TrainingDecisionCoreSliceParityTests: XCTestCase {

    /// Per-fixture engine INPUT, declared independently of the golden so the
    /// comparison is real parity. Sessions mirror each fixture's synthetic spec.
    private struct FixtureInput {
        let sessions: [TrainingSession]
        var sleep: String = "一般"
        var energy: String = "中"
        var severe: Bool = false
        var explicitDeload: Bool = false
        var staleHealth: Bool = false
        var todayDaysAgo: Int = 0
    }

    private static func twoSessions(_ a: Int, _ b: Int) -> [TrainingSession] {
        [CoreSliceTestKit.session(id: "s-late", gap: a), CoreSliceTestKit.session(id: "s-early", gap: b)]
    }

    private static var inputs: [String: FixtureInput] {
        [
            "severe-rest-v1": FixtureInput(sessions: twoSessions(2, 5), severe: true),
            // controlled-reload: 5 increasing-weight sessions (e1RM up) + 差/低 (readiness low).
            "controlled-reload-v1": FixtureInput(
                sessions: [
                    CoreSliceTestKit.weightedSession(id: "cr1", gap: 14, topWeight: 60),
                    CoreSliceTestKit.weightedSession(id: "cr2", gap: 11, topWeight: 62.5),
                    CoreSliceTestKit.weightedSession(id: "cr3", gap: 8, topWeight: 65),
                    CoreSliceTestKit.weightedSession(id: "cr4", gap: 5, topWeight: 67.5),
                    CoreSliceTestKit.weightedSession(id: "cr5", gap: 2, topWeight: 70),
                ],
                sleep: "差", energy: "低"
            ),
            "deload-week-v1": FixtureInput(sessions: twoSessions(2, 5), explicitDeload: true),
            "stale-today-status-v1": FixtureInput(sessions: twoSessions(2, 5), todayDaysAgo: 6),
            "stale-health-data-v1": FixtureInput(sessions: twoSessions(2, 5), staleHealth: true),
            "restart-28d-gap-v1": FixtureInput(sessions: twoSessions(30, 44)),
            "productive-floor-v1": FixtureInput(sessions: twoSessions(20, 34)),
            "no-legacy-advice-v1": FixtureInput(sessions: twoSessions(2, 5)),
            "clean-input-contract-v1": FixtureInput(sessions: twoSessions(2, 5)),
        ]
    }

    private func slice(for id: String) -> TrainingDecisionCoreSlice {
        let spec = Self.inputs[id]!
        let input = CoreSliceTestKit.makeCleanInput(
            sessions: spec.sessions,
            sleep: spec.sleep,
            energy: spec.energy,
            todayStatusDaysAgo: spec.todayDaysAgo,
            acutePainReported: spec.severe,
            explicitDeloadAssigned: spec.explicitDeload,
            staleHealthSample: spec.staleHealth
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

    // MARK: - 2. sessionIntent parity (ALL 9 — controlled-reload now unlocked)

    func test_sessionIntent_matches_goldens_on_all_9_expanded_fixtures() throws {
        for id in TrainingDecisionGoldens.expandedIds {
            let golden = try TrainingDecisionGoldens.decode(id)
            let computed = slice(for: id)
            XCTAssertEqual(computed.sessionIntent.rawValue, golden.sessionIntent, "\(id) sessionIntent")
        }
    }

    // MARK: - 3. riskLevel parity (NEW in iOS-4B3 — readiness unlocks it)

    func test_riskLevel_matches_goldens_on_all_9_expanded_fixtures() throws {
        for id in TrainingDecisionGoldens.expandedIds {
            let golden = try TrainingDecisionGoldens.decode(id)
            guard let goldenRisk = golden.riskLevel else { continue }
            let computed = slice(for: id)
            XCTAssertEqual(computed.riskLevel.rawValue, goldenRisk, "\(id) riskLevel")
        }
        // Spot the three distinct risk outcomes the goldens encode.
        XCTAssertEqual(slice(for: "severe-rest-v1").riskLevel, .severe)
        XCTAssertEqual(slice(for: "controlled-reload-v1").riskLevel, .moderate)
        XCTAssertEqual(slice(for: "stale-today-status-v1").riskLevel, .none)
    }

    // MARK: - 4. Anti-stub: discriminators force distinct branches

    func test_antiStub_phase_discriminators_differ_from_base() throws {
        let restart = slice(for: "restart-28d-gap-v1").effectivePhase
        let reentry = slice(for: "productive-floor-v1").effectivePhase
        let base = slice(for: "stale-today-status-v1").effectivePhase
        XCTAssertNotEqual(restart, base, "restart-28d must differ from a base fixture")
        XCTAssertNotEqual(reentry, base, "productive-floor must differ from a base fixture")
        XCTAssertNotEqual(restart, reentry, "restart and reentry must differ")
        XCTAssertEqual(restart.activePhase, .restart)
        XCTAssertEqual(reentry.activePhase, .reentry)
        XCTAssertEqual(base.activePhase, .base)
    }

    func test_antiStub_sessionIntent_discriminators_force_distinct_branches() throws {
        XCTAssertEqual(slice(for: "severe-rest-v1").sessionIntent, .severeRest)            // branch 1
        XCTAssertEqual(slice(for: "restart-28d-gap-v1").sessionIntent, .reentryProductive) // branch 2
        XCTAssertEqual(slice(for: "deload-week-v1").sessionIntent, .deloadWeek)            // branch 3
        XCTAssertEqual(slice(for: "controlled-reload-v1").sessionIntent, .controlledReload) // branch 4 (4B3)
        XCTAssertEqual(slice(for: "stale-today-status-v1").sessionIntent, .normalSession)  // branch 5
    }

    // MARK: - 5. Compute-not-decode: engine derives phase from raw history, no golden

    func test_computeNotDecode_engine_derives_phase_from_history() {
        XCTAssertEqual(buildTrainingDecisionFromCleanInput(CoreSliceTestKit.makeCleanInput(gap: 30)).effectivePhase.activePhase, .restart)
        XCTAssertEqual(buildTrainingDecisionFromCleanInput(CoreSliceTestKit.makeCleanInput(gap: 20)).effectivePhase.activePhase, .reentry)
        XCTAssertEqual(buildTrainingDecisionFromCleanInput(CoreSliceTestKit.makeCleanInput(gap: 2)).effectivePhase.activePhase, .base)
        XCTAssertEqual(buildTrainingDecisionFromCleanInput(CoreSliceTestKit.makeCleanInput(gap: 30)).effectivePhase.gapDays, 30)
    }

    // MARK: - 6. Deterministic-clock drift canary

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
