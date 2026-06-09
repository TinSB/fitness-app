// RecommendationConfidenceEngine — AN-5b recommendation-confidence port.
//
// Faithful line-by-line Swift port of the PURE recommendation-confidence function from
// `retired web reference`:
//   - buildRecommendationConfidence   (recommendationConfidenceEngine.ts:220)
// + every private helper it reads (clampScore / reason / getExerciseIds / exerciseMatches /
//   relevantSessions / relevantSets / buildTechniqueSummaryFromSets / isLoadFeedbackSummary /
//   normalizeLoadFeedback / resolveCurrentE1rm / countRecentEdits / hasRecentReplacement /
//   hasMixedUnitsWithSparseHistory / levelFromScore / levelLabel) and the output / input
//   types (RecommendationConfidenceLevel / RecommendationConfidenceReason /
//   RecommendationConfidenceResult / BuildRecommendationConfidenceParams).
//
// `completedTrainingSets` (recommendationConfidenceEngine.ts:70) is defined in the legacy web schema module
// but NEVER reached from `buildRecommendationConfidence` (dead helper) — it is intentionally
// not ported (the function-level parity pin covers only the exported function + its reachable
// helpers, the same precedent as the PlateauDetectionEngine port).
//
// Dependency boundary (AN-5b §, matches the slice contract):
//   * REUSES (does NOT re-port) the already-ported engineUtils helpers
//     `E1RMEngine.number` / `completedSets` and the analytics filter
//     `E1RMEngine.filterAnalyticsHistory`, plus the `LoadFeedbackEngine.LoadFeedbackValue`
//     canonical value constants. These are the engine's only real function calls.
//   * REUSES the already-ported consumed-input types `PlateauDetectionEngine.TechniqueQualitySummary`
//     (the legacy web schema imports `TechniqueQualitySummary` from trainingLevelEngine; the Swift port lives
//     in PlateauDetectionEngine with a TrainingLevelEngine typealias), the consumed subset
//     `PlateauDetectionEngine.EffectiveVolumeSummary` (the legacy web schema param is `Partial<EffectiveVolumeSummary>`
//     and reads the SAME three fields the plateau engine does), and the canonical
//     `PainPatternEngine.PainPattern` (the precedent set by TrainingLevelEngine.Params).
//   * The optional external inputs `e1rmProfile` (`E1RMProfile | EstimatedOneRepMax | null`) /
//     `loadFeedback` (`LoadFeedbackInput`) / `recentEdits` (`RecentEditInput`) are genuine legacy web schema
//     runtime unions consumed by DUCK-TYPING. The faithful port keeps them as raw `JSONValue?`
//     and reproduces the SAME structural discrimination — never forcing a static type the legacy web schema
//     does not assert.
//   * `trainingLevel` (`AutoTrainingLevel | string | null`) is only ever `=== 'unknown'` /
//     `=== 'beginner'` compared, so it is kept as a raw `String?` (the rawValue).
//
// PURE: consumes `history: [TrainingSession]` (already a §11 clean input) + optional external
// summaries; no IO, no clock (`zero : Date` — every date comparison is over the session's OWN
// date strings via `localeCompare`-equivalent `>`), no randomness. NOT wired into any UI (that
// is AN-6); this slice only adds the function and parity-pins it function-by-function.

import Foundation
import RedeDomain

public enum RecommendationConfidenceEngine {

    // MARK: - Output types (recommendationConfidenceEngine.ts:16-32)

    /// `RecommendationConfidenceLevel` (recommendationConfidenceEngine.ts:16). RawValue
    /// strings mirror the legacy web schema string-literal union so the golden's `level` decodes verbatim.
    public enum RecommendationConfidenceLevel: String, Equatable, Sendable {
        case low = "low"
        case medium = "medium"
        case high = "high"
    }

    /// `RecommendationConfidenceReason` (recommendationConfidenceEngine.ts:18). `effect` kept
    /// as a raw String ('raise_confidence' | 'lower_confidence' | 'informational') — the engine
    /// only ever assigns those three canonical values and filters them by `===`.
    public struct RecommendationConfidenceReason: Equatable, Sendable {
        public let id: String
        public let label: String
        public let effect: String
        public let reason: String
        public init(id: String, label: String, effect: String, reason: String) {
            self.id = id
            self.label = label
            self.effect = effect
            self.reason = reason
        }
    }

    /// `RecommendationConfidenceResult` (recommendationConfidenceEngine.ts:25). `score` is
    /// `clampScore`'d → an integer.
    public struct RecommendationConfidenceResult: Equatable, Sendable {
        public let level: RecommendationConfidenceLevel
        public let score: Int
        public let title: String
        public let summary: String
        public let reasons: [RecommendationConfidenceReason]
        public let missingData: [String]
        public init(
            level: RecommendationConfidenceLevel,
            score: Int,
            title: String,
            summary: String,
            reasons: [RecommendationConfidenceReason],
            missingData: [String]
        ) {
            self.level = level
            self.score = score
            self.title = title
            self.summary = summary
            self.reasons = reasons
            self.missingData = missingData
        }
    }

    // MARK: - Reused consumed-input types

    /// `TechniqueQualitySummary` (trainingLevelEngine.ts:41) — REUSED (see file header).
    public typealias TechniqueQualitySummary = PlateauDetectionEngine.TechniqueQualitySummary
    /// `Partial<EffectiveVolumeSummary>` consumed subset — REUSED (see file header).
    public typealias EffectiveVolumeSummary = PlateauDetectionEngine.EffectiveVolumeSummary

    // MARK: - Input params (recommendationConfidenceEngine.ts:44 BuildRecommendationConfidenceParams)

    /// `BuildRecommendationConfidenceParams` (recommendationConfidenceEngine.ts:44).
    /// `e1rmProfile` / `loadFeedback` / `recentEdits` stay raw `JSONValue?` — see the file
    /// header for why the duck-typed unions are not closed into static types.
    public struct Params {
        public let exerciseId: String?
        public let history: [TrainingSession]
        public let e1rmProfile: JSONValue?
        public let effectiveSetSummary: EffectiveVolumeSummary?
        public let loadFeedback: JSONValue?
        public let techniqueQualitySummary: TechniqueQualitySummary?
        public let painPatterns: [PainPatternEngine.PainPattern]?
        public let trainingLevel: String?
        public let recentEdits: JSONValue?
        public init(
            exerciseId: String? = nil,
            history: [TrainingSession] = [],
            e1rmProfile: JSONValue? = nil,
            effectiveSetSummary: EffectiveVolumeSummary? = nil,
            loadFeedback: JSONValue? = nil,
            techniqueQualitySummary: TechniqueQualitySummary? = nil,
            painPatterns: [PainPatternEngine.PainPattern]? = nil,
            trainingLevel: String? = nil,
            recentEdits: JSONValue? = nil
        ) {
            self.exerciseId = exerciseId
            self.history = history
            self.e1rmProfile = e1rmProfile
            self.effectiveSetSummary = effectiveSetSummary
            self.loadFeedback = loadFeedback
            self.techniqueQualitySummary = techniqueQualitySummary
            self.painPatterns = painPatterns
            self.trainingLevel = trainingLevel
            self.recentEdits = recentEdits
        }
    }

    /// `normalizeLoadFeedback`'s `{ total, counts, stable, volatile }` result
    /// (recommendationConfidenceEngine.ts:166).
    private struct NormalizedLoadFeedback {
        let total: Int
        let tooHeavy: Int
        let tooLight: Int
        let good: Int
        let stable: Bool
        let volatile: Bool
    }

    // MARK: - Tiny helpers

    /// `clampScore` (recommendationConfidenceEngine.ts:56): `Math.max(0, Math.min(100, Math.round(value)))`.
    /// `Math.round` is `floor(x + 0.5)` (half → +∞), reused via `AnalyticsSupport.jsMathRound`.
    private static func clampScore(_ value: Double) -> Int {
        Swift.max(0, Swift.min(100, AnalyticsSupport.jsMathRound(value)))
    }

    /// `reason(...)` factory (recommendationConfidenceEngine.ts:58).
    private static func reason(_ id: String, _ label: String, _ effect: String, _ text: String) -> RecommendationConfidenceReason {
        RecommendationConfidenceReason(id: id, label: label, effect: effect, reason: text)
    }

    /// JS truthiness for an optional string (`a || b` skips `undefined` AND `''`).
    private static func truthy(_ value: String?) -> String? {
        guard let value, !value.isEmpty else { return nil }
        return value
    }

    /// JS truthiness for a free-form JSON value (`value ? … : …`): false for
    /// undefined/null/false/0/'' — true otherwise.
    private static func jsTruthy(_ value: JSONValue?) -> Bool {
        guard let value else { return false }
        switch value {
        case .null: return false
        case .bool(let b): return b
        case .number(let n): return n.doubleValue != 0
        case .string(let s): return !s.isEmpty
        default: return true
        }
    }

    /// JS `a ?? b ?? c` (nullish-coalesce) over JSON values: pick the first that is neither
    /// absent nor JSON `null` (mirrors `??`, which — unlike `||` — does NOT skip `0`/`''`).
    private static func coalesce(_ values: JSONValue?...) -> JSONValue? {
        for value in values {
            guard let value else { continue }
            if case .null = value { continue }
            return value
        }
        return nil
    }

    // MARK: - Exercise identity (recommendationConfidenceEngine.ts:73-91)

    /// `getExerciseIds` (recommendationConfidenceEngine.ts:73): the 7 identity fields,
    /// `filter(Boolean)` + `map(String)`. `baseId` / `canonicalExerciseId` /
    /// `replacementExerciseId` / `replacedFromId` ride in the `_unknown` open bag; `id` /
    /// `actualExerciseId` / `originalExerciseId` are typed (same field map as the plateau port).
    private static func getExerciseIds(_ exercise: ExercisePrescription) -> Set<String> {
        var ids = Set<String>()
        let candidates: [String?] = [
            exercise.id,
            exercise._unknown["baseId"]?.stringValue,
            exercise.actualExerciseId,
            exercise._unknown["replacementExerciseId"]?.stringValue,
            exercise.originalExerciseId,
            exercise._unknown["canonicalExerciseId"]?.stringValue,
            exercise._unknown["replacedFromId"]?.stringValue,
        ]
        for candidate in candidates {
            if let value = truthy(candidate) { ids.insert(value) }
        }
        return ids
    }

    /// `exerciseMatches` (recommendationConfidenceEngine.ts:88): `if (!exerciseId) return true`
    /// — an absent/empty exerciseId matches every exercise.
    private static func exerciseMatches(_ exercise: ExercisePrescription, _ exerciseId: String?) -> Bool {
        guard let exerciseId = truthy(exerciseId) else { return true }
        return getExerciseIds(exercise).contains(exerciseId)
    }

    /// `sessionDateKey` equivalent (recommendationConfidenceEngine.ts:96 sort key):
    /// `finishedAt || startedAt || date || ''`.
    private static func sessionDateKey(_ session: TrainingSession) -> String {
        truthy(session.finishedAt) ?? truthy(session.startedAt) ?? truthy(session.date) ?? ""
    }

    // MARK: - Session / set selection (recommendationConfidenceEngine.ts:93-103)

    /// `relevantSessions` (recommendationConfidenceEngine.ts:93). `localeCompare`-descending
    /// over ASCII ISO date keys is reproduced with `>` (the plateau-port precedent); Swift's
    /// stable sort keeps legacy web schema tie order.
    private static func relevantSessions(_ history: [TrainingSession], _ exerciseId: String?) -> [TrainingSession] {
        E1RMEngine.filterAnalyticsHistory(history)
            .filter { session in (session.exercises ?? []).contains { exerciseMatches($0, exerciseId) } }
            .sorted { sessionDateKey($0) > sessionDateKey($1) }
    }

    /// `relevantSets` (recommendationConfidenceEngine.ts:98). `set.type` lives in `_unknown`.
    private static func relevantSets(_ sessions: [TrainingSession], _ exerciseId: String?) -> [TrainingSetLog] {
        sessions.flatMap { session in
            (session.exercises ?? [])
                .filter { exerciseMatches($0, exerciseId) }
                .flatMap { exercise in
                    E1RMEngine.completedSets(exercise).filter { $0._unknown["type"]?.stringValue != "warmup" }
                }
        }
    }

    // MARK: - Technique summary (recommendationConfidenceEngine.ts:105)

    /// `buildTechniqueSummaryFromSets` (recommendationConfidenceEngine.ts:105). `rirRecorded`
    /// counts a set whose `rir !== undefined && rir !== ''` — a missing key is undefined
    /// (not counted); an explicit JSON `null` and any number/string ≠ '' ARE counted.
    private static func buildTechniqueSummaryFromSets(_ sets: [TrainingSetLog]) -> TechniqueQualitySummary {
        let totalSets = Double(sets.count)
        let good = Double(sets.filter { $0.techniqueQuality == "good" }.count)
        let acceptable = Double(sets.filter { $0.techniqueQuality == "acceptable" }.count)
        let poor = Double(sets.filter { $0.techniqueQuality == "poor" }.count)
        let rirRecorded = Double(sets.filter { set in
            set.rir != nil && set.rir != .string("")
        }.count)
        return TechniqueQualitySummary(
            totalSets: totalSets,
            good: good,
            acceptable: acceptable,
            poor: poor,
            goodOrAcceptableRate: totalSets != 0 ? (good + acceptable) / totalSets : 0,
            poorRate: totalSets != 0 ? poor / totalSets : 0,
            rirRecordedRate: totalSets != 0 ? rirRecorded / totalSets : 0
        )
    }

    // MARK: - Load feedback normalization (recommendationConfidenceEngine.ts:122-174)

    /// `isLoadFeedbackSummary` (recommendationConfidenceEngine.ts:122): object with both
    /// `counts` AND `adjustment` keys.
    private static func isLoadFeedbackSummary(_ value: JSONValue?) -> Bool {
        guard let object = value?.objectValue else { return false }
        return object["counts"] != nil && object["adjustment"] != nil
    }

    /// `normalizeLoadFeedback` (recommendationConfidenceEngine.ts:125). Reproduces the legacy web schema
    /// duck-typed dispatch over the `LoadFeedbackInput` union + the session-history
    /// `loadFeedback` (which rides in `_unknown`). Returns `{ total, counts, stable, volatile }`.
    private static func normalizeLoadFeedback(_ input: JSONValue?, _ sessions: [TrainingSession], _ exerciseId: String?) -> NormalizedLoadFeedback {
        var values: [String] = []

        // `addValue` (recommendationConfidenceEngine.ts:127): only the 3 canonical values,
        // pushed `count` times (`count` is `number(...)`, a Double, compared `index < count`).
        func addValue(_ value: String?, _ count: Double = 1) {
            guard value == LoadFeedbackEngine.tooHeavy
                || value == LoadFeedbackEngine.tooLight
                || value == LoadFeedbackEngine.good else { return }
            var index = 0.0
            while index < count {
                values.append(value!)
                index += 1
            }
        }

        // `addSummary` (recommendationConfidenceEngine.ts:132).
        func addSummary(_ summary: JSONValue?) {
            guard let summary, let object = summary.objectValue else { return }
            let counts = object["counts"]?.objectValue
            addValue(LoadFeedbackEngine.tooHeavy, E1RMEngine.number(counts?["too_heavy"]))
            addValue(LoadFeedbackEngine.tooLight, E1RMEngine.number(counts?["too_light"]))
            addValue(LoadFeedbackEngine.good, E1RMEngine.number(counts?["good"]))
            addValue(object["dominantFeedback"]?.stringValue)
            addValue(object["adjustment"]?.objectValue?["dominantFeedback"]?.stringValue)
        }

        // sessions.flatMap(loadFeedback).filter(!exerciseId || item.exerciseId === exerciseId)
        // .forEach(addValue(feedback)) (recommendationConfidenceEngine.ts:141). `session.loadFeedback`
        // rides in `_unknown`. `!exerciseId` (absent/empty) → keep every item.
        let exerciseIdKey = truthy(exerciseId)
        for session in sessions {
            for item in session._unknown["loadFeedback"]?.arrayValue ?? [] {
                if exerciseIdKey == nil || item.objectValue?["exerciseId"]?.stringValue == exerciseIdKey {
                    addValue(item.objectValue?["feedback"]?.stringValue)
                }
            }
        }

        // The `LoadFeedbackInput` union dispatch (recommendationConfidenceEngine.ts:146).
        if case .array(let items)? = input {
            for item in items {
                if item.objectValue?["feedback"] != nil {
                    addValue(item.objectValue?["feedback"]?.stringValue)
                } else {
                    addSummary(item)
                }
            }
        } else if isLoadFeedbackSummary(input) {
            addSummary(input)
        } else if case .object(let object)? = input {
            for entry in object.entries {
                if case .string(let s) = entry.value {
                    addValue(s)
                } else {
                    addSummary(entry.value)
                }
            }
        }

        let total = values.count
        let tooHeavy = values.filter { $0 == LoadFeedbackEngine.tooHeavy }.count
        let tooLight = values.filter { $0 == LoadFeedbackEngine.tooLight }.count
        let good = values.filter { $0 == LoadFeedbackEngine.good }.count
        // stable / volatile (recommendationConfidenceEngine.ts:169-172). `counts.x / total`
        // is JS float division (total >= 2 guards divide-by-zero for `stable`).
        let stable = total >= 2
            && (Double(good) / Double(total) >= 0.65
                || Double(tooHeavy) / Double(total) >= 0.75
                || Double(tooLight) / Double(total) >= 0.75)
        let volatile = tooHeavy > 0 && tooLight > 0
        return NormalizedLoadFeedback(
            total: total,
            tooHeavy: tooHeavy,
            tooLight: tooLight,
            good: good,
            stable: stable,
            volatile: volatile
        )
    }

    // MARK: - Current e1RM resolution (recommendationConfidenceEngine.ts:176-181)

    /// `resolveCurrentE1rm` (recommendationConfidenceEngine.ts:176). Duck-typed over the
    /// `E1RMProfile | EstimatedOneRepMax | null` union: `'current' in profile || 'best' in profile`
    /// → `profile.current || profile.best` (truthy `||` skips a null/undefined `current`); else
    /// `'e1rmKg' in profile && 'sourceSet' in profile` → the profile itself; else undefined.
    private static func resolveCurrentE1rm(_ profile: JSONValue?) -> JSONValue? {
        guard let object = profile?.objectValue else { return nil }
        if object["current"] != nil || object["best"] != nil {
            return coalesce(object["current"], object["best"])
        }
        if object["e1rmKg"] != nil && object["sourceSet"] != nil {
            return profile
        }
        return nil
    }

    // MARK: - Recent edits (recommendationConfidenceEngine.ts:183-190)

    /// `countRecentEdits` (recommendationConfidenceEngine.ts:183). `directCount` =
    /// `typeof input === 'number' ? input : Array.isArray(input) ? input.length : 0`;
    /// `sessionEditCount` sums `editedAt ? 1 : 0` + `editHistory?.length || 0` (both ride in
    /// `_unknown`).
    private static func countRecentEdits(_ input: JSONValue?, _ sessions: [TrainingSession]) -> Double {
        var directCount = 0.0
        if case .number(let n)? = input {
            directCount = n.doubleValue
        } else if case .array(let items)? = input {
            directCount = Double(items.count)
        }
        let sessionEditCount = sessions.reduce(0.0) { sum, session in
            let edited = jsTruthy(session._unknown["editedAt"]) ? 1.0 : 0.0
            let history = Double(session._unknown["editHistory"]?.arrayValue?.count ?? 0)
            return sum + edited + history
        }
        return directCount + sessionEditCount
    }

    // MARK: - Replacement / unit checks (recommendationConfidenceEngine.ts:192-206)

    /// `hasRecentReplacement` (recommendationConfidenceEngine.ts:192). `originalExerciseId` /
    /// `actualExerciseId` are typed; `baseId` / `replacementExerciseId` / `replacedFromId` ride
    /// in `_unknown`.
    private static func hasRecentReplacement(_ sessions: [TrainingSession], _ exerciseId: String?) -> Bool {
        sessions.prefix(3).contains { session in
            (session.exercises ?? []).contains { exercise in
                guard exerciseMatches(exercise, exerciseId) else { return false }
                let original = truthy(exercise.originalExerciseId) ?? truthy(exercise._unknown["baseId"]?.stringValue)
                let actual = truthy(exercise.actualExerciseId) ?? truthy(exercise._unknown["replacementExerciseId"]?.stringValue)
                let firstBranch = actual != nil && original != nil && actual != original
                let secondBranch = (truthy(exercise._unknown["replacedFromId"]?.stringValue)
                    ?? truthy(exercise._unknown["replacementExerciseId"]?.stringValue)) != nil
                return firstBranch || secondBranch
            }
        }
    }

    /// `hasMixedUnitsWithSparseHistory` (recommendationConfidenceEngine.ts:202). `set.displayUnit`
    /// `filter(Boolean)` → drop nil (a typed `WeightUnit` is always truthy); `new Set(...).size > 1`.
    private static func hasMixedUnitsWithSparseHistory(_ sets: [TrainingSetLog], _ sessionCount: Int) -> Bool {
        if sessionCount > 3 { return false }
        let units = Set(sets.compactMap { $0.displayUnit })
        return units.count > 1
    }

    // MARK: - Level mapping (recommendationConfidenceEngine.ts:208-218)

    /// `levelFromScore` (recommendationConfidenceEngine.ts:208).
    private static func levelFromScore(_ score: Int) -> RecommendationConfidenceLevel {
        if score >= 78 { return .high }
        if score >= 50 { return .medium }
        return .low
    }

    /// `levelLabel` (recommendationConfidenceEngine.ts:214).
    private static func levelLabel(_ level: RecommendationConfidenceLevel) -> String {
        switch level {
        case .high: return "高"
        case .medium: return "中等"
        case .low: return "低"
        }
    }

    // MARK: - buildRecommendationConfidence (recommendationConfidenceEngine.ts:220)

    public static func buildRecommendationConfidence(_ params: Params) -> RecommendationConfidenceResult {
        let exerciseId = params.exerciseId
        let sessions = relevantSessions(params.history, exerciseId)
        let sets = relevantSets(sessions, exerciseId)
        let technique = params.techniqueQualitySummary ?? buildTechniqueSummaryFromSets(sets)
        let feedback = normalizeLoadFeedback(params.loadFeedback, sessions, exerciseId)
        let currentE1rm = resolveCurrentE1rm(params.e1rmProfile)
        let edits = countRecentEdits(params.recentEdits, Array(sessions.prefix(5)))
        // `number(pattern.severityAvg)` (recommendationConfidenceEngine.ts:238): severityAvg is
        // an already-decoded finite Double, so `number(x)` (undefined→0, x→x) is the value
        // itself. `(exerciseId && pattern.exerciseId === exerciseId)` — `exerciseId &&` requires
        // a truthy (non-empty) exerciseId before the equality check.
        let exerciseIdKey = truthy(exerciseId)
        let matchedPainPatterns = (params.painPatterns ?? []).filter { pattern in
            (exerciseIdKey != nil && pattern.exerciseId == exerciseIdKey) || pattern.severityAvg >= 3.5
        }
        // `number(effectiveSetSummary?.field)` over the Partial — each field is an
        // already-decoded finite Double? so `number(...)` collapses to `?? 0`.
        let effectiveCompleted = Swift.max(params.effectiveSetSummary?.completedSets ?? 0, Double(sets.count))
        let effectiveSets = params.effectiveSetSummary?.effectiveSets ?? 0
        let highConfidenceEffectiveSets = params.effectiveSetSummary?.highConfidenceEffectiveSets ?? 0
        let completionRate = effectiveCompleted != 0 ? effectiveSets / effectiveCompleted : 0
        let highConfidenceRate = effectiveSets != 0 ? highConfidenceEffectiveSets / effectiveSets : 0
        var reasons: [RecommendationConfidenceReason] = []
        var missingData: [String] = []
        var score = 55.0

        // History depth (recommendationConfidenceEngine.ts:249).
        if sessions.count <= 1 {
            score -= sessions.count == 0 ? 32 : 24
            reasons.append(reason("history-sparse", "训练记录不足", "lower_confidence", "同动作近期记录太少，这条推荐建议保守参考。"))
            missingData.append("继续记录同动作的重量、次数、余力（RIR）和动作质量。")
        } else if sessions.count >= 5 && sets.count >= 10 {
            score += 14
            reasons.append(reason("history-stable", "近期记录稳定", "raise_confidence", "已有 \(sessions.count) 次同动作正式记录，可用于校准推荐。"))
        } else {
            score += 2
            reasons.append(reason("history-building", "记录正在积累", "informational", "已有一些同动作记录，但样本量仍在积累中。"))
        }

        // Technique quality (recommendationConfidenceEngine.ts:261).
        if technique.totalSets <= 0 {
            score -= 12
            reasons.append(reason("technique-missing", "动作质量缺失", "lower_confidence", "缺少动作质量记录，系统无法判断推荐是否建立在稳定动作上。"))
            missingData.append("补充动作质量记录。")
        } else if technique.goodOrAcceptableRate >= 0.9 && technique.poorRate == 0 {
            score += 10
            reasons.append(reason("technique-stable", "动作质量稳定", "raise_confidence", "动作质量记录整体稳定，推荐可信度提高。"))
        } else if technique.poorRate >= 0.25 || technique.poor >= 2 {
            score -= 18
            reasons.append(reason("technique-poor", "动作质量偏低", "lower_confidence", "近期动作质量偏差较多，推荐需要保守参考。"))
        }

        // RIR completeness (recommendationConfidenceEngine.ts:273).
        if technique.totalSets <= 0 || technique.rirRecordedRate == 0 {
            score -= 14
            reasons.append(reason("rir-missing", "余力记录缺失", "lower_confidence", "缺少余力（RIR）记录，系统难以判断实际接近力竭程度。"))
            if !missingData.contains("补充余力（RIR）记录。") { missingData.append("补充余力（RIR）记录。") }
        } else if technique.rirRecordedRate >= 0.85 {
            score += 10
            reasons.append(reason("rir-complete", "余力记录完整", "raise_confidence", "余力（RIR）记录较完整，推荐可信度提高。"))
        } else if technique.rirRecordedRate < 0.5 {
            score -= 9
            reasons.append(reason("rir-incomplete", "余力记录不完整", "lower_confidence", "部分正式组缺少余力（RIR），推荐可信度下调。"))
        }

        // Pain patterns (recommendationConfidenceEngine.ts:285).
        if !matchedPainPatterns.isEmpty {
            score -= 18
            reasons.append(reason("pain-pattern", "不适记录明显", "lower_confidence", "近期不适记录与当前推荐相关，建议优先保守执行。"))
        } else if sets.count >= 4 && sets.allSatisfy({ $0.painFlag != true }) {
            score += 8
            reasons.append(reason("no-pain", "无明显不适", "raise_confidence", "近期同动作记录没有明显不适标记。"))
        }

        // Load feedback (recommendationConfidenceEngine.ts:293).
        if feedback.volatile {
            score -= 12
            reasons.append(reason("load-feedback-volatile", "重量反馈波动", "lower_confidence", "近期既有偏重也有偏轻反馈，说明推荐重量仍需校准。"))
        } else if feedback.stable {
            score += feedback.good >= Swift.max(feedback.tooHeavy, feedback.tooLight) ? 8 : 4
            reasons.append(reason("load-feedback-stable", "重量反馈稳定", "raise_confidence", "推荐重量反馈方向比较稳定。"))
        } else if feedback.total == 0 {
            missingData.append("记录推荐重量反馈。")
        }

        // Strength baseline (recommendationConfidenceEngine.ts:303).
        if let currentE1rm, !currentE1rm.isNull {
            let confidence = currentE1rm.objectValue?["confidence"]?.stringValue
            let sourceSet = currentE1rm.objectValue?["sourceSet"]?.objectValue
            let sourceTechnique = sourceSet?["techniqueQuality"]?.stringValue
            let sourcePain = sourceSet?["painFlag"]?.boolValue
            if confidence == "high" && sourceTechnique != "poor" && sourcePain != true {
                score += 10
                reasons.append(reason("e1rm-high-quality", "力量基准可靠", "raise_confidence", "当前力量估算来自较高质量记录，推荐可信度提高。"))
            } else if confidence == "low" {
                score -= 14
                reasons.append(reason("e1rm-low-confidence", "力量基准置信度低", "lower_confidence", "当前力量估算置信度偏低，推荐应保守参考。"))
            } else {
                reasons.append(reason("e1rm-medium", "力量基准可参考", "informational", "已有力量估算，但仍需要更多稳定记录提高可信度。"))
            }
        } else {
            score -= 8
            missingData.append("继续积累可用于力量估算的高质量正式组。")
        }

        // Effective sets (recommendationConfidenceEngine.ts:318).
        if completionRate >= 0.8 && highConfidenceRate >= 0.65 && effectiveCompleted >= 4 {
            score += 9
            reasons.append(reason("effective-sets-stable", "有效组稳定", "raise_confidence", "近期有效组和高置信有效组比例较稳定。"))
        } else if effectiveCompleted > 0 && (completionRate < 0.45 || highConfidenceRate < 0.35) {
            score -= 9
            reasons.append(reason("effective-sets-weak", "有效组证据偏弱", "lower_confidence", "有效组或高置信有效组不足，推荐可信度下调。"))
        }

        // Recent replacement (recommendationConfidenceEngine.ts:326).
        if hasRecentReplacement(sessions, exerciseId) {
            score -= 12
            reasons.append(reason("recent-replacement", "近期替代动作", "lower_confidence", "近期刚发生动作替代，原动作和实际执行动作的数据还需要重新稳定。"))
        }

        // Recent edits (recommendationConfidenceEngine.ts:331).
        if edits > 0 {
            score -= Swift.min(16, edits * 6)
            reasons.append(reason("recent-edits", "历史记录刚修正", "lower_confidence", "最近修正过历史记录，推荐会等待数据重新稳定。"))
        }

        // Mixed units + sparse history (recommendationConfidenceEngine.ts:336).
        if hasMixedUnitsWithSparseHistory(sets, sessions.count) {
            score -= 8
            reasons.append(reason("unit-history-sparse", "单位记录需要稳定", "lower_confidence", "近期单位显示不完全一致，且历史记录较少，建议先保守参考。"))
        }

        // Training baseline (recommendationConfidenceEngine.ts:341).
        if params.trainingLevel == "unknown" || params.trainingLevel == "beginner" {
            score -= 6
            reasons.append(reason("training-baseline", "训练基线仍在建立", "lower_confidence", "训练基线仍在建立，系统不会把推荐解释为高置信推进。"))
        }

        // Caps (recommendationConfidenceEngine.ts:346-347).
        if !matchedPainPatterns.isEmpty { score = Swift.min(score, 74) }
        if edits > 0 { score = Swift.min(score, 92) }

        let finalScore = clampScore(score)
        // `sessions.length <= 1 ? 'low' : levelFromScore(finalScore)` (ts:350).
        let level: RecommendationConfidenceLevel = sessions.count <= 1 ? .low : levelFromScore(finalScore)
        let title = "推荐可信度：\(levelLabel(level))"
        let loweringReasons = reasons.filter { $0.effect == "lower_confidence" }
        let raisingReasons = reasons.filter { $0.effect == "raise_confidence" }
        // Summary nested-ternary (recommendationConfidenceEngine.ts:354). `x[0]?.reason || fallback`
        // → first matching reason's (non-empty) text, else the fallback.
        let summary: String
        switch level {
        case .low:
            summary = "这条推荐建议保守参考。\(truthy(loweringReasons.first?.reason) ?? "当前数据还不足以支持高置信判断。")"
        case .high:
            summary = "这条推荐可信度较高。\(truthy(raisingReasons.first?.reason) ?? "近期记录比较完整稳定。")"
        case .medium:
            if !matchedPainPatterns.isEmpty || feedback.volatile || edits > 0 {
                summary = "这条推荐可信度中等，建议保守参考。\(truthy(loweringReasons.first?.reason) ?? "仍有部分记录需要继续积累。")"
            } else {
                summary = "这条推荐可信度中等。已有可参考数据，但仍有部分记录需要继续积累。"
            }
        }

        // reasons.slice(0, 8) (ts:368).
        let cappedReasons = Array(reasons.prefix(8))
        // [...new Set(missingData)].slice(0, 5) (ts:369) — dedup preserving first-seen order, cap 5.
        var seen = Set<String>()
        var dedupedMissing: [String] = []
        for item in missingData where seen.insert(item).inserted { dedupedMissing.append(item) }
        let cappedMissing = Array(dedupedMissing.prefix(5))

        return RecommendationConfidenceResult(
            level: level,
            score: finalScore,
            title: title,
            summary: summary,
            reasons: cappedReasons,
            missingData: cappedMissing
        )
    }
}
