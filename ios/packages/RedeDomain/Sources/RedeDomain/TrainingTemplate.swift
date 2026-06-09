// TrainingTemplate — PA-S1 PA Domain Types V1.
//
// Mirrors the legacy web implementation `TrainingTemplate` interface at
// `retired web reference`. The experiment-able session
// template the PA engines clone, adjust and re-apply — its `exercises`
// are typed `ExerciseTemplate`s.
//
// Same paradigm as the existing Domain types: `init(decoding:)` /
// `encoded()` over `JSONValue`, every documented key carried losslessly,
// an `_unknown` open bag, canonical round-trip. All properties optional
// (the `ProgramTemplate` convention); legacy web schema requiredness noted in-line.
//
// Pure type: no runtime logic, no write path, no `: Date`.

import Foundation

public struct TrainingTemplate: Equatable, Hashable, Sendable, PAJSONCodable {
    public let id: String?                      // legacy web schema: `id: string` (required)
    public let name: String?                    // legacy web schema: `name: string` (required)
    public let focus: String?                   // legacy web schema: `focus: string` (required)
    public let duration: NumberRepr?            // legacy web schema: `duration: number` (required)
    public let note: String?                    // legacy web schema: `note: string` (required)
    public let exercises: [ExerciseTemplate]?   // legacy web schema: `exercises: ExerciseTemplate[]` (required)
    public let updatedAt: String?               // legacy web schema: `updatedAt?: string`
    public let sourceTemplateId: String?        // legacy web schema: `sourceTemplateId?: string`
    public let sourceTemplateName: String?      // legacy web schema: `sourceTemplateName?: string`
    public let isExperimentalTemplate: Bool?    // legacy web schema: `isExperimentalTemplate?: boolean`
    public let appliedAt: String?               // legacy web schema: `appliedAt?: string`
    public let adjustmentSummary: String?       // legacy web schema: `adjustmentSummary?: string`

    public let _unknown: OrderedJSONObject

    public init(
        id: String? = nil,
        name: String? = nil,
        focus: String? = nil,
        duration: NumberRepr? = nil,
        note: String? = nil,
        exercises: [ExerciseTemplate]? = nil,
        updatedAt: String? = nil,
        sourceTemplateId: String? = nil,
        sourceTemplateName: String? = nil,
        isExperimentalTemplate: Bool? = nil,
        appliedAt: String? = nil,
        adjustmentSummary: String? = nil,
        _unknown: OrderedJSONObject = OrderedJSONObject()
    ) {
        self.id = id
        self.name = name
        self.focus = focus
        self.duration = duration
        self.note = note
        self.exercises = exercises
        self.updatedAt = updatedAt
        self.sourceTemplateId = sourceTemplateId
        self.sourceTemplateName = sourceTemplateName
        self.isExperimentalTemplate = isExperimentalTemplate
        self.appliedAt = appliedAt
        self.adjustmentSummary = adjustmentSummary
        self._unknown = _unknown
    }

    public init(decoding value: JSONValue) throws {
        guard case .object(let obj) = value else {
            throw JSONValueError.notAnObject
        }
        var extracted: Set<String> = []
        self.id = PADecode.string(obj, "id", &extracted)
        self.name = PADecode.string(obj, "name", &extracted)
        self.focus = PADecode.string(obj, "focus", &extracted)
        self.duration = PADecode.number(obj, "duration", &extracted)
        self.note = PADecode.string(obj, "note", &extracted)
        self.exercises = PADecode.objectArray(obj, "exercises", &extracted, ExerciseTemplate.self)
        self.updatedAt = PADecode.string(obj, "updatedAt", &extracted)
        self.sourceTemplateId = PADecode.string(obj, "sourceTemplateId", &extracted)
        self.sourceTemplateName = PADecode.string(obj, "sourceTemplateName", &extracted)
        self.isExperimentalTemplate = PADecode.bool(obj, "isExperimentalTemplate", &extracted)
        self.appliedAt = PADecode.string(obj, "appliedAt", &extracted)
        self.adjustmentSummary = PADecode.string(obj, "adjustmentSummary", &extracted)
        self._unknown = obj.withoutKeys(extracted)
    }

    public func encoded() -> JSONValue {
        var typed: [OrderedJSONObject.Entry] = []
        PAEncode.string(&typed, "id", id)
        PAEncode.string(&typed, "name", name)
        PAEncode.string(&typed, "focus", focus)
        PAEncode.number(&typed, "duration", duration)
        PAEncode.string(&typed, "note", note)
        PAEncode.objectArray(&typed, "exercises", exercises)
        PAEncode.string(&typed, "updatedAt", updatedAt)
        PAEncode.string(&typed, "sourceTemplateId", sourceTemplateId)
        PAEncode.string(&typed, "sourceTemplateName", sourceTemplateName)
        PAEncode.bool(&typed, "isExperimentalTemplate", isExperimentalTemplate)
        PAEncode.string(&typed, "appliedAt", appliedAt)
        PAEncode.string(&typed, "adjustmentSummary", adjustmentSummary)
        return .object(_unknown.appending(typed))
    }
}
