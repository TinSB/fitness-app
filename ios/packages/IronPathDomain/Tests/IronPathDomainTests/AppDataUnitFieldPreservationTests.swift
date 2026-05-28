// AppDataUnitFieldPreservationTests — iOS-2B AppData Swift Models V1.
//
// Locks the kg-storage / lb-display-only contract from Contract
// Freeze §8 and Agent 5 §3.6. The model layer never coerces between
// units; values stored in `weight` fields are kilograms; `weightUnit`
// is display-only.

import XCTest
@testable import IronPathDomain

final class AppDataUnitFieldPreservationTests: XCTestCase {
    func testWeightUnitDecodesKg() throws {
        let json = #"{"weightUnit":"kg"}"#
        let value = try JSONValue(decoding: Data(json.utf8))
        let us = try UnitSettings(decoding: value)
        XCTAssertEqual(us.weightUnit, .kg)
    }

    func testWeightUnitDecodesLb() throws {
        let json = #"{"weightUnit":"lb"}"#
        let value = try JSONValue(decoding: Data(json.utf8))
        let us = try UnitSettings(decoding: value)
        XCTAssertEqual(us.weightUnit, .lb)
    }

    func testWeightUnitUnknownStringDecodesAsNil() throws {
        // Defensive: a future unit the Swift binary doesn't know is
        // preserved as a string in the `_unknown` bag — never coerced
        // into a default. The typed accessor returns nil; round-trip
        // still emits the original token via the open-bag carrier.
        let json = #"{"weightUnit":"st"}"#
        let value = try JSONValue(decoding: Data(json.utf8))
        let us = try UnitSettings(decoding: value)
        XCTAssertNil(us.weightUnit)
        // iOS-2C: known fields now flow through typed properties, not
        // `_unknown`. Use `UnitSettings.encoded()` to round-trip the
        // typed + unknown merge.
        let canonical = try us.encoded().canonicalJSONString()
        XCTAssertEqual(canonical, #"{"weightUnit":"st"}"#)
    }

    func testFixtureWeightUnitKgSurvivesAppDataRoundTrip() throws {
        guard let url = Bundle.module.url(
            forResource: "snapshot-hash-stable-v1-input",
            withExtension: "json",
            subdirectory: "Fixtures"
        ) else {
            XCTFail("Bundle.module missing input fixture")
            return
        }
        let data = try Data(contentsOf: url)
        let root = try JSONValue(decoding: data)
        guard case .object(let obj) = root,
              let payload = obj["payload"] else {
            XCTFail("payload missing")
            return
        }
        let appDataData = try payload.canonicalJSONData()
        let appData = try AppData(decoding: appDataData)
        let canonical = try appData.canonicalJSONString()
        // The fixture pins unitSettings.weightUnit = "kg" — round-trip
        // must preserve it verbatim.
        XCTAssertTrue(canonical.contains(#""unitSettings":{"displayUnit":"kg","weightUnit":"kg"}"#),
                      "weightUnit kg must survive round-trip canonical emit; got: \(canonical)")
    }

    func testWeightUnitEnumRawValuesAreLowercaseAlphas() {
        // The enum rawValue MUST match the TypeScript wire token
        // exactly. Any case-change would break round-trip.
        XCTAssertEqual(WeightUnit.kg.rawValue, "kg")
        XCTAssertEqual(WeightUnit.lb.rawValue, "lb")
        XCTAssertEqual(WeightUnit.allCases.count, 2)
    }

    func testWeightNumericValueDoesNotChangeOnRoundTrip() throws {
        // A representative weight (e.g. 100 kg) must round-trip as the
        // same numeric literal — no implicit kg→lb or lb→kg shift.
        let json = #"{"weightKg":100,"weightUnit":"kg"}"#
        let value = try JSONValue(decoding: Data(json.utf8))
        let canonical = try value.canonicalJSONString()
        XCTAssertEqual(canonical, #"{"weightKg":100,"weightUnit":"kg"}"#)
    }

    func testDisplayUnitAlongsideWeightUnitSurvives() throws {
        // The fixture carries both `unitSettings.weightUnit` and
        // `unitSettings.displayUnit`. Both must round-trip — the
        // typed `weightUnit` is just an extra read accessor; the
        // open-bag carrier handles displayUnit identically.
        let json = #"{"displayUnit":"lb","weightUnit":"kg"}"#
        let value = try JSONValue(decoding: Data(json.utf8))
        let us = try UnitSettings(decoding: value)
        XCTAssertEqual(us.weightUnit, .kg)
        // iOS-2C: `displayUnit` is now also typed. `encoded()` round-trips
        // both typed fields back into a single canonical JSON object.
        let reCanonical = try us.encoded().canonicalJSONString()
        XCTAssertEqual(reCanonical, #"{"displayUnit":"lb","weightUnit":"kg"}"#)
        XCTAssertEqual(us.displayUnit, .lb)
    }
}
