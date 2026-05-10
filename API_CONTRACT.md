# IronPath API Contract

Last updated: 2026-05-10

## Current Contract Status

There is no deployed backend API, auth service, remote sync, SQLite repository, or server persistence in the current IronPath frontend.

A read-only API skeleton exists under `apps/api/src/readMirror.ts` for parity testing and future backend extraction. Pure session and Record/DataHealth mutation skeletons exist under `apps/api/src/sessionMutation.ts` and `apps/api/src/recordDataHealthMutation.ts` for pre-backend write-boundary parity. A Node-only SQLite snapshot repository exists under `apps/api/src/sqliteRepository.ts` for repository parity tests. A dev-only local API launcher exists under `apps/api/src/node/devLauncher.ts` for manual local smoke testing. These skeletons are not wired into `App.tsx`, the UI, localStorage, or any production runtime server.

All product data is stored in the user's current browser through `localStorage`, with import/export handled as local JSON files. Future agents must not assume any backend endpoint or remote field exists unless this file is updated first.

Task 4.10 adds acceptance/regression audit tests over these boundaries. It does not make the API production-ready, does not switch App runtime storage, and does not connect the frontend to HTTP or SQLite.

Task 4.12 adds `docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md` as a manual acceptance procedure for the dev-only local API stack. It is documentation and consistency testing only; HTTP behavior still comes from devLauncher, httpRuntimeAdapter, and serverAdapter, and the App runtime still uses localStorage.

Task 4.13 adds automated smoke hardening for the dev-only local API runtime stack. It exercises real HTTP requests against temporary file-backed SQLite repositories, but still does not add runtime features, production server behavior, App/UI integration, package dependencies, or new API routes.

Task 4.14 adds `docs/LOCAL_API_RUNNER_STRATEGY.md` as a runner strategy and decision record. It is not a runtime feature, does not add scripts or dependencies, and keeps devLauncher as a programmatic Node-only API.

Task 4.15 implements Result A from the runner strategy: a dev-only compiled JavaScript runner prototype. It adds dev-only `api:dev:build` and `api:dev` scripts without new dependencies or lockfile changes, keeps output under `.ironpath/dev-api-runner`, and does not connect App runtime to HTTP or SQLite.

Task 4.16 adds `docs/DEV_API_RUNNER_MANUAL_ACCEPTANCE.md` as the manual acceptance runbook for the compiled dev API runner. It is an acceptance procedure, not a runtime feature; HTTP behavior still comes from httpRuntimeAdapter/serverAdapter and there is still no App/UI integration, auth, sync, deployment, or production backend.

Task 4.17 adds a Node-only dev DB recovery/reset utility and `docs/DEV_API_RECOVERY_RESET.md`. It is local development safety tooling only; there is no HTTP reset endpoint, no runner reset flag, no production recovery system, and no App runtime migration.

Task 4.18 adds `docs/APP_RUNTIME_MIGRATION_READINESS_AUDIT.md` as a readiness audit and decision record. It is not a runtime API feature; App runtime still uses localStorage, formal App HTTP migration remains blocked, and the only recommended next step is `Task 4.19 Dev API Read-only App Integration Plan V1`.

Task 4.19 adds `docs/DEV_API_READONLY_APP_INTEGRATION_PLAN.md` as a read-only App integration plan. It is plan-only, does not add runtime API features, keeps App runtime on localStorage, and keeps App mutation routes blocked. Task 4.20 is only a candidate next step if 4.19 acceptance passes and remains dev-only dual-read comparison mode.

Task 4.20 adds a minimal dev-only read-only App integration prototype. It is explicit opt-in only, dual-read comparison mode only, and diagnostic-only. App runtime source of truth remains localStorage; no mutation, backup/import, repair/reset, auth, sync, deployment, package dependency, or production backend behavior is added.

Task 4.21 adds Read-only Runtime Parity Acceptance V1 for the Task 4.20 prototype. It is an acceptance/testing layer, not a runtime feature. It proves flag-off parity, GET-only reads, API unavailable fallback, mismatch diagnostics-only behavior, localStorage integrity, diagnostics UI safety, and browser/Node isolation. localStorage remains source of truth, API results never overwrite localStorage, no UI writes to API, no mutation route used by App, and write-path migration remains blocked.

Task 4.22 adds Read-only Diagnostics UX Hardening V1. It is diagnostics UX/testing hardening only, not runtime migration. It keeps diagnostics read-only, presentational, and safe: no mutation route used by App, no localStorage overwrite, no repair/sync/overwrite/import/export/reset/apply/fix controls, and no production backend/auth/sync/deployment behavior.

Task 4.23 adds Read-only Manual App Acceptance V1 at `docs/READONLY_APP_MANUAL_ACCEPTANCE.md`. It is manual acceptance documentation and docs/static-boundary testing only, not a runtime feature. It does not change App runtime, diagnostics runtime, localStorage, write paths, production backend behavior, auth, sync, deployment, package scripts, dependencies, lockfiles, or schemas.

Task 4.24 adds `docs/MUTATION_INTEGRATION_READINESS_AUDIT.md` as a mutation integration readiness audit. It is an audit and decision record only, not a runtime API feature. Existing mutation routes remain server/dev API only; App runtime does not call mutation routes, write-path migration remains blocked, and the next recommended task is planning-only `Task 4.25 Write-path Source-of-truth & Offline Strategy V1`.

Task 4.25 adds `docs/WRITE_PATH_SOURCE_OF_TRUTH_OFFLINE_STRATEGY.md` as the write-path source-of-truth and offline strategy. It is strategy documentation only, not a runtime API feature. App runtime still does not call mutation routes, source-of-truth remains localStorage, no offline mutation queue exists, and write-path migration remains blocked.

Task 4.26 adds `docs/MUTATION_UX_CONFIRMATION_ROLLBACK_PLAN.md` as mutation UX confirmation and rollback planning. It is UX strategy only, not a runtime API feature. App runtime still does not call mutation routes, no mutation prototype is implemented, and future write UX must follow the no-fake-success rule.

Task 4.27 adds `docs/LOWEST_RISK_MUTATION_PROTOTYPE_PLAN.md` as the first lowest-risk mutation prototype plan. It is planning only, not a runtime API feature. DataHealth issue dismiss is the first future candidate, but App runtime still does not call mutation routes and write-path migration remains blocked.

Task 4.28 adds a dev-only, explicit opt-in DataHealth issue dismiss mutation prototype. It is a one-route experiment only: `POST /data-health/issues/:issueId/dismiss`. It does not switch source of truth, does not replace localStorage, does not add a broad frontend mutation client, does not add session/history/DataHealth repair/backup/reset routes to the App, and does not add production backend/auth/sync/deployment behavior. Success requires HTTP success, a successful mutation result, and snapshot metadata; API results never overwrite AppData or localStorage.

Task 4.29 adds DataHealth Dismiss Prototype Acceptance V1. It is an acceptance/testing and manual runbook layer for the existing one-route prototype, not an expansion of mutation capability. The only accepted browser mutation route remains `POST /data-health/issues/:issueId/dismiss`; localStorage remains source of truth; API results never overwrite AppData or localStorage; no session/history/DataHealth repair/backup/import/export/reset/recovery routes are accepted from browser code.

Task 4.30 adds DataHealth Dismiss Manual App Acceptance V1. It is a human-run manual App acceptance checklist for the existing one-route prototype, not new runtime capability. It keeps the only accepted browser mutation route as `POST /data-health/issues/:issueId/dismiss`, requires a dedicated test browser profile, and keeps localStorage as source of truth.

Task 4.31 adds DataHealth Dismiss Prototype Hardening V1. It hardens the existing one-route prototype only: no new mutation route, no second prototype, no source-of-truth switch, no localStorage overwrite, and no AppData overwrite. Success shape is strict and no-fake-success behavior is hardened for no-change, issue-not-found, missing snapshot metadata, unavailable/timeout/abort, malformed response, and repository/write failure cases.

Task 4.32 adds DataHealth Dismiss Prototype Observability & Recovery Notes V1. It adds dev-only safe diagnostics and manual recovery guidance for the existing one-route prototype only. It adds no HTTP endpoint, no browser reset/recovery action, no localStorage overwrite, no AppData overwrite, no production backend/auth/sync/deployment behavior, no package changes, and no normalized tables.

Task 4.33 adds DataHealth Dismiss Regression Lock V1. It is a regression/testing layer only, not new runtime capability. It locks the existing DataHealth dismiss prototype as one-route-only, keeps localStorage as source of truth, keeps API results from overwriting AppData/localStorage, and keeps broader write-path migration blocked.

Task 4.34 adds `docs/SECOND_MUTATION_CANDIDATE_READINESS_AUDIT.md` as Second Mutation Candidate Readiness Audit V1. It is audit-only and does not add runtime capability, a second mutation route, App POST wiring, a frontend mutation client, source-of-truth switching, production backend, auth, sync, deployment, package changes, or normalized tables. The only implemented browser mutation route remains `POST /data-health/issues/:issueId/dismiss`; `POST /history/:id/data-flag` is only the future candidate for a planning task.

## Read Mirror API Skeleton

Owner files:

- `apps/api/src/readMirror.ts`
- `apps/api/src/index.ts`

Boundary:

- The skeleton is read-only.
- Only `GET` routes are declared.
- Non-`GET` requests return `405`.
- Handlers do not read or write localStorage.
- Handlers do not mutate `AppData`.
- Handlers do not import SQLite, Fastify, or backend runtime code.
- `App.tsx`, `loadData`, `saveData`, backup import/export, and Focus Mode mutation behavior remain unchanged.

Current routes:

- `GET /health`: service name, read-only mode, schema version, and route registry.
- `GET /app-data/summary`: counts and selected AppData state, including template/history counts, selected template ids, unit settings, pending patch count, dismissed counts, and repair log count.
- `GET /sessions/summary`: active session summary, history counts, analytics-included count, dataFlag counts, and latest session.
- `GET /history`: history list mirror using existing Record date and summary helpers.
- `GET /history/:id`: one history session with `getSessionCalendarDate` and `buildSessionDetailSummary`.
- `GET /data-health/summary`: DataHealth status, summary, issue count, and existing issue payload.

This skeleton is not a write API. It must not be extended with session mutation, record edit, data repair, backup import, SQLite, auth, or sync behavior without a separate migration task and parity tests.

## Session Mutation API Skeleton

Owner files:

- `apps/api/src/sessionMutation.ts`
- `apps/api/src/index.ts`
- `packages/contracts/src/index.ts`

Boundary:

- The skeleton is a pure function boundary, not a server runtime.
- Handlers accept `AppData + SessionMutationRequest` and return `SessionMutationResponse`.
- Handlers do not read or write localStorage.
- Handlers do not save returned data.
- Handlers do not mutate the input `AppData` object.
- Handlers do not import SQLite, Fastify, Express, auth, or cloud sync code.
- `App.tsx`, UI handlers, Focus Mode runtime, `loadData`, `saveData`, and backup import/export behavior remain unchanged.
- `nextData` may only be present when `result.ok === true && result.changed === true`.
- Invalid, no-op, conflict, requires-confirmation, and unsupported route paths must not return `nextData`.

Current routes:

- `POST /sessions/start`: creates an active session from `body.templateId || activeProgramTemplateId || selectedTemplateId`, and consumes a matching pending session patch only after successful start.
- `POST /sessions/active/patches`: applies explicit `SessionPatch[]` or a referenced pending patch to the active session.
- `POST /sessions/active/complete`: completes the active session into history; incomplete main work returns a confirmation-required result until confirmed.
- `POST /sessions/active/discard`: discards the unsaved active session after confirmation and does not write history.

This skeleton must not be extended with record edit, Focus step-level mutation, exercise replacement mutation, DataHealth repair, backup import/export mutation, SQLite repository, auth, or cloud sync behavior without a separate task and parity tests.

## Record & DataHealth Mutation API Skeleton

Owner files:

- `apps/api/src/recordDataHealthMutation.ts`
- `apps/api/src/index.ts`
- `packages/contracts/src/index.ts`

Boundary:

- The skeleton is a pure function boundary, not a server runtime.
- Handlers accept `AppData + RecordDataHealthMutationRequest` and return `RecordDataHealthMutationResponse`.
- Handlers do not read or write localStorage.
- Handlers do not save returned data.
- Handlers do not mutate the input `AppData` object.
- Handlers do not import SQLite, Fastify, Express, auth, or cloud sync code.
- `App.tsx`, UI handlers, `loadData`, `saveData`, backup import/export behavior, training algorithms, PR/e1RM, and effective-set rules remain unchanged.
- `nextData` may only be present when `result.ok === true && result.changed === true`.
- Invalid, no-op, not-found, requires-confirmation, unsafe, and unsupported route paths must not return `nextData`.

Current routes:

- `POST /history/:id/edit`: applies existing record set-edit helpers to one history session and preserves editHistory.
- `POST /history/:id/data-flag`: updates an existing session `dataFlag` to `normal`, `test`, or `excluded` through the current audit trail; test/excluded records remain visible but excluded from default statistics.
- `POST /data-health/issues/:issueId/dismiss`: dismisses an existing DataHealth issue for today without changing training records.
- `POST /data-health/repair/apply`: applies only the whitelisted `legacy_display_weight` repair after confirmation. It uses `repairLegacyDisplayWeights`, keeps `actualWeightKg` unchanged, and stores summary-only repair logs.

This skeleton does not implement backup import/export mutation, arbitrary record patching, Focus step mutation, replacement mutation, scheduler mutation, SQLite repository, auth, or cloud sync. Import-like unsafe payloads are defensively rejected by the repair boundary and are never sanitized into AppData.

## SQLite Repository Parity Layer

Owner files:

- `apps/api/src/sqliteRepository.ts`
- `apps/api/src/node/index.ts`

Boundary:

- The repository is Node-only and used only for parity tests.
- It uses Node built-in `node:sqlite` / `DatabaseSync`.
- It is not a runtime API and does not start a server.
- It does not read or write localStorage.
- It does not replace `loadData`, `saveData`, or the browser persistence facade.
- It is not statically re-exported from the shared `apps/api/src/index.ts`, so Vite browser builds do not parse or bundle `node:sqlite`.
- readMirror, sessionMutation, and recordDataHealthMutation still accept and return `AppData`; they do not depend on SQLite.

Snapshot schema:

- `app_meta(key TEXT PRIMARY KEY, value TEXT NOT NULL)`
- `app_data_snapshots(row_id INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT UNIQUE NOT NULL, schema_version INTEGER NOT NULL, app_data_json TEXT NOT NULL, created_at TEXT NOT NULL, label TEXT)`

Repository behavior:

- `writeSnapshot(appData)` sanitizes and validates AppData, then writes one JSON snapshot in a SQLite transaction.
- `readSnapshot(snapshotId?)` reads a specific snapshot or the latest snapshot using `ORDER BY row_id DESC LIMIT 1`, then validates, sanitizes, and validates again.
- `exportBackupFromSnapshot(snapshotId?)` delegates to existing `exportAppData`.
- `importBackupToSnapshot(payload)` parses and analyzes import data before writing; unsafe data is rejected, needs-review data requires explicit confirmation, and safe/cleaned data reuses existing backup import behavior.
- The repository stores AppData snapshots only. It does not create normalized sessions, sets, exercises, analytics, or DataHealth tables.
- `app_meta.latest_snapshot_id` is non-authoritative metadata. Latest snapshot selection must not read it.

Failure-mode contract:

- Repository errors use `SqliteRepositoryError.code`, not raw SQLite errors, for the stable surface.
- Stable codes are `node_sqlite_unavailable`, `snapshot_not_found`, `snapshot_json_invalid`, `snapshot_validation_failed`, `repository_schema_mismatch`, `write_failed`, `import_rejected`, `transaction_failed`, and `database_closed`.
- Missing snapshots fail with `snapshot_not_found`.
- Corrupt snapshot JSON fails with `snapshot_json_invalid`.
- Parsed JSON that is not valid AppData fails with `snapshot_validation_failed`; the repository must not silently return `emptyData`.
- A stored `repository_schema_version` mismatch fails with `repository_schema_mismatch`.
- Failed writes/imports must not leave partial snapshots or point `latest_snapshot_id` at missing/failed data.
- `close()` is idempotent; repository operations after close fail with `database_closed`.

This layer must not be used by the frontend runtime until a separate server/repository migration task defines that data flow and its recovery path.

## Server Adapter Skeleton

Owner files:

- `apps/api/src/node/serverAdapter.ts`
- `apps/api/src/node/index.ts`

Boundary:

- The adapter is Node-only and is not statically exported from `apps/api/src/index.ts`.
- It is not an HTTP server and does not start Fastify, Express, a listener, auth, or sync.
- It does not replace `App.tsx`, UI handlers, localStorage, `loadData`, or `saveData`.
- It composes existing boundaries only: SQLite repository, readMirror, sessionMutation, and recordDataHealthMutation.
- It does not create normalized SQLite tables.

Request shape:

- `method: string`
- `path: string`
- optional `body`
- optional `query`
- optional `nowIso`

Response shape:

- `status: number`
- optional `result`
- optional `error: { code: string; message: string }`
- optional `snapshot: { snapshotId: string; schemaVersion: number; createdAt: string }`

Route behavior:

- `GET /health` returns skeleton-ready health without requiring an existing AppData snapshot.
- Non-health GET routes read the latest AppData snapshot with the repository, then delegate to readMirror.
- Mutation routes read the latest AppData snapshot, delegate to sessionMutation or recordDataHealthMutation, and write a new snapshot only when the mutation response contains `nextData`.
- A mutation is considered persisted only after `writeSnapshot` succeeds. If snapshot write fails, the adapter returns a repository error response and no success result.
- No-op, invalid, not-found, requires-confirmation, unsafe, and unsupported mutation results do not write snapshots and do not return snapshot metadata.
- Route resolution first matches path patterns. A known path with a wrong method returns `405 / unsupported_route`; an unknown path returns `404 / unsupported_route`.
- Mutation snapshot labels use `mutation:<route-pattern>`.

Repository error mapping:

- `snapshot_not_found`: 404
- `import_rejected`: 400
- `database_closed`: 503
- `snapshot_json_invalid`, `snapshot_validation_failed`, `repository_schema_mismatch`, `node_sqlite_unavailable`, `write_failed`, `transaction_failed`, and unknown repository errors: 500
- Adapter errors expose stable code/message only, not raw stacks.

## HTTP Runtime Adapter Smoke Layer

Owner files:

- `apps/api/src/node/httpRuntimeAdapter.ts`
- `apps/api/src/node/index.ts`

Boundary:

- The HTTP runtime adapter is Node-only and is not exported from `apps/api/src/index.ts`.
- It is a smoke-test wrapper, not a production server.
- It uses Node built-in `node:http` in tests and does not add Fastify, Express, Koa, Hono, tRPC, GraphQL, auth, sync, deployment config, Docker, or serverless runtime.
- It does not replace `App.tsx`, UI handlers, localStorage, `loadData`, or `saveData`.
- It does not implement business routes. It forwards method/path/query/body to serverAdapter.
- It does not add backup import/export endpoints.

Request parsing:

- GET and HEAD do not read a request body.
- HEAD is forwarded to serverAdapter as `method: "HEAD"` and usually returns `405 / unsupported_route`.
- POST with an empty body is allowed without `Content-Type` and forwards `body: undefined`.
- POST with a non-empty body requires `application/json`.
- Malformed JSON returns `400 / invalid_json`.
- Body over `maxBodyBytes` returns `413 / request_body_too_large`.
- Unsupported media type returns `415 / unsupported_media_type`.
- Query string values are forwarded as `Record<string, string>`.

HTTP response body:

- Success: `{ "result": <adapter.result>, "snapshot": <adapter.snapshot if present> }`
- Error: `{ "error": { "code": string, "message": string } }`
- HTTP status comes from serverAdapter or the parsing error.
- The wrapper does not expose raw stacks, raw SQLite errors, or internal exception objects.

## Dev-only Local API Launcher

Owner files:

- `apps/api/src/node/devLauncher.ts`
- `apps/api/src/node/index.ts`

Boundary:

- The launcher is Node-only and is exported only from `apps/api/src/node/index.ts`.
- It is a local development launcher for manual smoke tests, not a production backend.
- It does not connect to `App.tsx`, UI, browser localStorage, `loadData`, or `saveData`.
- It does not add Fastify, Express, auth, sync, deployment config, Docker, serverless runtime, or normalized database tables.
- It does not add business routes or backup import/export endpoints.
- HTTP behavior still comes from `httpRuntimeAdapter` and `serverAdapter`.
- Browser-facing `apps/api/src/index.ts` must not export the launcher.

Launcher API:

- `createDevLocalApiLauncher(options)` returns `{ start, close }`.
- Importing or creating the launcher has no listen, SQLite, or file side effects.
- `start()` explicitly opens a file-backed SQLite snapshot repository and starts a Node HTTP server.
- Calling `start()` again while already running returns the existing `{ url, host, port }` instead of creating another server or repository.
- `close()` closes the HTTP server and SQLite repository and is idempotent.
- Startup failures clean up any opened resources before surfacing a stable launcher error.

Defaults and safety:

- Default host is `127.0.0.1`.
- `localhost`, `127.0.0.1`, and `::1` are local-safe.
- `0.0.0.0` and other non-localhost hosts require `allowNetworkAccess=true`.
- Default DB path is `.ironpath/dev-api.sqlite`.
- `seedEmpty=false` does not create an AppData snapshot; `/health` still works, while data routes may return `snapshot_not_found`.
- `seedEmpty=true` creates one empty AppData snapshot only when no latest snapshot exists.
- Seed snapshots use label `dev-launcher:seed-empty`.

This launcher is useful for local smoke tests only. It is not a signal that the frontend should call HTTP, that SQLite should replace localStorage, or that a production backend is ready.

## Runtime Boundary Acceptance

Owner test files:

- `tests/runtimeBoundaryNodeOnlyIsolation.test.ts`
- `tests/runtimeBoundaryPersistenceCompatibility.test.ts`
- `tests/runtimeBoundaryMutationContract.test.ts`
- `tests/runtimeBoundaryRepositoryContract.test.ts`
- `tests/runtimeBoundaryServerHttpContract.test.ts`
- `tests/runtimeBoundaryDataSemanticsRegression.test.ts`

Acceptance contract:

- Static Node-only isolation scans target production/runtime source files, not tests.
- `src/**` and browser-facing `apps/api/src/index.ts` must not import Node-only runtime modules, `node:http`, or `node:sqlite`.
- `apps/api/src/node/index.ts` is the Node-only entry for SQLite repository, server adapter, and HTTP smoke wrapper exports.
- `persistence.ts` remains the frontend compatibility facade and App runtime still uses localStorage.
- `appDataMigration`, `appDataSanitize`, `appDataValidation`, and `appDataStorageUtils` must not access `window`, `document`, or `localStorage`.
- `localStorageAdapter` remains the only AppData browser I/O boundary allowed to access localStorage.
- readMirror remains read-only.
- sessionMutation and recordDataHealthMutation may return `nextData` only when `result.ok === true && result.changed === true`.
- Invalid, no-op, not-found, requires-confirmation, unsafe, and unsupported mutation paths must not return `nextData`.
- SQLite remains Node-only and snapshot-only; latest snapshot selection uses `row_id DESC`.
- Corrupt or invalid SQLite snapshots must fail with stable repository errors and must not fall back to `emptyData`.
- serverAdapter only composes repository/read/mutation boundaries; it does not start an HTTP server.
- httpRuntimeAdapter only parses Node HTTP requests, forwards to serverAdapter, and writes stable JSON responses.
- Boundary round-trips must preserve backup safety, `actualWeightKg`, legacy display fallback, `identityInvalid`, `legacyActualExerciseId`, test/excluded record exclusion, summary-only repair logs, and readMirror parity.

This acceptance layer is a regression lock for future backend work. It is not a production backend, not a dev server launcher, not an App runtime migration, and not a claim that SQLite should replace browser localStorage.

## Manual API Acceptance Checklist

Owner files:

- `docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md`
- `tests/manualApiAcceptanceChecklist.test.ts`

Boundary:

- The checklist is a manual local acceptance procedure, not a runtime feature.
- It does not add production server behavior, Fastify, Express, auth, sync, deployment, App UI integration, or localStorage replacement.
- It does not add package dependencies, package scripts, backup import/export HTTP endpoints, or normalized database tables.
- It documents how to manually verify `devLauncher -> httpRuntimeAdapter -> serverAdapter -> sqliteRepository`.
- HTTP route behavior remains owned by the existing dev launcher, HTTP runtime adapter, and server adapter.
- App runtime remains browser localStorage through the existing persistence facade.

Checklist coverage:

- branch, command, and artifact prerequisites
- launcher start/close boundary and localhost safety
- health behavior without a required snapshot
- `seedEmpty=false` and `seedEmpty=true` behavior
- read route and mutation route acceptance
- HTTP parsing errors and stable response body shapes
- DB file safety and browser build safety
- backup safety, `actualWeightKg`, `identityInvalid`, `legacyActualExerciseId`, and test/excluded record semantics

The checklist is the hand-run acceptance companion to the automated boundary tests. It must not be used as evidence that the production frontend is ready to switch to HTTP or SQLite.

## Dev Runtime Smoke Hardening

Owner test files:

- `tests/devRuntimeSmokeLifecycle.test.ts`
- `tests/devRuntimeSmokeSeedAndRead.test.ts`
- `tests/devRuntimeSmokeMutationPersistence.test.ts`
- `tests/devRuntimeSmokeFailureNoWrite.test.ts`
- `tests/devRuntimeSmokeLocalhostSafety.test.ts`
- `tests/devRuntimeSmokeBrowserIsolation.test.ts`
- `tests/devRuntimeSmokeManualChecklistParity.test.ts`

Boundary:

- These tests harden the dev-only local stack through real HTTP requests and temporary file-backed SQLite repositories.
- They do not add business routes, package scripts, package dependencies, backup import/export HTTP endpoints, production server behavior, auth, sync, deployment, App UI integration, or localStorage replacement.
- Mutation success smoke uses pre-seeded valid AppData with a startable template; it must not weaken session template validation or assume `emptyData` can start a session.
- Parsing errors, unsupported routes, wrong methods, no-op mutations, invalid mutations, requires-confirmation responses, and unsafe import-like payloads must not write snapshots.
- Unsupported business routes and wrong methods preserve the existing serverAdapter result shape with `reasonCode: "unsupported_route"`; parsing and repository errors use `{ error: { code, message } }`.
- Browser-facing builds must remain isolated from `node:http`, `node:sqlite`, devLauncher, httpRuntimeAdapter, serverAdapter, and sqliteRepository.

This hardening is an automated companion to the manual checklist. It is not a signal that the production frontend should call the local API stack.

## Local API Runner Strategy

Owner files:

- `docs/LOCAL_API_RUNNER_STRATEGY.md`
- `tests/localApiRunnerStrategy.test.ts`

Boundary:

- The strategy is a decision record, not a runner implementation.
- It does not add package dependencies, package scripts, App UI integration, localStorage replacement, production server behavior, auth, sync, deployment, backup import/export HTTP endpoints, or normalized tables.
- It keeps `createDevLocalApiLauncher(options)` as a programmatic Node-only API.
- It documents that browser-facing `apps/api/src/index.ts` does not export Node-only runtime.
- It records that App runtime still uses localStorage through the existing persistence facade.

Recommendation:

- Short-term recommendation is Option A: no runner yet, keep the programmatic launcher only.
- Next recommended task is `Task 4.15 Dev API Runner Prototype V1`.
- Task 4.15 may prototype a compiled JavaScript runner, a TypeScript runtime runner proposal with explicit dependency approval, or continued manual test harness use.
- Task 4.15 is still not App runtime migration.

This strategy must not be read as evidence that a local API runner already exists, that `App.tsx` is connected, or that the backend is production-ready.

## Dev API Runner Prototype

Owner files:

- `apps/api/src/node/devApiRunner.ts`
- `tests/devApiRunnerCli.test.ts`
- `tests/devApiRunnerCompiledPrototype.test.ts`
- `tests/devApiRunnerNodeOnlyIsolation.test.ts`
- `tests/devApiRunnerPackageScripts.test.ts`
- `tests/devApiRunnerStrategyAudit.test.ts`

Boundary:

- Result A is implemented: dev-only compiled JavaScript runner.
- The runner is Node-only and may only be exported from `apps/api/src/node/index.ts`.
- Browser-facing `apps/api/src/index.ts` must not export the runner.
- The runner builds to `.ironpath/dev-api-runner`; generated output is ignored and not committed.
- `api:dev:build` may clear `.ironpath/dev-api-runner` only. It must not delete `.ironpath/dev-api.sqlite`, `.sqlite-wal`, `.sqlite-shm`, or sibling dev artifacts.
- `api:dev` forwards `npm run api:dev -- <args>` to the compiled runner.
- Ready output is deterministic: `IronPath dev API ready: <url>`.
- The runner is dev-only and localhost-only by default.
- It does not add production server behavior, Fastify, Express, auth, sync, deployment, App UI integration, localStorage replacement, backup import/export HTTP endpoints, or normalized tables.

Supported runner args:

- `--host`
- `--port`
- `--db`
- `--seed-empty`
- `--allow-network-access`
- `--max-body-bytes`
- `--help`

This prototype is not production backend readiness and is not App runtime migration.

## Dev API Runner Manual Acceptance

Owner files:

- `docs/DEV_API_RUNNER_MANUAL_ACCEPTANCE.md`
- `tests/devApiRunnerManualAcceptanceDocs.test.ts`
- `tests/devApiRunnerManualAcceptanceSmoke.test.ts`
- `tests/devApiRunnerManualAcceptanceBoundary.test.ts`

Boundary:

- The runbook is a manual acceptance procedure, not a runtime feature.
- It does not add new package scripts beyond `api:dev:build` and `api:dev`.
- It does not add package dependencies, lockfile changes, production server behavior, Fastify, Express, auth, sync, deployment, App UI integration, localStorage replacement, backup import/export HTTP endpoints, or normalized tables.
- It documents real command acceptance for `npm run api:dev:build` and `npm run api:dev -- <args>`.
- It requires the deterministic ready line: `IronPath dev API ready: <url>`.
- It states `seedEmpty` is enough for read smoke only; mutation success smoke requires a valid preseeded AppData snapshot with a startable template.
- It keeps the existing HTTP response shapes from httpRuntimeAdapter/serverAdapter.
- It keeps generated runner output under ignored `.ironpath/dev-api-runner` and keeps dev SQLite artifacts ignored.

This runbook must not be used as evidence that `App.tsx` is connected, that SQLite replaces localStorage, or that a production backend is ready.

## Dev API Recovery & Reset Safety

Owner files:

- `apps/api/src/node/devDbRecovery.ts`
- `docs/DEV_API_RECOVERY_RESET.md`
- `tests/devDbRecoveryArtifacts.test.ts`
- `tests/devDbRecoveryInspect.test.ts`
- `tests/devDbRecoveryBackup.test.ts`
- `tests/devDbRecoveryResetSafety.test.ts`
- `tests/devDbRecoveryNodeOnlyIsolation.test.ts`
- `tests/devDbRecoveryRunnerCompatibility.test.ts`

Boundary:

- Recovery/reset utilities are Node-only and may only be exported from `apps/api/src/node/index.ts`.
- Browser-facing `apps/api/src/index.ts` must not export recovery utilities.
- The utility is for local dev SQLite artifacts only.
- It does not add HTTP backup, import, reset, or delete endpoints.
- It does not add runner CLI reset flags, package scripts, dependencies, production recovery behavior, auth, sync, deployment, App UI integration, localStorage replacement, backup import/export HTTP endpoints, or normalized tables.
- Missing DB inspect must not create a DB file.
- Existing DB inspect uses read-only SQLite access and must not write snapshots.
- Main DB paths must end with `.sqlite`.
- Reset requires `RESET_DEV_API_DB`.
- Reset defaults to backing up first.
- Reset may only delete `dbFile`, `dbFile-wal`, `dbFile-shm`, and `dbFile-journal`.
- Reset must reject symlink and path-escape artifacts.
- Reset must not delete `.ironpath/dev-api-runner`, backup folders, directories, glob matches, JSON files, source files, fixtures, or unrelated siblings.

This safety layer is not a production recovery system and must not automatically repair or reset corrupt data.

## App Runtime Migration Readiness Audit

Owner files:

- `docs/APP_RUNTIME_MIGRATION_READINESS_AUDIT.md`
- `tests/appRuntimeMigrationReadinessAudit.test.ts`
- `tests/appRuntimeMigrationBoundaryStillBlocked.test.ts`

Boundary:

- This is a readiness audit and decision record, not a runtime API feature.
- App runtime still uses localStorage through `App.tsx`, `persistence.ts`, and `localStorageAdapter`.
- There is no App.tsx integration, UI integration, localStorage replacement, frontend API client, feature flag wiring, production backend, auth, sync, deployment, normalized tables, package dependency, or package script.
- Browser-facing `apps/api/src/index.ts` remains safe and must not export Node-only runtime values.
- `apps/api/src/node/index.ts` remains the Node-only entry for sqliteRepository, serverAdapter, httpRuntimeAdapter, devLauncher, devApiRunner, and devDbRecovery.
- The readiness result is not permission to connect the frontend to HTTP or SQLite.

Recommendation:

- Task 4.18 result: not ready for direct App.tsx HTTP migration.
- The only recommended next task is `Task 4.19 Dev API Read-only App Integration Plan V1`.
- Short-term source-of-truth recommendation is Option C: dual-read comparison mode only.
- Future read-only work must be dev-only, explicit opt-in, localStorage-default, no API writes, no backup/import over HTTP, visible on API failure, and easy to roll back.

Formal App.tsx HTTP migration remains blocked until read-only planning, prototype acceptance, API unavailable fallback, rollback, and later mutation-readiness gates are complete.

## Dev API Read-only App Integration Plan

Owner files:

- `docs/DEV_API_READONLY_APP_INTEGRATION_PLAN.md`
- `tests/devApiReadonlyAppIntegrationPlan.test.ts`
- `tests/devApiReadonlyAppIntegrationBoundary.test.ts`

Boundary:

- This is a plan and decision record, not a runtime API feature.
- App runtime still uses localStorage through the existing browser persistence path.
- There is no App.tsx implementation, UI change, frontend API client implementation, feature flag runtime implementation, localStorage replacement, mutation integration, production backend, auth, sync, deployment, package dependency, package script, or normalized tables.
- Browser-facing `apps/api/src/index.ts` remains safe and must not export Node-only runtime values.
- No mutation route should be used by App runtime.
- No backup/import, repair/reset, or delete route should be called from App runtime.

Recommendation:

- Recommended mode is dual-read comparison mode only.
- localStorage remains the only active App source of truth.
- Dev API read results are comparison/diagnostics only and must never overwrite localStorage.
- API unavailable must not block normal App usage.
- Task 4.20 is only the next recommended task if Task 4.19 acceptance passes, and it must remain dev-only, explicit opt-in, and dual-read comparison only.

Formal App.tsx HTTP migration and write-path migration remain blocked.

## Read-only App Integration Prototype

Owner files:

- `src/devApi/devApiReadOnlyConfig.ts`
- `src/devApi/devApiReadOnlyClient.ts`
- `src/devApi/devApiReadOnlyComparison.ts`
- `src/devApi/DevApiReadOnlyDiagnostics.tsx`
- `src/App.tsx`

Boundary:

- This is dev-only, explicit opt-in, dual-read comparison mode only.
- Enabled only when `import.meta.env.DEV === true` and `VITE_IRONPATH_DEV_API_COMPARE === "1"`.
- Default Dev API base URL is `http://127.0.0.1:8787`.
- Allowed base URLs must be localhost-only.
- App runtime source of truth remains localStorage and existing in-memory AppData.
- Dev API read results are diagnostics only and must never overwrite localStorage or AppData.
- UI must not write to API.
- App must not call mutation, backup/import, repair/reset, or delete routes.
- API unavailable must not block normal App usage.
- Diagnostics must expose no repair, sync, overwrite, import, export, reset, or mutation controls.
- Browser runtime must not import `node:http`, `node:sqlite`, sqliteRepository, serverAdapter, httpRuntimeAdapter, devLauncher, devApiRunner, or devDbRecovery.

Read-only comparison routes:

- `GET /app-data/summary`
- `GET /sessions/summary`
- `GET /history`
- `GET /data-health/summary`
- `GET /history/:id` only when a stable local history id exists

Formal App.tsx HTTP migration, source-of-truth switching, and write-path migration remain blocked after Task 4.20.

## Read-only Runtime Parity Acceptance

Owner test files:

- `tests/readOnlyRuntimeFlagOffParity.test.ts`
- `tests/readOnlyRuntimeGetOnly.test.ts`
- `tests/readOnlyRuntimeApiUnavailableFallback.test.ts`
- `tests/readOnlyRuntimeMismatchDiagnostics.test.ts`
- `tests/readOnlyRuntimeLocalStorageIntegrity.test.ts`
- `tests/readOnlyRuntimeDiagnosticsUi.test.ts`
- `tests/readOnlyRuntimeBoundary.test.ts`
- `tests/readOnlyRuntimeDocsParity.test.ts`

Task 4.21 is acceptance coverage for the existing read-only prototype. It does not add a runtime API feature, App write integration, production backend, auth, sync, deployment, package dependency, package script, or normalized table.

Acceptance facts:

- flag-off parity keeps diagnostics inert: no panel, no fetch calls, no AppData mutation, and no localStorage writes.
- enabled diagnostics use only GET reads for the fixed read-only route allowlist.
- API unavailable fallback is diagnostic-only and keeps the App on localStorage.
- mismatch results are diagnostics only; API results never overwrite localStorage or AppData.
- no UI writes to API and no mutation route used by App.
- diagnostics UI exposes no repair, sync, overwrite, import, export, reset, apply, or fix controls.
- browser build and static boundary checks remain free of `node:http`, `node:sqlite`, `devLauncher`, `httpRuntimeAdapter`, `serverAdapter`, `sqliteRepository`, `devApiRunner`, and `devDbRecovery`.

Formal App.tsx HTTP migration, source-of-truth switching, and write-path migration remain blocked after Task 4.21.

## Read-only Diagnostics UX Hardening

Owner files:

- `src/devApi/DevApiReadOnlyDiagnostics.tsx`
- `src/devApi/DevApiReadOnlyDiagnosticsController.tsx`
- `src/devApi/devApiReadOnlyComparison.ts`

Owner test files:

- `tests/readOnlyDiagnosticsStatusModel.test.ts`
- `tests/readOnlyDiagnosticsEndpointSummary.test.ts`
- `tests/readOnlyDiagnosticsMismatchCopy.test.ts`
- `tests/readOnlyDiagnosticsUnavailableCopy.test.ts`
- `tests/readOnlyDiagnosticsMisconfiguration.test.ts`
- `tests/readOnlyDiagnosticsDocsParity.test.ts`

Task 4.22 is a diagnostics UX/testing layer only. It does not expand the Dev API route allowlist, add mutation methods, change App source of truth, add production server behavior, or add auth/sync/deployment.

Contract facts:

- `DevApiReadOnlyDiagnostics.tsx` is presentational only and does not fetch, trigger comparison, read/write localStorage, call persistence helpers, or import Node-only modules.
- The diagnostics display model covers disabled, checking, matching, mismatch, unavailable, error, and misconfigured states with safe labels, explanations, and severity.
- Disabled renders no visible panel in normal App usage.
- Mismatch is warning-level diagnostics only; localStorage remains source of truth and No data was changed.
- Unavailable is non-fatal diagnostics only; the App continues using localStorage.
- Misconfiguration copy is safe and localhost-only.
- Endpoint summaries are compact and do not expose raw stack traces, raw SQLite errors, full response dumps, or personal data dumps.
- Rendered diagnostics expose no repair, sync, overwrite, import, export, reset, apply, or fix controls.
- No mutation route used by App and no localStorage overwrite occurs.

Formal App.tsx HTTP migration, source-of-truth switching, and write-path migration remain blocked after Task 4.22.

## Read-only Manual App Acceptance

Owner files:

- `docs/READONLY_APP_MANUAL_ACCEPTANCE.md`

Owner test files:

- `tests/readOnlyManualAppAcceptanceDocs.test.ts`
- `tests/readOnlyManualAppAcceptanceBoundary.test.ts`
- `tests/readOnlyManualAppAcceptanceDocsParity.test.ts`

Task 4.23 is manual acceptance documentation for the existing dev-only read-only diagnostics prototype. It is not a runtime API feature and does not add routes, mutation methods, UI actions, production server behavior, auth, sync, deployment, package scripts, dependencies, lockfile changes, or schema changes.

Runbook acceptance facts:

- Manual testing must use a dedicated test browser profile and must not clear the daily-use browser profile.
- Manual mismatch and unavailable testing must not use real personal training data.
- The App runtime still uses localStorage.
- localStorage remains source of truth.
- API results never overwrite AppData or localStorage.
- No UI writes to API.
- No mutation routes are called from App.
- Diagnostics expose no repair/sync/overwrite/import/export/reset/apply/fix controls.
- Browser bundle pollution checks scan build output only, such as `dist/`.

Formal App.tsx HTTP migration, source-of-truth switching, and write-path migration remain blocked after Task 4.23.

## Mutation Integration Readiness Audit

Owner files:

- `docs/MUTATION_INTEGRATION_READINESS_AUDIT.md`
- `tests/mutationIntegrationReadinessAudit.test.ts`
- `tests/mutationIntegrationBoundaryStillBlocked.test.ts`

Task 4.24 is a readiness audit and decision record, not a runtime API feature.

Contract facts:

- App runtime still uses localStorage.
- Read-only diagnostics remain dev-only and explicit opt-in.
- The frontend Dev API client remains GET-only.
- Existing mutation routes remain server/dev API only and are not approved for UI integration.
- App runtime does not call session, history, DataHealth, backup/import, reset, or recovery mutation routes.
- There is no App.tsx mutation integration, no UI writes to API, no localStorage replacement, no source-of-truth switch, no production backend, no auth/sync/deployment behavior, no package dependency, no package script, and no normalized tables.
- Future mutation work must first define source-of-truth, offline/PWA, idempotency, reconciliation, confirmation UX, diagnostics, backup/restore checkpoint, and rollback strategy.

Current server/dev API mutation inventory remains:

- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`
- `POST /history/:id/edit`
- `POST /history/:id/data-flag`
- `POST /data-health/issues/:issueId/dismiss`
- `POST /data-health/repair/apply`

Task 4.24 result: Not ready for mutation integration. Write-path migration remains blocked. Next task should be planning-only `Task 4.25 Write-path Source-of-truth & Offline Strategy V1`; it must not implement App mutation calls or connect POST routes to the UI.

## Write-path Source-of-truth & Offline Strategy

Owner files:

- `docs/WRITE_PATH_SOURCE_OF_TRUTH_OFFLINE_STRATEGY.md`
- `tests/writePathSourceOfTruthOfflineStrategy.test.ts`
- `tests/writePathMutationBoundaryStillBlocked.test.ts`

Task 4.25 is a strategy and decision record, not a runtime API feature.

Contract facts:

- Source-of-truth remains localStorage.
- App runtime does not call mutation routes.
- There is no frontend mutation client, mutation feature flag, API-backed persistence adapter, or source-of-truth switch.
- There is no offline mutation queue yet.
- API responses must not overwrite localStorage.
- No dual-write path is approved.
- Future mutation prototypes must require source snapshot checks, idempotency, conflict handling, confirmation UX, rollback UX, and explicit failed-write behavior.
- Existing mutation routes remain server/dev API only and are not approved for App runtime use.

Short-term source-of-truth decision:

- Option E is the unique recommendation: staged migration with read-only comparison, then a later lowest-risk mutation prototype, then explicit source-of-truth switch only after future acceptance.
- Immediate API source-of-truth switching, dual-write without reconciliation, and App mutation prototype before offline/idempotency/rollback strategy are rejected.

Task 4.25 result: Strategy only. Write-path migration remains blocked. App must not call mutation routes yet. Source-of-truth remains localStorage. No offline mutation queue yet. Next task should be `Task 4.26 Mutation UX Confirmation & Rollback Plan V1`.

## Mutation UX Confirmation & Rollback Plan

Owner files:

- `docs/MUTATION_UX_CONFIRMATION_ROLLBACK_PLAN.md`
- `tests/mutationUxConfirmationRollbackPlan.test.ts`
- `tests/mutationUxBoundaryStillBlocked.test.ts`

Task 4.26 is UX strategy and decision record only, not a runtime API feature.

Contract facts:

- App runtime does not call mutation routes.
- There is no frontend mutation client, mutation feature flag, API-backed persistence adapter, or source-of-truth switch.
- There is no mutation prototype implementation.
- Future mutation UX must be user-visible: no fake success, no silent write, no hidden overwrite, no automatic repair, and no automatic sync.
- Success can only be shown after API snapshot persistence is confirmed.
- Failure states must stay visible and must not write localStorage or report success.
- Duplicate-submit prevention, source snapshot checks, idempotency, conflict UX, and rollback UX remain required before any mutation prototype.

Confirmation planning:

- Level 0: DataHealth repair, backup import/export over HTTP, reset/recovery over HTTP, and source-of-truth migration remain unavailable from App runtime.
- Level 1: DataHealth issue dismiss and a future diagnostics acknowledged state are only low-risk candidates and remain blocked.
- Level 2: history data-flag and limited history edit require explicit confirmation.
- Level 3: session start, session patches, session complete, and session discard require strong confirmation and are not first-candidate routes.

Task 4.26 result: UX/rollback plan only. Write-path migration remains blocked. App must not call mutation routes yet. No mutation prototype is implemented. Next task should be `Task 4.27 Lowest-risk Mutation Prototype Plan V1`.

## Lowest-risk Mutation Prototype Plan

Owner files:

- `docs/LOWEST_RISK_MUTATION_PROTOTYPE_PLAN.md`
- `tests/lowestRiskMutationPrototypePlan.test.ts`
- `tests/lowestRiskMutationBoundaryStillBlocked.test.ts`

Task 4.27 is planning only, not a runtime API feature.

Contract facts:

- App runtime does not call mutation routes.
- There is no frontend mutation client, mutation feature flag, API-backed persistence adapter, or source-of-truth switch.
- There is no mutation prototype implementation.
- The first future candidate is DataHealth issue dismiss.
- DataHealth issue dismiss remains blocked until prototype gates pass.
- Source-of-truth remains localStorage.
- The first prototype source-of-truth recommendation is shadow-only / diagnostics mode unless a later task explicitly designs localStorage reconciliation.
- Session mutation, history edit, history data-flag, DataHealth repair, backup/import over HTTP, reset/recovery over HTTP, API source-of-truth switching, and dual-write are rejected as first prototypes.

Task 4.27 result: Plan only. First future candidate: DataHealth issue dismiss. Write-path migration remains blocked. App must not call mutation routes yet. Next task should be `Task 4.28 DataHealth Dismiss Mutation Prototype Plan V1`.

## DataHealth Dismiss Mutation Prototype

Owner files:

- `src/devApi/devApiDataHealthDismissConfig.ts`
- `src/devApi/devApiDataHealthDismissClient.ts`
- `src/devApi/DevApiDataHealthDismissPrototype.tsx`

Owner test files:

- `tests/devApiDataHealthDismissConfig.test.ts`
- `tests/devApiDataHealthDismissClient.test.ts`
- `tests/devApiDataHealthDismissPrototype.test.ts`
- `tests/devApiDataHealthDismissBoundary.test.ts`

Task 4.28 is a dev-only one-route mutation experiment, not full mutation integration or write-path migration.

Opt-in:

- `import.meta.env.DEV === true`
- `VITE_IRONPATH_DEV_API_COMPARE === "1"`
- `VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT === "datahealth-dismiss"`
- Optional `VITE_IRONPATH_DEV_API_BASE_URL` remains localhost-only.

Contract facts:

- The only browser mutation route allowed by this prototype is `POST /data-health/issues/:issueId/dismiss`.
- The read-only client remains GET-only.
- No session mutation route, history edit/data-flag route, DataHealth repair route, backup/import/export/reset/recovery route, broad mutation client, mutation hook/provider, API-backed persistence adapter, production backend, auth, sync, deployment, package dependency, package script, lockfile change, or normalized table is added.
- localStorage remains the active App source of truth.
- API mutation results never overwrite AppData or localStorage.
- The UI requires explicit confirmation, disables duplicate submit while pending, shows failure states, does not auto-retry a write, and does not show success without snapshot metadata.
- Because no optimistic local write occurs, rollback is disabling the mutation flag, stopping the dev API runner, preserving localStorage App behavior, and using existing dev DB recovery/reset procedures if needed.

Write-path migration remains blocked after Task 4.28. The next recommended task is `Task 4.29 DataHealth Dismiss Prototype Acceptance V1`.

## DataHealth Dismiss Prototype Acceptance

Owner files:

- `docs/DATAHEALTH_DISMISS_PROTOTYPE_ACCEPTANCE.md`
- `tests/devApiDataHealthDismissAcceptanceFlagMatrix.test.ts`
- `tests/devApiDataHealthDismissAcceptanceInteraction.test.ts`
- `tests/devApiDataHealthDismissAcceptanceFailures.test.ts`
- `tests/devApiDataHealthDismissAcceptanceSourceOfTruth.test.ts`
- `tests/devApiDataHealthDismissAcceptanceBoundary.test.ts`
- `tests/devApiDataHealthDismissManualAcceptanceDocs.test.ts`

Task 4.29 is acceptance coverage for the Task 4.28 prototype. It does not add a new route, broaden the mutation client, switch source of truth, replace localStorage, add an offline queue, or add production backend/auth/sync/deployment behavior.

Acceptance facts:

- The flag matrix keeps the prototype disabled unless DEV, read-only comparison, and `VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT="datahealth-dismiss"` are all active.
- Confirmation is required before any POST.
- Pending state disables duplicate submit and does not show optimistic success.
- Success requires HTTP success, mutation success, `changed=true`, `status="success"`, and snapshot metadata.
- API unavailable, timeout, malformed response, server errors, no-change, issue-not-found, write failure, transaction failure, database closed, unsupported route, and missing snapshot metadata do not show success.
- localStorage remains the active App source of truth.
- API results never overwrite AppData or localStorage.
- The only accepted browser mutation route is `POST /data-health/issues/:issueId/dismiss`.
- Session mutation, history edit/data-flag, DataHealth repair, backup/import/export, reset, and recovery routes remain blocked from browser code.

Write-path migration remains blocked after Task 4.29. The next recommended task is `Task 4.30 DataHealth Dismiss Manual App Acceptance V1`.

## DataHealth Dismiss Manual App Acceptance

Owner files:

- `docs/DATAHEALTH_DISMISS_MANUAL_APP_ACCEPTANCE.md`
- `tests/dataHealthDismissManualAppAcceptanceDocs.test.ts`
- `tests/dataHealthDismissManualAppAcceptanceDocsParity.test.ts`
- `tests/dataHealthDismissManualAppAcceptanceBoundary.test.ts`

Task 4.30 is a manual App acceptance layer for the Task 4.28/4.29 DataHealth dismiss prototype. It does not add runtime behavior, mutation capability, routes, source-of-truth switching, localStorage replacement, production backend, auth, sync, deployment, package changes, lockfile changes, or normalized tables.

Manual acceptance facts:

- A dedicated test browser profile is required.
- Real personal training data must not be used.
- The manual flow uses `npm run api:dev`, `npm run dev`, browser DevTools Network, and explicit env flags.
- The flag matrix confirms compare-only and mutation-only states do not enable the prototype.
- Confirmation is required before the single accepted POST.
- Pending state must prevent duplicate POSTs and must not show optimistic success.
- Success is accepted only after HTTP 2xx, mutation success, `changed=true`, `status="success"`, and snapshot metadata.
- Failure states must not show success, auto-retry, write localStorage, or replace AppData.
- Browser Network must show only read-only GET routes plus `POST /data-health/issues/:issueId/dismiss` after confirmation.
- Session mutation, history edit/data-flag, DataHealth repair, backup/import/export, reset, and recovery routes remain blocked from browser code.
- API results never overwrite AppData or localStorage.

Write-path migration remains blocked after Task 4.30. The next recommended task is `Task 4.31 DataHealth Dismiss Prototype Hardening V1`.

## DataHealth Dismiss Prototype Hardening

Owner files:

- `src/devApi/DevApiDataHealthDismissPrototype.tsx`
- `src/devApi/devApiDataHealthDismissClient.ts`
- `tests/devApiDataHealthDismissHardeningNoFakeSuccess.test.ts`
- `tests/devApiDataHealthDismissHardeningFailureStates.test.ts`
- `tests/devApiDataHealthDismissHardeningConcurrency.test.tsx`
- `tests/devApiDataHealthDismissHardeningConfirmation.test.tsx`
- `tests/devApiDataHealthDismissHardeningBoundary.test.ts`
- `tests/devApiDataHealthDismissHardeningDocsParity.test.ts`

Task 4.31 hardens the existing Task 4.28 prototype. It does not add runtime route capability, a broad mutation client, source-of-truth switching, localStorage replacement, an offline queue, production backend, auth, sync, deployment, package changes, lockfile changes, or normalized tables.

Hardening facts:

- The only browser mutation route remains `POST /data-health/issues/:issueId/dismiss`.
- Success requires HTTP success, `result.ok === true`, `result.changed === true`, `result.status === "success"`, and snapshot metadata.
- Missing snapshot metadata is failure.
- `no_change`, already-dismissed, `issue_not_found`, `requiresConfirmation`, `unsupported_route`, `write_failed`, `transaction_failed`, `database_closed`, `snapshot_validation_failed`, and `repository_schema_mismatch` do not show success.
- Timeout, unavailable, abort, malformed response, and server error responses do not show success and do not expose raw stack text.
- Duplicate submit is guarded while pending, and retry after failure requires explicit confirmation.
- API results never overwrite AppData or localStorage.
- Session mutation, history edit/data-flag, DataHealth repair, backup/import/export, reset, and recovery routes remain blocked from browser code.

Write-path migration remains blocked after Task 4.31. The next recommended task is `Task 4.32 DataHealth Dismiss Recovery/Observability V1`.

## DataHealth Dismiss Prototype Observability & Recovery Notes

Owner files:

- `src/devApi/DevApiDataHealthDismissPrototype.tsx`
- `src/devApi/devApiDataHealthDismissClient.ts`
- `tests/devApiDataHealthDismissObservabilitySummary.test.ts`
- `tests/devApiDataHealthDismissObservabilityFailureMapping.test.ts`
- `tests/devApiDataHealthDismissRecoveryNotes.test.ts`
- `tests/devApiDataHealthDismissObservabilityBoundary.test.ts`
- `tests/devApiDataHealthDismissObservabilityDocsParity.test.ts`

Task 4.32 adds observability and recovery notes for the existing Task 4.28 prototype. It is dev-only diagnostics and manual recovery guidance, not new mutation capability.

Observability facts:

- The only browser mutation route remains `POST /data-health/issues/:issueId/dismiss`.
- Safe diagnostics may show issue id, mutation state, last HTTP status, failure code, short safe failure message, snapshot metadata presence, request timing, and duplicate-submit blocked state.
- Diagnostics must not show raw stack traces, raw API responses, full AppData, localStorage contents, SQLite internal objects, environment objects, or non-localhost URLs beyond the configured safe base URL.
- Failure guidance covers unavailable Dev API, timeout, invalid response, `issue_not_found`, `no_change`, `requiresConfirmation`, `write_failed`, `transaction_failed`, `database_closed`, `snapshot_validation_failed`, `repository_schema_mismatch`, `unsupported_route`, missing snapshot metadata, and abort/unmount.
- Recovery guidance is manual and dev-only. It may point to the existing Node-only recovery/reset runbook, but it adds no HTTP reset endpoint and no browser recovery/reset action.
- Success still requires HTTP success, `result.ok === true`, `result.changed === true`, `result.status === "success"`, and snapshot metadata.
- API results never overwrite AppData or localStorage, and localStorage remains the App source of truth.
- Session mutation, history edit/data-flag, DataHealth repair, backup/import/export, reset, and recovery routes remain blocked from browser code.

Write-path migration remains blocked after Task 4.32. The next recommended task is `Task 4.33 DataHealth Dismiss Regression Lock V1`.

## DataHealth Dismiss Regression Lock

Owner files:

- `tests/dataHealthDismissRegressionRouteLock.test.ts`
- `tests/dataHealthDismissRegressionSuccessContract.test.ts`
- `tests/dataHealthDismissRegressionFailureMapping.test.ts`
- `tests/dataHealthDismissRegressionUxControls.test.ts`
- `tests/dataHealthDismissRegressionObservabilityDocs.test.ts`
- `tests/dataHealthDismissRegressionBoundary.test.ts`

Task 4.33 locks the DataHealth dismiss prototype line as a regression/testing layer. It does not add runtime features, new mutation routes, a second mutation prototype, source-of-truth switching, AppData/localStorage overwrite behavior, production backend, auth, sync, deployment, package changes, lockfile changes, or normalized tables.

Regression lock facts:

- The only accepted browser mutation route is `POST /data-health/issues/:issueId/dismiss`.
- No session, history edit/data-flag, DataHealth repair, backup/import/export, reset, or recovery mutation route is accepted from browser code.
- No broad frontend mutation client may exist.
- Success requires HTTP success, `result.ok === true`, `result.changed === true`, `result.status === "success"`, and snapshot metadata.
- Missing snapshot metadata, no-change, issue-not-found, requires-confirmation, unsupported-route, unavailable, timeout, abort, malformed response, write failure, transaction failure, and database-closed cases must not show success.
- API results never overwrite AppData or localStorage.
- localStorage remains source of truth.
- Observability must not expose raw stack traces, raw API responses, full AppData, localStorage dumps, SQLite internals, or environment objects.
- Recovery guidance remains manual and dev-only.
- This lock does not imply production readiness, authorizes no second mutation route, and does not authorize any second mutation prototype.

Write-path migration remains blocked after Task 4.33. The next recommended task is `Task 4.34 Second Mutation Candidate Readiness Audit V1`.

## Second Mutation Candidate Readiness Audit

Owner files:

- `docs/SECOND_MUTATION_CANDIDATE_READINESS_AUDIT.md`
- `tests/secondMutationCandidateReadinessAudit.test.ts`
- `tests/secondMutationCandidateBoundaryStillBlocked.test.ts`

Task 4.34 audits the second possible mutation candidate after the DataHealth dismiss prototype line was implemented, accepted, hardened, observed, and regression-locked. It is an audit and decision record only.

Audit facts:

- The only implemented browser mutation route remains `POST /data-health/issues/:issueId/dismiss`.
- No second mutation is implemented.
- `POST /history/:id/data-flag` is identified as the second future candidate only.
- Task 4.34 does not approve direct implementation or App POST wiring for `POST /history/:id/data-flag`.
- History data-flag is medium risk because `normal`, `test`, and `excluded` affect default analytics inclusion, readMirror counts, history/calendar display, and PR/e1RM/effectiveSet eligibility.
- History edit, session mutations, DataHealth repair, backup/import/export over HTTP, reset/recovery over HTTP, and source-of-truth migration remain rejected or blocked.
- localStorage remains source of truth.
- API results never overwrite AppData or localStorage.
- There is no frontend mutation client, broad mutation client, source-of-truth switch, offline mutation queue, production backend, auth, sync, deployment, package dependency, package script, lockfile change, or normalized table.

Write-path migration remains blocked after Task 4.34. The next recommended task is `Task 4.35 History Data-flag Mutation Prototype Plan V1`, and it should be planning-only unless explicitly approved otherwise.

## Local Persistence

Owner files:

- `src/storage/persistence.ts`
- `src/storage/backup.ts`
- `src/models/training-model.ts`
- `src/models/training-data.schema.json`
- `src/models/training-program.schema.json`
- `src/data/appConfig.ts`

Primary runtime model:

- `AppData`

Primary persisted fields:

- `schemaVersion`
- `templates`
- `history`
- `bodyWeights`
- `activeSession`
- `selectedTemplateId`
- `trainingMode`
- `unitSettings`
- `todayStatus`
- `userProfile`
- `screeningProfile`
- `programTemplate`
- `mesocyclePlan`
- `programAdjustmentDrafts`
- `programAdjustmentHistory`
- `activeProgramTemplateId`
- `healthMetricSamples`
- `importedWorkoutSamples`
- `healthImportBatches`
- `settings`

Persistence behavior:

- `loadData()` reads split localStorage keys when present.
- Legacy monolithic storage is migrated and sanitized.
- `saveData(data)` sanitizes before writing.
- App data is validated with `training-data.schema.json`.
- Program template data is validated with `training-program.schema.json`.

## Backup Import/Export Contract

Owner file:

- `src/storage/backup.ts`

Export:

- Function: `exportAppData(data: AppData)`
- Output: JSON string of sanitized `AppData`.
- Filename helper: `ironpath-backup-YYYY-MM-DD.json`.

Import:

- Function: `importAppData(jsonText: string)`
- Input: JSON text chosen by the user.
- Output:
  - `{ ok: true, data: AppData }`
  - `{ ok: false, error: string }`
- Import must sanitize and validate before replacing current data.
- Restore must be gated by confirmation in UI because it overwrites current local data.

## Health Data Import Contract

Owner files:

- `src/features/HealthDataPanel.tsx`
- `src/engines/healthImportEngine.ts`
- `src/engines/appleHealthXmlImportEngine.ts`
- `src/engines/healthSummaryEngine.ts`
- `src/storage/persistence.ts`

Current input sources:

- Manual `.csv`
- Manual `.json`
- Manual Apple Health `export.xml`

Supported sample types:

- `sleep_duration`
- `resting_heart_rate`
- `hrv`
- `heart_rate`
- `steps`
- `active_energy`
- `exercise_minutes`
- `body_weight`
- `body_fat`
- `vo2max`
- `workout`

Boundary:

- Web/PWA cannot read HealthKit directly.
- Imported Apple Watch workouts remain external activities.
- External workouts do not become IronPath strength `TrainingSession` records.
- Health data supports readiness, recovery context, activity load explanation, and calendar background only.
- Health data is not a medical diagnostic source.

## Program Adjustment Contract

Owner files:

- `src/engines/programAdjustmentEngine.ts`
- `src/engines/adjustmentReviewEngine.ts`
- `src/engines/weeklyCoachActionEngine.ts`
- `src/engines/explainability/adjustmentExplainability.ts`
- `src/models/training-model.ts`

Key fields:

- `ProgramAdjustmentDraft.id`
- `createdAt`
- `status`
- `sourceProgramTemplateId`
- `experimentalProgramTemplateId`
- `sourceTemplateSnapshotHash`
- `sourceTemplateUpdatedAt`
- `title`
- `summary`
- `selectedRecommendationIds`
- `changes`
- `confidence`
- `notes`
- `ProgramAdjustmentHistoryItem.rollbackAvailable`
- `rolledBackAt`
- `sourceProgramSnapshot`
- `effectReview`

Workflow contract:

1. Generate recommendations and explain reason/impact.
2. Create a draft.
3. Preview before/after diff.
4. Confirm.
5. Apply by copying into an experimental template.
6. Preserve the source template.
7. Allow rollback by switching the active template back.
8. Do not delete completed workout history during rollback.

## Future Backend Rules

If a backend is introduced later:

- Add endpoint names, methods, request fields, response fields, error states, auth requirements, and migration plan here before implementation.
- Keep local-first fallback behavior explicit.
- Do not replace backup/export until cloud sync has a tested recovery path.
- Do not add secrets to `.env.example`; document variable names only.
