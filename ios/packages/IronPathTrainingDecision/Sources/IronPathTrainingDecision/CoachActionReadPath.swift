// CoachActionReadPath — CC-4 coach-action UI read path (coach-action track read-only closure).
//
// The FIRST consumer of the CC-0…3 coach-action engine layer (until now CoachActionEngine /
// WeeklyCoachActionEngine / CoachActionIdentityEngine / CoachActionDismissEngine were ported +
// parity-pinned but "NOT wired into any UI"). This file adds the pure, testable orchestration
// that turns an already-cleaned canonical view into a READ-ONLY `CoachActionSurfaceSummary` the
// 今日 surface renders — the coach-action cards mirrored from the PWA CoachActionCard /
// CoachActionList / coachActionPresenter. It does NOT write, does NOT change any engine, and
// touches no parity golden (additive presentation/orchestration — master §19.2, the same shape
// as `resolveNextWorkoutScheduleState` / `resolveTrainingInsightsState`).
//
// HARD CONTRACT (master §10/§11): `buildCoachActions` receives a CLEAN-DERIVED input, NEVER a
// raw AppData value — and, per the TrainingDecision boundary, this package never CONSTRUCTS the
// clean view. The thin app-layer loader builds it via DataHealth `buildCleanAppDataView` (the §10
// chokepoint) and hands the resolver the resulting `CleanAppDataView`. The resolver then plucks
// ONLY individual fields out of that gated view and feeds the engine a freshly-built AppData that
// carries the CLEANED active session (`cleanedActiveSession`, §11 rule — session/history are never
// raw) plus the CONFIG `templates` slot decoded from the view's `raw` document (exactly the
// `NextWorkoutReadPath` precedent — the data-health guards do not clean that config slot, and no
// raw AppData blob escapes into the engine). The next-workout signal is itself clean-derived
// (the SC-C scheduler over the cleaned history), so its nested recovery recommendation flows into
// `buildCoachActions` faithfully (`recoveryRecommendation ?? nextWorkout?.recovery`,
// coachActionEngine.ts:643).
//
// ③/CC-4 §11.2 INJECTED-CLOCK CONTRACT (the iOS-17e-6a `asOfDate` pinning). `buildCoachActions`
// stamps every action's `createdAt` from `nonEmpty(now) ?? ""` (coachActionEngine.ts:637
// `now || new Date().toISOString()` — the wall-clock default DELIBERATELY not ported, golden-
// neutral). This live path INJECTS the decision pipeline's `nowIso` (derived from the same
// instant the loader built the clean view's guard clock from) AND `precondition`-asserts it is
// non-empty BEFORE calling the builder, so the engine's `""` fallback is UNREACHABLE on the live
// path. A defaulted/empty clock from a live caller is a hard precondition failure, never a silent
// wall-clock fabrication — identical pinning to 17e-6a's `asOfDate` non-empty contract.
//
// SCOPE HONESTY (master §15.4, the `NextWorkoutReadPath` precedent): the coach-action engine reads
// up to nine upstream signals. This V1 wires the cleanly clean-derivable ones — the SC-C next
// workout + its nested SC-A recovery — and leaves the rest (dataHealthReport / dailyAdjustment /
// sessionQuality / plateauResults / volumeAdaptation / recommendationConfidence / setAnomalies)
// at their honest nil defaults rather than fabricating them; they light up when their own sources
// are wired (a later slice). The dismiss action's "暂不处理" label is carried here; its persistence
// is the CC-5 gated dismiss write the 今日 surface wires, and CC-6 (this slice) wires the read-side
// HIDING: after `buildCoachActions` this resolver runs the CC-3 `filterVisibleCoachActions` over the
// gated clean view, so a 'today'-dismissed (or draft/history-resolved) action drops out of the
// rendered list. The read-filter is now part of THIS read path (a faithful mirror of
// `enginePipeline.ts:98-104`); it REUSES the CC-3 engine verbatim — it ports nothing and changes no
// parity golden (additive read-path orchestration only).
//
// Honesty (master §15.4): the load outcomes map to honest states — `.missing` (no canonical file
// yet / first launch / no live source) and a loaded-but-empty (no cleaned history) view →
// `.empty`; `.unreadable` (a present but unparseable document) → `.unavailable` (degrade, never
// crash, never overwrite); a clean view WITH cleaned history → `.ready(summary)`. A ready summary
// with no pending actions renders the honest "暂无需要处理的教练建议。" empty list — never a
// fabricated action.

import Foundation
import IronPathDomain
import IronPathDataHealth

/// The outcome of attempting to read + clean the canonical AppData document, produced by the thin
/// app-layer loader (the ONLY IO + the DataHealth clean-view construction, which by the
/// TrainingDecision boundary cannot happen in this package). Kept separate from the resolved state
/// so the branch logic below stays pure and fully testable without a live store. Mirrors
/// `NextWorkoutAppDataLoadOutcome` / `InsightsAppDataLoadOutcome` / `TodayAppDataLoadOutcome`.
public enum CoachActionAppDataLoadOutcome: Sendable {
    /// No canonical file exists yet (first launch) — or no live source is wired (previews/tests).
    /// An honest "no data" signal, never an error.
    case missing
    /// A canonical file exists but could not be loaded/decoded. The document is preserved untouched
    /// (this read path NEVER writes) — surface an honest degrade.
    case unreadable
    /// A canonical document loaded AND was routed through DataHealth `buildCleanAppDataView` by the
    /// loader. Only the clean view reaches the engine.
    case loaded(CleanAppDataView)
}

/// The resolved 教练建议 state the thin SwiftUI layer renders verbatim.
public enum CoachActionSurfaceState: Equatable, Sendable {
    /// Real coach actions computed from the user's cleaned canonical AppData (possibly an empty
    /// pending list — an honest "all clear", distinct from `.empty`'s "no data").
    case ready(CoachActionSurfaceSummary)
    /// No usable canonical data yet (missing file / first launch / no cleaned history) — show an
    /// honest empty state, never fabricated actions.
    case empty
    /// A canonical document exists but is unreadable — honest degrade. The document is left
    /// untouched (read-only path; never overwritten).
    case unavailable
}

/// Pure resolver: maps a load outcome to the rendered coach-action state. The loaded view has
/// already passed through DataHealth (master §10); the resolver only feeds the already-ported
/// coach-action engine a clean-derived input and reads its output (master §11). `now` is the
/// injected instant — it MUST match the instant the loader used to build the clean view's guard
/// clock, so the result is reproducible for a given (`outcome`, `now`). Mirrors
/// `resolveNextWorkoutScheduleState`.
public func resolveCoachActionState(
    _ outcome: CoachActionAppDataLoadOutcome,
    now: Date
) -> CoachActionSurfaceState {
    switch outcome {
    case .missing:
        return .empty
    case .unreadable:
        return .unavailable
    case .loaded(let cleanView):
        // No cleaned training history => no real baseline to coach from. Honest empty rather than
        // presenting the engines' bare first-launch defaults (keeps the 今日 read blocks consistent
        // — they all light up together once there is real training data).
        guard !cleanView.cleanedHistory.isEmpty else { return .empty }

        let nowIso = coachActionReferenceIso8601UTC(now)
        // ③/CC-4 §11.2 INJECTED-CLOCK CONTRACT (file header): the live path MUST inject a non-empty
        // nowIso so `buildCoachActions`' `nonEmpty(now) ?? ""` createdAt fallback is UNREACHABLE.
        // `ISO8601DateFormatter` always returns a non-empty string for a valid `Date`, so this holds
        // for every live read; a violation is a hard programmer error, never a silent wall clock.
        precondition(
            !nowIso.isEmpty,
            "CC-4 coach-action live wiring requires a non-empty injected nowIso (§11.2 clock contract);"
                + " buildCoachActions must never reach its empty-createdAt fallback on the live path"
        )

        // SC-C next workout over the CLEANED history (the `NextWorkoutReadPath` wiring), whose nested
        // SC-A recovery feeds `recoveryAction` (coachActionEngine.ts:643). Un-ported context inputs
        // (pain / readiness / weekly volume / mode) stay at their honest defaults (file header).
        let todayState = TodayStateEngine.buildTodayTrainingState(
            activeSession: cleanView.cleanedActiveSession,
            history: cleanView.cleanedHistory,
            plannedTemplateId: cleanView.raw.settings.selectedTemplateId,
            nowIso: nowIso
        )
        let nextWorkout = NextWorkoutScheduler.buildNextWorkoutRecommendation(
            history: cleanView.cleanedHistory,
            activeSession: cleanView.cleanedActiveSession,
            programTemplate: cleanView.raw.programTemplate,
            templates: decodeCoachActionTemplates(cleanView),
            todayState: todayState
        )

        let actions = CoachActionEngine.buildCoachActions(
            CoachActionEngine.BuildCoachActionsInput(
                appData: coachActionCleanDerivedAppData(cleanView),
                nextWorkout: nextWorkout,
                now: nowIso
            )
        )

        // CC-6 §11 dismiss read-filter wiring — the FIRST read-side consumer of the CC-3
        // `CoachActionDismissEngine` filter (until now it was ported + parity-pinned but UNWIRED).
        // A faithful mirror of `enginePipeline.ts:98-104`: from the engine's freshly built actions,
        // drop (a) the ones the user dismissed 'today' (same civil day) AND (b) the ones already
        // resolved by a matching draft/history adjustment (an action survives a match ONLY when that
        // match is 'rolled_back'). All FIVE inputs derive from the SAME gated clean view (§10/§11) —
        // never a raw AppData blob — and this slice REUSES the CC-3 filter verbatim (it ports nothing
        // and changes no parity). See the helpers below for each input's provenance.
        let visibleActions = CoachActionDismissEngine.filterVisibleCoachActions(
            actions,
            coachActionProgramAdjustmentDrafts(cleanView),
            coachActionProgramAdjustmentHistory(cleanView),
            coachActionDismissedActions(cleanView),
            // §11.2 ZERO-NEW-CLOCK: the civil `YYYY-MM-DD` day is the SAME injected `nowIso`'s leading
            // 10 chars — NOT a fresh `Date()`/`Calendar`/`ISO8601` read. `nowIso` is the parity-format
            // UTC ISO-8601 string built above from the injected instant, so its first 10 chars are the
            // anchored civil date key `filterDismissedCoachActions` matches `dismissedAt` against: the
            // `context.currentDateLocalKey` the PWA passes (enginePipeline.ts:103), on this read path's
            // existing UTC-day convention (the `coachActionReferenceIso8601UTC` header).
            String(nowIso.prefix(10))
        )
        return .ready(CoachActionSurfaceSummary(actions: visibleActions))
    }
}

/// Build the CLEAN-DERIVED `AppData` the engine reads — it touches ONLY `root["templates"]`
/// (`appDataTemplates`) and `root["activeSession"]` (`activeSessionInProgress`). The active session
/// is the CLEANED projection (§11 rule — never the raw session); `templates` is the un-promoted
/// CONFIG slot copied verbatim from the gated view's raw document (the `NextWorkoutReadPath`
/// precedent). No raw AppData blob is passed to the engine.
private func coachActionCleanDerivedAppData(_ cleanView: CleanAppDataView) -> AppData {
    var entries: [OrderedJSONObject.Entry] = [
        .init(key: "schemaVersion", value: .number(.integer(Int64(SchemaVersion.current.rawValue)))),
    ]
    if let templates = cleanView.raw.root["templates"] {
        entries.append(.init(key: "templates", value: templates))
    }
    if let activeSession = cleanView.cleanedActiveSession {
        entries.append(.init(key: "activeSession", value: activeSession.encoded()))
    }
    return AppData(schemaVersion: .current, root: OrderedJSONObject(entries: entries))
}

/// Decode the user's training day templates out of the gated view's raw document. `templates` is
/// not a promoted Domain field (it rides in `root`, mirroring the PWA `data.templates`), so it is
/// read the same way `NextWorkoutReadPath` reads it. A missing/garbled entry is skipped (`try?`) —
/// never crashes, never fabricates a template.
private func decodeCoachActionTemplates(_ cleanView: CleanAppDataView) -> [TrainingTemplate] {
    guard let array = cleanView.raw.root["templates"]?.arrayValue else { return [] }
    return array.compactMap { try? TrainingTemplate(decoding: $0) }
}

// MARK: - CC-6 dismiss read-filter inputs (all plucked from the gated clean view — §10/§11)

/// The user's persisted dismiss intent, read by the SAME read-side priority CC-5 PERSISTS to and
/// `enginePipeline.ts:102` reads: `root.dismissedCoachActions || settings.dismissedCoachActions ||
/// []` — a present ARRAY (even empty) at `root` wins JS `||` truthiness, else `settings`, else
/// empty. Each entry's three string fields → a `DismissedCoachAction` (the parity test's
/// `decodeDismissed` shape); a non-object entry is skipped — it could never carry a `'today'`
/// scope, so the filter result is identical. This is the user's INTENT, never an engine output
/// (§11): the read-filter only HIDES, it never recomputes or writes.
private func coachActionDismissedActions(
    _ cleanView: CleanAppDataView
) -> [CoachActionDismissEngine.DismissedCoachAction] {
    let raw = coachActionTruthyArray(cleanView.raw.root["dismissedCoachActions"])
        ?? coachActionTruthyArray(cleanView.raw.settings.dismissedCoachActions)
        ?? []
    return raw.compactMap { value in
        guard let obj = value.objectValue else { return nil }
        return CoachActionDismissEngine.DismissedCoachAction(
            actionId: obj["actionId"]?.stringValue ?? "",
            dismissedAt: obj["dismissedAt"]?.stringValue ?? "",
            scope: obj["scope"]?.stringValue ?? ""
        )
    }
}

/// JS `||` truthiness for the read-priority chain (the CC-5 `truthyArray` mirror): a present ARRAY
/// (even empty) is truthy → used; `null` / missing / a non-array is falsy → fall through to the
/// next source. Returns the raw element list.
private func coachActionTruthyArray(_ value: JSONValue?) -> [JSONValue]? {
    guard let value, case .array(let arr) = value else { return nil }
    return arr
}

/// The staged program-adjustment drafts — an open-bag PA slot plucked from the gated view's raw
/// document (the `templates` precedent: config-shaped, NOT §11 session/history training data, so the
/// DataHealth guards do not clean it, and no raw AppData blob reaches the engine). Decoded leniently:
/// a garbled entry is skipped (`try?`), never crashes, never fabricates a draft (the
/// `decodeCoachActionTemplates` paradigm). Mirrors `appData.programAdjustmentDrafts || []`
/// (enginePipeline.ts:100).
private func coachActionProgramAdjustmentDrafts(_ cleanView: CleanAppDataView) -> [ProgramAdjustmentDraft] {
    guard let array = cleanView.raw.root["programAdjustmentDrafts"]?.arrayValue else { return [] }
    return array.compactMap { try? ProgramAdjustmentDraft(decoding: $0) }
}

/// The applied / rolled-back program-adjustment history — same provenance + lenient decode as the
/// drafts above. Mirrors `appData.programAdjustmentHistory || []` (enginePipeline.ts:101).
private func coachActionProgramAdjustmentHistory(_ cleanView: CleanAppDataView) -> [ProgramAdjustmentHistoryItem] {
    guard let array = cleanView.raw.root["programAdjustmentHistory"]?.arrayValue else { return [] }
    return array.compactMap { try? ProgramAdjustmentHistoryItem(decoding: $0) }
}

/// UTC ISO-8601 with fractional seconds (matches the engines' parity-clock format, e.g.
/// `2026-06-03T10:00:00.000Z`). `buildCoachActions` stamps `createdAt` from it and `tomorrowIso`
/// reads it back; UTC keeps the whole pipeline on the codebase's existing UTC-day convention. Same
/// helper shape as the Today / Insights / NextWorkout read paths.
private func coachActionReferenceIso8601UTC(_ date: Date) -> String {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    formatter.timeZone = TimeZone(identifier: "UTC")
    return formatter.string(from: date)
}

// MARK: - 教练建议 (coach action) presentation summary

/// Read-only organization of the `CoachActionEngine.buildCoachActions` output into the 今日 surface's
/// coach-action cards — a faithful Swift mirror of the PWA `coachActionPresenter` / `CoachActionList`
/// / `CoachActionCard` read paths. Pure projection — it reads the already-ported engine's output (it
/// never recomputes or changes it) and never touches any parity golden. Adding this additive
/// presentation type is a §19.2 extension of an active package (master §11/§18).
///
/// Mirrors the PWA `buildCoachActionListViewModel(actions, { surface: 'today' })`: only `pending`
/// actions are shown on the 今日 surface, sorted by priority DESC then title (zh-Hans-CN collation),
/// each mapped through `buildCoachActionView`. `secondaryLabel` ("暂不处理") is the dismiss button
/// label the 今日 surface wires to the CC-5 gated dismiss write.
public struct CoachActionSurfaceSummary: Equatable, Sendable {
    /// The list header title (PWA `CoachActionList` default).
    public let title: String
    /// The list header description (PWA `CoachActionList` default) — reiterates the read-only promise.
    public let description: String
    /// The honest empty-list text shown when there are no pending actions (PWA `emptyText` default).
    public let emptyText: String
    /// The sorted, read-only projection of each pending coach action.
    public let actions: [ActionRow]

    /// The read-only projection of one coach action — the fields the card renders (PWA
    /// `CoachActionView`, minus the click handlers / variant the read-only surface does not need).
    public struct ActionRow: Equatable, Sendable, Identifiable {
        public let id: String
        public let title: String
        public let description: String
        /// PWA `sourceLabel` (always slate-toned in the PWA): 今日调整 / 下次训练 / 数据健康 / …
        public let sourceLabel: String
        /// PWA `priorityLabel`: 优先处理 / 重要 / 建议查看 / 可稍后看.
        public let priorityLabel: String
        /// PWA `statusLabel`: 待处理 / 已采用 / 已忽略 / 已过期 / 未完成.
        public let statusLabel: String
        /// PWA card line: 需要确认 (requiresConfirmation) vs 只查看.
        public let confirmationLabel: String
        /// PWA card line: 可撤销 when reversible, else nil (not rendered).
        public let reversibleLabel: String?
        /// PWA `primaryLabel` — the read-only "view" entry text (`getCoachActionPrimaryLabel`).
        public let primaryLabel: String
        /// PWA `secondaryLabel` — fixed "暂不处理" (rendered DISABLED; persistence deferred to CC-5).
        public let secondaryLabel: String
        /// PWA `detailLabel` — fixed "查看详情".
        public let detailLabel: String
        /// PWA `disabledReason` — present only when a draft action lacks a usable target.
        public let disabledReason: String?
    }

    /// Build the summary from the engine's coach actions. Pure projection — mirrors the PWA
    /// `buildCoachActionListViewModel(actions, { surface: 'today' })` (pending-only) + `sortActionViews`.
    public init(actions: [CoachActionEngine.CoachAction]) {
        self.title = "教练建议"
        self.description = "建议只会引导你查看现有页面或生成草案，不会自动修改数据。"
        self.emptyText = "暂无需要处理的教练建议。"

        // PWA `shouldShowOnSurface(action, 'today')` → status === 'pending'.
        let pending = actions.filter { $0.status == "pending" }
        // PWA `sortActionViews`: priorityRank DESC, then title.localeCompare(zh-Hans-CN). Build the
        // row first so the title (already engine-cleaned + presenter-cleaned) drives the tie-break.
        let rows = pending.map { (action: $0, row: Self.makeRow($0)) }
        let sorted = Self.stableSorted(rows) { left, right in
            let priorityDiff = Self.priorityRank(right.action.priority) - Self.priorityRank(left.action.priority)
            if priorityDiff != 0 { return priorityDiff }
            return Self.localeCompareZhHansCN(left.row.title, right.row.title)
        }
        self.actions = sorted.map { $0.row }
    }

    /// One action → its read-only row (PWA `buildCoachActionView`).
    static func makeRow(_ action: CoachActionEngine.CoachAction) -> ActionRow {
        ActionRow(
            id: action.id.isEmpty ? "coach-action" : action.id,
            title: cleanText(action.title, fallback: fallbackTitle(action)),
            description: cleanText(nonEmptyOr(action.description, action.reason), fallback: fallbackDescription(action)),
            sourceLabel: sourceLabels[action.source] ?? "教练建议",
            priorityLabel: priorityLabels[action.priority] ?? "建议查看",
            statusLabel: statusLabels[action.status] ?? "待处理",
            confirmationLabel: action.requiresConfirmation ? "需要确认" : "只查看",
            reversibleLabel: action.reversible ? "可撤销" : nil,
            primaryLabel: getCoachActionPrimaryLabel(action),
            secondaryLabel: "暂不处理",
            detailLabel: "查看详情",
            disabledReason: disabledReasonForAction(action)
        )
    }

    // MARK: - Label maps (verbatim from coachActionPresenter.ts)

    /// PWA `sourceLabels` (coachActionPresenter.ts:41).
    static let sourceLabels: [String: String] = [
        "dailyAdjustment": "今日调整",
        "nextWorkout": "下次训练",
        "dataHealth": "数据健康",
        "plateau": "动作进展",
        "volumeAdaptation": "训练量",
        "sessionQuality": "训练质量",
        "setAnomaly": "输入检查",
        "recovery": "恢复建议",
        "recommendationConfidence": "推荐可信度",
    ]

    /// PWA `statusLabels` (coachActionPresenter.ts:53).
    static let statusLabels: [String: String] = [
        "pending": "待处理",
        "applied": "已采用",
        "dismissed": "已忽略",
        "expired": "已过期",
        "failed": "未完成",
    ]

    /// PWA `priorityLabels` (coachActionPresenter.ts:61).
    static let priorityLabels: [String: String] = [
        "urgent": "优先处理",
        "high": "重要",
        "medium": "建议查看",
        "low": "可稍后看",
    ]

    /// PWA `priorityRank` (coachActionPresenter.ts:68) — urgent 4 > high 3 > medium 2 > low 1.
    static func priorityRank(_ priority: String) -> Int {
        switch priority {
        case "urgent": return 4
        case "high": return 3
        case "medium": return 2
        case "low": return 1
        default: return 0
        }
    }

    // MARK: - Fallback titles / descriptions (coachActionPresenter.ts:104 / 117)

    /// PWA `fallbackTitle` (coachActionPresenter.ts:104).
    static func fallbackTitle(_ action: CoachActionEngine.CoachAction) -> String {
        switch action.source {
        case "dataHealth": return "检查数据健康"
        case "dailyAdjustment": return "查看今日调整"
        case "nextWorkout": return "查看下次训练建议"
        case "plateau":
            return action.actionType == "create_plan_adjustment_preview" ? "生成动作调整草案" : "查看动作进展"
        case "volumeAdaptation":
            return action.actionType == "create_plan_adjustment_preview" ? "生成训练量调整草案" : "查看训练量建议"
        case "sessionQuality": return "查看训练质量"
        case "setAnomaly": return "复查训练输入"
        case "recovery": return "查看恢复训练建议"
        case "recommendationConfidence": return "查看推荐可信度"
        default: return "查看教练建议"
        }
    }

    /// PWA `fallbackDescription` (coachActionPresenter.ts:117).
    static func fallbackDescription(_ action: CoachActionEngine.CoachAction) -> String {
        if action.source == "dataHealth" { return "有数据问题建议先查看；本操作只会打开相关页面，不会修改数据。" }
        if action.actionType == "create_plan_adjustment_preview" { return "可以查看调整草案入口，正式应用仍需要你确认。" }
        if action.actionType == "apply_temporary_session_adjustment" { return "当前只展示建议，不会自动修改训练内容。" }
        if action.actionType == "review_session" { return "打开相关训练详情，确认记录和统计是否一致。" }
        if action.actionType == "open_next_workout" { return "查看系统建议的下次训练安排。" }
        return "查看建议详情；你可以暂不处理。"
    }

    // MARK: - Primary label / draft eligibility (coachActionPresenter.ts:126 / 130 / 153)

    /// PWA `canCreateAdjustmentDraft` (coachActionPresenter.ts:126).
    static func canCreateAdjustmentDraft(_ action: CoachActionEngine.CoachAction) -> Bool {
        action.actionType == "create_plan_adjustment_preview"
            && (action.targetId.map { !$0.isEmpty } ?? false)
            && (action.targetType == "muscle" || action.targetType == "exercise")
    }

    /// PWA `getCoachActionPrimaryLabel` (coachActionPresenter.ts:130).
    static func getCoachActionPrimaryLabel(_ action: CoachActionEngine.CoachAction) -> String {
        if action.status == "applied" && action.actionType == "create_plan_adjustment_preview" { return "查看实验模板" }
        if action.status == "dismissed" || action.status == "expired" { return "查看原因" }
        switch action.actionType {
        case "open_data_health": return "查看数据"
        case "open_record_detail", "review_session": return "查看训练详情"
        case "create_plan_adjustment_preview": return canCreateAdjustmentDraft(action) ? "生成调整草案" : "查看建议"
        case "review_volume": return "查看训练量建议"
        case "review_exercise": return "查看动作"
        case "open_next_workout": return "查看建议"
        case "open_replacement_sheet": return "查看替代动作"
        case "apply_temporary_session_adjustment": return action.source == "dailyAdjustment" ? "采用本次调整" : "查看建议"
        default: return "查看建议"
        }
    }

    /// PWA `disabledReasonForAction` (coachActionPresenter.ts:153).
    static func disabledReasonForAction(_ action: CoachActionEngine.CoachAction) -> String? {
        if action.actionType == "create_plan_adjustment_preview" && !canCreateAdjustmentDraft(action) {
            return "当前建议缺少可生成草案的目标信息，只能先查看原因。"
        }
        return nil
    }

    // MARK: - Text scrubbing (coachActionPresenter.ts:90 — rawTokenPattern + mojibake → fallback)

    /// PWA `cleanText` (coachActionPresenter.ts:95): strip the raw token set, collapse whitespace,
    /// trim; an empty result OR a mojibake hit → the fallback. The engine already scrubbed its own
    /// visible-token set in `makeAction`, so on engine output this is mostly the fallback guard.
    static func cleanText(_ value: String, fallback: String) -> String {
        var text = rawTokenRegex.stringByReplacingMatches(
            in: value, options: [], range: NSRange(value.startIndex..., in: value), withTemplate: ""
        )
        text = whitespaceRegex.stringByReplacingMatches(
            in: text, options: [], range: NSRange(text.startIndex..., in: text), withTemplate: " "
        )
        text = text.trimmingCharacters(in: .whitespacesAndNewlines)
        if text.isEmpty || hasMojibake(text) { return fallback }
        return text
    }

    /// PWA `mojibakePattern` (coachActionPresenter.ts:93).
    static func hasMojibake(_ text: String) -> Bool {
        for scalar in "锛銆鏁璁绋惧褰浠涓寤妫鍋淇湪啋槸璇伅€" where text.contains(scalar) { return true }
        return false
    }

    /// PWA `rawTokenPattern` (coachActionPresenter.ts:90) — `\b(...tokens...)\b`, case-insensitive.
    static let rawTokenRegex: NSRegularExpression = {
        let tokens = [
            "undefined", "null", "dailyAdjustment", "nextWorkout", "dataHealth", "plateau",
            "volumeAdaptation", "sessionQuality", "setAnomaly", "recovery", "recommendationConfidence",
            "apply_temporary_session_adjustment", "create_plan_adjustment_preview", "open_record_detail",
            "open_data_health", "open_replacement_sheet", "review_volume", "review_exercise",
            "review_session", "open_next_workout", "dismiss", "keep_observing", "pending", "applied",
            "dismissed", "expired", "failed", "urgent", "high", "medium", "low",
        ].joined(separator: "|")
        // swiftlint:disable:next force_try
        return try! NSRegularExpression(pattern: "\\b(\(tokens))\\b", options: [.caseInsensitive])
    }()

    /// `\s+` whitespace collapse (PWA `.replace(/\s+/g, ' ')`).
    static let whitespaceRegex: NSRegularExpression = {
        // swiftlint:disable:next force_try
        return try! NSRegularExpression(pattern: "\\s+", options: [])
    }()

    // MARK: - Sort helpers (presentation only; no parity golden)

    /// `left || right` truthiness for the description source (PWA `action.description || action.reason`).
    static func nonEmptyOr(_ primary: String, _ fallback: String) -> String {
        primary.isEmpty ? fallback : primary
    }

    /// `a.localeCompare(b, 'zh-Hans-CN')` via Foundation's ICU collation, returning -1/0/1. Same
    /// paradigm as the engine's `localeCompareZhCN`, with the PWA presenter's `zh-Hans-CN` locale.
    static func localeCompareZhHansCN(_ a: String, _ b: String) -> Int {
        switch a.compare(b, options: [], range: nil, locale: Locale(identifier: "zh-Hans-CN")) {
        case .orderedAscending: return -1
        case .orderedSame: return 0
        case .orderedDescending: return 1
        }
    }

    /// A STABLE sort driven by a JS-style three-way comparator (negative = left first); ties keep
    /// their original relative order, mirroring `Array.prototype.sort`.
    static func stableSorted<T>(_ array: [T], _ comparator: (T, T) -> Int) -> [T] {
        array.enumerated().sorted { lhs, rhs in
            let c = comparator(lhs.element, rhs.element)
            if c != 0 { return c < 0 }
            return lhs.offset < rhs.offset
        }.map { $0.element }
    }
}
