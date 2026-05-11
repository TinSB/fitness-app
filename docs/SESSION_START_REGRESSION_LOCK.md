# Session Start Regression Lock

## Scope / Non-goals

This is a regression lock for the existing dev-only Session Start prototype.

- This is not a fifth mutation implementation.
- This does not add any new mutation route.
- This is not source-of-truth migration.
- This is not localStorage replacement.
- This is not production backend readiness.
- This does not approve active session patch, complete, or discard mutation.
- This does not approve DataHealth repair.
- This does not approve backup/import/export/reset/recovery over HTTP.
- This does not add package dependency, package script, lockfile change, normalized table, or runtime source change.

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

## Session Start Regression State

Session Start is locked as the fourth dev-only browser mutation prototype.

- Readiness-audited.
- Source snapshot and idempotency planned.
- UX confirmation and rollback planned.
- Prototype planned.
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

## Four Prototype Regression Rules

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

## Session Start Request Lock

The Session Start prototype remains one-route-only:

- Route: `POST /sessions/start`
- Mutation flag: `VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT=session-start`
- Requires `VITE_IRONPATH_DEV_API_COMPARE=1`
- Requires localhost Dev API base URL.
- Requires source snapshot metadata.
- Requires mutation id and idempotency key.
- Requires request fingerprint.
- Requires explicit confirmation.
- Does not start active patch, complete, or discard.
- Does not update activeSession in local App state.

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

## Active Session Safety Lock

- Session start can create active training state in the Dev API snapshot only.
- The browser prototype must not mutate local activeSession.
- Active patches remain blocked.
- Active complete remains blocked.
- Active discard remains blocked.
- Duplicate start remains blocked by pending lock, source snapshot metadata, and idempotency metadata.
- Active-session recovery remains manual/dev-only.

## Data Semantics Regression Lock

- Session Start does not change training algorithms, templates, scheduler, PR, e1RM, effectiveSet, or weighted effectiveSet rules.
- History data-flag `normal`, `test`, and `excluded` semantics remain locked.
- Limited History Edit field constraints remain locked.
- DataHealth dismiss does not change training set logs.
- Backup import/export safety is unchanged.

## Test Coverage Inventory

Coverage families that must remain present and runnable under the configured Vitest glob:

- Session Start config/client/prototype.
- Session Start server parity and semantics.
- Session Start acceptance/manual acceptance.
- Session Start hardening.
- Session Start observability/recovery.
- Runtime boundary tests.
- Read-only runtime parity.
- Server/http/sqlite tests.
- Mutation UX/source-of-truth tests.

## Manual Acceptance Inventory

Manual runbooks that must remain present:

- Session Start prototype acceptance: `docs/SESSION_START_PROTOTYPE_ACCEPTANCE.md`
- Session Start manual App acceptance: `docs/SESSION_START_MANUAL_APP_ACCEPTANCE.md`
- Session Start observability/recovery notes: `docs/SESSION_START_OBSERVABILITY_RECOVERY_NOTES.md`
- Manual API acceptance checklist: `docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md`
- Dev API recovery/reset runbook: `docs/DEV_API_RECOVERY_RESET.md`

## Future Work Gate

Before a four-route checkpoint:

- Session Start regression lock must remain green.
- Accepted route allowlist must remain exactly four routes.
- localStorage integrity must remain verified.
- Read-only diagnostics must remain separate and green.
- No-fake-success must remain green.
- Browser build must remain clean.
- Docs/manual runbooks must remain aligned.

## Decision

Do not implement a fifth mutation next.

Next recommended task: `Task 4.66 Write-path Four-route Checkpoint V1`.

Task 4.66 must be checkpoint/audit documentation and static/regression coverage only. It must not implement a fifth mutation route.

## Decision Record

- Date: 2026-05-11
- Branch / commit: `codex/task4.65-session-start-regression-lock` / pending until merge
- Decision: lock the current Session Start prototype and keep browser mutation routes exactly four.
- Current accepted routes: `POST /data-health/issues/:issueId/dismiss`; `POST /history/:id/data-flag`; `POST /history/:id/edit`; `POST /sessions/start`
- Rejected next steps: fifth mutation implementation, active session patch, active session complete, active session discard, DataHealth repair, backup/import/export over HTTP, reset/recovery over HTTP, production backend/auth/sync/deployment, source-of-truth migration, localStorage replacement, broad mutation client.
- Recommended next task: `Task 4.66 Write-path Four-route Checkpoint V1`
- Risks: route expansion, source-of-truth divergence, no-fake-success regression, localStorage/API mismatch, duplicate-submit regression, docs drift, production exposure, browser Node-only pollution, active session data loss, destructive repair/backup/reset behavior.
- Rollback requirement: because this regression lock adds docs/static tests only, rollback is reverting the regression-lock commit; existing prototypes remain governed by their own flags and runbooks.

## Final Recommendation

Task 4.65 result: regression lock only.
Browser mutation routes remain exactly DataHealth dismiss, History data-flag, Limited History Edit, and Session Start.
No fifth mutation is approved.
localStorage remains source of truth.
Next task should be Task 4.66 Write-path Four-route Checkpoint V1, checkpoint-only.
