// HistorySetEdit — DEEP-EDIT-1 Logged Set Correction V1.
//
// Pure, IO-free logic that turns a user's in-place correction of ONE logged set's
// 重量(weight kg)/ 次数(reps)/ RIR into a new CANONICAL `AppData` whose `history`
// key is rewritten — the Domain half of the FIFTH native canonical-AppData EDIT
// (after EDIT-1's profile scalar edit, EDIT-2's display-unit edit, EDIT-3's
// screening list edit, and EDIT-4's program-config scalar edit), reusing the SAME
// sanctioned edit-write boundary (§8.3). The IO half (load → defensive DataHealth
// gate → backup → atomic save → honest fail) lives in
// `IronPathPersistence.CanonicalSessionWriter.updateHistorySet`, and the DataHealth
// gate is supplied by the caller (the app layer), so this file stays a pure value
// transform with no FileManager / disk / network / clock.
//
// This edits an ENGINE INPUT, not an engine OUTPUT. A logged set
// (`TrainingSession.exercises[].sets[]` — `TrainingSetLog`) is the user's own
// recorded performance; the `TrainingDecision` engine CONSUMES it to recompute
// e1RM trend / readiness. Correcting it and letting the engine recompute is the
// EXPECTED behaviour (DEEP-EDIT review §1/§4) — exactly like editing 资料 / 筛查 /
// 计划配置 in EDIT-1~4. It NEVER touches an engine OUTPUT (the `mesocyclePlan`
// `weeks` blob, `ExercisePrescription` prescription/advice fields, or any computed
// phase / readiness / e1RM): those are computed FROM this input and are left
// verbatim.
//
// This is an EDIT, not a restore (§13/§14): it rewrites ONE set's three metric
// fields inside the user's already-canonical document in place — it never replaces
// or merges an external / backup document. It is a sanctioned MUTATION alongside
// `withUpdatedProfile` / `withUpdatedUnitSettings` / `withUpdatedScreening` /
// `withUpdatedProgramConfig` and the append helpers (§8/§9), and it preserves every
// open-bag invariant exactly like they do, at EVERY nesting level:
//   * ONLY the matched session is re-emitted; every OTHER `history` entry survives
//     as its original JSONValue verbatim. ONLY the `history` top-level key is
//     rewritten; every other top-level key and all unknown / future fields survive
//     verbatim (§9 open-bag).
//   * Inside the matched session: every OTHER exercise, every OTHER set, and each
//     level's `_unknown` open bag (session / exercise / set) survive verbatim. Only
//     the target set's `weight` / `reps` / `rir` are replaced; that set's identity
//     (`setIndex` / `exerciseId` / `id`), its `completedAt` ISO timestamp, `done`,
//     and every other field are preserved.
//   * `schemaVersion` is unchanged — an edit is not a schema change (no bump).
//   * ISO-8601 timestamps elsewhere in the document (and on the edited set itself)
//     are carried through untouched (this edit writes only the three metric values;
//     it stamps no new time).
// The canonical emitter sorts keys, so the in-place vs append position of the
// rewritten key never affects `canonicalJSONData()`.

import Foundation

extension TrainingSetLog {
    /// A copy of this logged set with ONLY the three user-correctable metric fields
    /// replaced — 重量 `weight` (kg-stored), 次数 `reps`, and `rir`. Everything else
    /// is preserved verbatim: identity (`id` / `setIndex` / `exerciseId` /
    /// `originalExerciseId` / `actualExerciseId`), the other weight columns
    /// (`actualWeightKg` / `displayWeight` / `displayUnit`), `rpe`, technique / pain
    /// columns, the `completedAt` ISO timestamp, `completionStatus`, `done`, and the
    /// `_unknown` open bag (so an unknown future set key is never dropped by an edit,
    /// §9). Pure value transform — no IO. A `nil` argument writes an honest
    /// "not entered" for that metric (the encoder omits a nil field). Mirrors
    /// `ProgramTemplate.withConfigScalars` — it only ever rewrites the editable
    /// field(s) and carries everything else (including the open bag) forward.
    public func withCorrectedMetrics(
        weight: NumberRepr?,
        reps: NumberRepr?,
        rir: JSONValue?
    ) -> TrainingSetLog {
        TrainingSetLog(
            id: id,
            setIndex: setIndex,
            exerciseId: exerciseId,
            originalExerciseId: originalExerciseId,
            actualExerciseId: actualExerciseId,
            weight: weight,
            actualWeightKg: actualWeightKg,
            displayWeight: displayWeight,
            displayUnit: displayUnit,
            reps: reps,
            rir: rir,
            rpe: rpe,
            techniqueQuality: techniqueQuality,
            painFlag: painFlag,
            painArea: painArea,
            painSeverity: painSeverity,
            completedAt: completedAt,
            completionStatus: completionStatus,
            done: done,
            _unknown: _unknown
        )
    }
}

extension ExercisePrescription {
    /// A copy of this exercise with ONLY its `sets` array replaced; every other field
    /// (identity, `warmupSets`, `plannedSets`, the engine-output `prescription` /
    /// `suggestion` / `adjustment` / `warning` / `explanations`, and the `_unknown`
    /// open bag) is preserved verbatim. Pure value transform — no IO. Mirrors
    /// `ProgramTemplate.withConfigScalars`: it carries the engine-managed advice
    /// fields forward untouched (this edit owns only the performed `sets`).
    public func withUpdatedSets(_ sets: [TrainingSetLog]?) -> ExercisePrescription {
        ExercisePrescription(
            id: id,
            exerciseId: exerciseId,
            name: name,
            originalExerciseId: originalExerciseId,
            actualExerciseId: actualExerciseId,
            displayExerciseId: displayExerciseId,
            recordExerciseId: recordExerciseId,
            sets: sets,
            warmupSets: warmupSets,
            plannedSets: plannedSets,
            prescription: prescription,
            suggestion: suggestion,
            adjustment: adjustment,
            warning: warning,
            explanations: explanations,
            _unknown: _unknown
        )
    }
}

extension TrainingSession {
    /// A copy of this session with ONLY its `exercises` array replaced; every other
    /// field (identity, the `date` / `startedAt` / `finishedAt` ISO timestamps,
    /// duration, lifecycle fields, and the `_unknown` open bag) is preserved
    /// verbatim. Pure value transform — no IO.
    public func withUpdatedExercises(_ exercises: [ExercisePrescription]?) -> TrainingSession {
        TrainingSession(
            id: id,
            date: date,
            startedAt: startedAt,
            finishedAt: finishedAt,
            durationMin: durationMin,
            completed: completed,
            earlyEndReason: earlyEndReason,
            restTimerState: restTimerState,
            currentExerciseId: currentExerciseId,
            currentFocusStepId: currentFocusStepId,
            currentSetIndex: currentSetIndex,
            focusSessionComplete: focusSessionComplete,
            focusCompletedStepIds: focusCompletedStepIds,
            focusActualSetDrafts: focusActualSetDrafts,
            focusWarmupSetLogs: focusWarmupSetLogs,
            exercises: exercises,
            _unknown: _unknown
        )
    }
}

// MARK: - Canonical AppData logged-set edit (nested open-bag preserving)

extension AppData {
    /// A new `AppData` with ONE logged set's 重量(`weightKg`)/ 次数(`reps`)/ RIR
    /// corrected in place inside `history`. Pure value transform (Swift value
    /// semantics — the receiver is untouched).
    ///
    /// The set is located by identity, matching exactly what the saved-session
    /// detail UI projects: the FIRST `history` session whose `id == sessionId`, then
    /// the FIRST exercise in it whose `id` or `exerciseId == exerciseId`, then the
    /// set whose stored `setIndex == setIndex`. If no such set exists the document is
    /// returned unchanged (a no-op the caller's DataHealth gate then sees as "the
    /// correction did not land", so nothing is persisted).
    ///
    /// `weightKg` is the kg storage value (the caller converts from the display unit
    /// first — storage is always kilograms). The three metrics are represented with
    /// the SAME `NumberRepr` / `JSONValue` shapes a fresh native capture produces
    /// (whole kg → `.integer`, fractional → `.double`; reps/rir as integer numbers),
    /// via `ActualSetDraftFactory.weightNumber`, so a corrected set round-trips
    /// byte-identically to a freshly logged one. A nil metric writes an honest
    /// "not entered" (the encoder omits it).
    ///
    /// ONLY the matched session is re-emitted and ONLY the `history` key is rewritten,
    /// in place; every other `history` entry, every other top-level key, and all
    /// unknown fields at every level are preserved verbatim (§9 open-bag invariant),
    /// and `schemaVersion` is unchanged (an edit is not a schema change). It NEVER
    /// touches an engine output — the `mesocyclePlan` weeks blob, the exercises'
    /// prescription/advice fields, and any computed phase/readiness/e1RM are left
    /// verbatim; the engine recomputes them FROM this corrected input on its next run.
    public func withUpdatedHistorySet(
        sessionId: String,
        exerciseId: String,
        setIndex: Int,
        weightKg: Double?,
        reps: Int?,
        rir: Int?
    ) -> AppData {
        guard let historyArr = root["history"]?.arrayValue else { return self }

        // Build the corrected typed metrics once, matching how a fresh native
        // capture represents them (see ActualSetDraftFactory) so the engine reads
        // the same shape it would from a freshly logged set.
        let weightRepr: NumberRepr? = weightKg.map(ActualSetDraftFactory.weightNumber)
        let repsRepr: NumberRepr? = reps.map { .integer(Int64($0)) }
        let rirValue: JSONValue? = rir.map { .number(.integer(Int64($0))) }

        var nextHistory = historyArr
        for (sessionPos, sessionValue) in historyArr.enumerated() {
            guard let session = try? TrainingSession(decoding: sessionValue),
                  session.id == sessionId,
                  var exercises = session.exercises,
                  let exercisePos = exercises.firstIndex(where: {
                      $0.id == exerciseId || $0.exerciseId == exerciseId
                  }),
                  var sets = exercises[exercisePos].sets,
                  let setPos = sets.firstIndex(where: { $0.setIndex?.intValue == setIndex })
            else { continue }

            // Rewrite ONLY the target set's three metrics, preserving every other
            // set / exercise / session field + each level's open bag.
            sets[setPos] = sets[setPos].withCorrectedMetrics(
                weight: weightRepr,
                reps: repsRepr,
                rir: rirValue
            )
            exercises[exercisePos] = exercises[exercisePos].withUpdatedSets(sets)
            nextHistory[sessionPos] = session.withUpdatedExercises(exercises).encoded()
            break   // first matching set only — the UI projection makes identity unique
        }

        // Rewrite ONLY the `history` key in place; every other top-level key + all
        // unknown fields survive verbatim, and schemaVersion is unchanged.
        var entries = root.entries
        let nextValue = JSONValue.array(nextHistory)
        if let idx = entries.firstIndex(where: { $0.key == "history" }) {
            entries[idx] = OrderedJSONObject.Entry(key: "history", value: nextValue)
        } else {
            entries.append(OrderedJSONObject.Entry(key: "history", value: nextValue))
        }
        return AppData(schemaVersion: schemaVersion, root: OrderedJSONObject(entries: entries))
    }
}
