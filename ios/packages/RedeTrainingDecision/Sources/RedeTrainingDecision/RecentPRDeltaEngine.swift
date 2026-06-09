// RecentPRDeltaEngine — AN-1 leaf-analytics port (2/3).
//
// Faithful line-by-line Swift port of the PURE `computeRecentPRDeltas` from
// `retired web reference` + its private helpers (`exerciseKey`
// ts:38 / `bestSet` ts:40 / `collectObservations` ts:64 / `pickBest` ts:88) and the
// shared `safeDate` / `isAnalyticsSession` (in `AnalyticsSupport`). **Reuses (does
// NOT re-port) the already-ported `E1RMEngine.isCompletedSet` / `setWeightKg`
// (== `number(actualWeightKg ?? weight)`) / `number`** so set semantics stay
// identical across engines.
//
// PURE / READ-ONLY: groups completed working sets per exercise into a within-window
// "current best" vs an out-of-window "previous best", emits the per-exercise delta,
// sorts (new first, then by deltaKg descending — JS-stable) and slices to `limit`.
// Zero `: Date` — "今天" is the injected `options.nowIso`, never the wall clock. No
// IO, no randomness, no write path. NOT wired into any UI (that is AN-6).

import Foundation
import RedeDomain

public enum RecentPRDeltaEngine {

    /// `RecentPRDeltaEntry` (recentPRDeltaEngine.ts:4). Optional fields follow the
    /// legacy web schema `canonicalStringify` drop-undefined rule. `direction` ∈ up/flat/down/new.
    public struct RecentPRDeltaEntry: Equatable, Sendable {
        public let exerciseId: String
        public let exerciseName: String
        public let windowDays: Int
        public let currentBestKg: Double
        public let currentBestReps: Double
        public let currentBestDate: String
        public let previousBestKg: Double?
        public let previousBestReps: Double?
        public let previousBestDate: String?
        public let deltaKg: Double?
        public let deltaPercent: Double?
        public let direction: String
    }

    /// `RecentPRDeltaOptions` (recentPRDeltaEngine.ts:19). `nowIso` REQUIRED (§11
    /// injected clock — no wall-clock fallback); `windowDays` default 14, `limit` 6.
    public struct RecentPRDeltaOptions: Sendable {
        public let windowDays: Int?
        public let nowIso: String
        public let limit: Int?
        public init(nowIso: String, windowDays: Int? = nil, limit: Int? = nil) {
            self.nowIso = nowIso
            self.windowDays = windowDays
            self.limit = limit
        }
    }

    /// `ExerciseObservation` (recentPRDeltaEngine.ts:56).
    private struct ExerciseObservation {
        let exerciseName: String
        let weight: Double
        let reps: Double
        let date: String
        let timestamp: Double
    }

    /// JS truthiness for an optional string id (`a || b` skips empty strings).
    private static func truthy(_ value: String?) -> String? {
        guard let value, !value.isEmpty else { return nil }
        return value
    }

    /// `exerciseKey` (ts:38): `canonicalExerciseId || baseId || id`. canonical/base
    /// ride in the open bag; id is typed.
    private static func exerciseKey(_ exercise: ExercisePrescription) -> String {
        truthy(exercise._unknown["canonicalExerciseId"]?.stringValue)
            ?? truthy(exercise._unknown["baseId"]?.stringValue)
            ?? (exercise.id ?? "")
    }

    /// `bestSet` (ts:40). `number(actualWeightKg ?? weight)` IS `E1RMEngine.setWeightKg`.
    private static func bestSet(_ sets: [TrainingSetLog]) -> (weight: Double, reps: Double)? {
        var bestWeight = 0.0
        var bestReps = 0.0
        for set in sets {
            if !E1RMEngine.isCompletedSet(set) { continue }
            let weight = E1RMEngine.setWeightKg(set)
            let reps = E1RMEngine.number(set.reps)
            if weight <= 0 || reps <= 0 { continue }
            if weight > bestWeight || (weight == bestWeight && reps > bestReps) {
                bestWeight = weight
                bestReps = reps
            }
        }
        return bestWeight > 0 ? (bestWeight, bestReps) : nil
    }

    /// `collectObservations` (ts:64). The returned (orderedKeys, map) preserves JS
    /// `Map` first-encounter insertion order so the later `forEach` + stable sort
    /// reproduce legacy web schema tie order.
    private static func collectObservations(
        _ history: [TrainingSession]
    ) -> (order: [String], map: [String: [ExerciseObservation]]) {
        var order: [String] = []
        var map: [String: [ExerciseObservation]] = [:]
        for session in history {
            if !AnalyticsSupport.isAnalyticsSession(session) { continue }
            guard let ts = AnalyticsSupport.sessionTimestamp(session) else { continue }
            for exercise in session.exercises ?? [] {
                let sets = exercise.sets ?? []  // Array.isArray(exercise.sets) ? ... : []
                guard let best = bestSet(sets) else { continue }
                let key = exerciseKey(exercise)
                if map[key] == nil {
                    order.append(key)
                    map[key] = []
                }
                map[key]!.append(ExerciseObservation(
                    exerciseName: truthy(exercise.name) ?? (exercise.id ?? ""), // name || id
                    weight: best.weight,
                    reps: best.reps,
                    date: session.date ?? "",
                    timestamp: ts
                ))
            }
        }
        return (order, map)
    }

    /// `pickBest` (ts:88) — max weight, then max reps; first-seen wins on full tie.
    private static func pickBest(_ observations: [ExerciseObservation]) -> ExerciseObservation? {
        var best: ExerciseObservation?
        for observation in observations {
            if best == nil
                || observation.weight > best!.weight
                || (observation.weight == best!.weight && observation.reps > best!.reps) {
                best = observation
            }
        }
        return best
    }

    // MARK: - computeRecentPRDeltas (recentPRDeltaEngine.ts:98)

    public static func computeRecentPRDeltas(
        _ history: [TrainingSession],
        _ options: RecentPRDeltaOptions
    ) -> [RecentPRDeltaEntry] {
        let windowDays = options.windowDays ?? 14
        let limit = options.limit ?? 6
        let nowMs = AnalyticsSupport.safeDate(options.nowIso) ?? 0
        let cutoffMs = nowMs - Double(windowDays) * AnalyticsSupport.msPerDay

        let (order, map) = collectObservations(history)
        var results: [RecentPRDeltaEntry] = []

        for key in order {
            let entries = map[key]!
            let inside = entries.filter { $0.timestamp >= cutoffMs && $0.timestamp <= nowMs }
            // `outside` filter mirrored for completeness; only `pickBest(outside)` is read.
            let outside = entries.filter { $0.timestamp < cutoffMs }
            if inside.isEmpty { continue }

            let currentBest = pickBest(inside)!
            let previousBest = pickBest(outside)

            var direction = "new"
            var deltaKg: Double?
            var deltaPercent: Double?

            if let previousBest {
                deltaKg = AnalyticsSupport.roundToFixed(currentBest.weight - previousBest.weight, 2)
                deltaPercent = previousBest.weight > 0
                    ? AnalyticsSupport.roundToFixed(((currentBest.weight - previousBest.weight) / previousBest.weight) * 100, 1)
                    : nil
                direction = deltaKg! > 0 ? "up" : (deltaKg! < 0 ? "down" : "flat")
            }

            results.append(RecentPRDeltaEntry(
                exerciseId: key,
                exerciseName: currentBest.exerciseName,
                windowDays: windowDays,
                currentBestKg: currentBest.weight,
                currentBestReps: currentBest.reps,
                currentBestDate: currentBest.date,
                previousBestKg: previousBest?.weight,
                previousBestReps: previousBest?.reps,
                previousBestDate: previousBest?.date,
                deltaKg: deltaKg,
                deltaPercent: deltaPercent,
                direction: direction
            ))
        }

        // `.sort((l, r) => { new first; else rightDelta - leftDelta })` — JS treats a
        // NaN return (two `new` entries, +Inf − +Inf) as 0, so they keep insertion
        // order; Swift's stable `sorted(by:)` reproduces this when the predicate is
        // false both ways for equal pairs.
        results = stableSorted(results)

        return Array(results.prefix(limit))
    }

    /// Stable strict-weak-ordering reproduction of the legacy web schema sort comparator.
    private static func stableSorted(_ entries: [RecentPRDeltaEntry]) -> [RecentPRDeltaEntry] {
        entries.sorted { left, right in
            let leftNew = left.direction == "new"
            let rightNew = right.direction == "new"
            if leftNew && !rightNew { return true }   // return -1 → left first
            if rightNew && !leftNew { return false }  // return +1 → left after
            if leftNew && rightNew { return false }   // both new → NaN → keep order
            // both non-new: rightDelta - leftDelta < 0 ⟺ leftDelta > rightDelta → left first
            return (left.deltaKg ?? .infinity) > (right.deltaKg ?? .infinity)
        }
    }
}
