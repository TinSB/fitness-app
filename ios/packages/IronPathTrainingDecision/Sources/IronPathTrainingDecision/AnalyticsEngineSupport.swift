// AnalyticsEngineSupport — AN-1 leaf-analytics shared helpers.
//
// The three AN-1 analytics engines (TrainingStreakEngine / RecentPRDeltaEngine /
// WeeklyMuscleBalanceEngine) each duplicate the SAME byte-identical local helpers
// in their TS sources (`src/engines/trainingStreakEngine.ts`,
// `recentPRDeltaEngine.ts`, `weeklyMuscleBalanceEngine.ts`):
//   - `safeDate`            (NOON-UTC normalization of any date-prefixed string)
//   - `isAnalyticsSession`  (completed !== false && dataFlag not test/excluded)
//   - `startOfWeekUtc` / `weekKey` / `monthKey`  (UTC calendar bucketing)
// plus the muscle-balance-only `getPrimaryMuscles` / `setVolume`. They are
// centralised here ONCE (one faithful copy referenced by all three) rather than
// re-transcribed per engine — the TS copies are byte-identical, so a single Swift
// copy is faithful AND avoids divergence.
//
// `safeDate` and `isAnalyticsSession` here are DELIBERATELY DISTINCT from the
// already-ported `E1RMEngine.safeDateMs` / `E1RMEngine.isAnalyticsSession`
// (sessionHistoryEngine flavor): the analytics `safeDate` normalises EVERY
// date-prefixed value to **noon** UTC (E1RMEngine's parses bare dates as midnight
// and does not prefix-normalise full ISO), and the analytics `isAnalyticsSession`
// ALSO requires `completed !== false` (E1RMEngine's checks only dataFlag). So these
// are genuinely different functions, faithfully ported fresh — not a re-port of an
// existing helper. The truly-shared set helpers (`number` / `setWeightKg` /
// `isCompletedSet` / `completedSets`) ARE reused verbatim from `E1RMEngine`.
//
// PURE: zero `: Date` (no wall clock — "today" is the injected `nowIso`; all date
// math is integer civil-calendar arithmetic, never `Date()`), no IO, no randomness.

import Foundation
import IronPathDomain

enum AnalyticsSupport {

    static let msPerDay: Double = 24 * 60 * 60 * 1000 // MS_PER_DAY

    // MARK: - Civil-calendar math (Howard Hinnant's days⇄civil algorithms)
    //
    // Reproduces JS `Date.UTC` / `getUTCFullYear` / `getUTCMonth` / `getUTCDate` /
    // `getUTCDay` semantics over a given timestamp with PURE integer arithmetic
    // (proleptic Gregorian, days counted from 1970-01-01) — no `Date()`, no
    // `Calendar`, no timezone object, so it is byte-deterministic and clock-free.

    /// Days since 1970-01-01 for civil (y, m∈[1,12], d∈[1,31]). Mirrors the day
    /// number underlying `Date.UTC(y, m-1, d)`.
    static func daysFromCivil(_ y0: Int, _ m: Int, _ d: Int) -> Int {
        let y = m <= 2 ? y0 - 1 : y0
        let era = (y >= 0 ? y : y - 399) / 400
        let yoe = y - era * 400                                   // [0, 399]
        let doy = (153 * (m + (m > 2 ? -3 : 9)) + 2) / 5 + d - 1  // [0, 365]
        let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy           // [0, 146096]
        return era * 146097 + doe - 719468
    }

    /// Civil (y, m∈[1,12], d∈[1,31]) for a day number since 1970-01-01.
    static func civilFromDays(_ z0: Int) -> (year: Int, month: Int, day: Int) {
        let z = z0 + 719468
        let era = (z >= 0 ? z : z - 146096) / 146097
        let doe = z - era * 146097                                       // [0, 146096]
        let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365  // [0, 399]
        let y = yoe + era * 400
        let doy = doe - (365 * yoe + yoe / 4 - yoe / 100)               // [0, 365]
        let mp = (5 * doy + 2) / 153                                    // [0, 11]
        let d = doy - (153 * mp + 2) / 5 + 1                            // [1, 31]
        let m = mp < 10 ? mp + 3 : mp - 9                               // [1, 12]
        return (m <= 2 ? y + 1 : y, m, d)
    }

    /// JS `new Date(ms).getUTCDay()` (0=Sunday … 6=Saturday). 1970-01-01 was a
    /// Thursday (=4); the `+ 7` keeps it correct for the (unused) negative range.
    static func weekdayFromDays(_ z: Int) -> Int { ((z % 7) + 4 + 7) % 7 }

    /// `Math.floor(ms / MS_PER_DAY)` — the day number containing `ms`.
    private static func dayNumber(_ ms: Double) -> Int {
        Int((ms / msPerDay).rounded(.down))
    }

    private static func pad2(_ n: Int) -> String {
        n < 10 ? "0\(n)" : "\(n)"
    }

    // MARK: - safeDate (trainingStreakEngine.ts:15 / recentPRDeltaEngine.ts:27 /
    // weeklyMuscleBalanceEngine.ts:30 — byte-identical in all three)

    /// Returns the leading `YYYY-MM-DD` if `value` matches `/^\d{4}-\d{2}-\d{2}/`,
    /// else nil. No `$` anchor — a full ISO timestamp matches by its date prefix.
    private static func leadingDatePrefix(_ value: String) -> (Int, Int, Int)? {
        let chars = Array(value)
        guard chars.count >= 10 else { return nil }
        func isDigit(_ i: Int) -> Bool { chars[i].isNumber && chars[i].isASCII }
        guard isDigit(0), isDigit(1), isDigit(2), isDigit(3),
              chars[4] == "-", isDigit(5), isDigit(6),
              chars[7] == "-", isDigit(8), isDigit(9) else { return nil }
        let y = (chars[0].wholeNumberValue! * 1000) + (chars[1].wholeNumberValue! * 100)
            + (chars[2].wholeNumberValue! * 10) + chars[3].wholeNumberValue!
        let mo = (chars[5].wholeNumberValue! * 10) + chars[6].wholeNumberValue!
        let d = (chars[8].wholeNumberValue! * 10) + chars[9].wholeNumberValue!
        return (y, mo, d)
    }

    /// `safeDate` → ms since epoch, or nil. A date-prefixed value (bare date OR
    /// full ISO) is normalised to **noon UTC** of that civil date — the
    /// `${prefix}T12:00:00.000Z` + `Date.parse` path; any other shape would hit
    /// the `Date.parse(value)` fallback, which for the §11 clean analytics inputs
    /// (always date-prefixed) is unreachable and returns nil (mirrors the JS
    /// `NaN → null` for a non-date-parseable string).
    static func safeDate(_ value: String?) -> Double? {
        guard let value, !value.isEmpty else { return nil } // `if (!value) return null`
        guard let (y, mo, d) = leadingDatePrefix(value) else { return nil }
        guard mo >= 1, mo <= 12, d >= 1, d <= 31 else { return nil } // JS Date.parse → NaN → null
        return Double(daysFromCivil(y, mo, d)) * msPerDay + 12 * 60 * 60 * 1000 // noon UTC
    }

    // MARK: - isAnalyticsSession (trainingStreakEngine.ts:23 / recentPRDeltaEngine.ts:35 /
    // weeklyMuscleBalanceEngine.ts:38 — byte-identical in all three)

    /// `session.completed !== false && session.dataFlag !== 'test' && dataFlag !== 'excluded'`.
    /// `completed` is a typed `Bool?` (nil/true → not false → analytics); `dataFlag`
    /// rides in the open bag.
    static func isAnalyticsSession(_ session: TrainingSession) -> Bool {
        let notCompletedFalse = session.completed != false // nil or true ⇒ true
        let dataFlag = session._unknown["dataFlag"]?.stringValue
        return notCompletedFalse && dataFlag != "test" && dataFlag != "excluded"
    }

    /// `finishedAt ?? startedAt ?? date` resolved through `safeDate` (the analytics
    /// timestamp precedence shared by all three engines).
    static func sessionTimestamp(_ session: TrainingSession) -> Double? {
        safeDate(session.finishedAt) ?? safeDate(session.startedAt) ?? safeDate(session.date)
    }

    // MARK: - UTC week / month bucketing (trainingStreakEngine.ts:26-42 /
    // weeklyMuscleBalanceEngine.ts:41-52)

    /// `startOfWeekUtc` (ts:26). UTC midnight of the week-start day on/before `ts`,
    /// where `weekStartDow` is 0=Sunday … 6=Saturday.
    static func startOfWeekUtc(_ ts: Double, _ weekStartDow: Int) -> Double {
        let days = dayNumber(ts)
        let day = weekdayFromDays(days)                  // getUTCDay()
        let diff = ((day - weekStartDow) % 7 + 7) % 7    // (day - weekStartDow + 7) % 7
        return Double(days) * msPerDay - Double(diff) * msPerDay
    }

    /// `weekKey` (ts:33) — `YYYY-MM-DD` of the week-start date.
    static func weekKey(_ ts: Double, _ weekStartDow: Int) -> String {
        let ms = startOfWeekUtc(ts, weekStartDow)
        let (y, m, d) = civilFromDays(dayNumber(ms))
        return "\(y)-\(pad2(m))-\(pad2(d))"
    }

    /// `monthKey` (ts:39) — `YYYY-MM` of `ts`.
    static func monthKey(_ ts: Double) -> String {
        let (y, m, _) = civilFromDays(dayNumber(ts))
        return "\(y)-\(pad2(m))"
    }

    // MARK: - muscle-balance helpers (weeklyMuscleBalanceEngine reads these via engineUtils)

    /// `getPrimaryMuscles` (engineUtils.ts:207): `primaryMuscles?.length ? primaryMuscles
    /// : [muscle].filter(Boolean)`. Both fields ride in the open bag.
    static func getPrimaryMuscles(_ exercise: ExercisePrescription) -> [String] {
        if let arr = exercise._unknown["primaryMuscles"]?.arrayValue, !arr.isEmpty {
            return arr.compactMap { $0.stringValue }
        }
        let muscle = exercise._unknown["muscle"]?.stringValue
        return [muscle].compactMap { $0 }.filter { !$0.isEmpty } // [muscle].filter(Boolean)
    }

    /// `setVolume` (engineUtils.ts:107): `setWeightKg(set) * number(set.reps)`. Reuses
    /// the already-ported `E1RMEngine.setWeightKg` / `E1RMEngine.number`.
    static func setVolume(_ set: TrainingSetLog) -> Double {
        E1RMEngine.setWeightKg(set) * E1RMEngine.number(set.reps)
    }

    // MARK: - JS number formatting helpers

    /// `Number(value.toFixed(digits))` for the values these engines round
    /// (`deltaKg`/`deltaPercent`/`effectiveSets`/`share`). Non-tie decimals (the
    /// only shape the fixtures produce) round identically to JS `toFixed`; the
    /// compute-assert pins this exactly (`==`).
    static func roundToFixed(_ value: Double, _ digits: Int) -> Double {
        let p = pow(10.0, Double(digits))
        return (value * p).rounded() / p
    }

    /// JS `Math.round(value)` = `floor(value + 0.5)` (half rounds toward +∞),
    /// reproduced so `.5` boundaries match TS rather than Swift's round-half-away.
    static func jsMathRound(_ value: Double) -> Int {
        Int((value + 0.5).rounded(.down))
    }
}
