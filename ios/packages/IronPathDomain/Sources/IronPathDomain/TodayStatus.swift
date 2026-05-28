// TodayStatus — iOS-2C AppData Typed Field Activation V1.
//
// Mirrors the TypeScript `TodayStatus` interface at
// `src/models/training-model.ts:505`. iOS-3 stale-readiness guard
// reads `date`; iOS-4 today-readiness engine reads `sleep`/`energy`/
// `soreness`/`time`.

import Foundation

public struct TodayStatus: Equatable, Hashable, Sendable {
    public let date: String?
    public let sleep: String?
    public let energy: String?
    public let time: String?
    public let soreness: [String]?

    public let _unknown: OrderedJSONObject

    public static let documentedKeys: Set<String> = [
        "date", "sleep", "energy", "time", "soreness",
    ]

    public init(
        date: String? = nil,
        sleep: String? = nil,
        energy: String? = nil,
        time: String? = nil,
        soreness: [String]? = nil,
        _unknown: OrderedJSONObject = OrderedJSONObject()
    ) {
        self.date = date
        self.sleep = sleep
        self.energy = energy
        self.time = time
        self.soreness = soreness
        self._unknown = _unknown
    }

    public init(decoding value: JSONValue) throws {
        guard case .object(let obj) = value else {
            throw JSONValueError.notAnObject
        }
        self.date = obj["date"]?.stringValue
        self.sleep = obj["sleep"]?.stringValue
        self.energy = obj["energy"]?.stringValue
        self.time = obj["time"]?.stringValue
        self.soreness = obj["soreness"]?.arrayValue?.compactMap { $0.stringValue }
        self._unknown = obj.withoutKeys(Self.documentedKeys)
    }

    public func encoded() -> JSONValue {
        var typed: [OrderedJSONObject.Entry] = []
        if let v = date { typed.append(.init(key: "date", value: .string(v))) }
        if let v = sleep { typed.append(.init(key: "sleep", value: .string(v))) }
        if let v = energy { typed.append(.init(key: "energy", value: .string(v))) }
        if let v = time { typed.append(.init(key: "time", value: .string(v))) }
        if let v = soreness { typed.append(.init(key: "soreness", value: .array(v.map { .string($0) }))) }
        return .object(_unknown.appending(typed))
    }
}
