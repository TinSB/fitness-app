// ExerciseTemplate — PA-S1 PA Domain Types V1.
//
// Mirrors the TypeScript `ExerciseTemplate` interface at
// `src/models/training-model.ts:345`, which `extends ExerciseMetadata`
// (`:313`). Swift structs have no inheritance, so the inherited
// `ExerciseMetadata` fields are FLATTENED onto this struct — exactly the
// flat JSON shape the TS `extends` produces. (`ExerciseMetadata` is not
// yet a standalone Swift type — SR/AN have not ported it — so there is
// no existing type to reuse/extend here; it is mirrored inline.)
//
// Same paradigm as the existing Domain types: `init(decoding:)` /
// `encoded()` over `JSONValue`, every documented key carried losslessly,
// an `_unknown` open bag for anything not promoted, canonical round-trip.
// All properties are `Optional` (the `ProgramTemplate` convention); TS
// requiredness is noted in-line.
//
// Field-type rules (the `ProgramTemplate`/`MesocyclePlan` precedent):
//   * scalar string / string-union → `String?` (union members preserved
//     losslessly as String, e.g. `kind` / `fatigueCost` / `warningType`);
//   * number → `NumberRepr?`; boolean → `Bool?`; `string[]` → `[String]?`;
//   * tuple `[number, number]`, `Record<...>`, nested objects and
//     object-arrays (`techniqueStandard` / `equivalence` / `warningSignals`
//     / `progressionPercent` …) stay as raw `JSONValue?` (the
//     `ProgramTemplate.correctionStrategy` / `MesocyclePlan.weeks`
//     precedent for not-yet-typed nested structures — lossless).
//
// Pure type: no runtime logic, no write path, no `: Date`.

import Foundation

public struct ExerciseTemplate: Equatable, Hashable, Sendable, PAJSONCodable {

    // MARK: ExerciseTemplate own fields (`:345`)
    public let id: String?                  // TS: `id: string` (required)
    public let name: String?                // TS: `name: string` (required)
    public let alias: String?               // TS: `alias?: string`
    public let muscle: String?              // TS: `muscle: string` (required)
    public let kind: String?                // TS: `kind: ExerciseKind | string` (required)
    public let sets: NumberRepr?            // TS: `sets: number` (required)
    public let repMin: NumberRepr?          // TS: `repMin: number` (required)
    public let repMax: NumberRepr?          // TS: `repMax: number` (required)
    public let rest: NumberRepr?            // TS: `rest: number` (required)
    public let startWeight: NumberRepr?     // TS: `startWeight: number` (required)
    public let alternatives: [String]?      // TS: `alternatives?: string[]`
    public let adjustment: String?          // TS: `adjustment?: string`
    public let warning: String?             // TS: `warning?: string`
    public let warningSource: String?       // TS: `warningSource?: ExerciseWarningSource`
    public let warningType: String?         // TS: `warningType?: ExerciseWarningType`
    public let warningSignals: JSONValue?   // TS: `warningSignals?: ExerciseWarningSignal[]`

    // MARK: Inherited ExerciseMetadata fields (`:313`)
    public let movementPattern: String?         // TS: `movementPattern?: string`
    public let primaryMuscles: [String]?        // TS: `primaryMuscles?: string[]`
    public let secondaryMuscles: [String]?      // TS: `secondaryMuscles?: string[]`
    public let muscleContribution: JSONValue?   // TS: `muscleContribution?: Record<string, number>`
    public let goalBias: [String]?              // TS: `goalBias?: string[]`
    public let equivalenceChainId: String?      // TS: `equivalenceChainId?: string`
    public let canonicalExerciseId: String?     // TS: `canonicalExerciseId?: string`
    public let baseId: String?                  // TS: `baseId?: string`
    public let fatigueCost: String?             // TS: `fatigueCost?: ExerciseFatigueCost | string`
    public let skillDemand: String?             // TS: `skillDemand?: ExerciseSkillDemand | string`
    public let romPriority: String?             // TS: `romPriority?: string`
    public let progressionUnit: String?         // TS: `progressionUnit?: string`
    public let progressionUnitKg: NumberRepr?   // TS: `progressionUnitKg?: number`
    public let progressionPercent: JSONValue?   // TS: `progressionPercent?: [number, number]`
    public let targetRir: JSONValue?            // TS: `targetRir?: [number, number]`
    public let recommendedLoadRange: String?    // TS: `recommendedLoadRange?: string`
    public let recommendedRepRange: JSONValue?  // TS: `recommendedRepRange?: [number, number]`
    public let recommendedRestSec: JSONValue?   // TS: `recommendedRestSec?: [number, number]`
    public let orderPriority: NumberRepr?       // TS: `orderPriority?: number`
    public let highFrequencyOk: Bool?           // TS: `highFrequencyOk?: boolean`
    public let evidenceTags: [String]?          // TS: `evidenceTags?: readonly string[]`
    public let techniqueStandard: JSONValue?    // TS: `techniqueStandard?: TechniqueStandard`
    public let equivalence: JSONValue?          // TS: `equivalence?: ExerciseEquivalenceChain`
    public let alternativeIds: [String]?        // TS: `alternativeIds?: string[]`
    public let alternativePriorities: JSONValue? // TS: `alternativePriorities?: Record<string, ...>`
    public let regressionIds: [String]?         // TS: `regressionIds?: string[]`
    public let progressionIds: [String]?        // TS: `progressionIds?: string[]`
    public let contraindications: [String]?     // TS: `contraindications?: string[]`
    public let warmupPreference: String?        // TS: `warmupPreference?: ExerciseWarmupPreference`

    public let _unknown: OrderedJSONObject

    public init(
        id: String? = nil,
        name: String? = nil,
        alias: String? = nil,
        muscle: String? = nil,
        kind: String? = nil,
        sets: NumberRepr? = nil,
        repMin: NumberRepr? = nil,
        repMax: NumberRepr? = nil,
        rest: NumberRepr? = nil,
        startWeight: NumberRepr? = nil,
        alternatives: [String]? = nil,
        adjustment: String? = nil,
        warning: String? = nil,
        warningSource: String? = nil,
        warningType: String? = nil,
        warningSignals: JSONValue? = nil,
        movementPattern: String? = nil,
        primaryMuscles: [String]? = nil,
        secondaryMuscles: [String]? = nil,
        muscleContribution: JSONValue? = nil,
        goalBias: [String]? = nil,
        equivalenceChainId: String? = nil,
        canonicalExerciseId: String? = nil,
        baseId: String? = nil,
        fatigueCost: String? = nil,
        skillDemand: String? = nil,
        romPriority: String? = nil,
        progressionUnit: String? = nil,
        progressionUnitKg: NumberRepr? = nil,
        progressionPercent: JSONValue? = nil,
        targetRir: JSONValue? = nil,
        recommendedLoadRange: String? = nil,
        recommendedRepRange: JSONValue? = nil,
        recommendedRestSec: JSONValue? = nil,
        orderPriority: NumberRepr? = nil,
        highFrequencyOk: Bool? = nil,
        evidenceTags: [String]? = nil,
        techniqueStandard: JSONValue? = nil,
        equivalence: JSONValue? = nil,
        alternativeIds: [String]? = nil,
        alternativePriorities: JSONValue? = nil,
        regressionIds: [String]? = nil,
        progressionIds: [String]? = nil,
        contraindications: [String]? = nil,
        warmupPreference: String? = nil,
        _unknown: OrderedJSONObject = OrderedJSONObject()
    ) {
        self.id = id
        self.name = name
        self.alias = alias
        self.muscle = muscle
        self.kind = kind
        self.sets = sets
        self.repMin = repMin
        self.repMax = repMax
        self.rest = rest
        self.startWeight = startWeight
        self.alternatives = alternatives
        self.adjustment = adjustment
        self.warning = warning
        self.warningSource = warningSource
        self.warningType = warningType
        self.warningSignals = warningSignals
        self.movementPattern = movementPattern
        self.primaryMuscles = primaryMuscles
        self.secondaryMuscles = secondaryMuscles
        self.muscleContribution = muscleContribution
        self.goalBias = goalBias
        self.equivalenceChainId = equivalenceChainId
        self.canonicalExerciseId = canonicalExerciseId
        self.baseId = baseId
        self.fatigueCost = fatigueCost
        self.skillDemand = skillDemand
        self.romPriority = romPriority
        self.progressionUnit = progressionUnit
        self.progressionUnitKg = progressionUnitKg
        self.progressionPercent = progressionPercent
        self.targetRir = targetRir
        self.recommendedLoadRange = recommendedLoadRange
        self.recommendedRepRange = recommendedRepRange
        self.recommendedRestSec = recommendedRestSec
        self.orderPriority = orderPriority
        self.highFrequencyOk = highFrequencyOk
        self.evidenceTags = evidenceTags
        self.techniqueStandard = techniqueStandard
        self.equivalence = equivalence
        self.alternativeIds = alternativeIds
        self.alternativePriorities = alternativePriorities
        self.regressionIds = regressionIds
        self.progressionIds = progressionIds
        self.contraindications = contraindications
        self.warmupPreference = warmupPreference
        self._unknown = _unknown
    }

    public init(decoding value: JSONValue) throws {
        guard case .object(let obj) = value else {
            throw JSONValueError.notAnObject
        }
        var extracted: Set<String> = []
        self.id = PADecode.string(obj, "id", &extracted)
        self.name = PADecode.string(obj, "name", &extracted)
        self.alias = PADecode.string(obj, "alias", &extracted)
        self.muscle = PADecode.string(obj, "muscle", &extracted)
        self.kind = PADecode.string(obj, "kind", &extracted)
        self.sets = PADecode.number(obj, "sets", &extracted)
        self.repMin = PADecode.number(obj, "repMin", &extracted)
        self.repMax = PADecode.number(obj, "repMax", &extracted)
        self.rest = PADecode.number(obj, "rest", &extracted)
        self.startWeight = PADecode.number(obj, "startWeight", &extracted)
        self.alternatives = PADecode.stringArray(obj, "alternatives", &extracted)
        self.adjustment = PADecode.string(obj, "adjustment", &extracted)
        self.warning = PADecode.string(obj, "warning", &extracted)
        self.warningSource = PADecode.string(obj, "warningSource", &extracted)
        self.warningType = PADecode.string(obj, "warningType", &extracted)
        self.warningSignals = PADecode.raw(obj, "warningSignals", &extracted)
        self.movementPattern = PADecode.string(obj, "movementPattern", &extracted)
        self.primaryMuscles = PADecode.stringArray(obj, "primaryMuscles", &extracted)
        self.secondaryMuscles = PADecode.stringArray(obj, "secondaryMuscles", &extracted)
        self.muscleContribution = PADecode.raw(obj, "muscleContribution", &extracted)
        self.goalBias = PADecode.stringArray(obj, "goalBias", &extracted)
        self.equivalenceChainId = PADecode.string(obj, "equivalenceChainId", &extracted)
        self.canonicalExerciseId = PADecode.string(obj, "canonicalExerciseId", &extracted)
        self.baseId = PADecode.string(obj, "baseId", &extracted)
        self.fatigueCost = PADecode.string(obj, "fatigueCost", &extracted)
        self.skillDemand = PADecode.string(obj, "skillDemand", &extracted)
        self.romPriority = PADecode.string(obj, "romPriority", &extracted)
        self.progressionUnit = PADecode.string(obj, "progressionUnit", &extracted)
        self.progressionUnitKg = PADecode.number(obj, "progressionUnitKg", &extracted)
        self.progressionPercent = PADecode.raw(obj, "progressionPercent", &extracted)
        self.targetRir = PADecode.raw(obj, "targetRir", &extracted)
        self.recommendedLoadRange = PADecode.string(obj, "recommendedLoadRange", &extracted)
        self.recommendedRepRange = PADecode.raw(obj, "recommendedRepRange", &extracted)
        self.recommendedRestSec = PADecode.raw(obj, "recommendedRestSec", &extracted)
        self.orderPriority = PADecode.number(obj, "orderPriority", &extracted)
        self.highFrequencyOk = PADecode.bool(obj, "highFrequencyOk", &extracted)
        self.evidenceTags = PADecode.stringArray(obj, "evidenceTags", &extracted)
        self.techniqueStandard = PADecode.raw(obj, "techniqueStandard", &extracted)
        self.equivalence = PADecode.raw(obj, "equivalence", &extracted)
        self.alternativeIds = PADecode.stringArray(obj, "alternativeIds", &extracted)
        self.alternativePriorities = PADecode.raw(obj, "alternativePriorities", &extracted)
        self.regressionIds = PADecode.stringArray(obj, "regressionIds", &extracted)
        self.progressionIds = PADecode.stringArray(obj, "progressionIds", &extracted)
        self.contraindications = PADecode.stringArray(obj, "contraindications", &extracted)
        self.warmupPreference = PADecode.string(obj, "warmupPreference", &extracted)
        self._unknown = obj.withoutKeys(extracted)
    }

    public func encoded() -> JSONValue {
        var typed: [OrderedJSONObject.Entry] = []
        PAEncode.string(&typed, "id", id)
        PAEncode.string(&typed, "name", name)
        PAEncode.string(&typed, "alias", alias)
        PAEncode.string(&typed, "muscle", muscle)
        PAEncode.string(&typed, "kind", kind)
        PAEncode.number(&typed, "sets", sets)
        PAEncode.number(&typed, "repMin", repMin)
        PAEncode.number(&typed, "repMax", repMax)
        PAEncode.number(&typed, "rest", rest)
        PAEncode.number(&typed, "startWeight", startWeight)
        PAEncode.stringArray(&typed, "alternatives", alternatives)
        PAEncode.string(&typed, "adjustment", adjustment)
        PAEncode.string(&typed, "warning", warning)
        PAEncode.string(&typed, "warningSource", warningSource)
        PAEncode.string(&typed, "warningType", warningType)
        PAEncode.raw(&typed, "warningSignals", warningSignals)
        PAEncode.string(&typed, "movementPattern", movementPattern)
        PAEncode.stringArray(&typed, "primaryMuscles", primaryMuscles)
        PAEncode.stringArray(&typed, "secondaryMuscles", secondaryMuscles)
        PAEncode.raw(&typed, "muscleContribution", muscleContribution)
        PAEncode.stringArray(&typed, "goalBias", goalBias)
        PAEncode.string(&typed, "equivalenceChainId", equivalenceChainId)
        PAEncode.string(&typed, "canonicalExerciseId", canonicalExerciseId)
        PAEncode.string(&typed, "baseId", baseId)
        PAEncode.string(&typed, "fatigueCost", fatigueCost)
        PAEncode.string(&typed, "skillDemand", skillDemand)
        PAEncode.string(&typed, "romPriority", romPriority)
        PAEncode.string(&typed, "progressionUnit", progressionUnit)
        PAEncode.number(&typed, "progressionUnitKg", progressionUnitKg)
        PAEncode.raw(&typed, "progressionPercent", progressionPercent)
        PAEncode.raw(&typed, "targetRir", targetRir)
        PAEncode.string(&typed, "recommendedLoadRange", recommendedLoadRange)
        PAEncode.raw(&typed, "recommendedRepRange", recommendedRepRange)
        PAEncode.raw(&typed, "recommendedRestSec", recommendedRestSec)
        PAEncode.number(&typed, "orderPriority", orderPriority)
        PAEncode.bool(&typed, "highFrequencyOk", highFrequencyOk)
        PAEncode.stringArray(&typed, "evidenceTags", evidenceTags)
        PAEncode.raw(&typed, "techniqueStandard", techniqueStandard)
        PAEncode.raw(&typed, "equivalence", equivalence)
        PAEncode.stringArray(&typed, "alternativeIds", alternativeIds)
        PAEncode.raw(&typed, "alternativePriorities", alternativePriorities)
        PAEncode.stringArray(&typed, "regressionIds", regressionIds)
        PAEncode.stringArray(&typed, "progressionIds", progressionIds)
        PAEncode.stringArray(&typed, "contraindications", contraindications)
        PAEncode.string(&typed, "warmupPreference", warmupPreference)
        return .object(_unknown.appending(typed))
    }
}
