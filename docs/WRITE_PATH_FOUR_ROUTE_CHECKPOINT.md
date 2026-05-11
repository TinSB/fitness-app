# Write-path Four-route Checkpoint

## Scope / Non-goals

This is a four-route write-path checkpoint for the current dev-only mutation prototype state.

- This is not a fifth mutation implementation.
- This is not source-of-truth migration.
- This is not localStorage replacement.
- This is not production backend readiness.
- This does not approve active session patch, complete, or discard mutation.
- This does not approve DataHealth repair.
- This does not approve backup/import/export/reset/recovery over HTTP.
- This does not add auth, sync, deployment, package dependencies, package scripts, lockfile changes, normalized tables, storage adapter changes, schema changes, or training algorithm changes.

## Current Browser Mutation Allowlist

Accepted browser mutation routes are exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`

No other browser mutation route is accepted.

## DataHealth Dismiss Status

DataHealth dismiss is implemented as the first dev-only, explicit opt-in prototype for `POST /data-health/issues/:issueId/dismiss`.

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

History data-flag is implemented as the second dev-only, explicit opt-in prototype for `POST /history/:id/data-flag`.

- Planned before implementation.
- Implemented as the second single-route prototype.
- Accepted with automated acceptance coverage.
- Manual acceptance exists.
- Hardened for strict no-fake-success, confirmation reset, duplicate-submit, abort/unmount, failure behavior, and route boundaries.
- `normal`, `test`, and `excluded` semantics are locked.
- Still dev-only.
- Source of truth remains localStorage.
- API results never overwrite AppData or localStorage.

## Limited History Edit Status

Limited History Edit is implemented as the third dev-only, explicit opt-in prototype for `POST /history/:id/edit`.

- Planned before implementation.
- Readiness-gated before implementation.
- Explicitly user-approved before implementation.
- Implemented as the third single-route prototype.
- Accepted with automated acceptance coverage.
- Manual acceptance exists.
- Hardened for strict no-fake-success, confirmation reset, source fingerprint, duplicate-submit, failure behavior, and route boundaries.
- Observability and recovery notes exist.
- Regression locked.
- Still dev-only.
- Source of truth remains localStorage.
- API results never overwrite AppData or localStorage.

## Session Start Status

Session Start is implemented as the fourth dev-only, explicit opt-in prototype for `POST /sessions/start`.

- Audited before implementation.
- Source snapshot and idempotency planned before implementation.
- UX confirmation and rollback planned before implementation.
- Prototype planned before implementation.
- Implemented as the fourth single-route prototype.
- Accepted with automated acceptance coverage.
- Manual acceptance exists.
- Hardened for strict no-fake-success, confirmation reset, source snapshot/idempotency metadata, duplicate-submit, failure behavior, and route boundaries.
- Observability and recovery notes exist.
- Regression locked.
- Still dev-only.
- Source of truth remains localStorage.
- API results never overwrite AppData or localStorage.

## Shared Mutation Safety Rules

All accepted mutation prototypes share these rules:

- Explicit dev-only opt-in is required.
- Route-specific mutation experiment flag is required.
- No fake success is allowed.
- Snapshot metadata is required for success.
- No localStorage write is allowed.
- No AppData overwrite is allowed.
- No optimistic success is allowed.
- No automatic retry is allowed.
- Duplicate submit is blocked.
- Confirmation is required where the prototype mutates data.
- Failure is visible.
- No raw stack, raw response, AppData dump, or localStorage dump is displayed.
- No repair, sync, overwrite, import, export, reset, recovery, apply, or fix controls are exposed.

## Route Boundary Matrix

Allowed:

| Area | Browser route | Status |
| --- | --- | --- |
| DataHealth dismiss | `POST /data-health/issues/:issueId/dismiss` | Accepted dev-only prototype |
| History data-flag | `POST /history/:id/data-flag` | Accepted dev-only prototype |
| Limited History Edit | `POST /history/:id/edit` | Accepted dev-only prototype |
| Session Start | `POST /sessions/start` | Accepted dev-only prototype |

Still blocked:

| Area | Route or capability | Status |
| --- | --- | --- |
| Session patches | `POST /sessions/active/patches` | Blocked |
| Session complete | `POST /sessions/active/complete` | Blocked |
| Session discard | `POST /sessions/active/discard` | Blocked |
| DataHealth repair | `POST /data-health/repair/apply` | Blocked |
| Backup/import/export | Backup, import, or export over HTTP | Blocked |
| Reset/recovery | Reset or recovery over HTTP | Blocked |
| Source-of-truth migration | API-backed persistence, dual-write, or migration | Blocked |
| Fifth mutation | Any new browser mutation route | Blocked |

## Source-of-truth Checkpoint

- localStorage remains current source of truth.
- API results do not overwrite localStorage.
- API results do not overwrite AppData.
- Snapshot metadata is not stored in localStorage by mutation prototypes.
- No API-backed persistence adapter exists.
- No dual-write strategy is active.
- No offline mutation queue exists.
- No source-of-truth switch is approved.
- Write-path migration remains blocked beyond dev-only prototypes.

## Data Semantics Checkpoint

- DataHealth dismiss does not change training set logs.
- History data-flag can affect default statistics only through accepted `normal`, `test`, and `excluded` semantics.
- Limited History Edit can affect recorded set values only through constrained one-set patch fields.
- Session Start can create active session state in the Dev API snapshot only; it does not mutate local activeSession.
- `actualWeightKg` remains the trusted calculation source.
- `displayWeight` and `displayUnit` remain display-only unless paired with `weightKg`.
- `identityInvalid` semantics remain unchanged.
- `normal`, `test`, and `excluded` semantics are locked.
- `test` and `excluded` remain visible but excluded from default production-like stats.
- PR, e1RM, effectiveSet, and weighted effectiveSet rules are unchanged.
- Backup import/export safety is unchanged.

## Manual Acceptance Inventory

Existing manual runbooks:

- Read-only App manual acceptance: `docs/READONLY_APP_MANUAL_ACCEPTANCE.md`
- DataHealth dismiss manual App acceptance: `docs/DATAHEALTH_DISMISS_MANUAL_APP_ACCEPTANCE.md`
- History data-flag manual App acceptance: `docs/HISTORY_DATA_FLAG_MANUAL_APP_ACCEPTANCE.md`
- Limited History Edit prototype acceptance: `docs/LIMITED_HISTORY_EDIT_PROTOTYPE_ACCEPTANCE.md`
- Limited History Edit manual App acceptance: `docs/LIMITED_HISTORY_EDIT_MANUAL_APP_ACCEPTANCE.md`
- Session Start prototype acceptance: `docs/SESSION_START_PROTOTYPE_ACCEPTANCE.md`
- Session Start manual App acceptance: `docs/SESSION_START_MANUAL_APP_ACCEPTANCE.md`
- Dev API runner manual acceptance: `docs/DEV_API_RUNNER_MANUAL_ACCEPTANCE.md`
- Recovery/reset runbook: `docs/DEV_API_RECOVERY_RESET.md`

## Regression Test Inventory

Current regression coverage includes:

- DataHealth dismiss config, client, prototype, acceptance, manual acceptance, hardening, observability, recovery, and regression lock tests.
- History data-flag config, client, prototype, acceptance, manual acceptance, hardening, server parity, and semantics tests.
- Limited History Edit config, client, prototype, readiness gate, acceptance, manual acceptance, hardening, observability, regression lock, server parity, and semantics tests.
- Session Start config, client, prototype, acceptance, manual acceptance, hardening, observability, regression lock, server parity, and semantics tests.
- Read-only runtime parity, localStorage integrity, diagnostics UX, API unavailable fallback, docs parity, and GET-only tests.
- Mutation readiness, source-of-truth, and UX planning tests.
- Runtime boundary tests for Node-only isolation, mutation contracts, repository contracts, persistence compatibility, data semantics, and server HTTP contract.

## Risk Register Before Any Fifth Mutation Or Source-of-truth Migration

| Risk | Severity | Mitigation | Required gate |
| --- | --- | --- | --- |
| Route surface expansion risk | High | Keep the browser allowlist exact and reject unapproved route strings in static tests. | Four-route boundary lock stays green. |
| Source-of-truth divergence risk | High | Keep localStorage as source of truth and avoid API result merge behavior. | LocalStorage integrity checks pass. |
| localStorage/API mismatch risk | Medium | Treat API reads and mutation snapshots as diagnostics only for App state. | Manual comparison confirms no overwrite. |
| Duplicate-submit risk | Medium | Keep pending locks and duplicate-submit tests for all prototypes. | Prototype hardening tests pass. |
| Active session data loss risk | High | Keep patch, complete, and discard blocked until a separate safety plan exists. | No active follow-up route appears. |
| Manual acceptance drift | Medium | Keep runbooks linked from the checkpoint and manual checklist. | Four-route manual regression completed. |
| Docs/implementation drift | Medium | Use docs parity tests against route constants and current docs. | Docs parity tests pass. |
| Production exposure risk | High | Keep prototypes dev-only and explicit opt-in. | Production-like build remains disabled. |
| Browser Node-only pollution risk | High | Scan browser source and dist for Node-only tokens. | Browser build isolation scan passes. |
| Destructive repair/backup/reset risk | High | Keep repair, backup/import/export, reset, and recovery HTTP routes blocked from browser code. | Boundary tests and manual Network checks pass. |

## Decision

Do not implement a fifth mutation next.

Next recommended task: `Task 4.67 Write-path Four-route Manual Regression V1`.

Reason: after checkpointing the four accepted dev-only mutation prototypes, the next safe step is to manually verify all four in one local App and Dev API session with read-only diagnostics, localStorage integrity checks, route-boundary checks, no-fake-success checks, and cleanup recorded.

## Required Gates Before Phase 4 Exit Audit

- Four-route checkpoint completed.
- Four-route manual regression completed.
- Four-route regression lock completed.
- Read-only diagnostics still green.
- DataHealth dismiss still green.
- History data-flag still green.
- Limited History Edit still green.
- Session Start still green.
- localStorage integrity confirmed.
- Browser route allowlist confirmed.
- No production/auth/sync assumption.
- Browser build clean.
- Docs and manual runbooks aligned.

## Decision Record

- Date: 2026-05-11
- Branch / commit: `codex/task4.66-write-path-four-route-checkpoint` / pending until merge
- Decision: checkpoint the current four-route write-path state and do not approve a fifth mutation.
- Current accepted routes: `POST /data-health/issues/:issueId/dismiss`; `POST /history/:id/data-flag`; `POST /history/:id/edit`; `POST /sessions/start`
- Rejected next steps: fifth mutation implementation, active session patch, active session complete, active session discard, DataHealth repair, backup/import/export over HTTP, reset/recovery over HTTP, production backend/auth/sync/deployment, source-of-truth migration, localStorage replacement, broad mutation client.
- Recommended next task: `Task 4.67 Write-path Four-route Manual Regression V1`
- Risks: route expansion, source-of-truth divergence, localStorage/API mismatch, duplicate-submit, active session data loss, manual acceptance drift, docs drift, production exposure, browser Node-only pollution, destructive repair/backup/reset behavior.
- Rollback requirement: because this checkpoint adds docs/static tests only, rollback is reverting the checkpoint commit; existing prototypes remain governed by their own flags and runbooks.

## Final Recommendation

Task 4.66 result: checkpoint only.
Browser mutation routes remain exactly DataHealth dismiss, History data-flag, Limited History Edit, and Session Start.
No fifth mutation is approved.
localStorage remains source of truth.
Next task should be Task 4.67 Write-path Four-route Manual Regression V1.

## Task 4.67 Manual Regression Follow-up

Task 4.67 adds `docs/WRITE_PATH_FOUR_ROUTE_MANUAL_REGRESSION.md` as a manual regression runbook for validating all four accepted dev-only mutation prototypes in one local App and Dev API session.

- It is manual regression documentation and static-test coverage only.
- Browser mutation routes remain exactly `POST /data-health/issues/:issueId/dismiss`, `POST /history/:id/data-flag`, `POST /history/:id/edit`, and `POST /sessions/start`.
- No fifth mutation route is approved.
- Active patch, active complete, active discard, DataHealth repair, backup/import/export, reset/recovery, and source-of-truth migration remain blocked.
- localStorage remains source of truth and API results never overwrite AppData or localStorage.
- The runbook verifies experiment-flag isolation, DevTools Network route boundaries, no-fake-success behavior, localStorage integrity, failure recovery, cleanup, and browser build safety.
- The next recommended task is `Task 4.68 Write-path Four-route Regression Lock V1`.
