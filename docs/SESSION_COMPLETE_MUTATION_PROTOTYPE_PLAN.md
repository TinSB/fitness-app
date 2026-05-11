# Session Complete Mutation Prototype Plan

Task 5.16 plans a future dev-only browser prototype for `POST /sessions/active/complete`.

This is planning-only. It does not implement `POST /sessions/active/complete`, does not add a browser route, does not modify App.tsx, does not modify `src/devApi` runtime behavior, does not add a broad mutation client, does not implement session discard, does not change source of truth, does not replace localStorage, does not add API primary runtime, and does not add production backend, auth, sync, cloud, deployment, package dependency, package script, normalized table, or training algorithm changes.

localStorage remains source of truth. API results never overwrite AppData or localStorage.

## Future Route

Future planned route:

- `POST /sessions/active/complete`

Current accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`

Still blocked:

- `POST /sessions/active/complete`
- `POST /sessions/active/discard`
- `POST /data-health/repair/apply`
- backup/import/export over HTTP
- reset/recovery over HTTP
- source-of-truth migration outside approved Phase 5 runtime work

## Future Flag Boundary

Future prototype flag:

`VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT === "session-complete"`

The future flag must not enable session start, session patch, session discard, DataHealth repair, backup/import/export, reset/recovery, or any broad mutation client.

## Request Shape

The future request should use a route-specific body:

```json
{
  "activeSessionId": "active-session-id",
  "sourceSnapshotHash": "source-snapshot-hash",
  "sourceSnapshotVersion": "phase5-session-complete-v1",
  "mutationId": "session-complete-mutation-id",
  "idempotencyKey": "session-complete-idempotency-key",
  "requestFingerprint": "session-complete-request-fingerprint",
  "confirmed": true,
  "confirmIncompleteMainWork": false
}
```

Task 5.17 may narrow this shape if the existing server contract requires it, but it must not broaden into discard, repair, backup/import/export, reset/recovery, or source-of-truth migration.

## Duplicate Complete Risk

Completing an active session writes a final history record. A duplicate complete can:

- create duplicate history records.
- lose or clear an active session twice.
- make local App state and Dev API state diverge.
- hide a failed first completion behind a fake second success.

Required gates:

- duplicate-submit lock.
- source snapshot metadata.
- idempotency key.
- request fingerprint.
- strict success shape.
- snapshot metadata required for success.
- visible failure for non-success states.

## Active Session Missing Risk

If no active session exists in the Dev API snapshot, the future prototype must treat the response as non-success.

No browser success state is allowed for `no_active_session`, `not_found`, stale active session identity, or missing active session metadata.

## History Duplicate Risk

The future prototype must not locally infer completion success. It must not create or append a history record in AppData. It must treat the server response as diagnostic output unless and until a later API-primary runtime task explicitly changes source-of-truth behavior.

History duplicate detection must be documented before implementation. The future prototype must not make training history authoritative from the browser result.

## Source Snapshot Mismatch

The future prototype must include:

- active session id.
- sourceSnapshotHash.
- sourceSnapshotVersion.
- mutationId.
- idempotencyKey.
- requestFingerprint.
- explicit confirmation.
- optional incomplete-main-work confirmation only when prompted.

Mismatched active session id, missing source snapshot, missing idempotency, or stale request fingerprint must fail before sending a request.

## Failure Recovery

Future failure behavior:

- unavailable Dev API: visible failure, App remains usable.
- timeout: visible failure, no auto retry.
- malformed response: visible failure.
- missing snapshot metadata: visible failure.
- no active session: visible failure.
- duplicate complete or history duplicate: visible failure.
- incomplete main work requires confirmation: visible confirmation state, not success.
- write_failed, transaction_failed, database_closed, unsupported_route: visible failure.

Recovery must be manual and dev-only:

- disable the mutation flag.
- refresh read-only diagnostics.
- use local App state as current source of truth.
- inspect the dedicated dev DB copy if needed.
- do not overwrite localStorage or AppData from the API response.

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

The future Task 5.17 implementation must be followed by acceptance and manual acceptance tasks. Manual acceptance must require:

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

- no implementation in Task 5.16.
- no App.tsx mount.
- no `src/devApi` runtime change.
- no session discard route.
- no DataHealth repair.
- no backup/import/export/reset/recovery HTTP route.
- no source-of-truth migration.
- no API primary runtime.
- no localStorage replacement.
- no broad mutation client.
- no production backend/auth/sync/cloud/deployment.

## Decision

Plan `POST /sessions/active/complete` as the next route-specific active-session prototype candidate, but do not implement it in Task 5.16.

Next recommended task: `Task 5.17 Session Complete Mutation Prototype V1`.

Task 5.17 may implement only `POST /sessions/active/complete` if gates pass.

## Decision Record

- Date: 2026-05-11
- Branch / commit: `codex/task5.16-session-complete-mutation-prototype-plan` / pending until merge
- Decision: plan a future dev-only session complete prototype.
- Future route: `POST /sessions/active/complete`
- Still blocked: session complete implementation, session discard, DataHealth repair, backup/import/export, reset/recovery, source-of-truth migration.
- Recommended next task: `Task 5.17 Session Complete Mutation Prototype V1`
- Rollback requirement: revert the Task 5.16 docs/static-test commit.

## Final Recommendation

Task 5.16 result: session complete prototype plan only.

Browser mutation routes remain exactly DataHealth dismiss, History data-flag, Limited History Edit, Session Start, and Session Patch.
localStorage remains source of truth.
API results never overwrite AppData or localStorage.
Next task should be Task 5.17 Session Complete Mutation Prototype V1 only if gates pass.
