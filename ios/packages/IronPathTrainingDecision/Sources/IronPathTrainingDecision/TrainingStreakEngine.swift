// TrainingStreakEngine — AN-1 leaf-analytics port (1/3).
//
// Faithful line-by-line Swift port of the PURE `computeTrainingStreak` from
// `src/engines/trainingStreakEngine.ts:93` + its private helpers
// (`computeRunLength` ts:44 / `prevWeekKey` ts:77 / `prevMonthKey` ts:82) and the
// shared `safeDate` / `isAnalyticsSession` / `weekKey` / `monthKey` /
// `startOfWeekUtc` (centralised in `AnalyticsSupport`). Zero engine dependencies —
// reads only `history` (a §11 clean input) + injected options.
//
// PURE / READ-ONLY: counts analytics sessions into UTC week/month buckets and
// derives current/longest streaks. Zero `: Date` — "今天" is the injected
// `options.nowIso`, never the wall clock (the TS `|| new Date()` / `?? Date.now()`
// wall-clock fallbacks are intentionally NOT reproduced; the §11 clean input always
// supplies `nowIso`). No IO, no randomness, no write path. NOT wired into any UI
// (that is AN-6); this slice only adds the function and parity-pins it.

import Foundation
import IronPathDomain

public enum TrainingStreakEngine {

    /// `TrainingStreakResult` (trainingStreakEngine.ts:3). `lastActiveWeekKey`
    /// follows the TS `canonicalStringify` drop-undefined rule (omitted when no
    /// analytics session has a valid timestamp).
    public struct TrainingStreakResult: Equatable, Sendable {
        public let currentWeekStreak: Int
        public let longestWeekStreak: Int
        public let currentMonthStreak: Int
        public let longestMonthStreak: Int
        public let totalAnalyticsSessions: Int
        public let lastActiveWeekKey: String?
        public let reason: String
    }

    /// `TrainingStreakOptions` (trainingStreakEngine.ts:88). `nowIso` is REQUIRED
    /// (the §11 injected clock — no wall-clock fallback). `weekStartDayOfWeek`
    /// defaults to 1 (Monday).
    public struct TrainingStreakOptions: Sendable {
        public let nowIso: String
        public let weekStartDayOfWeek: Int?
        public init(nowIso: String, weekStartDayOfWeek: Int? = nil) {
            self.nowIso = nowIso
            self.weekStartDayOfWeek = weekStartDayOfWeek
        }
    }

    // MARK: - computeRunLength (trainingStreakEngine.ts:44)

    /// Returns (current streak walking back from `currentKey`, longest consecutive
    /// run in `sortedKeys`). The TS `lastActiveKey` field is computed but unused by
    /// the caller, so it is omitted here.
    private static func computeRunLength(
        _ currentKey: String,
        _ sortedKeys: [String],
        _ previousKey: (String) -> String
    ) -> (current: Int, longest: Int) {
        if sortedKeys.isEmpty { return (0, 0) }
        let set = Set(sortedKeys)

        // current streak: walk backward from currentKey while keys exist.
        var current = 0
        var cursor = currentKey
        while set.contains(cursor) {
            current += 1
            cursor = previousKey(cursor)
        }

        // longest streak: walk sortedKeys (ascending) and detect consecutive runs.
        var longest = 0
        var run = 0
        for i in 0..<sortedKeys.count {
            if i == 0 {
                run = 1
            } else {
                let expected = previousKey(sortedKeys[i]) // previous of current must equal previous key
                run = sortedKeys[i - 1] == expected ? run + 1 : 1
            }
            if run > longest { longest = run }
        }

        return (current, longest)
    }

    /// `prevWeekKey` (trainingStreakEngine.ts:77). `Date.parse(`${key}T12:00:00.000Z`)`
    /// is the noon-UTC parse `AnalyticsSupport.safeDate` performs for a `YYYY-MM-DD`
    /// key (always a valid weekKey output → non-nil).
    private static func prevWeekKey(_ key: String, _ weekStartDow: Int) -> String {
        let ms = AnalyticsSupport.safeDate(key) ?? 0
        return AnalyticsSupport.weekKey(ms - 7 * AnalyticsSupport.msPerDay, weekStartDow)
    }

    /// `prevMonthKey` (trainingStreakEngine.ts:82): `new Date(Date.UTC(year, month-2, 1))`
    /// formatted `YYYY-MM`. Reproduces `Date.UTC` month underflow with integer month
    /// arithmetic (only year+month feed the key).
    private static func prevMonthKey(_ key: String) -> String {
        let parts = key.split(separator: "-")
        let year = Int(parts[0]) ?? 0
        let month = parts.count > 1 ? (Int(parts[1]) ?? 0) : 0
        // Date.UTC(year, month-2, 1): 0-indexed month index = year*12 + (month-2).
        let idx = year * 12 + (month - 2)
        let ny = Int((Double(idx) / 12).rounded(.down))  // floorDiv
        let nm0 = idx - ny * 12                           // [0, 11]
        let nm = nm0 + 1
        return "\(ny)-\(nm < 10 ? "0\(nm)" : "\(nm)")"
    }

    // MARK: - computeTrainingStreak (trainingStreakEngine.ts:93)

    public static func computeTrainingStreak(
        _ history: [TrainingSession],
        _ options: TrainingStreakOptions
    ) -> TrainingStreakResult {
        let nowMs = AnalyticsSupport.safeDate(options.nowIso) ?? 0
        let weekStartDow = options.weekStartDayOfWeek ?? 1

        var weekKeys = Set<String>()
        var monthKeys = Set<String>()
        var total = 0

        for session in history {
            if !AnalyticsSupport.isAnalyticsSession(session) { continue }
            guard let ts = AnalyticsSupport.sessionTimestamp(session) else { continue }
            weekKeys.insert(AnalyticsSupport.weekKey(ts, weekStartDow))
            monthKeys.insert(AnalyticsSupport.monthKey(ts))
            total += 1
        }

        // `[...set].sort()` — JS default lexicographic; for fixed-format
        // `YYYY-MM[-DD]` strings that is chronological, matching Swift's
        // code-point `sorted()`.
        let sortedWeeks = weekKeys.sorted()
        let sortedMonths = monthKeys.sorted()
        let currentWeek = AnalyticsSupport.weekKey(nowMs, weekStartDow)
        let currentMonth = AnalyticsSupport.monthKey(nowMs)

        let weekRun = computeRunLength(currentWeek, sortedWeeks) { prevWeekKey($0, weekStartDow) }
        let monthRun = computeRunLength(currentMonth, sortedMonths) { prevMonthKey($0) }

        // current streak interpretation: if the user hasn't trained THIS week yet,
        // keep the streak alive from last week (and from prevMonthKey for months).
        var currentWeekStreak = weekRun.current
        if currentWeekStreak == 0 && weekKeys.contains(prevWeekKey(currentWeek, weekStartDow)) {
            var cursor = prevWeekKey(currentWeek, weekStartDow)
            while weekKeys.contains(cursor) {
                currentWeekStreak += 1
                cursor = prevWeekKey(cursor, weekStartDow)
            }
        }

        var currentMonthStreak = monthRun.current
        if currentMonthStreak == 0 && monthKeys.contains(prevMonthKey(currentMonth)) {
            var cursor = prevMonthKey(currentMonth)
            while monthKeys.contains(cursor) {
                currentMonthStreak += 1
                cursor = prevMonthKey(cursor)
            }
        }

        let reason: String
        if total == 0 {
            reason = "尚无训练记录，开始第一次训练就会建立连续记录。"
        } else if currentWeekStreak == 0 {
            reason = "连续训练已中断（最近一次：\(sortedWeeks.last ?? "未知") 周）。"
        } else {
            reason = "当前已连续训练 \(currentWeekStreak) 周；历史最长 \(weekRun.longest) 周。"
        }

        return TrainingStreakResult(
            currentWeekStreak: currentWeekStreak,
            longestWeekStreak: weekRun.longest,
            currentMonthStreak: currentMonthStreak,
            longestMonthStreak: monthRun.longest,
            totalAnalyticsSessions: total,
            lastActiveWeekKey: sortedWeeks.last,
            reason: reason
        )
    }
}
