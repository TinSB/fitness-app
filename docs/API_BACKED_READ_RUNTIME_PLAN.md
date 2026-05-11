# API-backed Read Runtime Plan

## Scope / Non-goals

Task 5.7 plans the API-backed read runtime.

- This is documentation and static-test coverage only.
- This does not implement API-backed read runtime.
- This does not implement API clients.
- This does not implement runtime source selection.
- This does not switch source of truth.
- This does not add localStorage replacement.
- This does not write localStorage.
- This does not mutate AppData from API results.
- This does not modify `App.tsx`.
- This does not add production backend, auth, sync, cloud, deployment, or monitoring.
- This does not add a browser mutation route.
- This does not add package dependencies, package scripts, lockfile changes, normalized tables, schemas, storage adapters, or training algorithm changes.

## Current Baseline

At Task 5.7 entry, localStorage remains source of truth and default runtime source.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`

API-backed read runtime is not implemented by this task.

## Boot Data from API Snapshot

Future API-backed read runtime may fetch boot diagnostics from the Dev API.

Planned boot reads:

- `GET /health`
- `GET /app-data/summary`
- `GET /sessions/summary`
- `GET /history`
- `GET /data-health/summary`

Boot reads must validate response shape and snapshot metadata before display. Boot reads must not replace AppData or localStorage.

## localStorage Fallback

localStorage remains fallback for all read runtime planning.

- App remains usable from localStorage if API is unavailable.
- API-backed read failures must not block localStorage boot.
- API responses must not silently merge into localStorage.
- API responses must not silently overwrite AppData.
- Fallback state must be visible when API diagnostics fail.

## API Unavailable UI

Future UI must show safe unavailable diagnostics:

- API unavailable.
- timeout.
- malformed response.
- missing snapshot metadata.
- snapshot mismatch.
- readMirror parity mismatch.

No raw stack traces, raw API responses, AppData dumps, localStorage dumps, SQLite internals, or personal training data dumps may be displayed.

## Snapshot Metadata Display

Safe snapshot metadata may be displayed for diagnostics:

- snapshot id or safe label.
- created timestamp.
- source label.
- summary counts.
- metadata presence flag.

Snapshot metadata must not become source of truth by itself.

## readMirror Parity

API-backed read runtime planning must keep readMirror parity visible:

- compare localStorage-derived summary with API summary.
- classify mismatches as diagnostics.
- do not auto-repair mismatches.
- do not sync mismatches automatically.
- do not overwrite local AppData or localStorage on mismatch.

## GET-only Boundary

Task 5.7 plans reads only.

Allowed future GET routes:

- `GET /health`
- `GET /app-data/summary`
- `GET /sessions/summary`
- `GET /history`
- `GET /history/:id`
- `GET /data-health/summary`

No POST writes are added by this plan.

## Source Switch Boundary

- No runtime source switch is implemented by Task 5.7.
- `api-readonly` remains future planning until Task 5.8 implementation.
- `api-primary-dev` remains future work.
- localStorage remains source of truth.
- API results must not overwrite AppData or localStorage.

## Decision

Plan a dev/local GET-only API-backed read runtime prototype next.

Next task: `Task 5.8 API-backed Read Client Prototype V1`.

Task 5.8 may implement a dev/local GET-only read client prototype. It must not add POST writes, source-of-truth switching, localStorage overwrite, AppData mutation from API results, production backend/auth/sync/deployment, or a new browser mutation route.

## Decision Record

- Date: 2026-05-11
- Branch / commit: `codex/task5.7-api-backed-read-runtime-plan` / pending until merge
- Decision: plan GET-only API-backed read runtime before read client prototype implementation.
- Current accepted routes: `POST /data-health/issues/:issueId/dismiss`; `POST /history/:id/data-flag`; `POST /history/:id/edit`; `POST /sessions/start`
- Rejected next steps: POST writes, runtime source switch implementation, localStorage overwrite, AppData mutation from API results, production backend/auth/sync/deployment, unapproved route expansion.
- Recommended next task: `Task 5.8 API-backed Read Client Prototype V1`
- Rollback requirement: because this plan adds docs/static tests only, rollback is reverting the plan commit.

## Final Recommendation

Task 5.7 result: API-backed read runtime plan only.
localStorage remains source of truth.
API results never overwrite AppData or localStorage.
No API-backed read runtime is implemented.
No POST write is added.
No runtime source switch is implemented.
No production backend, auth, sync, cloud, deployment, or monitoring is added.
Next task should be Task 5.8 API-backed Read Client Prototype V1.

## Task 5.8 Follow-up: API-backed Read Client Prototype

Task 5.8 implements the dev/local GET-only API-backed read client prototype files:

- `src/devApi/apiBackedReadConfig.ts`
- `src/devApi/apiBackedReadClient.ts`
- `src/devApi/ApiBackedReadDiagnostics.tsx`

The prototype is enabled only in development with `VITE_IRONPATH_RUNTIME_SOURCE=api-readonly` and a localhost Dev API base URL. It is a diagnostic read surface only.

Allowed GET routes remain:

- `GET /health`
- `GET /app-data/summary`
- `GET /sessions/summary`
- `GET /history`
- `GET /history/:id`
- `GET /data-health/summary`

Task 5.8 adds no POST write, no runtime source selector, no API-backed persistence adapter, no App.tsx mount, no localStorage write, no AppData overwrite, no production backend, no auth, no sync, no deployment, and no browser mutation route. localStorage remains source of truth. API results never overwrite AppData or localStorage.

Next task: `Task 5.9 API-backed Read Runtime Acceptance V1`.

## Task 5.9 Follow-up: API-backed Read Runtime Acceptance

Task 5.9 adds `docs/API_BACKED_READ_RUNTIME_ACCEPTANCE.md` and acceptance coverage for the Task 5.8 GET-only client prototype.

Acceptance covers API available, API unavailable, malformed response, timeout, abort, missing snapshot metadata, snapshot mismatch diagnostics, readMirror parity, localStorage integrity, GET-only boundaries, and browser build safety.

Task 5.9 adds no runtime source selector, no API-backed persistence adapter, no App.tsx mount, no POST write, no localStorage write, no AppData overwrite, no production backend, no auth, no sync, no deployment, and no browser mutation route. localStorage remains source of truth. API results never overwrite AppData or localStorage.

Next task: `Task 5.10 API-backed Read Manual App Acceptance V1`.
