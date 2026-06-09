// UnitSettings — iOS-2C AppData Typed Field Activation V1.
//
// iOS-2B added `weightUnit`; iOS-2C adds `displayUnit` (carried as
// `WeightUnit` enum). Storage is always kilograms — see Contract
// Freeze §8 and Agent 5 §3.6. The model layer never coerces between
// units; the iOS-5+ view layer formats values for display.

import Foundation

public struct UnitSettings: Equatable, Hashable, Sendable {
    /// Display unit only. Storage is kg.
    public let weightUnit: WeightUnit?
    public let displayUnit: WeightUnit?

    public let _unknown: OrderedJSONObject

    public static let documentedKeys: Set<String> = [
        "weightUnit", "displayUnit",
    ]

    public init(
        weightUnit: WeightUnit? = nil,
        displayUnit: WeightUnit? = nil,
        _unknown: OrderedJSONObject = OrderedJSONObject()
    ) {
        self.weightUnit = weightUnit
        self.displayUnit = displayUnit
        self._unknown = _unknown
    }

    public init(decoding value: JSONValue) throws {
        guard case .object(let obj) = value else {
            throw JSONValueError.notAnObject
        }
        // Preserve unrecognized enum tokens: only exclude a key from
        // `_unknown` when the typed enum case parses cleanly. An
        // unknown future token like `weightUnit: "st"` stays in the
        // bag so the round-trip emits the original string verbatim.
        var extracted: Set<String> = []
        if let s = obj["weightUnit"]?.stringValue, let unit = WeightUnit(rawValue: s) {
            self.weightUnit = unit
            extracted.insert("weightUnit")
        } else {
            self.weightUnit = nil
        }
        if let s = obj["displayUnit"]?.stringValue, let unit = WeightUnit(rawValue: s) {
            self.displayUnit = unit
            extracted.insert("displayUnit")
        } else {
            self.displayUnit = nil
        }
        self._unknown = obj.withoutKeys(extracted)
    }

    public func encoded() -> JSONValue {
        var typed: [OrderedJSONObject.Entry] = []
        if let v = weightUnit { typed.append(.init(key: "weightUnit", value: .string(v.rawValue))) }
        if let v = displayUnit { typed.append(.init(key: "displayUnit", value: .string(v.rawValue))) }
        return .object(_unknown.appending(typed))
    }
}
