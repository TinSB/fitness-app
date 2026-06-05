// CanonicalSessionWriter — iOS-17A Native Per-Set Logging Mega V1 (iOS-17c);
// HK-1 added the body-weight import entry point on the SAME path; HK-2 added the
// workout-history import entry point on that SAME path.
//
// THE single native canonical-AppData WRITE PATH (§8). It applies new local data —
// appends, and (EDIT-1) in-place scalar edits — to canonical `AppData` and persists
// it through the sanctioned `AppDataStore` (JSON-on-disk, atomic, backup). Several
// typed entry points share ONE gated orchestration (`performGatedMutation`) — they
// are NOT separate write paths:
//   • `appendCompletedSession` — a freshly completed `TrainingSession` (built by
//     IronPathDomain.NativeCompletedSessionBuilder from the in-RAM per-set
//     capture) → `AppData.history` (iOS-17A).
//   • `appendHealthMetricSample` — one externally-imported `HealthMetricSample`
//     (an Apple Health body-weight reading, kg-stored) → `AppData.healthMetricSamples`
//     (HK-1). Idempotent by content id.
//   • `appendImportedWorkoutSample` — one externally-imported `ImportedWorkoutSample`
//     (an Apple Health workout summary — DERIVED, display-only) →
//     `AppData.importedWorkoutSamples` (HK-2). Idempotent by content id. This bag is
//     SEPARATE from `history`: an imported workout is never a canonical session and
//     never feeds the engine.
//   • `updateProfile` — an in-place EDIT of the user's `UserProfile` scalar fields
//     (EDIT-1) → `AppData.userProfile`. A sanctioned MUTATION (not an append): it
//     rewrites only the `userProfile` key, open-bag/schema/timestamp preserving.
//   • `updateUnitSettings` — an in-place EDIT of the user's display-unit preference
//     (kg/lb) (EDIT-2) → `AppData.unitSettings.displayUnit`. A sanctioned MUTATION: it
//     reads the freshly-loaded on-disk unit settings and rewrites ONLY the
//     `unitSettings` key's display preference, open-bag/schema/timestamp preserving.
//     Storage stays kilograms — only the DISPLAY preference is persisted.
//   • `updateScreening` — an in-place EDIT of the user's `ScreeningProfile` self-
//     reported lists (疼痛触发 / 受限动作 / 纠正优先) (EDIT-3) →
//     `AppData.screeningProfile`. A sanctioned MUTATION: it rewrites ONLY the
//     `screeningProfile` key, open-bag/schema/timestamp preserving; the engine-managed
//     `adaptiveState` (issue scores / performance drops) is carried through untouched.
//   • `updateProgramConfig` — an in-place EDIT of the user's `ProgramTemplate` scalar
//     config fields (主要目标 / 分项 / 每周天数) (EDIT-4) → `AppData.programTemplate`.
//     A sanctioned MUTATION: it reads the freshly-loaded on-disk program template and
//     rewrites ONLY its three user scalars, open-bag/schema/timestamp preserving; the
//     program's `id` / `userId` / the engine-managed `correctionStrategy` /
//     `functionalStrategy` strategy blobs + any unknown key are carried through
//     untouched, and the engine-managed STRUCTURED plan (`mesocyclePlan` weeks /
//     prescriptions) is never touched.
//   • `updateHistorySet` — an in-place EDIT of ONE logged set's 重量 / 次数 / RIR
//     (DEEP-EDIT-1) → `AppData.history[].exercises[].sets[]`. A sanctioned MUTATION:
//     it rewrites ONLY the matched set's three metrics inside ONLY the `history` key,
//     open-bag/schema/timestamp preserving at EVERY nesting level (every other set /
//     exercise / session survives verbatim). A logged set is an ENGINE INPUT (the
//     user's own recorded performance); the engine recomputes e1RM / readiness FROM
//     it, so this edit never touches an engine OUTPUT (the `mesocyclePlan` weeks blob,
//     prescription/advice fields, computed phase/readiness/e1RM).
//   • `updateExerciseReplacement` — an in-place EDIT of ONE history exercise's
//     user-override identity (换动作 / 复原, SR-4) → `AppData.history[].exercises[]`. A
//     sanctioned MUTATION: it rewrites ONLY the matched exercise's three user-override
//     identity fields (`actualExerciseId` / `displayExerciseId` / `recordExerciseId`)
//     inside ONLY the `history` key — APPLY sets them to the chosen replacement, RESTORE
//     clears them — open-bag/schema/timestamp preserving at EVERY nesting level (every
//     other exercise / set / session, and the target exercise's `sets` /
//     `originalExerciseId` / prescription body, survive verbatim). The user's chosen
//     actual exercise is an ENGINE INPUT; it NEVER touches an engine OUTPUT (the
//     engine-opened `originalExerciseId`, the `mesocyclePlan` weeks blob, prescription/
//     advice fields, computed phase/readiness/e1RM).
//   • `applyProgramAdjustment` — apply a Plan-Adaptive (PA) weekly adjustment by writing
//     a WHOLE new editable `ProgramTemplate` (the engine's `applyAdjustmentDraft`
//     `updatedProgramTemplate`, or `rollbackAdjustment`'s `restoredProgramTemplate`) →
//     `AppData.programTemplate` (PA-2). A sanctioned MUTATION: it rewrites ONLY the
//     `programTemplate` key via the pure open-bag `AppData.withUpdatedProgramTemplate`,
//     open-bag/schema/timestamp preserving; every other top-level key (including the
//     engine-managed `mesocyclePlan` weeks blob) survives verbatim. The program template
//     is an ENGINE INPUT (its `dayTemplates` / `weeklyMuscleTargets` / strategies); the
//     engine recomputes the plan FROM it, so this write never touches an engine OUTPUT
//     (§11). Rollback flows through this SAME entry (writing the restored snapshot) — it
//     is a sanctioned MUTATION, NOT a §14 full restore.
//   • `dismissCoachAction` — record the user's intent to dismiss ONE coach action for today
//     ("暂不处理", CC-5) → `AppData.dismissedCoachActions` (root open-bag key) +
//     `AppData.settings.dismissedCoachActions` (nested slot). A sanctioned MUTATION: it dedups
//     the current effective dismissed list (read priority `root || settings`) by
//     scope+actionId+day and double-writes the SAME `{ actionId, dismissedAt, scope }` array
//     into both, open-bag/schema/timestamp preserving. A dismiss is the user's OWN intent — an
//     ENGINE INPUT carrying only `{ actionId, dismissedAt, scope }`; it NEVER touches an engine
//     OUTPUT (the coach-action engine results, the `mesocyclePlan` weeks blob, prescriptions,
//     computed phase/readiness/e1RM). `dismissedAt` is the caller-INJECTED civil day — no clock.
//
// This is NOT a full AppData restore (§14): it appends/edits local data the user
// just performed or changed — it never replaces/merges an external/backup document.
// The repair-apply pipeline (load → snapshot → backup → apply → save) stays
// deferred; this writer only appends + saves.
//
// Boundary contract (mirrors the store guarantees, made explicit at the seam):
//   • Load existing first; a present-but-UNREADABLE document is NOT overwritten
//     (honest failure — never destroy data we cannot parse). A missing file is a
//     legitimate first install → start from `baseIfMissing` (AppData.emptyCurrent()).
//   • DataHealth gate (INJECTED as `validate`) must accept the candidate before
//     any write. The gate is supplied by the caller so this package keeps its
//     single dependency edge (Persistence → Domain) — it does not import DataHealth.
//   • Backup-before-overwrite: when a prior file exists, `store.backup()` runs
//     BEFORE `store.save()`, so the timestamped `.backup-…` copy is the rollback.
//   • Atomic write + no fake success: `store.save` is atomic; every failure THROWS
//     and nothing is reported as saved.
//
// Pure orchestration over the injected `AppDataStore` + `validate` closure — no
// FileManager here (all disk IO is the store's), no clock, no network, no cloud.

import Foundation
import IronPathDomain

/// Outcome of a successful canonical write.
public struct PerformedSessionWriteResult: Equatable, Sendable {
    /// True when no prior on-disk document existed and `baseIfMissing` seeded the
    /// first write (no backup is possible/needed on a first install).
    public let createdNewStore: Bool
    /// The backup file created before overwrite (the rollback copy), or nil on a
    /// first write where there was nothing to back up.
    public let backupURL: URL?

    public init(createdNewStore: Bool, backupURL: URL?) {
        self.createdNewStore = createdNewStore
        self.backupURL = backupURL
    }
}

/// Honest, typed failures. Each leaves the on-disk document in a safe state:
/// either untouched (load/validation/backup failed before save) or atomically
/// replaced only on a clean save.
public enum CanonicalSessionWriteError: Error, Equatable, Sendable {
    /// A file exists but could not be loaded/decoded — refuse to overwrite it.
    case existingDocumentUnreadable(String)
    /// The injected DataHealth gate rejected the candidate (would be unhealthy /
    /// stripped on reload). Nothing was written.
    case validationRejected
    /// Backup-before-overwrite failed; the prior document is intact and no new
    /// write was attempted.
    case backupFailed(String)
    /// The atomic save itself failed; the prior document (and its backup) survive.
    case saveFailed(String)
}

public struct CanonicalSessionWriter {
    private let store: AppDataStore

    public init(store: AppDataStore) {
        self.store = store
    }

    /// Append `session` to canonical `AppData.history` and persist.
    ///
    /// - Parameters:
    ///   - session: the completed session to append (built by the Domain builder).
    ///   - baseIfMissing: the document to seed when no file exists yet
    ///     (defaults to a minimal current-schema empty AppData).
    ///   - validate: the DataHealth gate. Return `false` to reject the candidate
    ///     (→ `.validationRejected`, nothing written).
    /// - Returns: what happened (first write? backup taken?).
    @discardableResult
    public func appendCompletedSession(
        _ session: TrainingSession,
        baseIfMissing: AppData = .emptyCurrent(),
        validate: (AppData) -> Bool
    ) throws -> PerformedSessionWriteResult {
        try performGatedMutation(
            baseIfMissing: baseIfMissing,
            buildCandidate: { $0.appendingHistorySession(session) },
            validate: validate
        )
    }

    /// HK-1: append one externally-imported `HealthMetricSample` (e.g. an Apple
    /// Health body-weight reading, kg-stored) to canonical
    /// `AppData.healthMetricSamples` and persist — through the SAME sanctioned,
    /// DataHealth-gated write path as `appendCompletedSession` (§8 rule 4: NOT a
    /// second/parallel write path). The candidate builder is the pure open-bag
    /// `AppData.appendingHealthMetricSample` (idempotent by content id), so a
    /// re-import of the same reading is a clean no-op that still round-trips
    /// through load → gate → save.
    ///
    /// - Parameters:
    ///   - sample: the imported sample to append (built by the pure
    ///     `IronPathHealthKit` mapper from a `BodyMassReading`).
    ///   - baseIfMissing: the document to seed when no file exists yet.
    ///   - validate: the DataHealth gate. Return `false` to reject the candidate.
    /// - Returns: what happened (first write? backup taken?).
    @discardableResult
    public func appendHealthMetricSample(
        _ sample: HealthMetricSample,
        baseIfMissing: AppData = .emptyCurrent(),
        validate: (AppData) -> Bool
    ) throws -> PerformedSessionWriteResult {
        try performGatedMutation(
            baseIfMissing: baseIfMissing,
            buildCandidate: { $0.appendingHealthMetricSample(sample) },
            validate: validate
        )
    }

    /// HK-2: append one externally-imported `ImportedWorkoutSample` (an Apple Health
    /// workout summary — DERIVED, display-only) to canonical
    /// `AppData.importedWorkoutSamples` and persist — through the SAME sanctioned,
    /// DataHealth-gated write path as `appendCompletedSession` / `appendHealthMetricSample`
    /// (§8 rule 4: NOT a second/parallel write path). The candidate builder is the
    /// pure open-bag `AppData.appendingImportedWorkoutSample` (idempotent by content
    /// id), so a re-import of the same workout is a clean no-op that still round-trips
    /// through load → gate → save.
    ///
    /// The imported workout lands in `importedWorkoutSamples`, a bag SEPARATE from
    /// `history` — it is NEVER a canonical native `TrainingSession` and NEVER feeds
    /// the engine. This entry point only changes WHERE a sanctioned append writes,
    /// not the write path itself.
    ///
    /// - Parameters:
    ///   - sample: the imported workout to append (built by the pure
    ///     `IronPathHealthKit.HealthKitWorkoutMapper` from a `WorkoutReading`).
    ///   - baseIfMissing: the document to seed when no file exists yet.
    ///   - validate: the DataHealth gate. Return `false` to reject the candidate.
    /// - Returns: what happened (first write? backup taken?).
    @discardableResult
    public func appendImportedWorkoutSample(
        _ sample: ImportedWorkoutSample,
        baseIfMissing: AppData = .emptyCurrent(),
        validate: (AppData) -> Bool
    ) throws -> PerformedSessionWriteResult {
        try performGatedMutation(
            baseIfMissing: baseIfMissing,
            buildCandidate: { $0.appendingImportedWorkoutSample(sample) },
            validate: validate
        )
    }

    /// HK-2 batch: append MANY imported workout summaries (a history list) in ONE
    /// gated write. Folds every sample through the same pure open-bag
    /// `AppData.appendingImportedWorkoutSample` (so duplicates within the batch and
    /// against the existing document both dedup by content id), then performs a
    /// single load → gate → backup → atomic save. This is the natural entry point
    /// for importing recent workout HISTORY: one backup + one save for the whole
    /// import, not one per workout — still the SAME single write path (§8 rule 4),
    /// and still the derived `importedWorkoutSamples` bag (never `history`).
    ///
    /// An empty `samples` is a no-op candidate (still round-trips through the gate),
    /// so the caller can pass whatever the read returned without a special case.
    @discardableResult
    public func appendImportedWorkoutSamples(
        _ samples: [ImportedWorkoutSample],
        baseIfMissing: AppData = .emptyCurrent(),
        validate: (AppData) -> Bool
    ) throws -> PerformedSessionWriteResult {
        try performGatedMutation(
            baseIfMissing: baseIfMissing,
            buildCandidate: { base in
                samples.reduce(base) { $0.appendingImportedWorkoutSample($1) }
            },
            validate: validate
        )
    }

    /// EDIT-1: edit the user's `UserProfile` scalar fields in place and persist —
    /// through the SAME sanctioned, DataHealth-gated write path as every append
    /// above (§8 rule 4: NOT a second/parallel write path). The candidate builder
    /// is the pure open-bag `AppData.withUpdatedProfile` (rewrites ONLY the
    /// `userProfile` key; schema/timestamp/open-bag preserving), so an edit is a
    /// sanctioned MUTATION, not a restore (§13/§14). The caller supplies the
    /// DataHealth gate (defensive `buildCleanAppDataView` re-validation before the
    /// write commits); a rejected candidate is NEVER written (no fake success).
    ///
    /// - Parameters:
    ///   - profile: the edited profile (built by the app layer from the current
    ///     canonical profile + the user's scalar edits).
    ///   - baseIfMissing: the document to seed when no file exists yet.
    ///   - validate: the DataHealth gate. Return `false` to reject the candidate.
    /// - Returns: what happened (first write? backup taken?).
    @discardableResult
    public func updateProfile(
        _ profile: UserProfile,
        baseIfMissing: AppData = .emptyCurrent(),
        validate: (AppData) -> Bool
    ) throws -> PerformedSessionWriteResult {
        try performGatedMutation(
            baseIfMissing: baseIfMissing,
            buildCandidate: { $0.withUpdatedProfile(profile) },
            validate: validate
        )
    }

    /// EDIT-2: edit the user's display-unit preference (kg/lb) in place and persist —
    /// through the SAME sanctioned, DataHealth-gated write path as every entry above
    /// (§8 rule 4: NOT a second/parallel write path). The candidate builder reads the
    /// FRESHLY-LOADED on-disk unit settings and rewrites ONLY their `displayUnit` via
    /// the pure open-bag `AppData.withUpdatedUnitSettings(_:.withDisplayUnit(_:))`, so
    /// the typed `weightUnit` and every unknown unit key survive verbatim from the
    /// on-disk truth (open-bag/schema/timestamp preserving). An edit is a sanctioned
    /// MUTATION, not a restore (§13/§14). The caller supplies the DataHealth gate
    /// (defensive `buildCleanAppDataView` re-validation before the write commits); a
    /// rejected candidate is NEVER written (no fake success).
    ///
    /// STORAGE STAYS KILOGRAMS (Contract Freeze §8): only the DISPLAY preference is
    /// persisted — no stored weight value is ever coerced kg↔lb.
    ///
    /// - Parameters:
    ///   - displayUnit: the user's chosen display unit (kg/lb).
    ///   - baseIfMissing: the document to seed when no file exists yet.
    ///   - validate: the DataHealth gate. Return `false` to reject the candidate.
    /// - Returns: what happened (first write? backup taken?).
    @discardableResult
    public func updateUnitSettings(
        displayUnit: WeightUnit,
        baseIfMissing: AppData = .emptyCurrent(),
        validate: (AppData) -> Bool
    ) throws -> PerformedSessionWriteResult {
        try performGatedMutation(
            baseIfMissing: baseIfMissing,
            buildCandidate: { $0.withUpdatedUnitSettings($0.unitSettings.withDisplayUnit(displayUnit)) },
            validate: validate
        )
    }

    /// EDIT-3: edit the user's `ScreeningProfile` self-reported lists (疼痛触发 /
    /// 受限动作 / 纠正优先) in place and persist — through the SAME sanctioned,
    /// DataHealth-gated write path as every entry above (§8 rule 4: NOT a second/parallel
    /// write path). The candidate builder is the pure open-bag
    /// `AppData.withUpdatedScreening` (rewrites ONLY the `screeningProfile` key;
    /// schema/timestamp/open-bag preserving), so an edit is a sanctioned MUTATION, not a
    /// restore (§13/§14). The engine-managed `adaptiveState` (issue scores / performance
    /// drops) is carried through untouched — the user edits only the three self-reported
    /// lists. The caller supplies the DataHealth gate (defensive `buildCleanAppDataView`
    /// re-validation before the write commits); a rejected candidate is NEVER written
    /// (no fake success).
    ///
    /// - Parameters:
    ///   - screening: the edited screening profile (built by the app layer from the
    ///     current canonical screening + the user's list edits).
    ///   - baseIfMissing: the document to seed when no file exists yet.
    ///   - validate: the DataHealth gate. Return `false` to reject the candidate.
    /// - Returns: what happened (first write? backup taken?).
    @discardableResult
    public func updateScreening(
        _ screening: ScreeningProfile,
        baseIfMissing: AppData = .emptyCurrent(),
        validate: (AppData) -> Bool
    ) throws -> PerformedSessionWriteResult {
        try performGatedMutation(
            baseIfMissing: baseIfMissing,
            buildCandidate: { $0.withUpdatedScreening(screening) },
            validate: validate
        )
    }

    /// EDIT-4: edit the user's `ProgramTemplate` scalar config fields (主要目标
    /// `primaryGoal` / 分项 `splitType` / 每周天数 `daysPerWeek`) in place and persist —
    /// through the SAME sanctioned, DataHealth-gated write path as every entry above
    /// (§8 rule 4: NOT a second/parallel write path). The candidate builder reads the
    /// FRESHLY-LOADED on-disk program template and rewrites ONLY its three user scalars
    /// via the pure open-bag `AppData.withUpdatedProgramConfig`, so the program's `id` /
    /// `userId` / the engine-managed `correctionStrategy` / `functionalStrategy` strategy
    /// blobs + any unknown program key survive verbatim from the on-disk truth
    /// (open-bag/schema/timestamp preserving). An edit is a sanctioned MUTATION, not a
    /// restore (§13/§14).
    ///
    /// The engine-managed STRUCTURED plan (the `mesocyclePlan` weeks array, exercise
    /// prescriptions, adaptive state) is NEVER touched — only the three user scalars on
    /// `programTemplate`. The caller supplies the DataHealth gate (defensive
    /// `buildCleanAppDataView` re-validation before the write commits); a rejected
    /// candidate is NEVER written (no fake success).
    ///
    /// - Parameters:
    ///   - primaryGoal: the edited 主要目标 (or nil to clear it).
    ///   - splitType: the edited 分项 (or nil to clear it).
    ///   - daysPerWeek: the edited 每周天数 (or nil to clear it).
    ///   - baseIfMissing: the document to seed when no file exists yet.
    ///   - validate: the DataHealth gate. Return `false` to reject the candidate.
    /// - Returns: what happened (first write? backup taken?).
    @discardableResult
    public func updateProgramConfig(
        primaryGoal: String?,
        splitType: String?,
        daysPerWeek: NumberRepr?,
        baseIfMissing: AppData = .emptyCurrent(),
        validate: (AppData) -> Bool
    ) throws -> PerformedSessionWriteResult {
        try performGatedMutation(
            baseIfMissing: baseIfMissing,
            buildCandidate: {
                $0.withUpdatedProgramConfig(
                    primaryGoal: primaryGoal,
                    splitType: splitType,
                    daysPerWeek: daysPerWeek
                )
            },
            validate: validate
        )
    }

    /// DEEP-EDIT-1: correct ONE logged set's 重量(weightKg)/ 次数(reps)/ RIR in place
    /// inside `AppData.history` and persist — through the SAME sanctioned,
    /// DataHealth-gated write path as every entry above (§8 rule 4: NOT a second/parallel
    /// write path). The candidate builder is the pure nested open-bag
    /// `AppData.withUpdatedHistorySet` (rewrites ONLY the matched set's three metrics
    /// inside ONLY the `history` key; every other set / exercise / session, each level's
    /// open bag, the schemaVersion, and all ISO timestamps are preserving), so an edit
    /// is a sanctioned MUTATION, not a restore (§13/§14).
    ///
    /// A logged set is an ENGINE INPUT (the user's own recorded performance); the engine
    /// recomputes e1RM / readiness FROM it — correcting it and letting the engine
    /// recompute is the EXPECTED behaviour (DEEP-EDIT review §1/§4), exactly like the
    /// scalar edits above. It NEVER touches an engine OUTPUT (the `mesocyclePlan` weeks
    /// blob, the exercises' prescription/advice fields, any computed phase/readiness/e1RM)
    /// — those are left verbatim and recomputed by the engine, not this edit. The caller
    /// supplies the DataHealth gate (defensive `buildCleanAppDataView` re-validation
    /// before the write commits); a rejected candidate is NEVER written (no fake success).
    ///
    /// STORAGE STAYS KILOGRAMS (Contract Freeze §8): `weightKg` is already the kg storage
    /// value (the app layer converts from the user's display unit first).
    ///
    /// - Parameters:
    ///   - sessionId: the `TrainingSession.id` of the session holding the set.
    ///   - exerciseId: the exercise's `id` / `exerciseId` inside that session.
    ///   - setIndex: the target set's stored `setIndex` (what the detail UI projects).
    ///   - weightKg: the corrected kg weight (or nil to clear it).
    ///   - reps: the corrected reps (or nil to clear it).
    ///   - rir: the corrected RIR (or nil to clear it).
    ///   - baseIfMissing: the document to seed when no file exists yet.
    ///   - validate: the DataHealth gate. Return `false` to reject the candidate.
    /// - Returns: what happened (first write? backup taken?).
    @discardableResult
    public func updateHistorySet(
        sessionId: String,
        exerciseId: String,
        setIndex: Int,
        weightKg: Double?,
        reps: Int?,
        rir: Int?,
        baseIfMissing: AppData = .emptyCurrent(),
        validate: (AppData) -> Bool
    ) throws -> PerformedSessionWriteResult {
        try performGatedMutation(
            baseIfMissing: baseIfMissing,
            buildCandidate: {
                $0.withUpdatedHistorySet(
                    sessionId: sessionId,
                    exerciseId: exerciseId,
                    setIndex: setIndex,
                    weightKg: weightKg,
                    reps: reps,
                    rir: rir
                )
            },
            validate: validate
        )
    }

    /// SR-4: set ONE history exercise's user-override identity to a chosen replacement
    /// ("换动作"), or clear it (复原 / RESTORE), in place inside `AppData.history` and
    /// persist — through the SAME sanctioned, DataHealth-gated write path as every entry
    /// above (§8 rule 4: NOT a second/parallel write path). The candidate builder is the
    /// pure nested open-bag `AppData.withUpdatedExerciseReplacement` (rewrites ONLY the
    /// matched exercise's three user-override identity fields — `actualExerciseId` /
    /// `displayExerciseId` / `recordExerciseId` — inside ONLY the `history` key; every
    /// other session / exercise / set, each level's open bag, the schemaVersion, and all
    /// ISO timestamps are preserving), so an edit is a sanctioned MUTATION, not a restore
    /// (§13/§14).
    ///
    /// A non-nil `replacementExerciseId` APPLIES the replacement (all three identity
    /// fields → it); nil RESTORES (clears all three, so the record falls back to the
    /// untouched original `id` / `exerciseId`). It records the user's CHOICE of actual
    /// exercise — an engine INPUT — and NEVER touches an engine OUTPUT: the engine-opened
    /// `originalExerciseId`, the exercise's prescription body / `sets`, the
    /// `mesocyclePlan` weeks blob, and any computed phase/readiness/e1RM are left verbatim
    /// and recomputed by the engine FROM the clean record, not this edit (§11). The caller
    /// supplies the DataHealth gate (defensive read-only clean-view re-validation before
    /// the write commits); a rejected candidate is NEVER written (no fake success).
    ///
    /// - Parameters:
    ///   - sessionId: the `TrainingSession.id` of the session holding the exercise.
    ///   - exerciseId: the exercise's original/planned `id` / `exerciseId` inside that
    ///     session (STABLE across apply AND restore — this edit never changes it).
    ///   - replacementExerciseId: the chosen replacement exercise id to APPLY, or nil to
    ///     RESTORE the original.
    ///   - baseIfMissing: the document to seed when no file exists yet.
    ///   - validate: the DataHealth gate. Return `false` to reject the candidate.
    /// - Returns: what happened (first write? backup taken?).
    @discardableResult
    public func updateExerciseReplacement(
        sessionId: String,
        exerciseId: String,
        replacementExerciseId: String?,
        baseIfMissing: AppData = .emptyCurrent(),
        validate: (AppData) -> Bool
    ) throws -> PerformedSessionWriteResult {
        try performGatedMutation(
            baseIfMissing: baseIfMissing,
            buildCandidate: {
                $0.withUpdatedExerciseReplacement(
                    sessionId: sessionId,
                    exerciseId: exerciseId,
                    replacementExerciseId: replacementExerciseId
                )
            },
            validate: validate
        )
    }

    /// PA-2: apply a Plan-Adaptive weekly adjustment by writing a WHOLE new editable
    /// `ProgramTemplate` into `AppData.programTemplate` and persist — through the SAME
    /// sanctioned, DataHealth-gated write path as every entry above (§8 rule 4: NOT a
    /// second/parallel write path). The candidate builder is the pure open-bag
    /// `AppData.withUpdatedProgramTemplate` (rewrites ONLY the `programTemplate` key;
    /// every other top-level key — including the engine-managed `mesocyclePlan` weeks
    /// blob — schema, and all ISO timestamps are preserving), so an apply is a sanctioned
    /// MUTATION, not a restore (§13/§14).
    ///
    /// `updatedProgramTemplate` is the PA engine's product — `applyAdjustmentDraft`'s
    /// `updatedProgramTemplate` for an APPLY, or `rollbackAdjustment`'s
    /// `restoredProgramTemplate` for a ROLLBACK; BOTH flow through this one entry, so a
    /// rollback is also a sanctioned MUTATION on this single write path, NOT a §14 full
    /// restore. The program template is an ENGINE INPUT (its `dayTemplates` /
    /// `weeklyMuscleTargets` / `correctionStrategy` / `functionalStrategy`); the engine
    /// recomputes the `mesocyclePlan` / prescriptions / phase / readiness / e1RM FROM it,
    /// so this write NEVER touches an engine OUTPUT (§11). The new template already
    /// carries any time it needs (the engine stamped it with an INJECTED clock); this
    /// writer reads no clock. The caller supplies the DataHealth gate (defensive
    /// read-only clean-view re-validation before the write commits); a rejected candidate
    /// is NEVER written (no fake success).
    ///
    /// - Parameters:
    ///   - updatedProgramTemplate: the WHOLE new editable program template to write (the
    ///     engine's applied / restored program), replacing the `programTemplate` key.
    ///   - baseIfMissing: the document to seed when no file exists yet.
    ///   - validate: the DataHealth gate. Return `false` to reject the candidate.
    /// - Returns: what happened (first write? backup taken?).
    @discardableResult
    public func applyProgramAdjustment(
        updatedProgramTemplate: ProgramTemplate,
        baseIfMissing: AppData = .emptyCurrent(),
        validate: (AppData) -> Bool
    ) throws -> PerformedSessionWriteResult {
        try performGatedMutation(
            baseIfMissing: baseIfMissing,
            buildCandidate: { $0.withUpdatedProgramTemplate(updatedProgramTemplate) },
            validate: validate
        )
    }

    /// CC-5: record the user's intent to dismiss ONE coach action for today ("暂不处理")
    /// in place inside `AppData.dismissedCoachActions` and persist — through the SAME
    /// sanctioned, DataHealth-gated write path as every entry above (§8 rule 4: NOT a
    /// second/parallel write path). The candidate builder is the pure open-bag
    /// `AppData.withDismissedCoachAction` (CoachActionDismissalEdit): it dedups the current
    /// effective dismissed list (read priority `root || settings`) by scope+actionId+day,
    /// appends `{ actionId, dismissedAt: today, scope: "today" }`, and DOUBLE-WRITES the SAME
    /// resulting array into BOTH the `dismissedCoachActions` root open-bag key AND the nested
    /// `settings.dismissedCoachActions` slot — schema/timestamp/open-bag preserving — so an
    /// edit is a sanctioned MUTATION, not a restore (§13/§14).
    ///
    /// A `DismissedCoachAction` is the user's OWN intent — it carries ONLY `{ actionId,
    /// dismissedAt, scope }` (input, NOT output). This write NEVER touches a coach-action
    /// engine result, the `mesocyclePlan` weeks blob, a prescription, or any computed
    /// phase/readiness/e1RM (§11). `today` is INJECTED by the caller (a civil calendar day) —
    /// this path reads NO clock; a bare `Date()` would be a contract break (§11.2). The caller
    /// supplies the DataHealth gate (defensive `processIncomingAppData` → its clean view
    /// re-validation before the write commits); a rejected candidate is NEVER written (no fake
    /// success).
    ///
    /// - Parameters:
    ///   - actionId: the `CoachAction.id` the user dismissed (a reference, never engine output).
    ///   - today: the civil calendar day `YYYY-MM-DD` to stamp as `dismissedAt` (injected by the
    ///     caller from its clock — this path never reads a wall clock).
    ///   - baseIfMissing: the document to seed when no file exists yet.
    ///   - validate: the DataHealth gate. Return `false` to reject the candidate.
    /// - Returns: what happened (first write? backup taken?).
    @discardableResult
    public func dismissCoachAction(
        actionId: String,
        today: String,
        baseIfMissing: AppData = .emptyCurrent(),
        validate: (AppData) -> Bool
    ) throws -> PerformedSessionWriteResult {
        try performGatedMutation(
            baseIfMissing: baseIfMissing,
            buildCandidate: { $0.withDismissedCoachAction(actionId: actionId, today: today) },
            validate: validate
        )
    }

    /// The single gated-MUTATION orchestration shared by every canonical write entry
    /// point above (append AND edit — EDIT-1/EDIT-2/EDIT-3/EDIT-4 + DEEP-EDIT-1 + SR-4 + PA-2 + CC-5 dismiss). `buildCandidate` is the only
    /// thing that varies (which open-bag transform produces the candidate); the load →
    /// gate → backup → atomic save → honest-throw contract is identical for all of
    /// them, so there is exactly ONE write path (§8.1). An EDIT is a sanctioned
    /// mutation here, NOT a second write path.
    private func performGatedMutation(
        baseIfMissing: AppData,
        buildCandidate: (AppData) -> AppData,
        validate: (AppData) -> Bool
    ) throws -> PerformedSessionWriteResult {
        // 1) Load existing, or seed the first write. A present-but-unreadable file
        //    is a hard stop — overwriting it would destroy unparseable user data.
        let existing: AppData
        let createdNew: Bool
        if store.hasExistingFile {
            do {
                existing = try store.load()
                createdNew = false
            } catch {
                throw CanonicalSessionWriteError.existingDocumentUnreadable("\(error)")
            }
        } else {
            existing = baseIfMissing
            createdNew = true
        }

        // 2) Build the candidate (pure, open-bag preserving append).
        let candidate = buildCandidate(existing)

        // 3) DataHealth gate. No fake success — a rejected candidate is never saved.
        guard validate(candidate) else {
            throw CanonicalSessionWriteError.validationRejected
        }

        // 4) Backup-before-overwrite (rollback) when a prior file exists.
        var backupURL: URL?
        if !createdNew {
            do {
                backupURL = try store.backup()
            } catch {
                throw CanonicalSessionWriteError.backupFailed("\(error)")
            }
        }

        // 5) Atomic save. A throw here leaves the prior file + its backup intact.
        do {
            try store.save(candidate)
        } catch {
            throw CanonicalSessionWriteError.saveFailed("\(error)")
        }

        return PerformedSessionWriteResult(createdNewStore: createdNew, backupURL: backupURL)
    }
}
