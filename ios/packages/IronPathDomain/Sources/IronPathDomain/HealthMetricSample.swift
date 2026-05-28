// HealthMetricSample — iOS-2B AppData Swift Models V1.
//
// Placeholder for the TypeScript `HealthMetricSample` interface.
// Agent 1 §3 row 16 flagged this as HIGH risk: the schema declares
// `raw: unknown` — the most permissive open-bag in the entire model.
// iOS-2B's `raw` accessor surfaces the imported Apple Health payload
// verbatim as a `JSONValue`. iOS-8 will integrate the live-read
// HealthKit adapter; iOS-2B only preserves the imported data shape.
//
// Timestamp fields on the underlying record (startDate, endDate,
// importedAt) are String in the carrier, never Date — see Agent 5
// §3.3.

import Foundation

public struct HealthMetricSample: Equatable, Hashable, Sendable {
    /// The opaque Apple-Health payload preserved from import. iOS-2B
    /// does not interpret its shape; the parity test asserts it
    /// round-trips byte-equal.
    public let raw: JSONValue?

    public let _unknown: OrderedJSONObject

    public init(
        raw: JSONValue? = nil,
        _unknown: OrderedJSONObject = OrderedJSONObject()
    ) {
        self.raw = raw
        self._unknown = _unknown
    }

    public init(decoding value: JSONValue) throws {
        guard case .object(let obj) = value else {
            throw JSONValueError.notAnObject
        }
        self.raw = obj["raw"]
        self._unknown = obj
    }
}
