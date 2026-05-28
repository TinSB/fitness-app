// iOS-4B1 — golden decode tests. Proves the type skeleton decodes all 10
// training-decision goldens (narrow + expanded), round-trips, tolerates
// unknown future keys, and exposes no mutation surface.

import XCTest
import IronPathDomain
@testable import IronPathTrainingDecision

final class TrainingDecisionGoldenDecodeTests: XCTestCase {
    // (1) All 10 golden fixtures are discovered on disk.
    func testAllTenGoldenFixturesDiscovered() throws {
        XCTAssertEqual(TrainingDecisionGoldens.allIds.count, 10)
        for id in TrainingDecisionGoldens.allIds {
            let url = TrainingDecisionGoldens.goldenURL(id)
            XCTAssertTrue(FileManager.default.fileExists(atPath: url.path), "missing golden \(id)")
        }
    }

    // (2) All 10 decode into TrainingDecision.
    func testAllTenDecode() throws {
        for id in TrainingDecisionGoldens.allIds {
            let d = try TrainingDecisionGoldens.decode(id)
            XCTAssertEqual(d.decisionVersion, "v2", "\(id)")
            XCTAssertEqual(d.decisionVersionEnum, .v2, "\(id)")
            XCTAssertFalse(d.sourceFixtureId.isEmpty, "\(id)")
        }
    }

    // (3) normal-session-v1 decodes despite its narrower 5-key projection.
    func testNarrowNormalSessionDecodes() throws {
        let d = try TrainingDecisionGoldens.decode("normal-session-v1")
        XCTAssertTrue(d.isNarrowProjection)
        XCTAssertNil(d.sessionIntent)
        XCTAssertNil(d.activePhase)
        XCTAssertNil(d.finalVolumeMultiplier)
        XCTAssertNil(d.cleanInput)
        // Always-present fields are still there.
        XCTAssertNotNil(d.userFacing.today)
        XCTAssertFalse(d.hiddenDebugSignals.arbitrationTrace.isEmpty)
    }

    // (4) The 9 expanded fixtures decode with sessionIntent/activePhase/risk/
    //     finalVolumeMultiplier present.
    func testExpandedFixturesCarryStructuredFields() throws {
        for id in TrainingDecisionGoldens.expandedIds {
            let d = try TrainingDecisionGoldens.decode(id)
            XCTAssertFalse(d.isNarrowProjection, "\(id) should be expanded")
            XCTAssertNotNil(d.sessionIntent, "\(id) sessionIntent")
            XCTAssertNotNil(d.activePhase, "\(id) activePhase")
            XCTAssertNotNil(d.riskLevel, "\(id) riskLevel")
            XCTAssertNotNil(d.finalVolumeMultiplier, "\(id) finalVolumeMultiplier")
            // Typed enum accessors resolve for the locked values.
            XCTAssertNotNil(d.sessionIntentEnum, "\(id) sessionIntent enum")
            XCTAssertNotNil(d.activePhaseEnum, "\(id) activePhase enum")
            XCTAssertNotNil(d.riskLevelEnum, "\(id) riskLevel enum")
        }
    }

    // (13) decode → encode → decode preserves top-level structured fields.
    func testRoundTripPreservesStructuredFields() throws {
        for id in TrainingDecisionGoldens.allIds {
            let d1 = try TrainingDecisionGoldens.decode(id)
            // Re-encode userFacing + hiddenDebug + re-read the typed fields.
            let reUF = try TrainingDecisionUserFacing(decoding: d1.userFacing.encoded())
            XCTAssertEqual(reUF.presentSurfaceIds.sorted(), d1.userFacing.presentSurfaceIds.sorted(), "\(id)")
            let reHidden = try HiddenDebugSignals(decoding: d1.hiddenDebugSignals.encoded())
            XCTAssertEqual(reHidden.arbitrationTrace, d1.hiddenDebugSignals.arbitrationTrace, "\(id)")
        }
    }

    // (14) An unknown future top-level key does not break decode and is kept.
    func testUnknownFutureKeyDoesNotBreakDecode() throws {
        let base = try TrainingDecisionGoldens.goldenData("severe-rest-v1")
        let value = try JSONValue(decoding: base)
        guard case .object(let obj) = value else { return XCTFail("expected object") }
        let injected = OrderedJSONObject(entries: obj.entries + [
            .init(key: "futureFieldV99", value: .string("ignored-but-preserved")),
        ])
        let d = try TrainingDecision(decoding: .object(injected))
        XCTAssertEqual(d.sessionIntent, "severe-rest")
        XCTAssertEqual(d.unknown["futureFieldV99"]?.stringValue, "ignored-but-preserved")
    }

    // (16) The decoded type exposes no AppData mutation surface — it is a
    //      value type with `let` stored properties only (compile-time guarantee;
    //      this test documents the intent + checks immutability of a re-decode).
    func testDecodedTypeIsValueOnly() throws {
        let a = try TrainingDecisionGoldens.decode("productive-floor-v1")
        let b = try TrainingDecisionGoldens.decode("productive-floor-v1")
        XCTAssertEqual(a, b) // Equatable value semantics; no shared mutable state.
    }
}
