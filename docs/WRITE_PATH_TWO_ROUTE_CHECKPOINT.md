# Write-path Two-route Checkpoint

## Scope / Non-goals

This is a two-route write-path checkpoint for the current dev-only mutation prototype state.

- This is not a third mutation implementation.
- This is not source-of-truth migration.
- This is not localStorage replacement.
- This is not production backend readiness.
- This does not approve session mutation.
- This does not approve history edit.
- This does not approve DataHealth repair.
- This does not approve backup/import/export/reset over HTTP.
- This does not add auth, sync, deployment, package dependencies, package scripts, normalized tables, storage adapter changes, schema changes, or training algorithm changes.

## Current Browser Mutation Allowlist

Accepted browser mutation routes are exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`

No other browser mutation route is accepted.

## DataHealth Dismiss Status

DataHealth dismiss is implemented as a dev-only, explicit opt-in prototype for `POST /data-health/issues/:issueId/dismiss`.

- Implemented in the browser prototype.
- Accepted with automated acceptance coverage.
- Manual acceptance exists.
- Hardened for strict no-fake-success, confirmation, duplicate-submit, and failure behavior.
- Observability and recovery notes exist.
- Regression locked.
- Still dev-only.
- Source of truth remains localStorage.
- API results never overwrite AppData or localStorage.

## History Data-flag Status

History data-flag is implemented as a dev-only, explicit opt-in prototype for `POST /history/:id/data-flag`.

- Planned before implementation.
- Implemented as the second single-route prototype.
- Accepted with automated acceptance coverage.
- Manual acceptance exists.
- Hardened for strict no-fake-success, confirmation reset, duplicate-submit, abort/unmount, failure behavior, and route boundaries.
- `normal`, `test`, and `excluded` semantics are locked.
- Still dev-only.
- Source of truth remains localStorage.
- API results never overwrite AppData or localStorage.

## Shared Mutation Safety Rules

Both accepted mutation prototypes share these rules:

- Explicit dev-only opt-in is required.
- No fake success is allowed.
- Snapshot metadata is required for success.
- No localStorage write is allowed.
- No AppData overwrite is allowed.
- No optimistic success is allowed.
- No automatic retry is allowed.
- Duplicate submit is blocked.
- Confirmation is required.
- Failure is visible.
- No raw stack, raw response, AppData dump, or localStorage dump is displayed.
- No repair, sync, overwrite, import, export, reset, apply, or fix controls are exposed.

## Route Boundary Matrix

Allowed:

| Area | Browser route | Status |
| --- | --- | --- |
| DataHealth dismiss | `POST /data-health/issues/:issueId/dismiss` | Accepted dev-only prototype |
| History data-flag | `POST /history/:id/data-flag` | Accepted dev-only prototype |

Still blocked:

| Area | Route or capability | Status |
| --- | --- | --- |
| Session start | `POST /sessions/start` | Blocked |
| Session patches | `POST /sessions/active/patches` | Blocked |
| Session complete | `POST /sessions/active/complete` | Blocked |
| Session discard | `POST /sessions/active/discard` | Blocked |
| History edit | `POST /history/:id/edit` | Blocked |
| DataHealth repair | `POST /data-health/repair/apply` | Blocked |
| Backup/import/export | Backup, import, or export over HTTP | Blocked |
| Reset/recovery | Reset or recovery over HTTP | Blocked |
| Source-of-truth migration | API-backed persistence, dual-write, or migration | Blocked |

## Source-of-truth Checkpoint

- localStorage remains current source of truth.
- API results do not overwrite localStorage.
- API results do not overwrite AppData.
- No API-backed persistence adapter exists.
- No dual-write strategy is active.
- No offline mutation queue exists.
- No source-of-truth switch is approved.
- Write-path migration remains blocked.

## Data Semantics Checkpoint

- DataHealth dismiss does not change training set logs.
- History data-flag can affect default statistics.
- `normal`, `test`, and `excluded` semantics are locked.
- `test` and `excluded` remain visible but excluded from default stats.
- `normal` participates in default stats.
- `actualWeightKg` remains the trusted calculation source.
- `identityInvalid` semantics remain unchanged.
- PR, e1RM, effectiveSet, and weighted effectiveSet rules are unchanged.
- Backup import/export safety is unchanged.

## Manual Acceptance Inventory

Existing manual runbooks:

- Read-only App manual acceptance: `docs/READONLY_APP_MANUAL_ACCEPTANCE.md`
- DataHealth dismiss manual App acceptance: `docs/DATAHEALTH_DISMISS_MANUAL_APP_ACCEPTANCE.md`
- History data-flag manual App acceptance: `docs/HISTORY_DATA_FLAG_MANUAL_APP_ACCEPTANCE.md`
- Dev API runner manual acceptance: `docs/DEV_API_RUNNER_MANUAL_ACCEPTANCE.md`
- Recovery/reset runbook: `docs/DEV_API_RECOVERY_RESET.md`

## Regression Test Inventory

Current regression coverage includes:

- DataHealth dismiss config, client, prototype, acceptance, manual acceptance, hardening, observability, recovery, and regression lock tests.
- History data-flag config, client, prototype, acceptance, manual acceptance, hardening, server parity, and semantics tests.
- Read-only runtime parity, localStorage integrity, diagnostics UX, API unavailable fallback, docs parity, and GET-only tests.
- Mutation readiness, source-of-truth, and UX planning tests.
- Runtime boundary tests for Node-only isolation, mutation contracts, repository contracts, persistence compatibility, data semantics, and server HTTP contract.

## Risk Register Before Any Third Mutation

| Risk | Severity | Mitigation | Required gate |
| --- | --- | --- | --- |
| Route surface expansion risk | High | Keep the browser allowlist exact and reject unapproved route strings in static tests. | Two-route boundary lock stays green. |
| Source-of-truth divergence risk | High | Keep localStorage as source of truth and avoid API result merge behavior. | LocalStorage integrity checks pass. |
| localStorage/API mismatch risk | Medium | Treat API reads and mutation snapshots as diagnostics only for App state. | Manual comparison confirms no overwrite. |
| Duplicate-submit risk | Medium | Keep pending locks and duplicate-submit tests for both prototypes. | Prototype hardening tests pass. |
| Manual acceptance drift | Medium | Keep runbooks linked from the checkpoint and manual checklist. | Two-route manual regression completed. |
| Docs/implementation drift | Medium | Use docs parity tests against route constants and current docs. | Docs parity tests pass. |
| Production exposure risk | High | Keep prototypes dev-only and explicit opt-in. | Production-like build remains disabled. |
| Browser Node-only pollution risk | High | Scan browser source and dist for Node-only tokens. | Browser build isolation scan passes. |
| Session state data loss risk | High | Keep session mutation routes blocked. | No `POST /sessions/*` browser route appears. |
| History edit corruption risk | High | Keep history edit blocked until a separate audit, plan, and acceptance path exists. | No `POST /history/:id/edit` browser route appears. |
| Repair/backup/reset destructive risk | High | Keep repair, backup/import/export, reset, and recovery HTTP routes blocked from browser code. | Boundary tests and manual Network checks pass. |

## Decision

Do not implement a third mutation next.

Next recommended task: `Task 4.41 Write-path Two-route Manual Regression V1`.

Reason: before evaluating a third mutation, both existing mutation prototypes should be manually verified together in one browser and Dev API session with read-only diagnostics, localStorage integrity checks, route-boundary checks, and cleanup recorded.

## Required Gates Before Third Mutation Audit

- Two-route checkpoint completed.
- Two-route manual regression completed.
- Read-only diagnostics still green.
- DataHealth dismiss still green.
- History data-flag still green.
- localStorage integrity confirmed.
- Browser route allowlist confirmed.
- No production/auth/sync assumption.
- Browser build clean.
- Docs and manual runbooks aligned.

## Decision Record

- Date: 2026-05-10
- Branch / commit: `codex/task4.40-write-path-two-route-checkpoint` / pending until merge
- Decision: checkpoint the current two-route write-path state and do not approve a third mutation.
- Current accepted routes: `POST /data-health/issues/:issueId/dismiss`; `POST /history/:id/data-flag`
- Rejected next steps: third mutation implementation, session mutation, history edit, DataHealth repair, backup/import/export over HTTP, reset/recovery over HTTP, production backend/auth/sync/deployment, source-of-truth migration, localStorage replacement, broad mutation client.
- Recommended next task: `Task 4.41 Write-path Two-route Manual Regression V1`
- Risks: route expansion, source-of-truth divergence, localStorage/API mismatch, duplicate-submit, manual acceptance drift, docs drift, production exposure, browser Node-only pollution, session data loss, history edit corruption, destructive repair/backup/reset behavior.
- Rollback requirement: because this checkpoint adds docs/static tests only, rollback is reverting the checkpoint commit; existing prototypes remain governed by their own flags and runbooks.

## Final Recommendation

Task 4.40 result: checkpoint only.
Browser mutation routes remain exactly DataHealth dismiss and History data-flag.
No third mutation is approved.
localStorage remains source of truth.
Next task should be Task 4.41 Write-path Two-route Manual Regression V1.

## Task 4.41 Manual Regression Follow-up

Task 4.41 adds `docs/WRITE_PATH_TWO_ROUTE_MANUAL_REGRESSION.md` as a manual regression runbook for validating both accepted dev-only mutation prototypes in one local App and Dev API session.

- It is manual regression documentation and static-test coverage only.
- Browser mutation routes remain exactly `POST /data-health/issues/:issueId/dismiss` and `POST /history/:id/data-flag`.
- No third mutation route is approved.
- localStorage remains source of truth and API results never overwrite AppData or localStorage.
- The runbook verifies experiment-flag isolation, DevTools Network route boundaries, no-fake-success behavior, localStorage integrity, failure recovery, cleanup, and browser build safety.
