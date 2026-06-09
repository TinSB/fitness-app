// NativeCompletedSession — iOS-17A Native Per-Set Logging Mega V1 (iOS-17c).
//
// Pure, IO-free logic that turns the iOS-17b in-RAM per-set capture
// (`ActualSetDraft`, kg-stored) into the CANONICAL completed-session shape that
// is appended to `AppData.history` — the source of truth (§8). This file is the
// "draft construction" half of the first native canonical-AppData write path;
// the IO half (load → gate → backup → save) lives in
// `RedePersistence.CanonicalSessionWriter`, and the DataHealth gate is
// supplied by the caller.
//
// WHY performed sets land in `exercises[].sets` (NOT `focusActualSetDrafts`):
//   `focusActualSetDrafts` is the IN-PROGRESS editing buffer. The DataHealth
//   session-lifecycle guard (DataHealthRuntimeGuard.applySessionLifecycleGuard)
//   treats a non-empty `focusActualSetDrafts` on a `completed == true` session
//   as lifecycle RESIDUE and clears it in the clean view, and
//   `SessionLifecycleResidueRepair` would strip it from disk on the next boot
//   ingest — i.e. storing performed sets there would be silently LOST on reload.
//   The permanent home for a finished session's per-set log is
//   `ExercisePrescription.sets: [TrainingSetLog]` (legacy web schema `SessionExercise.sets`),
//   which the lifecycle guard and `SetIndexRenumberRepair` (completed sessions
//   are "historical and left untouched") never mutate. So a completed session
//   written this way is STABLE through the clean view + auto-repair: no data loss.
//
// 100% pure value logic — NO FileManager, NO disk, NO network, NO cloud, NO
// clock. It USES the already-typed RedeDomain models via their public inits;
// it does NOT modify `ActualSetDraft` / `TrainingSetLog` / `TrainingSession` /
// `ExercisePrescription` / `AppData`. Weight stays kilograms end-to-end (the
// WeightUnit / UnitSettings contract: "Storage is always kilograms").

import Foundation

/// One performed exercise for the canonical record: its identity + the in-RAM
/// captured drafts (in completion order) to promote into permanent set logs.
public struct NativePerformedExercise: Equatable, Sendable {
    public let exerciseId: String
    public let name: String
    public let drafts: [ActualSetDraft]

    public init(exerciseId: String, name: String, drafts: [ActualSetDraft]) {
        self.exerciseId = exerciseId
        self.name = name
        self.drafts = drafts
    }
}

/// Pure builder: in-RAM capture drafts -> canonical completed `TrainingSession`.
public enum NativeCompletedSessionBuilder {

    /// Promote one captured `ActualSetDraft` into a permanent `TrainingSetLog`.
    /// kg is carried verbatim in `weight` (no unit coercion); `done` marks the
    /// set performed; blank capture fields stay nil (honest "not entered"). The
    /// 0-based `setIndex` falls back to the array position only when the draft
    /// did not carry one.
    public static func setLog(from draft: ActualSetDraft, fallbackIndex: Int) -> TrainingSetLog {
        TrainingSetLog(
            setIndex: draft.setIndex ?? .integer(Int64(fallbackIndex)),
            exerciseId: draft.exerciseId,
            weight: draft.weight,
            reps: draft.reps,
            rir: draft.rir,
            completedAt: draft.completedAt,
            done: true
        )
    }

    /// Build one canonical `ExercisePrescription` whose `sets` are the promoted
    /// per-set logs for this exercise. Only the identity + performed sets are
    /// recorded — no prescription/advice fields (those are engine output, not a
    /// performed record).
    public static func exercise(from performed: NativePerformedExercise) -> ExercisePrescription {
        let sets = performed.drafts.enumerated().map { index, draft in
            setLog(from: draft, fallbackIndex: index)
        }
        return ExercisePrescription(
            id: performed.exerciseId,
            exerciseId: performed.exerciseId,
            name: performed.name,
            sets: sets
        )
    }

    /// Build the canonical completed `TrainingSession` for `AppData.history`.
    /// `completed`/`focusSessionComplete` are true; the per-set logs live in
    /// `exercises[].sets`. The in-progress lifecycle fields
    /// (`focusActualSetDrafts`, `currentExerciseId`, `currentSetIndex`, …) are
    /// deliberately left unset so the DataHealth lifecycle guard sees no residue
    /// to strip (see the file header). Only exercises that have ≥1 performed set
    /// are recorded (an untouched exercise is not part of "what was performed").
    public static func completedSession(
        id: String,
        dateIso: String?,
        finishedAtIso: String,
        performed: [NativePerformedExercise]
    ) -> TrainingSession {
        let exercises = performed
            .filter { !$0.drafts.isEmpty }
            .map { exercise(from: $0) }
        return TrainingSession(
            id: id,
            date: dateIso,
            finishedAt: finishedAtIso,
            completed: true,
            focusSessionComplete: true,
            exercises: exercises
        )
    }
}

// MARK: - Canonical AppData history append (open-bag preserving)

extension AppData {
    /// A new `AppData` with `session` appended to `history`. Pure value transform
    /// (Swift value semantics — the receiver is untouched). ONLY the `history`
    /// key is rewritten, in place; every other top-level key and all unknown
    /// fields are preserved verbatim (§9 open-bag invariant), and `schemaVersion`
    /// is unchanged (append is not a schema change). The canonical emitter sorts
    /// keys, so the in-place vs append position never affects `canonicalJSONData()`.
    public func appendingHistorySession(_ session: TrainingSession) -> AppData {
        let existing = root["history"]?.arrayValue ?? []
        let nextHistory = JSONValue.array(existing + [session.encoded()])
        var entries = root.entries
        if let idx = entries.firstIndex(where: { $0.key == "history" }) {
            entries[idx] = OrderedJSONObject.Entry(key: "history", value: nextHistory)
        } else {
            entries.append(OrderedJSONObject.Entry(key: "history", value: nextHistory))
        }
        return AppData(schemaVersion: schemaVersion, root: OrderedJSONObject(entries: entries))
    }

    /// A minimal empty canonical `AppData` at the current schema version
    /// (`{"schemaVersion":N,"history":[]}`). Used as the base for the FIRST-ever
    /// native write when no on-disk file exists yet, so the first completed
    /// session has a valid, round-trippable document to be appended into.
    public static func emptyCurrent() -> AppData {
        let root = OrderedJSONObject(entries: [
            OrderedJSONObject.Entry(
                key: "schemaVersion",
                value: .number(.integer(Int64(SchemaVersion.current.rawValue)))
            ),
            OrderedJSONObject.Entry(key: "history", value: .array([])),
        ])
        return AppData(schemaVersion: .current, root: root)
    }
}
