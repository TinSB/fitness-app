// ScreeningProfile — iOS-2C AppData Typed Field Activation V1.
//
// Mirrors the TypeScript `ScreeningProfile` interface at
// `src/models/training-model.ts:208`. `adaptiveState` carries the
// open issueScores map and is preserved verbatim as JSONValue.

import Foundation

public struct ScreeningProfile: Equatable, Hashable, Sendable {
    public let userId: String?
    public let painTriggers: [String]?
    public let restrictedExercises: [String]?
    public let correctionPriority: [String]?
    public let postureFlags: JSONValue?
    public let movementFlags: JSONValue?
    public let adaptiveState: JSONValue?

    public let _unknown: OrderedJSONObject

    public static let documentedKeys: Set<String> = [
        "userId", "painTriggers", "restrictedExercises",
        "correctionPriority", "postureFlags", "movementFlags",
        "adaptiveState",
    ]

    public init(
        userId: String? = nil,
        painTriggers: [String]? = nil,
        restrictedExercises: [String]? = nil,
        correctionPriority: [String]? = nil,
        postureFlags: JSONValue? = nil,
        movementFlags: JSONValue? = nil,
        adaptiveState: JSONValue? = nil,
        _unknown: OrderedJSONObject = OrderedJSONObject()
    ) {
        self.userId = userId
        self.painTriggers = painTriggers
        self.restrictedExercises = restrictedExercises
        self.correctionPriority = correctionPriority
        self.postureFlags = postureFlags
        self.movementFlags = movementFlags
        self.adaptiveState = adaptiveState
        self._unknown = _unknown
    }

    public init(decoding value: JSONValue) throws {
        guard case .object(let obj) = value else {
            throw JSONValueError.notAnObject
        }
        self.userId = obj["userId"]?.stringValue
        self.painTriggers = obj["painTriggers"]?.arrayValue?.compactMap { $0.stringValue }
        self.restrictedExercises = obj["restrictedExercises"]?.arrayValue?.compactMap { $0.stringValue }
        self.correctionPriority = obj["correctionPriority"]?.arrayValue?.compactMap { $0.stringValue }
        self.postureFlags = obj["postureFlags"]
        self.movementFlags = obj["movementFlags"]
        self.adaptiveState = obj["adaptiveState"]
        self._unknown = obj.withoutKeys(Self.documentedKeys)
    }

    public func encoded() -> JSONValue {
        var typed: [OrderedJSONObject.Entry] = []
        if let v = userId { typed.append(.init(key: "userId", value: .string(v))) }
        if let v = painTriggers { typed.append(.init(key: "painTriggers", value: .array(v.map { .string($0) }))) }
        if let v = restrictedExercises { typed.append(.init(key: "restrictedExercises", value: .array(v.map { .string($0) }))) }
        if let v = correctionPriority { typed.append(.init(key: "correctionPriority", value: .array(v.map { .string($0) }))) }
        if let v = postureFlags { typed.append(.init(key: "postureFlags", value: v)) }
        if let v = movementFlags { typed.append(.init(key: "movementFlags", value: v)) }
        if let v = adaptiveState { typed.append(.init(key: "adaptiveState", value: v)) }
        return .object(_unknown.appending(typed))
    }
}
