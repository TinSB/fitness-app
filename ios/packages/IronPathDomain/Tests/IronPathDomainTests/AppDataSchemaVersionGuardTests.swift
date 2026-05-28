// AppDataSchemaVersionGuardTests — iOS-2B AppData Swift Models V1.
//
// Locks the three-branch refusal contract documented in iOS-2A plan
// §9 and Agent 5 §3.5:
//
//   * `schemaVersion == current` → decode succeeds.
//   * `schemaVersion < current`  → `SchemaVersionError.upgradeRequired`.
//   * `schemaVersion > current`  → `SchemaVersionError.futureIncompatible`.
//
// `schemaVersion` itself never gets silently downgraded; the load
// fails, the caller (iOS-3) is responsible for surfacing a prompt.

import XCTest
@testable import IronPathDomain

final class AppDataSchemaVersionGuardTests: XCTestCase {
    private func buildPayload(schemaVersion: Int) -> Data {
        // Minimal valid AppData payload — only schemaVersion is
        // load-bearing for this guard; other fields are unused by
        // the SchemaVersion check.
        let json = """
        {"schemaVersion":\(schemaVersion),"settings":{},"templates":[],"history":[]}
        """
        return Data(json.utf8)
    }

    func testSchemaVersion8IsAccepted() throws {
        let appData = try AppData(decoding: buildPayload(schemaVersion: 8))
        XCTAssertEqual(appData.schemaVersion.rawValue, 8)
    }

    func testSchemaVersion7TriggersUpgradeRequired() {
        XCTAssertThrowsError(
            try AppData(decoding: buildPayload(schemaVersion: 7))
        ) { error in
            guard case SchemaVersionError.upgradeRequired(let found) = error else {
                XCTFail("expected .upgradeRequired, got \(error)")
                return
            }
            XCTAssertEqual(found, 7)
        }
    }

    func testSchemaVersion9TriggersFutureIncompatible() {
        XCTAssertThrowsError(
            try AppData(decoding: buildPayload(schemaVersion: 9))
        ) { error in
            guard case SchemaVersionError.futureIncompatible(let found) = error else {
                XCTFail("expected .futureIncompatible, got \(error)")
                return
            }
            XCTAssertEqual(found, 9)
        }
    }

    func testMissingSchemaVersionThrowsMissingOrInvalid() {
        let json = #"{"settings":{},"templates":[],"history":[]}"#
        XCTAssertThrowsError(
            try AppData(decoding: Data(json.utf8))
        ) { error in
            guard case SchemaVersionError.missingOrInvalid = error else {
                XCTFail("expected .missingOrInvalid, got \(error)")
                return
            }
        }
    }

    func testNonIntegerSchemaVersionThrowsMissingOrInvalid() {
        let json = #"{"schemaVersion":"eight","settings":{}}"#
        XCTAssertThrowsError(
            try AppData(decoding: Data(json.utf8))
        ) { error in
            guard case SchemaVersionError.missingOrInvalid = error else {
                XCTFail("expected .missingOrInvalid, got \(error)")
                return
            }
        }
    }

    func testValidateMethodSymmetry() throws {
        // The class method matches the AppData init refusal contract.
        XCTAssertEqual(try SchemaVersion.validate(found: 8),
                       SchemaVersion.current)
        XCTAssertThrowsError(try SchemaVersion.validate(found: 7))
        XCTAssertThrowsError(try SchemaVersion.validate(found: 9))
    }

    func testCanonicalEmitDoesNotMutateSchemaVersionInteger() throws {
        // The integer literal must round-trip as `8`, never `8.0`.
        let appData = try AppData(decoding: buildPayload(schemaVersion: 8))
        let canonical = try appData.canonicalJSONString()
        XCTAssertTrue(canonical.contains("\"schemaVersion\":8"),
                      "schemaVersion must round-trip as integer literal 8, got: \(canonical)")
        XCTAssertFalse(canonical.contains("\"schemaVersion\":8.0"))
    }
}
