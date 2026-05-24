# Phase 20E - Local Backup + Dry-Run Migration Runtime Flow V1

Phase 20E adds a local backup plus migration dry-run runtime flow.

It is a gate before any cloud read/write verification work.

It exposes `buildLocalBackupDryRunMigrationRuntimeFlow`.

It does not upload data.

It does not download data.

It does not write localStorage.

It does not write cloud data.

It does not change source of truth.

## Scope

20E requires:

- Phase 20D sync runtime readiness
- an authenticated account user
- local AppData
- backup/export confirmation or a caller-supplied backup JSON string
- account boundary inventory
- dry-run migration readiness
- schema preflight
- cloud repository availability evidence
- RLS preflight evidence
- rollback availability evidence
- safe runtime boundary evidence

The result can report `readyFor20F: true` only after those gates pass.

## Backup Preflight

20E checks backup metadata before any future write step.

When the caller provides backup JSON, 20E validates it against the current local snapshot metadata.

When backup export is explicitly confirmed and AppData is provided, 20E may generate an in-memory backup JSON string only long enough to inspect backup metadata. The result does not return the raw backup JSON.

The backup preflight can report:

- `valid`
- `missing`
- `invalid`
- `mismatch`

The backup check remains local metadata only.

## Dry-Run Migration

20E composes the existing Phase 19B account boundary inventory and Phase 19I local-to-cloud migration dry run.

The dry run keeps:

- `noUpload: true`
- `noDownload: true`
- `localDataChanged: false`
- `cloudDataChanged: false`
- `sourceOfTruthChanged: false`

Dry-run blockers include schema failure, cloud repository unavailability, RLS preflight failure, conflict review, manual review, and rollback unavailability.

## Runtime Result

When all gates pass, 20E can report:

- `readyFor20F: true`
- `syncRuntimeEnabled: true`
- `uploadPerformed: false`
- `downloadPerformed: false`
- `autoApplied: false`
- `liveCloudSyncActivated: false`
- `cloudPrimaryEnabled: false`
- `defaultSyncEnabled: false`
- `backgroundWorkEnabled: false`
- `sourceOfTruthChanged: false`
- `localStorageDeleted: false`

This means the local backup and dry-run evidence is ready for the next verification step. It does not mean data has moved.

## User Copy

Future UI may use concise copy:

- 本地数据仍会保留
- 开启前先备份
- 不会自动覆盖本地训练记录
- 稍后再说

## Preserved Boundaries

20E keeps localStorage as fallback, migration source, and emergency rollback source.

20E does not create a Supabase client.

20E does not store tokens.

20E does not write localStorage.

20E does not read or write cloud data.

20E does not add routes.

20E does not change AppData or TrainingSession schemas.

20E does not change persistence.

20E does not change packages or lockfiles.

20E does not start v0 UI polish.

## Decision

Phase 20E result: Local Backup + Dry-Run Migration Runtime Flow only.

The next task is 20F - Cloud Read/Write Verification Flow V1.
