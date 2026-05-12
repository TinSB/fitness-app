# Session Discard Mutation Prototype Plan

Task 5.19 plans a future dev-only browser prototype for `POST /sessions/active/discard`.

This is planning-only. It does not implement `POST /sessions/active/discard`, does not add a browser route, does not modify App.tsx, does not modify `src/devApi` runtime behavior, does not add a broad mutation client, does not change source of truth, does not replace localStorage, does not add API primary runtime, and does not add production backend, auth, sync, cloud, deployment, package dependency, package script, normalized table, or training algorithm changes.

localStorage remains source of truth. API results never overwrite AppData or localStorage.

## Future Route

Future planned route:

- `POST /sessions/active/discard`

Current accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`

Still blocked in Task 5.19:

- `POST /sessions/active/discard`
- `POST /data-health/repair/apply`
- backup/import/export over HTTP
- reset/recovery over HTTP
- source-of-truth migration outside approved Phase 5 runtime work

## Future Flag Boundary

Future prototype flag:

`VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT === "session-discard"`

The future flag must not enable session start, session patch, session complete, DataHealth repair, backup/import/export, reset/recovery, API primary runtime, or any broad mutation client.

## Request Shape

The future request should use a route-specific body:

```json
{
  "activeSessionId": "active-session-id",
  "sourceSnapshotHash": "source-snapshot-hash",
  "sourceSnapshotVersion": "phase5-session-discard-v1",
  "mutationId": "session-discard-mutation-id",
  "idempotencyKey": "session-discard-idempotency-key",
  "requestFingerprint": "session-discard-request-fingerprint",
  "confirmed": true,
  "confirmUnsavedTrainingLoss": true
}
```

Task 5.20 may narrow this shape if the existing server contract requires it, but it must not broaden into session patch, session complete, DataHealth repair, backup/import/export, reset/recovery, or source-of-truth migration.

## Unsaved Training State Risk

Discard can lose unsaved training state.

Discarding an active session can lose unsaved training state. A future prototype must treat discard as destructive for the Dev API snapshot even though App runtime remains localStorage-first.

Required gates:

- stable active session target.
- source snapshot metadata.
- mutation id.
- idempotency key.
- request fingerprint.
- strong confirmation that unsaved training state may be lost in the Dev API snapshot.
- strict success shape.
- snapshot metadata required for success.
- visible failure for non-success states.

## Strong Confirmation

The future prototype must require an explicit confirmation before any request is sent.

Cancel must send no request. A pending request must disable duplicate submit. Target changes must reset confirmation.

The browser must not optimistically clear `activeSession`, must not remove focus state, and must not write localStorage or AppData from the API response.

## Visible Recovery Policy

Recovery must be manual and dev-only:

- disable the mutation flag.
- refresh read-only diagnostics.
- continue using local App state as the current source of truth.
- inspect the dedicated dev DB copy if needed.
- restart the Dev API runner if the database was closed.
- do not overwrite localStorage or AppData from the API response.

The UI must show visible failure for unavailable Dev API, timeout, malformed response, missing snapshot metadata, no active session, write_failed, transaction_failed, database_closed, and unsupported_route.

## No History Write

Discard must not write a history record. It must not locally append, edit, or delete history in AppData.

The future browser prototype must treat the server response as diagnostic output unless a later API-primary runtime task explicitly changes source-of-truth behavior.

## Source Snapshot And Idempotency

The future prototype must include:

- active session id.
- sourceSnapshotHash.
- sourceSnapshotVersion.
- mutationId.
- idempotencyKey.
- requestFingerprint.
- explicit confirmation.
- confirmation that unsaved Dev API snapshot training state may be discarded.

Mismatched active session id, missing source snapshot, missing idempotency, or stale request fingerprint must fail before sending a request.

## Duplicate Discard Prevention

A duplicate discard can hide a failed first request, make the Dev API snapshot ambiguous, or display fake success after the active session is already gone.

Required behavior:

- duplicate-submit lock while pending.
- no auto retry.
- `no_active_session` is non-success.
- `no_change` is non-success.
- second-click behavior remains visibly blocked until the first request resolves.

## No-fake-success Rules

Future prototype success requires:

- HTTP 2xx.
- `result.ok === true`.
- `result.changed === true`.
- `result.status === "success"`.
- snapshot metadata exists.
- source snapshot metadata was sent.
- idempotency metadata was sent.

Anything else is failure.

## Manual Acceptance Plan

The future Task 5.20 implementation must be followed by acceptance and manual acceptance tasks. Manual acceptance must require:

- dedicated test browser profile.
- dedicated dev DB.
- no real personal training data.
- DevTools Network route boundary.
- no POST before confirmation.
- no fake success.
- localStorage integrity check.
- AppData integrity check.
- cleanup and env reset.

## Explicit Non-goals

- no implementation in Task 5.19.
- no App.tsx mount.
- no `src/devApi` runtime change.
- no session patch route change.
- no session complete route change.
- no DataHealth repair.
- no backup/import/export/reset/recovery HTTP route.
- no source-of-truth migration.
- no API primary runtime.
- no localStorage replacement.
- no broad mutation client.
- no production backend/auth/sync/cloud/deployment.

## Decision

Plan `POST /sessions/active/discard` as the next route-specific active-session prototype candidate, but do not implement it in Task 5.19.

Next recommended task: `Task 5.20 Session Discard Mutation Prototype V1`.

Task 5.20 may implement only `POST /sessions/active/discard` if gates pass.

## Decision Record

- Date: 2026-05-12
- Branch / commit: `codex/task5.19-session-discard-mutation-prototype-plan` / pending until merge
- Decision: plan a future dev-only session discard prototype.
- Future route: `POST /sessions/active/discard`
- Still blocked: session discard implementation, DataHealth repair, backup/import/export, reset/recovery, source-of-truth migration.
- Recommended next task: `Task 5.20 Session Discard Mutation Prototype V1`
- Rollback requirement: revert the Task 5.19 docs/static-test commit.

## Final Recommendation

Task 5.19 result: session discard prototype plan only.

Browser mutation routes remain exactly DataHealth dismiss, History data-flag, Limited History Edit, Session Start, Session Patch, and Session Complete.
localStorage remains source of truth.
API results never overwrite AppData or localStorage.
Next task should be Task 5.20 Session Discard Mutation Prototype V1 only if gates pass.

## Task 5.20 Follow-up: Session Discard Prototype

Task 5.20 implements the planned dev-only single-route browser prototype for `POST /sessions/active/discard`.

The implementation keeps the plan constraints: explicit `session-discard` mutation experiment flag, localhost-only Dev API base URL, source snapshot metadata, source snapshot version, mutation id, idempotency key, request fingerprint, strong confirmation, duplicate-submit protection, strict no-fake-success behavior, and required snapshot metadata.

Task 5.20 does not change session patch or session complete behavior, does not add DataHealth repair, does not add backup/import/export/reset/recovery HTTP routes, does not add source-of-truth migration, does not replace localStorage, does not add API primary runtime, does not add a broad mutation client, does not change package files, and does not add production backend, auth, sync, cloud, or deployment.

Accepted browser mutation routes are now exactly DataHealth dismiss, History data-flag, Limited History Edit, Session Start, Session Patch, Session Complete, and Session Discard.

Next task should be Task 5.21 Session Discard Acceptance / Hardening V1.

## Task 5.21 Follow-up: Session Discard Acceptance / Hardening

Task 5.21 accepts and hardens the dev-only `POST /sessions/active/discard` prototype without adding another route.

The acceptance and hardening coverage locks duplicate discard prevention, missing active session behavior, invalid active session identity, strong confirmation and cancel behavior, timeout/unavailable/malformed response handling, server non-success states, no-fake-success behavior, pending lock behavior, confirmation reset behavior, localStorage/AppData integrity, no history write behavior, and route boundary.

Accepted browser mutation routes remain exactly DataHealth dismiss, History data-flag, Limited History Edit, Session Start, Session Patch, Session Complete, and Session Discard.

Next task should be Task 5.22 Active Session Full Write-path Regression Lock V1.
