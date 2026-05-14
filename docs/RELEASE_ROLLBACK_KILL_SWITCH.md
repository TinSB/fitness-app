# Task 13.12 Release Rollback / Kill Switch V1

This task adds a release rollback and kill switch candidate boundary. It returns explicit disabled states only; it does not delete local data, overwrite cloud data, or add recovery routes.

## Kill Switch Actions

- disable cloud pull
- disable cloud push
- disable Supabase adapter
- disable backend-primary candidate
- force emergency-local mode
- return to localStorage-primary
- disable future external monitoring transport if it is ever added later

## Result Guarantees

- `cloudPullDisabled: true`
- `cloudPushDisabled: true`
- `supabaseAdapterDisabled: true`
- `backendPrimaryDisabled: true`
- `localDataDeleted: false`
- `cloudDataOverwritten: false`
- `sourceOfTruthChanged: false`
- rollback remains available
- emergency local mode remains available
- localStorage fallback remains available
- backend/cloud candidate remains reversible

## Non-Goals

- No localStorage deletion.
- No emergency backup deletion.
- Kill switch does not auto-overwrite cloud data.
- No automatic cloud sync.
- No reset/recovery HTTP route.
- No backup/import/export HTTP route.
- No package or lockfile change.
- No production launch.

Recommended next task: Task 13.13 Privacy, Export & Delete Readiness V1.
