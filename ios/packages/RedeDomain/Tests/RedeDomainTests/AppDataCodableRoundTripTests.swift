// AppDataCodableRoundTripTests — iOS-2B AppData Swift Models V1.
//
// Loads the canonical iOS-0 parity fixture `snapshot-hash-stable-v1`,
// decodes into Swift, canonicalises both sides, and asserts:
//
//   1. Re-encoded canonical JSON matches the iOS-0 canonical form.
//   2. The FNV-1a hash matches the iOS-0 golden
//      `phase19b-5ce77819` (locked at
//      `ios/ParityFixtures/parity/golden/app-data/snapshot-hash-stable-v1.json`).
//   3. `AppData.init(decoding:)` accepts the payload and yields
//      `schemaVersion == SchemaVersion.current`.
//
// iOS-2B deliberately consumes only the snapshot-hash fixture. The
// real-export pointer fixture (805 KB) is deferred to a future
// iOS-2C/iOS-3 PR — see Agent 3 §6 deferral rationale and the iOS-2B
// implementation doc §9.

import XCTest
@testable import RedeDomain

final class AppDataCodableRoundTripTests: XCTestCase {
    private func loadFixturePayload() throws -> JSONValue {
        guard let url = Bundle.module.url(
            forResource: "snapshot-hash-stable-v1-input",
            withExtension: "json",
            subdirectory: "Fixtures"
        ) else {
            XCTFail("Bundle.module missing snapshot-hash-stable-v1-input.json")
            throw JSONValueError.decodeFailed("bundle miss")
        }
        let data = try Data(contentsOf: url)
        let root = try JSONValue(decoding: data)
        guard case .object(let obj) = root,
              let payload = obj["payload"] else {
            XCTFail("input fixture missing payload key")
            throw JSONValueError.decodeFailed("payload miss")
        }
        return payload
    }

    func testFixtureLoadsAsJSONObject() throws {
        let payload = try loadFixturePayload()
        guard case .object = payload else {
            XCTFail("payload should be a JSON object")
            return
        }
    }

    func testPayloadCanonicalisesIdempotently() throws {
        let payload = try loadFixturePayload()
        let canonical1 = try payload.canonicalJSONString()
        let reparsed = try JSONValue(decoding: Data(canonical1.utf8))
        let canonical2 = try reparsed.canonicalJSONString()
        XCTAssertEqual(canonical1, canonical2,
                       "canonical re-emit must be idempotent")
    }

    func testAppDataInitAcceptsPayload() throws {
        let payload = try loadFixturePayload()
        let data = try payload.canonicalJSONData()
        let appData = try AppData(decoding: data)
        XCTAssertEqual(appData.schemaVersion, SchemaVersion.current)
        XCTAssertEqual(appData.schemaVersion.rawValue, 8)
    }

    func testAppDataReEncodeMatchesOriginalCanonical() throws {
        let payload = try loadFixturePayload()
        let originalCanonical = try payload.canonicalJSONString()
        let data = try payload.canonicalJSONData()
        let appData = try AppData(decoding: data)
        let reEmit = try appData.canonicalJSONString()
        XCTAssertEqual(reEmit, originalCanonical,
                       "AppData round-trip via canonical bytes must yield identical canonical text")
    }

    func testFnv1aSnapshotHashMatchesIos0Golden() throws {
        // The iOS-0 golden lives at
        // `ios/ParityFixtures/parity/golden/app-data/snapshot-hash-stable-v1.json`
        // (`"snapshotHash": "phase19b-5ce77819"`). This test re-derives
        // the same hash from the Swift canonical-stringify output and
        // asserts equality.
        let payload = try loadFixturePayload()
        let canonical = try payload.canonicalJSONString()
        let hash = fnv1aPhase19b(canonical)
        XCTAssertEqual(hash, "phase19b-5ce77819",
                       "Swift FNV-1a over canonical-stringify must match the iOS-0 golden")
    }
}

// Mirrors the legacy web implementation implementation at
// `retired web reference`:
// 32-bit FNV-1a, seed 2166136261, prime 16777619, output
// `phase19b-<8-hex>`. The legacy web schema implementation iterates JavaScript
// `String.charCodeAt(index)` which returns UTF-16 code units — we
// mirror that with Swift's `String.utf16` view.
private func fnv1aPhase19b(_ text: String) -> String {
    var hash: UInt32 = 2166136261
    for unit in text.utf16 {
        hash ^= UInt32(unit)
        hash = hash &* 16777619
    }
    return String(format: "phase19b-%08x", hash)
}
