// PA-S3 — Support-module carrier types (pure data carrier value types).
//
// Faithful Swift mirror of the FOUR legacy web implementation support-module types that the
// CORRECTION_MODULES / FUNCTIONAL_ADDONS data constants (SupportModules.swift)
// are typed with:
//
//   retired-web-reference  CorrectionExercise -> CorrectionExercise
//   retired-web-reference  FunctionalExercise -> FunctionalExercise
//   retired-web-reference  CorrectionModule   -> CorrectionModule
//   retired-web-reference  FunctionalAddon    -> FunctionalAddon
//
// WHY HERE (RedeTrainingDecision), NOT RedeDomain (the PA-S3 D-gap
// judgement — see the PR body):
//   • These types are NOT part of the PA-S1 PA-domain type family (that slice
//     ported a closed, enumerated list of engine-foundation types — DayTemplate
//     / ExerciseTemplate / TrainingTemplate / the programAdjustment cluster —
//     none of which reference these). They were not "missed"; they are simply
//     out of that slice's scope.
//   • Every legacy web schema consumer of CorrectionModule / FunctionalAddon is an ENGINE
//     (supportPlanEngine.ts, programAdjustmentEngine.ts — both TrainingDecision-
//     layer when ported) or legacy web UI (out of scope). NONE is in RedeDomain,
//     so they are not shared-vocabulary domain types.
//   • They are the MINIMAL DIRECT CARRIER of this slice's CORRECTION_MODULES /
//     FUNCTIONAL_ADDONS data, which (hard constraint) lands in
//     RedeTrainingDecision. Co-locating the carrier with its only data
//     instance, as a LOCAL TrainingDecision value type, mirrors the existing
//     `ReplacementEngineKnowledge.ReplacementKnowledgeEntry` precedent.
//
// FIELD-TYPE RULES (the PA-S1 precedent):
//   • string-union fields (targetIssue: CorrectionIssue / stage: CorrectionStage
//     / insertionStage / doseStrategy: SupportDoseStrategy / dose:
//     CorrectionDoseLevel / targetAbility: FunctionalAbility / insertionRule:
//     FunctionalInsertionRule) -> `String` (lossless for an unknown future
//     member — the `ProgramTemplate.primaryGoal` precedent).
//   • number -> `Int` (every numeric field in the data is integer-valued;
//     emitted as NumberRepr.integer so JSON matches the legacy web schema JSON.stringify).
//   • `encoded()` omits any nil/absent optional field, exactly reproducing the
//     legacy web schema object-literal key presence (an `undefined` field is dropped by
//     JSON.stringify).
//
// Pure value types: no runtime logic, no write path, no `: Date`, no clock.

import Foundation
import RedeDomain

/// One element of a `CorrectionModule.exercises` array.
/// Mirrors the anonymous legacy web schema type at `retired web reference`.
public struct CorrectionExercise: Equatable, Sendable {
    public let exerciseId: String      // legacy web schema: `exerciseId: string` (required)
    public let name: String?           // legacy web schema: `name?: string`
    public let sets: Int               // legacy web schema: `sets: number` (required)
    public let repMin: Int             // legacy web schema: `repMin: number` (required)
    public let repMax: Int             // legacy web schema: `repMax: number` (required)
    public let holdSec: Int?           // legacy web schema: `holdSec?: number`
    public let restSec: Int?           // legacy web schema: `restSec?: number`
    public let cue: String?            // legacy web schema: `cue?: string`

    public init(
        exerciseId: String,
        name: String? = nil,
        sets: Int,
        repMin: Int,
        repMax: Int,
        holdSec: Int? = nil,
        restSec: Int? = nil,
        cue: String? = nil
    ) {
        self.exerciseId = exerciseId
        self.name = name
        self.sets = sets
        self.repMin = repMin
        self.repMax = repMax
        self.holdSec = holdSec
        self.restSec = restSec
        self.cue = cue
    }

    public func encoded() -> JSONValue {
        var e: [OrderedJSONObject.Entry] = []
        e.append(.init(key: "exerciseId", value: .string(exerciseId)))
        if let name { e.append(.init(key: "name", value: .string(name))) }
        e.append(.init(key: "sets", value: .number(.integer(Int64(sets)))))
        e.append(.init(key: "repMin", value: .number(.integer(Int64(repMin)))))
        e.append(.init(key: "repMax", value: .number(.integer(Int64(repMax)))))
        if let holdSec { e.append(.init(key: "holdSec", value: .number(.integer(Int64(holdSec))))) }
        if let restSec { e.append(.init(key: "restSec", value: .number(.integer(Int64(restSec))))) }
        if let cue { e.append(.init(key: "cue", value: .string(cue))) }
        return .object(OrderedJSONObject(entries: e))
    }
}

/// One element of a `FunctionalAddon.exercises` array.
/// Mirrors the anonymous legacy web schema type at `retired web reference`.
public struct FunctionalExercise: Equatable, Sendable {
    public let exerciseId: String      // legacy web schema: `exerciseId: string` (required)
    public let name: String?           // legacy web schema: `name?: string`
    public let sets: Int               // legacy web schema: `sets: number` (required)
    public let repMin: Int?            // legacy web schema: `repMin?: number`
    public let repMax: Int?            // legacy web schema: `repMax?: number`
    public let distanceM: Int?         // legacy web schema: `distanceM?: number`
    public let timeSec: Int?           // legacy web schema: `timeSec?: number`
    public let holdSec: Int?           // legacy web schema: `holdSec?: number`
    public let restSec: Int?           // legacy web schema: `restSec?: number`
    public let cue: String?            // legacy web schema: `cue?: string`

    public init(
        exerciseId: String,
        name: String? = nil,
        sets: Int,
        repMin: Int? = nil,
        repMax: Int? = nil,
        distanceM: Int? = nil,
        timeSec: Int? = nil,
        holdSec: Int? = nil,
        restSec: Int? = nil,
        cue: String? = nil
    ) {
        self.exerciseId = exerciseId
        self.name = name
        self.sets = sets
        self.repMin = repMin
        self.repMax = repMax
        self.distanceM = distanceM
        self.timeSec = timeSec
        self.holdSec = holdSec
        self.restSec = restSec
        self.cue = cue
    }

    public func encoded() -> JSONValue {
        var e: [OrderedJSONObject.Entry] = []
        e.append(.init(key: "exerciseId", value: .string(exerciseId)))
        if let name { e.append(.init(key: "name", value: .string(name))) }
        e.append(.init(key: "sets", value: .number(.integer(Int64(sets)))))
        if let repMin { e.append(.init(key: "repMin", value: .number(.integer(Int64(repMin))))) }
        if let repMax { e.append(.init(key: "repMax", value: .number(.integer(Int64(repMax))))) }
        if let distanceM { e.append(.init(key: "distanceM", value: .number(.integer(Int64(distanceM))))) }
        if let timeSec { e.append(.init(key: "timeSec", value: .number(.integer(Int64(timeSec))))) }
        if let holdSec { e.append(.init(key: "holdSec", value: .number(.integer(Int64(holdSec))))) }
        if let restSec { e.append(.init(key: "restSec", value: .number(.integer(Int64(restSec))))) }
        if let cue { e.append(.init(key: "cue", value: .string(cue))) }
        return .object(OrderedJSONObject(entries: e))
    }
}

/// A correction (postural / mobility) support module.
/// Mirrors the legacy web schema `CorrectionModule` interface at `retired web reference`.
public struct CorrectionModule: Equatable, Sendable {
    public let id: String                  // legacy web schema: `id: string` (required)
    public let name: String                // legacy web schema: `name: string` (required)
    public let targetIssue: String         // legacy web schema: `targetIssue: CorrectionIssue` (required)
    public let stage: String               // legacy web schema: `stage: CorrectionStage` (required)
    public let insertionStage: String?     // legacy web schema: `insertionStage?: CorrectionStage`
    public let durationMin: Int            // legacy web schema: `durationMin: number` (required)
    public let dose: String?               // legacy web schema: `dose?: CorrectionDoseLevel`
    public let doseStrategy: String?       // legacy web schema: `doseStrategy?: SupportDoseStrategy`
    public let taperRules: [String]?       // legacy web schema: `taperRules?: string[]`
    public let minimumEffectiveDose: Int?  // legacy web schema: `minimumEffectiveDose?: number`
    public let maxRecommendedDose: Int?    // legacy web schema: `maxRecommendedDose?: number`
    public let exercises: [CorrectionExercise] // legacy web schema: `exercises: CorrectionExercise[]` (required)

    public init(
        id: String,
        name: String,
        targetIssue: String,
        stage: String,
        insertionStage: String? = nil,
        durationMin: Int,
        dose: String? = nil,
        doseStrategy: String? = nil,
        taperRules: [String]? = nil,
        minimumEffectiveDose: Int? = nil,
        maxRecommendedDose: Int? = nil,
        exercises: [CorrectionExercise]
    ) {
        self.id = id
        self.name = name
        self.targetIssue = targetIssue
        self.stage = stage
        self.insertionStage = insertionStage
        self.durationMin = durationMin
        self.dose = dose
        self.doseStrategy = doseStrategy
        self.taperRules = taperRules
        self.minimumEffectiveDose = minimumEffectiveDose
        self.maxRecommendedDose = maxRecommendedDose
        self.exercises = exercises
    }

    public func encoded() -> JSONValue {
        var e: [OrderedJSONObject.Entry] = []
        e.append(.init(key: "id", value: .string(id)))
        e.append(.init(key: "name", value: .string(name)))
        e.append(.init(key: "targetIssue", value: .string(targetIssue)))
        e.append(.init(key: "stage", value: .string(stage)))
        if let insertionStage { e.append(.init(key: "insertionStage", value: .string(insertionStage))) }
        e.append(.init(key: "durationMin", value: .number(.integer(Int64(durationMin)))))
        if let dose { e.append(.init(key: "dose", value: .string(dose))) }
        if let doseStrategy { e.append(.init(key: "doseStrategy", value: .string(doseStrategy))) }
        if let taperRules { e.append(.init(key: "taperRules", value: .array(taperRules.map { .string($0) }))) }
        if let minimumEffectiveDose { e.append(.init(key: "minimumEffectiveDose", value: .number(.integer(Int64(minimumEffectiveDose))))) }
        if let maxRecommendedDose { e.append(.init(key: "maxRecommendedDose", value: .number(.integer(Int64(maxRecommendedDose))))) }
        e.append(.init(key: "exercises", value: .array(exercises.map { $0.encoded() })))
        return .object(OrderedJSONObject(entries: e))
    }
}

/// A functional (capacity / stability) support add-on.
/// Mirrors the legacy web schema `FunctionalAddon` interface at `retired web reference`.
public struct FunctionalAddon: Equatable, Sendable {
    public let id: String                  // legacy web schema: `id: string` (required)
    public let name: String                // legacy web schema: `name: string` (required)
    public let targetAbility: String       // legacy web schema: `targetAbility: FunctionalAbility` (required)
    public let insertionRule: String       // legacy web schema: `insertionRule: FunctionalInsertionRule` (required)
    public let insertionStage: String?     // legacy web schema: `insertionStage?: 'warmup' | 'after_main' | 'finisher'`
    public let durationMin: Int            // legacy web schema: `durationMin: number` (required)
    public let dose: String?               // legacy web schema: `dose?: CorrectionDoseLevel`
    public let doseStrategy: String?       // legacy web schema: `doseStrategy?: SupportDoseStrategy`
    public let taperRules: [String]?       // legacy web schema: `taperRules?: string[]`
    public let minimumEffectiveDose: Int?  // legacy web schema: `minimumEffectiveDose?: number`
    public let maxRecommendedDose: Int?    // legacy web schema: `maxRecommendedDose?: number`
    public let exercises: [FunctionalExercise] // legacy web schema: `exercises: FunctionalExercise[]` (required)

    public init(
        id: String,
        name: String,
        targetAbility: String,
        insertionRule: String,
        insertionStage: String? = nil,
        durationMin: Int,
        dose: String? = nil,
        doseStrategy: String? = nil,
        taperRules: [String]? = nil,
        minimumEffectiveDose: Int? = nil,
        maxRecommendedDose: Int? = nil,
        exercises: [FunctionalExercise]
    ) {
        self.id = id
        self.name = name
        self.targetAbility = targetAbility
        self.insertionRule = insertionRule
        self.insertionStage = insertionStage
        self.durationMin = durationMin
        self.dose = dose
        self.doseStrategy = doseStrategy
        self.taperRules = taperRules
        self.minimumEffectiveDose = minimumEffectiveDose
        self.maxRecommendedDose = maxRecommendedDose
        self.exercises = exercises
    }

    public func encoded() -> JSONValue {
        var e: [OrderedJSONObject.Entry] = []
        e.append(.init(key: "id", value: .string(id)))
        e.append(.init(key: "name", value: .string(name)))
        e.append(.init(key: "targetAbility", value: .string(targetAbility)))
        e.append(.init(key: "insertionRule", value: .string(insertionRule)))
        if let insertionStage { e.append(.init(key: "insertionStage", value: .string(insertionStage))) }
        e.append(.init(key: "durationMin", value: .number(.integer(Int64(durationMin)))))
        if let dose { e.append(.init(key: "dose", value: .string(dose))) }
        if let doseStrategy { e.append(.init(key: "doseStrategy", value: .string(doseStrategy))) }
        if let taperRules { e.append(.init(key: "taperRules", value: .array(taperRules.map { .string($0) }))) }
        if let minimumEffectiveDose { e.append(.init(key: "minimumEffectiveDose", value: .number(.integer(Int64(minimumEffectiveDose))))) }
        if let maxRecommendedDose { e.append(.init(key: "maxRecommendedDose", value: .number(.integer(Int64(maxRecommendedDose))))) }
        e.append(.init(key: "exercises", value: .array(exercises.map { $0.encoded() })))
        return .object(OrderedJSONObject(entries: e))
    }
}
