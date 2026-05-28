// MesocyclePlan — iOS-2C AppData Typed Field Activation V1.
//
// Mirrors the TypeScript `MesocyclePlan` interface at
// `src/models/training-model.ts:1313`. The inner weekly structures
// stay as `JSONValue` until iOS-4 TrainingDecision needs typed
// access; iOS-2C only needs id / startDate / weeks to enable
// iOS-3 / iOS-4 dispatch.

import Foundation

public struct MesocyclePlan: Equatable, Hashable, Sendable {
    public let id: String?
    public let startDate: String?
    public let endDate: String?
    public let phase: String?
    public let weeks: JSONValue?

    public let _unknown: OrderedJSONObject

    public static let documentedKeys: Set<String> = [
        "id", "startDate", "endDate", "phase", "weeks",
    ]

    public init(
        id: String? = nil,
        startDate: String? = nil,
        endDate: String? = nil,
        phase: String? = nil,
        weeks: JSONValue? = nil,
        _unknown: OrderedJSONObject = OrderedJSONObject()
    ) {
        self.id = id
        self.startDate = startDate
        self.endDate = endDate
        self.phase = phase
        self.weeks = weeks
        self._unknown = _unknown
    }

    public init(decoding value: JSONValue) throws {
        guard case .object(let obj) = value else {
            throw JSONValueError.notAnObject
        }
        self.id = obj["id"]?.stringValue
        self.startDate = obj["startDate"]?.stringValue
        self.endDate = obj["endDate"]?.stringValue
        self.phase = obj["phase"]?.stringValue
        self.weeks = obj["weeks"]
        self._unknown = obj.withoutKeys(Self.documentedKeys)
    }

    public func encoded() -> JSONValue {
        var typed: [OrderedJSONObject.Entry] = []
        if let v = id { typed.append(.init(key: "id", value: .string(v))) }
        if let v = startDate { typed.append(.init(key: "startDate", value: .string(v))) }
        if let v = endDate { typed.append(.init(key: "endDate", value: .string(v))) }
        if let v = phase { typed.append(.init(key: "phase", value: .string(v))) }
        if let v = weeks { typed.append(.init(key: "weeks", value: v)) }
        return .object(_unknown.appending(typed))
    }
}
