// LocalCompletedSessionSnapshot — iOS-9 Local JSON Persistence + Saved Session
// History V1.
//
// The on-disk Codable shape of a completed Focus session. iOS-8 kept the
// completed-session summary 100% in RAM (FocusCompletedSessionSummary, cleared
// on app restart). iOS-9 introduces a SAFE, app-local JSON snapshot so the
// latest session and a small history survive relaunch — still 100% local: no
// Cloud, no HealthKit, no Supabase, no network, no auth, no UserDefaults, no
// SQLite/CoreData/SwiftData, no AppData mutation.
//
// This is a deliberately small, presentation-layer record — NOT the canonical
// IronPathDomain AppData model and NOT a raw export. It carries only the
// engine-derived context the local preview already renders plus a `source`
// marker, so a stray file can never be mistaken for real user export data.
//
// Pure value types, deterministic to encode/decode (no Date(), no IO here) so
// the store and any future test can round-trip them predictably.

import Foundation

/// Per-exercise completed/target set tally inside a saved snapshot.
struct LocalCompletedSetProgressSnapshot: Codable, Equatable {
    let completedSets: Int
    let targetSets: Int
}

/// One completed exercise line inside a saved snapshot.
struct LocalCompletedExerciseSnapshot: Codable, Equatable, Identifiable {
    let exerciseId: String
    let name: String
    let role: String
    let progress: LocalCompletedSetProgressSnapshot

    var id: String { exerciseId }
    var completedSets: Int { progress.completedSets }
    var targetSets: Int { progress.targetSets }
}

/// The full completed-session record written to app-local JSON. `snapshotId`
/// is deterministic (`focus-<seq>-<scenarioId>`); `source` marks the origin so
/// the file is never confused with a real cloud/export payload.
struct LocalCompletedSessionSnapshot: Codable, Equatable, Identifiable {
    /// Bumped whenever the on-disk shape changes; lets a future loader reject
    /// or migrate older files instead of crashing.
    static let currentSchemaVersion = 1

    let schemaVersion: Int
    let snapshotId: String
    let createdAtIso: String
    let scenarioId: String
    let scenarioLabel: String
    let sessionIntent: String
    let activePhase: String
    let deloadLevel: String
    let deloadStrategy: String
    let totalCompletedSets: Int
    let totalTargetSets: Int
    let exercises: [LocalCompletedExerciseSnapshot]
    /// Origin marker — always the local Focus MVP. Never raw export data.
    let source: String

    var id: String { snapshotId }

    static let localSourceTag = "local-ios-focus-mvp"

    init(
        snapshotId: String,
        createdAtIso: String,
        scenarioId: String,
        scenarioLabel: String,
        sessionIntent: String,
        activePhase: String,
        deloadLevel: String,
        deloadStrategy: String,
        totalCompletedSets: Int,
        totalTargetSets: Int,
        exercises: [LocalCompletedExerciseSnapshot],
        schemaVersion: Int = LocalCompletedSessionSnapshot.currentSchemaVersion,
        source: String = LocalCompletedSessionSnapshot.localSourceTag
    ) {
        self.schemaVersion = schemaVersion
        self.snapshotId = snapshotId
        self.createdAtIso = createdAtIso
        self.scenarioId = scenarioId
        self.scenarioLabel = scenarioLabel
        self.sessionIntent = sessionIntent
        self.activePhase = activePhase
        self.deloadLevel = deloadLevel
        self.deloadStrategy = deloadStrategy
        self.totalCompletedSets = totalCompletedSets
        self.totalTargetSets = totalTargetSets
        self.exercises = exercises
        self.source = source
    }
}
