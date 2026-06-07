// TrainingSetLog — iOS-2C AppData Typed Field Activation V1.
//
// Per-set log row. iOS-3 Data Health repairs will read kg-stored
// `weight`, `actualWeightKg`, identity fields, and completion status
// directly through these typed accessors. The legacy web schema interface lives at
// `retired web reference`; the iOS-2C documented set is
// the subset needed by the iOS-3 / iOS-4 / iOS-5 unblock list.

import Foundation

public struct TrainingSetLog: Equatable, Hashable, Sendable {
    public let id: String?
    public let setIndex: NumberRepr?
    public let exerciseId: String?
    public let originalExerciseId: String?
    public let actualExerciseId: String?
    /// kg-stored planned / displayed weight (legacy web schema field name: `weight`).
    public let weight: NumberRepr?
    /// kg-stored actual weight when different from `weight`.
    public let actualWeightKg: NumberRepr?
    public let displayWeight: NumberRepr?
    public let displayUnit: WeightUnit?
    public let reps: NumberRepr?
    /// `rir` may be number or string; preserved verbatim.
    public let rir: JSONValue?
    /// `rpe` may be number or string; preserved verbatim.
    public let rpe: JSONValue?
    public let techniqueQuality: String?
    public let painFlag: Bool?
    public let painArea: String?
    public let painSeverity: NumberRepr?
    public let completedAt: String?
    public let completionStatus: String?
    public let done: Bool?

    public let _unknown: OrderedJSONObject

    public static let documentedKeys: Set<String> = [
        "id", "setIndex", "exerciseId", "originalExerciseId",
        "actualExerciseId", "weight", "actualWeightKg", "displayWeight",
        "displayUnit", "reps", "rir", "rpe", "techniqueQuality",
        "painFlag", "painArea", "painSeverity", "completedAt",
        "completionStatus", "done",
    ]

    public init(
        id: String? = nil,
        setIndex: NumberRepr? = nil,
        exerciseId: String? = nil,
        originalExerciseId: String? = nil,
        actualExerciseId: String? = nil,
        weight: NumberRepr? = nil,
        actualWeightKg: NumberRepr? = nil,
        displayWeight: NumberRepr? = nil,
        displayUnit: WeightUnit? = nil,
        reps: NumberRepr? = nil,
        rir: JSONValue? = nil,
        rpe: JSONValue? = nil,
        techniqueQuality: String? = nil,
        painFlag: Bool? = nil,
        painArea: String? = nil,
        painSeverity: NumberRepr? = nil,
        completedAt: String? = nil,
        completionStatus: String? = nil,
        done: Bool? = nil,
        _unknown: OrderedJSONObject = OrderedJSONObject()
    ) {
        self.id = id
        self.setIndex = setIndex
        self.exerciseId = exerciseId
        self.originalExerciseId = originalExerciseId
        self.actualExerciseId = actualExerciseId
        self.weight = weight
        self.actualWeightKg = actualWeightKg
        self.displayWeight = displayWeight
        self.displayUnit = displayUnit
        self.reps = reps
        self.rir = rir
        self.rpe = rpe
        self.techniqueQuality = techniqueQuality
        self.painFlag = painFlag
        self.painArea = painArea
        self.painSeverity = painSeverity
        self.completedAt = completedAt
        self.completionStatus = completionStatus
        self.done = done
        self._unknown = _unknown
    }

    public init(decoding value: JSONValue) throws {
        guard case .object(let obj) = value else {
            throw JSONValueError.notAnObject
        }
        self.id = obj["id"]?.stringValue
        self.setIndex = obj["setIndex"]?.numberValue
        self.exerciseId = obj["exerciseId"]?.stringValue
        self.originalExerciseId = obj["originalExerciseId"]?.stringValue
        self.actualExerciseId = obj["actualExerciseId"]?.stringValue
        self.weight = obj["weight"]?.numberValue
        self.actualWeightKg = obj["actualWeightKg"]?.numberValue
        self.displayWeight = obj["displayWeight"]?.numberValue
        if let s = obj["displayUnit"]?.stringValue, let unit = WeightUnit(rawValue: s) {
            self.displayUnit = unit
        } else {
            self.displayUnit = nil
        }
        self.reps = obj["reps"]?.numberValue
        self.rir = obj["rir"]
        self.rpe = obj["rpe"]
        self.techniqueQuality = obj["techniqueQuality"]?.stringValue
        self.painFlag = obj["painFlag"]?.boolValue
        self.painArea = obj["painArea"]?.stringValue
        self.painSeverity = obj["painSeverity"]?.numberValue
        self.completedAt = obj["completedAt"]?.stringValue
        self.completionStatus = obj["completionStatus"]?.stringValue
        self.done = obj["done"]?.boolValue
        self._unknown = obj.withoutKeys(Self.documentedKeys)
    }

    public func encoded() -> JSONValue {
        var typed: [OrderedJSONObject.Entry] = []
        if let v = id { typed.append(.init(key: "id", value: .string(v))) }
        if let v = setIndex { typed.append(.init(key: "setIndex", value: .number(v))) }
        if let v = exerciseId { typed.append(.init(key: "exerciseId", value: .string(v))) }
        if let v = originalExerciseId { typed.append(.init(key: "originalExerciseId", value: .string(v))) }
        if let v = actualExerciseId { typed.append(.init(key: "actualExerciseId", value: .string(v))) }
        if let v = weight { typed.append(.init(key: "weight", value: .number(v))) }
        if let v = actualWeightKg { typed.append(.init(key: "actualWeightKg", value: .number(v))) }
        if let v = displayWeight { typed.append(.init(key: "displayWeight", value: .number(v))) }
        if let v = displayUnit { typed.append(.init(key: "displayUnit", value: .string(v.rawValue))) }
        if let v = reps { typed.append(.init(key: "reps", value: .number(v))) }
        if let v = rir { typed.append(.init(key: "rir", value: v)) }
        if let v = rpe { typed.append(.init(key: "rpe", value: v)) }
        if let v = techniqueQuality { typed.append(.init(key: "techniqueQuality", value: .string(v))) }
        if let v = painFlag { typed.append(.init(key: "painFlag", value: .bool(v))) }
        if let v = painArea { typed.append(.init(key: "painArea", value: .string(v))) }
        if let v = painSeverity { typed.append(.init(key: "painSeverity", value: .number(v))) }
        if let v = completedAt { typed.append(.init(key: "completedAt", value: .string(v))) }
        if let v = completionStatus { typed.append(.init(key: "completionStatus", value: .string(v))) }
        if let v = done { typed.append(.init(key: "done", value: .bool(v))) }
        return .object(_unknown.appending(typed))
    }
}
