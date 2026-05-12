# Session Complete Acceptance / Hardening

Task 5.18 accepts and hardens the existing dev-only session complete browser prototype for `POST /sessions/active/complete`.

This is acceptance and hardening only. It does not add a browser route, does not implement `POST /sessions/active/discard`, does not add DataHealth repair, does not add backup/import/export/reset/recovery HTTP routes, does not add a broad mutation client, does not add API primary runtime, does not switch source of truth, does not replace localStorage, does not add production backend, auth, sync, cloud, deployment, dependency, package script, normalized table, or training algorithm change.

localStorage remains source of truth. API results never overwrite AppData or localStorage.

## Accepted Route

Accepted browser mutation routes are exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`

Still blocked:

- `POST /sessions/active/discard`
- `POST /data-health/repair/apply`
- backup/import/export over HTTP
- reset/recovery over HTTP
- source-of-truth migration outside approved Phase 5 runtime work

## Acceptance Matrix

| Scenario | Expected result |
| --- | --- |
| Correct `session-complete` flag, compare enabled, localhost base URL, active session, source snapshot metadata, confirmation | May send exactly `POST /sessions/active/complete` |
| Compare flag only | No mutation prototype |
| Other mutation flag | Session complete prototype does not appear |
| No active session | No request sent or non-success `no_active_session` response |
| Active session id mismatch | No request sent |
| Missing source snapshot metadata | No request sent |
| Missing mutation id, idempotency key, or request fingerprint | No request sent |
| Cancel confirmation | No request sent |
| Pending submit | Duplicate complete blocked |
| HTTP success with `ok=true`, `changed=true`, `status="success"`, and snapshot metadata | Success may be shown |
| HTTP success without snapshot metadata | Failure, no fake success |
| `requiresConfirmation=true` for incomplete main work | Failure until a separate explicit confirmation is provided |
| `ok=true`, `changed=false`, `status="no_change"` | Failure, no fake success |
| unavailable, timeout, malformed response, abort, error response | Failure, no fake success |

## Hardening Requirements

- Duplicate complete submit must be blocked while pending.
- Missing active session must be non-success.
- Invalid active session identity must fail before the request.
- Incomplete main work must require explicit confirmation and must not be represented as success.
- Timeout and unavailable Dev API states must show visible failure.
- Malformed response and missing snapshot metadata must show visible failure.
- Server `no_change`, `no_active_session`, `incomplete_main_work_requires_confirmation`, `write_failed`, `transaction_failed`, `database_closed`, and `unsupported_route` must not show success.
- Confirmation must reset after success, failure, target change, or cancel.
- No optimistic local active session completion is allowed.
- No localStorage write is allowed.
- No AppData overwrite is allowed.
- No auto retry is allowed.
- No raw stack, raw response, AppData dump, localStorage dump, SQLite internals, or repository internals may be displayed.

## LocalStorage Integrity

- Snapshot localStorage before testing.
- Run read-only diagnostics first.
- Enable only `VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT="session-complete"` for the complete flow.
- Confirm the App does not write API response data into localStorage.
- Confirm API result data never overwrites AppData.
- Confirm localStorage remains the default App runtime source of truth.

## AppData Integrity

- Capture the AppData object before a session complete prototype request.
- Submit only after explicit confirmation.
- Confirm the API response is treated as diagnostic output in the prototype.
- Confirm the browser does not locally clear `activeSession`.
- Confirm the browser does not locally append a history item from the API response.

## Manual Acceptance Notes

- Use a dedicated test browser profile.
- Use a dedicated dev DB file.
- Do not use real personal training data.
- Start the Dev API runner before enabling the mutation flag.
- Confirm DevTools Network shows no POST before explicit confirmation.
- Confirm the only POST in the session complete flow is `POST /sessions/active/complete`.
- Confirm Network never shows session discard, DataHealth repair, backup/import/export, reset, or recovery mutation routes.
- Stop the App and Dev API runner after testing.
- Clear `VITE_IRONPATH_DEV_API_COMPARE`, `VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT`, and `VITE_IRONPATH_DEV_API_BASE_URL`.

## Browser Build Safety

`npm run build` must pass and the built browser bundle must not contain:

- `node:http`
- `node:sqlite`
- `devLauncher`
- `httpRuntimeAdapter`
- `serverAdapter`
- `sqliteRepository`
- `devApiRunner`
- `devDbRecovery`

## Decision

Task 5.18 result: session complete acceptance and hardening only.

The session complete prototype remains dev-only, explicit opt-in, route-specific, and non-production.

No session discard route is implemented.

Next recommended task: `Task 5.19 Session Discard Mutation Prototype Plan V1`.

## Decision Record

- Date: 2026-05-11
- Branch / commit: `codex/task5.18-session-complete-acceptance-hardening` / pending until merge
- Decision: accept and harden the session complete prototype without route expansion.
- Accepted route before this task: `POST /sessions/active/complete`
- Still blocked: session discard, DataHealth repair, backup/import/export, reset/recovery, broad mutation client, production backend/auth/sync/cloud/deployment, source-of-truth migration.
- Source of truth: localStorage remains source of truth.
- Rollback requirement: revert the Task 5.18 docs/static-test commit.

## Task 5.19 Follow-up: Session Discard Plan

Task 5.19 adds `docs/SESSION_DISCARD_MUTATION_PROTOTYPE_PLAN.md` as a planning-only route-specific plan for future `POST /sessions/active/discard`.

It does not implement session discard, does not add another browser route, and does not change source-of-truth behavior.

Next task: `Task 5.19 Session Discard Mutation Prototype Plan V1`.

## Task 5.19 Follow-up: Session Discard Plan

Task 5.19 plans the future dev-only `POST /sessions/active/discard` prototype and keeps implementation blocked.

The plan documents unsaved training state loss risk, strong confirmation, visible recovery policy, no history write behavior, source snapshot metadata, idempotency, duplicate discard prevention, no-fake-success behavior, and localStorage/AppData integrity.

Accepted browser mutation routes remain exactly DataHealth dismiss, History data-flag, Limited History Edit, Session Start, Session Patch, and Session Complete.

Next task should be Task 5.20 Session Discard Mutation Prototype V1 only if gates pass.
