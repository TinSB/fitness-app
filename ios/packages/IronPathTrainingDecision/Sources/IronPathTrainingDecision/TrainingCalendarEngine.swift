// TrainingCalendarEngine — SC-B scheduling-track self-contained calendar subset port.
//
// Faithful line-by-line Swift port of the PURE, self-contained subset of
// `src/engines/trainingCalendarEngine.ts`: the 10 date/month helpers
// (`toLocalDateKey` ts:58 / `getSessionCalendarDate` ts:67 /
// `normalizeCalendarMonth` ts:69 / `addCalendarMonths` ts:74 /
// `buildTrainingCalendarMonthRange` ts:83 / `clampCalendarMonth` ts:100 /
// `getLatestTrainingDateKey` ts:107 / `getInitialCalendarMonth` ts:116 /
// `getDefaultCalendarDateForMonth` ts:122 / `resolveCalendarSelectedDate` ts:130)
// plus the 4 calendar contract types (`TrainingCalendarDay` ts:5 /
// `TrainingCalendarData` ts:36 / `TrainingCalendarOptions` ts:45 /
// `TrainingCalendarMonthRange` ts:52). The 10 helpers depend ONLY on the TS
// `engineUtils.monthKey/number` defaults + the Domain `TrainingSession` type —
// no other engine, no data table.
//
// ── DEFERRED (NOT ported here) ──────────────────────────────────────────────
// `buildTrainingCalendar` (trainingCalendarEngine.ts:182) — the aggregator — is
// DEFERRED to a later slice. It is the ONE export that calls
// `buildSessionDetailSummary` (ts:209), of which only the sessionQuality-CALLED
// subset is native (AN-4); its real prerequisite is porting the COMPLETE
// `sessionDetailSummary`. Its private helpers (`shouldIncludeSession` ts:141 /
// `shouldIncludeExternalWorkout` ts:148 / `startOfWeekKey` ts:158 /
// `monthDayKeys` ts:167 / `sessionHasPain` ts:179) are deferred WITH it. This
// is the same DEFER precedent as SC-1's `recoveryAwareScheduler`. The 3 types
// `TrainingCalendarDay`/`Data`/`Options` are `buildTrainingCalendar`'s I/O
// contract shapes — defined here (cheap, additive, their `ImportedWorkoutSample`
// dep is already native in IronPathDomain) but NOT golden-pinned, since their
// producer is deferred. Only `TrainingCalendarMonthRange` is produced by a ported
// helper and thus parity-pinned.
//
// PURE / READ-ONLY: zero `: Date` — "今天" never comes from the wall clock. The
// TS `monthKey()` / `new Date().toISOString()` DEFAULTS are wall-clock seams; this
// port threads them as INJECTED `nowMonth` parameters (the established AN-1
// injected-clock contract), and every parity fixture passes an explicit value so
// the seam is never the load-bearing path. All date math is integer
// civil-calendar arithmetic via `AnalyticsSupport.daysFromCivil/civilFromDays`
// (reused verbatim — never re-derived). No IO, no randomness, no write path. NOT
// wired into any UI (that is a later SC slice); this slice only adds the helpers +
// types and parity-pins them (§19.2).

import Foundation
import IronPathDomain

public enum TrainingCalendarEngine {

    // MARK: - Types (trainingCalendarEngine.ts:5-56)

    /// `TrainingCalendarMonthRange` (trainingCalendarEngine.ts:52). Produced by
    /// `buildTrainingCalendarMonthRange` + consumed by `clampCalendarMonth` — the ONE
    /// calendar type this slice golden-pins.
    public struct TrainingCalendarMonthRange: Equatable, Sendable {
        public let earliestMonth: String
        public let latestMonth: String
        public let hasHistory: Bool

        public init(earliestMonth: String, latestMonth: String, hasHistory: Bool) {
            self.earliestMonth = earliestMonth
            self.latestMonth = latestMonth
            self.hasHistory = hasHistory
        }
    }

    /// `TrainingCalendarDay` (trainingCalendarEngine.ts:5). SHAPE-ONLY contract type of the
    /// DEFERRED `buildTrainingCalendar`; not produced by any ported helper, so not golden-pinned.
    /// `dataFlag` mirrors the TS `SessionDataFlag` union (`'normal' | 'test' | 'excluded'`),
    /// modeled as `String` per the existing open-bag `dataFlag` convention.
    public struct TrainingCalendarDay: Equatable, Sendable {
        public struct SessionRow: Equatable, Sendable {
            public let sessionId: String
            public let title: String
            public let templateName: String?
            public let startTime: String?
            public let durationMin: Double?
            public let completedSets: Double
            public let effectiveSets: Double
            public let totalVolumeKg: Double
            public let isExperimentalTemplate: Bool?
            public let dataFlag: String?
        }
        public struct ExternalWorkoutRow: Equatable, Sendable {
            public let workoutId: String
            public let title: String
            public let workoutType: String
            public let startTime: String?
            public let durationMin: Double
            public let activeEnergyKcal: Double?
            public let avgHeartRate: Double?
            public let dataFlag: String?
            public let source: String
        }
        public let date: String
        public let sessions: [SessionRow]
        public let externalWorkouts: [ExternalWorkoutRow]
        public let totalSessions: Int
        public let totalExternalWorkouts: Int
        public let totalVolumeKg: Double
        public let hasPainFlags: Bool
    }

    /// `TrainingCalendarData` (trainingCalendarEngine.ts:36). SHAPE-ONLY contract type of the
    /// DEFERRED `buildTrainingCalendar`; not golden-pinned.
    public struct TrainingCalendarData: Equatable, Sendable {
        public struct WeeklyFrequency: Equatable, Sendable {
            public let weekStart: String
            public let sessionCount: Int
        }
        public let month: String
        public let days: [TrainingCalendarDay]
        public let weeklyFrequency: [WeeklyFrequency]
    }

    /// `TrainingCalendarOptions` (trainingCalendarEngine.ts:45). SHAPE-ONLY contract type of the
    /// DEFERRED `buildTrainingCalendar`; not golden-pinned. `includeDataFlags` /
    /// `includeExternalDataFlags` mirror the TS `Array<SessionDataFlag | 'unset'> | 'all'` union
    /// (modeled as `[String]?` + an `all` flag); `importedWorkouts` reuses the native
    /// `IronPathDomain.ImportedWorkoutSample`.
    public struct TrainingCalendarOptions: Equatable, Sendable {
        public let includeDataFlags: [String]?
        public let includeDataFlagsAll: Bool
        public let importedWorkouts: [ImportedWorkoutSample]?
        public let includeExternalWorkouts: Bool?
        public let includeExternalDataFlags: [String]?
        public let includeExternalDataFlagsAll: Bool

        public init(
            includeDataFlags: [String]? = nil,
            includeDataFlagsAll: Bool = false,
            importedWorkouts: [ImportedWorkoutSample]? = nil,
            includeExternalWorkouts: Bool? = nil,
            includeExternalDataFlags: [String]? = nil,
            includeExternalDataFlagsAll: Bool = false
        ) {
            self.includeDataFlags = includeDataFlags
            self.includeDataFlagsAll = includeDataFlagsAll
            self.importedWorkouts = importedWorkouts
            self.includeExternalWorkouts = includeExternalWorkouts
            self.includeExternalDataFlags = includeExternalDataFlags
            self.includeExternalDataFlagsAll = includeExternalDataFlagsAll
        }
    }

    // MARK: - JS-truthiness string helper

    /// `value || next` fall-through: a non-empty string is truthy; `undefined`/`null`/`''`
    /// are falsy. The same shape as `WorkoutCycleScheduler.truthy`.
    static func truthy(_ value: String?) -> String? {
        guard let value, !value.isEmpty else { return nil }
        return value
    }

    private static func pad2(_ n: Int) -> String { n < 10 ? "0\(n)" : "\(n)" }

    // MARK: - ASCII `\d` regex predicates (JS `\d` is ASCII-only)

    private static func isAsciiDigit(_ ch: Character) -> Bool { ch.isASCII && ch.isNumber }

    /// `/^\d{4}-\d{2}-\d{2}$/.test(value)` — EXACTLY 10 chars `YYYY-MM-DD`, ASCII digits.
    private static func isDateKey(_ s: String) -> Bool {
        let c = Array(s)
        guard c.count == 10 else { return false }
        func d(_ i: Int) -> Bool { isAsciiDigit(c[i]) }
        return d(0) && d(1) && d(2) && d(3) && c[4] == "-"
            && d(5) && d(6) && c[7] == "-" && d(8) && d(9)
    }

    /// `/^\d{4}-\d{2}$/.test(candidate)` — EXACTLY 7 chars `YYYY-MM`, ASCII digits.
    private static func isMonthKey(_ s: String) -> Bool {
        let c = Array(s)
        guard c.count == 7 else { return false }
        func d(_ i: Int) -> Bool { isAsciiDigit(c[i]) }
        return d(0) && d(1) && d(2) && d(3) && c[4] == "-" && d(5) && d(6)
    }

    // MARK: - toLocalDateKey (trainingCalendarEngine.ts:58)

    /// `toLocalDateKey` (ts:58-65):
    /// ```
    /// if (!value) return '';
    /// if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    /// const parsed = new Date(value);
    /// if (Number.isNaN(parsed.getTime())) return String(value).slice(0, 10);
    /// const local = new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60000);
    /// return local.toISOString().slice(0, 10);
    /// ```
    /// Branch 4 (`getTimezoneOffset`) is the only timezone-coupled path. The goldens are
    /// generated/checked under `TZ=America/New_York` (the app's fixed western civil zone —
    /// see `.github/workflows/ironpath-ci.yml`), so `getTimezoneOffset()` returns the NY
    /// offset (EST 300 / EDT 240). Per the AN-1 civil degradation this port subtracts the
    /// FIXED EST western offset (`nyStandardOffsetMin = 300`); every parity fixture timestamp
    /// is UTC-hour ≥ 06:00, so the resulting NY-local calendar date is invariant to the
    /// EST/EDT 1-hour DST difference (verified vs TS under `TZ=America/New_York`). Zero `: Date`.
    public static func toLocalDateKey(_ value: String?) -> String {
        // ts:59 — `if (!value) return ''`
        guard let value, !value.isEmpty else { return "" }
        // ts:60 — already a clean date key → returned verbatim (NO timezone shift).
        if isDateKey(value) { return value }
        // ts:61-62 — `new Date(value)` NaN → `String(value).slice(0, 10)`.
        guard let absMs = parseIsoMs(value) else { return String(value.prefix(10)) }
        // ts:63-64 — shift by the NY civil offset, then take the UTC date of the shifted ms
        // (`toISOString().slice(0,10)`), reusing the shared civil-calendar math.
        let localMs = absMs - Double(nyStandardOffsetMin) * 60000
        let (y, m, d) = AnalyticsSupport.civilFromDays(Int((localMs / 86_400_000).rounded(.down)))
        return "\(y)-\(pad2(m))-\(pad2(d))"
    }

    /// America/New_York STANDARD-time offset in minutes west of UTC (EST = UTC−5). The
    /// fixed western civil degradation of `Date.prototype.getTimezoneOffset()` — see
    /// `toLocalDateKey`.
    private static let nyStandardOffsetMin = 300

    /// Parses a `YYYY-MM-DDTHH:MM:SS(.fraction)?Z` instant to ms since epoch (UTC), or nil
    /// (→ the JS `NaN` branch). Only the explicit-`Z` full-ISO shape the calendar engine
    /// receives from session `finishedAt`/`startedAt` is accepted; any other shape (bare
    /// garbage, offset suffix, missing time) returns nil → the `slice(0, 10)` fallback.
    private static func parseIsoMs(_ value: String) -> Double? {
        let c = Array(value)
        guard c.count >= 20 else { return nil } // min "YYYY-MM-DDTHH:MM:SSZ"
        func dig(_ i: Int) -> Int? { isAsciiDigit(c[i]) ? c[i].wholeNumberValue : nil }
        guard let y1 = dig(0), let y2 = dig(1), let y3 = dig(2), let y4 = dig(3), c[4] == "-",
              let mo1 = dig(5), let mo2 = dig(6), c[7] == "-", let d1 = dig(8), let d2 = dig(9),
              c[10] == "T",
              let h1 = dig(11), let h2 = dig(12), c[13] == ":", let mi1 = dig(14), let mi2 = dig(15),
              c[16] == ":", let s1 = dig(17), let s2 = dig(18) else { return nil }
        let y = y1 * 1000 + y2 * 100 + y3 * 10 + y4
        let mo = mo1 * 10 + mo2, d = d1 * 10 + d2
        let h = h1 * 10 + h2, mi = mi1 * 10 + mi2, s = s1 * 10 + s2
        guard mo >= 1, mo <= 12, d >= 1, d <= 31, h <= 23, mi <= 59, s <= 59 else { return nil }
        var idx = 19
        var ms = 0
        if idx < c.count, c[idx] == "." {
            idx += 1
            var frac = 0, taken = 0
            while idx < c.count, let dd = dig(idx) {
                if taken < 3 { frac = frac * 10 + dd; taken += 1 }
                idx += 1
            }
            while taken < 3 { frac *= 10; taken += 1 } // ".5" → 500ms
            ms = frac
        }
        guard idx == c.count - 1, c[idx] == "Z" else { return nil } // trailing UTC designator
        let days = AnalyticsSupport.daysFromCivil(y, mo, d)
        return Double(days) * 86_400_000 + Double(h * 3600 + mi * 60 + s) * 1000 + Double(ms)
    }

    // MARK: - getSessionCalendarDate (trainingCalendarEngine.ts:67)

    /// `getSessionCalendarDate` (ts:67):
    /// `toLocalDateKey(session.finishedAt || session.startedAt || session.date)`.
    public static func getSessionCalendarDate(_ session: TrainingSession) -> String {
        toLocalDateKey(truthy(session.finishedAt) ?? truthy(session.startedAt) ?? truthy(session.date))
    }

    // MARK: - normalizeCalendarMonth (trainingCalendarEngine.ts:69)

    /// `normalizeCalendarMonth` (ts:69-72):
    /// `const candidate = String(month || '').slice(0, 7); return /^\d{4}-\d{2}$/.test(candidate) ? candidate : fallback`.
    /// `fallback` is the INJECTED `monthKey()` seam (TS default `= monthKey()`); the parity
    /// fixtures pass it explicitly so the wall clock never decides the output.
    public static func normalizeCalendarMonth(_ month: String?, _ fallback: String) -> String {
        let candidate = String((truthy(month) ?? "").prefix(7)) // String(month || '').slice(0, 7)
        return isMonthKey(candidate) ? candidate : fallback
    }

    // MARK: - addCalendarMonths (trainingCalendarEngine.ts:74)

    /// `addCalendarMonths` (ts:74-81):
    /// ```
    /// const normalized = normalizeCalendarMonth(month);
    /// const [yearText, monthText] = normalized.split('-');
    /// const cursor = new Date(Number(yearText), Number(monthText) - 1 + delta, 1);
    /// return `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
    /// ```
    /// The `new Date(year, monthIndex, 1)` constructor normalises an out-of-range month index
    /// into the year with FLOOR semantics; reproduced with pure integer month arithmetic (the
    /// `1`st-of-month + `getFullYear`/`getMonth` read is timezone-stable). `nowMonth` is the
    /// internal `normalizeCalendarMonth(month)` → `monthKey()` seam (unused when `month` is a
    /// valid `YYYY-MM`, which every fixture guarantees).
    public static func addCalendarMonths(_ month: String, delta: Int, nowMonth: String) -> String {
        let normalized = normalizeCalendarMonth(month, nowMonth)
        let parts = normalized.split(separator: "-", maxSplits: 1, omittingEmptySubsequences: false)
        let year = Int(parts[0]) ?? 0       // Number(yearText) over a `\d{4}` slice
        let monthNum = Int(parts[1]) ?? 0   // Number(monthText) over a `\d{2}` slice
        let total = year * 12 + (monthNum - 1 + delta) // months since year 0, month index 0
        let outYear = Int((Double(total) / 12).rounded(.down))            // getFullYear
        let outMonthIndex = total - outYear * 12                          // getMonth() (0…11)
        return "\(outYear)-\(pad2(outMonthIndex + 1))"
    }

    // MARK: - buildTrainingCalendarMonthRange (trainingCalendarEngine.ts:83)

    /// `buildTrainingCalendarMonthRange` (ts:83-98). `currentMonth` is the injected
    /// `monthKey()` seam (TS default), passed explicitly by every fixture. The TS default
    /// `.sort()` is lexicographic over the `YYYY-MM` ASCII keys (code-point order).
    public static func buildTrainingCalendarMonthRange(
        _ history: [TrainingSession],
        currentMonth: String
    ) -> TrainingCalendarMonthRange {
        let months = history
            .map { String(getSessionCalendarDate($0).prefix(7)) } // .slice(0, 7)
            .filter { isMonthKey($0) }                            // /^\d{4}-\d{2}$/.test
            .sorted()                                             // .sort() lexicographic
        if months.isEmpty {
            // ts:91-93
            return TrainingCalendarMonthRange(earliestMonth: currentMonth, latestMonth: currentMonth, hasHistory: false)
        }
        let earliestMonth = months[0]
        let latestHistoryMonth = months[months.count - 1]
        // latestHistoryMonth > currentMonth ? latestHistoryMonth : currentMonth (lexicographic)
        let latestMonth = latestHistoryMonth > currentMonth ? latestHistoryMonth : currentMonth
        return TrainingCalendarMonthRange(earliestMonth: earliestMonth, latestMonth: latestMonth, hasHistory: true)
    }

    // MARK: - clampCalendarMonth (trainingCalendarEngine.ts:100)

    /// `clampCalendarMonth` (ts:100-105). `nowMonth` is the internal
    /// `normalizeCalendarMonth(month)` → `monthKey()` seam (unused for valid months).
    public static func clampCalendarMonth(
        _ month: String,
        _ range: TrainingCalendarMonthRange,
        nowMonth: String
    ) -> String {
        let normalized = normalizeCalendarMonth(month, nowMonth)
        if normalized < range.earliestMonth { return range.earliestMonth }
        if normalized > range.latestMonth { return range.latestMonth }
        return normalized
    }

    // MARK: - getLatestTrainingDateKey (trainingCalendarEngine.ts:107)

    /// `getLatestTrainingDateKey` (ts:107-114):
    /// ```
    /// history.map(getSessionCalendarDate)
    ///   .filter(date => /^\d{4}-\d{2}-\d{2}$/.test(date))
    ///   .filter(date => !month || date.startsWith(month))
    ///   .sort((l, r) => r.localeCompare(l));   // DESC
    /// return dates[0] || '';
    /// ```
    /// `!month` is true for nil/empty `month`; the `localeCompare` over ASCII ISO keys is a
    /// code-point compare (the `WorkoutCycleScheduler`/`PlateauDetectionEngine` precedent).
    public static func getLatestTrainingDateKey(_ history: [TrainingSession], month: String?) -> String {
        let monthFilter = truthy(month)
        let dates = history
            .map { getSessionCalendarDate($0) }
            .filter { isDateKey($0) }
            .filter { monthFilter == nil || $0.hasPrefix(monthFilter!) }
            .sorted(by: >) // r.localeCompare(l) → descending code-point order
        return dates.first ?? ""
    }

    // MARK: - getInitialCalendarMonth (trainingCalendarEngine.ts:116)

    /// `getInitialCalendarMonth` (ts:116-120):
    /// ```
    /// if (selectedDate) return normalizeCalendarMonth(selectedDate.slice(0, 7), currentMonth);
    /// const latestTrainingDate = getLatestTrainingDateKey(history);
    /// return latestTrainingDate ? latestTrainingDate.slice(0, 7) : currentMonth;
    /// ```
    /// `currentMonth` is the injected `monthKey()` seam (TS default), passed explicitly.
    public static func getInitialCalendarMonth(
        _ history: [TrainingSession],
        selectedDate: String?,
        currentMonth: String
    ) -> String {
        if let selectedDate = truthy(selectedDate) {
            return normalizeCalendarMonth(String(selectedDate.prefix(7)), currentMonth)
        }
        let latestTrainingDate = getLatestTrainingDateKey(history, month: nil)
        return truthy(latestTrainingDate) != nil ? String(latestTrainingDate.prefix(7)) : currentMonth
    }

    // MARK: - getDefaultCalendarDateForMonth (trainingCalendarEngine.ts:122)

    /// `getDefaultCalendarDateForMonth` (ts:122-128):
    /// ```
    /// const normalizedMonth = normalizeCalendarMonth(month);
    /// const latestTrainingDate = getLatestTrainingDateKey(history, normalizedMonth);
    /// if (latestTrainingDate) return latestTrainingDate;
    /// if (fallbackDate?.startsWith(normalizedMonth)) return fallbackDate;
    /// return `${normalizedMonth}-01`;
    /// ```
    /// `nowMonth` is the internal `normalizeCalendarMonth(month)` → `monthKey()` seam.
    public static func getDefaultCalendarDateForMonth(
        _ history: [TrainingSession],
        month: String,
        fallbackDate: String?,
        nowMonth: String
    ) -> String {
        let normalizedMonth = normalizeCalendarMonth(month, nowMonth)
        let latestTrainingDate = getLatestTrainingDateKey(history, month: normalizedMonth)
        if truthy(latestTrainingDate) != nil { return latestTrainingDate }
        // `fallbackDate?.startsWith(normalizedMonth)` — optional-chained: nil fallbackDate → false.
        if let fallbackDate, fallbackDate.hasPrefix(normalizedMonth) { return fallbackDate }
        return "\(normalizedMonth)-01"
    }

    // MARK: - resolveCalendarSelectedDate (trainingCalendarEngine.ts:130)

    /// `resolveCalendarSelectedDate` (ts:130-139):
    /// ```
    /// const normalizedMonth = normalizeCalendarMonth(month);
    /// if (currentSelectedDate?.startsWith(normalizedMonth)) return currentSelectedDate;
    /// return getDefaultCalendarDateForMonth(history, normalizedMonth, fallbackDate);
    /// ```
    /// `nowMonth` is the internal `monthKey()` seam (threaded through both normalize calls).
    public static func resolveCalendarSelectedDate(
        _ history: [TrainingSession],
        month: String,
        currentSelectedDate: String?,
        fallbackDate: String?,
        nowMonth: String
    ) -> String {
        let normalizedMonth = normalizeCalendarMonth(month, nowMonth)
        if let currentSelectedDate, currentSelectedDate.hasPrefix(normalizedMonth) {
            return currentSelectedDate
        }
        return getDefaultCalendarDateForMonth(history, month: normalizedMonth, fallbackDate: fallbackDate, nowMonth: nowMonth)
    }
}
