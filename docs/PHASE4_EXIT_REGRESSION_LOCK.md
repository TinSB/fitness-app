# Phase 4 Exit Regression Lock

## Scope / Non-goals

Task 4.73 locks the Phase 4 exit state.

- This is not Phase 5 implementation.
- This does not add runtime behavior.
- This does not add a browser mutation route.
- This does not switch source of truth.
- This does not replace localStorage.
- This does not implement API-backed runtime.
- This does not add production backend, auth, sync, or deployment.
- This does not add package dependencies, package scripts, lockfile changes, normalized tables, schemas, storage adapters, or training algorithm changes.

## Final Accepted Browser Mutation Routes

Accepted browser mutation routes are exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`

No other browser mutation route is accepted at Phase 4 exit.

## Final Blocked Routes

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
- production backend/auth/sync/deployment
- broad frontend mutation client

## Source-of-truth Exit Lock

- localStorage remains current source of truth.
- API results do not overwrite localStorage.
- API results do not overwrite AppData.
- No API-backed persistence adapter exists.
- No dual-write strategy exists.
- No offline mutation queue exists.
- No source-of-truth switch is approved in Phase 4.

## Browser Build Isolation

Browser source and browser build output must remain free of:

- `node:http`
- `node:sqlite`
- `devLauncher`
- `httpRuntimeAdapter`
- `serverAdapter`
- `sqliteRepository`
- `devApiRunner`
- `devDbRecovery`

## Coverage Inventory

Required coverage families remain present:

- DataHealth dismiss acceptance/manual/hardening/observability/regression.
- History data-flag acceptance/manual/hardening/regression.
- Limited History Edit acceptance/manual/hardening/observability/regression.
- Session Start acceptance/manual/hardening/observability/regression.
- Four-route checkpoint/manual regression/regression lock.
- Source-of-truth migration readiness audit.
- API-backed runtime strategy plan.
- Final data safety audit.
- Final manual acceptance.
- Runtime boundary and read-only runtime tests.

## Decision

Phase 4 exit is locked. Do not start Phase 5 implementation from this task.

Next recommended task: `Task 4.74 Phase 5 Handoff Plan V1`.

Task 4.74 must be handoff planning only. It must not implement Phase 5, switch source of truth, replace localStorage, add API-backed runtime behavior, add production backend/auth/sync/deployment, or add another mutation route.

## Decision Record

- Date: 2026-05-11
- Branch / commit: `codex/task4.73-phase4-exit-regression-lock` / pending until merge
- Decision: lock Phase 4 exit state and proceed only to Phase 5 handoff planning.
- Final accepted routes: `POST /data-health/issues/:issueId/dismiss`; `POST /history/:id/data-flag`; `POST /history/:id/edit`; `POST /sessions/start`
- Rejected next steps: Phase 5 implementation, source-of-truth switch, localStorage replacement, API-backed runtime implementation, production backend/auth/sync/deployment, fifth mutation route.
- Recommended next task: `Task 4.74 Phase 5 Handoff Plan V1`
- Rollback requirement: because this lock adds docs/static tests only, rollback is reverting the lock commit.

## Final Recommendation

Task 4.73 result: Phase 4 exit regression lock only.
Browser mutation routes remain exactly DataHealth dismiss, History data-flag, Limited History Edit, and Session Start.
localStorage remains source of truth.
No production backend, auth, sync, or deployment is added.
No source-of-truth migration is implemented.
Next task should be Task 4.74 Phase 5 Handoff Plan V1, planning-only.
