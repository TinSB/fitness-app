// EffectiveSetEngine — AN-3 effectiveSetEngine port (the analytics-consumed subset).
//
// Faithful line-by-line Swift port of the PURE effective-set functions in
// `retired web reference` that `analytics.ts` (AN-3) and the wider
// analytics/insights track CALL:
//   - evaluateEffectiveSet       (effectiveSetEngine.ts:7)
//   - countEffectiveSets         (effectiveSetEngine.ts:104)
//   - getMuscleContribution      (effectiveSetEngine.ts:116)
//   - buildEffectiveVolumeSummary(effectiveSetEngine.ts:141)
// + the private helpers they read (clampScore / emptyMuscleSummary) and the
//   output types EffectiveSetResult / EffectiveVolumeSummary (training-model.ts:1250 / :1258).
//
// The `effectiveSetExplanationEngine` re-exports at effectiveSetEngine.ts:214-223 are
// NOT consumed by analytics and are OUT OF SCOPE (not ported).
//
// Reuses (does NOT re-port) the already-ported cross-module dependencies:
//   - replacementEngine.hasInvalidExerciseIdentity  → E1RMEngine.hasInvalidExerciseIdentity
//   - engineUtils.isCompletedSet / number / completedSets → E1RMEngine.{isCompletedSet,number,completedSets}
//   - engineUtils.getPrimaryMuscles                  → AnalyticsSupport.getPrimaryMuscles
// `getSecondaryMuscles` (engineUtils.ts:210) is a one-line pure helper not previously
// needed by any ported engine — it is ported in place here (boundary §AN-3).
//
// PURE: consumes `[TrainingSession]` history (a §11 clean input); no IO, no clock
// (zero `: Date` — every date comparison is over the session's OWN date strings), no
// randomness. NOT wired into any UI/decision output (that is AN-6/AN-7).

import Foundation
import IronPathDomain

public enum EffectiveSetEngine {

    // MARK: - Output types

    /// `EffectiveSetResult` (training-model.ts:1250). `flags` / `confidence` are the
    /// raw string literals the engine emits, compared `==` against the golden.
    public struct EffectiveSetResult: Equatable, Sendable {
        public let isEffective: Bool
        public let score: Double
        public let confidence: String
        public let flags: [String]
        public let reasons: [String]
    }

    /// One `byMuscle` entry of `EffectiveVolumeSummary` (training-model.ts:1265-1277).
    public struct MuscleSummary: Equatable, Sendable {
        public var completedSets: Int
        public var effectiveSets: Int
        public var highConfidenceEffectiveSets: Int
        public var mediumConfidenceEffectiveSets: Int
        public var lowConfidenceEffectiveSets: Int
        public var effectiveScore: Double
        public var weightedEffectiveSets: Double
        public var highConfidenceWeightedSets: Double

        /// `emptyMuscleSummary` (effectiveSetEngine.ts:130).
        static func empty() -> MuscleSummary {
            MuscleSummary(
                completedSets: 0, effectiveSets: 0,
                highConfidenceEffectiveSets: 0, mediumConfidenceEffectiveSets: 0,
                lowConfidenceEffectiveSets: 0, effectiveScore: 0,
                weightedEffectiveSets: 0, highConfidenceWeightedSets: 0
            )
        }
    }

    /// One ordered `byMuscle` entry. The legacy web schema `byMuscle` is a plain object whose key
    /// ORDER (first-encounter) is read by `buildMuscleVolumeDashboard`
    /// (analytics.ts:120 `Object.keys(...).forEach`), so the order is preserved here
    /// rather than collapsed into an (unordered) Swift Dictionary.
    public struct MuscleEntry: Equatable, Sendable {
        public let muscle: String
        public var summary: MuscleSummary
    }

    /// `EffectiveVolumeSummary` (training-model.ts:1258).
    public struct EffectiveVolumeSummary: Equatable, Sendable {
        public var completedSets: Int
        public var effectiveSets: Int
        public var highConfidenceEffectiveSets: Int
        public var mediumConfidenceEffectiveSets: Int
        public var lowConfidenceEffectiveSets: Int
        public var effectiveScore: Double
        public var byMuscle: [MuscleEntry]
        public var reasons: [String]

        /// First-encounter-ordered lookup mirroring `summary.byMuscle[muscle]`.
        func muscle(_ name: String) -> MuscleSummary? {
            byMuscle.first(where: { $0.muscle == name })?.summary
        }
    }

    /// `context.plannedReps` shape (effectiveSetEngine.ts:10).
    public struct EvaluateContext: Sendable {
        public let plannedReps: [Double]?
        public init(plannedReps: [Double]? = nil) { self.plannedReps = plannedReps }
    }

    // MARK: - engineUtils.getSecondaryMuscles (engineUtils.ts:210) — ported in place

    /// `getSecondaryMuscles` (engineUtils.ts:210): `exercise.secondaryMuscles || []`.
    /// `secondaryMuscles` rides in the open bag.
    static func getSecondaryMuscles(_ exercise: ExercisePrescription) -> [String] {
        guard let arr = exercise._unknown["secondaryMuscles"]?.arrayValue else { return [] }
        return arr.compactMap { $0.stringValue }
    }

    // MARK: - clampScore (effectiveSetEngine.ts:5)

    /// `clampScore` (effectiveSetEngine.ts:5): `Math.max(0, Math.min(1, score))`.
    private static func clampScore(_ score: Double) -> Double {
        Swift.max(0, Swift.min(1, score))
    }

    /// `set.rir === '' || set.rir === undefined ? undefined : number(set.rir)`
    /// (effectiveSetEngine.ts:58). `null` is NOT `''`/`undefined`, so `number(null)`→0.
    private static func rirValue(_ rir: JSONValue?) -> Double? {
        switch rir {
        case .none: return nil                                   // === undefined
        case .some(.string(let s)) where s.isEmpty: return nil   // === ''
        case .some(let v): return E1RMEngine.number(v)           // number(set.rir)
        }
    }

    // MARK: - evaluateEffectiveSet (effectiveSetEngine.ts:7)

    public static func evaluateEffectiveSet(
        _ set: TrainingSetLog,
        _ exercise: ExercisePrescription? = nil,
        context: EvaluateContext? = nil
    ) -> EffectiveSetResult {
        var flags: [String] = []
        var reasons: [String] = []
        var score: Double = 1

        // hasInvalidExerciseIdentity(undefined) === false (replacementEngine.ts:141).
        let invalidIdentity = exercise.map { E1RMEngine.hasInvalidExerciseIdentity($0) } ?? false
        let setIdentityInvalid = set._unknown["identityInvalid"]?.boolValue == true
        if invalidIdentity || setIdentityInvalid {
            return EffectiveSetResult(
                isEffective: false, score: 0, confidence: "low",
                flags: ["identity_invalid"],
                reasons: ["动作身份需要检查，暂不计入有效组。"]
            )
        }

        if set._unknown["type"]?.stringValue == "warmup" {
            return EffectiveSetResult(
                isEffective: false, score: 0, confidence: "low",
                flags: ["warmup"],
                reasons: ["热身组用于准备，不计入肌肥大有效组。"]
            )
        }

        if !E1RMEngine.isCompletedSet(set) || E1RMEngine.number(set.weight) <= 0 || E1RMEngine.number(set.reps) <= 0 {
            return EffectiveSetResult(
                isEffective: false, score: 0, confidence: "low",
                flags: ["incomplete"],
                reasons: ["该组未完整完成，不能计入有效组。"]
            )
        }

        if set.techniqueQuality == "poor" {
            flags.append("poor_technique")
            score *= 0.45
            reasons.append("动作质量较差，有效刺激和数据可信度下调。")
        }

        if set.painFlag == true {
            flags.append("pain")
            score *= 0.5
            reasons.append("该组出现不适，不作为高质量有效组。")
        }

        let rir = rirValue(set.rir)
        if rir == nil {
            flags.append("unknown_rir")
            score *= 0.82
            reasons.append("未记录 RIR，按中等置信度计入。")
        } else if rir! >= 5 {
            flags.append("too_easy")
            score *= 0.45
            reasons.append("RIR 过高，说明该组可能明显偏轻。")
        } else if rir! == 4 {
            flags.append("too_easy")
            score *= 0.65
            reasons.append("RIR 偏高，有效性下调。")
        } else if rir! >= 1 && rir! <= 3 {
            flags.append("valid_effort")
            reasons.append("努力程度落在 RIR 1-3 的有效区间。")
        } else {
            flags.append("valid_effort")
            score *= 0.9
            reasons.append("接近力竭，但需要关注疲劳成本和动作质量。")
        }

        // repRange = context?.plannedReps || [number(exercise?.repMin), number(exercise?.repMax)]
        let repRange: [Double]
        if let planned = context?.plannedReps {
            repRange = planned
        } else {
            repRange = [
                E1RMEngine.number(exercise?._unknown["repMin"]?.numberValue),
                E1RMEngine.number(exercise?._unknown["repMax"]?.numberValue),
            ]
        }
        if repRange[0] > 0 && E1RMEngine.number(set.reps) < repRange[0] {
            score *= 0.75
            reasons.append("实际次数低于处方下限，有效性下调。")
        }

        let finalScore = clampScore(score)
        let confidence: String
        if flags.contains("pain") || flags.contains("poor_technique") || flags.contains("too_easy") {
            confidence = "low"
        } else if flags.contains("unknown_rir") {
            confidence = "medium"
        } else if finalScore >= 0.75 {
            confidence = "high"
        } else {
            confidence = "low"
        }
        return EffectiveSetResult(
            isEffective: finalScore >= 0.75,
            score: finalScore,
            confidence: confidence,
            flags: flags,
            reasons: reasons
        )
    }

    // MARK: - countEffectiveSets (effectiveSetEngine.ts:104)

    public static func countEffectiveSets(_ session: TrainingSession, minScore: Double? = nil) -> Int {
        let threshold = minScore ?? 0.75 // options?.minScore ?? 0.75
        return (session.exercises ?? []).reduce(0) { sum, exercise in
            if E1RMEngine.hasInvalidExerciseIdentity(exercise) { return sum + 0 }
            let counted = E1RMEngine.completedSets(exercise).filter { set in
                let type = set._unknown["type"]?.stringValue
                return evaluateEffectiveSet(set, exercise).score >= threshold
                    && type != "corrective" && type != "functional"
            }.count
            return sum + counted
        }
    }

    // MARK: - getMuscleContribution (effectiveSetEngine.ts:116)

    /// Returns the muscle→contribution pairs in first-encounter order (mirrors the legacy web schema
    /// plain-object key order, which `buildEffectiveVolumeSummary` iterates).
    public static func getMuscleContribution(_ exercise: ExercisePrescription) -> [(muscle: String, contribution: Double)] {
        // if (exercise.muscleContribution && Object.keys(exercise.muscleContribution).length) return it
        if let mc = exercise._unknown["muscleContribution"]?.objectValue, !mc.isEmpty {
            return mc.entries.map { ($0.key, $0.value.doubleValue ?? 0) }
        }
        var contributions: [(muscle: String, contribution: Double)] = []
        func upsertMax(_ muscle: String, _ value: Double) {
            if let idx = contributions.firstIndex(where: { $0.muscle == muscle }) {
                contributions[idx].contribution = Swift.max(contributions[idx].contribution, value) // Math.max(existing||0, value)
            } else {
                contributions.append((muscle, Swift.max(0, value)))
            }
        }
        for muscle in AnalyticsSupport.getPrimaryMuscles(exercise) { upsertMax(muscle, 1) }
        for muscle in getSecondaryMuscles(exercise) { upsertMax(muscle, 0.5) }
        return contributions
    }

    // MARK: - buildEffectiveVolumeSummary (effectiveSetEngine.ts:141)

    /// `dateRange` shape (effectiveSetEngine.ts:141).
    public struct DateRange: Sendable {
        public let from: String?
        public let to: String?
        public init(from: String? = nil, to: String? = nil) { self.from = from; self.to = to }
    }

    public static func buildEffectiveVolumeSummary(
        _ history: [TrainingSession],
        dateRange: DateRange? = nil
    ) -> EffectiveVolumeSummary {
        var completedSetsTotal = 0
        var effectiveSetsTotal = 0
        var highConf = 0
        var medConf = 0
        var lowConf = 0
        var effectiveScore: Double = 0
        var byMuscle: [MuscleEntry] = []
        var reasons: [String] = []

        func pushReason(_ reason: String) {
            if !reasons.contains(reason) { reasons.append(reason) } // !summary.reasons.includes(reason)
        }

        // history.filter (effectiveSetEngine.ts:153)
        let sessions = history.filter { session in
            let dataFlag = session._unknown["dataFlag"]?.stringValue
            if dataFlag == "test" || dataFlag == "excluded" { return false }
            let date = session.date ?? ""
            if let from = dateRange?.from, date < from { return false }
            if let to = dateRange?.to, date > to { return false }
            return true
        }

        for session in sessions {
            for exercise in session.exercises ?? [] {
                if E1RMEngine.hasInvalidExerciseIdentity(exercise) {
                    pushReason("动作身份需要检查，相关组暂不计入有效组。")
                    continue
                }
                let contributions = getMuscleContribution(exercise)
                for set in E1RMEngine.completedSets(exercise) {
                    let type = set._unknown["type"]?.stringValue
                    if type == "corrective" || type == "functional" { continue }
                    let result = evaluateEffectiveSet(set, exercise)
                    completedSetsTotal += 1
                    effectiveScore += result.score
                    if result.isEffective {
                        effectiveSetsTotal += 1
                        if result.confidence == "high" { highConf += 1 }
                        else if result.confidence == "medium" { medConf += 1 }
                        else { lowConf += 1 }
                    }
                    for (muscle, contribution) in contributions {
                        var item = byMuscle.first(where: { $0.muscle == muscle })?.summary ?? MuscleSummary.empty()
                        item.completedSets += 1
                        item.effectiveScore += result.score
                        if result.isEffective {
                            item.effectiveSets += 1
                            item.weightedEffectiveSets += result.score * contribution
                            if result.confidence == "high" {
                                item.highConfidenceEffectiveSets += 1
                                item.highConfidenceWeightedSets += contribution
                            } else if result.confidence == "medium" {
                                item.mediumConfidenceEffectiveSets += 1
                            } else {
                                item.lowConfidenceEffectiveSets += 1
                            }
                        }
                        if let idx = byMuscle.firstIndex(where: { $0.muscle == muscle }) {
                            byMuscle[idx].summary = item
                        } else {
                            byMuscle.append(MuscleEntry(muscle: muscle, summary: item))
                        }
                    }
                    for reason in result.reasons { pushReason(reason) }
                }
            }
        }

        // summary.effectiveScore = Math.round(summary.effectiveScore * 10) / 10
        effectiveScore = Double(AnalyticsSupport.jsMathRound(effectiveScore * 10)) / 10
        for idx in byMuscle.indices {
            byMuscle[idx].summary.effectiveScore = Double(AnalyticsSupport.jsMathRound(byMuscle[idx].summary.effectiveScore * 10)) / 10
            byMuscle[idx].summary.weightedEffectiveSets = Double(AnalyticsSupport.jsMathRound(byMuscle[idx].summary.weightedEffectiveSets * 10)) / 10
            byMuscle[idx].summary.highConfidenceWeightedSets = Double(AnalyticsSupport.jsMathRound(byMuscle[idx].summary.highConfidenceWeightedSets * 10)) / 10
        }

        return EffectiveVolumeSummary(
            completedSets: completedSetsTotal,
            effectiveSets: effectiveSetsTotal,
            highConfidenceEffectiveSets: highConf,
            mediumConfidenceEffectiveSets: medConf,
            lowConfidenceEffectiveSets: lowConf,
            effectiveScore: effectiveScore,
            byMuscle: byMuscle,
            reasons: reasons
        )
    }
}
