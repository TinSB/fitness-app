// UnitSettingsEditTests — EDIT-2 Unit Settings (display unit) Edit V1.
//
// REAL unit tests for the pure unit-settings-edit helpers used by the SECOND native
// canonical-AppData EDIT (reusing EDIT-1's sanctioned edit-write boundary, §8.3):
//   * UnitSettings.withDisplayUnit — replaces ONLY the display-unit preference,
//     preserves the typed weightUnit + the open bag (_unknown)
//   * AppData.withUpdatedUnitSettings — rewrites ONLY the `unitSettings` key,
//     preserves every other top-level key + unknown fields, never bumps
//     schemaVersion, is a pure value transform (no IO), round-trips through
//     canonical bytes
//   * the edit changes ONLY the DISPLAY preference — no stored weight value (kg) is
//     ever coerced, and neither healthMetricSamples NOR history is touched
//
// Run via `swift test`. Deterministic; never touches disk/network.

import XCTest
@testable import IronPathDomain

final class UnitSettingsEditTests: XCTestCase {

    // MARK: - UnitSettings.withDisplayUnit

    func testWithDisplayUnitReplacesDisplayUnitAndPreservesWeightUnitAndOpenBag() {
        let original = UnitSettings(
            weightUnit: .kg,
            displayUnit: .kg,
            _unknown: OrderedJSONObject(entries: [
                .init(key: "lengthUnit", value: .string("cm")),
            ])
        )

        let edited = original.withDisplayUnit(.lb)

        // The display preference is replaced…
        XCTAssertEqual(edited.displayUnit, .lb)
        // …while weightUnit (the typed non-edited field) and the open bag survive.
        XCTAssertEqual(edited.weightUnit, .kg)
        XCTAssertEqual(edited._unknown["lengthUnit"]?.stringValue, "cm")
    }

    func testWithDisplayUnitNilWritesHonestUnsetAndKeepsTheRest() throws {
        let original = UnitSettings(
            weightUnit: .kg,
            displayUnit: .lb,
            _unknown: OrderedJSONObject(entries: [
                .init(key: "lengthUnit", value: .string("cm")),
            ])
        )
        let edited = original.withDisplayUnit(nil)
        XCTAssertNil(edited.displayUnit)
        // weightUnit + open bag still preserved.
        XCTAssertEqual(edited.weightUnit, .kg)
        XCTAssertEqual(edited._unknown["lengthUnit"]?.stringValue, "cm")
        // Encoded form OMITS the now-nil displayUnit (honest "not set"), never a default.
        let canonical = try edited.encoded().canonicalJSONString()
        XCTAssertFalse(canonical.contains("displayUnit"), "nil displayUnit must be omitted, got: \(canonical)")
        XCTAssertTrue(canonical.contains("\"weightUnit\":\"kg\""))
        XCTAssertTrue(canonical.contains("\"lengthUnit\":\"cm\""))
    }

    // MARK: - AppData.withUpdatedUnitSettings (open-bag preserving)

    func testWithUpdatedUnitSettingsRewritesOnlyUnitSettingsAndPreservesOpenBag() throws {
        // A document with unit settings (carrying their own unknown key), plus a
        // profile, history, settings, and a top-level unknown future key.
        let json = """
        {"schemaVersion":8,\
        "unitSettings":{"displayUnit":"kg","weightUnit":"kg","lengthUnit":"cm"},\
        "userProfile":{"id":"u1","name":"老王","weightKg":80},\
        "history":[{"id":"old","completed":true}],\
        "settings":{"trainingMode":"auto"},\
        "futureUnknownKey":{"nested":[1,2,3]}}
        """
        let appData = try AppData(decoding: Data(json.utf8))

        let edited = appData.withUpdatedUnitSettings(appData.unitSettings.withDisplayUnit(.lb))

        // unitSettings rewritten with the new display preference.
        XCTAssertEqual(edited.unitSettings.displayUnit, .lb)
        // The unit settings' own weightUnit + open-bag key survive the edit.
        XCTAssertEqual(edited.unitSettings.weightUnit, .kg)
        XCTAssertEqual(edited.unitSettings._unknown["lengthUnit"]?.stringValue, "cm")
        // schemaVersion unchanged (an edit is not a schema change).
        XCTAssertEqual(edited.schemaVersion, .current)
        // Every other top-level key + the top-level unknown survive verbatim.
        XCTAssertEqual(edited.userProfile.name, "老王")
        XCTAssertEqual(edited.userProfile.weightKg?.doubleValue ?? -1, 80, accuracy: 1e-9)
        XCTAssertEqual(edited.history.count, 1)
        XCTAssertEqual(edited.history.first?.id, "old")
        let canonical = try edited.canonicalJSONString()
        XCTAssertTrue(canonical.contains("futureUnknownKey"), "top-level unknown dropped: \(canonical)")
        XCTAssertTrue(canonical.contains("\"nested\":[1,2,3]"), "nested unknown lost")
        XCTAssertTrue(canonical.contains("\"trainingMode\":\"auto\""), "settings lost: \(canonical)")
        XCTAssertTrue(canonical.contains("\"lengthUnit\":\"cm\""), "unit open-bag lost: \(canonical)")
        // The edited unitSettings emits sorted (displayUnit, lengthUnit, weightUnit).
        XCTAssertTrue(
            canonical.contains("\"unitSettings\":{\"displayUnit\":\"lb\",\"lengthUnit\":\"cm\",\"weightUnit\":\"kg\"}"),
            "unitSettings canonical form unexpected: \(canonical)"
        )
        // Re-decodes cleanly (valid canonical document).
        let reDecoded = try AppData(decoding: edited.canonicalJSONData())
        XCTAssertEqual(reDecoded.unitSettings.displayUnit, .lb)
        XCTAssertEqual(reDecoded.unitSettings.weightUnit, .kg)
    }

    func testWithUpdatedUnitSettingsAddsKeyWhenAbsent() throws {
        let appData = AppData.emptyCurrent()   // {"schemaVersion":8,"history":[]} — no unitSettings
        let next = appData.withUpdatedUnitSettings(UnitSettings(displayUnit: .lb))
        XCTAssertEqual(next.unitSettings.displayUnit, .lb)
        // history still present + empty; schema unchanged.
        XCTAssertTrue(next.history.isEmpty)
        XCTAssertEqual(next.schemaVersion, .current)
        _ = try next.canonicalJSONData()   // round-trips
    }

    func testWithUpdatedUnitSettingsDoesNotMutateReceiver() throws {
        let json = """
        {"schemaVersion":8,"unitSettings":{"displayUnit":"kg"}}
        """
        let appData = try AppData(decoding: Data(json.utf8))
        _ = appData.withUpdatedUnitSettings(UnitSettings(displayUnit: .lb))
        // Value semantics: the original is untouched.
        XCTAssertEqual(appData.unitSettings.displayUnit, .kg)
    }

    // MARK: - Display preference only — stored weight (kg) is never coerced

    func testEditChangesDisplayPreferenceOnlyAndTouchesNoStoredWeight() throws {
        let json = """
        {"schemaVersion":8,\
        "unitSettings":{"displayUnit":"kg","weightUnit":"kg"},\
        "userProfile":{"name":"老王","weightKg":80},\
        "healthMetricSamples":[{"id":"h1","metricType":"body_weight","unit":"kg","value":72.5,"startDate":"2026-05-27T06:30:00.000Z"}],\
        "history":[{"id":"s1","completed":true}]}
        """
        let appData = try AppData(decoding: Data(json.utf8))

        // Flip ONLY the display unit to lb.
        let next = appData.withUpdatedUnitSettings(appData.unitSettings.withDisplayUnit(.lb))

        // Display preference changed…
        XCTAssertEqual(next.unitSettings.displayUnit, .lb)
        // …but the self-entered weight is still kg-stored, numerically unchanged.
        XCTAssertEqual(next.userProfile.weightKg?.doubleValue ?? -1, 80, accuracy: 1e-9)
        // …the Apple-Health-derived sample is untouched (kg, same value)…
        XCTAssertEqual(next.healthMetricSamples.count, 1)
        XCTAssertEqual(next.healthMetricSamples.first?.unit, "kg")
        XCTAssertEqual(next.healthMetricSamples.first?.value?.doubleValue ?? -1, 72.5, accuracy: 1e-9)
        // …and history is untouched.
        XCTAssertEqual(next.history.count, 1)
        XCTAssertEqual(next.history.first?.id, "s1")
    }

    func testDisplayUnitRoundTripKgToLbAndBack() throws {
        let appData = try AppData(decoding: Data(#"{"schemaVersion":8,"unitSettings":{"weightUnit":"kg"}}"#.utf8))
        let toLb = appData.withUpdatedUnitSettings(appData.unitSettings.withDisplayUnit(.lb))
        XCTAssertEqual(toLb.unitSettings.displayUnit, .lb)
        let backToKg = toLb.withUpdatedUnitSettings(toLb.unitSettings.withDisplayUnit(.kg))
        XCTAssertEqual(backToKg.unitSettings.displayUnit, .kg)
        // weightUnit preserved through both flips.
        XCTAssertEqual(backToKg.unitSettings.weightUnit, .kg)
    }
}
