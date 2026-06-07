// iOS-4B2 TrainingDecision Core Rule Skeleton V1 — mesocycle week resolver.
//
// Swift port of the persisted-phase resolution the effectivePhase engine needs:
// getCurrentMesocycleWeek / getMesocycleWeekIndex / clampWeekIndex
// (retired-web-reference) plus the DEFAULT_MESOCYCLE_PLAN weeks
// (retired-web-reference). Engine-LOCAL: the Swift Domain MesocyclePlan is a
// thin decode type (id/startDate/phase/weeks:JSONValue?), so the weeks array is
// hand-parsed here rather than promoting a typed model into IronPathDomain.
//
// DETERMINISM: NO system clock is read anywhere. The legacy web schema DEFAULT_MESOCYCLE_PLAN
// pins startDate to the generation-time `new Date()`, and its week index clamps
// to 0 ('base') for the deterministic parity clock. We reproduce that observed
// 'base' deterministically by pinning the no-plan default's startDate to the
// caller's referenceDate (=> weekIndex 0 => 'base'), instead of fabricating a
// wall-clock startDate. A real plan with a real startDate uses the exact
// UTC-midnight + Math.floor week math below.
//
// NO readiness / prescription / deload / userFacing.

import Foundation
import IronPathDomain

/// Two distinct date conventions, ported verbatim from the legacy web schema engine:
///   * gap days   → `parseDateMillis` noon-anchors a date-only PREFIX to
///                  `T12:00:00.000Z`, then `Math.round` the day diff.
///   * week index → `getMesocycleWeekIndex` uses `new Date()` (UTC midnight),
///                  then `Math.floor`.
/// Both use a fixed UTC calendar. A mismatch of even one day flips a gap branch
/// (reentry vs restart at 28d) or a week index (base vs build at 7d), so the two
/// conventions are kept separate on purpose.
enum TDDateMath {
    static let msPerDay: Double = 86_400_000

    private static let utcCalendar: Calendar = {
        var c = Calendar(identifier: .gregorian)
        c.timeZone = TimeZone(identifier: "UTC")!
        return c
    }()

    private static let isoWithFraction: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        f.timeZone = TimeZone(identifier: "UTC")
        return f
    }()

    private static let isoNoFraction: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        f.timeZone = TimeZone(identifier: "UTC")
        return f
    }()

    /// `(year, month, day)` when `s` begins with `YYYY-MM-DD`, else nil.
    static func dateOnlyComponents(_ s: String) -> (Int, Int, Int)? {
        guard s.count >= 10 else { return nil }
        let prefix = String(s.prefix(10))
        let parts = prefix.split(separator: "-", omittingEmptySubsequences: false)
        guard parts.count == 3,
              parts[0].count == 4, parts[1].count == 2, parts[2].count == 2,
              let y = Int(parts[0]), let m = Int(parts[1]), let d = Int(parts[2])
        else { return nil }
        return (y, m, d)
    }

    private static func millis(year: Int, month: Int, day: Int, hour: Int) -> Double? {
        var c = DateComponents()
        c.year = year
        c.month = month
        c.day = day
        c.hour = hour
        c.minute = 0
        c.second = 0
        c.nanosecond = 0
        guard let date = utcCalendar.date(from: c) else { return nil }
        return date.timeIntervalSince1970 * 1000.0
    }

    private static func isoMillis(_ s: String) -> Double? {
        if let d = isoWithFraction.date(from: s) { return d.timeIntervalSince1970 * 1000.0 }
        if let d = isoNoFraction.date(from: s) { return d.timeIntervalSince1970 * 1000.0 }
        return nil
    }

    /// Mirrors `parseDateMillis`: a string starting with `YYYY-MM-DD` is anchored
    /// to noon UTC of that date (the time portion, if any, is discarded — exactly
    /// like `\`${prefix}T12:00:00.000Z\``); a non-date-prefixed string is parsed
    /// as an ISO instant.
    static func noonAnchoredMillis(_ s: String) -> Double? {
        if let (y, m, d) = dateOnlyComponents(s) { return millis(year: y, month: m, day: d, hour: 12) }
        return isoMillis(s)
    }

    /// Mirrors `new Date(dateString)`: a bare `YYYY-MM-DD` (no time) is UTC
    /// midnight; anything with a time component is parsed as an ISO instant.
    static func midnightMillis(_ s: String) -> Double? {
        if !s.contains("T"), let (y, m, d) = dateOnlyComponents(s) {
            return millis(year: y, month: m, day: d, hour: 0)
        }
        return isoMillis(s)
    }
}

/// The resolved persisted week — only the fields the effectivePhase engine reads.
struct ResolvedMesocycleWeek: Equatable, Sendable {
    let phase: ActivePhase
    let volumeMultiplier: Double
    let intensityBias: String
}

enum MesocycleWeekResolver {
    /// DEFAULT_MESOCYCLE_PLAN weeks (retired-web-reference).
    static func defaultWeeks() -> [ResolvedMesocycleWeek] {
        [
            ResolvedMesocycleWeek(phase: .base, volumeMultiplier: 0.9, intensityBias: "normal"),
            ResolvedMesocycleWeek(phase: .build, volumeMultiplier: 1.0, intensityBias: "normal"),
            ResolvedMesocycleWeek(phase: .overload, volumeMultiplier: 1.1, intensityBias: "aggressive"),
            ResolvedMesocycleWeek(phase: .deload, volumeMultiplier: 0.6, intensityBias: "conservative"),
        ]
    }

    /// clampWeekIndex (mesocycleEngine.ts:12).
    static func clampWeekIndex(_ weekIndex: Int, lengthWeeks: Int) -> Int {
        max(0, min(lengthWeeks - 1, weekIndex))
    }

    /// getMesocycleWeekIndex (mesocycleEngine.ts:66): UTC-midnight diff, floor by
    /// day then floor by week, clamped to >= 0. Unparseable dates fall back to the
    /// plan's currentWeekIndex (clamped).
    static func weekIndex(
        startDate: String?,
        referenceDate: String,
        lengthWeeks: Int,
        currentWeekIndex: Int
    ) -> Int {
        guard let startDate,
              let start = TDDateMath.midnightMillis(startDate),
              let current = TDDateMath.midnightMillis(referenceDate)
        else { return clampWeekIndex(currentWeekIndex, lengthWeeks: lengthWeeks) }
        let diffDays = ((current - start) / TDDateMath.msPerDay).rounded(.down)
        let weeks = (diffDays / 7).rounded(.down)
        return max(0, Int(weeks))
    }

    /// Hand-parse `MesocyclePlan.weeks` (an opaque JSONValue) into the typed weeks
    /// the resolver needs. Returns [] when absent/empty so the caller falls back
    /// to the default plan.
    static func parseWeeks(_ value: JSONValue?) -> [ResolvedMesocycleWeek] {
        guard let arr = value?.arrayValue else { return [] }
        return arr.compactMap { element in
            guard let obj = element.objectValue else { return nil }
            let phase = obj["phase"]?.stringValue.flatMap(ActivePhase.init(rawValue:)) ?? .base
            let vol = obj["volumeMultiplier"]?.doubleValue ?? 1.0
            let bias = obj["intensityBias"]?.stringValue ?? "normal"
            return ResolvedMesocycleWeek(phase: phase, volumeMultiplier: vol, intensityBias: bias)
        }
    }

    /// getCurrentMesocycleWeek (mesocycleEngine.ts:74). When the plan carries no
    /// usable weeks the DEFAULT plan is used with startDate pinned to
    /// referenceDate, deterministically yielding week 0 ('base').
    static func currentWeek(plan: MesocyclePlan?, referenceDate: String) -> ResolvedMesocycleWeek {
        let planWeeks = parseWeeks(plan?.weeks)
        if !planWeeks.isEmpty {
            let lengthWeeks = planWeeks.count
            let index = clampWeekIndex(
                weekIndex(
                    startDate: plan?.startDate,
                    referenceDate: referenceDate,
                    lengthWeeks: lengthWeeks,
                    currentWeekIndex: 0
                ),
                lengthWeeks: lengthWeeks
            )
            return planWeeks[index]
        }
        let weeks = defaultWeeks()
        let index = clampWeekIndex(
            weekIndex(
                startDate: referenceDate,
                referenceDate: referenceDate,
                lengthWeeks: weeks.count,
                currentWeekIndex: 0
            ),
            lengthWeeks: weeks.count
        )
        return weeks[index]
    }
}
