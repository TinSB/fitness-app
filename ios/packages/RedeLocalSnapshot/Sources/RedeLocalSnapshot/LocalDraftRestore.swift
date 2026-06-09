// LocalDraftRestore — iOS-12 Native Local Restore + History + Testability Mega
// Bundle V1; iOS-13 adds exercise-id RECONCILIATION.
//
// Pure, IO-free planner that turns a saved LocalCompletedSessionSnapshot into a
// restore plan for an IN-RAM training draft. It preserves exercise ORDER,
// preserves per-exercise COMPLETED set counts, clamps the resume cursor into
// range, and REJECTS impossible progress — without touching disk, AppData, the
// engine, the cloud, or any UI. The app layer applies a successful plan to its
// in-memory session; a failure leaves the current session untouched (no fake
// restore). Extracted here so it carries real unit tests (swift test).
//
// iOS-13: `reconcile(from:against:)` compares the saved exercise ids against the
// CURRENT scenario's exercise ids and reports exactly which saved exercises
// matched, which saved ids no longer exist (renamed/removed), and which current
// exercises are new (missing from the snapshot). Completed counts are applied
// ONLY to matched ids, and the resume cursor is remapped into the CURRENT row
// order — so template drift between save and restore degrades safely and
// honestly instead of injecting stale ids into a live session.

import Foundation

/// Why a snapshot cannot be restored into a draft. Honest + explicit; the app
/// surfaces these without mutating the current in-memory session.
public enum LocalDraftRestoreError: Error, Equatable {
    case emptyExercises
    case impossibleProgress
}

/// A validated plan for rebuilding an in-RAM draft from a saved snapshot.
public struct LocalDraftRestorePlan: Equatable {
    /// Exercise ids in their ORIGINAL saved order (order preserved).
    public let orderedExerciseIds: [String]
    /// id -> completed set count (counts preserved exactly).
    public let completedSetsByExerciseId: [String: Int]
    /// Resume cursor, clamped to a valid `[0, count)` index.
    public let resumeExerciseIndex: Int

    public init(
        orderedExerciseIds: [String],
        completedSetsByExerciseId: [String: Int],
        resumeExerciseIndex: Int
    ) {
        self.orderedExerciseIds = orderedExerciseIds
        self.completedSetsByExerciseId = completedSetsByExerciseId
        self.resumeExerciseIndex = resumeExerciseIndex
    }
}

public enum LocalDraftRestorePlanner {

    /// Build a restore plan from a snapshot. Pure; never touches disk/AppData.
    /// Defense-in-depth: even though saved history is pre-validated, this
    /// independently rejects empty / impossible progress so restore can never
    /// resurrect bad data into a live session.
    public static func plan(
        from snapshot: LocalCompletedSessionSnapshot
    ) -> Result<LocalDraftRestorePlan, LocalDraftRestoreError> {
        guard !snapshot.exercises.isEmpty else {
            return .failure(.emptyExercises)
        }
        // Reject impossible progress (negative, or completed beyond target).
        for exercise in snapshot.exercises {
            if exercise.completedSets < 0 || exercise.targetSets < 0 { return .failure(.impossibleProgress) }
            if exercise.completedSets > exercise.targetSets { return .failure(.impossibleProgress) }
        }

        // Preserve order + completed counts exactly. If a (corrupt) snapshot
        // somehow repeated an exercise id, the last occurrence wins for the map
        // but the ordered list keeps every entry — neither crashes.
        var orderedIds: [String] = []
        var completedById: [String: Int] = [:]
        for exercise in snapshot.exercises {
            orderedIds.append(exercise.exerciseId)
            completedById[exercise.exerciseId] = exercise.completedSets
        }

        // Clamp the resume cursor into [0, count).
        let lastIndex = snapshot.exercises.count - 1
        let requested = snapshot.resumeExerciseIndex ?? 0
        let clamped = min(max(0, requested), lastIndex)

        return .success(
            LocalDraftRestorePlan(
                orderedExerciseIds: orderedIds,
                completedSetsByExerciseId: completedById,
                resumeExerciseIndex: clamped
            )
        )
    }

    /// Reconcile a saved snapshot against the CURRENT scenario's exercise ids and
    /// produce a plan that applies completed counts ONLY to matched exercises,
    /// reports the saved ids that no longer exist (renamed/removed) and the new
    /// current exercises (missing from the snapshot), and remaps the resume
    /// cursor into the CURRENT row order. Pure; never touches disk/AppData.
    /// Rejects empty/impossible progress exactly like `plan(from:)`.
    public static func reconcile(
        from snapshot: LocalCompletedSessionSnapshot,
        against currentExerciseIds: [String]
    ) -> Result<LocalDraftRestoreReconciliation, LocalDraftRestoreError> {
        let base: LocalDraftRestorePlan
        switch plan(from: snapshot) {
        case .failure(let error):
            return .failure(error)   // honest: empty / impossible never reconciles
        case .success(let p):
            base = p
        }

        let currentSet = Set(currentExerciseIds)
        let snapshotSet = Set(base.orderedExerciseIds)

        // Matched / unmatched saved ids, preserving the snapshot's saved order
        // (deduped). Matched = restorable; unmatched = saved exercise no longer
        // in the current scenario (renamed/removed).
        var matched: [String] = []
        var unmatched: [String] = []
        for id in base.orderedExerciseIds {
            if currentSet.contains(id) {
                if !matched.contains(id) { matched.append(id) }
            } else if !unmatched.contains(id) {
                unmatched.append(id)
            }
        }
        // New current exercises absent from the snapshot, in current order.
        let missing = currentExerciseIds.filter { !snapshotSet.contains($0) }

        // Apply completed counts ONLY to matched ids (never inject stale ids).
        let appliedCompleted = base.completedSetsByExerciseId.filter { currentSet.contains($0.key) }

        // Remap the resume cursor into CURRENT row order: prefer the saved
        // resume exercise if it still exists; else the first matched exercise;
        // else the start. Clamp into the current range.
        let wantedId: String? = snapshot.exercises.isEmpty
            ? nil
            : snapshot.exercises[min(max(0, snapshot.resumeExerciseIndex ?? 0), snapshot.exercises.count - 1)].exerciseId
        let resumeRaw: Int = {
            if let wantedId, let i = currentExerciseIds.firstIndex(of: wantedId) { return i }
            if let firstMatched = matched.first, let i = currentExerciseIds.firstIndex(of: firstMatched) { return i }
            return 0
        }()
        let resume = currentExerciseIds.isEmpty ? 0 : min(max(0, resumeRaw), currentExerciseIds.count - 1)

        let reconciledPlan = LocalDraftRestorePlan(
            orderedExerciseIds: matched,
            completedSetsByExerciseId: appliedCompleted,
            resumeExerciseIndex: resume
        )
        return .success(
            LocalDraftRestoreReconciliation(
                plan: reconciledPlan,
                matchedExerciseIds: matched,
                unmatchedSnapshotIds: unmatched,
                missingCurrentIds: missing
            )
        )
    }
}

/// Result of reconciling a saved snapshot against the current scenario. `plan`
/// applies counts only to matched exercises; the id lists report exactly what
/// drifted so the UI can warn honestly.
public struct LocalDraftRestoreReconciliation: Equatable {
    /// The applicable plan (matched ids only; resume remapped to current order).
    public let plan: LocalDraftRestorePlan
    /// Saved exercise ids that still exist in the current scenario (restored).
    public let matchedExerciseIds: [String]
    /// Saved exercise ids absent from the current scenario (renamed/removed) —
    /// reported, NOT applied.
    public let unmatchedSnapshotIds: [String]
    /// Current exercises absent from the snapshot (new) — start at 0 completed.
    public let missingCurrentIds: [String]

    public var hasDrift: Bool { !unmatchedSnapshotIds.isEmpty || !missingCurrentIds.isEmpty }

    public init(
        plan: LocalDraftRestorePlan,
        matchedExerciseIds: [String],
        unmatchedSnapshotIds: [String],
        missingCurrentIds: [String]
    ) {
        self.plan = plan
        self.matchedExerciseIds = matchedExerciseIds
        self.unmatchedSnapshotIds = unmatchedSnapshotIds
        self.missingCurrentIds = missingCurrentIds
    }
}
