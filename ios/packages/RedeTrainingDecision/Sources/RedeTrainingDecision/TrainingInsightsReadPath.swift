// TrainingInsightsReadPath — AN-7 insights UI read path (analytics track closure).
//
// The FIRST consumer of the AN-1…6 analytics/insights engine layer (until now those
// engines were ported + parity-pinned but "NOT wired into any UI"). This file adds
// the pure, testable orchestration that turns an already-cleaned canonical view into
// a READ-ONLY `TrainingInsightsSummary` the 今日 surface renders — PR / 趋势 /
// 平台期 / 连续打卡 / 肌群平衡 / 智能摘要. It does NOT write, does NOT change any
// engine, and touches no parity golden (additive presentation/orchestration —
// master §19.2, the same shape as `resolveTodayReadinessState`).
//
// HARD CONTRACT (master §10/§11): the analytics engines receive a clean view's
// `cleanedHistory`, NEVER raw AppData — and, per the TrainingDecision boundary, this
// package never CONSTRUCTS the clean view. The thin app-layer loader builds it via
// DataHealth `buildCleanAppDataView` (the §10 chokepoint) and hands the resolver the
// resulting `CleanAppDataView`. These analytics engines take their own loose params
// (NOT the branded `CleanTrainingDecisionInput` of §11 rule 1), exactly like the SR-4
// note: clean-derived input only, never raw AppData. Determinism is preserved
// (§11.2): the instant is INJECTED (`now`) — every engine's `nowIso` derives from it
// (and the loader builds the clean view's guard clock from the SAME instant), never
// an ambient `Date()` here.
//
// HISTORY ORDER BRIDGE. Canonical `AppData.history` is OLDEST-FIRST (the canonical
// writer appends to the end — `AppData.appendingHistorySession`), so `cleanedHistory`
// is oldest-first too. The AN-1…6 analytics engines, however, mirror the legacy web app
// (`retired web reference`) convention of a NEWEST-FIRST history (`history.slice(0,
// 8).reverse()` for the weekly report; `trendStatus` reads `trend.slice(0, 2)` as the
// RECENT points; `selectExerciseIds` reads the first 3 as the recent sessions). So the
// resolver REVERSES the cleaned history to newest-first before feeding the engines,
// bridging the on-device canonical order to the analytics convention the goldens pin.
// (Streak / recent-PR-delta / muscle-balance are timestamp-driven and order-robust;
// the reverse only matters for trend + intelligence selection, but is applied
// uniformly so every engine sees the one consistent newest-first view.)
//
// Honesty (master §15.4): the load outcomes map to honest states — `.missing` (no
// canonical file yet / first launch / no live source) and a loaded-but-empty (no
// cleaned history) view → `.empty`; `.unreadable` (a present but unparseable document)
// → `.unavailable` (degrade, never crash, never overwrite); a clean view WITH cleaned
// history → `.ready(summary)`. Within a ready summary, a section with no data (no PRs
// in the window, no core-lift trend, no important plateau) is honestly empty — the
// thin SwiftUI layer shows a "数据不足" placeholder, never a fabricated value.

import Foundation
import RedeDomain
import RedeDataHealth

/// The outcome of attempting to read + clean the canonical AppData document, produced
/// by the thin app-layer loader (the ONLY IO + the DataHealth clean-view construction,
/// which by the TrainingDecision boundary cannot happen in this package). Kept separate
/// from the resolved state so the branch logic below stays pure and fully testable
/// without a live store. Mirrors `TodayAppDataLoadOutcome`.
public enum InsightsAppDataLoadOutcome: Sendable {
    /// No canonical file exists yet (first launch) — or no live source is wired
    /// (previews/tests). An honest "no data" signal, never an error.
    case missing
    /// A canonical file exists but could not be loaded/decoded. The document is
    /// preserved untouched (this read path NEVER writes) — surface an honest degrade.
    case unreadable
    /// A canonical document loaded AND was routed through DataHealth
    /// `buildCleanAppDataView` by the loader. Only the clean view reaches the engines.
    case loaded(CleanAppDataView)
}

/// The resolved 洞察 state the thin SwiftUI layer renders verbatim.
public enum TrainingInsightsState: Equatable, Sendable {
    /// Real insights computed from the user's cleaned canonical AppData.
    case ready(TrainingInsightsSummary)
    /// No usable canonical data yet (missing file / first launch / no cleaned
    /// history) — show an honest empty state, never fabricated insights.
    case empty
    /// A canonical document exists but is unreadable — honest degrade. The document
    /// is left untouched (read-only path; never overwritten).
    case unavailable
}

/// Pure resolver: maps a load outcome to the rendered insights state. The loaded view
/// has already passed through DataHealth (master §10); the resolver only feeds the
/// already-ported analytics engines clean-derived input and reads their output (master
/// §11). `now` is the injected instant — it MUST match the instant the loader used to
/// build the clean view's guard clock, so the result is reproducible for a given
/// (`outcome`, `now`). Mirrors `resolveTodayReadinessState`.
public func resolveTrainingInsightsState(
    _ outcome: InsightsAppDataLoadOutcome,
    now: Date
) -> TrainingInsightsState {
    switch outcome {
    case .missing:
        return .empty
    case .unreadable:
        return .unavailable
    case .loaded(let cleanView):
        // No cleaned training history => no real baseline to analyze. Honest empty
        // rather than presenting the engines' bare defaults as a result.
        guard !cleanView.cleanedHistory.isEmpty else { return .empty }
        return .ready(
            TrainingInsightsSummary(
                cleanedHistory: cleanView.cleanedHistory,
                nowIso: insightsReferenceIso8601UTC(now)
            )
        )
    }
}

/// UTC ISO-8601 with fractional seconds (matches the analytics engines' parity-clock
/// format, e.g. `2026-06-03T10:00:00.000Z`). The engines read `nowIso` for week/month
/// keys and the recent-PR window; UTC keeps the whole pipeline on the codebase's
/// existing UTC-day convention. Same helper shape as the Today read path.
private func insightsReferenceIso8601UTC(_ date: Date) -> String {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    formatter.timeZone = TimeZone(identifier: "UTC")
    return formatter.string(from: date)
}

// MARK: - 训练洞察 (Insights) presentation summary

/// Read-only organization of the AN-1…6 analytics engine outputs into the 洞察 surface's
/// six sections, formatted into labeled, Chinese-localized rows + strings the thin
/// SwiftUI layer renders verbatim. Pure projection — it CALLs the already-ported engines
/// (it never recomputes or changes them) over the clean-derived, newest-first history,
/// and never touches any parity golden. Adding this additive presentation type is a
/// §19.2 extension of an active package (master §11/§18).
public struct TrainingInsightsSummary: Equatable, Sendable {
    /// 连续打卡 — current/longest training-week streak + cumulative session count.
    public let streakRows: [SurfaceRow]
    /// 近期 PR — recent personal-record deltas (within the engine's default window).
    /// Empty when no exercise set a tracked PR in the window (honest "数据不足").
    public let prRows: [SurfaceRow]
    /// 趋势 — per core-lift trend status (推进中 / 可能停滞 / 回落 / 数据不足). Only
    /// core lifts that actually have logged data appear; lifts with none are omitted.
    public let trendRows: [SurfaceRow]
    /// 肌群平衡 — the engine's one-line headline (over/under-worked summary).
    public let muscleHeadline: String
    /// 肌群平衡 — balance score + this week's effective sets + per focus-muscle volume.
    public let muscleRows: [SurfaceRow]
    /// 智能摘要 — the engine's derived key insights (always ≥1: a "still accumulating"
    /// line when there is nothing notable yet).
    public let keyInsights: [String]
    /// 平台期 — only IMPORTANT plateau signals (none / insufficient_data filtered out),
    /// each as exercise title → status label. Empty when nothing is flagged.
    public let plateauRows: [SurfaceRow]
    /// 智能摘要 — the engine's recommended next actions (labels only; read-only — the
    /// app does not execute them here).
    public let recommendedActions: [String]

    /// Build the summary from the cleaned canonical history (oldest-first as stored)
    /// and the injected `nowIso`. The history is reversed to newest-first here — the
    /// analytics-engine convention (see file header) — and fed to every engine.
    public init(cleanedHistory: [TrainingSession], nowIso: String) {
        // Canonical oldest-first → analytics newest-first (file-header order bridge).
        let recentFirst = Array(cleanedHistory.reversed())

        // 连续打卡 (AN-1 trainingStreakEngine).
        let streak = TrainingStreakEngine.computeTrainingStreak(
            recentFirst,
            TrainingStreakEngine.TrainingStreakOptions(nowIso: nowIso)
        )
        self.streakRows = [
            SurfaceRow(id: "streak-week", label: "连续训练周", value: "\(streak.currentWeekStreak) 周"),
            SurfaceRow(id: "streak-week-longest", label: "最长连续", value: "\(streak.longestWeekStreak) 周"),
            SurfaceRow(id: "streak-total", label: "累计训练", value: "\(streak.totalAnalyticsSessions) 次"),
        ]

        // 近期 PR (AN-1 recentPRDeltaEngine).
        let prs = RecentPRDeltaEngine.computeRecentPRDeltas(
            recentFirst,
            RecentPRDeltaEngine.RecentPRDeltaOptions(nowIso: nowIso)
        )
        self.prRows = prs.map { entry in
            SurfaceRow(
                id: "pr-\(entry.exerciseId)",
                label: entry.exerciseName,
                value: Self.prValue(entry)
            )
        }

        // 趋势 (AN-3 analytics dashboard) — only core lifts that have logged data.
        self.trendRows = AnalyticsDashboardEngine.coreTrendExercises.compactMap { lift in
            let trend = AnalyticsDashboardEngine.buildExerciseTrend(recentFirst, lift.id)
            guard !trend.isEmpty else { return nil }
            return SurfaceRow(
                id: "trend-\(lift.id)",
                label: lift.label,
                value: AnalyticsDashboardEngine.trendStatus(trend)
            )
        }

        // 肌群平衡 (AN-1 weeklyMuscleBalanceEngine).
        let muscle = WeeklyMuscleBalanceEngine.computeWeeklyMuscleBalance(
            recentFirst,
            WeeklyMuscleBalanceEngine.WeeklyMuscleBalanceOptions(nowIso: nowIso)
        )
        self.muscleHeadline = muscle.headline
        var muscleRows: [SurfaceRow] = [
            SurfaceRow(id: "muscle-score", label: "平衡评分", value: "\(muscle.balanceScore)"),
            SurfaceRow(id: "muscle-sets", label: "本周有效组", value: Self.num(muscle.totalEffectiveSets)),
        ]
        for entry in muscle.entries where entry.effectiveSets > 0 {
            muscleRows.append(
                SurfaceRow(
                    id: "muscle-\(entry.muscle)",
                    label: entry.muscle,
                    value: "\(Self.num(entry.effectiveSets)) 组"
                )
            )
        }
        self.muscleRows = muscleRows

        // 智能摘要 + 平台期 (AN-6 trainingIntelligenceSummaryEngine — the top aggregator,
        // which internally selects exercises and runs AN-2 plateau detection). The most
        // recent session drives selection (`latestSession` = first of newest-first).
        let intelligence = TrainingIntelligenceSummaryEngine.buildTrainingIntelligenceSummary(
            TrainingIntelligenceSummaryEngine.Params(
                latestSession: recentFirst.first,
                history: recentFirst
            )
        )
        self.keyInsights = intelligence.keyInsights
        self.recommendedActions = intelligence.recommendedActions.map { $0.label }
        self.plateauRows = (intelligence.plateauResults ?? [])
            .filter { Self.isImportantPlateau($0.status) }
            .map { result in
                SurfaceRow(
                    id: "plateau-\(result.exerciseId)",
                    label: result.title,
                    value: Self.plateauStatusLabel(result.status)
                )
            }
    }

    // MARK: - Pure formatting helpers (presentation only — internal so tests can assert)

    /// JS-`toString`-ish numeric label for the analytics decimal domain: integers drop
    /// the trailing `.0`, everything else keeps one decimal. `String(format:)` is NOT
    /// localized (C locale), so the decimal separator is always `.`.
    static func num(_ value: Double) -> String {
        if value == value.rounded(.towardZero) && abs(value) < 1e15 {
            return String(Int(value))
        }
        return String(format: "%.1f", value)
    }

    /// One recent-PR row's value, branching on the engine's `direction`.
    static func prValue(_ entry: RecentPRDeltaEngine.RecentPRDeltaEntry) -> String {
        let best = "\(num(entry.currentBestKg)) kg × \(num(entry.currentBestReps))"
        switch entry.direction {
        case "new":
            return "新纪录 · \(best)"
        case "up":
            let delta = entry.deltaKg.map { "（+\(num($0)) kg）" } ?? ""
            return "↑ \(best)\(delta)"
        case "down":
            // deltaKg already carries its minus sign for a drop.
            let delta = entry.deltaKg.map { "（\(num($0)) kg）" } ?? ""
            return "↓ \(best)\(delta)"
        default: // "flat"
            return "持平 · \(best)"
        }
    }

    /// Whether a plateau status is worth surfacing (mirrors the engine's
    /// `plateauIsImportant`: not `none`, not `insufficient_data`).
    static func isImportantPlateau(_ status: PlateauDetectionEngine.PlateauStatus) -> Bool {
        status != .none && status != .insufficientData
    }

    /// Chinese label for a plateau status (only the important ones are ever shown).
    static func plateauStatusLabel(_ status: PlateauDetectionEngine.PlateauStatus) -> String {
        switch status {
        case .plateau: return "进展停滞"
        case .possiblePlateau: return "可能停滞"
        case .loadTooAggressive: return "负荷偏激进"
        case .techniqueLimited: return "动作质量受限"
        case .fatigueLimited: return "疲劳/不适受限"
        case .volumeLimited: return "有效训练量不足"
        case .none, .insufficientData: return "—"
        }
    }
}
