// AdaptiveCalibrationState — iOS-2C AppData Typed Field Activation V1.
//
// Mirrors the TypeScript `AdaptiveCalibrationState` interface at
// `src/models/training-model.ts:618`. Inner `AdaptiveCalibrationEntry`
// records carry the per-exercise `loadBias: number` field flagged
// by Agent 1 §7 as a HIGH float-precision risk. iOS-2C exposes the
// `entries` array as `[JSONValue]` so iOS-4 can iterate; promoting
// each entry to a typed `AdaptiveCalibrationEntry` struct is deferred.
//
// The redacted real export (preflight result) carries no
// `adaptiveCalibration` block, so float-precision verification is
// performed via a synthetic test fixture inline in
// `AppDataNumberPrecisionTests.swift` if the iOS-2C V1 NumberRepr
// is found insufficient.

import Foundation

public struct AdaptiveCalibrationState: Equatable, Hashable, Sendable {
    public let version: NumberRepr?
    public let lastUpdated: String?
    public let entries: [JSONValue]?
    public let recommendationLog: [JSONValue]?

    public let _unknown: OrderedJSONObject

    public static let documentedKeys: Set<String> = [
        "version", "lastUpdated", "entries", "recommendationLog",
    ]

    public init(
        version: NumberRepr? = nil,
        lastUpdated: String? = nil,
        entries: [JSONValue]? = nil,
        recommendationLog: [JSONValue]? = nil,
        _unknown: OrderedJSONObject = OrderedJSONObject()
    ) {
        self.version = version
        self.lastUpdated = lastUpdated
        self.entries = entries
        self.recommendationLog = recommendationLog
        self._unknown = _unknown
    }

    public init(decoding value: JSONValue) throws {
        guard case .object(let obj) = value else {
            throw JSONValueError.notAnObject
        }
        self.version = obj["version"]?.numberValue
        self.lastUpdated = obj["lastUpdated"]?.stringValue
        self.entries = obj["entries"]?.arrayValue
        self.recommendationLog = obj["recommendationLog"]?.arrayValue
        self._unknown = obj.withoutKeys(Self.documentedKeys)
    }

    public func encoded() -> JSONValue {
        var typed: [OrderedJSONObject.Entry] = []
        if let v = version { typed.append(.init(key: "version", value: .number(v))) }
        if let v = lastUpdated { typed.append(.init(key: "lastUpdated", value: .string(v))) }
        if let v = entries { typed.append(.init(key: "entries", value: .array(v))) }
        if let v = recommendationLog { typed.append(.init(key: "recommendationLog", value: .array(v))) }
        return .object(_unknown.appending(typed))
    }
}
