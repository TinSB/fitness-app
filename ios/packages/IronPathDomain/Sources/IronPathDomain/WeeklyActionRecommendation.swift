// WeeklyActionRecommendation — PA-S1 PA Domain Types V1.
//
// Mirrors the legacy web implementation `WeeklyActionRecommendation` interface at
// `retired web reference`. One weekly coaching recommendation
// the PA engines surface (volume / recovery / exercise-selection / …).
//
// `priority` / `category` / `targetType` are small legacy web schema string-unions; they
// are carried as `String?` (the `ProgramTemplate.primaryGoal` precedent —
// String preserves an unknown future member losslessly). `confidence` is
// the closed `EstimateConfidence` enum, decoded with the lossless
// "extracted-set" rule. `suggestedChange` is a legacy web schema anonymous object,
// carried verbatim as raw `JSONValue?` (the `MesocyclePlan.weeks`
// precedent). Same paradigm as the existing Domain types. All properties
// optional (the `ProgramTemplate` convention); legacy web schema requiredness noted.
//
// Pure type: no runtime logic, no write path, no `: Date`.

import Foundation

public struct WeeklyActionRecommendation: Equatable, Hashable, Sendable, PAJSONCodable {
    public let id: String?                 // legacy web schema: `id: string` (required)
    public let priority: String?           // legacy web schema: `priority: WeeklyActionPriority` ('high'|'medium'|'low', required)
    public let category: String?           // legacy web schema: `category: 'volume'|'recovery'|...` (required)
    public let targetType: String?         // legacy web schema: `targetType: 'muscle'|'exercise'|'session'|'program'` (required)
    public let targetId: String?           // legacy web schema: `targetId?: string`
    public let targetLabel: String?        // legacy web schema: `targetLabel: string` (required)
    public let issue: String?              // legacy web schema: `issue: string` (required)
    public let recommendation: String?     // legacy web schema: `recommendation: string` (required)
    public let reason: String?             // legacy web schema: `reason: string` (required)
    public let suggestedChange: JSONValue? // legacy web schema: `suggestedChange?: { muscleId?; setsDelta?; ... }`
    public let evidenceRuleIds: [String]?  // legacy web schema: `evidenceRuleIds?: string[]`
    public let confidence: EstimateConfidence? // legacy web schema: `confidence: EstimateConfidence` (required)

    public let _unknown: OrderedJSONObject

    public init(
        id: String? = nil,
        priority: String? = nil,
        category: String? = nil,
        targetType: String? = nil,
        targetId: String? = nil,
        targetLabel: String? = nil,
        issue: String? = nil,
        recommendation: String? = nil,
        reason: String? = nil,
        suggestedChange: JSONValue? = nil,
        evidenceRuleIds: [String]? = nil,
        confidence: EstimateConfidence? = nil,
        _unknown: OrderedJSONObject = OrderedJSONObject()
    ) {
        self.id = id
        self.priority = priority
        self.category = category
        self.targetType = targetType
        self.targetId = targetId
        self.targetLabel = targetLabel
        self.issue = issue
        self.recommendation = recommendation
        self.reason = reason
        self.suggestedChange = suggestedChange
        self.evidenceRuleIds = evidenceRuleIds
        self.confidence = confidence
        self._unknown = _unknown
    }

    public init(decoding value: JSONValue) throws {
        guard case .object(let obj) = value else {
            throw JSONValueError.notAnObject
        }
        var extracted: Set<String> = []
        self.id = PADecode.string(obj, "id", &extracted)
        self.priority = PADecode.string(obj, "priority", &extracted)
        self.category = PADecode.string(obj, "category", &extracted)
        self.targetType = PADecode.string(obj, "targetType", &extracted)
        self.targetId = PADecode.string(obj, "targetId", &extracted)
        self.targetLabel = PADecode.string(obj, "targetLabel", &extracted)
        self.issue = PADecode.string(obj, "issue", &extracted)
        self.recommendation = PADecode.string(obj, "recommendation", &extracted)
        self.reason = PADecode.string(obj, "reason", &extracted)
        self.suggestedChange = PADecode.raw(obj, "suggestedChange", &extracted)
        self.evidenceRuleIds = PADecode.stringArray(obj, "evidenceRuleIds", &extracted)
        self.confidence = PADecode.rawEnum(obj, "confidence", &extracted, EstimateConfidence.self)
        self._unknown = obj.withoutKeys(extracted)
    }

    public func encoded() -> JSONValue {
        var typed: [OrderedJSONObject.Entry] = []
        PAEncode.string(&typed, "id", id)
        PAEncode.string(&typed, "priority", priority)
        PAEncode.string(&typed, "category", category)
        PAEncode.string(&typed, "targetType", targetType)
        PAEncode.string(&typed, "targetId", targetId)
        PAEncode.string(&typed, "targetLabel", targetLabel)
        PAEncode.string(&typed, "issue", issue)
        PAEncode.string(&typed, "recommendation", recommendation)
        PAEncode.string(&typed, "reason", reason)
        PAEncode.raw(&typed, "suggestedChange", suggestedChange)
        PAEncode.stringArray(&typed, "evidenceRuleIds", evidenceRuleIds)
        PAEncode.rawEnum(&typed, "confidence", confidence)
        return .object(_unknown.appending(typed))
    }
}
