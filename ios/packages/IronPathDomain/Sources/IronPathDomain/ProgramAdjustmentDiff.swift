// ProgramAdjustmentDiff — PA-S1 PA Domain Types V1.
//
// Mirrors the legacy web implementation `ProgramAdjustmentDiff` interface at
// `retired web reference`. The human-readable before/after
// diff a `ProgramAdjustmentDraft` carries for preview.
//
// `changes` is the legacy web schema anonymous-object array
// `Array<{ changeId; type; label; before; after; reason; riskLevel }>`;
// it has no named legacy web schema type, so it is carried verbatim as raw `JSONValue?`
// (the `ProgramTemplate.correctionStrategy` / `MesocyclePlan.weeks`
// precedent for not-yet-typed nested structures — lossless round-trip).
//
// Same paradigm as the existing Domain types: `init(decoding:)` /
// `encoded()`, `_unknown` open bag, canonical round-trip. All properties
// optional (the `ProgramTemplate` convention); legacy web schema requiredness noted.
//
// Pure type: no runtime logic, no write path, no `: Date`.

import Foundation

public struct ProgramAdjustmentDiff: Equatable, Hashable, Sendable, PAJSONCodable {
    public let title: String?     // legacy web schema: `title: string` (required)
    public let summary: String?   // legacy web schema: `summary: string` (required)
    public let changes: JSONValue? // legacy web schema: `changes: Array<{ changeId; type; label; before; after; reason; riskLevel }>` (required)

    public let _unknown: OrderedJSONObject

    public init(
        title: String? = nil,
        summary: String? = nil,
        changes: JSONValue? = nil,
        _unknown: OrderedJSONObject = OrderedJSONObject()
    ) {
        self.title = title
        self.summary = summary
        self.changes = changes
        self._unknown = _unknown
    }

    public init(decoding value: JSONValue) throws {
        guard case .object(let obj) = value else {
            throw JSONValueError.notAnObject
        }
        var extracted: Set<String> = []
        self.title = PADecode.string(obj, "title", &extracted)
        self.summary = PADecode.string(obj, "summary", &extracted)
        self.changes = PADecode.raw(obj, "changes", &extracted)
        self._unknown = obj.withoutKeys(extracted)
    }

    public func encoded() -> JSONValue {
        var typed: [OrderedJSONObject.Entry] = []
        PAEncode.string(&typed, "title", title)
        PAEncode.string(&typed, "summary", summary)
        PAEncode.raw(&typed, "changes", changes)
        return .object(_unknown.appending(typed))
    }
}
