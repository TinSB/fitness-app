# Task 12.11 Cloud Write / Push Candidate V1

This task adds an explicit opt-in cloud push candidate. It prepares guarded candidate writes only after dry run, owner check, backup check, schema validation, and manual confirmation.

## Behavior

- Disabled by default.
- Explicit opt-in required.
- Manual confirmation required.
- Dry run required before push.
- Owner check required.
- Backup check required.
- Schema validation required.
- Cloud conflict blocks candidate write.
- Rejected writes do not fake success.
- Candidate success does not switch source-of-truth.

## Result Guarantees

- `noFakeSuccess`
- `localDataChanged: false`
- `sourceOfTruthChanged: false`
- `rollbackAvailable`
- `cloudWriteCandidateStatus`

## Preserved Boundaries

The push candidate does not push without confirmation, corrupt local data, auto-sync, add routes, or use real personal training data. `localStorage` remains default, fallback, migration source, and emergency backup.

Recommended next task: Task 12.12 Cloud Sync Conflict Detection V1.
