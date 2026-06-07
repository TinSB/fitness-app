// CC-0 — SetAnomaly type-family decode anchor (coachAction-foundation).
//
// TYPE-ONLY port has no runtime logic to compute-assert, so this anchors the
// SHAPE two ways (per the CC-0 "decode 锚定" plan):
//   1. `SetAnomalySeverity` raw values match the legacy web schema string union VERBATIM and in
//      source order (setAnomalyEngine.ts:5) — note it is a DISTINCT union from
//      DataHealthSeverity (tops out at `critical`, not `error`).
//   2. a representative JSON object round-trips through `init(decoding:)` with
//      every field intact, including WITH and WITHOUT the optional
//      `suggestedAction`.
//
// Pure / read-only — no engine logic, no `: Date`.

import XCTest
import IronPathDomain
import IronPathTrainingDecision

final class SetAnomalyTypesDecodeTests: XCTestCase {

    func testSeverityRawValuesMatchTS() {
        XCTAssertEqual(
            SetAnomalySeverity.allCases.map(\.rawValue),
            ["info", "warning", "critical"]
        )
    }

    func testDecodeRoundTripWithSuggestedAction() throws {
        let json = """
        {
          "id": "anomaly-1",
          "severity": "critical",
          "title": "重量异常偏高",
          "message": "本组重量远超历史工作组",
          "suggestedAction": "确认重量",
          "requiresConfirmation": true
        }
        """
        let value = try JSONValue(decoding: Data(json.utf8))
        let decoded = try SetAnomaly(decoding: value)

        XCTAssertEqual(decoded.id, "anomaly-1")
        XCTAssertEqual(decoded.severity, .critical)
        XCTAssertEqual(decoded.title, "重量异常偏高")
        XCTAssertEqual(decoded.message, "本组重量远超历史工作组")
        XCTAssertEqual(decoded.suggestedAction, "确认重量")
        XCTAssertTrue(decoded.requiresConfirmation)
    }

    func testDecodeRoundTripWithoutSuggestedAction() throws {
        let json = #"{ "id": "anomaly-2", "severity": "warning", "title": "t", "message": "m", "requiresConfirmation": false }"#
        let value = try JSONValue(decoding: Data(json.utf8))
        let decoded = try SetAnomaly(decoding: value)

        XCTAssertEqual(decoded.id, "anomaly-2")
        XCTAssertEqual(decoded.severity, .warning)
        XCTAssertNil(decoded.suggestedAction)
        XCTAssertFalse(decoded.requiresConfirmation)
    }

    func testDecodeRejectsUnknownSeverity() throws {
        let json = #"{ "id": "x", "severity": "error", "title": "t", "message": "m", "requiresConfirmation": false }"#
        let value = try JSONValue(decoding: Data(json.utf8))
        // `error` is a DataHealthSeverity value, NOT a SetAnomalySeverity — must reject.
        XCTAssertThrowsError(try SetAnomaly(decoding: value))
    }
}
