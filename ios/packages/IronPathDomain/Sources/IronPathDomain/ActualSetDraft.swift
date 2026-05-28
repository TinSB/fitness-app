// ActualSetDraft — iOS-2B AppData Swift Models V1.
//
// Placeholder for the TypeScript `ActualSetDraft` interface used
// inside Focus Mode (`src/models/training-model.ts`). iOS-5 will
// integrate this with the Focus state engine.

import Foundation

public struct ActualSetDraft: Equatable, Hashable, Sendable {
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
