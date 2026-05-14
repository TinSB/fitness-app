# Task 12.15 Cloud Fallback / Rollback / Emergency Local Mode V1

This task adds cloud fallback, rollback, and emergency local mode logic.

## Covered Reasons

- `cloud_unavailable`
- `push_failed`
- `pull_failed`
- `conflict_unresolved`
- `owner_mismatch`
- `invalid_cloud_data`
- `auth_session_invalid`
- `manual_abort`
- `rollback_to_local`
- `emergency_local_mode`

## Guarantees

- localStorage fallback remains available.
- emergency backup remains available.
- backend-primary candidate can be disabled.
- cloud candidate failure does not break local app.
- source-of-truth remains guarded.
- local data is not deleted.
- No reset/recovery HTTP routes.
- No backup/import/export HTTP routes.

## Result Shape

- `localAppAvailable`
- `fallbackLocalStorageAvailable`
- `emergencyLocalAvailable`
- `cloudCandidateDisabled`
- `rollbackAvailable`
- `rollbackPerformed`
- `localDataDeleted: false`
- `sourceOfTruthChanged`
- `reason`

Recommended next task: Task 12.16 Cloud Database / Sync Manual Acceptance V1.
