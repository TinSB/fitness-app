# Session Patch Prototype Acceptance / Hardening

Task 5.15 accepts and hardens the dev-only session patch browser prototype for `POST /sessions/active/patches`.

This is acceptance and hardening only. It does not add a browser route, does not implement `POST /sessions/active/complete`, does not implement `POST /sessions/active/discard`, does not add DataHealth repair, does not add backup/import/export/reset/recovery HTTP routes, does not add a broad mutation client, does not add API primary runtime, does not switch source of truth, does not replace localStorage, does not add production backend, auth, sync, cloud, deployment, dependency, package script, normalized table, or training algorithm change.

localStorage remains source of truth. API results never overwrite AppData or localStorage.

## Accepted Route

Accepted browser mutation routes are exactly:

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

## Acceptance Matrix

| Scenario | Expected result |
| --- | --- |
| Correct `session-patch` flag, compare enabled, localhost base URL, active session, pending patch, confirmation | May send exactly `POST /sessions/active/patches` |
| Compare flag only | No mutation prototype |
| Other mutation flag | Session patch prototype does not appear |
| No active session | No request sent |
| No pending patch target | No request sent |
| Cancel confirmation | No request sent |
| Pending submit | Duplicate submit blocked |
| HTTP success with `ok=true`, `changed=true`, `status="success"`, and snapshot metadata | Success may be shown |
| HTTP success without snapshot metadata | Failure, no fake success |
| `ok=true`, `changed=false`, `status="no_change"` | Failure, no fake success |
| unavailable, timeout, malformed response, abort, error response | Failure, no fake success |

## Hardening Requirements

- Duplicate patch submit must be blocked while pending.
- Out-of-order patch application must not be represented as local success.
- Stale source snapshot or target metadata mismatch must fail before the request.
- Invalid active session id, missing pending patch id, and empty explicit patch list must fail before the request.
- Timeout and unavailable Dev API states must show visible failure.
- Malformed response and missing snapshot metadata must show visible failure.
- Server `no_change`, `pending_patch_not_found`, `no_active_session`, `write_failed`, `transaction_failed`, `database_closed`, and `unsupported_route` must not show success.
- No optimistic local active session mutation is allowed.
- No localStorage write is allowed.
- No AppData overwrite is allowed.
- No auto retry is allowed.
- No raw stack, raw response, AppData dump, localStorage dump, or repository internals may be displayed.

## LocalStorage Integrity

- Snapshot localStorage before testing.
- Run read-only diagnostics first.
- Enable only `VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT="session-patch"` for the patch flow.
- Confirm the App does not write API response data into localStorage.
- Confirm API result data never overwrites AppData.
- Confirm localStorage remains the default App runtime source of truth.

## Manual Acceptance Notes

- Use a dedicated test browser profile.
- Use a dedicated dev DB file.
- Do not use real personal training data.
- Start the Dev API runner before enabling the mutation flag.
- Confirm DevTools Network shows no POST before explicit confirmation.
- Confirm the only POST in the session patch flow is `POST /sessions/active/patches`.
- Confirm Network never shows session complete, session discard, DataHealth repair, backup/import/export, reset, or recovery mutation routes.
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

Task 5.15 result: session patch acceptance and hardening only.

The session patch prototype remains dev-only, explicit opt-in, route-specific, and non-production.

No session complete or discard route is implemented.

Next recommended task: `Task 5.16 Session Complete Mutation Prototype Plan V1`.

## Decision Record

- Date: 2026-05-11
- Branch / commit: `codex/task5.15-session-patch-prototype-acceptance-hardening` / pending until merge
- Decision: accept and harden the session patch prototype without route expansion.
- Accepted route added before this task: `POST /sessions/active/patches`
- Still blocked: session complete, session discard, DataHealth repair, backup/import/export, reset/recovery, broad mutation client, production backend/auth/sync/cloud/deployment, source-of-truth migration.
- Source of truth: localStorage remains source of truth.
- Rollback requirement: revert the Task 5.15 docs/static-test commit.

## Task 5.16 Follow-up: Session Complete Plan

Task 5.16 adds `docs/SESSION_COMPLETE_MUTATION_PROTOTYPE_PLAN.md` as a planning-only route-specific plan for future `POST /sessions/active/complete`.

It does not implement session complete, does not implement session discard, and does not change source-of-truth behavior.

Next task: `Task 5.17 Session Complete Mutation Prototype V1`.
