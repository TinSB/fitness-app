// NextWorkoutReadPath — SC-D scheduling UI read path (scheduling-track closure).
//
// The FIRST consumer of the SC-0/1/1b/A/B/C scheduling engine layer (until now those
// schedulers were ported + parity-pinned but "NOT wired into any UI"). This file adds
// the pure, testable orchestration that turns an already-cleaned canonical view into a
// READ-ONLY `NextWorkoutScheduleSummary` the 今日 surface renders — 下次训练
// (`buildNextWorkoutRecommendation`) together with its nested 恢复感知推荐
// (`recovery: RecoveryAwareRecommendation`). It does NOT write, does NOT change any
// engine, and touches no parity golden (additive presentation/orchestration —
// master §19.2, the same shape as `resolveTrainingInsightsState` / `resolveTodayReadinessState`).
//
// HARD CONTRACT (master §10/§11): the schedulers receive clean-derived inputs, NEVER a
// raw AppData value — and, per the TrainingDecision boundary, this package never
// CONSTRUCTS the clean view. The thin app-layer loader builds it via DataHealth
// `buildCleanAppDataView` (the §10 chokepoint) and hands the resolver the resulting
// `CleanAppDataView`. The resolver then plucks ONLY individual fields out of that gated
// view: `history` / `activeSession` from the CLEANED projections
// (`cleanedHistory` / `cleanedActiveSession`, §11 rule — history is never raw), and the
// CONFIG slots `programTemplate` / `templates` / `settings.selectedTemplateId` from the
// view's `raw` document (exactly the precedent `createCleanTrainingDecisionInput` /
// `PlanDisplayProjection` set — the data-health guards do not clean those config slots,
// and no raw AppData value escapes into the engines). `templates` rides un-promoted in
// the document (the PWA reads `data.templates`, enginePipeline.ts:61), so it is decoded
// from `raw.root["templates"]` — config, not history. Determinism is preserved (§11.2):
// the instant is INJECTED (`now`) — `todayState`'s `nowIso` derives from it (and the
// loader builds the clean view's guard clock from the SAME instant), never an ambient
// `Date()` here.
//
// SCOPE HONESTY (master §15.4, the `TodayRealReadiness` precedent): the full PWA
// `trainingDecisionContext` (which would source `painPatterns` / `readinessResult` /
// `weeklyVolumeSummary` / `trainingMode`) is NOT ported, so those optional scheduler
// inputs are left at their honest defaults rather than fabricated — an honest V1 scope.
// The recommendation is therefore the schedule/rotation/recovery core; pain/readiness
// overrides arrive when a real check-in source is wired (a later slice).
//
// Honesty (master §15.4): the load outcomes map to honest states — `.missing` (no
// canonical file yet / first launch / no live source) and a loaded-but-empty (no cleaned
// history) view → `.empty`; `.unreadable` (a present but unparseable document) →
// `.unavailable` (degrade, never crash, never overwrite); a clean view WITH cleaned
// history → `.ready(summary)`. Within a ready summary, an empty `templates` slot is
// seeded with `DefaultTrainingData.initialTemplates` (FU-1: the native read chain now
// reproduces the PWA load-layer `sanitizeTemplates` seed — appDataSanitize.ts:705 —
// at decode time, read-only/never written), so a fresh user falls onto the default
// program's day instead of the bare "暂无下次建议" branch; a non-empty templates slot is
// used verbatim (the empty→default seed is the ONLY normalization here).

import Foundation
import IronPathDomain
import IronPathDataHealth

/// The outcome of attempting to read + clean the canonical AppData document, produced by
/// the thin app-layer loader (the ONLY IO + the DataHealth clean-view construction, which
/// by the TrainingDecision boundary cannot happen in this package). Kept separate from the
/// resolved state so the branch logic below stays pure and fully testable without a live
/// store. Mirrors `InsightsAppDataLoadOutcome` / `TodayAppDataLoadOutcome`.
public enum NextWorkoutAppDataLoadOutcome: Sendable {
    /// No canonical file exists yet (first launch) — or no live source is wired
    /// (previews/tests). An honest "no data" signal, never an error.
    case missing
    /// A canonical file exists but could not be loaded/decoded. The document is preserved
    /// untouched (this read path NEVER writes) — surface an honest degrade.
    case unreadable
    /// A canonical document loaded AND was routed through DataHealth `buildCleanAppDataView`
    /// by the loader. Only the clean view reaches the schedulers.
    case loaded(CleanAppDataView)
}

/// The resolved 下次训练/恢复 state the thin SwiftUI layer renders verbatim.
public enum NextWorkoutScheduleState: Equatable, Sendable {
    /// A real next-workout + recovery recommendation computed from the user's cleaned
    /// canonical AppData.
    case ready(NextWorkoutScheduleSummary)
    /// No usable canonical data yet (missing file / first launch / no cleaned history) —
    /// show an honest empty state, never a fabricated recommendation.
    case empty
    /// A canonical document exists but is unreadable — honest degrade. The document is left
    /// untouched (read-only path; never overwritten).
    case unavailable
}

/// Pure resolver: maps a load outcome to the rendered scheduling state. The loaded view has
/// already passed through DataHealth (master §10); the resolver only feeds the already-ported
/// schedulers clean-derived input and reads their output (master §11). `now` is the injected
/// instant — it MUST match the instant the loader used to build the clean view's guard clock,
/// so the result is reproducible for a given (`outcome`, `now`). Mirrors
/// `resolveTrainingInsightsState`.
public func resolveNextWorkoutScheduleState(
    _ outcome: NextWorkoutAppDataLoadOutcome,
    now: Date
) -> NextWorkoutScheduleState {
    switch outcome {
    case .missing:
        return .empty
    case .unreadable:
        return .unavailable
    case .loaded(let cleanView):
        // No cleaned training history => no real baseline to rotate from. Honest empty
        // rather than presenting the schedulers' bare first-launch defaults as a result
        // (keeps the 今日 read blocks consistent — they all light up together once there
        // is real training data).
        guard !cleanView.cleanedHistory.isEmpty else { return .empty }

        let nowIso = nextWorkoutReferenceIso8601UTC(now)
        // CONFIG slots plucked from the gated view's raw document (not history):
        //   * programTemplate — the promoted accessor (the `PlanDisplayProjection` precedent).
        //   * templates       — un-promoted; decoded from `root["templates"]` (the PWA's
        //                        `data.templates`). Empty -> seeded with
        //                        `DefaultTrainingData.initialTemplates`, reproducing the PWA
        //                        load-layer `sanitizeTemplates` seed (appDataSanitize.ts:705)
        //                        the native read chain previously omitted — read-only, never
        //                        written back (FU-1). See `decodeTrainingTemplates`.
        //   * plannedTemplateId — the user's selected template id from settings (optional).
        let programTemplate = cleanView.raw.programTemplate
        let templates = decodeTrainingTemplates(cleanView)

        // 今日训练状态 — built purely from the CLEANED history + active session + the injected
        // instant (SC-B `buildTodayTrainingState`); it drives the scheduler's rotation anchor
        // and the "下次建议不会覆盖今天" reason without any wall clock here.
        let todayState = TodayStateEngine.buildTodayTrainingState(
            activeSession: cleanView.cleanedActiveSession,
            history: cleanView.cleanedHistory,
            plannedTemplateId: cleanView.raw.settings.selectedTemplateId,
            nowIso: nowIso
        )

        // SC-C `buildNextWorkoutRecommendation` consumes SC-0/1/A/B. Only the clean-derived
        // inputs are supplied; the un-ported context inputs (pain / readiness / weekly volume
        // / training mode) stay at their honest defaults (file header "SCOPE HONESTY").
        let recommendation = NextWorkoutScheduler.buildNextWorkoutRecommendation(
            history: cleanView.cleanedHistory,
            activeSession: cleanView.cleanedActiveSession,
            programTemplate: programTemplate,
            templates: templates,
            todayState: todayState
        )
        return .ready(NextWorkoutScheduleSummary(recommendation: recommendation))
    }
}

/// Decode the user's training day templates out of the gated view's raw document, with the
/// FU-1 empty→default seed. `templates` is not a promoted Domain field (it rides in `root`,
/// mirroring the PWA `data.templates`), so it is read the same way the Domain `AppData.history`
/// accessor reads `root["history"]`. A missing/garbled entry is skipped (`try?`) — never
/// crashes, never fabricates a template.
///
/// FU-1: when the decode yields NO usable templates (absent slot, empty array, or every entry
/// garbled), the native read chain seeds `DefaultTrainingData.initialTemplates` — reproducing
/// the PWA load-layer `sanitizeTemplates` seed (`appDataSanitize.ts:705`,
/// `Array.isArray(source) && source.length ? source : INITIAL_TEMPLATES`) that the iOS read
/// chain previously omitted (leaving fresh users with no "today's training"). This is the SAME
/// empty→default pattern `ProgramAdjustmentEngineSelectDayDiff.swift:201` already uses
/// (`context.templates?.isEmpty == false ? context.templates! : DefaultTrainingData.initialTemplates`).
/// It is a READ-TIME projection only — nothing is written back to disk — and it ONLY fills the
/// empty case: a non-empty (even malformed-but-decodable) set is returned verbatim, never the
/// per-template hydrate/migrate/validate of the full `sanitizeTemplates` (that is a separate slice).
/// Shared by the SC scheduling read path and the FU-1 Focus live read path
/// (`resolveFocusTrainingState`) so both surfaces seed identically.
func decodeTrainingTemplates(_ cleanView: CleanAppDataView) -> [TrainingTemplate] {
    let decoded: [TrainingTemplate]
    if let array = cleanView.raw.root["templates"]?.arrayValue {
        decoded = array.compactMap { try? TrainingTemplate(decoding: $0) }
    } else {
        decoded = []
    }
    return decoded.isEmpty ? DefaultTrainingData.initialTemplates : decoded
}

/// UTC ISO-8601 with fractional seconds (matches the engines' parity-clock format, e.g.
/// `2026-06-03T10:00:00.000Z`). `buildTodayTrainingState` reads `nowIso.prefix(10)` as the
/// reference day; UTC keeps the whole pipeline on the codebase's existing UTC-day convention.
/// Same helper shape as the Today / Insights read paths.
private func nextWorkoutReferenceIso8601UTC(_ date: Date) -> String {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    formatter.timeZone = TimeZone(identifier: "UTC")
    return formatter.string(from: date)
}

// MARK: - 下次训练/恢复 (scheduling) presentation summary

/// Read-only organization of the `NextWorkoutScheduler.NextWorkoutRecommendation` (and its
/// nested `RecoveryAwareScheduler.RecoveryAwareRecommendation`) into labeled,
/// Chinese-localized rows + strings the thin SwiftUI layer renders verbatim. Pure projection —
/// it reads the already-ported scheduler's output (it never recomputes or changes it) and
/// never touches any parity golden. Adding this additive presentation type is a §19.2 extension
/// of an active package (master §11/§18).
public struct NextWorkoutScheduleSummary: Equatable, Sendable {
    /// The recommended next training day's display name (the scheduler's honest
    /// "暂无下次建议" when no template is available).
    public let headline: String
    /// 训练类型 — Chinese label for the recommendation kind (正常训练 / 调整后训练 / 休息 /
    /// 主动恢复 / 仅活动度). "—" when the scheduler emits no kind.
    public let kindLabel: String
    /// The scheduler's composed explanation string (read-only; shown verbatim).
    public let reason: String
    /// 推荐训练日 / 建议信心 / 恢复冲突 / 原计划 — the at-a-glance rows.
    public let scheduleRows: [SurfaceRow]
    /// Present only when the recommended day DIFFERS from the planned day (a recovery/readiness
    /// override) — the engine's own override explanation. nil when on-plan.
    public let overrideReason: String?
    /// The scheduler's de-duplicated warnings (e.g. 准备度较低 / 重复模板提示). Empty when none.
    public let warnings: [String]
    /// 备选训练日 — up to three alternatives, each `templateName → reason` (read-only; the app
    /// does not select them here).
    public let alternatives: [SurfaceRow]
    /// 恢复感知推荐 — the nested `RecoveryAwareRecommendation` projection, present only when the
    /// scheduler produced one (it is nil for the open-active-session / no-template short-circuits).
    public let recovery: RecoverySection?

    /// The read-only projection of the nested recovery-aware recommendation.
    public struct RecoverySection: Equatable, Sendable {
        /// 今日建议：… — the recovery recommendation's title.
        public let title: String
        /// The recovery recommendation's one-line summary.
        public let summary: String
        /// Chinese label for the recovery kind (same mapping as `kindLabel`).
        public let kindLabel: String
        /// 恢复冲突 — Chinese label for the recovery conflict level (无 / 低 / 中 / 高).
        public let conflictLabel: String
        /// The muscle/area names the recovery signal flags (read-only; may be empty).
        public let affectedAreas: [String]
        /// The recovery recommendation's reason lines (read-only; may be empty).
        public let reasons: [String]
    }

    /// Build the summary from a scheduler recommendation. Pure projection — every field is a
    /// verbatim read or a deterministic label of the engine's output.
    public init(recommendation: NextWorkoutScheduler.NextWorkoutRecommendation) {
        self.headline = recommendation.templateName
        self.kindLabel = recommendation.kind.map(Self.kindLabel) ?? "—"
        self.reason = recommendation.reason

        var rows: [SurfaceRow] = [
            SurfaceRow(id: "next-template", label: "推荐训练日", value: recommendation.templateName),
            SurfaceRow(id: "next-confidence", label: "建议信心", value: Self.confidenceLabel(recommendation.confidence)),
        ]
        if let conflict = recommendation.conflictLevel {
            rows.append(SurfaceRow(id: "next-conflict", label: "恢复冲突", value: Self.conflictLabel(conflict)))
        }
        // Surface the planned day only when the recommendation overrode it (else it is redundant
        // with 推荐训练日).
        if let planned = recommendation.plannedTemplateName, planned != recommendation.templateName {
            rows.append(SurfaceRow(id: "next-planned", label: "原计划训练日", value: planned))
        }
        self.scheduleRows = rows

        self.overrideReason = recommendation.overrideReason
        self.warnings = recommendation.warnings
        self.alternatives = recommendation.alternatives.enumerated().map { index, alternative in
            SurfaceRow(id: "next-alt-\(index)", label: alternative.templateName, value: alternative.reason)
        }

        if let recovery = recommendation.recovery {
            self.recovery = RecoverySection(
                title: recovery.title,
                summary: recovery.summary,
                kindLabel: Self.kindLabel(recovery.kind),
                conflictLabel: Self.conflictLabel(recovery.conflictLevel),
                affectedAreas: recovery.affectedAreas,
                reasons: recovery.reasons
            )
        } else {
            self.recovery = nil
        }
    }

    // MARK: - Pure label helpers (presentation only — internal so tests can assert)

    /// Chinese label for a daily recommendation kind (shared by the next-workout kind and the
    /// nested recovery kind).
    static func kindLabel(_ kind: RecoveryAwareScheduler.DailyRecommendationKind) -> String {
        switch kind {
        case .train: return "正常训练"
        case .modifiedTrain: return "调整后训练"
        case .rest: return "休息"
        case .activeRecovery: return "主动恢复"
        case .mobilityOnly: return "仅活动度"
        }
    }

    /// Chinese label for the recommendation confidence.
    static func confidenceLabel(_ confidence: NextWorkoutScheduler.NextWorkoutRecommendation.Confidence) -> String {
        switch confidence {
        case .high: return "高"
        case .medium: return "中"
        case .low: return "低"
        }
    }

    /// Chinese label for a recovery conflict level.
    static func conflictLabel(_ level: RecoveryAwareScheduler.RecoveryConflictLevel) -> String {
        switch level {
        case .none: return "无"
        case .low: return "低"
        case .moderate: return "中"
        case .high: return "高"
        }
    }
}
