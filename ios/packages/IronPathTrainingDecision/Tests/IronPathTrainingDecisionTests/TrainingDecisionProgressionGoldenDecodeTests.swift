// iOS-17e-0 — progression parity scaffold (DECODE-ONLY).
//
// These tests pin the THREE new history-driven training-decision goldens that
// 17e-0 added (progressive-overload / plateau-stall / insufficient-history).
// Their inputs carry performed sets (history[].exercises[].sets non-empty), so
// the REAL TS trainingDecisionEngine consumed that history and emitted its
// history-driven ADAPTIVE output — progressionMode + weeklyAdjustment — which
// the static native template (DEFERRED-inert exercise prescription, GLOBAL e1RM
// boolean) cannot reproduce yet.
//
// SCOPE — DECODE-ONLY, NOT COMPUTE-ASSERT. 17e-0 ships only the parity baseline:
// it asserts the goldens DECODE into the parity `TrainingDecision` shape, that
// the adaptive fields are present + carry the locked per-fixture values, and
// that decode is shape-stable. It deliberately does NOT recompute the decision
// (there is no progression engine in this package — and the existing static
// slices would NOT match an adaptive golden). The COMPUTE-ASSERT flip lands
// incrementally as 17e-1~5 port the PWA progression cluster:
//   17e-1 per-exercise e1RM → 17e-2 performance query → 17e-3 progression
//   suggestion → 17e-4 fine-tune / load feedback → 17e-5 wire to the top surface.
// At each slice the corresponding fixture(s) move from decode-only here to a
// real Swift-engine compute-and-assert (the SR-0 → SR-3 decode→compute pattern).
//
// These ids are intentionally NOT added to `TrainingDecisionGoldens.allIds` /
// `.expandedIds`: that keeps every existing compute/decode parity test pinned to
// the 10 cold-start goldens (zero drift, all green), while this file owns the
// new adaptive-history scaffold.

import XCTest
import IronPathDomain
@testable import IronPathTrainingDecision

final class TrainingDecisionProgressionGoldenDecodeTests: XCTestCase {
    /// The 3 iOS-17e-0 history-driven golden ids (reusing the shared
    /// `TrainingDecisionGoldens` by-id loader; SEPARATE from `allIds`).
    static let progressionIds: [String] = [
        "progressive-overload-v1",
        "plateau-stall-v1",
        "insufficient-history-v1",
    ]

    /// The one fixture that proves the closed loop: rising performed-set history
    /// → the engine recommends adding load.
    static let progressId = "progressive-overload-v1"

    // (1) All 3 history goldens are discovered on disk.
    func testAllProgressionGoldensDiscovered() throws {
        XCTAssertEqual(Self.progressionIds.count, 3)
        for id in Self.progressionIds {
            let url = TrainingDecisionGoldens.goldenURL(id)
            XCTAssertTrue(FileManager.default.fileExists(atPath: url.path), "missing golden \(id)")
        }
    }

    // (2) All 3 decode into the parity TrainingDecision shape with the
    //     always-present scalars + the parityGolden envelope.
    func testAllDecodeIntoParityShape() throws {
        for id in Self.progressionIds {
            let d = try TrainingDecisionGoldens.decode(id)
            XCTAssertEqual(d.sourceFixtureId, "training-decision/\(id)", "\(id)")
            XCTAssertEqual(d.decisionVersionEnum, .v2, "\(id)")
            XCTAssertEqual(d.parityGolden?.sourceFixtureId, "training-decision/\(id)", "\(id)")
            XCTAssertEqual(d.parityGolden?.generatorVersion, "v1", "\(id)")
        }
    }

    // (3) Each carries the EXPANDED progression projection (not the narrow
    //     normal-session shape): progressionMode + weeklyAdjustment + a
    //     non-empty perExercise + inputEvidence are all present.
    func testEachCarriesAdaptiveProgressionProjection() throws {
        for id in Self.progressionIds {
            let d = try TrainingDecisionGoldens.decode(id)
            XCTAssertFalse(d.isNarrowProjection, "\(id) must be the expanded projection")
            XCTAssertNotNil(d.progressionModeEnum, "\(id) progressionMode resolves to a typed enum")
            XCTAssertNotNil(d.weeklyAdjustment, "\(id) weeklyAdjustment present")
            let perExercise = try XCTUnwrap(d.perExercise, "\(id) perExercise")
            XCTAssertFalse(perExercise.isEmpty, "\(id) perExercise non-empty")
            XCTAssertNotNil(d.inputEvidence?.historyLength, "\(id) inputEvidence.historyLength")
            // No special phase / risk: these are normal-phase progression fixtures.
            XCTAssertEqual(d.sessionIntentEnum, .normalSession, "\(id)")
            XCTAssertEqual(d.activePhaseEnum, .base, "\(id)")
            XCTAssertEqual(d.riskLevelEnum, RiskLevel.none, "\(id)")
        }
    }

    // (4) progressive-overload — the CLOSED LOOP. >= 4 rising-weight sessions +
    //     neutral readiness → the engine read the performed sets and recommends
    //     progressing the load.
    func testProgressiveOverloadProgresses() throws {
        let d = try TrainingDecisionGoldens.decode("progressive-overload-v1")
        XCTAssertEqual(d.progressionModeEnum, .progress)
        XCTAssertEqual(d.weeklyAdjustment?.direction, "increase")
        XCTAssertEqual(d.inputEvidence?.historyLength, 5)
    }

    // (5) plateau-stall — identical cadence, FLAT weight → no upward trend → the
    //     engine HOLDS instead of progressing.
    func testPlateauStallHolds() throws {
        let d = try TrainingDecisionGoldens.decode("plateau-stall-v1")
        XCTAssertEqual(d.progressionModeEnum, .hold)
        XCTAssertEqual(d.weeklyAdjustment?.direction, "hold")
        XCTAssertEqual(d.inputEvidence?.historyLength, 5)
    }

    // (6) insufficient-history — rising weight but only 2 sessions (< the
    //     4-session trend threshold) → data-insufficient boundary → HOLD, NOT a
    //     premature progression.
    func testInsufficientHistoryHolds() throws {
        let d = try TrainingDecisionGoldens.decode("insufficient-history-v1")
        XCTAssertEqual(d.progressionModeEnum, .hold)
        XCTAssertEqual(d.weeklyAdjustment?.direction, "hold")
        XCTAssertEqual(d.inputEvidence?.historyLength, 2)
    }

    // (7) The adaptive CONTRAST is the whole point of the scaffold: only the
    //     rising-trend fixture progresses; the flat + too-short ones hold. If a
    //     future engine/golden change collapsed them, this fails.
    func testProgressionContrastIsAdaptive() throws {
        let progress = try TrainingDecisionGoldens.decode("progressive-overload-v1")
        let plateau = try TrainingDecisionGoldens.decode("plateau-stall-v1")
        let short = try TrainingDecisionGoldens.decode("insufficient-history-v1")
        XCTAssertEqual(progress.progressionModeEnum, .progress)
        XCTAssertNotEqual(progress.progressionModeEnum, plateau.progressionModeEnum)
        XCTAssertNotEqual(progress.progressionModeEnum, short.progressionModeEnum)
        XCTAssertEqual(plateau.progressionModeEnum, short.progressionModeEnum) // both .hold
    }

    // (8) perExercise items decode with the locked { exerciseId, role, targetSets }
    //     shape (the per-exercise set-count summary the Swift port reads).
    func testPerExerciseItemsDecodeShape() throws {
        for id in Self.progressionIds {
            let d = try TrainingDecisionGoldens.decode(id)
            for e in try XCTUnwrap(d.perExercise) {
                XCTAssertFalse(e.exerciseId.isEmpty, "\(id) exerciseId")
                XCTAssertFalse(e.role.isEmpty, "\(id) role")
                XCTAssertGreaterThanOrEqual(e.targetSets, 1, "\(id) targetSets")
            }
        }
    }

    // (9) Decode is value-stable (Equatable; no shared mutable state).
    func testDecodedValueIsStable() throws {
        for id in Self.progressionIds {
            let a = try TrainingDecisionGoldens.decode(id)
            let b = try TrainingDecisionGoldens.decode(id)
            XCTAssertEqual(a, b, "\(id)")
        }
    }

    // (10) An unknown future top-level key does not break decode and is preserved
    //      in `unknown` (forward-compat — mirrors the SR-0 decode contract).
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
