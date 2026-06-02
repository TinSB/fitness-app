// E1RMEngine — iOS-17e-1 per-exercise e1RM port.
//
// Faithful line-by-line Swift port of the PURE per-exercise estimated-one-rep-max
// functions from `src/engines/e1rmEngine.ts`:
//   - getExerciseRecordPoolId      (e1rmEngine.ts:29)  — by-exercise record pool id
//   - estimateOneRepMaxForExercise (e1rmEngine.ts:166)
//   - buildE1RMProfile             (e1rmEngine.ts:171)
//   - getE1RMConfidence            (e1rmEngine.ts:137)
// + every private helper they need (roundToHalfKg / parseRir / epley / isWorkSet /
//   matchesExercise / isCurrentQualityCandidate / median / nearestCandidate /
//   buildEstimate / collectCandidates) and the cross-module dependencies they read:
//   engineUtils.number/isCompletedSet/setWeightKg/completedSets (engineUtils.ts),
//   sessionHistoryEngine.filterAnalyticsHistory/isAnalyticsSession (sessionHistoryEngine.ts),
//   sessionBackfillToleranceEngine.checkSessionBackfill (sessionBackfillToleranceEngine.ts),
//   and replacementEngine.hasInvalidExerciseIdentity (reuses the already-ported
//   `ReplacementEngine.isSyntheticReplacementExerciseId` / `.validateReplacementExerciseId`).
//
// PURE: consumes `history: [TrainingSession]` (already a §11 clean input) + an
// exerciseId; no IO, no clock (`zero : Date` — `checkSessionBackfill` parses the
// session's OWN date strings, never the current time), no randomness. It is NOT
// wired into the decision output here (that is 17e-5); this slice only adds the
// per-exercise e1RM functions and parity-pins them function-by-function.

import Foundation
import IronPathDomain

public enum E1RMEngine {

    // MARK: - Output value types (mirror EstimatedOneRepMax / E1RMProfile,
    // training-model.ts:1037 / :1054). Equatable so the parity tests can
    // compare the ported output against the generated golden item-by-item.

    /// `EstimatedOneRepMax.sourceSet` (training-model.ts:1042). Optional fields
    /// follow the TS `canonicalStringify` drop-undefined rule on the golden side.
    public struct SourceSet: Equatable, Sendable {
        public let sessionId: String
        public let date: String
        public let weightKg: Double
        public let reps: Double
        public let rir: Double?
        public let techniqueQuality: String?
        public let painFlag: Bool?
    }

    /// `EstimatedOneRepMax` (training-model.ts:1037). `formula` is always
    /// "epley" in this port (the only formula e1rmEngine.ts emits).
    public struct EstimatedOneRepMax: Equatable, Sendable {
        public let exerciseId: String
        public let e1rmKg: Double
        public let formula: String
        public let confidence: String
        public let sourceSet: SourceSet
        public let notes: [String]
    }

    /// `E1RMProfile` (training-model.ts:1054).
    public struct E1RMProfile: Equatable, Sendable {
        public let exerciseId: String
        public let current: EstimatedOneRepMax?
        public let best: EstimatedOneRepMax?
        public let recentValues: [Double]
        public let method: String?
    }

    // MARK: - Numeric helpers

    /// `Number(value)` finite-or-0 (engineUtils.ts:38 `number`). NumberRepr is
    /// always finite once decoded, so this is `?.doubleValue ?? 0` — `number(undefined)`
    /// is `NaN → 0`.
    static func number(_ value: NumberRepr?) -> Double { value?.doubleValue ?? 0 }

    /// `Number(value)` over a free-form JSON value, mirroring TS `number`
    /// (engineUtils.ts:38). Only used by `parseRir` (rir may be number or string).
    static func number(_ value: JSONValue?) -> Double {
        guard let value else { return 0 }
        switch value {
        case .number(let n): return n.doubleValue
        case .string(let s):
            let parsed = Double(s.trimmingCharacters(in: .whitespaces))
            return (parsed?.isFinite == true) ? parsed! : 0
        case .bool(let b): return b ? 1 : 0
        default: return 0
        }
    }

    /// `Math.round(value * 2) / 2` (e1rmEngine.ts:16). JS `Math.round` is
    /// `floor(x + 0.5)` (half rounds toward +∞), reproduced here so .5 boundaries
    /// match TS exactly rather than Swift's round-half-away-from-zero.
    static func roundToHalfKg(_ value: Double) -> Double {
        (value * 2 + 0.5).rounded(.down) / 2
    }

    /// `parseRir` (e1rmEngine.ts:19). undefined/null/'' → nil; else `number(value)`.
    static func parseRir(_ value: JSONValue?) -> Double? {
        guard let value else { return nil }                    // === undefined
        if case .null = value { return nil }                   // === null
        if case .string(let s) = value, s.isEmpty { return nil } // === ''
        let parsed = number(value)
        return parsed.isFinite ? parsed : nil
    }

    /// `epley` (e1rmEngine.ts:25).
    static func epley(_ weightKg: Double, _ reps: Double) -> Double {
        weightKg * (1 + reps / 30)
    }

    /// JS truthiness for an optional string id (`a || b` skips empty strings).
    private static func truthy(_ value: String?) -> String? {
        guard let value, !value.isEmpty else { return nil }
        return value
    }

    // MARK: - engineUtils set helpers (engineUtils.ts)

    /// `isLegacyCompletedSet` (engineUtils.ts:89): done undefined && completedAt non-blank.
    static func isLegacyCompletedSet(_ set: TrainingSetLog) -> Bool {
        set.done == nil && !(set.completedAt ?? "").trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    /// `isCompletedSet` (engineUtils.ts:92): done === true || isLegacyCompletedSet.
    static func isCompletedSet(_ set: TrainingSetLog) -> Bool {
        set.done == true || isLegacyCompletedSet(set)
    }

    /// `setWeightKg` (engineUtils.ts:86): `number(actualWeightKg ?? weight)`.
    static func setWeightKg(_ set: TrainingSetLog) -> Double {
        number(set.actualWeightKg ?? set.weight)
    }

    /// `isTrainingSetLog` (engineUtils.ts:67): object with weight|actualWeightKg AND reps.
    private static func isTrainingSetLog(_ set: TrainingSetLog) -> Bool {
        (set.weight != nil || set.actualWeightKg != nil) && set.reps != nil
    }

    /// `hasSyntheticReplacementId` (engineUtils.ts:70): /__(?:auto_)?alt(?:_|$)/.
    /// Shares the exact regex already ported as
    /// `ReplacementEngine.isSyntheticReplacementExerciseId` (ReplacementEngine.swift:503).
    private static func hasSyntheticReplacementId(_ id: String?) -> Bool {
        ReplacementEngine.isSyntheticReplacementExerciseId(id)
    }

    /// `hasInvalidExerciseIdentityForStats` (engineUtils.ts:72) — the STATS-local
    /// identity guard `completedSets` uses (distinct from the replacement-engine
    /// `hasInvalidExerciseIdentity` used by `getExerciseRecordPoolId`).
    private static func hasInvalidExerciseIdentityForStats(_ exercise: ExercisePrescription) -> Bool {
        if exercise._unknown["identityInvalid"]?.boolValue == true { return true }
        if truthy(exercise._unknown["legacyActualExerciseId"]?.stringValue) != nil { return true }
        if truthy(exercise._unknown["legacyReplacementExerciseId"]?.stringValue) != nil { return true }
        if truthy(exercise._unknown["legacyOriginalExerciseId"]?.stringValue) != nil { return true }
        if hasSyntheticReplacementId(exercise.id) { return true }
        if hasSyntheticReplacementId(exercise.actualExerciseId) { return true }
        if hasSyntheticReplacementId(exercise._unknown["replacementExerciseId"]?.stringValue) { return true }
        return false
    }

    /// `completedSets` (engineUtils.ts:98).
    static func completedSets(_ exercise: ExercisePrescription) -> [TrainingSetLog] {
        if hasInvalidExerciseIdentityForStats(exercise) { return [] }
        guard let sets = exercise.sets else { return [] }
        return sets.filter { set in
            isTrainingSetLog(set) && isCompletedSet(set) && setWeightKg(set) > 0 && number(set.reps) > 0
        }
    }

    // MARK: - sessionHistoryEngine analytics filter (sessionHistoryEngine.ts)

    /// `isAnalyticsSession` (sessionHistoryEngine.ts:9): dataFlag not in {test, excluded}.
    static func isAnalyticsSession(_ session: TrainingSession) -> Bool {
        let dataFlag = session._unknown["dataFlag"]?.stringValue ?? "normal"
        return dataFlag != "test" && dataFlag != "excluded"
    }

    /// `filterAnalyticsHistory` (sessionHistoryEngine.ts:18).
    static func filterAnalyticsHistory(_ history: [TrainingSession]) -> [TrainingSession] {
        history.filter { isAnalyticsSession($0) && !checkSessionBackfillIsBackfilled($0) }
    }

    // MARK: - sessionBackfillToleranceEngine (sessionBackfillToleranceEngine.ts)

    private static let backfillToleranceDays = 7 // DEFAULT_TOLERANCE_DAYS (line 16)
    private static let msPerDay: Double = 24 * 60 * 60 * 1000 // MS_PER_DAY (line 15)

    /// `safeDate` (sessionBackfillToleranceEngine.ts:18) → ms since epoch, matching
    /// JS `new Date(value).getTime()` for the two shapes the fixtures carry:
    /// a bare `YYYY-MM-DD` (parsed as UTC midnight) and a full ISO `…Z` timestamp.
    private static func safeDateMs(_ value: String?) -> Double? {
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

    /// `earliestActivity` (sessionBackfillToleranceEngine.ts:24): startedAt > finishedAt.
    private static func earliestActivityMs(_ session: TrainingSession) -> Double? {
        if let started = safeDateMs(session.startedAt) { return started }
        return safeDateMs(session.finishedAt)
    }

    /// `checkSessionBackfill(...).isBackfilled` (sessionBackfillToleranceEngine.ts:43).
    static func checkSessionBackfillIsBackfilled(_ session: TrainingSession) -> Bool {
        guard let claimedMs = safeDateMs(session.date),
              let activityMs = earliestActivityMs(session) else {
            return false // reason 'no_activity_timestamp'
        }
        let gapMs = activityMs - claimedMs
        let gapDays = (gapMs / msPerDay).rounded(.down) // Math.floor
        if gapDays <= Double(backfillToleranceDays) { return false } // 'within_tolerance'
        return true // 'beyond_tolerance'
    }

    // MARK: - replacementEngine.hasInvalidExerciseIdentity (replacementEngine.ts:141)

    /// `hasInvalidExerciseIdentity` (replacementEngine.ts:141). `isKnownExerciseId`
    /// is `validateReplacementExerciseId` (replacementEngine.ts:128), already ported.
    static func hasInvalidExerciseIdentity(_ exercise: ExercisePrescription) -> Bool {
        if exercise._unknown["identityInvalid"]?.boolValue == true { return true }
        let replacementExerciseId = exercise._unknown["replacementExerciseId"]?.stringValue
        if truthy(exercise._unknown["legacyActualExerciseId"]?.stringValue) != nil { return true }
        if truthy(exercise._unknown["legacyReplacementExerciseId"]?.stringValue) != nil { return true }
        if truthy(exercise._unknown["legacyOriginalExerciseId"]?.stringValue) != nil { return true }
        if ReplacementEngine.isSyntheticReplacementExerciseId(exercise.id) { return true }
        if ReplacementEngine.isSyntheticReplacementExerciseId(exercise.actualExerciseId) { return true }
        if ReplacementEngine.isSyntheticReplacementExerciseId(replacementExerciseId) { return true }
        if let v = truthy(exercise.actualExerciseId), !ReplacementEngine.validateReplacementExerciseId(v) { return true }
        if let v = truthy(replacementExerciseId), !ReplacementEngine.validateReplacementExerciseId(v) { return true }
        if let v = truthy(exercise.originalExerciseId), !ReplacementEngine.validateReplacementExerciseId(v) { return true }
        return false
    }

    // MARK: - getExerciseRecordPoolId (e1rmEngine.ts:29)

    /// By-exercise record pool id (e1rmEngine.ts:29). Returns "" for an invalid
    /// identity, else actual ?? replacement ?? canonical ?? (replacedFrom ? id : base ?? id).
    public static func getExerciseRecordPoolId(_ exercise: ExercisePrescription) -> String {
        if hasInvalidExerciseIdentity(exercise) { return "" }
        let id = exercise.id ?? ""
        let actual = truthy(exercise.actualExerciseId)
        let replacement = truthy(exercise._unknown["replacementExerciseId"]?.stringValue)
        let canonical = truthy(exercise._unknown["canonicalExerciseId"]?.stringValue)
        let replacedFrom = truthy(exercise._unknown["replacedFromId"]?.stringValue)
        let base = truthy(exercise._unknown["baseId"]?.stringValue)
        if let v = actual { return v }
        if let v = replacement { return v }
        if let v = canonical { return v }
        if replacedFrom != nil { return id }
        return base ?? id
    }

    // MARK: - internal source candidate (e1rmEngine.ts:6 SourceCandidate)

    private struct SourceCandidate {
        let sessionId: String
        let date: String
        let exerciseId: String
        let set: TrainingSetLog
        let e1rmKg: Double
    }

    /// `isWorkSet` (e1rmEngine.ts:27). `set.type` lives in the open-bag (`_unknown`).
    private static func isWorkSet(_ set: TrainingSetLog) -> Bool {
        let type = set._unknown["type"]?.stringValue
        return type != "warmup" && number(set.weight) > 0 && number(set.reps) > 0 && isCompletedSet(set)
    }

    /// `matchesExercise` (e1rmEngine.ts:44).
    private static func matchesExercise(_ exercise: ExercisePrescription, _ exerciseId: String) -> Bool {
        let poolId = getExerciseRecordPoolId(exercise)
        if poolId.isEmpty { return false }
        return poolId == exerciseId || exercise.id == exerciseId
    }

    /// `isCurrentQualityCandidate` (e1rmEngine.ts:50).
    private static func isCurrentQualityCandidate(_ candidate: SourceCandidate) -> Bool {
        let rir = parseRir(candidate.set.rir)
        return candidate.set.techniqueQuality != "poor"
            && candidate.set.painFlag != true
            && number(candidate.set.reps) >= 3
            && number(candidate.set.reps) <= 12
            && rir != nil
            && rir! <= 3
    }

    /// `median` (e1rmEngine.ts:62).
    private static func median(_ values: [Double]) -> Double {
        let sorted = values.sorted()
        if sorted.isEmpty { return 0 }
        let middle = sorted.count / 2
        return sorted.count % 2 == 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
    }

    /// `nearestCandidate` (e1rmEngine.ts:69). Stable sort (Swift ≥5) keeps TS tie order.
    private static func nearestCandidate(_ candidates: [SourceCandidate], _ targetValue: Double) -> SourceCandidate? {
        candidates.sorted { abs($0.e1rmKg - targetValue) < abs($1.e1rmKg - targetValue) }.first
    }

    // MARK: - getE1RMConfidence (e1rmEngine.ts:137)

    /// `getE1RMConfidence.sourceSet` arg shape (e1rmEngine.ts:138).
    public struct ConfidenceSourceSet {
        public let reps: Double
        public let rir: Double?
        public let techniqueQuality: String?
        public let painFlag: Bool?
        public init(reps: Double, rir: Double?, techniqueQuality: String?, painFlag: Bool?) {
            self.reps = reps; self.rir = rir; self.techniqueQuality = techniqueQuality; self.painFlag = painFlag
        }
    }

    /// `getE1RMConfidence.recentSets` element shape (e1rmEngine.ts:139).
    public struct ConfidenceRecentSet {
        public let weightKg: Double
        public let reps: Double
        public let rir: Double?
        public let techniqueQuality: String?
        public let painFlag: Bool?
        public init(weightKg: Double, reps: Double, rir: Double?, techniqueQuality: String?, painFlag: Bool?) {
            self.weightKg = weightKg; self.reps = reps; self.rir = rir
            self.techniqueQuality = techniqueQuality; self.painFlag = painFlag
        }
    }

    public static func getE1RMConfidence(_ sourceSet: ConfidenceSourceSet, _ recentSets: [ConfidenceRecentSet]) -> String {
        // `sourceSet.reps` / `set.weightKg` are already `number()`-ed Doubles, so
        // TS's defensive `number(...)` re-coercion is the identity here.
        var hasLow = false
        if sourceSet.techniqueQuality == "poor" { hasLow = true }
        if sourceSet.painFlag == true { hasLow = true }
        if sourceSet.reps > 12 { hasLow = true }
        if let rir = sourceSet.rir, rir >= 4 { hasLow = true }
        if hasLow { return "low" }

        let stableHighQualitySets = recentSets.filter { set in
            set.techniqueQuality != "poor"
                && set.painFlag != true
                && set.reps >= 3
                && set.reps <= 10
                && (set.rir == nil || set.rir! <= 3)
        }

        let weights = stableHighQualitySets.map { $0.weightKg }.filter { $0 != 0 }
        let spread = weights.count >= 2 ? (weights.max()! - weights.min()!) : Double.infinity

        if stableHighQualitySets.count >= 3 {
            let maxWeight = weights.isEmpty ? -Double.infinity : weights.max()!
            if spread <= Swift.max(5, maxWeight * 0.08) { return "high" }
        }
        if sourceSet.reps >= 3 && sourceSet.reps <= 12 { return "medium" }
        return "low"
    }

    // MARK: - buildEstimate (e1rmEngine.ts:72)

    private static func buildEstimate(
        _ candidate: SourceCandidate,
        _ candidatesForConfidence: [SourceCandidate],
        _ profileNote: String,
        overrideE1rmKg: Double? = nil,
        forceConfidence: String? = nil
    ) -> EstimatedOneRepMax {
        let rir = parseRir(candidate.set.rir)
        let sourceSet = SourceSet(
            sessionId: candidate.sessionId,
            date: candidate.date,
            weightKg: number(candidate.set.weight),
            reps: number(candidate.set.reps),
            rir: rir,
            techniqueQuality: candidate.set.techniqueQuality,
            painFlag: candidate.set.painFlag
        )

        let recent: [ConfidenceRecentSet] = candidatesForConfidence.prefix(5).map { item in
            ConfidenceRecentSet(
                weightKg: number(item.set.weight),
                reps: number(item.set.reps),
                rir: parseRir(item.set.rir),
                techniqueQuality: item.set.techniqueQuality,
                painFlag: item.set.painFlag
            )
        }

        var notes: [String] = [profileNote]
        if sourceSet.techniqueQuality == "poor" { notes.append("来源组动作质量较差，置信度下调。") }
        if sourceSet.painFlag == true { notes.append("来源组记录了不适，置信度下调。") }
        if let r = sourceSet.rir, r >= 4 { notes.append("来源组距离力竭较远，估算可能偏低。") }
        if sourceSet.reps > 12 { notes.append("来源组次数较高，不适合推断精确最大力量。") }
        if forceConfidence == "low" { notes.append("近期高质量记录不足，当前估算仅作低置信参考。") }

        let confidenceSource = ConfidenceSourceSet(
            reps: sourceSet.reps, rir: sourceSet.rir,
            techniqueQuality: sourceSet.techniqueQuality, painFlag: sourceSet.painFlag
        )
        return EstimatedOneRepMax(
            exerciseId: candidate.exerciseId,
            e1rmKg: roundToHalfKg(overrideE1rmKg ?? candidate.e1rmKg),
            formula: "epley",
            confidence: forceConfidence ?? getE1RMConfidence(confidenceSource, recent),
            sourceSet: sourceSet,
            notes: notes
        )
    }

    // MARK: - collectCandidates (e1rmEngine.ts:114)

    private static func collectCandidates(_ history: [TrainingSession], _ exerciseId: String) -> [SourceCandidate] {
        var out: [SourceCandidate] = []
        for session in filterAnalyticsHistory(history) {
            for exercise in session.exercises ?? [] where matchesExercise(exercise, exerciseId) {
                let poolId = getExerciseRecordPoolId(exercise)
                if poolId.isEmpty { continue }
                for set in completedSets(exercise) where isWorkSet(set) {
                    out.append(SourceCandidate(
                        sessionId: session.id ?? "",
                        date: session.date ?? "",
                        exerciseId: poolId,
                        set: set,
                        e1rmKg: roundToHalfKg(epley(number(set.weight), number(set.reps)))
                    ))
                }
            }
        }
        // `.sort((l, r) => r.date.localeCompare(l.date))` — descending date; Swift's
        // sort is stable (≥5) so same-date sets keep flatMap order, matching V8.
        return out.sorted { $0.date > $1.date }
    }

    // MARK: - estimateOneRepMaxForExercise (e1rmEngine.ts:166)

    public static func estimateOneRepMaxForExercise(_ history: [TrainingSession], _ exerciseId: String) -> EstimatedOneRepMax? {
        let profile = buildE1RMProfile(history, exerciseId)
        return profile.current ?? profile.best
    }

    // MARK: - buildE1RMProfile (e1rmEngine.ts:171)

    public static func buildE1RMProfile(_ history: [TrainingSession], _ exerciseId: String) -> E1RMProfile {
        let candidates = collectCandidates(history, exerciseId)
        let recentHighQuality = Array(candidates.prefix(5)).filter(isCurrentQualityCandidate)
        let recentValues = recentHighQuality.map { roundToHalfKg($0.e1rmKg) }
        let stableCurrentValue: Double? = recentValues.count >= 3
            ? median(recentValues)
            : (recentValues.isEmpty ? nil : recentValues.min()!)
        let currentCandidate = stableCurrentValue == nil ? nil : nearestCandidate(recentHighQuality, stableCurrentValue!)

        let bestCandidate = candidates
            .filter { buildEstimate($0, candidates, "历史最高可信估算。").confidence != "low" }
            .sorted { $0.e1rmKg > $1.e1rmKg }
            .first

        let method: String? = recentValues.count >= 3
            ? "median_recent"
            : (recentValues.isEmpty ? nil : "single_recent_low_confidence")

        let current: EstimatedOneRepMax?
        if let currentCandidate, let stableCurrentValue {
            current = buildEstimate(
                currentCandidate,
                recentHighQuality,
                recentValues.count >= 3
                    ? "训练建议使用近期稳定估算，而不是历史最高记录。"
                    : "近期高质量记录不足，本次仅作低置信参考，不输出精确训练重量。",
                overrideE1rmKg: stableCurrentValue,
                forceConfidence: recentValues.count >= 3 ? nil : "low"
            )
        } else {
            current = nil
        }

        let best: EstimatedOneRepMax?
        if let bestCandidate {
            best = buildEstimate(bestCandidate, candidates, "历史最高可信估算，仅用于进度回看。")
        } else if let first = candidates.first {
            best = buildEstimate(first, candidates, "历史记录置信度较低，仅作低置信参考。")
        } else {
            best = nil
        }

        return E1RMProfile(
            exerciseId: exerciseId,
            current: current,
            best: best,
            recentValues: recentValues,
            method: method
        )
    }
}
