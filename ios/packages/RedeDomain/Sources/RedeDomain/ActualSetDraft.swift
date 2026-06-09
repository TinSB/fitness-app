// ActualSetDraft — iOS-2C AppData Typed Field Activation V1.
//
// In-flight Focus Mode set draft. iOS-3 Data Health uses these
// drafts to detect session-lifecycle residue. The documented fields
// mirror the iOS-2A plan's minimum unblock list.

import Foundation

public struct ActualSetDraft: Equatable, Hashable, Sendable {
    public let setIndex: NumberRepr?
    public let weight: NumberRepr?
    public let reps: NumberRepr?
    public let rir: JSONValue?
    public let rpe: JSONValue?
    public let exerciseId: String?
    public let source: String?
    public let completedAt: String?

    public let _unknown: OrderedJSONObject

    public static let documentedKeys: Set<String> = [
        "setIndex", "weight", "reps", "rir", "rpe",
        "exerciseId", "source", "completedAt",
    ]

    public init(
        setIndex: NumberRepr? = nil,
        weight: NumberRepr? = nil,
        reps: NumberRepr? = nil,
        rir: JSONValue? = nil,
        rpe: JSONValue? = nil,
        exerciseId: String? = nil,
        source: String? = nil,
        completedAt: String? = nil,
        _unknown: OrderedJSONObject = OrderedJSONObject()
    ) {
        self.setIndex = setIndex
        self.weight = weight
        self.reps = reps
        self.rir = rir
        self.rpe = rpe
        self.exerciseId = exerciseId
        self.source = source
        self.completedAt = completedAt
        self._unknown = _unknown
    }

    public init(decoding value: JSONValue) throws {
        guard case .object(let obj) = value else {
            throw JSONValueError.notAnObject
        }
        self.setIndex = obj["setIndex"]?.numberValue
        self.weight = obj["weight"]?.numberValue
        self.reps = obj["reps"]?.numberValue
        self.rir = obj["rir"]
        self.rpe = obj["rpe"]
        self.exerciseId = obj["exerciseId"]?.stringValue
        self.source = obj["source"]?.stringValue
        self.completedAt = obj["completedAt"]?.stringValue
        self._unknown = obj.withoutKeys(Self.documentedKeys)
    }

    public func encoded() -> JSONValue {
        var typed: [OrderedJSONObject.Entry] = []
        if let v = setIndex { typed.append(.init(key: "setIndex", value: .number(v))) }
        if let v = weight { typed.append(.init(key: "weight", value: .number(v))) }
        if let v = reps { typed.append(.init(key: "reps", value: .number(v))) }
        if let v = rir { typed.append(.init(key: "rir", value: v)) }
        if let v = rpe { typed.append(.init(key: "rpe", value: v)) }
        if let v = exerciseId { typed.append(.init(key: "exerciseId", value: .string(v))) }
        if let v = source { typed.append(.init(key: "source", value: .string(v))) }
        if let v = completedAt { typed.append(.init(key: "completedAt", value: .string(v))) }
        return .object(_unknown.appending(typed))
    }
}
