// ExercisePrescription — iOS-2C AppData Typed Field Activation V1.
//
// The prescribed exercise inside a TrainingSession. iOS-5 Focus Mode
// reads `sets` and `warmupSets`; iOS-3 Data Health reads identity
// (`id`, `actualExerciseId`, `originalExerciseId`) for the
// `legacyReplacementIdentityPollution` repair recipe. The legacy web schema
// interface lives at `retired web reference`.

import Foundation

public struct ExercisePrescription: Equatable, Hashable, Sendable {
    public let id: String?
    public let exerciseId: String?
    public let name: String?
    public let originalExerciseId: String?
    public let actualExerciseId: String?
    public let displayExerciseId: String?
    public let recordExerciseId: String?
    /// kg-stored working sets — the source of truth for the recorded
    /// session. Identity fields on each set carry the replacement
    /// audit trail.
    public let sets: [TrainingSetLog]?
    /// Optional warmup sets (iOS-5 Focus Mode reads these).
    public let warmupSets: [TrainingSetLog]?
    public let plannedSets: NumberRepr?
    public let prescription: JSONValue?
    public let suggestion: String?
    public let adjustment: String?
    public let warning: String?
    public let explanations: [String]?

    public let _unknown: OrderedJSONObject

    public static let documentedKeys: Set<String> = [
        "id", "exerciseId", "name", "originalExerciseId",
        "actualExerciseId", "displayExerciseId", "recordExerciseId",
        "sets", "warmupSets", "plannedSets", "prescription",
        "suggestion", "adjustment", "warning", "explanations",
    ]

    public init(
        id: String? = nil,
        exerciseId: String? = nil,
        name: String? = nil,
        originalExerciseId: String? = nil,
        actualExerciseId: String? = nil,
        displayExerciseId: String? = nil,
        recordExerciseId: String? = nil,
        sets: [TrainingSetLog]? = nil,
        warmupSets: [TrainingSetLog]? = nil,
        plannedSets: NumberRepr? = nil,
        prescription: JSONValue? = nil,
        suggestion: String? = nil,
        adjustment: String? = nil,
        warning: String? = nil,
        explanations: [String]? = nil,
        _unknown: OrderedJSONObject = OrderedJSONObject()
    ) {
        self.id = id
        self.exerciseId = exerciseId
        self.name = name
        self.originalExerciseId = originalExerciseId
        self.actualExerciseId = actualExerciseId
        self.displayExerciseId = displayExerciseId
        self.recordExerciseId = recordExerciseId
        self.sets = sets
        self.warmupSets = warmupSets
        self.plannedSets = plannedSets
        self.prescription = prescription
        self.suggestion = suggestion
        self.adjustment = adjustment
        self.warning = warning
        self.explanations = explanations
        self._unknown = _unknown
    }

    public init(decoding value: JSONValue) throws {
        guard case .object(let obj) = value else {
            throw JSONValueError.notAnObject
        }
        self.id = obj["id"]?.stringValue
        self.exerciseId = obj["exerciseId"]?.stringValue
        self.name = obj["name"]?.stringValue
        self.originalExerciseId = obj["originalExerciseId"]?.stringValue
        self.actualExerciseId = obj["actualExerciseId"]?.stringValue
        self.displayExerciseId = obj["displayExerciseId"]?.stringValue
        self.recordExerciseId = obj["recordExerciseId"]?.stringValue
        // `sets` may legitimately be either an integer (the prescribed
        // count from a TrainingTemplate) or an array of TrainingSetLog
        // (the runtime sessions/history shape). Decode array form here;
        // integer form passes through `_unknown` so round-trip survives.
        if let arr = obj["sets"]?.arrayValue {
            self.sets = try arr.map { try TrainingSetLog(decoding: $0) }
        } else {
            self.sets = nil
        }
        if let arr = obj["warmupSets"]?.arrayValue {
            self.warmupSets = try arr.map { try TrainingSetLog(decoding: $0) }
        } else {
            self.warmupSets = nil
        }
        self.plannedSets = obj["plannedSets"]?.numberValue
        self.prescription = obj["prescription"]
        self.suggestion = obj["suggestion"]?.stringValue
        self.adjustment = obj["adjustment"]?.stringValue
        self.warning = obj["warning"]?.stringValue
        if let arr = obj["explanations"]?.arrayValue {
            self.explanations = arr.compactMap { $0.stringValue }
        } else {
            self.explanations = nil
        }
        // `sets` integer form (TrainingTemplate exercise) needs to flow
        // through `_unknown` so canonical round-trip survives. Detect
        // and forward when present.
        var documented = Self.documentedKeys
        if let v = obj["sets"], v.arrayValue == nil {
            documented.remove("sets")
        }
        self._unknown = obj.withoutKeys(documented)
    }

    public func encoded() -> JSONValue {
        var typed: [OrderedJSONObject.Entry] = []
        if let v = id { typed.append(.init(key: "id", value: .string(v))) }
        if let v = exerciseId { typed.append(.init(key: "exerciseId", value: .string(v))) }
        if let v = name { typed.append(.init(key: "name", value: .string(v))) }
        if let v = originalExerciseId { typed.append(.init(key: "originalExerciseId", value: .string(v))) }
        if let v = actualExerciseId { typed.append(.init(key: "actualExerciseId", value: .string(v))) }
        if let v = displayExerciseId { typed.append(.init(key: "displayExerciseId", value: .string(v))) }
        if let v = recordExerciseId { typed.append(.init(key: "recordExerciseId", value: .string(v))) }
        if let v = sets {
            typed.append(.init(key: "sets", value: .array(v.map { $0.encoded() })))
        }
        if let v = warmupSets {
            typed.append(.init(key: "warmupSets", value: .array(v.map { $0.encoded() })))
        }
        if let v = plannedSets { typed.append(.init(key: "plannedSets", value: .number(v))) }
        if let v = prescription { typed.append(.init(key: "prescription", value: v)) }
        if let v = suggestion { typed.append(.init(key: "suggestion", value: .string(v))) }
        if let v = adjustment { typed.append(.init(key: "adjustment", value: .string(v))) }
        if let v = warning { typed.append(.init(key: "warning", value: .string(v))) }
        if let v = explanations {
            typed.append(.init(key: "explanations", value: .array(v.map { .string($0) })))
        }
        return .object(_unknown.appending(typed))
    }
}
