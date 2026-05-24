# Phase 20H - Production Acceptance With Synthetic Data V1

Phase 20H adds production acceptance with synthetic data.

It is a gate after 20G conflict, offline, rollback, and emergency local evidence.

It exposes `buildProductionAcceptanceSyntheticData`.

It does not launch production.

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

20H requires:

- Phase 20G readiness
- accepted write-shadow candidate evidence
- local validation evidence
- dedicated test environment
- dedicated browser profile
- synthetic data only
- backup/export evidence
- RLS ownership evidence
- service role key blocked from browser
- privacy export/delete documentation
- offline training verification
- rollback verification
- emergency local verification
- route lock verification
- package and lockfile cleanliness
- safe production boundary evidence

The result can report `readyFor20I: true` only after those gates pass.

## Synthetic Data Rule

20H automated checks and acceptance evidence use synthetic data only.

Real personal training data must not be used.

No raw AppData dumps, localStorage dumps, tokens, secrets, or service role values may appear in test output, docs examples, or diagnostics.

## Runtime Result

When all gates pass, 20H can report:

- `readyFor20I: true`
- `validationAccepted: true`
- `syntheticEvidenceAccepted: true`
- `privacyAccepted: true`
- `fallbackAccepted: true`
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

This means synthetic production acceptance evidence is ready for the UI polish handoff contract. It does not mean sync is live.

## User Copy

Future UI may use concise copy:

- 合成数据验收完成
- 本地数据仍会保留
- 查看后再继续
- 稍后再说

## Preserved Boundaries

20H does not create a Supabase client.

20H does not read environment files.

20H does not store tokens.

20H does not write localStorage.

20H does not add routes.

20H does not change AppData or TrainingSession schemas.

20H does not change persistence.

20H does not change packages or lockfiles.

20H does not start v0 UI polish.

## Decision

Phase 20H result: Production Acceptance With Synthetic Data only.

The next task is 20I - v0 UI Polish Handoff Contract V1.
