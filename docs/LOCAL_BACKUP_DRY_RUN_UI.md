# Phase 21B - Local Backup Dry Run UI V1

Phase 21B adds the Settings UI preparation step after the explicit opt-in preflight.

This is local backup and dry-run preview only. It does not upload data, download cloud data, write cloud data, write localStorage, or enable sync runtime.

## Scope

21B exposes `buildLocalBackupDryRunUi`.

The UI step reads the Phase 21A preflight, local AppData, backup evidence, and a user-requested dry-run preview. It may report `readyFor21C: true` only after:

- Phase 21A preflight is ready for the signed-in account
- the user has created or confirmed a local backup
- the backup matches the current local snapshot
- local account boundary evidence is valid
- the user has requested to view the dry-run preview
- AppData schema preflight passes
- cloud-primary, default sync, background work, source-of-truth changes, sync runtime activation, and localStorage deletion are absent

## Settings Copy

21B may show concise Settings copy:

- 本地数据仍会保留
- 开启前先备份
- 检查本地数据
- 查看将同步的内容

The dry-run preview may show local counts and a shortened local snapshot fingerprint. It does not show raw AppData, secrets, tokens, or environment values.

## Runtime Result

When all gates pass, 21B can report:

- `readyFor21C: true`
- `backupReady: true`
- `dryRunReady: true`
- `dryRunPreviewVisible: true`
- `uploadPerformed: false`
- `downloadPerformed: false`
- `autoApplied: false`
- `syncRuntimeEnabled: false`
- `liveCloudSyncActivated: false`
- `cloudPrimaryEnabled: false`
- `defaultSyncEnabled: false`
- `backgroundWorkEnabled: false`
- `sourceOfTruthChanged: false`
- `localStorageDeleted: false`

This means the signed-in user has seen the local backup and preview step. It does not mean sync is enabled and it does not move data.

## Preserved Boundaries

21B keeps localStorage as fallback, migration source, and emergency recovery source.

21B does not create a Supabase client.

21B does not store tokens.

21B does not write localStorage.

21B does not read or write cloud data.

21B does not add routes.

21B does not change AppData or TrainingSession schemas.

21B does not change persistence.

21B does not change packages or lockfiles.

21B does not start background sync.

21B does not make cloud data primary.

## Decision

Phase 21B result: Local Backup Dry Run UI only.

The next task is 21C - Cloud Write Shadow Candidate V1.
