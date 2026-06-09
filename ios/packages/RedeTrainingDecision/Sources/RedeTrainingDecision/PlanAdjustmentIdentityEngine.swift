// PlanAdjustmentIdentityEngine — PA-S6 plan-adjustment identity port.
//
// Faithful line-by-line Swift port of the PURE / read-only identity engine
// `retired web reference` (316 lines): EVERY export —
//   buildPlanAdjustmentFingerprint                  (ts:57)
//   buildPlanAdjustmentFingerprintFromCoachAction   (ts:81)
//   buildPlanAdjustmentFingerprintFromDraft         (ts:86)
//   buildPlanAdjustmentFingerprintFromHistory       (ts:89)
//   buildPlanAdjustmentFingerprintFromChange        (ts:303)
//   buildPlanAdjustmentDraftInstanceId              (ts:120)
//   upsertPlanAdjustmentDraftByFingerprint          (ts:168)  + the Outcome union (ts:130) + Result (ts:136)
//   findReusablePlanAdjustmentDraft                 (ts:258)
//   buildRegeneratedPlanAdjustmentDraft            (ts:271)
//   dedupePlanAdjustmentDraftsByFingerprint         (ts:92, an alias)
// plus every private helper (targetFromInput ts:36 / sourceFromInput ts:49 /
// newestDraft ts:99 / draftTime ts:97 / stableHash ts:102 / stableIdPart ts:111 /
// draftFingerprintEquals ts:145 / historyFingerprintEquals ts:148 /
// normalizeDraftForUpsert ts:151).
//
// REUSES (never re-ports) the PA-S5 CoachActionIdentityEngine fingerprint family:
// every `buildPlanAdjustmentFingerprint*` flows into the S5 `buildCoachActionFingerprint`
// / `buildProgramAdjustmentDraftFingerprint` / `buildProgramAdjustmentHistoryFingerprint`,
// and `dedupePlanAdjustmentDraftsByFingerprint` is a thin alias of the S5
// `dedupeProgramAdjustmentDraftsByFingerprint`. The FNV-1a fingerprint algorithm is
// NOT re-implemented here — only the engine's OWN private `stableHash`/`stableIdPart`
// slug helpers (ts:102-118, a distinct id-slug FNV that the legacy web schema file duplicates) are
// ported. The CoachAction model is NOT ported: `buildPlanAdjustmentFingerprintFromCoachAction`
// takes the same 7-field `FingerprintAction` Pick the S5 engine exposes plus the one
// extra field it reads (`sourceFingerprint`) as a separate parameter.
//
// REUSES the PA-S1 RedeDomain types verbatim: ProgramAdjustmentDraft /
// ProgramAdjustmentHistoryItem / AdjustmentChange / NumberRepr / JSONValue. The
// input's `suggestedChange` is carried as raw `JSONValue?` (the S1
// WeeklyActionRecommendation.suggestedChange precedent) and its subfields are read
// through the JSONValue accessors, then bridged to the S5 `SuggestedChange` value.
//
// TIME INJECTION (§11): `buildRegeneratedPlanAdjustmentDraft` is the ONLY function the
// legacy web schema file reads a wall clock in (`const now = options.now || new Date().toISOString()`,
// ts:286). The Swift port DOES NOT replicate the wall-clock fallback: `now` is a
// REQUIRED injected `String` (the asOfDate / injected-clock contract, cf. iOS-17e-6a).
// LIVE callers MUST pass a non-empty injected `nowIso`; the `nil`/wall-clock branch is
// legacy web schema-only behaviour that the native port intentionally does not carry.
//
// PURE / READ-ONLY: only string + number + array transforms. Zero `: Date`, zero
// Calendar, zero IO, zero randomness, NO write path, NO CanonicalSessionWriter — §11
// DERIVED-only. Every returned `drafts` list is a pure value, never persisted. Goldens
// are GENERATED from the retired legacy engine (frozen legacy fixture generator), never
// hand-edited (§22).

import Foundation
import RedeDomain

public enum PlanAdjustmentIdentityEngine {

    // Convenience aliases for the PA-S5 reused value types.
    public typealias FingerprintAction = CoachActionIdentityEngine.FingerprintAction
    public typealias CoachActionFingerprintContext = CoachActionIdentityEngine.CoachActionFingerprintContext
    public typealias SuggestedChange = CoachActionIdentityEngine.SuggestedChange

    // MARK: - PlanAdjustmentFingerprintInput (planAdjustmentIdentityEngine.ts:16-34)

    /// The fingerprint input shape (ts:16-34). `actionType`/`source` are the
    /// `CoachActionType|string` / `CoachActionSource|string` unions → `String?`
    /// (the lossless union→String precedent). `suggestedChange` mirrors the legacy web schema
    /// `WeeklyActionRecommendation['suggestedChange']` as raw `JSONValue?`.
    public struct PlanAdjustmentFingerprintInput: Equatable, Sendable {
        public let sourceCoachActionId: String?
        public let actionType: String?
        public let source: String?
        public let sourceTemplateId: String?
        public let sourceProgramTemplateId: String?
        public let targetTemplateId: String?
        public let targetDayTemplateId: String?
        public let targetExerciseId: String?
        public let targetMuscleId: String?
        public let suggestedChangeType: String?
        public let suggestedChange: JSONValue?
        public let weekId: String?
        public let cycleId: String?
        public let changeSummary: String?
        public let reason: String?
        public let title: String?
        public let description: String?
        public init(
            sourceCoachActionId: String? = nil,
            actionType: String? = nil,
            source: String? = nil,
            sourceTemplateId: String? = nil,
            sourceProgramTemplateId: String? = nil,
            targetTemplateId: String? = nil,
            targetDayTemplateId: String? = nil,
            targetExerciseId: String? = nil,
            targetMuscleId: String? = nil,
            suggestedChangeType: String? = nil,
            suggestedChange: JSONValue? = nil,
            weekId: String? = nil,
            cycleId: String? = nil,
            changeSummary: String? = nil,
            reason: String? = nil,
            title: String? = nil,
            description: String? = nil
        ) {
            self.sourceCoachActionId = sourceCoachActionId
            self.actionType = actionType
            self.source = source
            self.sourceTemplateId = sourceTemplateId
            self.sourceProgramTemplateId = sourceProgramTemplateId
            self.targetTemplateId = targetTemplateId
            self.targetDayTemplateId = targetDayTemplateId
            self.targetExerciseId = targetExerciseId
            self.targetMuscleId = targetMuscleId
            self.suggestedChangeType = suggestedChangeType
            self.suggestedChange = suggestedChange
            self.weekId = weekId
            self.cycleId = cycleId
            self.changeSummary = changeSummary
            self.reason = reason
            self.title = title
            self.description = description
        }
    }

    // MARK: - JS `||` short-circuit helpers (empty string is falsy)

    /// JS `a || b || … || literal`: first non-empty operand, else the literal.
    private static func jsOr(_ candidates: [String?], _ fallback: String) -> String {
        for c in candidates where !(c ?? "").isEmpty { return c! }
        return fallback
    }

    /// JS `a || b || c` WITHOUT a literal fallback: first non-empty operand, else
    /// the LAST operand verbatim (which may be nil/"" — JS `||` returns the last
    /// operand even when falsy). Mirrors the S5 helper of the same name.
    private static func jsOrLast(_ candidates: [String?]) -> String? {
        for c in candidates where !(c ?? "").isEmpty { return c }
        return candidates.last ?? nil
    }

    // MARK: - suggestedChange bridge (raw JSONValue → S5 SuggestedChange)

    /// Reads the 5 fingerprint-relevant subfields of `input.suggestedChange`
    /// through the JSONValue accessors and bridges to the S5 `SuggestedChange`.
    /// nil when the raw value is absent / null / not an object — so the JS
    /// `change?` vs `change={}` distinction (undefined → 'none' vs {} → 'keep')
    /// is preserved (a present-but-empty object decodes to a non-nil all-nil
    /// SuggestedChange).
    private static func bridgeSuggestedChange(_ raw: JSONValue?) -> SuggestedChange? {
        guard let obj = raw?.objectValue else { return nil }
        return SuggestedChange(
            muscleId: obj["muscleId"]?.stringValue,
            setsDelta: obj["setsDelta"]?.numberValue,
            exerciseIds: obj["exerciseIds"]?.arrayValue?.compactMap { $0.stringValue },
            removeExerciseIds: obj["removeExerciseIds"]?.arrayValue?.compactMap { $0.stringValue },
            supportDoseAdjustment: obj["supportDoseAdjustment"]?.stringValue
        )
    }

    // MARK: - targetFromInput (planAdjustmentIdentityEngine.ts:36-47)

    /// muscle → exercise → template → plan precedence, with the
    /// `suggestedChange.muscleId` / `suggestedChange.exerciseIds[0]` fallbacks.
    private static func targetFromInput(
        _ input: PlanAdjustmentFingerprintInput,
        _ change: SuggestedChange?
    ) -> (targetType: String, targetId: String?) {
        // if (input.targetMuscleId || input.suggestedChange?.muscleId)
        let muscle = jsOrLast([input.targetMuscleId, change?.muscleId])
        if !(muscle ?? "").isEmpty {
            return ("muscle", muscle)
        }
        // if (input.targetExerciseId || input.suggestedChange?.exerciseIds?.[0])
        let exercise = jsOrLast([input.targetExerciseId, change?.exerciseIds?.first])
        if !(exercise ?? "").isEmpty {
            return ("exercise", exercise)
        }
        // if (input.targetDayTemplateId || input.targetTemplateId)
        let template = jsOrLast([input.targetDayTemplateId, input.targetTemplateId])
        if !(template ?? "").isEmpty {
            return ("template", template)
        }
        // input.sourceTemplateId || input.sourceProgramTemplateId || 'plan'
        return ("plan", jsOr([input.sourceTemplateId, input.sourceProgramTemplateId], "plan"))
    }

    // MARK: - sourceFromInput (planAdjustmentIdentityEngine.ts:49-55)

    private static func sourceFromInput(_ input: PlanAdjustmentFingerprintInput) -> String {
        switch input.source {                                   // strict `===` chain
        case "plateau": return "plateau"
        case "recovery": return "recovery"
        case "dataHealth": return "dataHealth"
        case "dailyAdjustment": return "dailyAdjustment"
        default: return "volumeAdaptation"
        }
    }

    // MARK: - buildPlanAdjustmentFingerprint (planAdjustmentIdentityEngine.ts:57-79)

    public static func buildPlanAdjustmentFingerprint(_ input: PlanAdjustmentFingerprintInput) -> String {
        let change = bridgeSuggestedChange(input.suggestedChange)
        let target = targetFromInput(input, change)
        let action = FingerprintAction(
            source: sourceFromInput(input),                                    // ts:60
            actionType: jsOr([input.actionType], "create_plan_adjustment_preview"), // ts:61
            targetType: target.targetType,                                     // ts:62
            targetId: target.targetId,                                         // ts:63
            title: jsOr([input.title, input.changeSummary], "计划调整"),        // ts:64
            description: jsOr([input.description, input.changeSummary, input.reason], "计划调整"), // ts:65
            reason: jsOr([input.reason, input.changeSummary, input.description], "计划调整")       // ts:66
        )
        let context = CoachActionFingerprintContext(
            sourceTemplateId: jsOrLast([input.sourceTemplateId, input.sourceProgramTemplateId]), // ts:69
            suggestedChange: change,                                           // ts:70
            suggestedChangeType: input.suggestedChangeType,                    // ts:71
            muscleId: input.targetMuscleId,                                    // ts:72
            exerciseId: input.targetExerciseId,                               // ts:73
            templateId: jsOrLast([input.targetDayTemplateId, input.targetTemplateId]), // ts:74
            weekId: input.weekId,                                             // ts:75
            cycleId: input.cycleId                                            // ts:76
        )
        return CoachActionIdentityEngine.buildCoachActionFingerprint(action, context) // ts:78 (S5)
    }

    // MARK: - buildPlanAdjustmentFingerprintFromCoachAction (planAdjustmentIdentityEngine.ts:81-84)

    /// `action.sourceFingerprint || buildCoachActionFingerprint(action, context)`.
    /// The legacy web schema `action` is a full `CoachAction`; the only field it reads beyond the
    /// 7-field `FingerprintAction` Pick is `sourceFingerprint`, taken here as a
    /// separate parameter so the full CoachAction model stays unported.
    public static func buildPlanAdjustmentFingerprintFromCoachAction(
        _ action: FingerprintAction,
        sourceFingerprint: String? = nil,
        _ context: CoachActionFingerprintContext = CoachActionFingerprintContext()
    ) -> String {
        if let fp = sourceFingerprint, !fp.isEmpty { return fp }    // action.sourceFingerprint ||
        return CoachActionIdentityEngine.buildCoachActionFingerprint(action, context)
    }

    // MARK: - draft / history fingerprint forwarders (planAdjustmentIdentityEngine.ts:86-90)

    public static func buildPlanAdjustmentFingerprintFromDraft(_ draft: ProgramAdjustmentDraft) -> String {
        CoachActionIdentityEngine.buildProgramAdjustmentDraftFingerprint(draft)        // ts:87 (S5)
    }

    public static func buildPlanAdjustmentFingerprintFromHistory(_ item: ProgramAdjustmentHistoryItem) -> String {
        CoachActionIdentityEngine.buildProgramAdjustmentHistoryFingerprint(item)       // ts:90 (S5)
    }

    // MARK: - dedupePlanAdjustmentDraftsByFingerprint (planAdjustmentIdentityEngine.ts:92, alias)

    /// `export const dedupePlanAdjustmentDraftsByFingerprint = dedupeProgramAdjustmentDraftsByFingerprint`.
    public static func dedupePlanAdjustmentDraftsByFingerprint(
        _ drafts: [ProgramAdjustmentDraft]
    ) -> [ProgramAdjustmentDraft] {
        CoachActionIdentityEngine.dedupeProgramAdjustmentDraftsByFingerprint(drafts)   // ts:92 (S5 alias)
    }

    // MARK: - status sets (planAdjustmentIdentityEngine.ts:94-95)

    private static let reusableDraftStatuses: Set<String> = ["draft_created", "ready_to_apply", "draft", "previewed"]
    private static let handledDraftStatuses: Set<String> = ["dismissed", "expired", "stale"]

    // MARK: - draftTime / newestDraft (planAdjustmentIdentityEngine.ts:97-100)

    /// `draft.appliedAt || draft.rolledBackAt || draft.createdAt || ''` (ts:97).
    /// NOTE: this is the PA-S6 engine's OWN draftTime (it includes rolledBackAt),
    /// distinct from the S5 dedupe draftTime (appliedAt||createdAt||'').
    private static func draftTime(_ draft: ProgramAdjustmentDraft) -> String {
        jsOr([draft.appliedAt, draft.rolledBackAt, draft.createdAt], "")
    }

    /// `[...drafts].sort((l, r) => draftTime(r).localeCompare(draftTime(l)))[0]` (ts:99-100).
    /// localeCompare on same-format ISO strings == lexicographic, so ordinal `>`
    /// reproduces it. JS `.sort` is stable on equal times — carry the original
    /// index to keep ties in insertion order, then take the first element.
    private static func newestDraft(_ drafts: [ProgramAdjustmentDraft]) -> ProgramAdjustmentDraft? {
        drafts.enumerated().sorted { left, right in
            let lt = draftTime(left.element)
            let rt = draftTime(right.element)
            if lt != rt { return lt > rt }
            return left.offset < right.offset
        }.first?.element
    }

    // MARK: - stableHash / stableIdPart (planAdjustmentIdentityEngine.ts:102-118)

    /// `stableHash` (ts:102-109) — FNV-1a over UTF-16 code units. The engine's OWN
    /// id-slug hash (the legacy web schema file duplicates the S5 stableHash verbatim; the S5 copy
    /// is private so we port this one locally). UInt32 wrapping arithmetic is
    /// bit-for-bit equal to the signed `Math.imul`/`^=`/`>>> 0` chain; `charCodeAt`
    /// reads UTF-16 code units so we iterate `String.utf16`. `(hash>>>0).toString(16)`
    /// → lowercase hex, no leading zeros, no prefix.
    private static func stableHash(_ value: String) -> String {
        var hash: UInt32 = 2166136261
        for unit in value.utf16 {
            hash ^= UInt32(unit)
            hash = hash &* 16777619
        }
        return String(hash, radix: 16)
    }

    /// `stableIdPart` (ts:111-118):
    /// `value.trim().toLowerCase().replace(/[^a-z0-9_-]+/g,'-').replace(/-+/g,'-')`
    /// `.replace(/^-|-$/g,'').slice(0,48) || stableHash(value)`.
    /// The cleaned string is pure ASCII `[a-z0-9_-]`, so slice(0,48) == Character
    /// prefix(48). The `|| stableHash(value)` fallback hashes the ORIGINAL value.
    private static func stableIdPart(_ value: String) -> String {
        var s = value
        s = s.trimmingCharacters(in: .whitespacesAndNewlines)     // .trim()
        s = s.lowercased()                                        // .toLowerCase()
        s = replaceAll(s, "[^a-z0-9_-]+", "-")                    // .replace(/[^a-z0-9_-]+/g, '-')
        s = replaceAll(s, "-+", "-")                              // .replace(/-+/g, '-')
        s = replaceAll(s, "^-|-$", "")                            // .replace(/^-|-$/g, '')
        let sliced = String(s.prefix(48))                         // .slice(0, 48) — ASCII slug
        return sliced.isEmpty ? stableHash(value) : sliced        // || stableHash(value)
    }

    /// ICU regex replace-all (mirrors JS `String.prototype.replace(/…/g, repl)`).
    /// Replacement strings here are literals ("-", "") with no `$`/`\`.
    private static func replaceAll(_ value: String, _ pattern: String, _ replacement: String) -> String {
        let regex = try! NSRegularExpression(pattern: pattern)
        let range = NSRange(value.startIndex..., in: value)
        return regex.stringByReplacingMatches(in: value, options: [], range: range, withTemplate: replacement)
    }

    // MARK: - buildPlanAdjustmentDraftInstanceId (planAdjustmentIdentityEngine.ts:120-128)

    /// `now`-free, deterministic. `revision` mirrors the legacy web schema `revision = 1` default
    /// and the `Math.max(1, Math.round(revision))` clamp. `Math.round` is half-up
    /// toward +∞ — `floor(revision + 0.5)` reproduces it for negatives too (e.g.
    /// round(-0.5) = -0 → 0 → max(1,0) = 1). `parentDraftId` is sliced to 24 UTF-16
    /// units (ASCII slug → Character prefix(24) is identical).
    public static func buildPlanAdjustmentDraftInstanceId(
        _ sourceFingerprint: String,
        _ revision: Double = 1,
        _ parentDraftId: String? = nil
    ) -> String {
        let fingerprintPart = stableIdPart(sourceFingerprint)                    // ts:125
        let parentPart: String                                                  // ts:126
        if let parent = parentDraftId, !parent.isEmpty {
            parentPart = "-" + String(stableIdPart(parent).prefix(24))          // `-${stableIdPart(parentDraftId).slice(0,24)}`
        } else {
            parentPart = ""
        }
        let rounded = (revision + 0.5).rounded(.down)                           // Math.round(revision)
        let rev = Int(Swift.max(1.0, rounded))                                  // Math.max(1, …)
        return "adjustment-draft-\(fingerprintPart)\(parentPart)-r\(rev)"       // ts:127
    }

    // MARK: - Upsert outcome union + result (planAdjustmentIdentityEngine.ts:130-143)

    public enum PlanAdjustmentDraftUpsertOutcome: String, Equatable, Sendable {
        case created
        case openedExisting = "opened_existing"
        case alreadyApplied = "already_applied"
        case previouslyHandled = "previously_handled"
    }

    public struct PlanAdjustmentDraftUpsertResult: Equatable, Sendable {
        public let drafts: [ProgramAdjustmentDraft]
        public let sourceFingerprint: String
        public let targetDraft: ProgramAdjustmentDraft?
        public let historyItem: ProgramAdjustmentHistoryItem?
        public let outcome: PlanAdjustmentDraftUpsertOutcome
        public let createdDraft: ProgramAdjustmentDraft?
        public init(
            drafts: [ProgramAdjustmentDraft],
            sourceFingerprint: String,
            targetDraft: ProgramAdjustmentDraft? = nil,
            historyItem: ProgramAdjustmentHistoryItem? = nil,
            outcome: PlanAdjustmentDraftUpsertOutcome,
            createdDraft: ProgramAdjustmentDraft? = nil
        ) {
            self.drafts = drafts
            self.sourceFingerprint = sourceFingerprint
            self.targetDraft = targetDraft
            self.historyItem = historyItem
            self.outcome = outcome
            self.createdDraft = createdDraft
        }
    }

    // MARK: - draftFingerprintEquals / historyFingerprintEquals (planAdjustmentIdentityEngine.ts:145-149)

    /// `(draft.sourceFingerprint || buildPlanAdjustmentFingerprintFromDraft(draft)) === sourceFingerprint`.
    private static func draftFingerprintEquals(_ draft: ProgramAdjustmentDraft, _ sourceFingerprint: String) -> Bool {
        let actual: String
        if let fp = draft.sourceFingerprint, !fp.isEmpty { actual = fp }
        else { actual = buildPlanAdjustmentFingerprintFromDraft(draft) }
        return actual == sourceFingerprint
    }

    /// `(item.sourceFingerprint || buildPlanAdjustmentFingerprintFromHistory(item)) === sourceFingerprint`.
    private static func historyFingerprintEquals(_ item: ProgramAdjustmentHistoryItem, _ sourceFingerprint: String) -> Bool {
        let actual: String
        if let fp = item.sourceFingerprint, !fp.isEmpty { actual = fp }
        else { actual = buildPlanAdjustmentFingerprintFromHistory(item) }
        return actual == sourceFingerprint
    }

    // MARK: - JS number helpers for revision arithmetic

    /// `n || 1` over a JS number — 0 / absent → 1, any other value verbatim.
    private static func revisionOrOne(_ n: NumberRepr?) -> Double {
        let v = n?.doubleValue ?? 0
        return v != 0 ? v : 1
    }

    /// JS `${number}` for a value known to be integral in every fixture path
    /// (revision = max(int…)+1). Integers print without a decimal (JSON.stringify
    /// collapse), matching the golden ids.
    private static func jsNumberString(_ d: Double) -> String {
        if d == d.rounded() && abs(d) < 9_007_199_254_740_992 { return String(Int64(d)) }
        return String(d)
    }

    /// JS number → NumberRepr for re-encoding (whole → .integer, matching the
    /// JSON.stringify integer-collapse the golden uses).
    private static func numberRepr(_ d: Double) -> NumberRepr {
        if d == d.rounded() && abs(d) < 9_007_199_254_740_992 { return .integer(Int64(d)) }
        return .double(d)
    }

    // MARK: - normalizeDraftForUpsert (planAdjustmentIdentityEngine.ts:151-166)

    private static func normalizeDraftForUpsert(
        _ draft: ProgramAdjustmentDraft,
        _ sourceFingerprint: String,
        _ drafts: [ProgramAdjustmentDraft]
    ) -> ProgramAdjustmentDraft {
        let sameSourceDrafts = drafts.filter { draftFingerprintEquals($0, sourceFingerprint) } // ts:156
        // revision = draft.draftRevision || Math.max(0, ...sameSource.map(r||1)) + 1
        // (`+` binds tighter than `||`, so the +1 is inside the right operand).
        let revision: Double
        let dr = revisionOrOneRaw(draft.draftRevision)              // draft.draftRevision (0/absent → falsy)
        if dr != 0 {
            revision = dr
        } else {
            let maxRev = sameSourceDrafts.map { revisionOrOne($0.draftRevision) }
                .reduce(0.0) { Swift.max($0, $1) }                 // Math.max(0, …)
            revision = maxRev + 1
        }
        return copyDraft(
            draft,
            id: buildPlanAdjustmentDraftInstanceId(sourceFingerprint, revision, draft.parentDraftId), // ts:162
            draftRevision: .set(numberRepr(revision)),             // ts:163
            sourceFingerprint: .set(sourceFingerprint)             // ts:164
        )
    }

    /// `draft.draftRevision` truthiness for the `||` LHS — raw value (0 stays 0
    /// so the `|| max+1` branch fires), absent → 0.
    private static func revisionOrOneRaw(_ n: NumberRepr?) -> Double {
        n?.doubleValue ?? 0
    }

    // MARK: - upsertPlanAdjustmentDraftByFingerprint (planAdjustmentIdentityEngine.ts:168-256)

    public static func upsertPlanAdjustmentDraftByFingerprint(
        drafts: [ProgramAdjustmentDraft] = [],
        adjustmentHistory: [ProgramAdjustmentHistoryItem] = [],
        candidateDraft: ProgramAdjustmentDraft,
        sourceFingerprint: String? = nil
    ) -> PlanAdjustmentDraftUpsertResult {
        // sourceFingerprint default (ts:172):
        // candidateDraft.sourceFingerprint || buildPlanAdjustmentFingerprintFromDraft(candidateDraft)
        let fp: String
        if let provided = sourceFingerprint {
            fp = provided
        } else if let cfp = candidateDraft.sourceFingerprint, !cfp.isEmpty {
            fp = cfp
        } else {
            fp = buildPlanAdjustmentFingerprintFromDraft(candidateDraft)
        }

        let matchingDrafts = drafts.filter { draftFingerprintEquals($0, fp) }      // ts:174

        // parent existingChild (reusable) — ts:176-192
        if let parentId = candidateDraft.parentDraftId, !parentId.isEmpty {
            let existingChild = newestDraft(matchingDrafts.filter { draft in
                draft.parentDraftId == candidateDraft.parentDraftId
                    && reusableDraftStatuses.contains(draft.status ?? "")
            })
            if let existingChild {
                return PlanAdjustmentDraftUpsertResult(
                    drafts: drafts, sourceFingerprint: fp, targetDraft: existingChild, outcome: .openedExisting
                )
            }
        }

        // activeDraft (reusable) — ts:194-202
        let activeDraft = newestDraft(matchingDrafts.filter { reusableDraftStatuses.contains($0.status ?? "") })
        if let activeDraft {
            return PlanAdjustmentDraftUpsertResult(
                drafts: drafts, sourceFingerprint: fp, targetDraft: activeDraft, outcome: .openedExisting
            )
        }

        // appliedDraft (status === 'applied') — ts:204-212
        let appliedDraft = newestDraft(matchingDrafts.filter { $0.status == "applied" })
        if let appliedDraft {
            return PlanAdjustmentDraftUpsertResult(
                drafts: drafts, sourceFingerprint: fp, targetDraft: appliedDraft, outcome: .alreadyApplied
            )
        }

        // appliedHistory (history, not rolled_back & no rolledBackAt) — ts:214-224
        let appliedHistory = adjustmentHistory.first { item in
            historyFingerprintEquals(item, fp)
                && item.status != "rolled_back"
                && (item.rolledBackAt ?? "").isEmpty            // !item.rolledBackAt
        }
        if let appliedHistory {
            return PlanAdjustmentDraftUpsertResult(
                drafts: drafts, sourceFingerprint: fp, historyItem: appliedHistory, outcome: .alreadyApplied
            )
        }

        // handledDraft — ts:226-234
        let handledDraft = newestDraft(matchingDrafts.filter { handledDraftStatuses.contains($0.status ?? "") })
        if let handledDraft {
            return PlanAdjustmentDraftUpsertResult(
                drafts: drafts, sourceFingerprint: fp, targetDraft: handledDraft, outcome: .previouslyHandled
            )
        }

        // rolledBackDraft (only when candidate has no parent) — ts:236-246
        if (candidateDraft.parentDraftId ?? "").isEmpty {
            let rolledBackDraft = newestDraft(matchingDrafts.filter { $0.status == "rolled_back" })
            if let rolledBackDraft {
                return PlanAdjustmentDraftUpsertResult(
                    drafts: drafts, sourceFingerprint: fp, targetDraft: rolledBackDraft, outcome: .previouslyHandled
                )
            }
        }

        // create — ts:248-255
        let draft = normalizeDraftForUpsert(candidateDraft, fp, drafts)
        let nextDrafts = [draft] + drafts.filter { $0.id != draft.id }          // [draft, ...drafts.filter(id !== draft.id)]
        return PlanAdjustmentDraftUpsertResult(
            drafts: nextDrafts, sourceFingerprint: fp, targetDraft: draft, outcome: .created, createdDraft: draft
        )
    }

    // MARK: - findReusablePlanAdjustmentDraft (planAdjustmentIdentityEngine.ts:258-269)

    public static func findReusablePlanAdjustmentDraft(
        _ sourceDraft: ProgramAdjustmentDraft,
        _ drafts: [ProgramAdjustmentDraft] = []
    ) -> ProgramAdjustmentDraft? {
        let fp: String
        if let s = sourceDraft.sourceFingerprint, !s.isEmpty { fp = s }
        else { fp = buildPlanAdjustmentFingerprintFromDraft(sourceDraft) }       // ts:262
        return newestDraft(drafts.filter { item in
            if item.id == sourceDraft.id { return false }                       // ts:264
            let itemFp: String
            if let s = item.sourceFingerprint, !s.isEmpty { itemFp = s }
            else { itemFp = buildPlanAdjustmentFingerprintFromDraft(item) }     // ts:265
            if itemFp != fp || !reusableDraftStatuses.contains(item.status ?? "") { return false } // ts:266
            // sourceDraft.status !== 'rolled_back' || !sourceDraft.id || item.parentDraftId === sourceDraft.id
            return sourceDraft.status != "rolled_back"
                || (sourceDraft.id ?? "").isEmpty
                || item.parentDraftId == sourceDraft.id                         // ts:267
        })
    }

    // MARK: - buildRegeneratedPlanAdjustmentDraft (planAdjustmentIdentityEngine.ts:271-301)

    public struct RegeneratedPlanAdjustmentDraft: Equatable, Sendable {
        public let sourceFingerprint: String
        public let existingDraft: ProgramAdjustmentDraft?
        public let draft: ProgramAdjustmentDraft?
        public init(sourceFingerprint: String, existingDraft: ProgramAdjustmentDraft? = nil, draft: ProgramAdjustmentDraft? = nil) {
            self.sourceFingerprint = sourceFingerprint
            self.existingDraft = existingDraft
            self.draft = draft
        }
    }

    /// `now` is a REQUIRED injected ISO string — the legacy web schema `options.now || new Date()`
    /// wall-clock fallback (ts:286) is intentionally NOT replicated (§11). LIVE
    /// callers MUST pass a non-empty `nowIso`.
    public static func buildRegeneratedPlanAdjustmentDraft(
        _ sourceDraft: ProgramAdjustmentDraft,
        _ drafts: [ProgramAdjustmentDraft] = [],
        now: String,
        draftId: String? = nil
    ) -> RegeneratedPlanAdjustmentDraft {
        let fp: String
        if let s = sourceDraft.sourceFingerprint, !s.isEmpty { fp = s }
        else { fp = buildPlanAdjustmentFingerprintFromDraft(sourceDraft) }       // ts:276
        if let existingDraft = findReusablePlanAdjustmentDraft(sourceDraft, drafts) { // ts:277-280
            return RegeneratedPlanAdjustmentDraft(sourceFingerprint: fp, existingDraft: existingDraft)
        }
        // sameSourceDrafts — ts:282-284
        let sameSourceDrafts = drafts.filter { item in
            let itemFp: String
            if let s = item.sourceFingerprint, !s.isEmpty { itemFp = s }
            else { itemFp = buildPlanAdjustmentFingerprintFromDraft(item) }
            return itemFp == fp
        }
        // nextRevision = Math.max(1, ...sameSource.map(r||1)) + 1  — ts:285
        let maxRev = sameSourceDrafts.map { revisionOrOne($0.draftRevision) }
            .reduce(1.0) { Swift.max($0, $1) }
        let nextRevision = maxRev + 1
        // id = options.draftId || `adjustment-draft-${sourceDraft.id}-r${nextRevision}` — ts:289
        let nextId = jsOr(
            [draftId],
            "adjustment-draft-\(sourceDraft.id ?? "undefined")-r\(jsNumberString(nextRevision))"
        )
        let nextDraft = copyDraft(
            sourceDraft,
            id: nextId,                                                          // ts:289
            parentDraftId: .set(sourceDraft.id),                                // ts:290
            draftRevision: .set(numberRepr(nextRevision)),                      // ts:291
            createdAt: now,                                                     // ts:292 (injected, no wall clock)
            status: "ready_to_apply",                                           // ts:293
            sourceFingerprint: .set(fp),                                        // ts:294
            appliedAt: .clear,                                                  // ts:295 (undefined)
            rolledBackAt: .clear,                                               // ts:296 (undefined)
            experimentalProgramTemplateId: .clear                              // ts:297 (undefined)
        )
        return RegeneratedPlanAdjustmentDraft(sourceFingerprint: fp, draft: nextDraft)  // ts:300
    }

    // MARK: - buildPlanAdjustmentFingerprintFromChange (planAdjustmentIdentityEngine.ts:303-315)

    /// `input` mirrors the legacy web schema `Pick<…, 'source'|'sourceCoachActionId'|'sourceTemplateId'|
    /// 'sourceProgramTemplateId'|'weekId'|'cycleId'>` — only those 6 fields are read.
    public static func buildPlanAdjustmentFingerprintFromChange(
        _ change: AdjustmentChange,
        _ input: PlanAdjustmentFingerprintInput = PlanAdjustmentFingerprintInput()
    ) -> String {
        // { ...input, actionType, targetMuscleId, targetExerciseId, targetDayTemplateId,
        //   suggestedChangeType, changeSummary } — ts:307-315
        buildPlanAdjustmentFingerprint(PlanAdjustmentFingerprintInput(
            sourceCoachActionId: input.sourceCoachActionId,
            actionType: "create_plan_adjustment_preview",                       // ts:309
            source: input.source,
            sourceTemplateId: input.sourceTemplateId,
            sourceProgramTemplateId: input.sourceProgramTemplateId,
            targetDayTemplateId: change.dayTemplateId,                          // ts:312
            targetExerciseId: change.exerciseId,                               // ts:311
            targetMuscleId: change.muscleId,                                   // ts:310
            suggestedChangeType: change.type?.rawValue,                        // ts:313 (raw union token)
            weekId: input.weekId,
            cycleId: input.cycleId,
            changeSummary: jsOrLast([change.reason, change.previewNote])       // ts:314
        ))
    }

    // MARK: - copyDraft (faithful `{ ...sourceDraft, overrides }` spread)

    /// A three-way override marker mirroring the JS spread: `.keep` = copy the
    /// source field, `.set(v)` = override with v, `.clear` = override with
    /// undefined (omitted on encode).
    private enum FieldOverride<T> {
        case keep
        case set(T?)
        case clear
        func resolve(_ source: T?) -> T? {
            switch self {
            case .keep: return source
            case .set(let v): return v
            case .clear: return nil
            }
        }
    }

    /// Reproduces `{ ...sourceDraft, <overrides> }` over the typed
    /// ProgramAdjustmentDraft (every field copied; `_unknown` open bag preserved).
    /// Convenience overload: only the fields the two callers override are exposed.
    private static func copyDraft(
        _ source: ProgramAdjustmentDraft,
        id: String,
        parentDraftId: FieldOverride<String> = .keep,
        draftRevision: FieldOverride<NumberRepr> = .keep,
        createdAt: String? = nil,
        status: String? = nil,
        sourceFingerprint: FieldOverride<String> = .keep,
        appliedAt: FieldOverride<String> = .keep,
        rolledBackAt: FieldOverride<String> = .keep,
        experimentalProgramTemplateId: FieldOverride<String> = .keep
    ) -> ProgramAdjustmentDraft {
        ProgramAdjustmentDraft(
            id: id,
            parentDraftId: parentDraftId.resolve(source.parentDraftId),
            draftRevision: draftRevision.resolve(source.draftRevision),
            createdAt: createdAt ?? source.createdAt,
            status: status ?? source.status,
            sourceProgramTemplateId: source.sourceProgramTemplateId,
            sourceTemplateId: source.sourceTemplateId,
            sourceCoachActionId: source.sourceCoachActionId,
            sourceRecommendationId: source.sourceRecommendationId,
            sourceFingerprint: sourceFingerprint.resolve(source.sourceFingerprint),
            experimentalProgramTemplateId: experimentalProgramTemplateId.resolve(source.experimentalProgramTemplateId),
            experimentalTemplateName: source.experimentalTemplateName,
            appliedAt: appliedAt.resolve(source.appliedAt),
            rolledBackAt: rolledBackAt.resolve(source.rolledBackAt),
            sourceTemplateSnapshotHash: source.sourceTemplateSnapshotHash,
            sourceTemplateUpdatedAt: source.sourceTemplateUpdatedAt,
            title: source.title,
            summary: source.summary,
            selectedRecommendationIds: source.selectedRecommendationIds,
            changes: source.changes,
            confidence: source.confidence,
            riskLevel: source.riskLevel,
            explanation: source.explanation,
            diffPreview: source.diffPreview,
            notes: source.notes,
            _unknown: source._unknown
        )
    }
}
