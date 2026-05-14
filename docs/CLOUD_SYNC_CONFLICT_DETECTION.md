# Task 12.12 Cloud Sync Conflict Detection V1

This task adds cloud/local conflict detection without automatic resolution.

## Conflict Types

- `local_newer`
- `cloud_newer`
- `both_changed`
- `owner_mismatch`
- `schema_mismatch`
- `cloud_missing`
- `local_missing`
- `backend_primary_mismatch`
- `session_account_mismatch`
- `device_identity_mismatch`

## Result Shape

- `conflictType`
- `severity`
- `recommendedAction`
- `manualResolutionRequired`
- `canAutoApply: false`

## Preserved Boundaries

No last-write-wins default. No silent overwrite. No automatic merge. Conflict detection does not start background sync, apply cloud data, mutate localStorage, add routes, or use real personal training data.

Recommended next task: Task 12.13 Manual Conflict Resolution Candidate V1.
