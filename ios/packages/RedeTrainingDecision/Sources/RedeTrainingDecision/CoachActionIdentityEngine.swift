// CoachActionIdentityEngine — PA-S5 coach-action fingerprint port.
//
// Faithful line-by-line Swift port of the PURE FNV-1a string-fingerprint
// engine `retired web reference` (187 lines): its 5 exports
// (`buildCoachActionFingerprint` ts:71 / `buildProgramAdjustmentDraftFingerprint`
// ts:111 / `buildProgramAdjustmentHistoryFingerprint` ts:135 /
// `dedupeProgramAdjustmentDraftsByFingerprint` ts:170 + the `CoachActionFingerprintContext`
// type ts:9) and EVERY private helper (`normalizePart` ts:20 / `normalizeText` ts:29 /
// `stableHash` ts:35 / `suggestedChangeType` ts:44 / `targetTypeFromContext` ts:55 /
// `targetIdFromContext` ts:62 / `firstChange` ts:93 / `sourceFromRecommendationId` ts:96 /
// `targetFromChange` ts:104 / `draftStatusRank` ts:159 / `draftTime` ts:168).
//
// KEY SCOPE BYPASS (PA-S5): the legacy web schema input is a 7-field `Pick<CoachAction, …>`
// (ts:4-7). We mirror ONLY that 7-field projection as a local `FingerprintAction`
// value type (all `String?`), so this slice does NOT pull in the 653-line
// `coachActionEngine.ts` / `buildCoachActions` / the full `CoachAction` lifecycle.
// The 7 fields are `CoachActionSource` / `CoachActionType` / small unions / `string`
// in legacy web schema; all are carried as `String?` (the `ProgramTemplate.primaryGoal` precedent —
// String losslessly preserves any union member, and the fingerprint only ever does
// `String(value ?? '')` over them, so no enum is needed). Likewise the context's
// `suggestedChange` mirrors ONLY the 5 fields the fingerprint reads
// (muscleId / setsDelta / exerciseIds / removeExerciseIds / supportDoseAdjustment;
// `volumeMultiplier` is unused) as a minimal `SuggestedChange`.
//
// REUSES (never re-ports) the PA-S1 RedeDomain types: `ProgramAdjustmentDraft`
// / `ProgramAdjustmentHistoryItem` / `AdjustmentChange` (+ its `AdjustmentChangeType`
// enum) / `NumberRepr`. `change?.type` is the raw union string in legacy web schema; on the Swift
// side that is `change.type?.rawValue` (rawValue `add_sets` … equals the legacy web schema token).
//
// PURE / READ-ONLY: only string + number transforms. Zero `: Date`, zero Calendar,
// zero IO, zero randomness, no write path, no CanonicalSessionWriter — §11 DERIVED-only.
// Goldens are GENERATED from the retired legacy engine (frozen legacy fixture generator),
// never hand-edited (§22).

import Foundation
import RedeDomain

public enum CoachActionIdentityEngine {

    // MARK: - Minimal input value types (the 7-field Pick + 5-field suggestedChange)

    /// `FingerprintAction` (coachActionIdentityEngine.ts:4-7) — the 7-field
    /// `Pick<CoachAction, 'source'|'actionType'|'targetType'|'targetId'|'title'|
    /// 'description'|'reason'>`. All `String?` (see file header bypass note).
    public struct FingerprintAction: Equatable, Sendable {
        public let source: String?
        public let actionType: String?
        public let targetType: String?
        public let targetId: String?
        public let title: String?
        public let description: String?
        public let reason: String?
        public init(
            source: String? = nil,
            actionType: String? = nil,
            targetType: String? = nil,
            targetId: String? = nil,
            title: String? = nil,
            description: String? = nil,
            reason: String? = nil
        ) {
            self.source = source
            self.actionType = actionType
            self.targetType = targetType
            self.targetId = targetId
            self.title = title
            self.description = description
            self.reason = reason
        }
    }

    /// The 5 `WeeklyActionRecommendation['suggestedChange']` fields the fingerprint
    /// reads (training-model.ts:1087-1095). `volumeMultiplier` is intentionally
    /// omitted — the fingerprint never reads it.
    public struct SuggestedChange: Equatable, Sendable {
        public let muscleId: String?
        public let setsDelta: NumberRepr?
        public let exerciseIds: [String]?
        public let removeExerciseIds: [String]?
        public let supportDoseAdjustment: String?
        public init(
            muscleId: String? = nil,
            setsDelta: NumberRepr? = nil,
            exerciseIds: [String]? = nil,
            removeExerciseIds: [String]? = nil,
            supportDoseAdjustment: String? = nil
        ) {
            self.muscleId = muscleId
            self.setsDelta = setsDelta
            self.exerciseIds = exerciseIds
            self.removeExerciseIds = removeExerciseIds
            self.supportDoseAdjustment = supportDoseAdjustment
        }
    }

    /// `CoachActionFingerprintContext` (coachActionIdentityEngine.ts:9-18).
    public struct CoachActionFingerprintContext: Equatable, Sendable {
        public let sourceTemplateId: String?
        public let suggestedChange: SuggestedChange?
        public let suggestedChangeType: String?
        public let muscleId: String?
        public let exerciseId: String?
        public let templateId: String?
        public let weekId: String?
        public let cycleId: String?
        public init(
            sourceTemplateId: String? = nil,
            suggestedChange: SuggestedChange? = nil,
            suggestedChangeType: String? = nil,
            muscleId: String? = nil,
            exerciseId: String? = nil,
            templateId: String? = nil,
            weekId: String? = nil,
            cycleId: String? = nil
        ) {
            self.sourceTemplateId = sourceTemplateId
            self.suggestedChange = suggestedChange
            self.suggestedChangeType = suggestedChangeType
            self.muscleId = muscleId
            self.exerciseId = exerciseId
            self.templateId = templateId
            self.weekId = weekId
            self.cycleId = cycleId
        }
    }

    // MARK: - JS `||` short-circuit helpers (empty string is falsy)

    /// JS `a || b || … || literal`: first non-empty operand, else the literal.
    private static func jsOr(_ candidates: [String?], _ fallback: String) -> String {
        for c in candidates where !(c ?? "").isEmpty { return c! }
        return fallback
    }

    /// JS `a || b || c` WITHOUT a literal fallback: first non-empty operand, else
    /// the LAST operand verbatim (which may be nil or "" — JS `||` returns the last
    /// operand even when it is falsy). The downstream consumers re-apply `||` or
    /// normalize, so "" vs undefined never changes the fingerprint, but this mirrors
    /// the legacy web schema exactly.
    private static func jsOrLast(_ candidates: [String?]) -> String? {
        for c in candidates where !(c ?? "").isEmpty { return c }
        return candidates.last ?? nil
    }

    // MARK: - normalize / hash helpers

    /// ICU regex replace-all (mirrors JS `String.prototype.replace(/…/g, repl)`).
    /// Replacement strings here are literals ("-", " ", "") with no `$`/`\`.
    private static func replaceAll(_ value: String, _ pattern: String, _ replacement: String) -> String {
        // try! is safe: every pattern below is a compile-time literal validated here.
        let regex = try! NSRegularExpression(pattern: pattern)
        let range = NSRange(value.startIndex..., in: value)
        return regex.stringByReplacingMatches(in: value, options: [], range: range, withTemplate: replacement)
    }

    /// `normalizePart` (coachActionIdentityEngine.ts:20-27):
    /// `String(value ?? '').trim().toLowerCase().replace(/\s+/g,'-')`
    /// `.replace(/[^a-z0-9._:-]+/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'') || 'none'`.
    private static func normalizePart(_ value: String?) -> String {
        var s = value ?? ""                                       // String(value ?? '')
        s = s.trimmingCharacters(in: .whitespacesAndNewlines)     // .trim()
        s = s.lowercased()                                        // .toLowerCase()
        s = replaceAll(s, "\\s+", "-")                            // .replace(/\s+/g, '-')
        s = replaceAll(s, "[^a-z0-9._:-]+", "-")                  // .replace(/[^a-z0-9._:-]+/g, '-')
        s = replaceAll(s, "-+", "-")                              // .replace(/-+/g, '-')
        s = replaceAll(s, "^-|-$", "")                            // .replace(/^-|-$/g, '')
        return s.isEmpty ? "none" : s                             // || 'none'
    }

    /// `normalizeText` (coachActionIdentityEngine.ts:29-33):
    /// `String(value ?? '').trim().toLowerCase().replace(/\s+/g,' ')`.
    private static func normalizeText(_ value: String?) -> String {
        var s = value ?? ""
        s = s.trimmingCharacters(in: .whitespacesAndNewlines)
        s = s.lowercased()
        s = replaceAll(s, "\\s+", " ")
        return s
    }

    /// `stableHash` (coachActionIdentityEngine.ts:35-42) — FNV-1a over UTF-16 code
    /// units. legacy web schema: `let hash = 2166136261; hash ^= charCodeAt(i); hash = Math.imul(hash, 16777619)`
    /// then `(hash >>> 0).toString(16)`. The signed `Math.imul`/`^=`/`>>> 0` chain is
    /// bit-for-bit equal to UInt32 wrapping arithmetic: the offset basis `2166136261`
    /// has the same 32-bit pattern (0x811C9DC5) as its ToInt32 form, `^` is bitwise,
    /// `Math.imul` returns the low-32 bits of the product (= UInt32 `&*`), and `>>> 0`
    /// reinterprets the bits as unsigned. `charCodeAt` reads UTF-16 code units, so we
    /// iterate `String.utf16` (surrogate halves count individually, matching JS).
    private static func stableHash(_ value: String) -> String {
        var hash: UInt32 = 2166136261
        for unit in value.utf16 {
            hash ^= UInt32(unit)
            hash = hash &* 16777619
        }
        // `(hash >>> 0).toString(16)` — lowercase hex, no leading zeros, no prefix;
        // Swift `String(_:radix:)` matches (lowercase default).
        return String(hash, radix: 16)
    }

    /// `Number(change.setsDelta || 0)` (coachActionIdentityEngine.ts:47). JSON-parsed
    /// numbers are finite, so `x || 0` only ever maps a falsy 0/absent to 0 — and the
    /// caller compares sign only — so `doubleValue ?? 0` is faithful.
    private static func number(_ value: NumberRepr?) -> Double {
        value?.doubleValue ?? 0
    }

    // MARK: - suggestedChangeType (coachActionIdentityEngine.ts:44-53)

    private static func suggestedChangeType(_ change: SuggestedChange?, _ fallback: String?) -> String {
        if let fallback, !fallback.isEmpty { return fallback }      // if (fallback) return fallback
        guard let change else { return "none" }                     // if (!change) return 'none'
        let setsDelta = number(change.setsDelta)                    // Number(change.setsDelta || 0)
        if setsDelta > 0 { return "add_sets" }
        if setsDelta < 0 { return "remove_sets" }
        if let remove = change.removeExerciseIds, !remove.isEmpty { return "swap_exercise" } // removeExerciseIds?.length
        if let support = change.supportDoseAdjustment, !support.isEmpty { return "support_\(support)" }
        return "keep"
    }

    // MARK: - target resolution (coachActionIdentityEngine.ts:55-69)

    /// `targetTypeFromContext` (ts:55-60).
    private static func targetTypeFromContext(_ action: FingerprintAction, _ context: CoachActionFingerprintContext) -> String {
        if let m = context.muscleId, !m.isEmpty { return "muscle" }
        if let e = context.exerciseId, !e.isEmpty { return "exercise" }
        if let t = context.templateId, !t.isEmpty { return "template" }
        return jsOr([action.targetType], "none")                    // action.targetType || 'none'
    }

    /// `targetIdFromContext` (ts:62-69) — the `||` short-circuit chain in legacy web schema order.
    private static func targetIdFromContext(_ action: FingerprintAction, _ context: CoachActionFingerprintContext) -> String {
        jsOr([
            context.muscleId,
            context.exerciseId,
            context.templateId,
            action.targetId,
            context.suggestedChange?.muscleId,
            context.suggestedChange?.exerciseIds?.first,         // suggestedChange?.exerciseIds?.[0]
        ], "target-none")
    }

    /// `change?.exerciseIds?.join(',')` (ts:87). nil if change or exerciseIds is
    /// absent; "" for an empty array (JS `[].join(',') === ''`, which `||` treats falsy).
    private static func joinedExerciseIds(_ change: SuggestedChange?) -> String? {
        guard let ids = change?.exerciseIds else { return nil }
        return ids.joined(separator: ",")
    }

    // MARK: - buildCoachActionFingerprint (coachActionIdentityEngine.ts:71-91)

    public static func buildCoachActionFingerprint(
        _ action: FingerprintAction,
        _ context: CoachActionFingerprintContext = CoachActionFingerprintContext()
    ) -> String {
        // textSummary = normalizeText(action.reason || action.description || action.title)
        let textSummary = normalizeText(jsOrLast([action.reason, action.description, action.title]))
        // textDigest = stableHash(textSummary).slice(0, 10) — hex is ≤ 8 chars, so the
        // 10-char prefix is the whole digest, but we apply slice faithfully.
        let textDigest = String(stableHash(textSummary).prefix(10))
        let change = context.suggestedChange
        let parts: [String] = [
            normalizePart("coach-action"),
            normalizePart(action.source),
            normalizePart(action.actionType),
            normalizePart(targetTypeFromContext(action, context)),
            normalizePart(targetIdFromContext(action, context)),
            normalizePart(jsOr([context.sourceTemplateId], "template-unknown")),
            normalizePart(suggestedChangeType(change, context.suggestedChangeType)),
            normalizePart(jsOr([change?.muscleId, context.muscleId], "muscle-none")),
            normalizePart(jsOr([joinedExerciseIds(change), context.exerciseId], "exercise-none")),
            normalizePart(jsOr([context.weekId, context.cycleId], "current-cycle")),
            normalizePart(textDigest),
        ]
        return parts.joined(separator: "|")
    }

    // MARK: - firstChange / sourceFromRecommendationId / targetFromChange

    /// `firstChange` (ts:93-94): `(draft.changes || [])[0]`.
    private static func firstChange(_ changes: [AdjustmentChange]?) -> AdjustmentChange? {
        (changes ?? []).first
    }

    /// `sourceFromRecommendationId` (ts:96-102).
    private static func sourceFromRecommendationId(_ value: String?) -> String {
        let normalized = normalizeText(value)
        if normalized.contains("volume") { return "volumeAdaptation" }
        if normalized.contains("plateau") { return "plateau" }
        if normalized.contains("recovery") { return "recovery" }
        return "volumeAdaptation"
    }

    /// `targetFromChange` (ts:104-109).
    private static func targetFromChange(_ change: AdjustmentChange?) -> (targetType: String, targetId: String) {
        if let m = change?.muscleId, !m.isEmpty { return ("muscle", m) }
        if let e = change?.exerciseId, !e.isEmpty { return ("exercise", e) }
        if let d = change?.dayTemplateId, !d.isEmpty { return ("template", d) }
        return ("plan", "plan")
    }

    // MARK: - buildProgramAdjustmentDraftFingerprint (coachActionIdentityEngine.ts:111-133)

    public static func buildProgramAdjustmentDraftFingerprint(_ draft: ProgramAdjustmentDraft) -> String {
        if let fp = draft.sourceFingerprint, !fp.isEmpty { return fp }   // if (draft.sourceFingerprint) return it
        let change = firstChange(draft.changes)
        let target = targetFromChange(change)
        return buildCoachActionFingerprint(
            FingerprintAction(
                // sourceFromRecommendationId(draft.sourceRecommendationId || draft.selectedRecommendationIds?.[0])
                source: sourceFromRecommendationId(jsOrLast([draft.sourceRecommendationId, draft.selectedRecommendationIds?.first])),
                actionType: "create_plan_adjustment_preview",
                targetType: target.targetType,
                targetId: target.targetId,
                title: draft.title,
                description: draft.summary,
                // draft.explanation || change?.reason || draft.summary
                reason: jsOrLast([draft.explanation, change?.reason, draft.summary])
            ),
            CoachActionFingerprintContext(
                // draft.sourceTemplateId || draft.sourceProgramTemplateId
                sourceTemplateId: jsOrLast([draft.sourceTemplateId, draft.sourceProgramTemplateId]),
                suggestedChangeType: change?.type?.rawValue,            // change?.type (raw union token)
                muscleId: change?.muscleId,
                exerciseId: change?.exerciseId,
                templateId: change?.dayTemplateId
            )
        )
    }

    // MARK: - buildProgramAdjustmentHistoryFingerprint (coachActionIdentityEngine.ts:135-157)

    public static func buildProgramAdjustmentHistoryFingerprint(_ item: ProgramAdjustmentHistoryItem) -> String {
        if let fp = item.sourceFingerprint, !fp.isEmpty { return fp }   // if (item.sourceFingerprint) return it
        let change = firstChange(item.changes)
        let target = targetFromChange(change)
        return buildCoachActionFingerprint(
            FingerprintAction(
                source: sourceFromRecommendationId(item.selectedRecommendationIds?.first),
                actionType: "create_plan_adjustment_preview",
                targetType: target.targetType,
                targetId: target.targetId,
                // item.mainChangeSummary || item.experimentalProgramTemplateName || '计划调整'
                title: jsOr([item.mainChangeSummary, item.experimentalProgramTemplateName], "计划调整"),
                // item.explanation || item.mainChangeSummary || '计划调整'
                description: jsOr([item.explanation, item.mainChangeSummary], "计划调整"),
                // item.explanation || change?.reason || item.mainChangeSummary || '计划调整'
                reason: jsOr([item.explanation, change?.reason, item.mainChangeSummary], "计划调整")
            ),
            CoachActionFingerprintContext(
                sourceTemplateId: item.sourceProgramTemplateId,
                suggestedChangeType: change?.type?.rawValue,
                muscleId: change?.muscleId,
                exerciseId: change?.exerciseId,
                templateId: change?.dayTemplateId
            )
        )
    }

    // MARK: - draftStatusRank / draftTime (coachActionIdentityEngine.ts:159-168)

    private static func draftStatusRank(_ draft: ProgramAdjustmentDraft) -> Int {
        switch draft.status ?? "" {
        case "applied": return 50
        case "ready_to_apply", "previewed", "draft_created", "draft": return 40
        case "rolled_back": return 30
        case "dismissed": return 20
        case "expired", "stale": return 10
        default: return 0
        }
    }

    /// `draftTime` (ts:168): `draft.appliedAt || draft.createdAt || ''`.
    private static func draftTime(_ draft: ProgramAdjustmentDraft) -> String {
        jsOr([draft.appliedAt, draft.createdAt], "")
    }

    // MARK: - dedupeProgramAdjustmentDraftsByFingerprint (coachActionIdentityEngine.ts:170-186)

    public static func dedupeProgramAdjustmentDraftsByFingerprint(
        _ drafts: [ProgramAdjustmentDraft]
    ) -> [ProgramAdjustmentDraft] {
        // JS `Map`: keys keep first-insertion order; updating an existing key's value
        // does NOT move it. We mirror that with an `order` list (first-seen fingerprints)
        // + a `map`; `[...byFingerprint.values()]` then reads in first-insertion order.
        var order: [String] = []
        var map: [String: ProgramAdjustmentDraft] = [:]
        for draft in drafts {
            if (draft.status ?? "") == "recommendation" { continue }    // skip 'recommendation'
            let fingerprint = buildProgramAdjustmentDraftFingerprint(draft)
            guard let existing = map[fingerprint] else {
                order.append(fingerprint)
                map[fingerprint] = draft
                continue
            }
            let rankDiff = draftStatusRank(draft) - draftStatusRank(existing)
            // rankDiff > 0 || (rankDiff === 0 && draftTime(draft).localeCompare(draftTime(existing)) > 0)
            // localeCompare on same-format ISO strings == lexicographic, so Swift `>` reproduces it.
            if rankDiff > 0 || (rankDiff == 0 && draftTime(draft) > draftTime(existing)) {
                map[fingerprint] = draft
            }
        }
        let values = order.map { map[$0]! }
        // .sort((l, r) => draftTime(r).localeCompare(draftTime(l))) — time DESC, JS-stable
        // on ties. We carry the insertion index to keep the sort stable across equal times.
        return values.enumerated().sorted { left, right in
            let lt = draftTime(left.element)
            let rt = draftTime(right.element)
            if lt != rt { return lt > rt }
            return left.offset < right.offset
        }.map { $0.element }
    }
}
