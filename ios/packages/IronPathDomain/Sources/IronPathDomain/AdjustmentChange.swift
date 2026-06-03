// AdjustmentChange — PA-S1 PA Domain Types V1.
//
// Mirrors the TypeScript `AdjustmentChange` interface at
// `src/models/training-model.ts:1148`. One concrete change row inside a
// `ProgramAdjustmentDraft` / `ProgramAdjustmentHistoryItem` — the PA
// engine's typed instruction to add/remove sets, swap an exercise, or
// re-dose support.
//
// `type` is the closed `AdjustmentChangeType` enum, decoded with the
// lossless "extracted-set" rule (an unknown future token stays in the
// open bag). Same paradigm as the existing Domain types: `init(decoding:)`
// / `encoded()`, `_unknown` open bag, canonical round-trip. All
// properties optional (the `ProgramTemplate` convention); TS requiredness
// noted in-line.
//
// Pure type: no runtime logic, no write path, no `: Date`.

import Foundation

public struct AdjustmentChange: Equatable, Hashable, Sendable, PAJSONCodable {
    public let id: String?                       // TS: `id: string` (required)
    public let type: AdjustmentChangeType?       // TS: `type: AdjustmentChangeType` (required)
    public let dayTemplateId: String?            // TS: `dayTemplateId?: string`
    public let dayTemplateName: String?          // TS: `dayTemplateName?: string`
    public let exerciseId: String?               // TS: `exerciseId?: string`
    public let exerciseName: String?             // TS: `exerciseName?: string`
    public let replacementExerciseId: String?    // TS: `replacementExerciseId?: string`
    public let replacementExerciseName: String?  // TS: `replacementExerciseName?: string`
    public let muscleId: String?                 // TS: `muscleId?: string`
    public let setsDelta: NumberRepr?            // TS: `setsDelta?: number`
    public let sets: NumberRepr?                 // TS: `sets?: number`
    public let repMin: NumberRepr?               // TS: `repMin?: number`
    public let repMax: NumberRepr?               // TS: `repMax?: number`
    public let restSec: NumberRepr?              // TS: `restSec?: number`
    public let insertAfterExerciseId: String?    // TS: `insertAfterExerciseId?: string`
    public let insertPositionLabel: String?      // TS: `insertPositionLabel?: string`
    public let previewNote: String?              // TS: `previewNote?: string`
    public let skipped: Bool?                    // TS: `skipped?: boolean`
    public let skipReason: String?               // TS: `skipReason?: string`
    public let reason: String?                   // TS: `reason: string` (required)
    public let sourceRecommendationId: String?   // TS: `sourceRecommendationId?: string`

    public let _unknown: OrderedJSONObject

    public init(
        id: String? = nil,
        type: AdjustmentChangeType? = nil,
        dayTemplateId: String? = nil,
        dayTemplateName: String? = nil,
        exerciseId: String? = nil,
        exerciseName: String? = nil,
        replacementExerciseId: String? = nil,
        replacementExerciseName: String? = nil,
        muscleId: String? = nil,
        setsDelta: NumberRepr? = nil,
        sets: NumberRepr? = nil,
        repMin: NumberRepr? = nil,
        repMax: NumberRepr? = nil,
        restSec: NumberRepr? = nil,
        insertAfterExerciseId: String? = nil,
        insertPositionLabel: String? = nil,
        previewNote: String? = nil,
        skipped: Bool? = nil,
        skipReason: String? = nil,
        reason: String? = nil,
        sourceRecommendationId: String? = nil,
        _unknown: OrderedJSONObject = OrderedJSONObject()
    ) {
        self.id = id
        self.type = type
        self.dayTemplateId = dayTemplateId
        self.dayTemplateName = dayTemplateName
        self.exerciseId = exerciseId
        self.exerciseName = exerciseName
        self.replacementExerciseId = replacementExerciseId
        self.replacementExerciseName = replacementExerciseName
        self.muscleId = muscleId
        self.setsDelta = setsDelta
        self.sets = sets
        self.repMin = repMin
        self.repMax = repMax
        self.restSec = restSec
        self.insertAfterExerciseId = insertAfterExerciseId
        self.insertPositionLabel = insertPositionLabel
        self.previewNote = previewNote
        self.skipped = skipped
        self.skipReason = skipReason
        self.reason = reason
        self.sourceRecommendationId = sourceRecommendationId
        self._unknown = _unknown
    }

    public init(decoding value: JSONValue) throws {
        guard case .object(let obj) = value else {
            throw JSONValueError.notAnObject
        }
        var extracted: Set<String> = []
        self.id = PADecode.string(obj, "id", &extracted)
        self.type = PADecode.rawEnum(obj, "type", &extracted, AdjustmentChangeType.self)
        self.dayTemplateId = PADecode.string(obj, "dayTemplateId", &extracted)
        self.dayTemplateName = PADecode.string(obj, "dayTemplateName", &extracted)
        self.exerciseId = PADecode.string(obj, "exerciseId", &extracted)
        self.exerciseName = PADecode.string(obj, "exerciseName", &extracted)
        self.replacementExerciseId = PADecode.string(obj, "replacementExerciseId", &extracted)
        self.replacementExerciseName = PADecode.string(obj, "replacementExerciseName", &extracted)
        self.muscleId = PADecode.string(obj, "muscleId", &extracted)
        self.setsDelta = PADecode.number(obj, "setsDelta", &extracted)
        self.sets = PADecode.number(obj, "sets", &extracted)
        self.repMin = PADecode.number(obj, "repMin", &extracted)
        self.repMax = PADecode.number(obj, "repMax", &extracted)
        self.restSec = PADecode.number(obj, "restSec", &extracted)
        self.insertAfterExerciseId = PADecode.string(obj, "insertAfterExerciseId", &extracted)
        self.insertPositionLabel = PADecode.string(obj, "insertPositionLabel", &extracted)
        self.previewNote = PADecode.string(obj, "previewNote", &extracted)
        self.skipped = PADecode.bool(obj, "skipped", &extracted)
        self.skipReason = PADecode.string(obj, "skipReason", &extracted)
        self.reason = PADecode.string(obj, "reason", &extracted)
        self.sourceRecommendationId = PADecode.string(obj, "sourceRecommendationId", &extracted)
        self._unknown = obj.withoutKeys(extracted)
    }

    public func encoded() -> JSONValue {
        var typed: [OrderedJSONObject.Entry] = []
        PAEncode.string(&typed, "id", id)
        PAEncode.rawEnum(&typed, "type", type)
        PAEncode.string(&typed, "dayTemplateId", dayTemplateId)
        PAEncode.string(&typed, "dayTemplateName", dayTemplateName)
        PAEncode.string(&typed, "exerciseId", exerciseId)
        PAEncode.string(&typed, "exerciseName", exerciseName)
        PAEncode.string(&typed, "replacementExerciseId", replacementExerciseId)
        PAEncode.string(&typed, "replacementExerciseName", replacementExerciseName)
        PAEncode.string(&typed, "muscleId", muscleId)
        PAEncode.number(&typed, "setsDelta", setsDelta)
        PAEncode.number(&typed, "sets", sets)
        PAEncode.number(&typed, "repMin", repMin)
        PAEncode.number(&typed, "repMax", repMax)
        PAEncode.number(&typed, "restSec", restSec)
        PAEncode.string(&typed, "insertAfterExerciseId", insertAfterExerciseId)
        PAEncode.string(&typed, "insertPositionLabel", insertPositionLabel)
        PAEncode.string(&typed, "previewNote", previewNote)
        PAEncode.bool(&typed, "skipped", skipped)
        PAEncode.string(&typed, "skipReason", skipReason)
        PAEncode.string(&typed, "reason", reason)
        PAEncode.string(&typed, "sourceRecommendationId", sourceRecommendationId)
        return .object(_unknown.appending(typed))
    }
}
