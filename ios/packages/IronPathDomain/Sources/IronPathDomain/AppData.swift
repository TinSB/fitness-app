// AppData — iOS-2B AppData Swift Models V1.
//
// The top-level IronPath data structure. iOS-2B installs the
// schemaVersion guard, the full-tree open-bag carrier (`root`), and
// the canonical re-emit hook. iOS-3 will land the on-disk
// `AppDataStore` protocol and wire decode/encode to the file system.
//
// Design summary (iOS-2A plan §11):
//
// * `schemaVersion` is decoded explicitly so the refusal contract
//   (Agent 5 §3.5) fires at the earliest possible point.
// * The full top-level object — including `schemaVersion` — is held
//   verbatim in `root: OrderedJSONObject`. This preserves all
//   unknown future keys at every nesting level for free, because
//   the carrier never collapses unknown nested objects into typed
//   model values in iOS-2B.
// * `canonicalJSONData()` re-emits via the canonical-stringify path
//   in JSONValue.swift, matching the TS `stableStringify` rules at
//   `src/cloudProduction/accountBoundaryLocalInventory.ts:116`.
//
// What iOS-2B does NOT do:
//
// * No on-disk persistence (iOS-3).
// * No repair / sanitize logic (iOS-3).
// * No engine wiring (iOS-4 / iOS-5).
// * No cloud upload (iOS-7).

import Foundation

public struct AppData: Equatable, Hashable, Sendable {
    /// Validated schema version. Always equals `SchemaVersion.current`
    /// for a successfully-decoded `AppData` — any other value would
    /// have thrown at `init(decoding:)` time.
    public let schemaVersion: SchemaVersion

    /// The full top-level AppData object as parsed from JSON,
    /// including `schemaVersion`. Source of truth for round-trip and
    /// future typed-field promotion.
    public let root: OrderedJSONObject

    public init(schemaVersion: SchemaVersion, root: OrderedJSONObject) {
        self.schemaVersion = schemaVersion
        self.root = root
    }

    /// Parses the given JSON bytes into an `AppData`. Throws
    /// `SchemaVersionError.upgradeRequired` if the payload is older
    /// than `SchemaVersion.current`, or
    /// `SchemaVersionError.futureIncompatible` if it is newer.
    public init(decoding data: Data) throws {
        let parsed = try JSONValue(decoding: data)
        guard case .object(let obj) = parsed else {
            throw JSONValueError.notAnObject
        }
        guard let raw = obj["schemaVersion"] else {
            throw SchemaVersionError.missingOrInvalid
        }
        let found = try AppData.extractInt(from: raw)
        self.schemaVersion = try SchemaVersion.validate(found: found)
        self.root = obj
    }

    /// Emits the canonical-stringified bytes of this AppData, with
    /// every object key lexically sorted. Matches the TS
    /// `stableStringify` contract used to compute the FNV-1a snapshot
    /// hash at `src/cloudProduction/accountBoundaryLocalInventory.ts:156`.
    public func canonicalJSONData() throws -> Data {
        try JSONValue.object(root).canonicalJSONData()
    }

    /// Same as `canonicalJSONData()` but returns a UTF-8 `String`.
    public func canonicalJSONString() throws -> String {
        try String(decoding: canonicalJSONData(), as: UTF8.self)
    }

    /// Extracts a strict-integer value out of a `JSONValue`. Accepts
    /// `.number(.integer)` natively; accepts `.number(.decimal)` only
    /// when the underlying Decimal is whole. Throws on anything else.
    private static func extractInt(from value: JSONValue) throws -> Int {
        switch value {
        case .number(.integer(let i)):
            return Int(i)
        case .number(.decimal(let d)):
            var rounded = Decimal()
            var copy = d
            NSDecimalRound(&rounded, &copy, 0, .down)
            if rounded == d {
                return NSDecimalNumber(decimal: rounded).intValue
            }
            throw SchemaVersionError.missingOrInvalid
        default:
            throw SchemaVersionError.missingOrInvalid
        }
    }
}
