// AdaptiveCalibrationState — iOS-2B AppData Swift Models V1.
//
// Placeholder for the TypeScript `AdaptiveCalibrationState` interface.
// Agent 1 §7 flagged this as HIGH float-precision risk
// (`loadBias`, `loadDeltaRatio`). iOS-2B preserves the values
// verbatim via the open-bag carrier; canonical re-emit via
// JSONValue.canonicalJSONData() drops trailing zeros, matching TS
// `JSON.stringify` semantics.

import Foundation

public struct AdaptiveCalibrationState: Equatable, Hashable, Sendable {
    public let _unknown: OrderedJSONObject

    public init(_unknown: OrderedJSONObject = OrderedJSONObject()) {
        self._unknown = _unknown
    }

    public init(decoding value: JSONValue) throws {
        guard case .object(let obj) = value else {
            throw JSONValueError.notAnObject
        }
        self._unknown = obj
    }
}
