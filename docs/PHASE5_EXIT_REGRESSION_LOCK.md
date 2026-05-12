# Phase 5 Exit Regression Lock

## Scope / Non-goals

Task 5.39 locks the Phase 5 exit state.

This is not Phase 6 implementation. This does not add runtime behavior, does not modify App.tsx, does not add a browser mutation route, does not delete localStorage, does not silently overwrite localStorage, does not silently overwrite AppData, does not make API primary production default, does not add production backend, auth, sync, cloud, deployment, monitoring, package dependency, package script, normalized table, DataHealth repair, backup/import/export over HTTP, reset/recovery over HTTP, or an eighth browser mutation route.

## Accepted Runtime Modes

Accepted runtime source modes are exactly:

- `localStorage`
- `api-readonly`
- `api-primary-dev`

`localStorage` remains the default runtime source. `api-readonly` remains diagnostics/read-only. `api-primary-dev` remains explicit dev/local opt-in only and not production-ready.

## Accepted Browser Mutation Routes

Accepted browser mutation routes are exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

No other browser mutation route is accepted at Phase 5 exit.

## Blocked Routes And Capabilities

Blocked routes and capabilities remain:

- `POST /data-health/repair/apply`
- backup/import/export over HTTP
- reset/recovery over HTTP
- any eighth browser mutation route
- broad frontend mutation client
- production backend/auth/sync/cloud/deployment/monitoring
- normalized tables
- package dependency or package script changes
- destructive real user data migration
- training algorithm, template, scheduler, PR, e1RM, effectiveSet, or backup import/export safety changes
- Phase 6 implementation

## Source-of-truth Exit Lock

- `localStorage` remains the default runtime source.
- `localStorage` remains fallback source.
- `localStorage` remains migration source.
- `localStorage` remains emergency backup.
- `api-primary-dev` may act as App runtime source only under explicit dev/local flag.
- API primary must show visible failure on API unavailable or write failure.
- API primary must not silently overwrite localStorage.
- API primary must not silently overwrite AppData.
- No production source-of-truth switch is approved in Phase 5.

## Fallback Rules

Fallback remains locked:

- missing runtime source -> `localStorage`
- invalid runtime source -> `localStorage`
- non-dev API primary -> `localStorage`
- non-localhost API base URL -> `localStorage`
- API unavailable boot -> visible failure and `localStorage` fallback
- API write failure -> visible failure and no silent localStorage write

## Migration Rules

Migration remains locked:

- dry-run is warning-only and no-write.
- apply is dev-only, backup-first, explicit-confirmation only.
- apply writes SQLite snapshot only through injected writer.
- apply does not delete localStorage.
- apply does not auto-switch runtime source.
- rollback/recovery is dev-only, backup-metadata-required, explicit-confirmation only.
- rollback/recovery uses injected restore callbacks only.
- no HTTP migration route exists.
- no HTTP reset route exists.
- no HTTP recovery route exists.
- no production migration exists.

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

Required Phase 5 coverage families remain present:

- API-backed read runtime plan, prototype, acceptance, manual acceptance, and regression.
- active session start, patch, complete, discard prototype acceptance/hardening/regression.
- active session full write-path regression lock.
- API-backed persistence adapter and runtime source selector coverage.
- boot from API snapshot coverage.
- API write-through runtime prototype, acceptance, manual acceptance, hardening, and regression.
- localStorage to SQLite migration dry-run/apply/acceptance/rollback/regression.
- Phase 5 final source-of-truth audit.
- Phase 5 final manual acceptance.
- runtime boundary and browser build isolation tests.

## Decision

Phase 5 exit is locked for dev/local API-backed runtime and migration prototypes only. It is not production-ready and does not start Phase 6 implementation.

Next recommended task: `Task 5.40 Phase 6 Handoff Plan V1`.

Task 5.40 must be handoff planning only. It must not implement production backend, auth, user accounts, cloud sync, deployment, monitoring, source-of-truth production switch, or another mutation route.

## Decision Record

- Date: 2026-05-12
- Branch / commit: `codex/task5.39-phase5-exit-regression-lock` / pending until merge
- Decision: lock Phase 5 exit state and proceed only to Phase 6 handoff planning.
- Final runtime modes: `localStorage`; `api-readonly`; `api-primary-dev`
- Final accepted routes: `POST /data-health/issues/:issueId/dismiss`; `POST /history/:id/data-flag`; `POST /history/:id/edit`; `POST /sessions/start`; `POST /sessions/active/patches`; `POST /sessions/active/complete`; `POST /sessions/active/discard`
- Final blocked routes: DataHealth repair, backup/import/export HTTP, reset/recovery HTTP, eighth browser mutation route.
- Rejected next steps: Phase 6 implementation, production backend/auth/sync/cloud/deployment, monitoring, production source-of-truth switch, localStorage deletion, destructive real user data migration.
- Recommended next task: `Task 5.40 Phase 6 Handoff Plan V1`
- Rollback requirement: because this lock adds docs/static tests only, rollback is reverting the lock commit.

## Final Recommendation

Task 5.39 result: Phase 5 exit regression lock only.
Accepted runtime modes remain `localStorage`, `api-readonly`, and `api-primary-dev`.
Browser mutation routes remain exactly the seven accepted Phase 5 routes.
localStorage remains default runtime source, fallback, migration source, and emergency backup.
No production backend, auth, sync, cloud, deployment, monitoring, package change, normalized table, DataHealth repair, backup/import/export HTTP, reset/recovery HTTP, or eighth browser mutation route is added.
Next task should be Task 5.40 Phase 6 Handoff Plan V1, planning-only.
