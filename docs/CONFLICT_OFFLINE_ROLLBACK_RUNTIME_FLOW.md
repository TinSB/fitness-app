# Phase 20G - Conflict/Offline/Rollback Runtime Flow V1

Phase 20G adds a conflict, offline, rollback, and emergency local runtime flow.

It is a gate after 20F cloud read/write verification.

It exposes `buildConflictOfflineRollbackRuntimeFlow`.

It does not apply cloud data.

It does not upload data.

It does not download data.

It does not write localStorage.

It does not delete localStorage.

It does not make cloud data primary.

It does not enable default sync.

It does not start background sync.

It does not change source of truth.

## Scope

20G requires:

- Phase 20F verification readiness
- accepted write-shadow candidate evidence
- completed conflict review
- no automatic conflict apply
- offline training availability
- no fake success behavior
- cloud-unavailable fallback
- rollback availability
- emergency local availability
- localStorage fallback availability
- unchanged route, package, and schema boundaries
- safe runtime boundary evidence

The result can report `readyFor20H: true` only after those gates pass.

## Conflict Review

Conflict review must be complete before production acceptance can proceed.

Automatic conflict choice remains unavailable.

20G does not merge conflicts and does not apply a resolution.

## Offline Proof

Local training must remain available when cloud is unavailable.

Background work must remain disabled.

The flow must not report fake success when cloud evidence is missing or rejected.

## Rollback Proof

Rollback must remain available.

Emergency local mode must remain available.

localStorage must remain fallback, migration source, and emergency rollback source.

## Runtime Result

When all gates pass, 20G can report:

- `readyFor20H: true`
- `conflictReviewAccepted: true`
- `offlineAccepted: true`
- `rollbackAccepted: true`
- `emergencyLocalAccepted: true`
- `routeBoundaryAccepted: true`
- `uploadPerformed: false`
- `downloadPerformed: false`
- `autoApplied: false`
- `liveCloudSyncActivated: false`
- `cloudPrimaryEnabled: false`
- `defaultSyncEnabled: false`
- `backgroundWorkEnabled: false`
- `sourceOfTruthChanged: false`
- `localStorageDeleted: false`
- `productionLaunchPerformed: false`

This means conflict, offline, rollback, and emergency local evidence is ready for synthetic production acceptance. It does not mean sync is live.

## User Copy

Future UI may use concise copy:

- 本地数据仍会保留
- 查看后再继续
- 不会自动覆盖本地训练记录
- 稍后再说

## Preserved Boundaries

20G does not create a Supabase client.

20G does not read environment files.

20G does not store tokens.

20G does not write localStorage.

20G does not add routes.

20G does not change AppData or TrainingSession schemas.

20G does not change persistence.

20G does not change packages or lockfiles.

20G does not start v0 UI polish.

## Decision

Phase 20G result: Conflict/Offline/Rollback Runtime Flow only.

The next task is 20H - Production Acceptance With Synthetic Data V1.
