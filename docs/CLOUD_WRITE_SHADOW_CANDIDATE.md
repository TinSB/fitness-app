# Phase 21C - Cloud Write Shadow Candidate V1

Phase 21C adds the shadow candidate step after local backup and dry-run preview.

This is Cloud Write Shadow Candidate only. It builds an in-memory write candidate and operation journal evidence. It does not upload data, download cloud data, write cloud data, write localStorage, or enable sync runtime.

## Scope

21C exposes `buildCloudWriteShadowCandidate`.

The shadow candidate reads the Phase 21B local backup dry-run result, current local AppData, schema preflight, duplicate operation journal evidence, and explicit shadow confirmation. It may report `readyFor21D: true` only after:

- Phase 21B is ready for the signed-in account
- a matching local backup is present
- the local dry-run preview has been viewed
- the account owner evidence is valid
- the user has explicitly confirmed the shadow candidate step
- AppData schema preflight passes
- no known cloud conflict is present
- no duplicate shadow candidate is already recorded
- cloud-primary, default sync, background work, source-of-truth changes, sync runtime activation, and localStorage deletion are absent

## Runtime Result

When all gates pass, 21C can report:

- `readyFor21D: true`
- `shadowCandidateAccepted: true`
- `inMemoryShadowCandidateOnly: true`
- `requiresFirstUploadExplicitApply: true`
- `requiresCloudReadMirrorBeforeApply: true`
- `uploadPerformed: false`
- `downloadPerformed: false`
- `cloudWriteAttempted: false`
- `cloudReadAttempted: false`
- `cloudDataChanged: false`
- `autoApplied: false`
- `syncRuntimeEnabled: false`
- `liveCloudSyncActivated: false`
- `cloudPrimaryEnabled: false`
- `defaultSyncEnabled: false`
- `backgroundWorkEnabled: false`
- `sourceOfTruthChanged: false`
- `localStorageDeleted: false`

This means the user has a reviewed shadow candidate for the next read mirror step. It does not mean sync is enabled and it does not move data.

## First Upload Apply Still Required

The First Upload Explicit Apply step remains blocked until a later task. 21C only prepares a candidate and idempotency evidence. It does not call a cloud repository write method and it does not treat the candidate as a completed upload.

21D must verify the cloud read mirror before upload apply can be considered. If a conflict appears, the user must review it manually.

## Preserved Boundaries

21C keeps localStorage as fallback, migration source, and emergency recovery source.

21C does not create a Supabase client.

21C does not store tokens.

21C does not write localStorage.

21C does not read or write cloud data.

21C does not add routes.

21C does not change AppData or TrainingSession schemas.

21C does not change persistence.

21C does not change packages or lockfiles.

21C does not start background sync.

21C does not make cloud data primary.

## Decision

Phase 21C result: Cloud Write Shadow Candidate only.

The next task is 21D - Cloud Read Mirror Verification V1.
