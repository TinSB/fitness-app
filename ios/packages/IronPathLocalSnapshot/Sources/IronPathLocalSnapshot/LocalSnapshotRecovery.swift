// LocalSnapshotRecovery — iOS-15 Local History Detail + Per-Exercise Recovery
// Insight V1.
//
// Pure, IO-free PROJECTION over `LocalDraftRestorePlanner.reconcile(...)`. It
// turns a saved snapshot + the CURRENT scenario's exercise ids into a per-
// exercise, READ-ONLY "what would a continue restore?" view for the saved-
// session detail sheet. It applies NO progress and mutates NOTHING — restore
// still happens only through the existing `FocusModeMvpState.restoreDraft` path
// (which itself uses the same `reconcile`). It NEVER touches disk, AppData, the
// engine, the cloud, or any UI, and — like the rest of this package — stays
// decoupled from IronPathDomain/AppData (it consumes a snapshot + a plain
// `[String]` of current exercise ids only).
//
// iOS-15 invariant: this is restore TRANSPARENCY, not new restore semantics.
// Each row's status derives entirely from reconcile's matched/unmatched output;
// the resume cursor is reconcile's already-remapped current-order index.

import Foundation

/// Whether a saved exercise can still be restored into the current scenario.
public enum LocalRecoveryStatus: Equatable {
    /// Saved exercise still exists in the current scenario (id matched).
    case restorable
    /// Saved exercise no longer in the current scenario (renamed/removed).
    case changed
}

/// One saved exercise projected for the detail sheet (saved order preserved).
public struct LocalSnapshotRecoveryRow: Equatable {
    public let exerciseId: String
    public let name: String
    public let completedSets: Int
    public let targetSets: Int
    public let status: LocalRecoveryStatus

    public init(
        exerciseId: String,
        name: String,
        completedSets: Int,
        targetSets: Int,
        status: LocalRecoveryStatus
    ) {
        self.exerciseId = exerciseId
        self.name = name
        self.completedSets = completedSets
        self.targetSets = targetSets
        self.status = status
    }
}

/// Read-only per-exercise recovery view for one saved snapshot against the
/// current scenario. Derived entirely from `reconcile`; applies no progress.
public struct LocalSnapshotRecoveryInsight: Equatable {
    /// Saved exercises, in their ORIGINAL saved order, each tagged
    /// restorable / changed.
    public let rows: [LocalSnapshotRecoveryRow]
    /// Current exercises absent from the snapshot (new — no saved progress), in
    /// current order.
    public let newCurrentExerciseIds: [String]
    /// Resume cursor REMAPPED into the current scenario order; nil when nothing
    /// is restorable (all changed, or the snapshot can't be continued at all).
    public let resumeExerciseIndex: Int?
    /// Name of the matched saved exercise the resume cursor lands on; nil when
    /// nothing is restorable. Lets the thin UI render the resume label without
    /// re-deriving it from the snapshot.
    public let resumeExerciseName: String?
    /// Total number of current-scenario exercises (the "N / total" denominator).
    public let currentExerciseCount: Int
    /// False when this snapshot can't be continued at all (empty / impossible
    /// progress) OR no saved exercise still matches the current scenario. The UI
    /// shows an honest disabled "can't continue" state — never a fake restore.
    public let isRestorable: Bool

    /// Any saved exercise drifted away OR any new current exercise appeared.
    /// Computed so it can never disagree with `rows` / `newCurrentExerciseIds`.
    public var hasDrift: Bool {
        rows.contains { $0.status == .changed } || !newCurrentExerciseIds.isEmpty
    }

    public init(
        rows: [LocalSnapshotRecoveryRow],
        newCurrentExerciseIds: [String],
        resumeExerciseIndex: Int?,
        resumeExerciseName: String?,
        currentExerciseCount: Int,
        isRestorable: Bool
    ) {
        self.rows = rows
        self.newCurrentExerciseIds = newCurrentExerciseIds
        self.resumeExerciseIndex = resumeExerciseIndex
        self.resumeExerciseName = resumeExerciseName
        self.currentExerciseCount = currentExerciseCount
        self.isRestorable = isRestorable
    }

    /// The honest "this saved session can't be continued" insight: no rows, no
    /// resume, not restorable. Used when `reconcile` rejects the snapshot
    /// (empty / impossible progress) so the UI never previews a fake restore.
    static func nonRestorable(currentExerciseCount: Int) -> LocalSnapshotRecoveryInsight {
        LocalSnapshotRecoveryInsight(
            rows: [],
            newCurrentExerciseIds: [],
            resumeExerciseIndex: nil,
            resumeExerciseName: nil,
            currentExerciseCount: currentExerciseCount,
            isRestorable: false
        )
    }
}

public enum LocalSnapshotRecovery {

    /// Project a saved snapshot + the CURRENT scenario's exercise ids into a
    /// per-exercise recovery insight. Pure; derives entirely from
    /// `LocalDraftRestorePlanner.reconcile`; applies no progress, mutates
    /// nothing, and never touches disk/AppData/engine. If the snapshot can't be
    /// reconciled (empty / impossible progress) the result is an honest
    /// non-restorable insight — never a partial/fake preview.
    public static func insight(
        from snapshot: LocalCompletedSessionSnapshot,
        currentExerciseIds: [String]
    ) -> LocalSnapshotRecoveryInsight {
        switch LocalDraftRestorePlanner.reconcile(from: snapshot, against: currentExerciseIds) {
        case .failure:
            // Honest: an empty / impossible snapshot can't be continued.
            return .nonRestorable(currentExerciseCount: currentExerciseIds.count)

        case .success(let reconciliation):
            let matchedSet = Set(reconciliation.matchedExerciseIds)
            // Rows follow the snapshot's SAVED order; status derives from
            // reconcile (matched ⇒ restorable, otherwise changed).
            let rows: [LocalSnapshotRecoveryRow] = snapshot.exercises.map { ex in
                LocalSnapshotRecoveryRow(
                    exerciseId: ex.exerciseId,
                    name: ex.name,
                    completedSets: ex.completedSets,
                    targetSets: ex.targetSets,
                    status: matchedSet.contains(ex.exerciseId) ? .restorable : .changed
                )
            }
            // Nothing to continue when no saved exercise still exists in current.
            let isRestorable = !reconciliation.matchedExerciseIds.isEmpty
            let resumeIndex: Int? = isRestorable ? reconciliation.plan.resumeExerciseIndex : nil
            // The resume cursor lands on a matched id (reconcile guarantees it),
            // so its display name is available from the snapshot's saved rows.
            let resumeName: String? = {
                guard let resumeIndex, currentExerciseIds.indices.contains(resumeIndex) else { return nil }
                let resumeId = currentExerciseIds[resumeIndex]
                return snapshot.exercises.first(where: { $0.exerciseId == resumeId })?.name
            }()
            return LocalSnapshotRecoveryInsight(
                rows: rows,
                newCurrentExerciseIds: reconciliation.missingCurrentIds,
                resumeExerciseIndex: resumeIndex,
                resumeExerciseName: resumeName,
                currentExerciseCount: currentExerciseIds.count,
                isRestorable: isRestorable
            )
        }
    }
}
