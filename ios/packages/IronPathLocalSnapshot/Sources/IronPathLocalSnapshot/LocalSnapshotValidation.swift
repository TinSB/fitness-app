// LocalSnapshotValidation — iOS-10 Local Training Persistence Mega Bundle V1
// (Iteration 1: schema-versioned snapshot validation).
//
// Pure, IO-free validation of a decoded LocalCompletedSessionSnapshot before it
// is shown as a restored local session. iOS-9 decoded snapshots and trusted
// them; iOS-10 adds a typed validation pass so a malformed or unsupported file
// is rejected with explicit reasons instead of being silently restored.
//
// 100% pure value logic — NO FileManager, NO disk, NO network, NO cloud, NO
// AppData. This file deliberately touches nothing on disk so the iOS-8 whole-
// tree "no disk egress" boundary stays intact (only LocalSessionSnapshotStore
// is the sanctioned disk file). Pure functions also keep this unit-testable in
// a future Swift-package test target without app-test-target chaos.
//
// Validation NEVER mutates the snapshot — it only reports issues. An invalid
// file stays invalid (no fake "repair into valid").
//
// DataHealth / AppData restore boundary (iOS-10, Iteration 10):
//   A LocalCompletedSessionSnapshot is a small PRESENTATION record. Restoring it
//   only re-renders the saved preview — it is NOT a full IronPathDomain AppData
//   restore and it is NEVER fed into the TrainingDecision engine. A FUTURE full
//   AppData restore is DEFERRED and, when it lands, MUST pass through the
//   DataHealth ingress / buildCleanAppDataView clean-input contract first (the
//   same gate the live engine uses) rather than restoring raw bytes. This file
//   intentionally never imports the engine input builders.

import Foundation

/// One concrete reason a snapshot failed validation.
public enum LocalSnapshotValidationIssue: Equatable {
    case unsupportedSchemaVersion(Int)
    case emptySnapshotId
    case emptyCreatedAtIso
    case negativeSetCount
    case completedExceedsTarget
    case totalsMismatch
    case emptyExercises
    /// v2: `resumeExerciseIndex` is present but out of `[0, exercises.count)`.
    case invalidResumeIndex
}

/// Typed validation result. `.isValid` is true only when there are zero issues.
public struct LocalSnapshotValidationResult: Equatable {
    public let issues: [LocalSnapshotValidationIssue]
    public var isValid: Bool { issues.isEmpty }

    public init(issues: [LocalSnapshotValidationIssue]) { self.issues = issues }

    public static let valid = LocalSnapshotValidationResult(issues: [])
}

public enum LocalSnapshotValidator {

    /// The schema versions this build can safely restore. iOS-11 accepts v1 +
    /// v2; iOS-17A adds v3 (the per-set `setLogs` display copy). v1/v2 files
    /// migrate forward via LocalSnapshotMigration. A future bump adds versions
    /// here (and a migration step) rather than silently restoring an unknown shape.
    public static let acceptedSchemaVersions: Set<Int> = [1, 2, 3]

    /// Validate a decoded snapshot. Returns every issue found (does not stop at
    /// the first) so the UI/diagnostics can explain why a file was skipped.
    /// Pure: never mutates the snapshot, never touches disk.
    public static func validate(_ snapshot: LocalCompletedSessionSnapshot) -> LocalSnapshotValidationResult {
        var issues: [LocalSnapshotValidationIssue] = []

        // Schema version must be explicitly supported.
        if !acceptedSchemaVersions.contains(snapshot.schemaVersion) {
            issues.append(.unsupportedSchemaVersion(snapshot.schemaVersion))
        }

        // Identity / timestamp must be present.
        if snapshot.snapshotId.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            issues.append(.emptySnapshotId)
        }
        if snapshot.createdAtIso.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            issues.append(.emptyCreatedAtIso)
        }

        // No negative set counts anywhere (aggregate or per-exercise). v3: a
        // derived per-set entry with a negative weight/reps/index is corrupt too.
        let anyNegative =
            snapshot.totalCompletedSets < 0 ||
            snapshot.totalTargetSets < 0 ||
            snapshot.exercises.contains { exercise in
                exercise.completedSets < 0 || exercise.targetSets < 0 ||
                (exercise.setLogs ?? []).contains { entry in
                    entry.setIndex < 0 || (entry.weightKg ?? 0) < 0 || (entry.reps ?? 0) < 0
                }
            }
        if anyNegative {
            issues.append(.negativeSetCount)
        }

        // Completed can never exceed target (aggregate or per-exercise).
        let anyCompletedExceedsTarget =
            snapshot.totalCompletedSets > snapshot.totalTargetSets ||
            snapshot.exercises.contains { $0.completedSets > $0.targetSets }
        if anyCompletedExceedsTarget {
            issues.append(.completedExceedsTarget)
        }

        // A completed session must carry exercises.
        if snapshot.exercises.isEmpty {
            issues.append(.emptyExercises)
        } else {
            // Aggregates must equal the per-exercise sums (impossible totals).
            let sumCompleted = snapshot.exercises.reduce(0) { $0 + $1.completedSets }
            let sumTarget = snapshot.exercises.reduce(0) { $0 + $1.targetSets }
            if sumCompleted != snapshot.totalCompletedSets || sumTarget != snapshot.totalTargetSets {
                issues.append(.totalsMismatch)
            }
            // v2: if a resume cursor is present it must point at a real exercise.
            if let resume = snapshot.resumeExerciseIndex,
               resume < 0 || resume >= snapshot.exercises.count {
                issues.append(.invalidResumeIndex)
            }
        }

        return LocalSnapshotValidationResult(issues: issues)
    }

    /// Convenience boolean for call sites that only need pass/fail.
    public static func isValid(_ snapshot: LocalCompletedSessionSnapshot) -> Bool {
        validate(snapshot).isValid
    }
}
