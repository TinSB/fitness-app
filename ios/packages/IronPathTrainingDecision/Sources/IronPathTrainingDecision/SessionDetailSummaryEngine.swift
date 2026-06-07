// SessionDetailSummaryEngine — AN-4 sessionDetailSummaryEngine port (the
// sessionQuality-consumed subset).
//
// Faithful line-by-line Swift port of the TWO pure functions in
// `retired web reference` that `sessionQualityEngine.ts`
// (AN-4) CALLs:
//   - groupSessionSetsByType   (sessionDetailSummaryEngine.ts:154)
//   - buildWorkingOnlySession  (sessionDetailSummaryEngine.ts:218)
// + the private helpers they read (setTypeText / exerciseIdentity /
//   parseWarmupExerciseId / classifySet, sessionDetailSummaryEngine.ts:84/94/101/108)
// + the constants WORKING_SET_TYPES / SUPPORT_SET_TYPES (ts:81/82)
// + the grouping output types SessionSetCategory / SessionSetEntry /
//   SessionExerciseSetGroup / GroupedSessionSets (ts:9/11/21/29).
//
// OUT OF SCOPE (NOT CALLed by sessionQuality — buildSessionDetailSummary
// re-exports / display formatting): `buildSessionDetailSummary`,
// `getSessionWarmupSets` / `getSessionWorkingSets` / `getSessionSupportSets`,
// `withStrictCompletionState`, `isCompletedDisplaySet` / `completedVolume` /
// `completedCount` / `incompleteCount` / `excludedFromStatsReason` /
// `effectiveGapReasons`, the `SessionDetailSummary` type, and the
// `effectiveSetExplanationEngine` / `unitConversionEngine` / i18n cross-calls.
// None of those are referenced by `buildSessionQualityResult`.
//
// Reuses (does NOT re-port) the already-ported cross-module dependencies:
//   - effectiveSetEngine.buildEffectiveVolumeSummary → EffectiveSetEngine (AN-3)
//     is CALLed by the sessionQuality consumer, not by these two functions.
//
// PURE: consumes a single `TrainingSession` (a §11 clean input); no IO, no clock
// (zero `: Date`), no randomness. NOT wired into any UI/decision output (AN-6/AN-7).

import Foundation
import IronPathDomain

public enum SessionDetailSummaryEngine {

    // MARK: - Output types

    /// `SessionSetCategory` (sessionDetailSummaryEngine.ts:9).
    public enum SessionSetCategory: String, Equatable, Sendable {
        case warmup
        case working
        case uncategorized
    }

    /// `SessionSetEntry` (sessionDetailSummaryEngine.ts:11).
    public struct SessionSetEntry: Equatable, Sendable {
        public let exercise: ExercisePrescription
        /// `exerciseId` (ts:13): may be undefined at runtime when an exercise carries
        /// no id at all; kept optional to mirror that exactly.
        public let exerciseId: String?
        public let set: TrainingSetLog
        public let setIndex: Int
        public let category: SessionSetCategory
        public let inferred: Bool
        /// `'exercise' | 'focusWarmup'` (ts:18).
        public let source: String
    }

    /// `SessionExerciseSetGroup` (sessionDetailSummaryEngine.ts:21).
    public struct SessionExerciseSetGroup: Equatable, Sendable {
        public let exercise: ExercisePrescription
        public let exerciseId: String?
        public var warmupSets: [SessionSetEntry]
        public var workingSets: [SessionSetEntry]
        public var uncategorizedSets: [SessionSetEntry]
    }

    /// `GroupedSessionSets` (sessionDetailSummaryEngine.ts:29). `supportSets` are the
    /// raw `session.supportExerciseLogs` objects (the legacy web schema `SupportExerciseLog[]` is a
    /// plain pass-through here — the consumer reads `plannedSets`/`completedSets` off
    /// each), kept as raw JSON objects rather than a typed model.
    public struct GroupedSessionSets: Equatable, Sendable {
        public let exerciseGroups: [SessionExerciseSetGroup]
        public let warmupSets: [SessionSetEntry]
        public let workingSets: [SessionSetEntry]
        public let uncategorizedSets: [SessionSetEntry]
        public let supportSets: [JSONValue]
    }

    // MARK: - Constants (sessionDetailSummaryEngine.ts:81/82)

    /// `WORKING_SET_TYPES` (ts:81).
    private static let workingSetTypes: Set<String> = ["working", "work", "top", "backoff", "straight"]
    /// `SUPPORT_SET_TYPES` (ts:82).
    private static let supportSetTypes: Set<String> = ["support", "corrective", "correction", "functional"]

    // MARK: - JS-truthiness helpers

    /// JS truthy for an optional string (`a || b` skips empty strings).
    private static func truthy(_ value: String?) -> String? {
        guard let value, !value.isEmpty else { return nil }
        return value
    }

    /// `Boolean(value)` over a free-form JSON value (used for `set.isWarmup`).
    private static func jsTruthy(_ value: JSONValue?) -> Bool {
        guard let value else { return false }
        switch value {
        case .null: return false
        case .bool(let b): return b
        case .string(let s): return !s.isEmpty
        case .number(let n): return n.doubleValue != 0
        case .array, .object: return true
        }
    }

    // MARK: - setTypeText (sessionDetailSummaryEngine.ts:84)

    /// `setTypeText` (ts:84): `String(setType || stepType || type || '').trim().toLowerCase()`.
    /// `setType`/`stepType`/`type` ride in the open bag.
    private static func setTypeText(_ set: TrainingSetLog) -> String {
        let picked = truthy(set._unknown["setType"]?.stringValue)
            ?? truthy(set._unknown["stepType"]?.stringValue)
            ?? truthy(set._unknown["type"]?.stringValue)
            ?? ""
        return picked.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    }

    // MARK: - exerciseIdentity (sessionDetailSummaryEngine.ts:94)

    /// `exerciseIdentity` (ts:94): the 6-field identity set
    /// (`id` / `actualExerciseId` / `replacementExerciseId` / `originalExerciseId` /
    /// `baseId` / `canonicalExerciseId`), filter-Boolean, mapped to String.
    private static func exerciseIdentity(_ exercise: ExercisePrescription) -> Set<String> {
        var out = Set<String>()
        let candidates: [String?] = [
            exercise.id,
            exercise.actualExerciseId,
            exercise._unknown["replacementExerciseId"]?.stringValue,
            exercise.originalExerciseId,
            exercise._unknown["baseId"]?.stringValue,
            exercise._unknown["canonicalExerciseId"]?.stringValue,
        ]
        for c in candidates {
            if let v = truthy(c) { out.insert(v) }
        }
        return out
    }

    // MARK: - parseWarmupExerciseId (sessionDetailSummaryEngine.ts:101)

    /// `^main:([^:]+):warmup:` (ts:104) — capture group 1.
    private static let warmupIdRegex = try? NSRegularExpression(pattern: "^main:([^:]+):warmup:")

    /// `parseWarmupExerciseId` (ts:101): explicit `set.exerciseId` (trimmed) wins; else
    /// the `main:<id>:warmup:` prefix of `set.id`; else "".
    private static func parseWarmupExerciseId(_ set: TrainingSetLog) -> String {
        let explicit = (set.exerciseId ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        if !explicit.isEmpty { return explicit }
        let id = set.id ?? ""
        guard let regex = warmupIdRegex else { return "" }
        let range = NSRange(id.startIndex..., in: id)
        guard let match = regex.firstMatch(in: id, range: range), match.numberOfRanges >= 2,
              let captureRange = Range(match.range(at: 1), in: id) else { return "" }
        return String(id[captureRange])
    }

    // MARK: - classifySet (sessionDetailSummaryEngine.ts:108)

    /// `classifySet` (ts:108). `source` is `"exercise"` or `"focusWarmup"`.
    private static func classifySet(_ set: TrainingSetLog, _ source: String) -> (category: SessionSetCategory, inferred: Bool) {
        let rawType = setTypeText(set)
        if source == "focusWarmup"
            || rawType == "warmup"
            || jsTruthy(set._unknown["isWarmup"])
            || (set.id ?? "").contains(":warmup:") {
            return (.warmup, source == "exercise" && rawType != "warmup")
        }
        if workingSetTypes.contains(rawType) { return (.working, false) }
        if supportSetTypes.contains(rawType) { return (.uncategorized, false) }
        if rawType.isEmpty && source == "exercise" { return (.working, true) }
        return (.uncategorized, false)
    }

    // MARK: - open-bag mutation helpers (legacy web schema object-spread `{ ...set, type }`)

    /// Returns `obj` with `key` set to `value` (replace-or-append). The
    /// canonical-emit / read-by-key consumers are order-independent, so appending
    /// is faithful to the legacy web schema spread (which also overwrites the key in place).
    private static func setting(_ obj: OrderedJSONObject, _ key: String, _ value: JSONValue) -> OrderedJSONObject {
        var entries = obj.entries.filter { $0.key != key }
        entries.append(.init(key: key, value: value))
        return OrderedJSONObject(entries: entries)
    }

    /// `{ ...set, type }` — reconstructs the set with its open-bag `type` replaced.
    /// Operating on the full encoded JSON shape mirrors the legacy web schema object spread exactly.
    private static func withType(_ set: TrainingSetLog, _ type: String) -> TrainingSetLog {
        guard case .object(let obj) = set.encoded() else { return set }
        let updated = setting(obj, "type", .string(type))
        return (try? TrainingSetLog(decoding: .object(updated))) ?? set
    }

    /// `{ ...set, type: 'warmup', done: set.done === true }` (ts:195) — the focusWarmup
    /// reconstruction: `type` forced to warmup AND `done` collapsed to a strict boolean.
    private static func withWarmupAndStrictDone(_ set: TrainingSetLog) -> TrainingSetLog {
        guard case .object(let obj) = set.encoded() else { return set }
        var updated = setting(obj, "type", .string("warmup"))
        updated = setting(updated, "done", .bool(set.done == true))
        return (try? TrainingSetLog(decoding: .object(updated))) ?? set
    }

    // MARK: - groupSessionSetsByType (sessionDetailSummaryEngine.ts:154)

    public static func groupSessionSetsByType(_ session: TrainingSession) -> GroupedSessionSets {
        // groups = (session.exercises || []).map(...) (ts:155)
        var groups: [SessionExerciseSetGroup] = (session.exercises ?? []).map { exercise in
            SessionExerciseSetGroup(
                exercise: exercise,
                // `actualExerciseId || replacementExerciseId || id` (ts:157)
                exerciseId: truthy(exercise.actualExerciseId)
                    ?? truthy(exercise._unknown["replacementExerciseId"]?.stringValue)
                    ?? exercise.id,
                warmupSets: [],
                workingSets: [],
                uncategorizedSets: []
            )
        }

        // byIdentity map (ts:163): last group wins per id (set in array order).
        var byIdentity: [String: Int] = [:]
        for (index, group) in groups.enumerated() {
            for id in exerciseIdentity(group.exercise) { byIdentity[id] = index }
        }

        // Exercise sets (ts:168).
        for i in groups.indices {
            let exercise = groups[i].exercise
            let exerciseId = groups[i].exerciseId
            let sets = exercise.sets ?? [] // Array.isArray(group.exercise.sets) ? ... : []
            for (index, set) in sets.enumerated() {
                let classified = classifySet(set, "exercise")
                // set: classified.category === 'warmup' ? { ...set, type: 'warmup' } : set (ts:175)
                let entrySet = classified.category == .warmup ? withType(set, "warmup") : set
                let entry = SessionSetEntry(
                    exercise: exercise,
                    exerciseId: exerciseId,
                    set: entrySet,
                    setIndex: index,
                    category: classified.category,
                    inferred: classified.inferred,
                    source: "exercise"
                )
                switch entry.category {
                case .warmup: groups[i].warmupSets.append(entry)
                case .working: groups[i].workingSets.append(entry)
                case .uncategorized: groups[i].uncategorizedSets.append(entry)
                }
            }
        }

        // focusWarmupSetLogs merge (ts:187).
        let focusWarmups = session.focusWarmupSetLogs ?? [] // Array.isArray(...) ? ... : []
        for (index, set) in focusWarmups.enumerated() {
            let exerciseId = parseWarmupExerciseId(set)
            // byIdentity.get(exerciseId) || groups[0]; if (!group) return (ts:189-190)
            guard !groups.isEmpty else { continue }
            let gi = byIdentity[exerciseId] ?? 0
            // if (group.warmupSets.some((item) => item.set.id === set.id)) return (ts:191)
            if groups[gi].warmupSets.contains(where: { $0.set.id == set.id }) { continue }
            groups[gi].warmupSets.append(SessionSetEntry(
                exercise: groups[gi].exercise,
                exerciseId: groups[gi].exerciseId,
                set: withWarmupAndStrictDone(set),
                setIndex: index,
                category: .warmup,
                inferred: false,
                source: "focusWarmup"
            ))
        }

        return GroupedSessionSets(
            exerciseGroups: groups,
            warmupSets: groups.flatMap { $0.warmupSets },
            workingSets: groups.flatMap { $0.workingSets },
            uncategorizedSets: groups.flatMap { $0.uncategorizedSets },
            // Array.isArray(session.supportExerciseLogs) ? session.supportExerciseLogs : [] (ts:208)
            supportSets: session._unknown["supportExerciseLogs"]?.arrayValue ?? []
        )
    }

    // MARK: - buildWorkingOnlySession (sessionDetailSummaryEngine.ts:218)

    /// `buildWorkingOnlySession` (ts:218): a `{ ...session, dataFlag: 'normal',
    /// focusWarmupSetLogs: [], exercises: <working-only> }` clone consumed ONLY by the
    /// sessionQuality default `buildEffectiveVolumeSummary([buildWorkingOnlySession(session)])`.
    public static func buildWorkingOnlySession(_ session: TrainingSession) -> TrainingSession {
        let grouped = groupSessionSetsByType(session)
        let newExercises = grouped.exerciseGroups.map { group -> ExercisePrescription in
            // sets: group.workingSets.map((item) => ({ ...item.set, type: item.set.type || 'straight' })) (ts:226)
            let newSets = group.workingSets.map { item -> TrainingSetLog in
                let originalType = item.set._unknown["type"]?.stringValue
                let resolved = (originalType?.isEmpty == false) ? originalType! : "straight"
                return withType(item.set, resolved)
            }
            return reconstructExercise(group.exercise, sets: newSets)
        }
        return reconstructSession(session, exercises: newExercises)
    }

    /// `{ ...exercise, sets: <newSets> }` — copies every typed field + open bag, replacing
    /// the typed `sets`. A number-form `sets` (lives in `_unknown`) is dropped, matching
    /// the legacy web schema spread overwriting `sets` with the working array.
    private static func reconstructExercise(_ exercise: ExercisePrescription, sets newSets: [TrainingSetLog]) -> ExercisePrescription {
        ExercisePrescription(
            id: exercise.id,
            exerciseId: exercise.exerciseId,
            name: exercise.name,
            originalExerciseId: exercise.originalExerciseId,
            actualExerciseId: exercise.actualExerciseId,
            displayExerciseId: exercise.displayExerciseId,
            recordExerciseId: exercise.recordExerciseId,
            sets: newSets,
            warmupSets: exercise.warmupSets,
            plannedSets: exercise.plannedSets,
            prescription: exercise.prescription,
            suggestion: exercise.suggestion,
            adjustment: exercise.adjustment,
            warning: exercise.warning,
            explanations: exercise.explanations,
            _unknown: exercise._unknown.withoutKeys(["sets"])
        )
    }

    /// `{ ...session, dataFlag: 'normal', focusWarmupSetLogs: [], exercises: <newExercises> }`
    /// — copies every typed field + open bag, forcing `dataFlag` (open bag) to `'normal'`,
    /// `focusWarmupSetLogs` to empty, and `exercises` to the working-only set.
    private static func reconstructSession(_ session: TrainingSession, exercises newExercises: [ExercisePrescription]) -> TrainingSession {
        TrainingSession(
            id: session.id,
            date: session.date,
            startedAt: session.startedAt,
            finishedAt: session.finishedAt,
            durationMin: session.durationMin,
            completed: session.completed,
            earlyEndReason: session.earlyEndReason,
            restTimerState: session.restTimerState,
            currentExerciseId: session.currentExerciseId,
            currentFocusStepId: session.currentFocusStepId,
            currentSetIndex: session.currentSetIndex,
            focusSessionComplete: session.focusSessionComplete,
            focusCompletedStepIds: session.focusCompletedStepIds,
            focusActualSetDrafts: session.focusActualSetDrafts,
            focusWarmupSetLogs: [],
            exercises: newExercises,
            _unknown: setting(session._unknown, "dataFlag", .string("normal"))
        )
    }
}
