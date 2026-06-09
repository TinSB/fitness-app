// ProgramAdjustmentDraft — PA-S1 PA Domain Types V1.
//
// Mirrors the legacy web implementation `ProgramAdjustmentDraft` interface at
// `retired web reference`. The PA engine's staged, not-yet-
// applied program adjustment — its typed `changes` (`[AdjustmentChange]`)
// and `diffPreview` (`ProgramAdjustmentDiff`).
//
// `status` is the wide `AdjustmentApplicationStatus` union and `riskLevel`
// a small union — both carried as `String?` (the `ProgramTemplate.primaryGoal`
// precedent, lossless). `confidence` is the closed `EstimateConfidence`
// enum (lossless "extracted-set" rule). Same paradigm as the existing
// Domain types: `init(decoding:)` / `encoded()`, `_unknown` open bag,
// canonical round-trip. All properties optional (the `ProgramTemplate`
// convention); legacy web schema requiredness noted in-line.
//
// Pure type: no runtime logic, no write path, no `: Date`.

import Foundation

public struct ProgramAdjustmentDraft: Equatable, Hashable, Sendable, PAJSONCodable {
    public let id: String?                          // legacy web schema: `id: string` (required)
    public let parentDraftId: String?               // legacy web schema: `parentDraftId?: string`
    public let draftRevision: NumberRepr?           // legacy web schema: `draftRevision?: number`
    public let createdAt: String?                   // legacy web schema: `createdAt: string` (required)
    public let status: String?                      // legacy web schema: `status: AdjustmentApplicationStatus` (required)
    public let sourceProgramTemplateId: String?     // legacy web schema: `sourceProgramTemplateId: string` (required)
    public let sourceTemplateId: String?            // legacy web schema: `sourceTemplateId?: string`
    public let sourceCoachActionId: String?         // legacy web schema: `sourceCoachActionId?: string`
    public let sourceRecommendationId: String?      // legacy web schema: `sourceRecommendationId?: string`
    public let sourceFingerprint: String?           // legacy web schema: `sourceFingerprint?: string`
    public let experimentalProgramTemplateId: String? // legacy web schema: `experimentalProgramTemplateId?: string`
    public let experimentalTemplateName: String?    // legacy web schema: `experimentalTemplateName?: string`
    public let appliedAt: String?                   // legacy web schema: `appliedAt?: string`
    public let rolledBackAt: String?                // legacy web schema: `rolledBackAt?: string`
    public let sourceTemplateSnapshotHash: String?  // legacy web schema: `sourceTemplateSnapshotHash?: string`
    public let sourceTemplateUpdatedAt: String?     // legacy web schema: `sourceTemplateUpdatedAt?: string`
    public let title: String?                       // legacy web schema: `title: string` (required)
    public let summary: String?                     // legacy web schema: `summary: string` (required)
    public let selectedRecommendationIds: [String]? // legacy web schema: `selectedRecommendationIds: string[]` (required)
    public let changes: [AdjustmentChange]?         // legacy web schema: `changes: AdjustmentChange[]` (required)
    public let confidence: EstimateConfidence?      // legacy web schema: `confidence: EstimateConfidence` (required)
    public let riskLevel: String?                   // legacy web schema: `riskLevel?: 'low'|'medium'|'high'`
    public let explanation: String?                 // legacy web schema: `explanation?: string`
    public let diffPreview: ProgramAdjustmentDiff?  // legacy web schema: `diffPreview?: ProgramAdjustmentDiff`
    public let notes: [String]?                     // legacy web schema: `notes: string[]` (required)

    public let _unknown: OrderedJSONObject

    public init(
        id: String? = nil,
        parentDraftId: String? = nil,
        draftRevision: NumberRepr? = nil,
        createdAt: String? = nil,
        status: String? = nil,
        sourceProgramTemplateId: String? = nil,
        sourceTemplateId: String? = nil,
        sourceCoachActionId: String? = nil,
        sourceRecommendationId: String? = nil,
        sourceFingerprint: String? = nil,
        experimentalProgramTemplateId: String? = nil,
        experimentalTemplateName: String? = nil,
        appliedAt: String? = nil,
        rolledBackAt: String? = nil,
        sourceTemplateSnapshotHash: String? = nil,
        sourceTemplateUpdatedAt: String? = nil,
        title: String? = nil,
        summary: String? = nil,
        selectedRecommendationIds: [String]? = nil,
        changes: [AdjustmentChange]? = nil,
        confidence: EstimateConfidence? = nil,
        riskLevel: String? = nil,
        explanation: String? = nil,
        diffPreview: ProgramAdjustmentDiff? = nil,
        notes: [String]? = nil,
        _unknown: OrderedJSONObject = OrderedJSONObject()
    ) {
        self.id = id
        self.parentDraftId = parentDraftId
        self.draftRevision = draftRevision
        self.createdAt = createdAt
        self.status = status
        self.sourceProgramTemplateId = sourceProgramTemplateId
        self.sourceTemplateId = sourceTemplateId
        self.sourceCoachActionId = sourceCoachActionId
        self.sourceRecommendationId = sourceRecommendationId
        self.sourceFingerprint = sourceFingerprint
        self.experimentalProgramTemplateId = experimentalProgramTemplateId
        self.experimentalTemplateName = experimentalTemplateName
        self.appliedAt = appliedAt
        self.rolledBackAt = rolledBackAt
        self.sourceTemplateSnapshotHash = sourceTemplateSnapshotHash
        self.sourceTemplateUpdatedAt = sourceTemplateUpdatedAt
        self.title = title
        self.summary = summary
        self.selectedRecommendationIds = selectedRecommendationIds
        self.changes = changes
        self.confidence = confidence
        self.riskLevel = riskLevel
        self.explanation = explanation
        self.diffPreview = diffPreview
        self.notes = notes
        self._unknown = _unknown
    }

    public init(decoding value: JSONValue) throws {
        guard case .object(let obj) = value else {
            throw JSONValueError.notAnObject
        }
        var extracted: Set<String> = []
        self.id = PADecode.string(obj, "id", &extracted)
        self.parentDraftId = PADecode.string(obj, "parentDraftId", &extracted)
        self.draftRevision = PADecode.number(obj, "draftRevision", &extracted)
        self.createdAt = PADecode.string(obj, "createdAt", &extracted)
        self.status = PADecode.string(obj, "status", &extracted)
        self.sourceProgramTemplateId = PADecode.string(obj, "sourceProgramTemplateId", &extracted)
        self.sourceTemplateId = PADecode.string(obj, "sourceTemplateId", &extracted)
        self.sourceCoachActionId = PADecode.string(obj, "sourceCoachActionId", &extracted)
        self.sourceRecommendationId = PADecode.string(obj, "sourceRecommendationId", &extracted)
        self.sourceFingerprint = PADecode.string(obj, "sourceFingerprint", &extracted)
        self.experimentalProgramTemplateId = PADecode.string(obj, "experimentalProgramTemplateId", &extracted)
        self.experimentalTemplateName = PADecode.string(obj, "experimentalTemplateName", &extracted)
        self.appliedAt = PADecode.string(obj, "appliedAt", &extracted)
        self.rolledBackAt = PADecode.string(obj, "rolledBackAt", &extracted)
        self.sourceTemplateSnapshotHash = PADecode.string(obj, "sourceTemplateSnapshotHash", &extracted)
        self.sourceTemplateUpdatedAt = PADecode.string(obj, "sourceTemplateUpdatedAt", &extracted)
        self.title = PADecode.string(obj, "title", &extracted)
        self.summary = PADecode.string(obj, "summary", &extracted)
        self.selectedRecommendationIds = PADecode.stringArray(obj, "selectedRecommendationIds", &extracted)
        self.changes = PADecode.objectArray(obj, "changes", &extracted, AdjustmentChange.self)
        self.confidence = PADecode.rawEnum(obj, "confidence", &extracted, EstimateConfidence.self)
        self.riskLevel = PADecode.string(obj, "riskLevel", &extracted)
        self.explanation = PADecode.string(obj, "explanation", &extracted)
        self.diffPreview = PADecode.object(obj, "diffPreview", &extracted, ProgramAdjustmentDiff.self)
        self.notes = PADecode.stringArray(obj, "notes", &extracted)
        self._unknown = obj.withoutKeys(extracted)
    }

    public func encoded() -> JSONValue {
        var typed: [OrderedJSONObject.Entry] = []
        PAEncode.string(&typed, "id", id)
        PAEncode.string(&typed, "parentDraftId", parentDraftId)
        PAEncode.number(&typed, "draftRevision", draftRevision)
        PAEncode.string(&typed, "createdAt", createdAt)
        PAEncode.string(&typed, "status", status)
        PAEncode.string(&typed, "sourceProgramTemplateId", sourceProgramTemplateId)
        PAEncode.string(&typed, "sourceTemplateId", sourceTemplateId)
        PAEncode.string(&typed, "sourceCoachActionId", sourceCoachActionId)
        PAEncode.string(&typed, "sourceRecommendationId", sourceRecommendationId)
        PAEncode.string(&typed, "sourceFingerprint", sourceFingerprint)
        PAEncode.string(&typed, "experimentalProgramTemplateId", experimentalProgramTemplateId)
        PAEncode.string(&typed, "experimentalTemplateName", experimentalTemplateName)
        PAEncode.string(&typed, "appliedAt", appliedAt)
        PAEncode.string(&typed, "rolledBackAt", rolledBackAt)
        PAEncode.string(&typed, "sourceTemplateSnapshotHash", sourceTemplateSnapshotHash)
        PAEncode.string(&typed, "sourceTemplateUpdatedAt", sourceTemplateUpdatedAt)
        PAEncode.string(&typed, "title", title)
        PAEncode.string(&typed, "summary", summary)
        PAEncode.stringArray(&typed, "selectedRecommendationIds", selectedRecommendationIds)
        PAEncode.objectArray(&typed, "changes", changes)
        PAEncode.rawEnum(&typed, "confidence", confidence)
        PAEncode.string(&typed, "riskLevel", riskLevel)
        PAEncode.string(&typed, "explanation", explanation)
        PAEncode.object(&typed, "diffPreview", diffPreview)
        PAEncode.stringArray(&typed, "notes", notes)
        return .object(_unknown.appending(typed))
    }
}
