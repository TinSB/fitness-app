// TodayStatus — iOS-2B AppData Swift Models V1.
//
// Placeholder for the TypeScript `TodayStatus` interface. iOS-4 will
// integrate this with the today-readiness decision engine.

import Foundation

public struct TodayStatus: Equatable, Hashable, Sendable {
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
