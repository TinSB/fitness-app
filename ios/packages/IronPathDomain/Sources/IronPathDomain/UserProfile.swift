// UserProfile — iOS-2B AppData Swift Models V1.
//
// Placeholder surface for the TypeScript `UserProfile` interface.
// iOS-2B preserves every documented and future key via `_unknown`;
// future iOS-N PRs promote typed fields.

import Foundation

public struct UserProfile: Equatable, Hashable, Sendable {
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
