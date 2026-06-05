// CoachActionDismissEngine — CC-3 coach-action dismiss/visibility port.
//
// Faithful line-by-line Swift port of the PURE dismiss/visibility engine
// `src/engines/coachActionDismissEngine.ts` (159 lines): its 9 exports
// (`DismissedCoachAction` type ts:11 / `dismissCoachActionToday` ts:25 /
// `filterDismissedCoachActions` ts:33 / `draftMatchesCoachAction` ts:73 /
// `historyMatchesCoachAction` ts:92 / `findExistingAdjustmentForCoachAction` ts:108 /
// `filterVisibleCoachActions` ts:143 + the two aliases `filterResolvedCoachActions`
// ts:158 / `filterResolvedPlanActions` ts:159) and EVERY private helper
// (`dateKey` ts:17 / `activeDraftStatuses` ts:48 / `resolvedDraftStatuses` ts:49 /
// `coachRecommendationId` ts:51 / `draftChangeMatchesAction` ts:53 /
// `historyChangeMatchesAction` ts:63).
//
// PURE / READ-ONLY (§11 DERIVED-only): the dismiss engine ONLY computes — it
// returns a `DismissedCoachAction` value / filtered `[CoachAction]` / a match
// boolean / an `ExistingAdjustment?` decision. It NEVER persists: no
// CanonicalSessionWriter, no write path, no IO, no randomness, zero `: Date`,
// zero Calendar. The actual gated dismiss WRITE is deferred to CC-4. The only
// time inputs (`now`, `currentDate`, `dismissedAt`) are explicit String
// arguments — never a wall clock.
//
// REUSES (never re-ports) the already-native dependencies (CC-3 dependency
// survey, §19.2 — EVERY import already native):
//   • `CoachActionEngine.CoachAction` (CC-2) — the consumed action type
//     (aliased below as `CoachAction`).
//   • `CoachActionIdentityEngine.buildCoachActionFingerprint` (PA-S5) — via the
//     7-field `FingerprintAction` projection (`fingerprintAction(_:)`).
//   • `PlanAdjustmentIdentityEngine.buildPlanAdjustmentFingerprintFromDraft` /
//     `…FromHistory` (PA-S6).
//   • IronPathDomain `ProgramAdjustmentDraft` / `ProgramAdjustmentHistoryItem` /
//     `AdjustmentChange` (PA-S1).
//
// `dateKey` (ts:17): the FIRST 10 chars iff they are an ANCHORED `YYYY-MM-DD`
// (`/^\d{4}-\d{2}-\d{2}/.match`, anchored at index 0 — UNLIKE the un-anchored
// `workoutCycleScheduler` dateKey), else the `new Date(value)` fallback. ASCII
// `[0-9]` only, mirroring JS `\d`. The fallback is reproduced WITHOUT `: Date`:
// the ONLY deterministic, timezone-independent outcome of `new Date(value)` for
// a non-anchored value is the Invalid-Date (`NaN`) → `''` case (e.g. `''`,
// `'garbage'`); a non-anchored BUT parseable value (`'2026/06/04'`) is
// TZ-dependent in TS itself, so it is OUTSIDE the §11 deterministic input domain
// and never appears in the goldens. We therefore return `''` for every
// non-anchored value — faithful for the contractual ISO input domain, and the
// only stable parity pin.
//
// Goldens are GENERATED from the REAL TS engine (scripts/generate-parity-goldens.mjs),
// never hand-edited (§22).

import Foundation
import IronPathDomain

public enum CoachActionDismissEngine {

    /// The consumed CC-2 action type — re-exported under the dismiss engine's
    /// namespace so call sites read `CoachActionDismissEngine.CoachAction`.
    public typealias CoachAction = CoachActionEngine.CoachAction

    // MARK: - DismissedCoachAction (coachActionDismissEngine.ts:11-15)

    /// `DismissedCoachAction` (ts:11-15) — `{ actionId; dismissedAt; scope: 'today' }`.
    /// `scope` is the TS string-literal `'today'`; carried as `String` (the
    /// `FingerprintAction` precedent — String preserves the literal AND lets a
    /// fixture pass a non-`'today'` scope to exercise the `scope === 'today'`
    /// filter's false branch). `dismissCoachActionToday` always sets `"today"`.
    public struct DismissedCoachAction: Equatable, Sendable {
        public let actionId: String
        public let dismissedAt: String
        public let scope: String
        public init(actionId: String, dismissedAt: String, scope: String) {
            self.actionId = actionId
            self.dismissedAt = dismissedAt
            self.scope = scope
        }

        /// Canonical JSON shape of the TS object literal (ts:26-30).
        public func encoded() -> JSONValue {
            .object(OrderedJSONObject(entries: [
                .init(key: "actionId", value: .string(actionId)),
                .init(key: "dismissedAt", value: .string(dismissedAt)),
                .init(key: "scope", value: .string(scope)),
            ]))
        }
    }

    /// `findExistingAdjustmentForCoachAction`'s return object (ts:113):
    /// `{ draft?; historyItem?; state? } | null`. `nil` mirrors the TS `null`.
    /// `state` is the `'draft_ready' | 'applied' | 'rolled_back' | 'dismissed' |
    /// 'expired'` union, carried as `String?`.
    public struct ExistingAdjustment: Equatable, Sendable {
        public let draft: ProgramAdjustmentDraft?
        public let historyItem: ProgramAdjustmentHistoryItem?
        public let state: String?
        public init(
            draft: ProgramAdjustmentDraft? = nil,
            historyItem: ProgramAdjustmentHistoryItem? = nil,
            state: String? = nil
        ) {
            self.draft = draft
            self.historyItem = historyItem
            self.state = state
        }
    }

    // MARK: - JS truthiness helper (empty string is falsy)

    /// JS truthiness for an optional string: `nil`/`""` → falsy, else truthy.
    private static func isTruthy(_ value: String?) -> Bool {
        !(value ?? "").isEmpty
    }

    // MARK: - dateKey (coachActionDismissEngine.ts:17-23)

    /// `dateKey` (ts:17): the leading 10 chars iff they are an ANCHORED
    /// `YYYY-MM-DD` (`/^\d{4}-\d{2}-\d{2}/`), else `''`. ASCII `[0-9]` only —
    /// `isASCII && isNumber` ⟺ `0`–`9`, matching JS `\d`. The `new Date(value)`
    /// fallback collapses to `''`: see the file header (the only deterministic,
    /// TZ-independent fallback outcome is `NaN` → `''`; a parseable non-anchored
    /// value is TZ-dependent and out of the §11 input domain). Zero `: Date`.
    private static func dateKey(_ value: String) -> String {
        let c = Array(value)
        if c.count >= 10 {
            func d(_ i: Int) -> Bool { c[i].isASCII && c[i].isNumber }
            if d(0), d(1), d(2), d(3), c[4] == "-", d(5), d(6), c[7] == "-", d(8), d(9) {
                return String(c[0 ..< 10])
            }
        }
        return ""
    }

    // MARK: - dismissCoachActionToday (coachActionDismissEngine.ts:25-31)

    /// `dismissCoachActionToday` (ts:25): pure value constructor — `{ actionId,
    /// dismissedAt: now, scope: 'today' }`. NO persistence (CC-4 owns the write).
    public static func dismissCoachActionToday(_ actionId: String, _ now: String) -> DismissedCoachAction {
        DismissedCoachAction(actionId: actionId, dismissedAt: now, scope: "today")
    }

    // MARK: - filterDismissedCoachActions (coachActionDismissEngine.ts:33-46)

    /// `filterDismissedCoachActions` (ts:33): keep `status === 'pending'` actions
    /// whose id is NOT in the set of actions dismissed `'today'` (same
    /// `dateKey`).
    public static func filterDismissedCoachActions(
        _ actions: [CoachAction],
        _ dismissedActions: [DismissedCoachAction],
        _ currentDate: String
    ) -> [CoachAction] {
        let today = dateKey(currentDate)
        var dismissedToday = Set<String>()
        for item in dismissedActions where item.scope == "today" && dateKey(item.dismissedAt) == today {
            dismissedToday.insert(item.actionId)
        }
        return actions.filter { $0.status == "pending" && !dismissedToday.contains($0.id) }
    }

    // MARK: - status sets (coachActionDismissEngine.ts:48-49)

    private static let activeDraftStatuses: Set<String> = ["draft_created", "ready_to_apply", "draft", "previewed"]
    private static let resolvedDraftStatuses: Set<String> = ["applied", "dismissed", "expired", "stale"]

    /// `coachRecommendationId` (ts:51): `coach-action-${action.id}`.
    private static func coachRecommendationId(_ action: CoachAction) -> String {
        "coach-action-\(action.id)"
    }

    // MARK: - fingerprint plumbing

    /// The 7-field `Pick<CoachAction, …>` (PA-S5 `FingerprintAction`) projection
    /// of a full `CoachAction` — the shape `buildCoachActionFingerprint` reads.
    private static func fingerprintAction(_ action: CoachAction) -> CoachActionIdentityEngine.FingerprintAction {
        CoachActionIdentityEngine.FingerprintAction(
            source: action.source,
            actionType: action.actionType,
            targetType: action.targetType,
            targetId: action.targetId,
            title: action.title,
            description: action.description,
            reason: action.reason
        )
    }

    /// The default `sourceFingerprint` for `draftMatchesCoachAction` (ts:76):
    /// `action.sourceFingerprint || buildCoachActionFingerprint(action, { sourceTemplateId: draft.sourceProgramTemplateId })`.
    /// JS `||`: a non-empty `action.sourceFingerprint` wins, else compute.
    private static func defaultDraftFingerprint(_ action: CoachAction, _ draft: ProgramAdjustmentDraft) -> String {
        if let fp = action.sourceFingerprint, !fp.isEmpty { return fp }
        return CoachActionIdentityEngine.buildCoachActionFingerprint(
            fingerprintAction(action),
            CoachActionIdentityEngine.CoachActionFingerprintContext(sourceTemplateId: draft.sourceProgramTemplateId)
        )
    }

    /// The default `sourceFingerprint` for `historyMatchesCoachAction` (ts:95):
    /// `action.sourceFingerprint || buildCoachActionFingerprint(action, { sourceTemplateId: historyItem.sourceProgramTemplateId })`.
    private static func defaultHistoryFingerprint(_ action: CoachAction, _ item: ProgramAdjustmentHistoryItem) -> String {
        if let fp = action.sourceFingerprint, !fp.isEmpty { return fp }
        return CoachActionIdentityEngine.buildCoachActionFingerprint(
            fingerprintAction(action),
            CoachActionIdentityEngine.CoachActionFingerprintContext(sourceTemplateId: item.sourceProgramTemplateId)
        )
    }

    // MARK: - draftChangeMatchesAction (coachActionDismissEngine.ts:53-61)

    /// `draftChangeMatchesAction` (ts:53): false unless BOTH `action.targetId`
    /// and `action.targetType` are truthy; then `.some` over `draft.changes`
    /// matching by target type. (`change.muscleId === action.targetId` etc — a
    /// `nil` change field never equals a non-empty targetId.)
    private static func draftChangeMatchesAction(_ action: CoachAction, _ draft: ProgramAdjustmentDraft) -> Bool {
        guard let targetId = action.targetId, !targetId.isEmpty,
              let targetType = action.targetType, !targetType.isEmpty else { return false }
        return (draft.changes ?? []).contains { change in
            if targetType == "muscle" { return change.muscleId == targetId }
            if targetType == "exercise" { return change.exerciseId == targetId || change.replacementExerciseId == targetId }
            if targetType == "template" { return change.dayTemplateId == targetId || draft.sourceProgramTemplateId == targetId }
            return false
        }
    }

    // MARK: - historyChangeMatchesAction (coachActionDismissEngine.ts:63-71)

    /// `historyChangeMatchesAction` (ts:63): mirror of `draftChangeMatchesAction`
    /// over `historyItem.changes` (template branch falls back to
    /// `historyItem.sourceProgramTemplateId`).
    private static func historyChangeMatchesAction(_ action: CoachAction, _ item: ProgramAdjustmentHistoryItem) -> Bool {
        guard let targetId = action.targetId, !targetId.isEmpty,
              let targetType = action.targetType, !targetType.isEmpty else { return false }
        return (item.changes ?? []).contains { change in
            if targetType == "muscle" { return change.muscleId == targetId }
            if targetType == "exercise" { return change.exerciseId == targetId || change.replacementExerciseId == targetId }
            if targetType == "template" { return change.dayTemplateId == targetId || item.sourceProgramTemplateId == targetId }
            return false
        }
    }

    // MARK: - draftMatchesCoachAction (coachActionDismissEngine.ts:73-90)

    /// `draftMatchesCoachAction` (ts:73). `sourceFingerprint == nil` reproduces
    /// the TS default-parameter (`undefined` → the per-draft default, ts:76); an
    /// explicit value (incl. `""`) is used verbatim. The TS default is a PURE
    /// computation, so evaluating it lazily AFTER the `'recommendation'`
    /// early-return changes nothing observable. The `||` chain returns true on
    /// the first matching clause (ts:82-88).
    public static func draftMatchesCoachAction(
        _ action: CoachAction,
        _ draft: ProgramAdjustmentDraft,
        _ sourceFingerprint: String? = nil
    ) -> Bool {
        if draft.status == "recommendation" { return false }                              // ts:78
        let resolvedFingerprint = sourceFingerprint ?? defaultDraftFingerprint(action, draft)
        let recommendationId = coachRecommendationId(action)                              // ts:79
        let draftFingerprint = PlanAdjustmentIdentityEngine.buildPlanAdjustmentFingerprintFromDraft(draft) // ts:80
        if draft.sourceCoachActionId == action.id { return true }                         // ts:82
        if !draftFingerprint.isEmpty && draftFingerprint == resolvedFingerprint { return true } // ts:83
        if draft.sourceRecommendationId == action.id { return true }                      // ts:84
        if draft.sourceRecommendationId == recommendationId { return true }               // ts:85
        if (draft.selectedRecommendationIds ?? []).contains(action.id) { return true }    // ts:86
        if (draft.selectedRecommendationIds ?? []).contains(recommendationId) { return true } // ts:87
        if action.actionType == "create_plan_adjustment_preview" && draftChangeMatchesAction(action, draft) { return true } // ts:88
        return false
    }

    // MARK: - historyMatchesCoachAction (coachActionDismissEngine.ts:92-106)

    /// `historyMatchesCoachAction` (ts:92). Same default-parameter mechanics as
    /// `draftMatchesCoachAction`; NO `'recommendation'` early-return and NO
    /// `sourceRecommendationId` clauses (history has no such field).
    public static func historyMatchesCoachAction(
        _ action: CoachAction,
        _ item: ProgramAdjustmentHistoryItem,
        _ sourceFingerprint: String? = nil
    ) -> Bool {
        let resolvedFingerprint = sourceFingerprint ?? defaultHistoryFingerprint(action, item)
        let recommendationId = coachRecommendationId(action)                              // ts:97
        let historyFingerprint = PlanAdjustmentIdentityEngine.buildPlanAdjustmentFingerprintFromHistory(item) // ts:98
        if item.sourceCoachActionId == action.id { return true }                          // ts:100
        if !historyFingerprint.isEmpty && historyFingerprint == resolvedFingerprint { return true } // ts:101
        if (item.selectedRecommendationIds ?? []).contains(action.id) { return true }     // ts:102
        if (item.selectedRecommendationIds ?? []).contains(recommendationId) { return true } // ts:103
        if action.actionType == "create_plan_adjustment_preview" && historyChangeMatchesAction(action, item) { return true } // ts:104
        return false
    }

    // MARK: - findExistingAdjustmentForCoachAction (coachActionDismissEngine.ts:108-141)

    /// `findExistingAdjustmentForCoachAction` (ts:108). Resolution order over the
    /// matching drafts (active → applied → dismissed → expired/stale →
    /// rolled_back-iff-no-blocking), then the matching histories
    /// (non-rolled-back → applied; else rolled_back). `String(draft.status)`
    /// membership is reproduced by `status ?? ""` — neither `"undefined"` nor
    /// `""` is in either status set, so the membership result is identical.
    /// Returns `nil` for the TS `null`.
    public static func findExistingAdjustmentForCoachAction(
        _ action: CoachAction,
        _ drafts: [ProgramAdjustmentDraft] = [],
        _ adjustmentHistory: [ProgramAdjustmentHistoryItem] = [],
        _ sourceFingerprint: String? = nil
    ) -> ExistingAdjustment? {
        let matchingDrafts = drafts.filter { draftMatchesCoachAction(action, $0, sourceFingerprint) } // ts:114
        if let activeDraft = matchingDrafts.first(where: { activeDraftStatuses.contains($0.status ?? "") }) { // ts:115
            return ExistingAdjustment(draft: activeDraft, state: "draft_ready")            // ts:116
        }
        if let appliedDraft = matchingDrafts.first(where: { $0.status == "applied" }) {    // ts:117
            return ExistingAdjustment(draft: appliedDraft, state: "applied")               // ts:118
        }
        if let dismissedDraft = matchingDrafts.first(where: { $0.status == "dismissed" }) { // ts:119
            return ExistingAdjustment(draft: dismissedDraft, state: "dismissed")           // ts:120
        }
        if let expiredDraft = matchingDrafts.first(where: { $0.status == "expired" || $0.status == "stale" }) { // ts:121
            return ExistingAdjustment(draft: expiredDraft, state: "expired")               // ts:122
        }
        if let rolledBackDraft = matchingDrafts.first(where: { $0.status == "rolled_back" }) { // ts:123
            let hasBlockingDraft = matchingDrafts.contains {                               // ts:125
                resolvedDraftStatuses.contains($0.status ?? "") || activeDraftStatuses.contains($0.status ?? "")
            }
            if !hasBlockingDraft {                                                         // ts:126
                return ExistingAdjustment(draft: rolledBackDraft, state: "rolled_back")
            }
        }

        let matchingHistories = adjustmentHistory.filter { historyMatchesCoachAction(action, $0, sourceFingerprint) } // ts:129
        if let matchingHistory = matchingHistories.first(where: { $0.status != "rolled_back" && !isTruthy($0.rolledBackAt) }) { // ts:130
            return ExistingAdjustment(historyItem: matchingHistory, state: "applied")      // ts:131-135
        }
        if let rolledBackHistory = matchingHistories.first(where: { $0.status == "rolled_back" || isTruthy($0.rolledBackAt) }) { // ts:137
            return ExistingAdjustment(historyItem: rolledBackHistory, state: "rolled_back") // ts:138
        }
        return nil                                                                        // ts:140
    }

    // MARK: - filterVisibleCoachActions (coachActionDismissEngine.ts:143-156)

    /// `filterVisibleCoachActions` (ts:143): from the dismiss-filtered actions,
    /// keep those with NO existing adjustment OR whose existing adjustment is
    /// `'rolled_back'`. `findExistingAdjustmentForCoachAction` is called WITHOUT
    /// `sourceFingerprint` (ts:152), so each draft/history resolves its own
    /// per-item default fingerprint.
    public static func filterVisibleCoachActions(
        _ actions: [CoachAction],
        _ drafts: [ProgramAdjustmentDraft] = [],
        _ adjustmentHistory: [ProgramAdjustmentHistoryItem] = [],
        _ dismissedActions: [DismissedCoachAction] = [],
        _ currentDate: String
    ) -> [CoachAction] {
        filterDismissedCoachActions(actions, dismissedActions, currentDate).filter { action in
            let existing = findExistingAdjustmentForCoachAction(action, drafts, adjustmentHistory)
            return existing == nil || existing?.state == "rolled_back"
        }
    }

    // MARK: - aliases (coachActionDismissEngine.ts:158-159)

    /// `export const filterResolvedCoachActions = filterVisibleCoachActions` (ts:158).
    public static func filterResolvedCoachActions(
        _ actions: [CoachAction],
        _ drafts: [ProgramAdjustmentDraft] = [],
        _ adjustmentHistory: [ProgramAdjustmentHistoryItem] = [],
        _ dismissedActions: [DismissedCoachAction] = [],
        _ currentDate: String
    ) -> [CoachAction] {
        filterVisibleCoachActions(actions, drafts, adjustmentHistory, dismissedActions, currentDate)
    }

    /// `export const filterResolvedPlanActions = filterVisibleCoachActions` (ts:159).
    public static func filterResolvedPlanActions(
        _ actions: [CoachAction],
        _ drafts: [ProgramAdjustmentDraft] = [],
        _ adjustmentHistory: [ProgramAdjustmentHistoryItem] = [],
        _ dismissedActions: [DismissedCoachAction] = [],
        _ currentDate: String
    ) -> [CoachAction] {
        filterVisibleCoachActions(actions, drafts, adjustmentHistory, dismissedActions, currentDate)
    }
}
