// WeeklyMuscleBalanceEngine — AN-1 leaf-analytics port (3/3).
//
// Faithful line-by-line Swift port of the PURE `computeWeeklyMuscleBalance` from
// `retired web reference` + the shared `safeDate` /
// `isAnalyticsSession` / `startOfWeekUtc` / `weekKey` and `getPrimaryMuscles` /
// `setVolume` (in `AnalyticsSupport`). **Reuses (does NOT re-port) the already-ported
// `E1RMEngine.completedSets` / `number`** so completed-set + numeric semantics stay
// identical across engines.
//
// PURE / READ-ONLY: buckets THIS WEEK's completed sets per muscle (via explicit
// `muscleContribution` weights, else primary-muscle 1 / 0.5 allocation), then derives
// per-muscle effective-set / volume / share, an overworked / underworked split, a
// 0..100 balance score and a headline. Zero `: Date` — "今天" is the injected
// `options.nowIso`, never the wall clock. No IO, no randomness, no write path. NOT
// wired into any UI (that is AN-6).

import Foundation
import IronPathDomain

public enum WeeklyMuscleBalanceEngine {

    /// `MuscleBalanceEntry` (weeklyMuscleBalanceEngine.ts:4). `effectiveSets` / `share`
    /// are `toFixed`-rounded Doubles; `estimatedVolumeKg` is `Math.round`-ed (Int).
    public struct MuscleBalanceEntry: Equatable, Sendable {
        public let muscle: String
        public let effectiveSets: Double
        public let estimatedVolumeKg: Int
        public let share: Double
    }

    /// `WeeklyMuscleBalance` (weeklyMuscleBalanceEngine.ts:11). `balanceScore` ∈ 0..100.
    public struct WeeklyMuscleBalance: Equatable, Sendable {
        public let weekStartKey: String
        public let totalEffectiveSets: Double
        public let totalEstimatedVolumeKg: Int
        public let entries: [MuscleBalanceEntry]
        public let overworkedMuscles: [String]
        public let underworkedMuscles: [String]
        public let balanceScore: Int
        public let headline: String
    }

    /// `WeeklyMuscleBalanceOptions` (weeklyMuscleBalanceEngine.ts:22). `nowIso`
    /// REQUIRED (§11 injected clock — no wall-clock fallback); `weekStartDayOfWeek`
    /// default 1; `focusMuscles` default `DEFAULT_FOCUS_MUSCLES`.
    public struct WeeklyMuscleBalanceOptions: Sendable {
        public let nowIso: String
        public let weekStartDayOfWeek: Int?
        public let focusMuscles: [String]?
        public init(nowIso: String, weekStartDayOfWeek: Int? = nil, focusMuscles: [String]? = nil) {
            self.nowIso = nowIso
            self.weekStartDayOfWeek = weekStartDayOfWeek
            self.focusMuscles = focusMuscles
        }
    }

    /// `DEFAULT_FOCUS_MUSCLES` (weeklyMuscleBalanceEngine.ts:54).
    static let defaultFocusMuscles = ["胸", "背", "腿", "肩", "手臂", "核心"]

    // MARK: - computeWeeklyMuscleBalance (weeklyMuscleBalanceEngine.ts:56)

    public static func computeWeeklyMuscleBalance(
        _ history: [TrainingSession],
        _ options: WeeklyMuscleBalanceOptions
    ) -> WeeklyMuscleBalance {
        let nowMs = AnalyticsSupport.safeDate(options.nowIso) ?? 0
        let weekStartDow = options.weekStartDayOfWeek ?? 1
        let weekStartMs = AnalyticsSupport.startOfWeekUtc(nowMs, weekStartDow)
        let weekStartKey = AnalyticsSupport.weekKey(nowMs, weekStartDow)
        let focusMuscles = (options.focusMuscles?.isEmpty == false) ? options.focusMuscles! : defaultFocusMuscles

        // effectiveSetsByMuscle is iterated for `allMuscles`, so it preserves JS Map
        // first-encounter order (order array + dict); volumeByMuscle is keyed-only.
        var effectiveOrder: [String] = []
        var effectiveSetsByMuscle: [String: Double] = [:]
        var volumeByMuscle: [String: Double] = [:]

        func addEffective(_ muscle: String, _ delta: Double) {
            if effectiveSetsByMuscle[muscle] == nil {
                effectiveOrder.append(muscle)
                effectiveSetsByMuscle[muscle] = 0
            }
            effectiveSetsByMuscle[muscle]! += delta
        }

        for session in history {
            if !AnalyticsSupport.isAnalyticsSession(session) { continue }
            guard let ts = AnalyticsSupport.sessionTimestamp(session), ts >= weekStartMs, ts <= nowMs else { continue }

            for exercise in session.exercises ?? [] {
                let sets = E1RMEngine.completedSets(exercise)
                if sets.isEmpty { continue }
                let primaryMuscles = AnalyticsSupport.getPrimaryMuscles(exercise)
                let contribution = exercise._unknown["muscleContribution"]?.objectValue
                var allocations: [(String, Double)] = []
                if let contribution, !contribution.isEmpty {
                    for entry in contribution.entries {
                        let muscle = entry.key
                        if muscle.isEmpty { continue } // `if (!muscle) return`
                        let value = E1RMEngine.number(entry.value)
                        if value > 0 { allocations.append((muscle, value)) }
                    }
                } else {
                    for (index, muscle) in primaryMuscles.enumerated() {
                        if muscle.isEmpty { continue }
                        allocations.append((muscle, index == 0 ? 1 : 0.5))
                    }
                }
                if allocations.isEmpty { continue }

                let setVolumeTotal = sets.reduce(0.0) { $0 + AnalyticsSupport.setVolume($1) }
                let effectiveSetCount = Double(sets.count)
                for (muscle, weight) in allocations {
                    addEffective(muscle, effectiveSetCount * weight)
                    volumeByMuscle[muscle] = (volumeByMuscle[muscle] ?? 0) + setVolumeTotal * weight
                }
            }
        }

        // allMuscles = Array.from(new Set([...focusMuscles, ...effectiveSetsByMuscle.keys()]))
        var allMuscles: [String] = []
        var seen = Set<String>()
        for muscle in focusMuscles where !seen.contains(muscle) { seen.insert(muscle); allMuscles.append(muscle) }
        for muscle in effectiveOrder where !seen.contains(muscle) { seen.insert(muscle); allMuscles.append(muscle) }

        let totalEffectiveSets = effectiveSetsByMuscle.values.reduce(0, +) // RAW sum (share denominator)
        let totalVolume = volumeByMuscle.values.reduce(0, +)
        let focusSet = Set(focusMuscles)

        let entries: [MuscleBalanceEntry] = allMuscles
            .map { muscle -> MuscleBalanceEntry in
                let effectiveSets = AnalyticsSupport.roundToFixed(effectiveSetsByMuscle[muscle] ?? 0, 2)
                let volume = AnalyticsSupport.jsMathRound(volumeByMuscle[muscle] ?? 0)
                let share = totalEffectiveSets > 0
                    ? AnalyticsSupport.roundToFixed((effectiveSets / totalEffectiveSets) * 100, 1)
                    : 0
                return MuscleBalanceEntry(muscle: muscle, effectiveSets: effectiveSets, estimatedVolumeKg: volume, share: share)
            }
            .filter { focusSet.contains($0.muscle) || $0.effectiveSets > 0 }
            .sorted { $0.effectiveSets > $1.effectiveSets } // stable descending

        let focusEntries = entries.filter { focusSet.contains($0.muscle) }
        var balanceScore = 100
        var overworked: [String] = []
        var underworked: [String] = []

        if focusEntries.count >= 2 && totalEffectiveSets > 0 {
            let targetShare = 100.0 / Double(focusEntries.count)
            let deviations = focusEntries.map { $0.share - targetShare }
            let maxDeviation = deviations.map { abs($0) }.max() ?? 0
            balanceScore = max(0, AnalyticsSupport.jsMathRound(100 - maxDeviation * 2))
            overworked = focusEntries.filter { $0.share - targetShare >= 12 }.map { $0.muscle }
            underworked = focusEntries.enumerated()
                .filter { deviations[$0.offset] <= -12 || $0.element.effectiveSets == 0 }
                .map { $0.element.muscle }
        } else if totalEffectiveSets == 0 {
            balanceScore = 0
        }

        let headline: String
        if totalEffectiveSets == 0 {
            headline = "本周尚无训练数据，平衡评分不可用。"
        } else if !overworked.isEmpty || !underworked.isEmpty {
            let overPart = overworked.isEmpty ? "" : "\(overworked.joined(separator: " / ")) 偏多"
            let sep = (!overworked.isEmpty && !underworked.isEmpty) ? "，" : ""
            let underPart = underworked.isEmpty ? "" : "\(underworked.joined(separator: " / ")) 偏少"
            headline = "本周肌群平衡：\(overPart)\(sep)\(underPart)。"
        } else {
            headline = "本周肌群训练量分布均衡。"
        }

        return WeeklyMuscleBalance(
            weekStartKey: weekStartKey,
            totalEffectiveSets: AnalyticsSupport.roundToFixed(totalEffectiveSets, 2),
            totalEstimatedVolumeKg: AnalyticsSupport.jsMathRound(totalVolume),
            entries: entries,
            overworkedMuscles: overworked,
            underworkedMuscles: underworked,
            balanceScore: balanceScore,
            headline: headline
        )
    }
}
