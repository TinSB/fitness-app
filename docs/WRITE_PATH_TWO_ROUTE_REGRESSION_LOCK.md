# Write-path Two-route Regression Lock

## Scope / Non-goals

This is a two-route regression lock for the current dev-only write-path prototype state.

- This is not a third mutation implementation.
- This is not source-of-truth migration.
- This is not localStorage replacement.
- This is not production backend readiness.
- This does not approve session mutation.
- This does not approve history edit.
- This does not approve DataHealth repair.
- This does not approve backup/import/export/reset over HTTP.
- This does not add package dependency/script.
- This does not change runtime source.

## Current Accepted Browser Mutation Routes

Accepted browser mutation routes are exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`

No other browser mutation route is accepted.

## Explicitly Blocked Routes

These routes and capabilities remain blocked from browser mutation code:

- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`
- `POST /history/:id/edit`
- `POST /data-health/repair/apply`
- backup/import/export over HTTP
- reset/recovery over HTTP
- source-of-truth migration

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

## Shared Two-route Regression Rules

Both accepted mutation prototypes must preserve:

- Explicit dev-only opt-in.
- Route-specific mutation experiment flag.
- No fake success.
- Snapshot metadata required for success.
- No localStorage write.
- No AppData overwrite.
- No optimistic success.
- No automatic retry.
- Duplicate submit blocked.
- Confirmation required.
- Failure visible.
- No raw stack, raw response, AppData dump, or localStorage dump.
- No repair, sync, overwrite, import, export, reset, apply, or fix controls.

## Two-route Allowlist Matrix

Allowed:

| Area | Browser route | Status |
| --- | --- | --- |
| DataHealth dismiss | `POST /data-health/issues/:issueId/dismiss` | Accepted dev-only prototype |
| History data-flag | `POST /history/:id/data-flag` | Accepted dev-only prototype |

Blocked:

| Area | Route or capability | Status |
| --- | --- | --- |
| Session start | `POST /sessions/start` | Blocked |
| Session patches | `POST /sessions/active/patches` | Blocked |
| Session complete | `POST /sessions/active/complete` | Blocked |
| Session discard | `POST /sessions/active/discard` | Blocked |
| History edit | `POST /history/:id/edit` | Blocked |
| DataHealth repair | `POST /data-health/repair/apply` | Blocked |
| Backup/import/export | Backup/import/export over HTTP | Blocked |
| Reset/recovery | Reset/recovery over HTTP | Blocked |
| Source-of-truth migration | API-backed persistence, dual-write, or source migration | Blocked |

## Source-of-truth Regression Lock

- localStorage remains current source of truth.
- API results do not overwrite localStorage.
- API results do not overwrite AppData.
- No API-backed persistence adapter exists.
- No dual-write strategy is active.
- No offline mutation queue exists.
- No source-of-truth switch is approved.

## Data Semantics Regression Lock

- DataHealth dismiss does not change training set logs.
- History data-flag can affect default statistics.
- `normal`, `test`, and `excluded` semantics remain locked.
- `test` and `excluded` remain visible but excluded from default production-like stats.
- `actualWeightKg` remains the trusted calculation source.
- `identityInvalid` semantics are unchanged.
- PR, e1RM, effectiveSet, and weighted effectiveSet rules are unchanged.
- Backup import/export safety is unchanged.

## Test Coverage Inventory

Coverage families that must remain present:

- DataHealth dismiss config/client/prototype.
- DataHealth dismiss acceptance/manual/hardening/observability/regression.
- History data-flag config/client/prototype.
- History data-flag acceptance/manual/hardening.
- Two-route checkpoint/manual regression.
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
- Two-route manual regression: `docs/WRITE_PATH_TWO_ROUTE_MANUAL_REGRESSION.md`
- Recovery/reset runbook: `docs/DEV_API_RECOVERY_RESET.md`

## Future Work Gate

Before any third mutation candidate audit:

- Two-route regression lock must remain green.
- Two-route manual regression must remain valid.
- Accepted route allowlist must remain exactly two routes.
- localStorage integrity must remain verified.
- Read-only diagnostics must remain green.
- No-fake-success must remain green.
- Browser build must remain clean.
- Docs/manual runbooks must remain aligned.

## Decision

Do not implement a third mutation next.

Next recommended task: `Task 4.43 Third Mutation Candidate Readiness Audit V1`.

Task 4.43 must be audit/planning only. It must not implement a third mutation.

## Decision Record

- Date: 2026-05-10
- Branch / commit: `codex/task4.42-write-path-two-route-regression-lock` / pending until merge
- Decision: lock the current two-route write-path prototype state and do not approve a third mutation.
- Current accepted routes: `POST /data-health/issues/:issueId/dismiss`; `POST /history/:id/data-flag`
- Rejected next steps: third mutation implementation, session mutation, history edit, DataHealth repair, backup/import/export over HTTP, reset/recovery over HTTP, production backend/auth/sync/deployment, source-of-truth migration, localStorage replacement, broad mutation client.
- Recommended next task: `Task 4.43 Third Mutation Candidate Readiness Audit V1`
- Risks: route expansion, source-of-truth divergence, no-fake-success regression, localStorage/API mismatch, duplicate-submit regression, docs drift, production exposure, browser Node-only pollution, session data loss, history edit corruption, destructive repair/backup/reset behavior.
- Rollback requirement: because this regression lock adds docs/static tests only, rollback is reverting the regression-lock commit; existing prototypes remain governed by their own flags and runbooks.

## Final Recommendation

Task 4.42 result: regression lock only.
Browser mutation routes remain exactly DataHealth dismiss and History data-flag.
No third mutation is approved.
localStorage remains source of truth.
Next task should be Task 4.43 Third Mutation Candidate Readiness Audit V1, audit-only.
