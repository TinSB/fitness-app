# API-backed Persistence Facade Plan

## Scope / Non-goals

Task 5.23 plans a future API-backed persistence facade for Phase 5.

This is planning-only. It does not implement `src/storage/apiStorageAdapter.ts`, does not add a runtime source selector, does not modify App.tsx, does not switch source of truth, does not replace localStorage, does not add API primary runtime, does not add a browser mutation route, does not add DataHealth repair, does not add backup/import/export/reset/recovery HTTP routes, does not add production backend/auth/sync/cloud/deployment, does not add package changes, and does not add normalized tables.

localStorage remains source of truth. API results never overwrite AppData or localStorage.

## Current Phase 5 Baseline

Accepted browser mutation routes are exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

Still blocked:

- `POST /data-health/repair/apply`
- backup/import/export over HTTP
- reset/recovery over HTTP
- any eighth browser mutation route
- production backend/auth/sync/cloud/deployment

## Facade Shape

Planned direction:

`App.tsx -> persistence facade -> localStorageAdapter or apiStorageAdapter -> AppData`

The facade must expose a narrow AppData persistence boundary:

- load AppData.
- save AppData.
- report source metadata.
- report failure state.
- support localStorage fallback.
- support explicit dev/local API mode only after later tasks implement and accept it.

The facade must not become a broad mutation client, route dispatcher, sync engine, auth client, cloud client, or production backend wrapper.

## LocalStorage Adapter Contract

The existing localStorage adapter remains the default implementation.

Required behavior:

- continue using localStorage by default.
- preserve backup/import/export safety semantics.
- preserve validation before accepting imported data.
- never silently delete localStorage.
- never silently overwrite localStorage from API results.
- remain available as fallback, migration source, and emergency backup after API prototypes exist.

## Future API Storage Adapter Boundary

The future `apiStorageAdapter` may be added only in Task 5.24 and must be default-off.

It must:

- require an explicit dev/local flag.
- use typed read/write facade methods.
- surface visible API failure.
- preserve localStorage fallback.
- never imply production readiness.
- never add auth, sync, cloud, deployment, monitoring, or production source-of-truth behavior.
- never add DataHealth repair, backup/import/export HTTP, reset/recovery HTTP, or an eighth mutation route.

## Runtime Source Interaction

The facade may later connect to a runtime source selector, but Task 5.23 does not implement it.

Future runtime modes remain constrained to:

- `localStorage`
- `api-readonly`
- `api-primary-dev`

Default must remain `localStorage`.

## App.tsx Integration Plan

Task 5.23 does not change App.tsx.

Future integration must be narrow:

- App boot asks the facade for initial AppData.
- App save path delegates to the selected persistence adapter.
- API primary mode must show visible failure on API unavailable or write failure.
- API primary mode must not silently overwrite localStorage.
- localStorage mode must remain the default.

Any broad App.tsx rewrite, localStorage reconciliation system, server contract rewrite, or production source-of-truth switch is blocked.

## Source-of-truth Safety Rules

- localStorage remains default App runtime source of truth.
- API/SQLite may become source of truth only under explicit dev/local `api-primary-dev` after later approved tasks.
- API results must not silently overwrite AppData.
- API results must not silently overwrite localStorage.
- No dual-write is active in Task 5.23.
- No offline mutation queue is active in Task 5.23.
- No destructive migration is active in Task 5.23.

## Failure And Rollback Requirements

Future facade work must define:

- API unavailable fallback.
- malformed snapshot failure.
- timeout/abort failure.
- write failure visible to the user.
- rollback to localStorage mode.
- backup-first migration path before any migration apply.
- manual recovery steps using dedicated dev DBs only.

No real personal training data may be used in manual acceptance.

## Required Gates Before Implementation

Before Task 5.24 may add the adapter prototype:

- Active-session full write-path regression lock remains green.
- Accepted browser mutation routes remain exactly seven.
- localStorage source-of-truth baseline remains green.
- API-backed read runtime regression lock remains green and GET-only.
- Browser build isolation remains clean.
- No broad mutation client exists.
- No source-of-truth switch is active.
- No production/auth/sync/cloud/deployment assumption is introduced.

## Decision

Plan the facade before implementing the adapter.

Next recommended task: `Task 5.24 API-backed Persistence Adapter Prototype V1`.

Task 5.24 may add only the default-off API storage adapter prototype if gates pass. It must not replace localStorage, switch production source of truth, add auth/sync/cloud/deployment, add package dependencies, add an eighth mutation route, or add destructive migration behavior.

## Decision Record

- Date: 2026-05-12
- Branch / commit: `codex/task5.23-api-backed-persistence-facade-plan` / pending until merge
- Decision: plan the persistence facade before adding an API storage adapter prototype.
- Current source of truth: localStorage.
- Future adapter: `src/storage/apiStorageAdapter.ts`, Task 5.24 only.
- Still blocked: source-of-truth switch, localStorage replacement, production backend/auth/sync/cloud/deployment, DataHealth repair, backup/import/export HTTP, reset/recovery HTTP, eighth mutation route, broad mutation client.
- Recommended next task: `Task 5.24 API-backed Persistence Adapter Prototype V1`
- Rollback requirement: revert the Task 5.23 docs/static-test commit.

## Final Recommendation

Task 5.23 result: planning only.
No API-backed persistence adapter is implemented.
No runtime source selector is implemented.
No App.tsx integration is added.
localStorage remains source of truth.
Next task should be Task 5.24 API-backed Persistence Adapter Prototype V1 only if gates pass.

## Task 5.24 Follow-up: API-backed Persistence Adapter Prototype

Task 5.24 adds `src/storage/apiStorageAdapter.ts` as a default-off dev/local API storage adapter prototype.

It does not modify App.tsx, does not wire `loadData` or `saveData`, does not replace localStorage, does not switch source of truth, does not add a runtime source selector, does not add boot-from-API snapshot behavior, does not add API write-through runtime, and does not add production backend/auth/sync/cloud/deployment.

Next task should be Task 5.25 Runtime Source Selector Prototype V1.
