// AppDataRealExportParityTests — iOS-2C real export end-to-end parity.
//
// Loads the canonical redacted real export
// `tests/fixtures/data-health/ironpath-2026-05-27-redacted.json`
// directly via `#filePath`-rooted resolution (no Bundle.module copy
// because the file is ~805 KB and Agent 4 §10 rejected duplication).
// Asserts:
//
//   * AppData.init(decoding:) accepts the full real export.
//   * schemaVersion == 8.
//   * history is non-empty and at least one session decodes typed.
//   * At least one TrainingSession.restTimerState is decoded as a
//     typed non-nil JSONValue (covering Agent 3 §6 deferred gap (a)).
//   * healthMetricSamples contains at least one sample whose `raw`
//     opaque payload is non-nil (covering Agent 3 §6 deferred gap (b)).
//   * The canonical re-emit byte-equals the canonical re-emit of the
//     original JSON — round-trip preservation.
//   * The Swift FNV-1a hash matches the iOS-0 golden hash from
//     `tests/fixtures/parity/golden/real-export/redacted-2026-05-27.json`
//     (`parityGolden.snapshotHash`).
//
// If the FNV-1a comparison fails AND the diff is purely number
// formatting, the V2 escalation to `NumberRepr.originalText` is
// the documented next step (iOS-2A plan §6). iOS-2C documents this
// outcome in the PR body either way.

import XCTest
@testable import IronPathDomain
import Foundation

final class AppDataRealExportParityTests: XCTestCase {
    /// Walks the source-file path back to the repo root, then
    /// resolves the canonical redacted-export fixture. Deterministic
    /// at compile time because `#filePath` is baked in by swiftc;
    /// independent of `swift test`'s `.build/` working directory.
    private func realExportURL() -> URL {
        URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()  // IronPathDomainTests/
            .deletingLastPathComponent()  // Tests/
            .deletingLastPathComponent()  // IronPathDomain/
            .deletingLastPathComponent()  // packages/
            .deletingLastPathComponent()  // ios/
            .deletingLastPathComponent()  // repo root
            .appendingPathComponent("tests/fixtures/data-health/ironpath-2026-05-27-redacted.json")
    }

    /// Walks to the iOS-0 golden file for the real export.
    private func realExportGoldenURL() -> URL {
        URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .appendingPathComponent("tests/fixtures/parity/golden/real-export/redacted-2026-05-27.json")
    }

    func testRealExportFileExists() throws {
        XCTAssertTrue(
            FileManager.default.fileExists(atPath: realExportURL().path),
            "redacted real export must exist at the canonical path"
        )
    }

    func testAppDataDecodesRealExport() throws {
        let data = try Data(contentsOf: realExportURL())
        let appData = try AppData(decoding: data)
        XCTAssertEqual(appData.schemaVersion.rawValue, 8)
    }

    func testRealExportHistoryIsNonEmptyAndTypedDecode() throws {
        let data = try Data(contentsOf: realExportURL())
        let appData = try AppData(decoding: data)
        let history = appData.history
        XCTAssertGreaterThan(history.count, 0, "real export must carry at least one history session")
        // Spot-check the first session has the typed identity fields.
        let firstId = history.first?.id
        XCTAssertNotNil(firstId, "first session must have a typed id")
    }

    func testRealExportRestTimerStateTypedNonNilAtLeastOnce() throws {
        // Agent 3 §6 deferred gap (a): assert that at least one
        // session's `restTimerState` is a decoded non-nil JSONValue
        // (i.e., the value was present and not JSON null).
        let data = try Data(contentsOf: realExportURL())
        let appData = try AppData(decoding: data)
        let sessions = appData.history
        let withRestTimer = sessions.filter { session in
            guard let rts = session.restTimerState else { return false }
            return !rts.isNull
        }
        XCTAssertGreaterThan(withRestTimer.count, 0,
                             "real export must carry at least one TrainingSession with a non-null restTimerState (preflight grep counted 10)")
    }

    func testRealExportHealthMetricSamplesRawTypedNonNilAtLeastOnce() throws {
        // Agent 3 §6 deferred gap (b): assert that at least one
        // health sample's `raw` opaque payload survives decode as
        // non-nil JSONValue.
        let data = try Data(contentsOf: realExportURL())
        let appData = try AppData(decoding: data)
        let samples = appData.healthMetricSamples
        let withRaw = samples.filter { $0.raw != nil && $0.raw?.isNull == false }
        XCTAssertGreaterThan(withRaw.count, 0,
                             "real export must carry at least one HealthMetricSample.raw non-null payload")
    }

    func testRealExportCanonicalRoundTripIsIdempotent() throws {
        // AppData.root carries the entire tree verbatim, so canonical
        // re-emit must equal canonical re-emit of the original JSON.
        let data = try Data(contentsOf: realExportURL())
        let appData = try AppData(decoding: data)
        let reEmit = try appData.canonicalJSONString()
        let originalCanonical = try JSONValue(decoding: data).canonicalJSONString()
        XCTAssertEqual(reEmit, originalCanonical,
                       "real export AppData round-trip must yield identical canonical text")
    }

    func testRealExportFnv1aHashMatchesIos0Golden() throws {
        // Resolves the iOS-0 golden hash for the real-export pointer
        // fixture and asserts the Swift FNV-1a over the Swift
        // canonical-stringify output reproduces it byte-for-byte. If
        // this fails AND the diff is purely number-formatting drift,
        // iOS-2C escalates to V2 NumberRepr.originalText. The PR body
        // documents the outcome.
        let data = try Data(contentsOf: realExportURL())
        let appData = try AppData(decoding: data)
        let canonical = try appData.canonicalJSONString()
        let hash = fnv1aPhase19b(canonical)

        let goldenData = try Data(contentsOf: realExportGoldenURL())
        let golden = try JSONValue(decoding: goldenData)
        guard case .object(let goldenObj) = golden,
              let expectedHash = goldenObj["snapshotHash"]?.stringValue else {
            XCTFail("could not extract snapshotHash from iOS-0 golden")
            return
        }
        XCTAssertEqual(hash, expectedHash,
                       "Swift FNV-1a over canonical-stringify must match the iOS-0 golden snapshot hash for the redacted real export")
    }
}

// FNV-1a (32-bit) — copy of the algorithm from
// AppDataCodableRoundTripTests. Centralisation into a shared helper
// is iOS-7 work when the cloud upload path needs the same primitive.
private func fnv1aPhase19b(_ text: String) -> String {
    var hash: UInt32 = 2166136261
    for unit in text.utf16 {
        hash ^= UInt32(unit)
        hash = hash &* 16777619
    }
    return String(format: "phase19b-%08x", hash)
}
