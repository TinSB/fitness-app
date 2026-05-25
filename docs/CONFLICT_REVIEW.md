# Phase 21G - Conflict Review V1

Phase 21G adds the explicit conflict review decision gate after cloud parity check.

This is Conflict Review only. It records that the user reviewed a parity conflict and explicitly chose `保留本地` or `使用云端`. It does not apply either choice to local data, write cloud data, write localStorage, start background sync, or make cloud data primary.

## Scope

21G exposes `buildConflictReview`.

The review gate reads Phase 21F parity evidence, review visibility, explicit resolution choice, explicit confirmation, localStorage fallback confirmation, no-auto-apply confirmation, backup availability for `使用云端`, owner validation, schema validation, and runtime boundary evidence. It may report `readyFor21H: true` only when:

- Phase 21F has either verified parity or surfaced a conflict for review
- no conflict means no resolution choice is invented
- a conflict means the review was opened
- the user explicitly chooses `保留本地` or `使用云端`
- the user explicitly confirms the chosen resolution
- no automatic conflict decision is attempted
- localStorage fallback remains confirmed
- backup is still available before `使用云端`
- owner and schema validation pass
- cloud-primary, default sync, background work, source-of-truth changes, live cloud sync, and localStorage deletion are absent

## Runtime Result

When all gates pass, 21G can report:

- `readyFor21H: true`
- `conflictDetected: true`
- `conflictReviewVisible: true`
- `manualResolutionRequired: true`
- `manualResolutionConfirmed: true`
- `keepLocalAvailable: true`
- `useCloudAvailable: true`
- `automaticConflictDecisionMade: false`
- `decisionApplied: false`
- `newUploadPerformed: false`
- `cloudWriteAttempted: false`
- `uploadPerformed: false`
- `cloudDataChanged: false`
- `downloadPerformed: false`
- `autoApplied: false`
- `localDataChanged: false`
- `cloudPrimaryEnabled: false`
- `defaultSyncEnabled: false`
- `backgroundWorkEnabled: false`
- `sourceOfTruthChanged: false`
- `localStorageDeleted: false`

This means the conflict decision is recorded for the next safety step. It does not mean local data was replaced or cloud data was rewritten.

## Decisions

`保留本地` records a manual keep-local candidate. Local data remains unchanged and cloud data is not rewritten in 21G.

`使用云端` records a manual use-cloud candidate only after backup availability is confirmed. Local data remains unchanged in 21G.

If the conflict review is missing, the resolution choice is missing, or an automatic decision is attempted, 21G fails closed.

## Preserved Boundaries

21G keeps localStorage as fallback, migration source, and emergency recovery source.

21G does not create a Supabase client.

21G does not store tokens.

21G does not write localStorage.

21G does not perform a new cloud write.

21G does not download cloud data into local state.

21G does not apply cloud data to local data.

21G does not add routes.

21G does not change AppData or TrainingSession schemas.

21G does not change persistence.

21G does not change packages or lockfiles.

21G does not start background sync.

21G does not make cloud data primary.

## Decision

Phase 21G result: Conflict Review only.

The next task is 21H - Offline Rollback V1.
