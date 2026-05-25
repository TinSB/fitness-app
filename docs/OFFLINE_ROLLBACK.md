# Phase 21H - Offline Rollback V1

Phase 21H adds the offline mode, rollback, and emergency local safety gate after conflict review.

This is Offline Rollback only. It verifies that local training remains available when cloud is unavailable, localStorage fallback remains available, rollback is available, emergency local mode is available, and `恢复本地模式` is explicit when requested. It does not apply cloud data to local data, write localStorage, delete localStorage, start background sync, or make cloud data primary.

## Scope

21H exposes `buildOfflineRollback`.

The gate reads Phase 21G conflict review evidence, offline training proof, cloud-unavailable fallback proof, no-fake-success proof, localStorage fallback evidence, emergency backup evidence, rollback snapshot evidence, optional restore-local request, explicit restore-local confirmation, and runtime boundary evidence. It may report `readyFor21I: true` only when:

- Phase 21G has `readyFor21H: true`
- local training remains available
- cloud unavailable does not block training
- fake cloud success is rejected
- localStorage fallback remains available
- rollback is available
- emergency local mode is available
- `恢复本地模式` is explicitly confirmed when requested
- cloud-primary, default sync, background work, live cloud sync, source-of-truth changes, and localStorage deletion are absent

## Runtime Result

When all gates pass, 21H can report:

- `readyFor21I: true`
- `offlineTrainingAvailable: true`
- `cloudUnavailableAccepted: true`
- `rollbackAvailable: true`
- `emergencyLocalAvailable: true`
- `restoreLocalModeAvailable: true`
- `restoreLocalModeLabel: '恢复本地模式'`
- `localAppAvailable: true`
- `cloudCandidateDisabled: true`
- `automaticConflictDecisionMade: false`
- `decisionApplied: false`
- `newUploadPerformed: false`
- `cloudWriteAttempted: false`
- `uploadPerformed: false`
- `cloudDataChanged: false`
- `downloadPerformed: false`
- `autoApplied: false`
- `localDataChanged: false`
- `cloudPrimaryEnabled: false`
- `defaultSyncEnabled: false`
- `backgroundWorkEnabled: false`
- `sourceOfTruthChanged: false`
- `localStorageDeleted: false`
- `localDataDeleted: false`

If restore-local mode is requested and explicitly confirmed, 21H can report `restoreLocalModeConfirmed: true` and `rollbackPerformed: true` as a rollback candidate result while still keeping `localDataChanged: false`, `localDataDeleted: false`, and `sourceOfTruthChanged: false` in this contract.

## Preserved Boundaries

21H keeps localStorage as fallback, migration source, and emergency recovery source.

21H does not create a Supabase client.

21H does not store tokens.

21H does not write localStorage.

21H does not delete localStorage.

21H does not perform a new cloud write.

21H does not download cloud data into local state.

21H does not apply cloud data to local data.

21H does not add routes.

21H does not change AppData or TrainingSession schemas.

21H does not change persistence.

21H does not change packages or lockfiles.

21H does not start background sync.

21H does not make cloud data primary.

## Decision

Phase 21H result: Offline Rollback only.

The next task is 21I - Production Full Acceptance V1.
