// ProgramAdjustmentHistoryItem — PA-S1 PA Domain Types V1.
//
// Mirrors the legacy web implementation `ProgramAdjustmentHistoryItem` interface at
// `retired web reference`. An applied program adjustment in
// the PA history, with its typed `changes` (`[AdjustmentChange]`) and the
// `sourceProgramSnapshot` it was applied over.
//
// `sourceProgramSnapshot` REUSES the existing thin persistence
// `ProgramTemplate` (which carries its own open bag, so a rich snapshot's
// `dayTemplates`/`weeklyMuscleTargets` survive in `_unknown` and are
// reachable through the PA-S1 typed projection — see
// `ProgramTemplate+PARich.swift`). `status` is the `PlanAdjustmentDraftStatus`
// union → `String?`. `effectReview` references `AdjustmentEffectReview`
// (`:1234`, NOT in the PA-S1 scope) — carried verbatim as raw `JSONValue?`
// (the `MesocyclePlan.weeks` precedent for a not-yet-typed nested struct,
// lossless). Same paradigm as the existing Domain types. All properties
// optional (the `ProgramTemplate` convention); legacy web schema requiredness noted.
//
// Pure type: no runtime logic, no write path, no `: Date`.

import Foundation

public struct ProgramAdjustmentHistoryItem: Equatable, Hashable, Sendable, PAJSONCodable {
    public let id: String?                              // legacy web schema: `id: string` (required)
    public let appliedAt: String?                       // legacy web schema: `appliedAt: string` (required)
    public let sourceProgramTemplateId: String?         // legacy web schema: `sourceProgramTemplateId: string` (required)
    public let experimentalProgramTemplateId: String?   // legacy web schema: `experimentalProgramTemplateId: string` (required)
    public let sourceCoachActionId: String?             // legacy web schema: `sourceCoachActionId?: string`
    public let sourceFingerprint: String?               // legacy web schema: `sourceFingerprint?: string`
    public let sourceProgramTemplateName: String?       // legacy web schema: `sourceProgramTemplateName?: string`
    public let experimentalProgramTemplateName: String? // legacy web schema: `experimentalProgramTemplateName?: string`
    public let mainChangeSummary: String?               // legacy web schema: `mainChangeSummary?: string`
    public let selectedRecommendationIds: [String]?     // legacy web schema: `selectedRecommendationIds: string[]` (required)
    public let changes: [AdjustmentChange]?             // legacy web schema: `changes: AdjustmentChange[]` (required)
    public let status: String?                          // legacy web schema: `status?: PlanAdjustmentDraftStatus`
    public let explanation: String?                     // legacy web schema: `explanation?: string`
    public let rollbackAvailable: Bool?                 // legacy web schema: `rollbackAvailable: boolean` (required)
    public let rolledBackAt: String?                    // legacy web schema: `rolledBackAt?: string`
    public let sourceProgramSnapshot: ProgramTemplate?  // legacy web schema: `sourceProgramSnapshot?: ProgramTemplate`
    public let effectReview: JSONValue?                 // legacy web schema: `effectReview?: AdjustmentEffectReview`

    public let _unknown: OrderedJSONObject

    public init(
        id: String? = nil,
        appliedAt: String? = nil,
        sourceProgramTemplateId: String? = nil,
        experimentalProgramTemplateId: String? = nil,
        sourceCoachActionId: String? = nil,
        sourceFingerprint: String? = nil,
        sourceProgramTemplateName: String? = nil,
        experimentalProgramTemplateName: String? = nil,
        mainChangeSummary: String? = nil,
        selectedRecommendationIds: [String]? = nil,
        changes: [AdjustmentChange]? = nil,
        status: String? = nil,
        explanation: String? = nil,
        rollbackAvailable: Bool? = nil,
        rolledBackAt: String? = nil,
        sourceProgramSnapshot: ProgramTemplate? = nil,
        effectReview: JSONValue? = nil,
        _unknown: OrderedJSONObject = OrderedJSONObject()
    ) {
        self.id = id
        self.appliedAt = appliedAt
        self.sourceProgramTemplateId = sourceProgramTemplateId
        self.experimentalProgramTemplateId = experimentalProgramTemplateId
        self.sourceCoachActionId = sourceCoachActionId
        self.sourceFingerprint = sourceFingerprint
        self.sourceProgramTemplateName = sourceProgramTemplateName
        self.experimentalProgramTemplateName = experimentalProgramTemplateName
        self.mainChangeSummary = mainChangeSummary
        self.selectedRecommendationIds = selectedRecommendationIds
        self.changes = changes
        self.status = status
        self.explanation = explanation
        self.rollbackAvailable = rollbackAvailable
        self.rolledBackAt = rolledBackAt
        self.sourceProgramSnapshot = sourceProgramSnapshot
        self.effectReview = effectReview
        self._unknown = _unknown
    }

    public init(decoding value: JSONValue) throws {
        guard case .object(let obj) = value else {
            throw JSONValueError.notAnObject
        }
        var extracted: Set<String> = []
        self.id = PADecode.string(obj, "id", &extracted)
        self.appliedAt = PADecode.string(obj, "appliedAt", &extracted)
        self.sourceProgramTemplateId = PADecode.string(obj, "sourceProgramTemplateId", &extracted)
        self.experimentalProgramTemplateId = PADecode.string(obj, "experimentalProgramTemplateId", &extracted)
        self.sourceCoachActionId = PADecode.string(obj, "sourceCoachActionId", &extracted)
        self.sourceFingerprint = PADecode.string(obj, "sourceFingerprint", &extracted)
        self.sourceProgramTemplateName = PADecode.string(obj, "sourceProgramTemplateName", &extracted)
        self.experimentalProgramTemplateName = PADecode.string(obj, "experimentalProgramTemplateName", &extracted)
        self.mainChangeSummary = PADecode.string(obj, "mainChangeSummary", &extracted)
        self.selectedRecommendationIds = PADecode.stringArray(obj, "selectedRecommendationIds", &extracted)
        self.changes = PADecode.objectArray(obj, "changes", &extracted, AdjustmentChange.self)
        self.status = PADecode.string(obj, "status", &extracted)
        self.explanation = PADecode.string(obj, "explanation", &extracted)
        self.rollbackAvailable = PADecode.bool(obj, "rollbackAvailable", &extracted)
        self.rolledBackAt = PADecode.string(obj, "rolledBackAt", &extracted)
        self.sourceProgramSnapshot = PADecode.object(obj, "sourceProgramSnapshot", &extracted, ProgramTemplate.self)
        self.effectReview = PADecode.raw(obj, "effectReview", &extracted)
        self._unknown = obj.withoutKeys(extracted)
    }

    public func encoded() -> JSONValue {
        var typed: [OrderedJSONObject.Entry] = []
        PAEncode.string(&typed, "id", id)
        PAEncode.string(&typed, "appliedAt", appliedAt)
        PAEncode.string(&typed, "sourceProgramTemplateId", sourceProgramTemplateId)
        PAEncode.string(&typed, "experimentalProgramTemplateId", experimentalProgramTemplateId)
        PAEncode.string(&typed, "sourceCoachActionId", sourceCoachActionId)
        PAEncode.string(&typed, "sourceFingerprint", sourceFingerprint)
        PAEncode.string(&typed, "sourceProgramTemplateName", sourceProgramTemplateName)
        PAEncode.string(&typed, "experimentalProgramTemplateName", experimentalProgramTemplateName)
        PAEncode.string(&typed, "mainChangeSummary", mainChangeSummary)
        PAEncode.stringArray(&typed, "selectedRecommendationIds", selectedRecommendationIds)
        PAEncode.objectArray(&typed, "changes", changes)
        PAEncode.string(&typed, "status", status)
        PAEncode.string(&typed, "explanation", explanation)
        PAEncode.bool(&typed, "rollbackAvailable", rollbackAvailable)
        PAEncode.string(&typed, "rolledBackAt", rolledBackAt)
        PAEncode.object(&typed, "sourceProgramSnapshot", sourceProgramSnapshot)
        PAEncode.raw(&typed, "effectReview", effectReview)
        return .object(_unknown.appending(typed))
    }
}
