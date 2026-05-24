# Phase 20D - Explicit Opt-In Sync Runtime Wiring V1

Phase 20D adds explicit opt-in sync runtime wiring.

It does not upload data.

It does not download data.

It does not change local data, change cloud data, replace localStorage, make cloud data primary, or start background work.

## Scope

20D requires:

- Phase 20C auth readiness
- an authenticated account user
- explicit opt-in
- manual confirmation
- localStorage fallback confirmation
- no silent overwrite confirmation
- backup-before-sync confirmation
- safe runtime boundary evidence

The result can report `readyFor20E: true` only after those gates pass.

## Runtime Result

When all gates pass, 20D can report:

- `syncRuntimeEnabled: true`
- `readyFor20E: true`
- `uploadPerformed: false`
- `downloadPerformed: false`
- `autoApplied: false`
- `liveCloudSyncActivated: false`
- `cloudPrimaryEnabled: false`
- `defaultSyncEnabled: false`
- `backgroundWorkEnabled: false`
- `sourceOfTruthChanged: false`
- `localStorageDeleted: false`

This means the manual sync path is wired for the next safety step. It does not mean data has moved.

## User Copy

Future UI may use concise copy:

- 开启同步
- 开启前先备份
- 本地数据仍会保留
- 不会自动覆盖本地训练记录
- 稍后再说

## Preserved Boundaries

20D keeps localStorage as fallback, migration source, and emergency rollback source.

20D does not create a Supabase client.

20D does not store tokens.

20D does not write localStorage.

20D does not read or write cloud data.

20D does not add routes.

20D does not change AppData or TrainingSession schemas.

20D does not change persistence.

20D does not change packages or lockfiles.

20D does not start v0 UI polish.

## Decision

Phase 20D result: Explicit Opt-In Sync Runtime Wiring only.

The next task is 20E - Local Backup + Dry-Run Migration Runtime Flow V1.
