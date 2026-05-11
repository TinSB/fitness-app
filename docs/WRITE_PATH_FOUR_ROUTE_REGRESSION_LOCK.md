# Write-path Four-route Regression Lock

## Scope / Non-goals

This is the regression lock for the current four-route dev-only write-path prototype state.

- This is not a fifth mutation implementation.
- This is not source-of-truth migration.
- This is not localStorage replacement.
- This is not production backend readiness.
- This does not approve active session patch, complete, or discard mutation.
- This does not approve DataHealth repair.
- This does not approve backup/import/export/reset/recovery over HTTP.
- This does not add auth, sync, deployment, package dependencies, package scripts, lockfile changes, normalized tables, storage adapter changes, schema changes, or training algorithm changes.

## Current Accepted Browser Mutation Routes

Accepted browser mutation routes are exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`

No other browser mutation route is accepted.

## Explicitly Blocked Routes

These routes and capabilities remain blocked from browser mutation code:

- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`
- `POST /data-health/repair/apply`
- backup/import/export over HTTP
- reset/recovery over HTTP
- source-of-truth migration
- broad frontend mutation client
- fifth browser mutation route

## Four-route Regression State

The current accepted dev-only prototypes are locked as:

- DataHealth dismiss: implemented, accepted, manually accepted, hardened, observed/recovery-noted, and regression locked.
- History data-flag: implemented, accepted, manually accepted, hardened, and regression locked.
- Limited History Edit: implemented, accepted, manually accepted, hardened, observed/recovery-noted, and regression locked.
- Session Start: implemented, accepted, manually accepted, hardened, observed/recovery-noted, and regression locked.

All four remain dev-only. localStorage remains source of truth. API results never overwrite AppData or localStorage.

## Shared Four-route Regression Rules

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

## Four-route Allowlist Matrix

Allowed:

| Area | Browser route | Status |
| --- | --- | --- |
| DataHealth dismiss | `POST /data-health/issues/:issueId/dismiss` | Accepted dev-only prototype |
| History data-flag | `POST /history/:id/data-flag` | Accepted dev-only prototype |
| Limited History Edit | `POST /history/:id/edit` | Accepted dev-only prototype |
| Session Start | `POST /sessions/start` | Accepted dev-only prototype |

Blocked:

| Area | Route or capability | Status |
| --- | --- | --- |
| Session patches | `POST /sessions/active/patches` | Blocked |
| Session complete | `POST /sessions/active/complete` | Blocked |
| Session discard | `POST /sessions/active/discard` | Blocked |
| DataHealth repair | `POST /data-health/repair/apply` | Blocked |
| Backup/import/export | Backup/import/export over HTTP | Blocked |
| Reset/recovery | Reset/recovery over HTTP | Blocked |
| Source-of-truth migration | API-backed persistence, dual-write, or source migration | Blocked |
| Fifth mutation | Any new browser mutation route | Blocked |

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
- History data-flag `normal`, `test`, and `excluded` semantics remain locked.
- Limited History Edit field constraints remain locked.
- Session Start does not mutate local activeSession.
- `actualWeightKg` remains the trusted calculation source.
- `identityInvalid` semantics remain unchanged.
- PR, e1RM, effectiveSet, and weighted effectiveSet rules are unchanged.
- Backup import/export safety is unchanged.

## Test Coverage Inventory

Coverage families that must remain present and runnable under the configured Vitest glob:

- DataHealth dismiss config/client/prototype/acceptance/manual/hardening/observability/regression.
- History data-flag config/client/prototype/acceptance/manual/hardening/regression.
- Limited History Edit config/client/prototype/acceptance/manual/hardening/observability/regression.
- Session Start config/client/prototype/acceptance/manual/hardening/observability/regression.
- Four-route checkpoint and manual regression.
- Read-only runtime parity.
- Diagnostics UX and API unavailable fallback.
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
- Four-route manual regression: `docs/WRITE_PATH_FOUR_ROUTE_MANUAL_REGRESSION.md`
- Recovery/reset runbook: `docs/DEV_API_RECOVERY_RESET.md`

## Future Work Gate

Before any Phase 4 source-of-truth migration readiness audit:

- Four-route regression lock must remain green.
- Four-route manual regression must remain valid.
- Accepted route allowlist must remain exactly four routes.
- localStorage integrity must remain verified.
- Read-only diagnostics must remain green.
- No-fake-success must remain green.
- Browser build must remain clean.
- Docs/manual runbooks must remain aligned.
- No production/auth/sync assumption may be introduced.

## Decision

Do not implement source-of-truth migration next.

Next recommended task: `Task 4.69 Phase 4 Source-of-truth Migration Readiness Audit V1`.

Task 4.69 must be audit-only. It must not switch source of truth, replace localStorage, add API-backed runtime persistence, add production backend/auth/sync/deployment, or add another mutation route.

## Decision Record

- Date: 2026-05-11
- Branch / commit: `codex/task4.68-write-path-four-route-regression-lock` / pending until merge
- Decision: lock the current four-route write-path state and move next to audit-only source-of-truth migration readiness.
- Current accepted routes: `POST /data-health/issues/:issueId/dismiss`; `POST /history/:id/data-flag`; `POST /history/:id/edit`; `POST /sessions/start`
- Rejected next steps: fifth mutation implementation, active session patch, active session complete, active session discard, DataHealth repair, backup/import/export over HTTP, reset/recovery over HTTP, production backend/auth/sync/deployment, source-of-truth migration implementation, localStorage replacement, broad mutation client.
- Recommended next task: `Task 4.69 Phase 4 Source-of-truth Migration Readiness Audit V1`
- Risks: route expansion, source-of-truth divergence, localStorage/API mismatch, duplicate-submit, active session data loss, manual acceptance drift, docs drift, production exposure, browser Node-only pollution, destructive repair/backup/reset behavior.
- Rollback requirement: because this regression lock adds docs/static tests only, rollback is reverting the regression-lock commit; existing prototypes remain governed by their own flags and runbooks.

## Final Recommendation

Task 4.68 result: regression lock only.
Browser mutation routes remain exactly DataHealth dismiss, History data-flag, Limited History Edit, and Session Start.
No fifth mutation is approved.
localStorage remains source of truth.
Next task should be Task 4.69 Phase 4 Source-of-truth Migration Readiness Audit V1, audit-only.

## Task 4.69 Source-of-truth Migration Readiness Follow-up

Task 4.69 adds `docs/PHASE4_SOURCE_OF_TRUTH_MIGRATION_READINESS_AUDIT.md` as an audit-only review.

- It does not switch source of truth.
- It does not replace localStorage.
- It does not add API-backed runtime persistence.
- It does not add production backend, auth, sync, or deployment.
- It keeps browser mutation routes exactly four.
- It recommends Task 4.70 API-backed Runtime Strategy Plan V1 as planning-only.
