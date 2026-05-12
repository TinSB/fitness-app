# Active Session Full Write-path Regression Lock

## Scope / Non-goals

Task 5.22 regression-locks the full active-session write-path prototype state after Session Start, Session Patch, Session Complete, and Session Discard have been implemented, accepted, and hardened.

- This is not an eighth mutation implementation.
- This does not add any new mutation route.
- This is not source-of-truth migration.
- This is not localStorage replacement.
- This is not API primary runtime implementation.
- This is not production backend readiness.
- This does not approve DataHealth repair.
- This does not approve backup/import/export/reset/recovery over HTTP.
- This does not add auth, sync, cloud, deployment, package dependencies, package scripts, lockfile changes, normalized tables, storage adapter changes, schema changes, or training algorithm changes.

## Current Accepted Browser Mutation Routes

Accepted browser mutation routes are exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

No other browser mutation route is accepted.

## Explicitly Blocked Routes

These routes and capabilities remain blocked from browser mutation code:

- `POST /data-health/repair/apply`
- backup/import/export over HTTP
- reset/recovery over HTTP
- source-of-truth migration outside approved Phase 5 runtime-source work
- broad frontend mutation client
- any eighth browser mutation route
- production backend/auth/sync/cloud/deployment

## Active Session Regression State

The accepted active-session dev-only prototypes are locked as:

- Session Start: planned, implemented, accepted, manually accepted, hardened, observed/recovery-noted, and regression locked.
- Session Patch: planned, implemented, accepted, hardened, and route-boundary locked.
- Session Complete: planned, implemented, accepted, hardened, and route-boundary locked.
- Session Discard: planned, implemented, accepted, hardened, and route-boundary locked.

All active-session prototypes remain dev-only and explicit opt-in. localStorage remains source of truth. API results never overwrite AppData or localStorage.

## Shared Active-session Regression Rules

All accepted active-session mutation prototypes must preserve:

- Explicit dev-only opt-in.
- Route-specific mutation experiment flag.
- Localhost-only Dev API base URL.
- No fake success.
- Snapshot metadata required for success.
- Source snapshot metadata required before request.
- Mutation id, idempotency key, and request fingerprint required before request.
- No localStorage write.
- No AppData overwrite.
- No optimistic local mutation.
- No automatic retry.
- Duplicate submit blocked while pending.
- Confirmation required where the prototype mutates or may destroy active training state.
- Failure visible.
- No raw stack, raw response, AppData dump, localStorage dump, SQLite internals, or repository internals.
- No repair, sync, overwrite, import, export, reset, recovery, apply, or fix controls.

## Seven-route Allowlist Matrix

Allowed:

| Area | Browser route | Status |
| --- | --- | --- |
| DataHealth dismiss | `POST /data-health/issues/:issueId/dismiss` | Accepted dev-only prototype |
| History data-flag | `POST /history/:id/data-flag` | Accepted dev-only prototype |
| Limited History Edit | `POST /history/:id/edit` | Accepted dev-only prototype |
| Session Start | `POST /sessions/start` | Accepted dev-only prototype |
| Session Patch | `POST /sessions/active/patches` | Accepted dev-only prototype |
| Session Complete | `POST /sessions/active/complete` | Accepted dev-only prototype |
| Session Discard | `POST /sessions/active/discard` | Accepted dev-only prototype |

Blocked:

| Area | Route or capability | Status |
| --- | --- | --- |
| DataHealth repair | `POST /data-health/repair/apply` | Blocked |
| Backup/import/export | Backup/import/export over HTTP | Blocked |
| Reset/recovery | Reset/recovery over HTTP | Blocked |
| Source-of-truth migration | API-backed persistence, dual-write, or source migration outside approved Phase 5 runtime-source work | Blocked |
| Broad mutation client | Generic browser mutation client or route dispatcher | Blocked |
| Eighth mutation | Any new browser mutation route | Blocked |
| Production exposure | Production backend/auth/sync/cloud/deployment | Blocked |

## Source-of-truth Regression Lock

- localStorage remains default App runtime source of truth.
- API results do not silently overwrite localStorage.
- API results do not silently overwrite AppData.
- Snapshot metadata is not stored in localStorage by mutation prototypes.
- API-backed persistence adapter is not active yet.
- No dual-write strategy is active yet.
- No offline mutation queue exists.
- No source-of-truth switch is approved before the explicit Phase 5 runtime-source tasks.

## Active Session Data Safety Lock

- Session Start creates active training state only in the Dev API snapshot.
- Session Patch applies active-session patches only in the Dev API snapshot.
- Session Complete completes active training state only in the Dev API snapshot.
- Session Discard discards active training state only in the Dev API snapshot.
- Browser prototypes must not mutate local activeSession from API results.
- Browser prototypes must not append, edit, remove, or clear local history from API results.
- Duplicate start, patch, complete, and discard must stay blocked while pending.
- Source snapshot mismatch, missing idempotency, missing snapshot metadata, timeout, unavailable API, malformed response, and known server non-success states must remain visible failure.

## Data Semantics Regression Lock

- Active-session prototypes do not change training algorithms, templates, scheduler, PR, e1RM, effectiveSet, or weighted effectiveSet rules.
- Session Discard does not write history.
- Session Complete history-write semantics remain owned by the server-side session mutation handler for the Dev API snapshot only.
- Session Patch does not alter browser-side training logic.
- History data-flag `normal`, `test`, and `excluded` semantics remain locked.
- Limited History Edit field constraints remain locked.
- DataHealth dismiss does not change training set logs.
- Backup import/export safety is unchanged.

## Test Coverage Inventory

Coverage families that must remain present and runnable under the configured Vitest glob:

- DataHealth dismiss config/client/prototype/acceptance/manual/hardening/observability/regression.
- History data-flag config/client/prototype/acceptance/manual/hardening/regression.
- Limited History Edit config/client/prototype/acceptance/manual/hardening/observability/regression.
- Session Start config/client/prototype/acceptance/manual/hardening/observability/regression.
- Session Patch config/client/prototype/acceptance/hardening/boundary.
- Session Complete config/client/prototype/acceptance/hardening/boundary.
- Session Discard config/client/prototype/acceptance/hardening/boundary.
- Read-only runtime parity.
- API-backed read runtime regression lock remains GET-only until runtime-source tasks.
- Runtime boundary tests.
- Server/http/sqlite tests.

## Manual Acceptance Inventory

Manual runbooks that must remain present:

- Dev API runner manual acceptance: `docs/DEV_API_RUNNER_MANUAL_ACCEPTANCE.md`
- Read-only App manual acceptance: `docs/READONLY_APP_MANUAL_ACCEPTANCE.md`
- DataHealth dismiss manual App acceptance: `docs/DATAHEALTH_DISMISS_MANUAL_APP_ACCEPTANCE.md`
- History data-flag manual App acceptance: `docs/HISTORY_DATA_FLAG_MANUAL_APP_ACCEPTANCE.md`
- Limited History Edit manual App acceptance: `docs/LIMITED_HISTORY_EDIT_MANUAL_APP_ACCEPTANCE.md`
- Session Start manual App acceptance: `docs/SESSION_START_MANUAL_APP_ACCEPTANCE.md`
- Session Discard acceptance/hardening: `docs/SESSION_DISCARD_ACCEPTANCE_HARDENING.md`
- Manual API acceptance checklist: `docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md`
- Recovery/reset runbook: `docs/DEV_API_RECOVERY_RESET.md`

## Future Work Gate

Before API-backed persistence facade planning:

- Active-session full write-path regression lock must remain green.
- Accepted route allowlist must remain exactly seven routes.
- localStorage integrity must remain verified.
- Read-only diagnostics must remain separate and green.
- No-fake-success must remain green for all accepted mutation prototypes.
- Browser build must remain clean.
- Docs/manual runbooks must remain aligned.
- No production/auth/sync/cloud/deployment assumption may be introduced.
- No DataHealth repair, backup/import/export, reset/recovery, broad mutation client, or eighth route may be added.

## Decision

Do not implement API-backed persistence yet.

Next recommended task: `Task 5.23 API-backed Persistence Facade Plan V1`.

Task 5.23 must be planning-only. It must not implement a persistence adapter, runtime source selector, source-of-truth switch, localStorage replacement, production backend/auth/sync/cloud/deployment, or another mutation route.

## Decision Record

- Date: 2026-05-12
- Branch / commit: `codex/task5.22-active-session-full-write-path-regression-lock` / pending until merge
- Decision: lock the current active-session full write-path and keep browser mutation routes exactly seven.
- Current accepted routes: `POST /data-health/issues/:issueId/dismiss`; `POST /history/:id/data-flag`; `POST /history/:id/edit`; `POST /sessions/start`; `POST /sessions/active/patches`; `POST /sessions/active/complete`; `POST /sessions/active/discard`
- Rejected next steps: eighth mutation implementation, DataHealth repair, backup/import/export over HTTP, reset/recovery over HTTP, production backend/auth/sync/cloud/deployment, source-of-truth migration implementation, localStorage replacement, broad mutation client.
- Recommended next task: `Task 5.23 API-backed Persistence Facade Plan V1`
- Risks: route expansion, source-of-truth divergence, localStorage/API mismatch, duplicate-submit, active session data loss, manual acceptance drift, docs drift, production exposure, browser Node-only pollution, destructive repair/backup/reset behavior.
- Rollback requirement: because this regression lock adds docs/static tests only, rollback is reverting the regression-lock commit; existing prototypes remain governed by their own flags and runbooks.

## Final Recommendation

Task 5.22 result: regression lock only.
Browser mutation routes remain exactly DataHealth dismiss, History data-flag, Limited History Edit, Session Start, Session Patch, Session Complete, and Session Discard.
No eighth mutation is approved.
localStorage remains source of truth.
Next task should be Task 5.23 API-backed Persistence Facade Plan V1, planning-only.
