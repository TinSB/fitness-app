// AppSettings — iOS-2B AppData Swift Models V1.
//
// `AppSettings` is the canonical TypeScript open bag —
// `additionalProperties: true` plus a TS `[key: string]: unknown` index
// signature at `src/models/training-model.ts:1342`. Future iOS-only
// settings keys land INSIDE the bag, never as sibling Swift properties
// that would break PWA round-trip. See Contract Freeze §1 and Agent 5
// §3.7.

import Foundation

public struct AppSettings: Equatable, Hashable, Sendable {
    /// The complete settings payload. Every key — documented or
    /// future — survives round-trip via this carrier.
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
