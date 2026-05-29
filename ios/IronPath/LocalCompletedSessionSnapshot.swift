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
    /// Bumped whenever the on-disk shape changes; lets a loader migrate older
    /// files forward instead of crashing.
    ///   v1 (iOS-9/10): no `resumeExerciseIndex`.
    ///   v2 (iOS-11):   adds optional `resumeExerciseIndex` (the resume cursor)
    ///                  so a saved session can be restored into an in-RAM draft
    ///                  and continued from where the user left off.
    static let currentSchemaVersion = 2

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
    /// v2: the exercise index to resume on when this session is restored into a
    /// local draft. Optional so v1 files (which lack it) still decode — they
    /// migrate to a safe default. Pure presentation/draft hint; never AppData.
    let resumeExerciseIndex: Int?

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
        resumeExerciseIndex: Int? = nil,
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
        self.resumeExerciseIndex = resumeExerciseIndex
        self.source = source
    }

    /// A copy with a bumped schema version + filled defaults — used by the
    /// migration layer. Pure value transform; never touches disk.
    func upgraded(to version: Int) -> LocalCompletedSessionSnapshot {
        LocalCompletedSessionSnapshot(
            snapshotId: snapshotId,
            createdAtIso: createdAtIso,
            scenarioId: scenarioId,
            scenarioLabel: scenarioLabel,
            sessionIntent: sessionIntent,
            activePhase: activePhase,
            deloadLevel: deloadLevel,
            deloadStrategy: deloadStrategy,
            totalCompletedSets: totalCompletedSets,
            totalTargetSets: totalTargetSets,
            exercises: exercises,
            // v1 had no resume cursor — default to the start of the session.
            resumeExerciseIndex: resumeExerciseIndex ?? 0,
            schemaVersion: version,
            source: source
        )
    }
}
