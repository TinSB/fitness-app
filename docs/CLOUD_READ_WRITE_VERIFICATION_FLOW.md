# Phase 20F - Cloud Read/Write Verification Flow V1

Phase 20F adds an explicit cloud read/write verification flow.

It is a gate after 20E local backup and migration dry-run readiness.

It exposes `buildCloudReadWriteVerificationFlow`.

It does not make cloud data primary.

It does not enable default sync.

It does not start background sync.

It does not write localStorage.

It does not delete localStorage.

It does not apply cloud data to local data.

It does not change source of truth.

## Scope

20F requires:

- Phase 20E readiness
- local AppData
- explicit verification opt-in
- manual confirmation
- cloud read repository evidence
- cloud write-shadow adapter evidence
- duplicate operation protection
- rollback availability
- safe runtime boundary evidence

The result can report `readyFor20G: true` only after those gates pass.

## Read Verification

20F uses the existing Phase 19G cloud read mirror contract.

Cloud-missing read evidence is safe for first write-shadow verification.

Mirrored read evidence is safe when owner, schema, snapshot hash, and freshness match.

Rejected or review-required read evidence blocks write-shadow verification.

The read path does not apply cloud data to local data.

## Write Verification

20F uses the existing Phase 19H cloud write shadow contract through an injected adapter.

The flow can verify that a write-shadow candidate is accepted, but it does not make that candidate the source of truth and does not alter local data.

Duplicate operation evidence blocks the verification.

Rollback availability remains required.

## Runtime Result

When all gates pass, 20F can report:

- `readyFor20G: true`
- `cloudReadAttempted: true`
- `cloudWriteAttempted: true`
- `cloudWriteCandidateAccepted: true`
- `uploadPerformed: false`
- `downloadPerformed: false`
- `autoApplied: false`
- `liveCloudSyncActivated: false`
- `cloudPrimaryEnabled: false`
- `defaultSyncEnabled: false`
- `backgroundWorkEnabled: false`
- `sourceOfTruthChanged: false`
- `localStorageDeleted: false`

This means read/write verification evidence is ready for conflict, offline, and rollback runtime checks. It does not mean sync is live.

## User Copy

Future UI may use concise copy:

- 查看后再继续
- 本地数据仍会保留
- 不会自动覆盖本地训练记录
- 稍后再说

## Preserved Boundaries

20F does not create a Supabase client.

20F does not read environment files.

20F does not store tokens.

20F does not write localStorage.

20F does not add routes.

20F does not change AppData or TrainingSession schemas.

20F does not change persistence.

20F does not change packages or lockfiles.

20F does not start v0 UI polish.

## Decision

Phase 20F result: Cloud Read/Write Verification Flow only.

The next task is 20G - Conflict/Offline/Rollback Runtime Flow V1.
