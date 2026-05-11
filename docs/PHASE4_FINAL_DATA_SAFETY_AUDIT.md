# Phase 4 Final Data Safety Audit

## Scope / Non-goals

Task 4.71 is a final Phase 4 data safety audit.

- This does not add runtime behavior.
- This does not add a browser mutation route.
- This does not switch source of truth.
- This does not replace localStorage.
- This does not implement API-backed runtime.
- This does not add production backend, auth, sync, or deployment.
- This does not add package dependencies, package scripts, lockfile changes, normalized tables, schemas, storage adapters, or training algorithm changes.

## Accepted Routes

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`

## Blocked Routes

Blocked browser mutation routes and capabilities remain:

- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`
- `POST /data-health/repair/apply`
- backup/import/export over HTTP
- reset/recovery over HTTP
- fifth browser mutation route
- source-of-truth migration
- API-backed runtime persistence
- broad frontend mutation client

## Source-of-truth Lock

- localStorage remains current source of truth.
- API results do not overwrite AppData.
- API results do not overwrite localStorage.
- No API-backed persistence adapter exists.
- No dual-write strategy exists.
- No offline mutation queue exists.
- No source-of-truth switch is approved in Phase 4.

## LocalStorage Integrity

The accepted prototypes must not call `saveData`, `loadData`, `localStorageAdapter`, or mutate local AppData from API results. Snapshot metadata remains diagnostic-only and is not stored in localStorage by mutation prototypes.

## No-fake-success Lock

Every accepted mutation prototype requires:

- HTTP success.
- mutation result success.
- changed result where applicable.
- success status.
- snapshot metadata.

Unavailable, timeout, abort, malformed response, not_found, no_change, active_session_exists, write_failed, transaction_failed, database_closed, unsupported_route, missing snapshot metadata, or invalid target remains failure.

## Backup / Import Safety

Backup import/export safety remains unchanged.

- No backup/import/export HTTP route is exposed to the browser.
- No backup restore is triggered by mutation prototypes.
- No reset/recovery HTTP route is exposed to the browser.
- Existing backup import/export validation semantics remain unchanged.

## ReadMirror / Read-only Parity

- Read-only diagnostics remain GET-only.
- ReadMirror/server parity remains diagnostic.
- Read-only comparison cannot write localStorage.
- API unavailable fallback remains safe.
- Mismatch remains diagnostic-only.

## Runtime Boundary

Browser source and browser build output must remain free of:

- `node:http`
- `node:sqlite`
- `devLauncher`
- `httpRuntimeAdapter`
- `serverAdapter`
- `sqliteRepository`
- `devApiRunner`
- `devDbRecovery`

## Risk Register

| Risk | Severity | Mitigation | Required gate |
| --- | --- | --- | --- |
| Source-of-truth drift | High | Keep localStorage authoritative through Phase 4. | Source boundary tests pass. |
| LocalStorage overwrite | High | Keep API results diagnostic-only. | LocalStorage integrity tests pass. |
| Fake success | High | Require snapshot metadata and strict success shape. | Hardening tests pass. |
| Active session data loss | High | Keep patch/complete/discard blocked. | Four-route boundary tests pass. |
| Backup/import damage | High | Keep backup/import/export HTTP blocked. | Runtime boundary tests pass. |
| Production exposure | High | Keep prototypes dev-only. | Production-like build remains disabled. |
| Browser Node-only pollution | High | Keep browser build clean. | Dist scan passes. |

## Decision

Phase 4 data safety remains acceptable for dev-only prototypes only.

Next recommended task: `Task 4.72 Phase 4 Manual Final Acceptance V1`.

Task 4.72 must be manual-acceptance documentation and static tests only. It must not switch source of truth, replace localStorage, add API-backed runtime behavior, add production backend/auth/sync/deployment, or add another mutation route.

## Decision Record

- Date: 2026-05-11
- Branch / commit: `codex/task4.71-phase4-final-data-safety-audit` / pending until merge
- Decision: record final Phase 4 data safety status before final manual acceptance.
- Current accepted routes: `POST /data-health/issues/:issueId/dismiss`; `POST /history/:id/data-flag`; `POST /history/:id/edit`; `POST /sessions/start`
- Rejected next steps: fifth mutation implementation, active session patch/complete/discard, DataHealth repair, backup/import/export over HTTP, reset/recovery over HTTP, production backend/auth/sync/deployment, source-of-truth migration implementation, localStorage replacement, broad mutation client.
- Recommended next task: `Task 4.72 Phase 4 Manual Final Acceptance V1`
- Rollback requirement: because this audit adds docs/static tests only, rollback is reverting the audit commit.

## Final Recommendation

Task 4.71 result: final data safety audit only.
localStorage remains source of truth.
API results never overwrite AppData or localStorage.
No production backend, auth, sync, or deployment is added.
No source-of-truth migration is implemented.
Next task should be Task 4.72 Phase 4 Manual Final Acceptance V1.

## Task 4.72 Manual Final Acceptance Follow-up

Task 4.72 adds `docs/PHASE4_MANUAL_FINAL_ACCEPTANCE.md` as the final manual acceptance runbook.

- It does not add runtime behavior.
- It does not add a mutation route.
- It keeps localStorage as source of truth.
- It covers Dev API runner, read-only diagnostics, all four accepted mutation prototypes, route boundaries, localStorage integrity, failure recovery, cleanup, and pass/fail recording.
- It recommends Task 4.73 Phase 4 Exit Regression Lock V1.
