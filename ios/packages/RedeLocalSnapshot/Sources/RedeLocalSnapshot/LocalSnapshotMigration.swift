// LocalSnapshotMigration — iOS-11 Native Local Training MVP Expansion V1.
//
// Pure, IO-free forward migration of a decoded LocalCompletedSessionSnapshot to
// the current schema version. iOS-11 introduces schema v2 (adds the optional
// `resumeExerciseIndex` resume cursor). A v1 file decodes fine (the new field is
// optional → nil); this layer upgrades it to the current schema with safe
// defaults so the rest of the app always works against one shape.
//
// 100% pure value logic — NO FileManager, NO disk, NO network, NO cloud, NO
// AppData. Forward-only: an UNKNOWN (newer-than-current) schema is NOT silently
// downgraded or mutated — it is reported as unmigratable so validation/the UI
// can skip/quarantine it honestly (no fake migration).

import Foundation

/// Result of a migration attempt. `didMigrate` is true only when the on-disk
/// version was below current and was upgraded; `originalSchemaVersion` is the
/// version as read from disk (for diagnostics / "migrated from vN" display).
struct LocalSnapshotMigrationResult: Equatable {
    let snapshot: LocalCompletedSessionSnapshot
    let originalSchemaVersion: Int
    let didMigrate: Bool
    /// True when the file's schema is NEWER than this build understands; the
    /// snapshot is returned unchanged and callers should treat it as unsupported.
    let isUnsupportedFutureVersion: Bool
}

enum LocalSnapshotMigration {

    static let currentVersion = LocalCompletedSessionSnapshot.currentSchemaVersion

    /// Lowest schema version this build can still read + migrate forward.
    static let minimumSupportedVersion = 1

    /// Migrate a decoded snapshot forward to the current schema. Pure; never
    /// touches disk. Forward-only and non-destructive.
    static func migrate(_ raw: LocalCompletedSessionSnapshot) -> LocalSnapshotMigrationResult {
        let original = raw.schemaVersion

        // A future-version file is not downgraded — report it unsupported.
        if original > currentVersion {
            return LocalSnapshotMigrationResult(
                snapshot: raw,
                originalSchemaVersion: original,
                didMigrate: false,
                isUnsupportedFutureVersion: true
            )
        }

        // A below-minimum (corrupt / pre-v1) version is NOT silently promoted to
        // a valid current snapshot — return it unchanged so validation rejects
        // its unsupported schemaVersion and the file is skipped/quarantined.
        if original < minimumSupportedVersion {
            return LocalSnapshotMigrationResult(
                snapshot: raw,
                originalSchemaVersion: original,
                didMigrate: false,
                isUnsupportedFutureVersion: false
            )
        }

        // Already current — nothing to do.
        if original == currentVersion {
            return LocalSnapshotMigrationResult(
                snapshot: raw,
                originalSchemaVersion: original,
                didMigrate: false,
                isUnsupportedFutureVersion: false
            )
        }

        // Below current (and >= minimum): upgrade forward, filling new-field
        // defaults. v1 -> v2 fills `resumeExerciseIndex` (defaults to 0).
        let upgraded = raw.upgraded(to: currentVersion)
        return LocalSnapshotMigrationResult(
            snapshot: upgraded,
            originalSchemaVersion: original,
            didMigrate: true,
            isUnsupportedFutureVersion: false
        )
    }
}
