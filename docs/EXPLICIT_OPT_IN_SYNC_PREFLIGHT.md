# Phase 21A - Explicit Opt-In Sync Preflight V1

Phase 21A adds the first production-facing preflight for explicit cloud sync.

This is preflight only. It does not upload data, download data, write cloud data, write localStorage, or enable sync runtime.

## Scope

21A exposes `buildExplicitOptInSyncPreflight`.

The preflight reads existing Phase 20 public readiness and auth runtime evidence, then decides whether the signed-in account may proceed to the backup and dry-run step.

It may report `readyFor21B: true` only when:

- public browser Supabase configuration is ready
- no service-role or secret exposure is reported
- the account is signed in through the existing auth runtime
- localStorage fallback remains preserved
- cloud-primary, default sync, background work, source-of-truth changes, and localStorage deletion are all absent

## Runtime Result

When all gates pass, 21A can report:

- `readyFor21B: true`
- `syncPreflightVisible: true`
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

This means the signed-in Settings surface may show the next safe preparation step. It does not mean sync is enabled and it does not move data.

## Settings Copy

21A may show concise passive copy:

- 本地数据仍会保留
- 开启前先备份
- 检查本地数据
- 查看将同步的内容

`开启同步` remains gated by later explicit apply work. Before first upload, the user must still complete backup, dry run, and clear confirmation.

## Preserved Boundaries

21A keeps localStorage as fallback, migration source, and emergency recovery source.

21A does not create a Supabase client.

21A does not store tokens.

21A does not write localStorage.

21A does not read or write cloud data.

21A does not add routes.

21A does not change AppData or TrainingSession schemas.

21A does not change persistence.

21A does not change packages or lockfiles.

21A does not start background sync.

21A does not make cloud data primary.

## Decision

Phase 21A result: Explicit Opt-In Sync Preflight only.

The next task is 21B - Local Backup Dry Run UI V1.
