// ProgramTemplate — iOS-2B AppData Swift Models V1.
//
// Placeholder for the TypeScript `ProgramTemplate` interface. The TS
// JSON-Schema marks the entire programTemplate object as
// `additionalProperties: true` — Agent 1 §3 row 13. The open-bag
// carrier preserves every key.

import Foundation

public struct ProgramTemplate: Equatable, Hashable, Sendable {
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
