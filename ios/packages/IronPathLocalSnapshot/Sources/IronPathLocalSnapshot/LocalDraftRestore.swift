// LocalDraftRestore — iOS-12 Native Local Restore + History + Testability Mega
// Bundle V1.
//
// Pure, IO-free planner that turns a saved LocalCompletedSessionSnapshot into a
// restore plan for an IN-RAM training draft. It preserves exercise ORDER,
// preserves per-exercise COMPLETED set counts, clamps the resume cursor into
// range, and REJECTS impossible progress — without touching disk, AppData, the
// engine, the cloud, or any UI. The app layer applies a successful plan to its
// in-memory session; a failure leaves the current session untouched (no fake
// restore). Extracted here so it carries real unit tests (swift test).

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
}
