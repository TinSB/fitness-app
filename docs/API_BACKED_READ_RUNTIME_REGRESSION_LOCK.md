# API-backed Read Runtime Regression Lock

## Scope / Non-goals

Task 5.11 regression-locks the dev/local API-backed read prototype.

This is a regression lock, not a source-of-truth migration. This does not implement API primary runtime, write-through runtime, runtime source selector, API-backed persistence adapter, production backend, auth, sync, cloud, deployment, monitoring, package dependency, package script, normalized table, or App.tsx integration.

localStorage remains source of truth. API results never overwrite AppData or localStorage.

## Locked GET-only Surface

The API-backed read prototype is locked to these GET routes:

- `GET /health`
- `GET /app-data/summary`
- `GET /sessions/summary`
- `GET /history`
- `GET /history/:id`
- `GET /data-health/summary`

No POST write is accepted by the API-backed read runtime.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`

## Source Switch Lock

- no runtime source selector exists.
- no `api-primary-dev` runtime source is implemented.
- no boot-from-API source switch is implemented.
- no API write-through runtime is implemented.
- default App runtime remains localStorage.
- `api-readonly` remains diagnostic read-only behavior.

## LocalStorage and AppData Lock

- API-backed read client does not call `saveData`.
- API-backed read client does not call `loadData`.
- API-backed read client does not call `localStorage.setItem`.
- API-backed read client does not import `localStorageAdapter`.
- API results do not overwrite AppData.
- API results do not overwrite localStorage.
- missing snapshot metadata is visible as diagnostic absence only.
- snapshot mismatch is diagnostic only.

## Node-only Browser Boundary

Browser source and production bundle must remain free of:

- `node:http`
- `node:sqlite`
- `devLauncher`
- `httpRuntimeAdapter`
- `serverAdapter`
- `sqliteRepository`
- `devApiRunner`
- `devDbRecovery`

## Failure Lock

The API-backed read prototype must keep visible, non-mutating failure behavior:

- API unavailable is visible.
- timeout is visible.
- abort/cancel is non-mutating.
- malformed response is rejected.
- server error response is visible.
- missing result is rejected.
- no fake success is shown for failures.
- no automatic retry loop is added.

## Coverage Inventory

Required coverage:

- `tests/apiBackedReadConfig.test.ts`
- `tests/apiBackedReadClient.test.ts`
- `tests/apiBackedReadBoundary.test.ts`
- `tests/apiBackedReadDiagnostics.test.tsx`
- `tests/apiBackedReadRuntimeAcceptance.test.ts`
- `tests/apiBackedReadRuntimeLocalStorageIntegrity.test.ts`
- `tests/apiBackedReadRuntimeBoundary.test.ts`
- `tests/apiBackedReadManualAppAcceptanceDocs.test.ts`
- `tests/apiBackedReadManualAppAcceptanceBoundary.test.ts`
- `tests/apiBackedReadManualAppAcceptanceDocsParity.test.ts`
- `tests/apiBackedReadRuntimeRegressionLock.test.ts`
- `tests/apiBackedReadRuntimeRegressionBoundary.test.ts`
- `tests/apiBackedReadRuntimeCoverageInventory.test.ts`
- `tests/apiBackedReadRuntimeDocsParity.test.ts`

Required docs:

- `docs/API_BACKED_READ_RUNTIME_PLAN.md`
- `docs/API_BACKED_READ_RUNTIME_ACCEPTANCE.md`
- `docs/API_BACKED_READ_MANUAL_APP_ACCEPTANCE.md`
- `docs/API_BACKED_READ_RUNTIME_REGRESSION_LOCK.md`

## Manual Acceptance Inventory

- API-backed read manual App acceptance exists.
- Dev API runner command is documented.
- App dev server command is documented.
- dedicated browser profile requirement is documented.
- dedicated dev DB requirement is documented.
- Network GET-only verification is documented.
- localStorage integrity check is documented.
- cleanup and env reset are documented.

## Future Work Gate

Before any API primary runtime or source-of-truth migration work:

- this regression lock must remain green.
- manual App acceptance must remain valid.
- API-backed read must remain GET-only.
- localStorage integrity must remain verified.
- no POST write may be added outside an explicitly approved mutation task.
- no runtime source selector may be introduced before its approved task.
- no API-backed persistence adapter may be introduced before its approved task.
- browser build must remain clean.

## Decision

Task 5.11 locks the API-backed read prototype as GET-only diagnostics.

It does not approve source-of-truth migration, API primary runtime, production readiness, auth, sync, cloud, deployment, or monitoring.

Next recommended task: `Task 5.12 Active Session Write Coverage Gap Audit V1`.

## Decision Record

- Date: 2026-05-11
- Branch / commit: `codex/task5.11-api-backed-read-runtime-regression-lock` / pending until merge
- Decision: regression-lock the GET-only API-backed read prototype.
- Accepted read routes: `GET /health`; `GET /app-data/summary`; `GET /sessions/summary`; `GET /history`; `GET /history/:id`; `GET /data-health/summary`
- Accepted browser mutation routes: `POST /data-health/issues/:issueId/dismiss`; `POST /history/:id/data-flag`; `POST /history/:id/edit`; `POST /sessions/start`
- Rejected next steps: POST writes from read runtime, source-of-truth migration, API primary runtime, runtime source selector, API-backed persistence adapter, production backend, auth, sync, cloud, deployment.
- Recommended next task: `Task 5.12 Active Session Write Coverage Gap Audit V1`
- Rollback requirement: revert the Task 5.11 docs/static-test commit.

## Final Recommendation

Task 5.11 result: API-backed read runtime regression lock only.
The API-backed read prototype remains GET-only.
localStorage remains source of truth.
API results never overwrite AppData or localStorage.
No POST write, runtime source selector, API-backed persistence adapter, production backend, auth, sync, cloud, deployment, package change, normalized table, or browser mutation route is added.
Next task should be Task 5.12 Active Session Write Coverage Gap Audit V1.

## Task 5.12 Follow-up: Active Session Write Coverage Gap Audit

Task 5.12 adds `docs/ACTIVE_SESSION_WRITE_COVERAGE_GAP_AUDIT.md` as an audit-only review of the remaining active-session browser write gaps: session patch, session complete, and session discard.

It keeps `POST /sessions/active/patches`, `POST /sessions/active/complete`, and `POST /sessions/active/discard` blocked from browser runtime until route-specific planning and prototype tasks.

Task 5.12 adds no browser route, no runtime source selector, no API-backed persistence adapter, no App.tsx mount, no localStorage write, no AppData overwrite, no production backend, no auth, no sync, no deployment, and no browser mutation route.

Next task: `Task 5.13 Session Patch Mutation Prototype Plan V1`.
