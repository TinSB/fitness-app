# Phase 21D - Cloud Read Mirror Verification V1

Phase 21D adds the cloud read mirror verification step after the write shadow candidate.

This is Cloud Read Mirror Verification only. It reads cloud candidate metadata through an injected repository contract, compares it with the local shadow candidate metadata, and reports whether first-upload apply may be considered later. It does not upload data, write cloud data, apply cloud data, write localStorage, or enable sync runtime.

## Scope

21D exposes `buildCloudReadMirrorVerification`.

The verification reads the Phase 21C shadow candidate, cloud read repository evidence, local snapshot metadata, schema preflight, and explicit read-mirror verification. It may report `readyFor21E: true` only when:

- Phase 21C has an accepted in-memory shadow candidate
- the user has explicitly verified the read mirror step
- the cloud read repository is available through an injected candidate contract
- the cloud read result is missing or exactly mirrored
- owner and schema evidence remain valid
- any different cloud metadata is held for manual review
- cloud-primary, default sync, background work, source-of-truth changes, sync runtime activation, and localStorage deletion are absent

## Runtime Result

When all gates pass, 21D can report:

- `readyFor21E: true`
- `cloudReadMirrorVerified: true`
- `cloudMissingAcceptedForFirstUpload: true`
- `requiresFirstUploadExplicitApply: true`
- `manualReviewRequired: false`
- `uploadPerformed: false`
- `downloadPerformed: false`
- `cloudWriteAttempted: false`
- `cloudDataChanged: false`
- `autoApplied: false`
- `syncRuntimeEnabled: false`
- `liveCloudSyncActivated: false`
- `cloudPrimaryEnabled: false`
- `defaultSyncEnabled: false`
- `backgroundWorkEnabled: false`
- `sourceOfTruthChanged: false`
- `localStorageDeleted: false`

If cloud metadata differs from the local shadow candidate, 21D reports `manualReviewRequired` and does not allow the next apply step.

## First Upload Apply Still Required

The First Upload Explicit Apply step remains blocked until 21E. 21D only verifies cloud-read state. It does not call a cloud write method and it does not treat a missing cloud snapshot as a completed upload.

## Preserved Boundaries

21D keeps localStorage as fallback, migration source, and emergency recovery source.

21D does not create a Supabase client.

21D does not store tokens.

21D does not write localStorage.

21D does not write cloud data.

21D does not apply cloud data to local data.

21D does not add routes.

21D does not change AppData or TrainingSession schemas.

21D does not change persistence.

21D does not change packages or lockfiles.

21D does not start background sync.

21D does not make cloud data primary.

## Decision

Phase 21D result: Cloud Read Mirror Verification only.

The next task is 21E - First Upload Explicit Apply V1.
