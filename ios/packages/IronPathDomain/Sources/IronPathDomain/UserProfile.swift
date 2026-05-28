// UserProfile — iOS-2C AppData Typed Field Activation V1.
//
// Mirrors the TypeScript `UserProfile` interface at
// `src/models/training-model.ts:191`.

import Foundation

public struct UserProfile: Equatable, Hashable, Sendable {
    public let id: String?
    public let name: String?
    public let sex: String?
    public let age: NumberRepr?
    public let heightCm: NumberRepr?
    public let weightKg: NumberRepr?
    public let trainingLevel: String?
    public let primaryGoal: String?
    public let weeklyTrainingDays: NumberRepr?
    public let sessionDurationMin: NumberRepr?
    public let injuryFlags: [String]?
    public let painNotes: [String]?

    public let _unknown: OrderedJSONObject

    public static let documentedKeys: Set<String> = [
        "id", "name", "sex", "age", "heightCm", "weightKg",
        "trainingLevel", "primaryGoal", "weeklyTrainingDays",
        "sessionDurationMin", "injuryFlags", "painNotes",
    ]

    public init(
        id: String? = nil,
        name: String? = nil,
        sex: String? = nil,
        age: NumberRepr? = nil,
        heightCm: NumberRepr? = nil,
        weightKg: NumberRepr? = nil,
        trainingLevel: String? = nil,
        primaryGoal: String? = nil,
        weeklyTrainingDays: NumberRepr? = nil,
        sessionDurationMin: NumberRepr? = nil,
        injuryFlags: [String]? = nil,
        painNotes: [String]? = nil,
        _unknown: OrderedJSONObject = OrderedJSONObject()
    ) {
        self.id = id
        self.name = name
        self.sex = sex
        self.age = age
        self.heightCm = heightCm
        self.weightKg = weightKg
        self.trainingLevel = trainingLevel
        self.primaryGoal = primaryGoal
        self.weeklyTrainingDays = weeklyTrainingDays
        self.sessionDurationMin = sessionDurationMin
        self.injuryFlags = injuryFlags
        self.painNotes = painNotes
        self._unknown = _unknown
    }

    public init(decoding value: JSONValue) throws {
        guard case .object(let obj) = value else {
            throw JSONValueError.notAnObject
        }
        self.id = obj["id"]?.stringValue
        self.name = obj["name"]?.stringValue
        self.sex = obj["sex"]?.stringValue
        self.age = obj["age"]?.numberValue
        self.heightCm = obj["heightCm"]?.numberValue
        self.weightKg = obj["weightKg"]?.numberValue
        self.trainingLevel = obj["trainingLevel"]?.stringValue
        self.primaryGoal = obj["primaryGoal"]?.stringValue
        self.weeklyTrainingDays = obj["weeklyTrainingDays"]?.numberValue
        self.sessionDurationMin = obj["sessionDurationMin"]?.numberValue
        self.injuryFlags = obj["injuryFlags"]?.arrayValue?.compactMap { $0.stringValue }
        self.painNotes = obj["painNotes"]?.arrayValue?.compactMap { $0.stringValue }
        self._unknown = obj.withoutKeys(Self.documentedKeys)
    }

    public func encoded() -> JSONValue {
        var typed: [OrderedJSONObject.Entry] = []
        if let v = id { typed.append(.init(key: "id", value: .string(v))) }
        if let v = name { typed.append(.init(key: "name", value: .string(v))) }
        if let v = sex { typed.append(.init(key: "sex", value: .string(v))) }
        if let v = age { typed.append(.init(key: "age", value: .number(v))) }
        if let v = heightCm { typed.append(.init(key: "heightCm", value: .number(v))) }
        if let v = weightKg { typed.append(.init(key: "weightKg", value: .number(v))) }
        if let v = trainingLevel { typed.append(.init(key: "trainingLevel", value: .string(v))) }
        if let v = primaryGoal { typed.append(.init(key: "primaryGoal", value: .string(v))) }
        if let v = weeklyTrainingDays { typed.append(.init(key: "weeklyTrainingDays", value: .number(v))) }
        if let v = sessionDurationMin { typed.append(.init(key: "sessionDurationMin", value: .number(v))) }
        if let v = injuryFlags { typed.append(.init(key: "injuryFlags", value: .array(v.map { .string($0) }))) }
        if let v = painNotes { typed.append(.init(key: "painNotes", value: .array(v.map { .string($0) }))) }
        return .object(_unknown.appending(typed))
    }
}
