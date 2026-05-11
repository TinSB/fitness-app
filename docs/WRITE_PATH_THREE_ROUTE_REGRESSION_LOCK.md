# Write-path Three-route Regression Lock

## Scope / Non-goals

This is the regression lock for the current dev-only three-route write-path prototype state.

- This is not a fourth mutation implementation.
- This is not source-of-truth migration.
- This is not localStorage replacement.
- This is not production backend readiness.
- This does not approve session mutation.
- This does not approve DataHealth repair.
- This does not approve backup/import/export/reset/recovery over HTTP.
- This does not add auth, sync, deployment, package dependencies, package scripts, lockfile changes, normalized tables, storage adapter changes, schema changes, or training algorithm changes.

## Current Accepted Browser Mutation Routes

Accepted browser mutation routes are exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`

No other browser mutation route is accepted.

## Explicitly Blocked Routes

These routes and capabilities remain blocked from browser mutation code:

- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`
- `POST /data-health/repair/apply`
- backup/import/export over HTTP
- reset/recovery over HTTP
- source-of-truth migration
- broad frontend mutation client
- fourth mutation route

## DataHealth Dismiss Regression State

DataHealth dismiss is locked as the first dev-only browser mutation prototype.

- Implemented.
- Accepted.
- Manually accepted.
- Hardened.
- Observability/recovery documented.
- Regression locked.
- No-fake-success locked.
- Dev-only.
- Source of truth remains localStorage.
- API results never overwrite AppData or localStorage.

## History Data-flag Regression State

History data-flag is locked as the second dev-only browser mutation prototype.

- Planned.
- Implemented.
- Accepted.
- Manually accepted.
- Hardened.
- `normal`, `test`, and `excluded` semantics locked.
- No-fake-success locked.
- Dev-only.
- Source of truth remains localStorage.
- API results never overwrite AppData or localStorage.

## Limited History Edit Regression State

Limited History Edit is locked as the third dev-only browser mutation prototype.

- Planned.
- Readiness-gated.
- Explicitly user-approved.
- Implemented.
- Accepted.
- Manually accepted.
- Hardened.
- Observability/recovery documented.
- Regression locked.
- No-fake-success locked.
- Dev-only.
- Source of truth remains localStorage.
- API results never overwrite AppData or localStorage.

## Shared Three-route Regression Rules

All accepted mutation prototypes must preserve:

- Explicit dev-only opt-in.
- Route-specific mutation experiment flag.
- No fake success.
- Snapshot metadata required for success.
- No localStorage write.
- No AppData overwrite.
- No optimistic success.
- No automatic retry.
- Duplicate submit blocked.
- Confirmation required where the prototype mutates data.
- Failure visible.
- No raw stack, raw response, AppData dump, or localStorage dump.
- No repair, sync, overwrite, import, export, reset, recovery, apply, or fix controls.

## Three-route Allowlist Matrix

Allowed:

| Area | Browser route | Status |
| --- | --- | --- |
| DataHealth dismiss | `POST /data-health/issues/:issueId/dismiss` | Accepted dev-only prototype |
| History data-flag | `POST /history/:id/data-flag` | Accepted dev-only prototype |
| Limited History Edit | `POST /history/:id/edit` | Accepted dev-only prototype |

Blocked:

| Area | Route or capability | Status |
| --- | --- | --- |
| Session start | `POST /sessions/start` | Blocked |
| Session patches | `POST /sessions/active/patches` | Blocked |
| Session complete | `POST /sessions/active/complete` | Blocked |
| Session discard | `POST /sessions/active/discard` | Blocked |
| DataHealth repair | `POST /data-health/repair/apply` | Blocked |
| Backup/import/export | Backup/import/export over HTTP | Blocked |
| Reset/recovery | Reset/recovery over HTTP | Blocked |
| Source-of-truth migration | API-backed persistence, dual-write, or source migration | Blocked |
| Fourth mutation | Any new browser mutation route | Blocked |

## Source-of-truth Regression Lock

- localStorage remains current source of truth.
- API results do not overwrite localStorage.
- API results do not overwrite AppData.
- Snapshot metadata is not stored in localStorage by mutation prototypes.
- No API-backed persistence adapter exists.
- No dual-write strategy is active.
- No offline mutation queue exists.
- No source-of-truth switch is approved.

## Data Semantics Regression Lock

- DataHealth dismiss does not change training set logs.
- History data-flag can affect default statistics only through accepted `normal`, `test`, and `excluded` semantics.
- Limited History Edit can affect recorded set values only through constrained one-set patch fields.
- Limited History Edit allowed patch fields remain exactly `weightKg`, `displayWeight`, `displayUnit`, `reps`, `rir`, `techniqueQuality`, `painFlag`, and `note`.
- `actualWeightKg` remains the trusted calculation source.
- `displayWeight` and `displayUnit` remain display-only unless paired with `weightKg`.
- `identityInvalid` semantics remain unchanged.
- `normal`, `test`, and `excluded` semantics remain locked.
- `test` and `excluded` remain visible but excluded from default production-like stats.
- PR, e1RM, effectiveSet, and weighted effectiveSet rules are unchanged.
- Backup import/export safety is unchanged.

## Test Coverage Inventory

Coverage families that must remain present:

- DataHealth dismiss config/client/prototype.
- DataHealth dismiss acceptance/manual/hardening/observability/regression.
- History data-flag config/client/prototype.
- History data-flag acceptance/manual/hardening/server parity/semantics.
- Limited History Edit config/client/prototype.
- Limited History Edit readiness gate/acceptance/manual/hardening/observability/regression/server parity/semantics.
- Three-route checkpoint/manual regression/regression lock.
- Read-only runtime parity.
- Diagnostics UX.
- Runtime boundary tests.
- Server/http/sqlite tests.

## Manual Acceptance Inventory

Manual runbooks that must remain present:

- Dev API runner manual acceptance: `docs/DEV_API_RUNNER_MANUAL_ACCEPTANCE.md`
- Read-only App manual acceptance: `docs/READONLY_APP_MANUAL_ACCEPTANCE.md`
- DataHealth dismiss manual App acceptance: `docs/DATAHEALTH_DISMISS_MANUAL_APP_ACCEPTANCE.md`
- History data-flag manual App acceptance: `docs/HISTORY_DATA_FLAG_MANUAL_APP_ACCEPTANCE.md`
- Limited History Edit manual App acceptance: `docs/LIMITED_HISTORY_EDIT_MANUAL_APP_ACCEPTANCE.md`
- Three-route manual regression: `docs/WRITE_PATH_THREE_ROUTE_MANUAL_REGRESSION.md`
- Recovery/reset runbook: `docs/DEV_API_RECOVERY_RESET.md`

## Future Work Gate

Before any fourth mutation candidate audit:

- Three-route regression lock must remain green.
- Three-route manual regression must remain valid.
- Accepted route allowlist must remain exactly three routes.
- localStorage integrity must remain verified.
- Read-only diagnostics must remain green.
- No-fake-success must remain green.
- Browser build must remain clean.
- Docs/manual runbooks must remain aligned.

## Decision

Do not implement a fourth mutation next.

Next recommended task: `Task 4.55 Fourth Mutation Candidate Readiness Audit V1`.

Task 4.55 must be audit/planning only. It must not implement a fourth mutation.

## Decision Record

- Date: 2026-05-10
- Branch / commit: `codex/task4.54-write-path-three-route-regression-lock` / pending until merge
- Decision: lock the current three-route write-path prototype state and do not approve a fourth mutation.
- Current accepted routes: `POST /data-health/issues/:issueId/dismiss`; `POST /history/:id/data-flag`; `POST /history/:id/edit`
- Rejected next steps: fourth mutation implementation, session mutation, DataHealth repair, backup/import/export over HTTP, reset/recovery over HTTP, production backend/auth/sync/deployment, source-of-truth migration, localStorage replacement, broad mutation client.
- Recommended next task: `Task 4.55 Fourth Mutation Candidate Readiness Audit V1`
- Risks: route expansion, source-of-truth divergence, no-fake-success regression, localStorage/API mismatch, duplicate-submit regression, docs drift, production exposure, browser Node-only pollution, session data loss, destructive repair/backup/reset behavior.
- Rollback requirement: because this regression lock adds docs/static tests only, rollback is reverting the regression-lock commit; existing prototypes remain governed by their own flags and runbooks.

## Final Recommendation

Task 4.54 result: regression lock only.
Browser mutation routes remain exactly DataHealth dismiss, History data-flag, and Limited History Edit.
No fourth mutation is approved.
localStorage remains source of truth.
Next task should be Task 4.55 Fourth Mutation Candidate Readiness Audit V1, audit-only.
