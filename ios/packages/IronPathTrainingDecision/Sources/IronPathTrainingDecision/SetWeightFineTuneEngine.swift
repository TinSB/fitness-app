// SetWeightFineTuneEngine — iOS-17e-4 set-weight fine-tune port.
//
// Faithful line-by-line Swift port of the PURE set-weight fine-tune function from
// `src/engines/setWeightFineTuneEngine.ts`:
//   - buildSetWeightFineTune  (setWeightFineTuneEngine.ts:94)
// + every private helper it reads (epley / roundToPlate / parseRir / matchesExercise /
//   isWorkSet / linearSlope / dateToWeekIndex, setWeightFineTuneEngine.ts:14-92) and
//   the `SetWeightFineTuneInput` / `SetWeightFineTuneResult` types
//   (setWeightFineTuneEngine.ts:27/38).
//
// Reuse note (do NOT re-port):
//   - `getExerciseRecordPoolId` / `epley` / `number` / `parseRir` are the already-ported
//     `E1RMEngine.*` (17e-1, E1RMEngine.swift). The fine-tune engine's own `parseRir`
//     (setWeightFineTuneEngine.ts:21) is byte-identical to e1rmEngine's, so it is shared
//     verbatim rather than duplicated.
//
// `zero : Date` — the ONE intentional gap. The TS reads the wall clock when no
// `asOfDate` is supplied (`input.asOfDate ? new Date(input.asOfDate) : new Date()`,
// setWeightFineTuneEngine.ts:119), so it is NOT pure on that branch. The §11 clean
// input always carries an as-of date (the same `nowIso` the decision pipeline threads
// through), so the pure port REQUIRES `asOfDate`: a `nil` asOfDate returns the same
// `insufficient_history` fallback an unparseable date returns, and the wall-clock
// branch is intentionally not reproduced. Every parity fixture passes an explicit
// `asOfDate` (= the deterministic clock), so the goldens are byte-deterministic. This
// mirrors the MesocycleWeekResolver / EffectiveTrainingPhase precedent of taking an
// explicit reference date instead of fabricating a `Date()`.
//
// PURE: consumes `history: [TrainingSession]` (already a §11 clean input) + scalar
// params; no IO, no clock, no randomness. It is NOT wired into the decision output
// here (that is 17e-5); this slice only adds the function and parity-pins it.

import Foundation
import IronPathDomain

public enum SetWeightFineTuneEngine {

    // MARK: - Constants (setWeightFineTuneEngine.ts:14-17)

    private static let plateKg: Double = 2.5            // PLATE_KG
    private static let minSamples = 3                   // MIN_SAMPLES
    private static let defaultWindowWeeks: Double = 8   // DEFAULT_WINDOW_WEEKS
    private static let maxWeeklyGrowth: Double = 0.04    // MAX_WEEKLY_GROWTH

    // MARK: - Types

    /// `SetWeightFineTuneInput` (setWeightFineTuneEngine.ts:27). Numeric fields are
    /// `Double` so `clamp` / `Math.max` behave like the JS numbers. `asOfDate` —
    /// see the file header — is required in practice for the pure path.
    public struct SetWeightFineTuneInput: Sendable {
        public var history: [TrainingSession]
        public var exerciseId: String
        public var baseExerciseId: String?
        public var targetReps: Double
        public var repMin: Double
        public var repMax: Double
        public var windowWeeks: Double?
        public var asOfDate: String?

        public init(
            history: [TrainingSession],
            exerciseId: String,
            baseExerciseId: String? = nil,
            targetReps: Double,
            repMin: Double,
            repMax: Double,
            windowWeeks: Double? = nil,
            asOfDate: String? = nil
        ) {
            self.history = history
            self.exerciseId = exerciseId
            self.baseExerciseId = baseExerciseId
            self.targetReps = targetReps
            self.repMin = repMin
            self.repMax = repMax
            self.windowWeeks = windowWeeks
            self.asOfDate = asOfDate
        }
    }

    /// `fallbackReason` union (setWeightFineTuneEngine.ts:46). Kept as a raw String —
    /// the three literals are 'insufficient_history' | 'rep_range_invalid' | 'noisy_trend'.
    public typealias FallbackReason = String
    public static let insufficientHistory: FallbackReason = "insufficient_history"
    public static let repRangeInvalid: FallbackReason = "rep_range_invalid"
    public static let noisyTrend: FallbackReason = "noisy_trend"

    /// `SetWeightFineTuneResult.basis` (setWeightFineTuneEngine.ts:39). `currentE1rmKg`
    /// / `projectedE1rmKg` are `number | null` → `Double?`; `fallbackReason` is the
    /// optional union → `String?`.
    public struct Basis: Equatable, Sendable {
        public let samplesUsed: Int
        public let windowWeeks: Double
        public let currentE1rmKg: Double?
        public let projectedE1rmKg: Double?
        public let weeklySlopeKg: Double
        public let fallbackReason: FallbackReason?
    }

    /// `SetWeightFineTuneResult` (setWeightFineTuneEngine.ts:38).
    public struct SetWeightFineTuneResult: Equatable, Sendable {
        public let suggestedWeightKg: Double
        public let basis: Basis
    }

    /// `Sample` (setWeightFineTuneEngine.ts:50).
    private struct Sample {
        let date: String
        let weekIndex: Double
        let e1rmKg: Double
        let weight: Double
        let reps: Double
    }

    // MARK: - Numeric helpers

    /// `Math.round` — `floor(x + 0.5)` (half toward +∞), matching V8 rather than
    /// Swift's round-half-away-from-zero. Used by `roundToPlate` / `dateToWeekIndex`.
    private static func jsRound(_ value: Double) -> Double { (value + 0.5).rounded(.down) }

    /// `clamp` (engineUtils.ts:42): `Math.max(min, Math.min(max, value))`.
    private static func clamp(_ value: Double, _ lo: Double, _ hi: Double) -> Double {
        Swift.max(lo, Swift.min(hi, value))
    }

    /// JS truthiness for an optional string (`[a, b].filter(Boolean)` drops empty /
    /// undefined).
    private static func truthy(_ value: String?) -> String? {
        guard let value, !value.isEmpty else { return nil }
        return value
    }

    /// `roundToPlate` (setWeightFineTuneEngine.ts:20): `Math.round(value / 2.5) * 2.5`.
    private static func roundToPlate(_ value: Double) -> Double {
        jsRound(value / plateKg) * plateKg
    }

    /// `epley` (setWeightFineTuneEngine.ts:19) — shared with the already-ported
    /// `E1RMEngine.epley` (e1rmEngine.ts:25); identical formula.
    private static func epley(_ weightKg: Double, _ reps: Double) -> Double {
        E1RMEngine.epley(weightKg, reps)
    }

    /// `new Date(value).getTime()` → ms since epoch, for the two date shapes the §11
    /// input carries: a bare `YYYY-MM-DD` (UTC midnight) and a full ISO `…Z` timestamp.
    /// Returns nil for an unparseable string (JS `NaN`). Mirrors E1RMEngine.safeDateMs.
    private static func dateMs(_ value: String?) -> Double? {
        guard let value, !value.isEmpty else { return nil }
        if value.count == 10, !value.contains("T") {
            // `new Date("2026-05-01")` → UTC midnight.
            let parts = value.split(separator: "-")
            guard parts.count == 3,
                  let y = Int(parts[0]), let mo = Int(parts[1]), let d = Int(parts[2]) else { return nil }
            var comps = DateComponents()
            comps.year = y; comps.month = mo; comps.day = d
            var cal = Calendar(identifier: .gregorian)
            cal.timeZone = TimeZone(identifier: "UTC")!
            guard let date = cal.date(from: comps) else { return nil }
            return date.timeIntervalSince1970 * 1000
        }
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = iso.date(from: value) { return date.timeIntervalSince1970 * 1000 }
        let isoNoFrac = ISO8601DateFormatter()
        isoNoFrac.formatOptions = [.withInternetDateTime]
        if let date = isoNoFrac.date(from: value) { return date.timeIntervalSince1970 * 1000 }
        return nil
    }

    /// `dateToWeekIndex` (setWeightFineTuneEngine.ts:87). Invalid date → 0.
    private static func dateToWeekIndex(_ date: String, _ anchorMs: Double) -> Double {
        guard let d = dateMs(date) else { return 0 }
        let diffMs = d - anchorMs
        return jsRound(diffMs / (1000 * 60 * 60 * 24 * 7))
    }

    // MARK: - set / match helpers

    /// `matchesExercise` (setWeightFineTuneEngine.ts:58). `targetIds.has(exercise.id)`
    /// first (an `undefined`/missing id never matches), then the record pool id.
    private static func matchesExercise(_ exercise: ExercisePrescription, _ targetIds: Set<String>) -> Bool {
        if let id = exercise.id, targetIds.contains(id) { return true }
        let poolId = E1RMEngine.getExerciseRecordPoolId(exercise)
        return poolId.isEmpty ? false : targetIds.contains(poolId)
    }

    /// `isWorkSet` (setWeightFineTuneEngine.ts:67). NOTE: this is the fine-tune engine's
    /// OWN work-set test (`completionStatus !== 'draft'`), distinct from e1rmEngine's
    /// `isCompletedSet`-based one. `set.type` rides in the `_unknown` open bag.
    private static func isWorkSet(_ set: TrainingSetLog) -> Bool {
        let type = set._unknown["type"]?.stringValue
        return type != "warmup"
            && E1RMEngine.number(set.weight) > 0
            && E1RMEngine.number(set.reps) > 0
            && set.completionStatus != "draft"
    }

    /// `linearSlope` (setWeightFineTuneEngine.ts:73). `< 2` samples → 0; `den === 0` → 0.
    /// `(x) ** 2` is reproduced as `dx * dx` (exponent 2 — the single rounding is the
    /// same one `x*x` performs).
    private static func linearSlope(_ samples: [Sample]) -> Double {
        if samples.count < 2 { return 0 }
        let n = Double(samples.count)
        let meanX = samples.reduce(0.0) { $0 + $1.weekIndex } / n
        let meanY = samples.reduce(0.0) { $0 + $1.e1rmKg } / n
        var num = 0.0
        var den = 0.0
        for s in samples {
            let dx = s.weekIndex - meanX
            num += dx * (s.e1rmKg - meanY)
            den += dx * dx
        }
        return den == 0 ? 0 : num / den
    }

    // MARK: - buildSetWeightFineTune (setWeightFineTuneEngine.ts:94)

    public static func buildSetWeightFineTune(_ input: SetWeightFineTuneInput) -> SetWeightFineTuneResult {
        let window = Swift.max(2, input.windowWeeks ?? defaultWindowWeeks)
        let repMin = Swift.max(1, input.repMin)
        let repMax = Swift.max(repMin, input.repMax)
        let target = clamp(input.targetReps, repMin, repMax)
        // `new Set([exerciseId, baseExerciseId].filter(Boolean))`.
        var targetIds = Set<String>()
        if let v = truthy(input.exerciseId) { targetIds.insert(v) }
        if let v = truthy(input.baseExerciseId) { targetIds.insert(v) }

        let fallback = SetWeightFineTuneResult(
            suggestedWeightKg: 0,
            basis: Basis(
                samplesUsed: 0,
                windowWeeks: window,
                currentE1rmKg: nil,
                projectedE1rmKg: nil,
                weeklySlopeKg: 0,
                fallbackReason: insufficientHistory
            )
        )

        // setWeightFineTuneEngine.ts:115 — `repMax < repMin` is unreachable (repMax is
        // `max(repMin, repMax)` above), but transcribed for fidelity.
        if repMax < repMin {
            return SetWeightFineTuneResult(
                suggestedWeightKg: 0,
                basis: Basis(
                    samplesUsed: 0,
                    windowWeeks: window,
                    currentE1rmKg: nil,
                    projectedE1rmKg: nil,
                    weeklySlopeKg: 0,
                    fallbackReason: repRangeInvalid
                )
            )
        }

        // setWeightFineTuneEngine.ts:119-121. `nil` asOfDate is the wall-clock branch —
        // not ported (see header); it and an unparseable date both fall back.
        guard let asOfMs = dateMs(input.asOfDate) else { return fallback }
        let windowStartMs = asOfMs - window * 7 * 24 * 60 * 60 * 1000

        var samples: [Sample] = []
        for session in input.history {
            guard let date = truthy(session.date) else { continue }          // !session?.date
            guard let sessionMs = dateMs(date) else { continue }             // Number.isNaN → continue
            if sessionMs < windowStartMs || sessionMs > asOfMs { continue }
            for exercise in session.exercises ?? [] {
                if !matchesExercise(exercise, targetIds) { continue }
                guard let sets = exercise.sets else { continue }             // !Array.isArray(exercise.sets)
                for set in sets {
                    if !isWorkSet(set) { continue }
                    let reps = E1RMEngine.number(set.reps)
                    if reps < repMin - 2 || reps > repMax + 2 { continue }
                    let rir = E1RMEngine.parseRir(set.rir)
                    if let rir, rir > 4 { continue }
                    let weight = E1RMEngine.number(set.weight)
                    let e1rmKg = epley(weight, reps)
                    if !e1rmKg.isFinite || e1rmKg <= 0 { continue }
                    samples.append(Sample(
                        date: date,
                        weekIndex: dateToWeekIndex(date, windowStartMs),
                        e1rmKg: e1rmKg,
                        weight: weight,
                        reps: reps
                    ))
                }
            }
        }

        if samples.count < minSamples {
            let last = samples.last
            return SetWeightFineTuneResult(
                suggestedWeightKg: last.map { roundToPlate($0.weight) } ?? 0,
                basis: Basis(
                    samplesUsed: samples.count,
                    windowWeeks: window,
                    currentE1rmKg: last?.e1rmKg,
                    projectedE1rmKg: nil,
                    weeklySlopeKg: 0,
                    fallbackReason: insufficientHistory
                )
            )
        }

        // `samples.sort((a, b) => a.weekIndex - b.weekIndex)` — stable ascending. The
        // explicit index tiebreak reproduces V8's stable-sort guarantee for ties so the
        // `effective.last` "current" sample matches TS.
        let sorted = samples.enumerated()
            .sorted { a, b in
                if a.element.weekIndex != b.element.weekIndex { return a.element.weekIndex < b.element.weekIndex }
                return a.offset < b.offset
            }
            .map { $0.element }

        let sortedE1rm = sorted.map { $0.e1rmKg }.sorted(by: <)
        let median = sortedE1rm[sortedE1rm.count / 2]   // Math.floor(len / 2)
        let trimmed = sorted.filter { $0.e1rmKg >= median * 0.7 && $0.e1rmKg <= median * 1.3 }
        let effective = trimmed.count >= minSamples ? trimmed : sorted

        let slope = linearSlope(effective)
        let lastSample = effective[effective.count - 1]
        let currentE1rm = lastSample.e1rmKg
        let projected = currentE1rm + slope
        let cappedProjected = clamp(projected, currentE1rm * 0.95, currentE1rm * (1 + maxWeeklyGrowth))
        let weightForTarget = cappedProjected / (1 + target / 30)
        let rounded = roundToPlate(weightForTarget)

        let noisy = Swift.abs(slope) > currentE1rm * 0.1
        return SetWeightFineTuneResult(
            suggestedWeightKg: rounded,
            basis: Basis(
                samplesUsed: effective.count,
                windowWeeks: window,
                currentE1rmKg: currentE1rm,
                projectedE1rmKg: cappedProjected,
                weeklySlopeKg: slope,
                fallbackReason: noisy ? noisyTrend : nil
            )
        )
    }
}
