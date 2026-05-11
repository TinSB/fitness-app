# API-backed Read Runtime Acceptance

## Scope / Non-goals

Task 5.9 is acceptance coverage for the Task 5.8 dev/local API-backed read client prototype.

This is not a source-of-truth migration. This is not API primary runtime. This is not a write-through runtime. This does not add POST writes, mutation routes, runtime source selector, API-backed persistence adapter, production backend, auth, sync, cloud, deployment, monitoring, package dependency, package script, normalized table, or App.tsx integration.

localStorage remains source of truth. API results never overwrite AppData or localStorage.

## Accepted Read Surface

The API-backed read prototype remains GET-only.

Allowed GET routes:

- `GET /health`
- `GET /app-data/summary`
- `GET /sessions/summary`
- `GET /history`
- `GET /history/:id`
- `GET /data-health/summary`

No POST route is accepted by this acceptance task.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`

## API Available Acceptance

When the Dev API is available:

- `api-readonly` config resolves only in development with localhost base URL.
- each allowed GET route can return `{ result }`.
- safe snapshot metadata may be displayed when present.
- missing snapshot metadata is visible as metadata absence.
- no AppData mutation occurs.
- no localStorage write occurs.

## API Unavailable Acceptance

When the Dev API is unavailable:

- the client returns a visible unavailable result.
- the App remains usable from localStorage.
- there is no fake success.
- there is no automatic retry.
- localStorage remains source of truth.

## Malformed Response Acceptance

Malformed responses are visible failures:

- non-object response is rejected.
- missing `result` is rejected.
- malformed `error` shape is rejected.
- HTTP error without safe server error shape is rejected.
- raw stack traces, raw responses, AppData dumps, localStorage dumps, and SQLite internals must not be displayed.

## Timeout and Abort Acceptance

Timeout and abort behavior remains visible and non-mutating:

- timeout returns `api_backed_read_timeout`.
- abort returns unavailable/cancelled diagnostic behavior.
- no request is retried automatically.
- no localStorage write occurs.
- no AppData overwrite occurs.

## Snapshot Mismatch Acceptance

Snapshot metadata is diagnostic only:

- safe snapshot metadata may be displayed.
- missing snapshot metadata is not treated as source-of-truth success.
- snapshot mismatch is a diagnostic state only.
- API snapshot metadata does not overwrite AppData.
- API snapshot metadata does not overwrite localStorage.

## readMirror Parity Acceptance

API-backed read acceptance keeps readMirror parity:

- local summaries can be compared with API summaries.
- matching summaries are diagnostic pass.
- mismatches are diagnostic warnings.
- mismatches do not trigger repair, sync, overwrite, import, export, reset, apply, or fix controls.
- no training algorithm, PR, e1RM, effectiveSet, scheduler, template, or backup safety rule changes.

## LocalStorage Integrity Acceptance

Acceptance must confirm:

- no `localStorage.setItem` call from the API-backed read client.
- no `saveData` or `loadData` call from API-backed read client.
- no API-backed localStorage adapter exists.
- no API result is merged into AppData.
- localStorage remains the active App source of truth.

## GET-only Boundary Acceptance

Acceptance must confirm:

- API-backed read files contain no POST write method.
- API-backed read files contain no accepted or blocked mutation route strings.
- browser source remains free of Node-only runtime tokens.
- no broad mutation client exists.
- no runtime source selector exists yet.
- no API-backed persistence adapter exists yet.

## Browser Build Safety

`npm run build` must pass and the `dist/` scan must find no:

- `node:http`
- `node:sqlite`
- `devLauncher`
- `httpRuntimeAdapter`
- `serverAdapter`
- `sqliteRepository`
- `devApiRunner`
- `devDbRecovery`

## Decision

Task 5.9 accepts the Task 5.8 API-backed read client prototype as GET-only diagnostics coverage.

It does not approve API primary runtime, source-of-truth migration, POST writes, or production readiness.

Next recommended task: `Task 5.10 API-backed Read Manual App Acceptance V1`.

## Decision Record

- Date: 2026-05-11
- Branch / commit: `codex/task5.9-api-backed-read-runtime-acceptance` / pending until merge
- Decision: add acceptance coverage for the dev/local GET-only API-backed read prototype.
- Accepted read routes: `GET /health`; `GET /app-data/summary`; `GET /sessions/summary`; `GET /history`; `GET /history/:id`; `GET /data-health/summary`
- Accepted browser mutation routes: `POST /data-health/issues/:issueId/dismiss`; `POST /history/:id/data-flag`; `POST /history/:id/edit`; `POST /sessions/start`
- Rejected next steps: POST writes, runtime source selector, API-backed persistence adapter, source-of-truth migration, localStorage replacement, AppData overwrite, production backend, auth, sync, cloud, deployment.
- Recommended next task: `Task 5.10 API-backed Read Manual App Acceptance V1`
- Rollback requirement: revert the Task 5.9 docs/static-test commit.

## Final Recommendation

Task 5.9 result: API-backed read runtime acceptance only.
The API-backed read prototype remains GET-only.
localStorage remains source of truth.
API results never overwrite AppData or localStorage.
No POST write, runtime source selector, API-backed persistence adapter, production backend, auth, sync, cloud, deployment, package change, normalized table, or browser mutation route is added.
Next task should be Task 5.10 API-backed Read Manual App Acceptance V1.

## Task 5.10 Follow-up: Manual App Acceptance

Task 5.10 adds `docs/API_BACKED_READ_MANUAL_APP_ACCEPTANCE.md` as the human browser runbook for the Task 5.8 GET-only prototype and Task 5.9 acceptance state.

It requires a dedicated test browser profile, dedicated dev DB, Dev API runner, App dev server, DevTools Network GET-only check, API available scenario, API unavailable fallback scenario, localStorage integrity check, forbidden controls check, browser build safety check, cleanup steps, and pass/fail template.

Task 5.10 adds no POST write, no runtime source selector, no API-backed persistence adapter, no App.tsx mount, no localStorage write, no AppData overwrite, no production backend, no auth, no sync, no deployment, and no browser mutation route.

Next task: `Task 5.11 API-backed Read Runtime Regression Lock V1`.
