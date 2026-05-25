# Phase 21F - Cloud Parity Check V1

Phase 21F adds the cloud read-after-upload and local parity gate after first upload apply.

This is Cloud Parity Check only. It reads cloud data back through an injected read repository after Phase 21E has explicitly applied the first upload, then compares the cloud snapshot metadata, cloud AppData hash, local AppData hash, and the 21E upload receipt. It does not perform a new upload, download cloud data into local state, write localStorage, start background sync, or make cloud data primary.

## Scope

21F exposes `buildCloudParityCheck`.

The parity gate reads Phase 21E first upload evidence, current local AppData, schema preflight, an injected read repository, and explicit read-after-upload/local parity confirmations. It may report `readyFor21G: true` only when:

- Phase 21E has `readyFor21F: true`
- the first upload was explicitly applied
- the first upload receipt has snapshot, operation, owner, schema, hash, and timestamp evidence
- the user explicitly starts read-after-upload parity checking
- the user explicitly checks local parity
- the current local AppData hash still matches the upload receipt
- the cloud snapshot metadata hash matches the upload receipt
- the cloud AppData hash matches the upload receipt
- the cloud snapshot id, operation id, owner, schema, and timestamp match the upload receipt
- cloud-primary, default sync, background work, source-of-truth changes, live cloud sync, and localStorage deletion are absent

## Runtime Result

When all gates pass, 21F can report:

- `readyFor21G: true`
- `cloudReadAfterUploadVerified: true`
- `localParityVerified: true`
- `uploadReceiptVerified: true`
- `firstUploadPreviouslyPerformed: true`
- `syncRuntimeEnabled: true`
- `newUploadPerformed: false`
- `cloudWriteAttempted: false`
- `uploadPerformed: false`
- `cloudDataChanged: false`
- `downloadPerformed: false`
- `autoApplied: false`
- `localDataChanged: false`
- `liveCloudSyncActivated: false`
- `cloudPrimaryEnabled: false`
- `defaultSyncEnabled: false`
- `backgroundWorkEnabled: false`
- `sourceOfTruthChanged: false`
- `localStorageDeleted: false`

This means the first upload has already happened in 21E and 21F has only read it back for parity. It does not mean cloud data is primary and it does not start any default or background behavior.

## Conflict Hold

If the read-after-upload snapshot differs from the local snapshot or the upload receipt, 21F reports `status: 'parity_mismatch'`, `conflictReviewRequired: true`, and `userMessage: '发现冲突'`. It does not choose between local and cloud data.

Phase 21G must provide the explicit review path for `保留本地` and `使用云端`.

## Preserved Boundaries

21F keeps localStorage as fallback, migration source, and emergency recovery source.

21F does not create a Supabase client.

21F does not store tokens.

21F does not write localStorage.

21F does not perform a new cloud write.

21F does not download cloud data into local state.

21F does not apply cloud data to local data.

21F does not add routes.

21F does not change AppData or TrainingSession schemas.

21F does not change persistence.

21F does not change packages or lockfiles.

21F does not start background sync.

21F does not make cloud data primary.

## Decision

Phase 21F result: Cloud Parity Check only.

The next task is 21G - Conflict Review V1.
