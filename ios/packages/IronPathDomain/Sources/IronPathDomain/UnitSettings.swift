// UnitSettings — iOS-2B AppData Swift Models V1.
//
// Display-unit preferences. `weightUnit` is the one typed field the
// `AppDataUnitFieldPreservationTests` introspects. Storage is always
// kilograms; the model layer never coerces between units — see
// Contract Freeze §8 and Agent 5 §3.6.

import Foundation

public struct UnitSettings: Equatable, Hashable, Sendable {
    /// Display unit only. Storage is kg.
    public let weightUnit: WeightUnit?

    public let _unknown: OrderedJSONObject

    public init(
        weightUnit: WeightUnit? = nil,
        _unknown: OrderedJSONObject = OrderedJSONObject()
    ) {
        self.weightUnit = weightUnit
        self._unknown = _unknown
    }

    public init(decoding value: JSONValue) throws {
        guard case .object(let obj) = value else {
            throw JSONValueError.notAnObject
        }
        if case .string(let s) = obj["weightUnit"] ?? .null,
           let unit = WeightUnit(rawValue: s) {
            self.weightUnit = unit
        } else {
            self.weightUnit = nil
        }
        self._unknown = obj
    }
}
