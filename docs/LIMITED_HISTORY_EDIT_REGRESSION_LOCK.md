# Limited History Edit Regression Lock

## Scope / Non-goals

This is a regression lock for the existing dev-only Limited History Edit prototype.

- This is not a fourth mutation implementation.
- This does not add any new mutation route.
- This is not source-of-truth migration.
- This is not localStorage replacement.
- This is not production backend readiness.
- This does not approve session mutation.
- This does not approve DataHealth repair.
- This does not approve backup/import/export/reset/recovery over HTTP.
- This does not add package dependency, package script, lockfile change, normalized table, or runtime source change.

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

## Three Prototype Regression Rules

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

## Limited History Edit Field Lock

Allowed patch fields remain exactly:

- `weightKg`
- `displayWeight`
- `displayUnit`
- `reps`
- `rir`
- `techniqueQuality`
- `painFlag`
- `note`

Rejected fields and capabilities remain blocked:

- `dataFlag`
- session identity fields
- session state fields
- exercise identity fields
- set identity and structure fields
- add/remove/reorder operations
- active session mutation
- direct `editHistory` writes
- derived summary writes
- whole-session JSON patch
- arbitrary nested field patch

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

- `actualWeightKg` remains the trusted calculation source.
- `displayWeight` and `displayUnit` remain display-only unless paired with `weightKg`.
- `identityInvalid` semantics are unchanged.
- `normal`, `test`, and `excluded` semantics remain locked.
- `test` and `excluded` remain visible but excluded from default production-like stats.
- PR, e1RM, effectiveSet, and weighted effectiveSet rules are unchanged.
- Backup import/export safety is unchanged.

## Test Coverage Inventory

Coverage families that must remain present and runnable under the configured Vitest glob:

- Limited History Edit config/client/prototype.
- Limited History Edit readiness gate.
- Limited History Edit acceptance/manual acceptance.
- Limited History Edit hardening.
- Limited History Edit observability/recovery.
- Runtime boundary tests.
- Read-only runtime parity.
- Server/http/sqlite tests.
- Mutation UX/source-of-truth tests.

## Manual Acceptance Inventory

Manual runbooks that must remain present:

- Limited History Edit prototype acceptance: `docs/LIMITED_HISTORY_EDIT_PROTOTYPE_ACCEPTANCE.md`
- Limited History Edit manual App acceptance: `docs/LIMITED_HISTORY_EDIT_MANUAL_APP_ACCEPTANCE.md`
- Limited History Edit observability/recovery notes: `docs/LIMITED_HISTORY_EDIT_OBSERVABILITY_RECOVERY_NOTES.md`
- Manual API acceptance checklist: `docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md`
- Dev API recovery/reset runbook: `docs/DEV_API_RECOVERY_RESET.md`

## Future Work Gate

Before a three-route checkpoint:

- Limited History Edit regression lock must remain green.
- Accepted route allowlist must remain exactly three routes.
- localStorage integrity must remain verified.
- Read-only diagnostics must remain separate and green.
- No-fake-success must remain green.
- Browser build must remain clean.
- Docs/manual runbooks must remain aligned.

## Decision

Do not implement a fourth mutation next.

Next recommended task: `Task 4.52 Write-path Three-route Checkpoint V1`.

Task 4.52 must be checkpoint/audit documentation and static/regression coverage only. It must not implement a fourth mutation route.

## Decision Record

- Date: 2026-05-10
- Branch / commit: `codex/task4.51-limited-history-edit-regression-lock` / pending until merge
- Decision: lock the current Limited History Edit prototype and keep browser mutation routes exactly three.
- Current accepted routes: `POST /data-health/issues/:issueId/dismiss`; `POST /history/:id/data-flag`; `POST /history/:id/edit`
- Rejected next steps: fourth mutation implementation, session mutation, DataHealth repair, backup/import/export over HTTP, reset/recovery over HTTP, production backend/auth/sync/deployment, source-of-truth migration, localStorage replacement, broad mutation client.
- Recommended next task: `Task 4.52 Write-path Three-route Checkpoint V1`
- Risks: route expansion, source-of-truth divergence, no-fake-success regression, localStorage/API mismatch, duplicate-submit regression, docs drift, production exposure, browser Node-only pollution, session data loss, destructive repair/backup/reset behavior.
- Rollback requirement: because this regression lock adds docs/static tests only, rollback is reverting the regression-lock commit; existing prototypes remain governed by their own flags and runbooks.

## Final Recommendation

Task 4.51 result: regression lock only.
Browser mutation routes remain exactly DataHealth dismiss, History data-flag, and Limited History Edit.
No fourth mutation is approved.
localStorage remains source of truth.
Next task should be Task 4.52 Write-path Three-route Checkpoint V1, checkpoint-only.
