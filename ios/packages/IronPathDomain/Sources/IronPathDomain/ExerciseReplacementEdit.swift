// ExerciseReplacementEdit — SR-4 Smart-Replacement Integration V1.
//
// Pure, IO-free logic that turns a user's "换动作" (exercise replacement) choice —
// or its restore — into a new CANONICAL `AppData` whose `history` key is rewritten:
// the Domain half of the SR-4 native canonical-AppData EDIT (after EDIT-1's profile
// scalar edit, EDIT-2's display-unit edit, EDIT-3's screening list edit, EDIT-4's
// program-config scalar edit, and DEEP-EDIT-1's logged-set correction), reusing the
// SAME sanctioned edit-write boundary (§8.3). The IO half (load → defensive
// DataHealth gate → backup → atomic save → honest fail) lives in
// `IronPathPersistence.CanonicalSessionWriter.updateExerciseReplacement`, and the
// DataHealth gate is supplied by the caller (the app layer), so this file stays a
// pure value transform with no FileManager / disk / network / clock.
//
// === what an "exercise replacement" sets — and what it must NEVER touch ===
// A history exercise (`TrainingSession.exercises[]` — `ExercisePrescription`) carries
// FOUR identity fields. SR-4 records the user's chosen ACTUAL exercise by writing the
// THREE user-override identity fields ONLY — `actualExerciseId` / `displayExerciseId`
// / `recordExerciseId` — to the replacement id (a RESTORE clears all three back to
// nil, so the record falls back to the untouched original `id` / `exerciseId`, mirror-
// ing the PWA `actualExerciseId || replacementExerciseId || originalExerciseId ||
// plannedId` resolution in `src/engines/currentExerciseSelector.ts`).
//
// It NEVER touches:
//   * `originalExerciseId` — opened by the engine/plan; it is an engine OUTPUT, not a
//     user override. SR-4 reads it for restore semantics but never writes it (writing
//     it would be overwritten on the engine's next recompute — an architecture error).
//   * the prescription BODY — `id` / `exerciseId` / `name` (so the original is still
//     locatable by the stable planned id across apply AND restore), `sets` /
//     `warmupSets` / `plannedSets`, and the engine-output `prescription` / `suggestion`
//     / `adjustment` / `warning` / `explanations`.
//   * the `mesocyclePlan` weeks blob, or any computed phase / readiness / e1RM — those
//     are engine OUTPUTS recomputed FROM the (clean) record, not edited here (§11).
//
// This is an EDIT, not a restore in the §13/§14 sense: it rewrites identity fields on
// ONE exercise inside the user's already-canonical document in place — it never
// replaces or merges an external / backup document. It is a sanctioned MUTATION
// alongside `withUpdatedProfile` / `withUpdatedUnitSettings` / `withUpdatedScreening` /
// `withUpdatedProgramConfig` / `withUpdatedHistorySet` and the append helpers (§8/§9),
// and it preserves every open-bag invariant exactly like they do, at EVERY nesting
// level:
//   * ONLY the matched session is re-emitted; every OTHER `history` entry survives as
//     its original JSONValue verbatim. ONLY the `history` top-level key is rewritten;
//     every other top-level key and all unknown / future fields survive verbatim
//     (§9 open-bag).
//   * Inside the matched session: every OTHER exercise, and each level's `_unknown`
//     open bag (session / exercise) survive verbatim. On the target exercise ONLY the
//     three user-override identity fields change; its `sets` (each with its own
//     identity + open bag), `originalExerciseId`, the prescription body, and the open
//     bag are preserved.
//   * `schemaVersion` is unchanged — an edit is not a schema change (no bump).
//   * ISO-8601 timestamps elsewhere in the document (and on the exercise's sets) are
//     carried through untouched (this edit writes only identity strings; it stamps no
//     new time).
// The canonical emitter sorts keys, so the in-place vs append position of the
// rewritten key never affects `canonicalJSONData()`.

import Foundation

extension ExercisePrescription {
    /// A copy of this exercise with ONLY the THREE user-override identity fields
    /// replaced — `actualExerciseId` / `displayExerciseId` / `recordExerciseId`.
    /// Everything else is preserved verbatim: the prescription body (`id` /
    /// `exerciseId` / `name`, `sets` / `warmupSets` / `plannedSets`, the engine-output
    /// `prescription` / `suggestion` / `adjustment` / `warning` / `explanations`), the
    /// engine-opened `originalExerciseId`, and the `_unknown` open bag (so an unknown
    /// future exercise key is never dropped by an edit, §9). Pure value transform — no
    /// IO. Mirrors `ExercisePrescription.withUpdatedSets` — it only ever rewrites the
    /// editable field(s) and carries everything else (including the open bag) forward.
    ///
    /// A `nil` argument writes an honest "cleared" for that field (the encoder omits a
    /// nil field), which is exactly how a RESTORE drops the user override so the record
    /// falls back to the untouched original identity.
    public func withReplacedIdentity(
        actualExerciseId: String?,
        displayExerciseId: String?,
        recordExerciseId: String?
    ) -> ExercisePrescription {
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

// MARK: - Canonical AppData exercise-replacement edit (nested open-bag preserving)

extension AppData {
    /// A new `AppData` with ONE history exercise's user-override identity set to a
    /// chosen replacement (`replacementExerciseId` non-nil → APPLY) or cleared
    /// (`replacementExerciseId == nil` → RESTORE) in place inside `history`. Pure value
    /// transform (Swift value semantics — the receiver is untouched).
    ///
    /// The exercise is located by identity, matching exactly what the saved-session
    /// detail UI projects (the SAME lookup `withUpdatedHistorySet` uses): the FIRST
    /// `history` session whose `id == sessionId`, then the FIRST exercise in it whose
    /// `id` or `exerciseId == exerciseId`. Because this edit NEVER touches `id` /
    /// `exerciseId`, that lookup is STABLE across an apply AND a subsequent restore —
    /// the caller always passes the original planned id. If no such exercise exists the
    /// document is returned unchanged (a no-op the caller's DataHealth gate then sees as
    /// "the replacement did not land", so nothing is persisted).
    ///
    /// APPLY sets all THREE user-override identity fields (`actualExerciseId` /
    /// `displayExerciseId` / `recordExerciseId`) to `replacementExerciseId`; RESTORE
    /// (nil) clears all three, so the record falls back to the untouched original
    /// `id` / `exerciseId` (mirroring the PWA fallback chain). It writes ONLY identity
    /// strings — never `originalExerciseId`, the prescription body, the `sets`, the
    /// `mesocyclePlan` weeks blob, or any computed phase/readiness/e1RM (§11): those are
    /// engine OUTPUTS recomputed FROM this (clean) record on the engine's next run.
    ///
    /// ONLY the matched session is re-emitted and ONLY the `history` key is rewritten,
    /// in place; every other `history` entry, every other top-level key, and all unknown
    /// fields at every level are preserved verbatim (§9 open-bag invariant), and
    /// `schemaVersion` is unchanged (an edit is not a schema change).
    public func withUpdatedExerciseReplacement(
        sessionId: String,
        exerciseId: String,
        replacementExerciseId: String?
    ) -> AppData {
        guard let historyArr = root["history"]?.arrayValue else { return self }

        var nextHistory = historyArr
        for (sessionPos, sessionValue) in historyArr.enumerated() {
            guard let session = try? TrainingSession(decoding: sessionValue),
                  session.id == sessionId,
                  var exercises = session.exercises,
                  let exercisePos = exercises.firstIndex(where: {
                      $0.id == exerciseId || $0.exerciseId == exerciseId
                  })
            else { continue }

            // Rewrite ONLY the three user-override identity fields, preserving every
            // other exercise + the prescription body / sets / originalExerciseId /
            // each level's open bag. APPLY → the replacement id; RESTORE (nil) → cleared.
            exercises[exercisePos] = exercises[exercisePos].withReplacedIdentity(
                actualExerciseId: replacementExerciseId,
                displayExerciseId: replacementExerciseId,
                recordExerciseId: replacementExerciseId
            )
            nextHistory[sessionPos] = session.withUpdatedExercises(exercises).encoded()
            break   // first matching exercise only — the UI projection makes identity unique
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
