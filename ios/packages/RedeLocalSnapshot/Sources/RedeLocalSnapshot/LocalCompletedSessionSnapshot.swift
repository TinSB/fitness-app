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
// RedeDomain AppData model and NOT a raw export. It carries only the
// engine-derived context the local preview already renders plus a `source`
// marker, so a stray file can never be mistaken for real user export data.
//
// Pure value types, deterministic to encode/decode (no Date(), no IO here) so
// the store and any future test can round-trip them predictably.

import Foundation

/// Per-exercise completed/target set tally inside a saved snapshot.
public struct LocalCompletedSetProgressSnapshot: Codable, Equatable {
    public let completedSets: Int
    public let targetSets: Int

    public init(completedSets: Int, targetSets: Int) {
        self.completedSets = completedSets
        self.targetSets = targetSets
    }
}

/// v3 (iOS-17A): one DERIVED per-set entry inside a saved snapshot — the display
/// copy of a canonical performed set. Weight is kilograms (the storage unit); the
/// detail view converts to the user's display unit at render time. Every metric
/// is optional because a set can be completed with fields left blank (honest "not
/// entered" — never a fabricated 0).
///
/// This is a DERIVED presentation record. The canonical performed sets live in
/// `RedeDomain.AppData.history[].exercises[].sets` (the source of truth, §8);
/// these entries are written ALONGSIDE that canonical record, derived from the
/// same in-RAM capture, and are NEVER read back as a source of truth (§12).
public struct LocalCompletedSetEntrySnapshot: Codable, Equatable {
    public let setIndex: Int
    public let weightKg: Double?
    public let reps: Int?
    public let rir: Int?

    public init(setIndex: Int, weightKg: Double? = nil, reps: Int? = nil, rir: Int? = nil) {
        self.setIndex = setIndex
        self.weightKg = weightKg
        self.reps = reps
        self.rir = rir
    }
}

/// One completed exercise line inside a saved snapshot.
public struct LocalCompletedExerciseSnapshot: Codable, Equatable, Identifiable {
    public let exerciseId: String
    public let name: String
    public let role: String
    public let progress: LocalCompletedSetProgressSnapshot
    /// v3 (iOS-17A): DERIVED per-set detail (weight kg / reps / RIR) backing the
    /// "上次成绩" per-exercise summary. Optional so v1/v2 files (which lack it)
    /// still decode — a legacy session honestly shows no per-set detail. This is a
    /// derived display copy of the canonical AppData performed sets; it is NEVER
    /// read back as a source of truth (§8/§12).
    public let setLogs: [LocalCompletedSetEntrySnapshot]?

    public var id: String { exerciseId }
    public var completedSets: Int { progress.completedSets }
    public var targetSets: Int { progress.targetSets }

    public init(
        exerciseId: String,
        name: String,
        role: String,
        progress: LocalCompletedSetProgressSnapshot,
        setLogs: [LocalCompletedSetEntrySnapshot]? = nil
    ) {
        self.exerciseId = exerciseId
        self.name = name
        self.role = role
        self.progress = progress
        self.setLogs = setLogs
    }
}

/// The full completed-session record written to app-local JSON. `snapshotId`
/// is deterministic (`focus-<seq>-<scenarioId>`); `source` marks the origin so
/// the file is never confused with a real cloud/export payload.
public struct LocalCompletedSessionSnapshot: Codable, Equatable, Identifiable {
    /// Bumped whenever the on-disk shape changes; lets a loader migrate older
    /// files forward instead of crashing.
    ///   v1 (iOS-9/10): no `resumeExerciseIndex`.
    ///   v2 (iOS-11):   adds optional `resumeExerciseIndex` (the resume cursor)
    ///                  so a saved session can be restored into an in-RAM draft
    ///                  and continued from where the user left off.
    ///   v3 (iOS-17A):  adds optional per-exercise `setLogs` (DERIVED weight kg /
    ///                  reps / RIR) for the "上次成绩" detail summary. v1/v2 files
    ///                  migrate forward with `setLogs` left nil (no per-set detail
    ///                  for legacy sessions). Derived display copy only (§8/§12).
    public static let currentSchemaVersion = 3

    public let schemaVersion: Int
    public let snapshotId: String
    public let createdAtIso: String
    public let scenarioId: String
    public let scenarioLabel: String
    public let sessionIntent: String
    public let activePhase: String
    public let deloadLevel: String
    public let deloadStrategy: String
    public let totalCompletedSets: Int
    public let totalTargetSets: Int
    public let exercises: [LocalCompletedExerciseSnapshot]
    /// Origin marker — always the local Focus MVP. Never raw export data.
    public let source: String
    /// v2: the exercise index to resume on when this session is restored into a
    /// local draft. Optional so v1 files (which lack it) still decode — they
    /// migrate to a safe default. Pure presentation/draft hint; never AppData.
    public let resumeExerciseIndex: Int?

    public var id: String { snapshotId }

    public static let localSourceTag = "local-ios-focus-mvp"

    public init(
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
