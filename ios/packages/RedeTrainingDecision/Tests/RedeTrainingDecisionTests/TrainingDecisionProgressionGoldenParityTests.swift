// iOS-17e-5 — progression parity COMPUTE-ASSERT (flipped from 17e-0's decode-only).
//
// The 3 history-driven training-decision goldens (progressive-overload / plateau-stall
// / insufficient-history) carry performed-set history. 17e-0 shipped them DECODE-ONLY
// because the native package could not yet reproduce the history-driven ADAPTIVE
// output (progressionMode + weeklyAdjustment). 17e-1~4 ported the progression cluster
// (per-exercise e1RM trend -> performance query -> progression suggestion -> fine-tune
// / load feedback); 17e-5 WIRES the weekly projection into the core slice
// (TrainingDecisionModes.buildWeeklyAdjustment) so the engine now consumes the recorded
// sets and emits the adaptive weeklyAdjustment / progressionMode.
//
// This file is the closed-loop payoff: it reconstructs each fixture's engine INPUT in
// memory (rising / flat / too-short weighted history — the SAME deterministic clock and
// push-a template the legacy web schema generator used), runs the REAL Swift engine, and asserts the
// COMPUTED {progressionMode, weeklyAdjustment, perExercise} (plus the full decision
// frame: sessionIntent / activePhase / effectivePhase / riskLevel / finalVolumeMultiplier)
// EQUAL the recorded goldens — field by field. The expected side is the literal golden;
// the actual side is the engine output reconstructed from raw inputs, never re-read off
// the decoded golden. Deleting the e1RM-trend wiring collapses progressive-overload's
// 'increase' to 'hold' and fails the contrast.
//
// The ids live in `TrainingDecisionGoldens.progressionIds` (a SEPARATE compute-assert
// roster from the cold-start `allIds` — see the loader for why), so the cold-start
// goldens stay byte-identical and their suites stay 10/9 (zero drift).

import XCTest
import RedeDomain
import RedeDataHealth
@testable import RedeTrainingDecision

final class TrainingDecisionProgressionGoldenParityTests: XCTestCase {

    static var progressionIds: [String] { TrainingDecisionGoldens.progressionIds }

    /// The closed-loop fixture: rising performed-set history -> add load.
    static let progressId = "progressive-overload-v1"

    // MARK: - Per-fixture engine INPUT (declared independently of the golden)

    /// Each session logs the push-a main compound at the spec'd top weight, spaced 3
    /// days, mirroring the legacy web schema synthetic spec (single exercise per session; only the top
    /// weight drives isE1rmTrendUp). Default readiness (一般/中) keeps recoveryHigh=false,
    /// isolating the pure progression signal (vs controlled-reload's low readiness).
    private static func weighted(_ pairs: [(gap: Int, weight: Double)], _ prefix: String) -> [TrainingSession] {
        pairs.enumerated().map { idx, p in
            CoreSliceTestKit.weightedSession(id: "\(prefix)\(idx + 1)", gap: p.gap, topWeight: p.weight)
        }
    }

    private static var inputs: [String: [TrainingSession]] {
        [
            // 5 sessions, strictly rising top weight -> isE1rmTrendUp=true -> progress / increase.
            "progressive-overload-v1": weighted([(14, 60), (11, 62.5), (8, 65), (5, 67.5), (2, 70)], "po-s"),
            // 5 sessions, flat top weight -> recent==older -> no trend -> hold.
            "plateau-stall-v1": weighted([(14, 60), (11, 60), (8, 60), (5, 60), (2, 60)], "ps-s"),
            // 2 sessions, rising but < 4-session threshold -> isE1rmTrendUp=false -> hold.
            "insufficient-history-v1": weighted([(5, 60), (2, 65)], "ih-s"),
        ]
    }

    private func slice(for id: String) -> TrainingDecisionCoreSlice {
        let sessions = Self.inputs[id]!
        // Default sleep 一般 / energy 中 -> neutral readiness; push-a template exercises.
        let input = CoreSliceTestKit.makeCleanInput(sessions: sessions)
        return buildTrainingDecisionFromCleanInput(input)
    }

    // MARK: - 0. All 3 history goldens are discovered on disk.

    func testAllProgressionGoldensDiscovered() throws {
        XCTAssertEqual(Self.progressionIds.count, 3)
        for id in Self.progressionIds {
            XCTAssertTrue(FileManager.default.fileExists(atPath: TrainingDecisionGoldens.goldenURL(id).path), "missing golden \(id)")
        }
    }

    // MARK: - 1. progressionMode parity (compute == golden) on all 3 fixtures

    func test_progressionMode_matches_goldens() throws {
        for id in Self.progressionIds {
            let golden = try TrainingDecisionGoldens.decode(id)
            let goldenMode = try XCTUnwrap(golden.progressionModeEnum, "\(id) golden progressionMode")
            XCTAssertEqual(slice(for: id).progressionMode, goldenMode, "\(id) progressionMode")
        }
        // The contrast the scaffold exists to prove: only the rising-trend fixture progresses.
        XCTAssertEqual(slice(for: "progressive-overload-v1").progressionMode, .progress)
        XCTAssertEqual(slice(for: "plateau-stall-v1").progressionMode, .hold)
        XCTAssertEqual(slice(for: "insufficient-history-v1").progressionMode, .hold)
    }

    // MARK: - 2. weeklyAdjustment parity (compute == golden) on all 3 fixtures

    func test_weeklyAdjustment_matches_goldens() throws {
        for id in Self.progressionIds {
            let golden = try TrainingDecisionGoldens.decode(id)
            let goldenWA = try XCTUnwrap(golden.weeklyAdjustment, "\(id) golden weeklyAdjustment")
            let computed = slice(for: id).weeklyAdjustment
            XCTAssertEqual(computed.direction, goldenWA.direction, "\(id) weeklyAdjustment.direction")
            XCTAssertEqual(computed.magnitudePct, goldenWA.magnitudePct, "\(id) weeklyAdjustment.magnitudePct")
            XCTAssertEqual(computed.blockedBy, goldenWA.blockedBy, "\(id) weeklyAdjustment.blockedBy")
            XCTAssertEqual(computed.appliesFromIsoDate, goldenWA.appliesFromIsoDate, "\(id) weeklyAdjustment.appliesFromIsoDate")
        }
        // Closed loop: rising trend -> increase(+5%); flat / too-short -> hold(0).
        XCTAssertEqual(slice(for: "progressive-overload-v1").weeklyAdjustment.direction, "increase")
        XCTAssertEqual(slice(for: "progressive-overload-v1").weeklyAdjustment.magnitudePct, 5)
        XCTAssertEqual(slice(for: "plateau-stall-v1").weeklyAdjustment.direction, "hold")
        XCTAssertEqual(slice(for: "plateau-stall-v1").weeklyAdjustment.magnitudePct, 0)
        XCTAssertEqual(slice(for: "insufficient-history-v1").weeklyAdjustment.direction, "hold")
        // No block reason on a plain normal session.
        for id in Self.progressionIds { XCTAssertNil(slice(for: id).weeklyAdjustment.blockedBy, "\(id) blockedBy") }
    }

    // MARK: - 3. perExercise parity (compute == golden) on all 3 fixtures

    func test_perExercise_matches_goldens() throws {
        for id in Self.progressionIds {
            let golden = try TrainingDecisionGoldens.decode(id)
            let goldenPer = try XCTUnwrap(golden.perExercise, "\(id) golden perExercise")
            let computed = slice(for: id).perExercise
            XCTAssertFalse(computed.isEmpty, "\(id) perExercise non-empty")
            XCTAssertEqual(computed.count, goldenPer.count, "\(id) perExercise count")
            for (c, g) in zip(computed, goldenPer) {
                XCTAssertEqual(c.exerciseId, g.exerciseId, "\(id) perExercise.exerciseId")
                XCTAssertEqual(c.role.rawValue, g.role, "\(id) perExercise.role for \(g.exerciseId)")
                XCTAssertEqual(c.targetSets, g.targetSets, "\(id) perExercise.targetSets for \(g.exerciseId)")
            }
        }
    }

    // MARK: - 4. Full decision frame parity (compute == golden) — proves the whole
    //         history-driven decision reproduces, not just the 3 headline fields.

    func test_decisionFrame_matches_goldens() throws {
        for id in Self.progressionIds {
            let golden = try TrainingDecisionGoldens.decode(id)
            let computed = slice(for: id)
            // These three fixtures are all normal-phase progression cases.
            XCTAssertEqual(computed.sessionIntent.rawValue, golden.sessionIntent, "\(id) sessionIntent")
            XCTAssertEqual(computed.activePhase.rawValue, golden.activePhase, "\(id) activePhase")
            if let goldenRisk = golden.riskLevel {
                XCTAssertEqual(computed.riskLevel.rawValue, goldenRisk, "\(id) riskLevel")
            }
            if let goldenMultiplier = golden.finalVolumeMultiplier {
                XCTAssertEqual(computed.finalVolumeMultiplier, goldenMultiplier, accuracy: 1e-9, "\(id) finalVolumeMultiplier")
            }
            let ep = try XCTUnwrap(golden.effectivePhase, "\(id) golden effectivePhase")
            XCTAssertEqual(computed.effectivePhase.activePhase.rawValue, ep.activePhase, "\(id) effectivePhase.activePhase")
            XCTAssertEqual(computed.effectivePhase.gapDays, ep.gapDays, "\(id) effectivePhase.gapDays")
            XCTAssertEqual(computed.effectivePhase.hasHistory, ep.hasHistory, "\(id) effectivePhase.hasHistory")
            // Input fidelity: the synthetic history length matches what the golden recorded.
            XCTAssertEqual(Self.inputs[id]!.count, golden.inputEvidence?.historyLength, "\(id) historyLength")
        }
    }

    // MARK: - 5. Compute-not-decode: the contrast is driven by the engine, not the golden

    func test_progressionContrastIsAdaptive_computed() {
        let progress = slice(for: "progressive-overload-v1")
        let plateau = slice(for: "plateau-stall-v1")
        let short = slice(for: "insufficient-history-v1")
        // Only the rising-trend fixture progresses; flat + too-short both hold.
        XCTAssertEqual(progress.progressionMode, .progress)
        XCTAssertNotEqual(progress.progressionMode, plateau.progressionMode)
        XCTAssertNotEqual(progress.progressionMode, short.progressionMode)
        XCTAssertEqual(plateau.progressionMode, short.progressionMode)
        XCTAssertEqual(progress.weeklyAdjustment.direction, "increase")
        XCTAssertEqual(plateau.weeklyAdjustment.direction, "hold")
        XCTAssertEqual(short.weeklyAdjustment.direction, "hold")
        // The e1RM trend is the discriminator (history-driven), not the phase/intent.
        XCTAssertTrue(progress.e1rmTrendUp)
        XCTAssertFalse(plateau.e1rmTrendUp)
        XCTAssertFalse(short.e1rmTrendUp)
    }

    // MARK: - 6. Goldens stay pinned to the deterministic clock the gap math assumes.

    func test_goldens_pinned_to_expected_deterministic_clock() throws {
        for id in Self.progressionIds {
            let golden = try TrainingDecisionGoldens.decode(id)
            XCTAssertEqual(golden.parityGolden?.deterministicClockIso, CoreSliceTestKit.deterministicClockIso, "\(id) parity clock")
            XCTAssertEqual(golden.parityGolden?.generatorVersion, "v1", "\(id) generatorVersion")
        }
    }

    // MARK: - 7. Forward-compat: an unknown future top-level key does not break decode.

    func testUnknownFutureKeyDoesNotBreakDecode() throws {
        let base = try TrainingDecisionGoldens.goldenData(Self.progressId)
        let value = try JSONValue(decoding: base)
        guard case .object(let obj) = value else { return XCTFail("expected object") }
        let injected = OrderedJSONObject(entries: obj.entries + [
            .init(key: "futureFieldV99", value: .string("ignored-but-preserved")),
        ])
        let d = try TrainingDecision(decoding: .object(injected))
        XCTAssertEqual(d.progressionModeEnum, .progress)
        XCTAssertEqual(d.unknown["futureFieldV99"]?.stringValue, "ignored-but-preserved")
    }
}
