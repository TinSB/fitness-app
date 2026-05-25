# Phase 21E - First Upload Explicit Apply V1

Phase 21E adds the first explicit upload apply gate after cloud read mirror verification.

This is First Upload Explicit Apply only. It writes through an injected cloud AppData repository contract after the user has explicitly confirmed first upload apply, localStorage fallback, no silent overwrite, and backup availability. It does not download cloud data, apply cloud data to local data, write localStorage, start background sync, or make cloud data primary.

## Scope

21E exposes `buildFirstUploadExplicitApply`.

The apply gate reads the Phase 21C shadow candidate, Phase 21D read mirror verification, current local AppData, schema preflight, an injected write repository, and explicit first-upload confirmation. It may report `readyFor21F: true` only when:

- Phase 21C has an accepted shadow candidate
- Phase 21D has verified that cloud data is missing or exactly mirrored
- no manual review is required
- the user explicitly applies first upload
- localStorage fallback is confirmed
- no silent overwrite is confirmed
- backup availability is still confirmed
- AppData schema preflight passes
- the injected repository accepts the write candidate
- cloud-primary, default sync, background work, source-of-truth changes, previous sync runtime activation, and localStorage deletion are absent

## Runtime Result

When all gates pass, 21E can report:

- `readyFor21F: true`
- `firstUploadExplicitlyApplied: true`
- `uploadPerformed: true`
- `cloudWriteAttempted: true`
- `cloudDataChanged: true`
- `syncRuntimeEnabled: true`
- `downloadPerformed: false`
- `autoApplied: false`
- `localDataChanged: false`
- `liveCloudSyncActivated: false`
- `cloudPrimaryEnabled: false`
- `defaultSyncEnabled: false`
- `backgroundWorkEnabled: false`
- `sourceOfTruthChanged: false`
- `localStorageDeleted: false`

This means the first upload was explicitly applied and the next step must read the cloud data back and compare it with local data. It does not mean cloud data is primary and it does not start any default or background behavior.

## Required Follow-Up

21F Cloud Parity Check must read after upload and verify local parity before the flow can proceed. If parity fails, the next steps must hold the user in review or rollback.

## Preserved Boundaries

21E keeps localStorage as fallback, migration source, and emergency recovery source.

21E does not create a Supabase client.

21E does not store tokens.

21E does not write localStorage.

21E does not download cloud data.

21E does not apply cloud data to local data.

21E does not add routes.

21E does not change AppData or TrainingSession schemas.

21E does not change persistence.

21E does not change packages or lockfiles.

21E does not start background sync.

21E does not make cloud data primary.

## Decision

Phase 21E result: First Upload Explicit Apply only.

The next task is 21F - Cloud Parity Check V1.
