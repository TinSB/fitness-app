// AdaptiveFeedbackEngine — iOS-17e-2 performance-lookup port.
//
// Faithful line-by-line Swift port of the PURE performance-lookup functions from
// `retired web reference`:
//   - findLastPerformance      (adaptiveFeedbackEngine.ts:118)
//   - findPreviousPerformance  (adaptiveFeedbackEngine.ts:130)
//   - findRecentPerformances   (adaptiveFeedbackEngine.ts:154)
//   - buildAdaptiveState       (adaptiveFeedbackEngine.ts:169)
// + the private helpers they read (performanceValue / hasPainFlag / issuesForExercise
//   via ISSUE_FROM_PATTERN, adaptiveFeedbackEngine.ts:46/69/72/84/90/103) and the
//   `PerformanceSnapshot` type (training-model.ts:528).
//
// Reuse note (17e-1, do NOT re-port): the set helpers `completedSets` / `number` /
// `setWeightKg` are the already-ported `E1RMEngine.*` (E1RMEngine.swift:70/126/157),
// shared verbatim so `completedSets` semantics stay identical across engines.
//
// `enrichExercise` is a no-op for THIS engine's slice: every site that wraps an exercise
// in `enrichExercise(...)` before `issuesForExercise(...)` does not change the observed
// fields — `issuesForExercise` reads ONLY `String(exercise.baseId || exercise.id)` (the
// ISSUE_FROM_PATTERN `match` predicates, adaptiveFeedbackEngine.ts:48-66), and
// `enrichExercise` leaves baseId/id untouched. (PA-S2 note: `enrichExercise` /
// `buildExerciseMetadata` ARE now faithfully ported in `EngineUtils.swift` for the PA
// engine cluster; this engine still does not need them, so nothing is wired here.)
// Likewise `fallbackExercise(id)`
// (adaptiveFeedbackEngine.ts:103) only ever feeds `issuesForExercise`, so its sole
// observable property here is its `id` (= the probed exerciseId; it carries no baseId).
//
// PURE: consumes `history: [TrainingSession]` (already a §11 clean input) + the
// caller's `screening.adaptiveState?.issueScores` seed (the ONLY screening field
// `buildAdaptiveState` reads, adaptiveFeedbackEngine.ts:172). No IO, no randomness,
// `zero : Date` — legacy web schema `buildAdaptiveState` stamps `lastUpdated: new Date()…` from the
// wall clock (adaptiveFeedbackEngine.ts:224); here the date is INJECTED via `today`
// (the parity generator substitutes parityMeta.deterministicClockIso, mirroring how
// every other clocked generator injects `now`). It is NOT wired into the decision
// output here (that is 17e-5); this slice only adds the performance-lookup functions
// and parity-pins them function-by-function.

import Foundation
import IronPathDomain

public enum AdaptiveFeedbackEngine {

    // MARK: - PerformanceSnapshot (training-model.ts:528)

    /// `{ session, exercise, sets }` — the matched session, the matched exercise
    /// inside it, and that exercise's `completedSets`. Equatable so callers/tests
    /// can compare lookups item-by-item.
    public struct PerformanceSnapshot: Equatable, Sendable {
        public let session: TrainingSession
        public let exercise: ExercisePrescription
        public let sets: [TrainingSetLog]
        public init(session: TrainingSession, exercise: ExercisePrescription, sets: [TrainingSetLog]) {
            self.session = session
            self.exercise = exercise
            self.sets = sets
        }
    }

    /// `buildAdaptiveState` return shape — the `AdaptiveState` slice this function
    /// produces (training-model.ts:182). `issueScores` / `painByExercise` carry
    /// JS numbers (counts), modelled as `Double` for byte-exact parity with the
    /// generated golden. `performanceDrops` / `improvingIssues` are ORDER-SENSITIVE
    /// (they mirror JS `Set` insertion order, `[...set]`).
    public struct AdaptiveStateResult: Equatable, Sendable {
        public let issueScores: [String: Double]
        public let painByExercise: [String: Double]
        public let performanceDrops: [String]
        public let improvingIssues: [String]
        public let moduleDose: [String: String]
        public let lastUpdated: String
    }

    // MARK: - JS truthiness helpers

    /// JS truthiness for an optional id string (`a || b` skips empty strings).
    private static func truthy(_ value: String?) -> String? {
        guard let value, !value.isEmpty else { return nil }
        return value
    }

    /// `String(exercise.baseId || exercise.id || '')` — the only field
    /// `issuesForExercise` / the painByExercise + candidateIds keys read
    /// (adaptiveFeedbackEngine.ts:48-66/178/183). `baseId` lives in the open-bag.
    private static func patternKey(_ exercise: ExercisePrescription) -> String {
        if let base = truthy(exercise._unknown["baseId"]?.stringValue) { return base }
        if let id = truthy(exercise.id) { return id }
        return ""
    }

    // MARK: - ISSUE_FROM_PATTERN (adaptiveFeedbackEngine.ts:46)

    /// `ISSUE_FROM_PATTERN` — each rule's `match` is a `/(a|b|…)/i.test(key)` over
    /// alternations of LITERAL substrings (no regex metacharacters), reproduced here
    /// as a case-insensitive substring test so the match set is byte-identical to V8.
    private static let issueFromPattern: [(substrings: [String], issues: [String])] = [
        (["bench", "press", "chest-press", "fly", "close-grip"],
         ["upper_crossed", "scapular_control", "breathing_ribcage"]),
        (["shoulder-press", "landmine", "bottom-up", "waiter"],
         ["overhead_press_restriction", "scapular_control", "breathing_ribcage"]),
        (["squat", "leg-press", "hack-squat", "goblet"],
         ["ankle_mobility", "squat_lean_forward", "hip_stability", "core_control"]),
        (["deadlift", "rdl", "hinge"],
         ["lumbar_compensation", "core_control", "hip_flexor_tightness"]),
        (["row", "pulldown", "pull-up", "face-pull"],
         ["thoracic_rotation", "scapular_control"]),
    ]

    /// `issuesForExercise` (adaptiveFeedbackEngine.ts:90): filter the rules whose
    /// pattern matches, then `flatMap` their issues. NOT deduplicated — a key that
    /// matches multiple rules (e.g. "shoulder-press" hits rule 0 via "press" AND
    /// rule 1) yields repeated issues, and the buildAdaptiveState `forEach(... += n)`
    /// applies the bump once PER occurrence. Faithful behaviour, preserved here.
    private static func issuesForExercise(key: String) -> [String] {
        let lowered = key.lowercased()
        var out: [String] = []
        for rule in issueFromPattern where rule.substrings.contains(where: { lowered.contains($0) }) {
            out.append(contentsOf: rule.issues)
        }
        return out
    }

    // MARK: - painRegex (adaptiveFeedbackEngine.ts:69)

    /// `/(pain|ache|pinch|sharp|不适|刺痛|拉伤)/i.test(note)` — alternation of literal
    /// substrings; ASCII terms tested case-insensitively, CJK terms verbatim.
    private static func painRegexTest(_ note: String) -> Bool {
        let lowered = note.lowercased()
        let asciiTerms = ["pain", "ache", "pinch", "sharp"]
        let cjkTerms = ["不适", "刺痛", "拉伤"]
        if asciiTerms.contains(where: { lowered.contains($0) }) { return true }
        if cjkTerms.contains(where: { note.contains($0) }) { return true }
        return false
    }

    /// `hasPainFlag` (adaptiveFeedbackEngine.ts:84): exercise-level `painFlag`, else
    /// any set whose `painFlag` is set OR whose `note` matches `painRegex`.
    /// `exercise.painFlag` / `set.note` are open-bag fields.
    private static func hasPainFlag(_ exercise: ExercisePrescription) -> Bool {
        if exercise._unknown["painFlag"]?.boolValue == true { return true }
        guard let sets = exercise.sets else { return false } // !Array.isArray(sets)
        return sets.contains { set in
            if set.painFlag == true { return true }
            let note = set._unknown["note"]?.stringValue ?? ""
            return painRegexTest(note)
        }
    }

    // MARK: - performanceValue (adaptiveFeedbackEngine.ts:72)

    /// `setVolume` (engineUtils.ts:107): `setWeightKg(set) * number(set.reps)`.
    private static func setVolume(_ set: TrainingSetLog) -> Double {
        E1RMEngine.setWeightKg(set) * E1RMEngine.number(set.reps)
    }

    /// `performanceValue` (adaptiveFeedbackEngine.ts:72). NOTE: `topValue` uses
    /// `number(set.weight)` (the raw stored weight), NOT `setWeightKg` — only the
    /// `volume` term reads `actualWeightKg ?? weight` via `setVolume`. Preserved exactly.
    private static func performanceValue(_ performance: PerformanceSnapshot?) -> Double {
        guard let performance else { return 0 }
        let topValue = performance.sets.reduce(0.0) { best, set in
            let current = E1RMEngine.number(set.weight) * Swift.max(1, E1RMEngine.number(set.reps))
            return Swift.max(best, current)
        }
        let volume = performance.sets.reduce(0.0) { sum, set in sum + setVolume(set) }
        return Swift.max(topValue, volume * 0.1)
    }

    // MARK: - findLastPerformance (adaptiveFeedbackEngine.ts:118)

    public static func findLastPerformance(_ history: [TrainingSession], _ exerciseId: String) -> PerformanceSnapshot? {
        for session in history {
            for exercise in session.exercises ?? [] {
                if exercise._unknown["baseId"]?.stringValue != exerciseId && exercise.id != exerciseId { continue }
                let sets = E1RMEngine.completedSets(exercise)
                if !sets.isEmpty { return PerformanceSnapshot(session: session, exercise: exercise, sets: sets) }
            }
        }
        return nil
    }

    // MARK: - findPreviousPerformance (adaptiveFeedbackEngine.ts:130)

    public static func findPreviousPerformance(
        _ history: [TrainingSession],
        _ exerciseId: String,
        skipSessionId: String? = nil
    ) -> PerformanceSnapshot? {
        var skipped = (skipSessionId == nil)   // !skipSessionId

        for session in history {
            if !skipped && session.id == skipSessionId {
                skipped = true
                continue
            }
            if !skipped { continue }

            for exercise in session.exercises ?? [] {
                if exercise._unknown["baseId"]?.stringValue != exerciseId && exercise.id != exerciseId { continue }
                let sets = E1RMEngine.completedSets(exercise)
                if !sets.isEmpty { return PerformanceSnapshot(session: session, exercise: exercise, sets: sets) }
            }
        }
        return nil
    }

    // MARK: - findRecentPerformances (adaptiveFeedbackEngine.ts:154)

    public static func findRecentPerformances(
        _ history: [TrainingSession],
        _ exerciseId: String,
        limit: Int = 3
    ) -> [PerformanceSnapshot] {
        var results: [PerformanceSnapshot] = []

        for session in history {
            for exercise in session.exercises ?? [] {
                if exercise._unknown["baseId"]?.stringValue != exerciseId && exercise.id != exerciseId { continue }
                let sets = E1RMEngine.completedSets(exercise)
                if !sets.isEmpty { results.append(PerformanceSnapshot(session: session, exercise: exercise, sets: sets)) }
                if results.count >= limit { return results }
            }
        }
        return results
    }

    // MARK: - buildAdaptiveState (adaptiveFeedbackEngine.ts:169)

    /// `buildAdaptiveState(history, screening = DEFAULT_SCREENING_PROFILE)`.
    /// `seedIssueScores` is `screening.adaptiveState?.issueScores ?? {}` — the only
    /// screening field this function reads (line 172). `today` replaces the legacy web schema
    /// `new Date().toISOString().slice(0, 10)` wall-clock stamp (line 224).
    public static func buildAdaptiveState(
        _ history: [TrainingSession],
        seedIssueScores: [String: Double] = [:],
        today: String
    ) -> AdaptiveStateResult {
        let recentSessions = Array(history.prefix(8))           // history.slice(0, 8)
        var painByExercise: [String: Double] = [:]
        var issueScores: [String: Double] = seedIssueScores     // { ...(seed || {}) }
        // performanceDrops / improvingIssues mirror JS `Set` insertion order, so an
        // ordered-unique accumulator (append-if-unseen) reproduces `[...set]` exactly.
        var performanceDrops: [String] = []
        var performanceDropsSeen: Set<String> = []
        var improvingIssues: [String] = []
        var improvingIssuesSeen: Set<String> = []

        // recentSessions.forEach → painByExercise[baseId] += 1 when hasPainFlag.
        for session in recentSessions {
            for exercise in session.exercises ?? [] {
                let baseId = patternKey(exercise)
                if hasPainFlag(exercise) { painByExercise[baseId] = (painByExercise[baseId] ?? 0) + 1 }
            }
        }

        // candidateIds = new Set(recentSessions.flatMap(... baseId || id)) — ordered unique.
        var candidateIds: [String] = []
        var candidateSeen: Set<String> = []
        for session in recentSessions {
            for exercise in session.exercises ?? [] {
                let key = patternKey(exercise)
                if candidateSeen.insert(key).inserted { candidateIds.append(key) }
            }
        }

        for exerciseId in candidateIds {
            let recent = findRecentPerformances(history, exerciseId, limit: 3)
            if recent.count < 3 { continue }

            let latest = performanceValue(recent[0])
            let baseline = (performanceValue(recent[1]) + performanceValue(recent[2])) / 2
            if baseline > 0 && latest < baseline * 0.9 {
                if performanceDropsSeen.insert(exerciseId).inserted { performanceDrops.append(exerciseId) }
                for issue in issuesForExercise(key: patternKey(recent[0].exercise)) {
                    issueScores[issue] = (issueScores[issue] ?? 0) + 2
                }
            }

            if baseline > 0 && latest > baseline * 1.05 && (painByExercise[exerciseId] ?? 0) == 0 {
                for issue in issuesForExercise(key: patternKey(recent[0].exercise)) {
                    if improvingIssuesSeen.insert(issue).inserted { improvingIssues.append(issue) }
                }
            }
        }

        // Object.entries(painByExercise).forEach — iteration order does not affect the
        // resulting issueScores VALUES (each issue is bumped +3 once per qualifying
        // exercise regardless of order), so a plain dictionary walk is faithful.
        for (exerciseId, count) in painByExercise {
            if count < 2 { continue }
            let performance = findLastPerformance(history, exerciseId)
            // issuesForExercise(performance?.exercise || fallbackExercise(exerciseId)):
            // fallbackExercise carries no baseId, so its pattern key is `exerciseId`.
            let key = performance != nil ? patternKey(performance!.exercise) : exerciseId
            for issue in issuesForExercise(key: key) {
                issueScores[issue] = (issueScores[issue] ?? 0) + 3
            }
        }

        // moduleDose over issueUniverse = keys(issueScores) ∪ improvingIssues.
        var moduleDose: [String: String] = [:]
        var issueUniverse: [String] = []
        var universeSeen: Set<String> = []
        for issue in issueScores.keys where universeSeen.insert(issue).inserted { issueUniverse.append(issue) }
        for issue in improvingIssues where universeSeen.insert(issue).inserted { issueUniverse.append(issue) }
        for issue in issueUniverse {
            if (issueScores[issue] ?? 0) >= 4 { moduleDose[issue] = "boost" }
            else if improvingIssuesSeen.contains(issue) { moduleDose[issue] = "taper" }
            else { moduleDose[issue] = "baseline" }
        }

        return AdaptiveStateResult(
            issueScores: issueScores,
            painByExercise: painByExercise,
            performanceDrops: performanceDrops,
            improvingIssues: improvingIssues,
            moduleDose: moduleDose,
            lastUpdated: today
        )
    }
}
