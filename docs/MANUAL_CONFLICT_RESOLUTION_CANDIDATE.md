# Task 12.13 Manual Conflict Resolution Candidate V1

This task adds manual conflict resolution candidate logic. It evaluates a requested resolution action but does not silently overwrite local or cloud data.

## Allowed Actions

- `keep_local`
- `keep_cloud`
- `create_backup_then_replace_local`
- `create_cloud_snapshot_from_local`
- `abort`

## Required Gates

- Manual confirmation required.
- Backup required before destructive-looking actions.
- Owner validation required.
- Schema validation required.
- No automatic merge.
- No silent overwrite.
- No local emergency backup deletion.

## Result Shape

- `action`
- `confirmed`
- `backupRequired`
- `backupCreated`
- `ownerValidated`
- `schemaValidated`
- `localDataChanged`
- `cloudDataChanged`
- `sourceOfTruthChanged`
- `aborted`
- `reason`

`localStorage` remains default, fallback, migration source, and emergency backup. Backend/cloud candidate behavior remains explicit opt-in and reversible.

Recommended next task: Task 12.14 Cloud Operation Journal & Idempotency Candidate V1.
