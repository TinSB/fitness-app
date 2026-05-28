// ScreeningProfile — iOS-2B AppData Swift Models V1.
//
// Placeholder for the TypeScript `ScreeningProfile` interface
// (questionnaire + adaptive state + issue scores). The TS schema
// marks `adaptiveState.issueScores` as an open `[key: string]: number`
// map; the open-bag carrier preserves it.

import Foundation

public struct ScreeningProfile: Equatable, Hashable, Sendable {
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
