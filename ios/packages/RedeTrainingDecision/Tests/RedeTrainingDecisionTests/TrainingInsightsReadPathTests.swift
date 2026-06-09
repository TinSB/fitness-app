// AN-7 insights read-path V1 — branch tests for `resolveTrainingInsightsState` +
// `TrainingInsightsSummary`.
//
// Covers (1) the PURE outcome→state branch logic (no IO, no live store): the thin
// app-layer loader supplies the `InsightsAppDataLoadOutcome` (already routed through the
// GENUINE RedeDataHealth clean view); this resolver maps it to an honest rendered
// state; (2) the oldest-first→newest-first history ORDER BRIDGE the summary applies
// before feeding the analytics engines (file header "HISTORY ORDER BRIDGE", :150); and
// (3) every internal presentation helper branch (num / prValue / isImportantPlateau /
// plateauStatusLabel — the file marks them `internal so tests can assert`). Clean-view
// fixtures are built in memory via CoreSliceTestKit; the injected `now` matches the parity
// clock so results are deterministic. Mirrors TodayRealReadinessTests.

import XCTest
import RedeDomain
import RedeDataHealth
@testable import RedeTrainingDecision

final class TrainingInsightsReadPathTests: XCTestCase {

    /// The injected instant for the resolver — the same UTC parity instant the
    /// CoreSliceTestKit session gaps derive from.
    private func fixedNow() -> Date {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        f.timeZone = TimeZone(identifier: "UTC")
        return f.date(from: CoreSliceTestKit.deterministicClockIso)!
    }

    /// Two completed sessions (latest 2d ago, prior 9d ago) — a real baseline.
    private func sessionsWithBaseline() -> [TrainingSession] {
        [CoreSliceTestKit.session(id: "ins-late", gap: 2),
         CoreSliceTestKit.session(id: "ins-early", gap: 9)]
    }

    // MARK: - resolver branches (mirror resolveTodayReadinessState)

    func test_missing_resolvesToEmpty() {
        XCTAssertEqual(resolveTrainingInsightsState(.missing, now: fixedNow()), .empty)
    }

    func test_unreadable_resolvesToUnavailable() {
        XCTAssertEqual(resolveTrainingInsightsState(.unreadable, now: fixedNow()), .unavailable)
    }

    func test_loadedEmptyHistory_resolvesToEmpty() {
        // A loaded document with NO cleaned history → honest empty, never the engines' bare defaults.
        let cleanView = CoreSliceTestKit.cleanView(sessions: [], todayStatus: CoreSliceTestKit.todayStatusJSON())
        XCTAssertEqual(resolveTrainingInsightsState(.loaded(cleanView), now: fixedNow()), .empty)
    }

    func test_loadedWithHistory_resolvesToReadySummary() {
        let cleanView = CoreSliceTestKit.cleanView(
            sessions: sessionsWithBaseline(),
            todayStatus: CoreSliceTestKit.todayStatusJSON()
        )
        guard case .ready(let summary) = resolveTrainingInsightsState(.loaded(cleanView), now: fixedNow()) else {
            return XCTFail("expected .ready for a document with cleaned history")
        }
        // The 连续打卡 section is always the same three stable rows.
        XCTAssertEqual(summary.streakRows.map(\.id), ["streak-week", "streak-week-longest", "streak-total"])
        // 智能摘要 always carries ≥1 insight (a "still accumulating" line when nothing notable).
        XCTAssertFalse(summary.keyInsights.isEmpty, "智能摘要 always has ≥1 key insight")
    }

    func test_resolution_isDeterministic() {
        let cleanView = CoreSliceTestKit.cleanView(
            sessions: sessionsWithBaseline(),
            todayStatus: CoreSliceTestKit.todayStatusJSON()
        )
        let a = resolveTrainingInsightsState(.loaded(cleanView), now: fixedNow())
        let b = resolveTrainingInsightsState(.loaded(cleanView), now: fixedNow())
        XCTAssertEqual(a, b)
    }

    // MARK: - history order bridge (oldest-first canonical → newest-first analytics, :150)

    /// A core-lift (bench-press) session with one completed high-quality set at `weight`.
    private func benchSession(id: String, date: String, weight: Double) -> TrainingSession {
        let set = TrainingSetLog(weight: .double(weight), reps: .integer(6), rir: .number(.integer(2)), techniqueQuality: "good", done: true)
        return TrainingSession(id: id, date: date, completed: true, exercises: [ExercisePrescription(id: "bench-press", sets: [set])])
    }

    func test_summary_reversesHistoryToNewestFirst_loadBearing() {
        // Canonical history is OLDEST-FIRST (as the writer stores it): bench-press top
        // weight RISES over time. The summary reverses it to newest-first before feeding
        // the trend engine (the analytics convention the goldens pin).
        let oldestFirst = [
            benchSession(id: "b1", date: "2026-04-17", weight: 60),  // oldest
            benchSession(id: "b2", date: "2026-04-27", weight: 65),
            benchSession(id: "b3", date: "2026-05-07", weight: 70),
            benchSession(id: "b4", date: "2026-05-17", weight: 75),  // newest
        ]
        let summary = TrainingInsightsSummary(cleanedHistory: oldestFirst, nowIso: CoreSliceTestKit.deterministicClockIso)
        let benchTrend = summary.trendRows.first { $0.id == "trend-bench-press" }?.value
        // Reversed → engines read newest(75)-first → recent best > older best → 推进中.
        XCTAssertEqual(benchTrend, "推进中")
        // Load-bearing: WITHOUT the reverse the engines would read oldest(60)-first and
        // mis-read the SAME rising data as declining.
        let wrongOrder = AnalyticsDashboardEngine.buildExerciseTrend(oldestFirst, "bench-press")
        XCTAssertEqual(AnalyticsDashboardEngine.trendStatus(wrongOrder), "回落")
        XCTAssertNotEqual(benchTrend, AnalyticsDashboardEngine.trendStatus(wrongOrder),
                          "the order bridge changes the trend verdict — the reverse is load-bearing")
    }

    // MARK: - num (integers drop trailing .0; fractions keep one C-locale decimal)

    func test_num_dropsTrailingZeroForIntegers() {
        XCTAssertEqual(TrainingInsightsSummary.num(0), "0")
        XCTAssertEqual(TrainingInsightsSummary.num(5), "5")
        XCTAssertEqual(TrainingInsightsSummary.num(12), "12")
        XCTAssertEqual(TrainingInsightsSummary.num(-3), "-3")
    }

    func test_num_keepsOneDecimalForFractions() {
        XCTAssertEqual(TrainingInsightsSummary.num(2.5), "2.5")
        XCTAssertEqual(TrainingInsightsSummary.num(7.3), "7.3")
        XCTAssertEqual(TrainingInsightsSummary.num(10.5), "10.5")
    }

    // MARK: - prValue (the recent-PR direction branches)

    private func prEntry(_ direction: String, kg: Double, reps: Double, deltaKg: Double?) -> RecentPRDeltaEngine.RecentPRDeltaEntry {
        RecentPRDeltaEngine.RecentPRDeltaEntry(
            exerciseId: "x", exerciseName: "X", windowDays: 14,
            currentBestKg: kg, currentBestReps: reps, currentBestDate: "2026-05-27",
            previousBestKg: nil, previousBestReps: nil, previousBestDate: nil,
            deltaKg: deltaKg, deltaPercent: nil, direction: direction
        )
    }

    func test_prValue_new() {
        XCTAssertEqual(TrainingInsightsSummary.prValue(prEntry("new", kg: 100, reps: 5, deltaKg: nil)), "新纪录 · 100 kg × 5")
    }

    func test_prValue_upWithAndWithoutDelta() {
        XCTAssertEqual(TrainingInsightsSummary.prValue(prEntry("up", kg: 102.5, reps: 5, deltaKg: 2.5)), "↑ 102.5 kg × 5（+2.5 kg）")
        XCTAssertEqual(TrainingInsightsSummary.prValue(prEntry("up", kg: 102.5, reps: 5, deltaKg: nil)), "↑ 102.5 kg × 5")
    }

    func test_prValue_downCarriesItsOwnMinusSign() {
        // deltaKg already carries the minus sign for a drop, so the label adds no extra "+".
        XCTAssertEqual(TrainingInsightsSummary.prValue(prEntry("down", kg: 97.5, reps: 5, deltaKg: -2.5)), "↓ 97.5 kg × 5（-2.5 kg）")
    }

    func test_prValue_flatAndUnknownFallThroughToDefault() {
        XCTAssertEqual(TrainingInsightsSummary.prValue(prEntry("flat", kg: 100, reps: 5, deltaKg: nil)), "持平 · 100 kg × 5")
        XCTAssertEqual(TrainingInsightsSummary.prValue(prEntry("???", kg: 100, reps: 5, deltaKg: nil)), "持平 · 100 kg × 5")
    }

    // MARK: - plateau helpers

    func test_isImportantPlateau_filtersNoneAndInsufficient() {
        XCTAssertFalse(TrainingInsightsSummary.isImportantPlateau(.none))
        XCTAssertFalse(TrainingInsightsSummary.isImportantPlateau(.insufficientData))
        XCTAssertTrue(TrainingInsightsSummary.isImportantPlateau(.plateau))
        XCTAssertTrue(TrainingInsightsSummary.isImportantPlateau(.possiblePlateau))
        XCTAssertTrue(TrainingInsightsSummary.isImportantPlateau(.loadTooAggressive))
        XCTAssertTrue(TrainingInsightsSummary.isImportantPlateau(.techniqueLimited))
        XCTAssertTrue(TrainingInsightsSummary.isImportantPlateau(.fatigueLimited))
        XCTAssertTrue(TrainingInsightsSummary.isImportantPlateau(.volumeLimited))
    }

    func test_plateauStatusLabel_everyCase() {
        XCTAssertEqual(TrainingInsightsSummary.plateauStatusLabel(.plateau), "进展停滞")
        XCTAssertEqual(TrainingInsightsSummary.plateauStatusLabel(.possiblePlateau), "可能停滞")
        XCTAssertEqual(TrainingInsightsSummary.plateauStatusLabel(.loadTooAggressive), "负荷偏激进")
        XCTAssertEqual(TrainingInsightsSummary.plateauStatusLabel(.techniqueLimited), "动作质量受限")
        XCTAssertEqual(TrainingInsightsSummary.plateauStatusLabel(.fatigueLimited), "疲劳/不适受限")
        XCTAssertEqual(TrainingInsightsSummary.plateauStatusLabel(.volumeLimited), "有效训练量不足")
        XCTAssertEqual(TrainingInsightsSummary.plateauStatusLabel(.none), "—")
        XCTAssertEqual(TrainingInsightsSummary.plateauStatusLabel(.insufficientData), "—")
    }
}
