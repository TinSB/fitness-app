// CC-0 — DailyTrainingAdjustment type-family decode anchor (coachAction-foundation).
//
// TYPE-ONLY port has no runtime logic to compute-assert, so this anchors the
// SHAPE two ways (per the CC-0 "decode 锚定" plan):
//   1. enum raw values match the legacy web schema string unions VERBATIM and in source order
//      (dailyTrainingAdjustmentEngine.ts:15 / :24 / :43) — guards a typo'd token
//      or a dropped/added case.
//   2. a representative JSON object round-trips through `init(decoding:)` into the
//      typed struct with every field intact, including a change WITH and a change
//      WITHOUT the optional `targetId`.
//
// Pure / read-only — no engine logic, no `: Date`.

import XCTest
import RedeDomain
import RedeTrainingDecision

final class DailyTrainingAdjustmentTypesDecodeTests: XCTestCase {

    func testTypeRawValuesMatchTS() {
        XCTAssertEqual(
            DailyTrainingAdjustmentType.allCases.map(\.rawValue),
            ["normal", "conservative", "deload_like", "main_only", "reduce_support",
             "substitute_risky_exercises", "rest_or_recovery"]
        )
    }

    func testChangeTypeRawValuesMatchTS() {
        XCTAssertEqual(
            DailyTrainingAdjustmentChangeType.allCases.map(\.rawValue),
            ["reduce_volume", "reduce_support", "keep_main_lifts", "substitute_exercise",
             "extend_rest", "skip_optional"]
        )
    }

    func testConfidenceRawValuesMatchTS() {
        XCTAssertEqual(
            DailyTrainingAdjustmentConfidence.allCases.map(\.rawValue),
            ["low", "medium", "high"]
        )
    }

    func testDecodeRoundTrip() throws {
        let json = """
        {
          "type": "deload_like",
          "reasons": ["readiness_low", "soreness_high"],
          "suggestedChanges": [
            { "type": "reduce_volume", "targetId": "ex-1", "code": "vol_down" },
            { "type": "keep_main_lifts", "code": "protect_main" }
          ],
          "confidence": "high",
          "requiresUserConfirmation": true
        }
        """
        let value = try JSONValue(decoding: Data(json.utf8))
        let decoded = try DailyTrainingAdjustment(decoding: value)

        XCTAssertEqual(decoded.type, .deloadLike)
        XCTAssertEqual(decoded.reasons, ["readiness_low", "soreness_high"])
        XCTAssertEqual(decoded.confidence, .high)
        XCTAssertTrue(decoded.requiresUserConfirmation)
        XCTAssertEqual(decoded.suggestedChanges.count, 2)

        XCTAssertEqual(decoded.suggestedChanges[0].type, .reduceVolume)
        XCTAssertEqual(decoded.suggestedChanges[0].targetId, "ex-1")
        XCTAssertEqual(decoded.suggestedChanges[0].code, "vol_down")

        XCTAssertEqual(decoded.suggestedChanges[1].type, .keepMainLifts)
        XCTAssertNil(decoded.suggestedChanges[1].targetId)
        XCTAssertEqual(decoded.suggestedChanges[1].code, "protect_main")
    }

    func testDecodeRejectsUnknownEnum() throws {
        let json = #"{ "type": "not_a_type", "reasons": [], "suggestedChanges": [], "confidence": "low", "requiresUserConfirmation": false }"#
        let value = try JSONValue(decoding: Data(json.utf8))
        XCTAssertThrowsError(try DailyTrainingAdjustment(decoding: value))
    }
}
