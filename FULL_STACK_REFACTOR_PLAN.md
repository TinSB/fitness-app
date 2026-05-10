# Full-Stack Refactor Plan

## Current Architecture Issues

IronPath is still a pure frontend PWA. `App.tsx` owns most runtime mutation, `src/storage/persistence.ts` owns localStorage, schema validation, migration, sanitize, and backup boundaries, and `src/models/training-model.ts` is the source of truth for app-wide data types.

This makes the app easy to run locally, but it also means future backend work can break Today recommendations, Focus session writes, Record summaries, backup import/export, and DataHealth repairs if contracts are not established first.

## Target Architecture

The intended long-term structure is:

```text
apps/
  web/          React + Vite frontend
  api/          Node.js + Fastify backend
packages/
  contracts/    shared TypeScript types and schema references
  core/         pure training engines and shared business logic
  db/           SQLite schema, migrations, and repository layer
```

## Core Parity & Contracts Baseline

This baseline adds the first shared package entrypoints without changing runtime behavior.

`packages/contracts/src/index.ts` re-exports shared contracts from the existing source of truth:

- `AppData`
- `TrainingSession`
- `TrainingExercise`
- `TrainingSet`
- `ProgramTemplate`
- `SessionEditHistoryEntry`
- `ProgramAdjustmentDraft`
- `PendingSessionPatch`
- `DataHealthIssue`
- `DataHealthReport`
- `FocusActionResult`
- `FocusActionReasonCode`
- `SessionMutationRequest`
- `SessionMutationResult`
- `SessionMutationResponse`
- `SessionMutationReasonCode`
- `RecordDataHealthMutationRequest`
- `RecordDataHealthMutationResult`
- `RecordDataHealthMutationResponse`
- `RecordDataHealthMutationReasonCode`
- `APP_DATA_SCHEMA_VERSION`
- `appDataJsonSchema`

`packages/core/src/index.ts` re-exports stable pure engine functions from `src/engines`:

- e1RM and effective-set helpers
- session summary and effective-set explanation helpers
- unit conversion
- replacement engines
- PPL cycle and next-workout schedulers
- session history and calendar helpers
- session edit helpers
- rest timer helpers
- current exercise selector
- set anomaly detection
- pure analytics builders, excluding browser-only download behavior

## Persistence Boundary Split

Task 4.2 split the original `src/storage/persistence.ts` responsibilities while keeping it as the only compatibility facade for existing callers.

Original `persistence.ts` responsibilities were:

- AppData localStorage split-key and legacy monolith read/write
- default AppData creation
- schema version migration
- AppData sanitize and legacy compatibility
- schema validation
- support library validation
- health integration settings sanitize
- repair log sanitize
- backup import/export safety dependencies

The storage boundary is now organized as:

- `src/storage/appDataStorageUtils.ts`: pure low-level data helpers and normalization helpers.
- `src/storage/appDataValidation.ts`: Ajv setup and existing JSON schema validators.
- `src/storage/appDataMigration.ts`: pure schemaVersion and legacy raw-data migration.
- `src/storage/appDataSanitize.ts`: pure AppData sanitize/default/support-library validation boundary.
- `src/storage/localStorageAdapter.ts`: AppData localStorage read/write adapter and the only direct AppData storage I/O layer.
- `src/storage/persistence.ts`: compatibility facade that preserves existing `loadData`, `saveData`, `sanitizeData`, validators, and migration exports.

The split does not change runtime ownership:

- `App.tsx` still calls the same persistence facade.
- `saveData` still sanitizes before writing split storage keys.
- `loadData` still reads split keys first and falls back to legacy monolith storage.
- `backup.ts` still rejects unsafe imports before sanitizing.
- `packages/contracts` still re-exports the existing schema reference instead of creating a second schema.

Pure migration, sanitize, and validation boundaries are now candidates for future `packages/core` or API reuse. The localStorage adapter remains web/runtime-specific and should not move to backend code.

## API Skeleton Read Mirror

Task 4.3 adds `apps/api/src/readMirror.ts` as a read-only API skeleton for future backend extraction. It is a pure handler layer that accepts an `AppData` object, derives responses through existing contracts/core/storage helpers, and returns mirror data. It does not start a server, connect to SQLite, read localStorage, write AppData, or change the frontend runtime path.

Current read-only routes are:

- `GET /health`: service name, read-only mode, schema version, and route registry.
- `GET /app-data/summary`: AppData counts, selected template/program ids, unit settings, pending patch count, dismissed issue counts, and repair log count.
- `GET /sessions/summary`: active session mirror, history counts, analytics-included count, dataFlag counts, and latest session summary.
- `GET /history`: Record history list mirror using `getSessionCalendarDate` and `buildSessionDetailSummary`.
- `GET /history/:id`: one history session plus calendar date and detail summary.
- `GET /data-health/summary`: DataHealth report status, summary, issue count, and existing issue payload.

Boundary guarantees:

- Only `GET` routes are declared.
- Non-`GET` requests return `405` and do not mutate input data.
- Responses are derived from sanitized `AppData`, `packages/contracts`, and `packages/core` parity exports.
- Backup import/export behavior remains owned by the existing storage layer and is unchanged.
- `App.tsx`, `saveData`, `loadData`, Focus Mode, scheduler, PR/e1RM, effective-set, and template behavior are unchanged.

## Session Mutation API Baseline

Task 4.4 adds `apps/api/src/sessionMutation.ts` as the first pure write-boundary baseline. It accepts `AppData + SessionMutationRequest` and returns `SessionMutationResponse`, but it does not save data, start a server, connect to SQLite, or change frontend runtime ownership.

Current session mutation routes are:

- `POST /sessions/start`: starts an active session from the requested or selected template and consumes a matching pending session patch only after successful start.
- `POST /sessions/active/patches`: applies session-level patches to the current active session.
- `POST /sessions/active/complete`: completes the active session into history after the same incomplete-main-work confirmation boundary used by the app.
- `POST /sessions/active/discard`: discards the unsaved active session after confirmation and never writes history.

Boundary guarantees:

- Input `AppData` is deep-cloned before mutation logic runs.
- `nextData` is returned only when `result.ok === true && result.changed === true`.
- Invalid, no-op, conflict, confirmation-required, and unsupported routes never return `nextData`.
- The handler composes existing session engines instead of changing training algorithms.
- `App.tsx`, localStorage, backup import/export, Focus step mutation, record edit, DataHealth repair, scheduler, PR/e1RM, effective-set, and templates are unchanged.

## Record & DataHealth Mutation API Baseline

Task 4.5 adds `apps/api/src/recordDataHealthMutation.ts` as the next pure write-boundary baseline. It accepts `AppData + RecordDataHealthMutationRequest` and returns `RecordDataHealthMutationResponse`, but it does not save data, start a server, connect to SQLite, or change frontend runtime ownership.

Current Record/DataHealth mutation routes are:

- `POST /history/:id/edit`: wraps existing set edit, validation, and editHistory audit helpers for a history session.
- `POST /history/:id/data-flag`: wraps existing `normal | test | excluded` dataFlag behavior and audit trail.
- `POST /data-health/issues/:issueId/dismiss`: dismisses an existing DataHealth issue for today without changing training records.
- `POST /data-health/repair/apply`: applies only the whitelisted `legacy_display_weight` repair after confirmation.

Boundary guarantees:

- Input `AppData` is deep-cloned before mutation logic runs.
- `nextData` is returned only when `result.ok === true && result.changed === true`.
- Invalid, no-op, not-found, confirmation-required, unsafe, and unsupported routes never return `nextData`.
- Record summaries, calendar rows, and DataHealth reports remain derived from existing engines.
- Legacy display weight repair keeps every `actualWeightKg` unchanged and stores summary-only repair logs.
- `App.tsx`, localStorage, backup import/export, Focus mutation, scheduler, PR/e1RM, effective-set, templates, UI, server runtime, and SQLite are unchanged.

## SQLite Repository & Backup Round Trip

Task 4.6 adds `apps/api/src/sqliteRepository.ts` and `apps/api/src/node/index.ts` as a Node-only SQLite snapshot repository for parity testing. It proves that sanitized AppData can be written to SQLite and read back without changing current frontend runtime storage.

The SQLite schema is intentionally conservative:

- `app_meta`: key/value repository metadata.
- `app_data_snapshots`: complete AppData JSON snapshots with an autoincrement `row_id` for stable latest-snapshot ordering.

Boundary guarantees:

- The repository uses Node built-in `node:sqlite` / `DatabaseSync`; no ORM, framework, or npm SQLite dependency is added.
- SQLite is not statically exported from the shared API index and is not part of the browser bundle.
- `writeSnapshot` and `importBackupToSnapshot` use transactions so metadata and snapshots succeed or fail together.
- Backup import uses existing parse/analyze/import/repair boundaries; unsafe data is rejected before writing.
- readMirror, sessionMutation, and recordDataHealthMutation remain AppData-only boundaries and do not import SQLite.
- `App.tsx`, UI, localStorage, `loadData`, `saveData`, server runtime, auth, sync, scheduler, training algorithms, PR/e1RM, effective-set, and templates are unchanged.
- No normalized session, set, exercise, analytics, or DataHealth tables are introduced.

Task 4.7 hardens this repository without changing its runtime boundary:

- Stable repository error codes cover unavailable Node SQLite, missing snapshots, corrupt JSON, validation failure, schema mismatch, write/import failures, transaction failure, and closed database access.
- `readSnapshot()` still selects latest by `ORDER BY row_id DESC LIMIT 1`; `latest_snapshot_id` is maintained only as non-authoritative metadata.
- Failed writes/imports must not leave partial rows or point `latest_snapshot_id` at failed/missing data.
- File-backed SQLite can be closed and reopened for parity tests.
- SQLite remains snapshot-only and Node-only; there is still no App runtime storage migration, UI/server/localStorage replacement, normalized database, auth, or sync.

Task 4.8 adds a Node-only server adapter skeleton without starting a server:

- `apps/api/src/node/serverAdapter.ts` composes repository + readMirror + sessionMutation + recordDataHealthMutation.
- `GET /health` works without an existing AppData snapshot.
- Non-health GET routes read the latest snapshot and delegate to readMirror.
- Mutation routes write a new snapshot only when the underlying mutation response contains `nextData`.
- Failed persistence after `nextData` returns a repository error response; it is not treated as a successful mutation.
- Route resolution distinguishes wrong method (`405`) from unknown path (`404`).
- The adapter remains outside `apps/api/src/index.ts` and browser builds.
- There is still no runtime server, App.tsx integration, UI integration, localStorage replacement, auth, sync, or normalized database.

Task 4.9 adds a Node-only HTTP smoke wrapper around the server adapter:

- `apps/api/src/node/httpRuntimeAdapter.ts` converts Node `http` requests into `ServerAdapterRequest`.
- It parses method, path, query string, and JSON body, then writes stable JSON responses.
- It does not implement business routes and does not call readMirror, mutation handlers, or SQLite directly.
- It does not auto-listen or provide a production server.
- It has parsing contracts for malformed JSON, body too large, and unsupported media types.
- It remains outside browser-facing exports and does not affect `App.tsx`, UI, localStorage, auth, sync, deployment, or normalized database work.

## Not Done In This Baseline

This baseline intentionally does not:

- add an API runtime or server
- add Fastify
- add SQLite
- change `App.tsx` mutation logic
- change `persistence.ts` facade behavior or localStorage semantics
- move source engine files
- change `AppData` schema semantics
- change training templates
- change e1RM, PR, effective-set, readiness, progression, or warmup policy logic
- change UI behavior

## Follow-Up Tasks

### Task 4.2: Persistence Boundary Split V1

Completed: `src/storage/persistence.ts` was split into clearer layers while preserving behavior:

- schema references and validation
- migration and sanitize
- localStorage adapter
- backup import/export boundary

The split is protected by persistence boundary, facade compatibility, localStorage adapter, backup import boundary, and AppData sanitize parity tests.

### Task 4.3: API Skeleton Read Mirror V1

Completed: `apps/api/src/readMirror.ts` provides pure read-only handlers and `apps/api/src/index.ts` exports them for tests and future API wiring.

Implemented read mirror endpoints:

- `GET /health`
- `GET /app-data/summary`
- `GET /sessions/summary`
- `GET /history`
- `GET /history/:id`
- `GET /data-health/summary`

The frontend does not switch runtime data flow in this step. The skeleton proves parity against current fixtures and source engines without adding backend writes.

Task 4.3 prerequisites:

- keep `persistence.ts` as the web facade until API read mirror parity is proven
- use `appDataSanitize` / `appDataMigration` / `appDataValidation` as backend-reusable candidates
- do not import `localStorageAdapter` from backend code
- prove read endpoint outputs match current `enginePipeline`, Record, Plan, and DataHealth fixtures before changing frontend runtime data flow

### Task 4.4: Session Mutation API V1

Completed as a pure parity baseline, not a runtime migration:

- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

This task preserves frontend runtime behavior by leaving `App.tsx` and UI handlers untouched. Focus step-level backend mutation, replacement mutation, record edit, DataHealth repair, backup import/export mutation, auth, cloud sync, and SQLite remain out of scope.

### Task 4.5: Record & DataHealth Mutation API V1

Completed as a pure parity baseline, not a runtime migration:

- `POST /history/:id/edit`
- `POST /history/:id/data-flag`
- `POST /data-health/issues/:issueId/dismiss`
- `POST /data-health/repair/apply`

This task preserves frontend runtime behavior by leaving `App.tsx`, UI handlers, persistence, and localStorage untouched. Backup import/export mutation, arbitrary record patching, Focus step mutation, replacement mutation, scheduler mutation, auth, cloud sync, server runtime, and SQLite remain out of scope.

### Task 4.6: SQLite Repository & Backup Round Trip V1

Completed as a Node-only repository parity baseline, not a runtime migration:

- SQLite snapshot schema for complete AppData JSON.
- AppData write/read round-trip.
- Backup import/export round-trip through existing safety boundaries.
- readMirror parity after SQLite round-trip.
- sessionMutation and recordDataHealthMutation compatibility after SQLite round-trip.

This task preserves frontend runtime behavior by leaving `App.tsx`, UI handlers, persistence, localStorage, and API/mutation handler inputs untouched.

### Task 4.7: Repository Hardening & Failure Mode V1

Completed as repository hardening only, not a server adapter:

- stable `SqliteRepositoryError.code` contract
- schema version guard in `app_meta`
- strict corrupt snapshot and validation failure handling
- transaction rollback and `latest_snapshot_id` consistency checks
- file-backed close/reopen behavior
- Node-only isolation tests

This task still does not connect SQLite to `App.tsx`, UI, localStorage, server runtime, readMirror, sessionMutation, or recordDataHealthMutation. It does not add normalized tables.

### Task 4.8: Server Adapter Skeleton V1

Completed as a Node-only adapter skeleton, not an HTTP runtime:

- route-like request dispatcher
- readMirror delegation for GET routes
- sessionMutation and recordDataHealthMutation delegation for write routes
- SQLite snapshot write-through only when `nextData` exists
- repository error mapping with stable error codes
- Node-only isolation from browser-facing API exports

This task does not start Fastify/Express, does not connect to `App.tsx`, does not replace localStorage, does not add auth/cloud sync, and does not add normalized tables.

### Task 4.9: HTTP Runtime Adapter Smoke Test V1

Completed as a smoke-test wrapper only, not a production backend:

- Node `http` request listener factory
- stable success/error JSON body contract
- request parsing for JSON POST bodies
- route forwarding to serverAdapter
- HTTP-level smoke tests through an ephemeral port
- Node-only isolation from browser-facing API exports

This task still does not connect `App.tsx` or UI to HTTP, does not replace localStorage, does not add Fastify/Express, auth, cloud sync, deployment config, or normalized tables. A future task should harden runtime smoke or add a dev-only launch script before considering any frontend data-flow switch.

### Task 4.10: Runtime Boundary Acceptance & Regression Audit V1

Completed as an acceptance and regression audit layer over Task 4.0-4.9 boundaries, not as runtime migration:

- `runtimeBoundaryNodeOnlyIsolation.test.ts` locks production/browser source away from Node-only modules, `node:http`, and `node:sqlite`.
- `runtimeBoundaryPersistenceCompatibility.test.ts` confirms `persistence.ts` remains the facade, pure storage modules stay browser-global-free, and AppData localStorage access remains isolated to `localStorageAdapter`.
- `runtimeBoundaryMutationContract.test.ts` confirms readMirror remains read-only and mutation boundaries return `nextData` only on `ok=true && changed=true`.
- `runtimeBoundaryRepositoryContract.test.ts` confirms SQLite stays Node-only, snapshot-only, row-id ordered, strict on corrupt data, rollback-safe, and stable after close.
- `runtimeBoundaryServerHttpContract.test.ts` confirms serverAdapter and httpRuntimeAdapter stay composition/parsing layers and do not auto-start a server.
- `runtimeBoundaryDataSemanticsRegression.test.ts` confirms real, legacy, migrated, and repair fixture semantics survive boundary round-trips.

Acceptance results are intentionally narrow:

- App runtime still uses localStorage through the existing persistence facade.
- `App.tsx`, UI, Focus Mode runtime, training algorithms, templates, scheduler, PR/e1RM, effective-set rules, backup semantics, and AppData schema meaning are unchanged.
- Browser builds must not import `node:http`, `node:sqlite`, SQLite repository, server adapter, or HTTP runtime adapter.
- SQLite remains a Node-only AppData snapshot repository for parity and smoke tests, not the production store.
- The HTTP wrapper remains a smoke-test entry, not a production backend or deployment target.

Recommended next step is `Task 4.11 Dev-only Local API Launcher V1` or `Task 4.11 Runtime Smoke Hardening V1`. Do not switch `App.tsx` to HTTP/SQLite until a dev-only launcher, recovery story, and acceptance tests are stable.

### Task 4.11: Dev-only Local API Launcher V1

Completed as a local development launcher only, not a production backend or App runtime migration:

- `apps/api/src/node/devLauncher.ts` creates an explicit local launcher for `node:http -> httpRuntimeAdapter -> serverAdapter -> sqliteRepository`.
- Importing or creating the launcher has no side effects; `start()` is required to listen.
- Default bind is `127.0.0.1`; LAN exposure requires `allowNetworkAccess=true`.
- Default DB path is `.ironpath/dev-api.sqlite`, and `.gitignore` excludes local SQLite dev files.
- `seedEmpty=false` preserves `snapshot_not_found` behavior for data routes; `seedEmpty=true` creates one empty snapshot only when no latest snapshot exists.
- Repeated `start()` returns the existing running URL/host/port instead of creating duplicate servers or repositories.
- Startup failure cleans up opened HTTP/SQLite resources before returning a stable launcher error.
- `close()` shuts down HTTP and SQLite resources and is idempotent.

This task still does not connect `App.tsx`, UI, localStorage, auth, cloud sync, deployment, or production server runtime. It does not add package dependencies, a TypeScript runtime runner, a package script, backup import/export endpoints, or normalized database tables.

Recommended next step is `Task 4.12 Dev Runtime Smoke Hardening V1` or `Task 4.12 Manual API Acceptance Checklist V1`. Do not migrate `App.tsx` to HTTP/SQLite until local launcher behavior and recovery expectations are stable.

### Task 4.12: Manual API Acceptance Checklist V1

Completed as a manual acceptance checklist and documentation consistency gate, not as a runtime feature:

- `docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md` gives developers a checkbox-based procedure for validating the dev-only local API stack.
- The checklist covers launcher lifecycle, health behavior, seed-empty behavior, read routes, mutation routes, HTTP parsing, localhost safety, DB file safety, browser build safety, and data semantics.
- `manualApiAcceptanceChecklist.test.ts` keeps the checklist aligned with the current boundary contract and rejects misleading action instructions such as dependency installation, App runtime switching, localStorage replacement, production deployment, or connecting UI to the API.

This task still does not connect `App.tsx`, UI, localStorage, auth, cloud sync, deployment, or production server runtime. It does not add package dependencies, package scripts, backup import/export endpoints, or normalized database tables.

Recommended next step is `Task 4.13 Dev Runtime Smoke Hardening V1` or `Task 4.13 Local API Runner Strategy V1`. Do not migrate `App.tsx` to HTTP/SQLite until dev-only launcher behavior, manual acceptance, and recovery expectations are stable.

### Task 4.13: Dev Runtime Smoke Hardening V1

Completed as automated smoke hardening for the dev-only local API stack, not as a runtime feature:

- `devRuntimeSmokeLifecycle.test.ts` verifies explicit start, repeated start reuse, JSON health response, idempotent close, and short-timeout post-close failure handling.
- `devRuntimeSmokeSeedAndRead.test.ts` verifies `seedEmpty=false`, `seedEmpty=true`, seed labeling, GET read routes, no snapshot writes for reads, and file-backed close/reopen behavior.
- `devRuntimeSmokeMutationPersistence.test.ts` verifies real HTTP mutation persistence using pre-seeded valid AppData with a startable template.
- `devRuntimeSmokeFailureNoWrite.test.ts` verifies parsing, routing, no-op, invalid, requires-confirmation, and unsafe import-like failures do not write snapshots.
- `devRuntimeSmokeLocalhostSafety.test.ts`, `devRuntimeSmokeBrowserIsolation.test.ts`, and `devRuntimeSmokeManualChecklistParity.test.ts` lock localhost safety, browser isolation, and checklist/runtime parity.

This task still does not connect `App.tsx`, UI, localStorage, auth, cloud sync, deployment, or production server runtime. It does not add package dependencies, package scripts, backup import/export endpoints, or normalized database tables.

Recommended next step is `Task 4.14 Local API Runner Strategy V1` or `Task 4.14 Dev API Manual Run Script V1`. Do not migrate `App.tsx` to HTTP/SQLite until dev-only launcher behavior, automated smoke, manual acceptance, and recovery expectations are stable.

### Task 4.14: Local API Runner Strategy V1

Completed as a runner strategy and decision record, not as a runner implementation:

- `docs/LOCAL_API_RUNNER_STRATEGY.md` evaluates no-runner, compiled JavaScript runner, TypeScript runtime runner, Node loader, and manual test harness options.
- The unique short-term recommendation is Option A: no runner yet, keep `createDevLocalApiLauncher(options)` as the programmatic launcher only.
- `localApiRunnerStrategy.test.ts` verifies the strategy document, no-script/no-dependency boundary, package script absence, and alignment with API contract and the manual checklist.

This task still does not add a package script, package dependency, runner implementation, `App.tsx` integration, UI integration, localStorage replacement, production server behavior, auth, sync, deployment, backup import/export endpoints, or normalized database tables.

Recommended next step is `Task 4.15 Dev API Runner Prototype V1`. Do not migrate `App.tsx` to HTTP/SQLite until a runner prototype, recovery expectations, and manual acceptance remain stable.

### Task 4.15: Dev API Runner Prototype V1

Completed with Result A: compiled JavaScript runner prototype.

- `apps/api/src/node/devApiRunner.ts` provides a Node-only ESM runner entry guarded so imports do not auto-listen.
- `api:dev:build` compiles the runner through Vite SSR into `.ironpath/dev-api-runner`.
- `api:dev` runs the compiled runner and forwards `npm run api:dev -- <args>`.
- The runner prints `IronPath dev API ready: <url>` after successful start.
- SIGINT and SIGTERM close the HTTP server and SQLite repository.
- Tests verify CLI parsing, output directory safety, ready-line startup, `--port 0 --seed-empty --db <temp-db>` passthrough, shutdown, package scripts, Node-only isolation, and build audit documentation.

This task still does not connect `App.tsx`, UI, localStorage, auth, cloud sync, deployment, or production server runtime. It does not add package dependencies, lockfile changes, backup import/export endpoints, or normalized database tables.

Recommended next step is `Task 4.16 Dev API Runner Manual Acceptance V1`. Do not migrate `App.tsx` to HTTP/SQLite until runner manual acceptance, recovery expectations, and data migration boundaries are stable.

### Task 4.16: Dev API Runner Manual Acceptance V1

Completed as a manual runbook and consistency gate for the compiled JavaScript dev API runner, not as a runtime feature.

- `docs/DEV_API_RUNNER_MANUAL_ACCEPTANCE.md` documents copyable commands, expected output, pass/fail checks, and runner boundaries.
- The runbook covers `api:dev:build`, `api:dev`, deterministic ready-line parsing, health/read routes, conditional mutation smoke, failure smoke, shutdown, localhost safety, DB file safety, and browser safety.
- Tests verify the runbook contents, run the real npm runner through a temporary DB and port 0, and keep package/browser boundaries locked.
- `seedEmpty` remains read-smoke only; successful mutation smoke still requires a valid preseeded AppData snapshot with a startable template.

This task still does not connect `App.tsx`, UI, localStorage, auth, cloud sync, deployment, or production server runtime. It does not add package scripts beyond the existing Task 4.15 `api:dev` scripts, package dependencies, lockfile changes, backup import/export endpoints, or normalized database tables.

Recommended next step is `Task 4.17 Dev API Recovery & Reset Safety V1` or `Task 4.17 App Runtime Migration Readiness Audit V1`. Formal `App.tsx` HTTP migration remains blocked until runner acceptance, recovery/reset safety, data migration boundaries, and rollback expectations are stable.

### Task 4.17: Dev API Recovery & Reset Safety V1

Completed as Node-only local dev DB safety tooling, not as runtime migration or production recovery.

- `apps/api/src/node/devDbRecovery.ts` resolves, inspects, backs up, and reset-deletes only local dev `.sqlite` artifacts.
- Inspect does not create missing DB files and uses read-only access for existing DB files.
- Backup copies only existing main/WAL/SHM/journal artifacts and excludes runner output and unrelated files.
- Reset requires `RESET_DEV_API_DB`, defaults to backup-first, supports dry-run, enforces `.sqlite` suffix, and rejects symlink/path-escape artifacts.
- Reset never deletes directories, backup folders, `.ironpath/dev-api-runner`, glob matches, JSON files, source files, fixtures, or unrelated siblings.
- `docs/DEV_API_RECOVERY_RESET.md` documents the manual inspect/backup/reset checklist.
- Tests lock artifact resolution, inspect behavior, backup behavior, reset safety, runner compatibility, and Node-only isolation.

This task still does not connect `App.tsx`, UI, localStorage, auth, cloud sync, deployment, or production recovery runtime. It does not add HTTP reset endpoints, runner reset flags, package scripts, package dependencies, lockfile changes, backup import/export endpoints, or normalized database tables.

Recommended next step is `Task 4.18 App Runtime Migration Readiness Audit V1` or `Task 4.18 Dev API Read-only App Integration Plan V1`. Formal `App.tsx` HTTP migration remains blocked until recovery/reset safety, manual acceptance, migration boundaries, and rollback expectations are stable.

### Task 4.18: App Runtime Migration Readiness Audit V1

Completed as a readiness audit and decision record, not as App runtime migration.

- `docs/APP_RUNTIME_MIGRATION_READINESS_AUDIT.md` summarizes the current browser, pure boundary, and Node-only architecture.
- The audit records completed gates from Task 4.0-4.17, remaining blockers, risk analysis, required acceptance gates, rollback plan, and source-of-truth options.
- The short-term source-of-truth recommendation is Option C: dual-read comparison mode only.
- `appRuntimeMigrationReadinessAudit.test.ts` locks the audit content and rejects action-oriented migration instructions.
- `appRuntimeMigrationBoundaryStillBlocked.test.ts` confirms `App.tsx`, `src/**`, browser-facing API exports, package scripts, localStorageAdapter, frontend client paths, and feature-flag/runtime wiring remain blocked from Node-only API integration.

This task still does not connect `App.tsx`, UI, localStorage, auth, cloud sync, deployment, or production backend runtime. It does not add frontend API clients, feature flag wiring, package scripts, package dependencies, lockfile changes, backup import/export endpoints, or normalized database tables.

Recommended next step is `Task 4.19 Dev API Read-only App Integration Plan V1`. Do not migrate `App.tsx` to HTTP/SQLite after Task 4.18; write-path integration is later than read-only plan, read-only prototype, read-only runtime parity acceptance, and mutation integration readiness audit.

### Task 4.19: Dev API Read-only App Integration Plan V1

Completed as a read-only App integration plan and decision record, not as runtime integration.

- `docs/DEV_API_READONLY_APP_INTEGRATION_PLAN.md` defines dual-read comparison mode only as the recommended mode.
- localStorage remains the only active App source of truth.
- Dev API results are comparison/diagnostics only and must never overwrite localStorage.
- The future read-only candidate scope is App data summary, sessions summary, history list/detail, and DataHealth summary.
- The plan documents future API client strategy, feature flag strategy, source-of-truth rules, API-unavailable fallback, data comparison strategy, security/privacy boundaries, rollback, acceptance gates, and Task 4.20 constraints.
- `devApiReadonlyAppIntegrationPlan.test.ts` locks the plan text and rejects action-oriented migration instructions.
- `devApiReadonlyAppIntegrationBoundary.test.ts` confirms production/runtime source paths still have no frontend API client, feature flag runtime wiring, API-backed localStorage adapter, Node-only imports, or new migration scripts.

This task still does not connect `App.tsx`, UI, localStorage, auth, cloud sync, deployment, or production backend runtime. It does not add frontend API clients, React hooks/providers/context, feature flag runtime wiring, package scripts, package dependencies, lockfile changes, backup import/export endpoints, mutation routes from App, or normalized database tables.

Task 4.20 Read-only App Integration Prototype V1 is only the next recommended task if Task 4.19 acceptance passes. Task 4.20 must remain dev-only, explicit opt-in, and dual-read comparison only. Formal `App.tsx` HTTP migration and write-path migration remain blocked.

### Task 4.20: Read-only App Integration Prototype V1

Completed as a minimal dev-only read-only prototype, not as App runtime migration or write-path migration.

- `src/devApi/devApiReadOnlyConfig.ts` resolves the explicit opt-in config from env-like input and requires `DEV === true` plus `VITE_IRONPATH_DEV_API_COMPARE === "1"`.
- `src/devApi/devApiReadOnlyClient.ts` exposes only fixed GET read routes with timeout/cancellation and normalized diagnostic errors.
- `src/devApi/devApiReadOnlyComparison.ts` compares existing readMirror-derived local summaries with Dev API read results.
- `src/devApi/DevApiReadOnlyDiagnostics.tsx` renders a minimal dev-only diagnostic panel and no mutation controls.
- `src/App.tsx` only mounts the guarded diagnostics component and passes current in-memory AppData.
- localStorage remains the active App source of truth; API results never overwrite localStorage or AppData.
- API unavailable and mismatches are diagnostic only and do not block training.

This task still does not replace localStorage, switch source of truth, migrate mutation paths, add UI writes to API, add backup/import over HTTP, add auth, cloud sync, deployment, package dependencies, package scripts, lockfile changes, production backend behavior, or normalized database tables.

Recommended next step is `Task 4.21 Read-only Runtime Parity Acceptance V1` or `Task 4.21 Read-only Diagnostics UX Hardening V1`. Formal `App.tsx` HTTP migration and write-path migration remain blocked.

### Task 4.21: Read-only Runtime Parity Acceptance V1

Completed as runtime parity acceptance for the existing dev-only read-only prototype, not as a new runtime feature and not as write-path migration.

- `readOnlyRuntimeFlagOffParity.test.ts` verifies flag-off and production-like configs render no diagnostics and make no fetch calls.
- `readOnlyRuntimeGetOnly.test.ts` proves enabled diagnostics use only GET calls against the read-only route allowlist and no mutation, backup/import, reset, or recovery routes.
- `readOnlyRuntimeApiUnavailableFallback.test.ts` verifies API unavailable fallback stays diagnostic-only and does not block App usage.
- `readOnlyRuntimeMismatchDiagnostics.test.ts` verifies mismatch results remain diagnostics-only and do not trigger writes, repair, or mutation routes.
- `readOnlyRuntimeLocalStorageIntegrity.test.ts` verifies disabled, matching, mismatch, unavailable, and snapshot-metadata responses do not write localStorage or mutate AppData.
- `readOnlyRuntimeDiagnosticsUi.test.ts` verifies the diagnostics UI is minimal and exposes no repair, sync, overwrite, import, export, reset, apply, or fix controls.
- `readOnlyRuntimeBoundary.test.ts` keeps browser/runtime source free of Node-only imports and API-backed persistence.
- `readOnlyRuntimeDocsParity.test.ts` keeps documentation aligned with diagnostics-only behavior.

Task 4.21 confirms localStorage remains source of truth, API results never overwrite localStorage, no UI writes to API, no mutation route used by App, and API unavailable fallback remains diagnostic-only.

Recommended next step is `Task 4.22 Read-only Diagnostics UX Hardening V1` or `Task 4.22 Mutation Integration Readiness Audit V1`. Formal `App.tsx` HTTP migration and write-path migration remain blocked.

### Task 4.22: Read-only Diagnostics UX Hardening V1

Completed as diagnostics UX/testing hardening for the existing dev-only read-only prototype, not as App runtime migration or write-path migration.

- `DevApiReadOnlyDiagnostics.tsx` is presentational only and owns safe status labels, explanations, severity, endpoint summary rendering, and inert panel markup.
- `DevApiReadOnlyDiagnosticsController.tsx` keeps the existing guarded cancellable comparison effect without adding routes or writes.
- The status model covers disabled, checking, matching, mismatch, unavailable, error, and misconfigured.
- Disabled renders no panel; mismatch is warning-only diagnostics; unavailable is non-fatal; misconfigured explains localhost-only requirements safely.
- Endpoint summaries stay compact and include skipped `/history/:id` when there is no stable local history id.
- Rendered diagnostics expose no repair, sync, overwrite, import, export, reset, apply, or fix controls.
- localStorage remains source of truth, API results never overwrite AppData/localStorage, no UI writes to API, and no mutation route is used by App.

Recommended next step is `Task 4.23 Mutation Integration Readiness Audit V1` or `Task 4.23 Read-only Manual App Acceptance V1`. Formal `App.tsx` HTTP migration and write-path migration remain blocked.

### Task 4.23: Read-only Manual App Acceptance V1

Completed as manual acceptance documentation and docs/static-boundary testing for the existing dev-only read-only diagnostics prototype.

- `docs/READONLY_APP_MANUAL_ACCEPTANCE.md` defines the manual runbook for flag-off, flag-on, matching, mismatch, unavailable, misconfigured, localStorage integrity, GET-only Network, cleanup, and browser build safety checks.
- The runbook requires a dedicated test browser profile, no real personal training data for mismatch/unavailable testing, and temporary env var cleanup after testing.
- The browser bundle safety check targets build output only, such as `dist/`.
- `readOnlyManualAppAcceptanceDocs.test.ts`, `readOnlyManualAppAcceptanceBoundary.test.ts`, and `readOnlyManualAppAcceptanceDocsParity.test.ts` lock the runbook content and static boundaries.

Task 4.23 does not change `App.tsx`, runtime source behavior, diagnostics behavior, UI behavior, localStorage persistence, package scripts, dependencies, lockfiles, schemas, production backend behavior, auth, sync, deployment, or write paths.

Recommended next step is `Task 4.24 Mutation Integration Readiness Audit V1` or `Task 4.24 Read-only Diagnostic Manual Regression V1`. Formal `App.tsx` HTTP migration and write-path migration remain blocked.

### Task 4.24: Mutation Integration Readiness Audit V1

Completed as mutation integration readiness audit and static/docs boundary testing, not as mutation integration or write-path migration.

- `docs/MUTATION_INTEGRATION_READINESS_AUDIT.md` records the current safe baseline, existing server/dev API mutation inventory, remaining blockers, risk analysis, mutation category readiness matrix, source-of-truth rules, required gates, rollback requirements, and decision record.
- `mutationIntegrationReadinessAudit.test.ts` locks the audit sections, route inventory, blockers, risk table, readiness matrix, source-of-truth rules, rollback requirements, and unique planning-only recommendation.
- `mutationIntegrationBoundaryStillBlocked.test.ts` keeps executable browser/runtime source free of App mutation route calls, Node-only imports, frontend mutation clients, mutation feature flag wiring, API-backed localStorage, and package script/dependency expansion.

Task 4.24 does not change `App.tsx`, UI behavior, `src/devApi` runtime behavior, localStorage persistence, save/load behavior, package scripts, dependencies, lockfiles, schemas, production backend behavior, auth, sync, deployment, or write paths. Existing mutation routes remain server/dev API only and are not approved for UI integration.

Task 4.24 result: not ready for mutation integration. Write-path migration remains blocked. The only recommended next task is planning-only `Task 4.25 Write-path Source-of-truth & Offline Strategy V1`; it must not implement App mutation calls, connect POST routes to the UI, or switch source of truth.

### Task 4.25: Write-path Source-of-truth & Offline Strategy V1

Completed as write-path source-of-truth and offline strategy, not as mutation integration or write-path migration.

- `docs/WRITE_PATH_SOURCE_OF_TRUTH_OFFLINE_STRATEGY.md` records source-of-truth options, the short-term source-of-truth rule, offline/PWA strategy, idempotency strategy, conflict/reconciliation strategy, rollback strategy, mutation category strategy, required gates, and the decision record.
- The unique short-term source-of-truth recommendation is Option E: staged migration with read-only comparison first, a later lowest-risk mutation prototype only after gates, and source-of-truth switch only after explicit future acceptance.
- `writePathSourceOfTruthOfflineStrategy.test.ts` locks the strategy document, boundaries, Option E recommendation, offline/idempotency/conflict/rollback content, mutation category strategy, and Task 4.26 next step.
- `writePathMutationBoundaryStillBlocked.test.ts` keeps executable browser/runtime source free of App mutation calls, Node-only imports, frontend mutation clients, mutation feature flag wiring, API-backed localStorage, and package script/dependency expansion.

Task 4.25 does not change `App.tsx`, UI behavior, `src/devApi` runtime behavior, localStorage persistence, save/load behavior, package scripts, dependencies, lockfiles, schemas, production backend behavior, auth, sync, deployment, or write paths.

Task 4.25 result: strategy only. Write-path migration remains blocked. App must not call mutation routes yet. Source-of-truth remains localStorage. No offline mutation queue exists yet. The only recommended next task is `Task 4.26 Mutation UX Confirmation & Rollback Plan V1`.

### Task 4.26: Mutation UX Confirmation & Rollback Plan V1

Completed as mutation UX confirmation and rollback planning, not as mutation integration or write-path migration.

- `docs/MUTATION_UX_CONFIRMATION_ROLLBACK_PLAN.md` records confirmation levels, pending/success/failure UX, rollback UX, duplicate-submit prevention, conflict UX, mutation category UX matrix, required gates, and decision record.
- Confirmation levels are defined from Level 0 no-mutation-allowed through Level 3 strong confirmation for high-risk active-session flows.
- The no-fake-success rule is explicit: success can only be shown after API snapshot persistence is confirmed.
- `mutationUxConfirmationRollbackPlan.test.ts` locks the plan contents, confirmation levels, UX states, no-fake-success rule, category matrix, and Task 4.27 recommendation.
- `mutationUxBoundaryStillBlocked.test.ts` keeps executable browser/runtime source free of App mutation calls, Node-only imports, frontend mutation clients, mutation feature flag wiring, API-backed localStorage, and package script/dependency expansion.

Task 4.26 does not change `App.tsx`, UI behavior, `src/devApi` runtime behavior, localStorage persistence, save/load behavior, package scripts, dependencies, lockfiles, schemas, production backend behavior, auth, sync, deployment, or write paths.

Task 4.26 result: UX/rollback plan only. Write-path migration remains blocked. App must not call mutation routes yet. No mutation prototype is implemented. The only recommended next task is `Task 4.27 Lowest-risk Mutation Prototype Plan V1`, and that task should still be planning-only.

### Task 4.27: Lowest-risk Mutation Prototype Plan V1

Completed as lowest-risk mutation prototype planning, not as mutation implementation or write-path migration.

- `docs/LOWEST_RISK_MUTATION_PROTOTYPE_PLAN.md` evaluates DataHealth issue dismiss, diagnostics acknowledged state, history data-flag, limited history edit, session mutations, DataHealth repair, backup/import over HTTP, reset/recovery over HTTP, and source-of-truth migration.
- The unique first future candidate is DataHealth issue dismiss, but Task 4.27 does not implement it and does not approve App POST calls.
- The first future prototype shape requires issue id, mutation id, idempotency key, request fingerprint, source snapshot hash/version, explicit confirmation, no-fake-success behavior, and snapshot metadata before success.
- `lowestRiskMutationPrototypePlan.test.ts` locks the plan contents, selected candidate, rejected candidates, prototype gates, source-of-truth handling, rollback plan, manual acceptance requirements, and Task 4.28 recommendation.
- `lowestRiskMutationBoundaryStillBlocked.test.ts` keeps executable browser/runtime source free of App mutation calls, Node-only imports, frontend mutation clients, mutation feature flag wiring, API-backed localStorage, and package script/dependency expansion.

Task 4.27 does not change `App.tsx`, UI behavior, `src/devApi` runtime behavior, localStorage persistence, save/load behavior, package scripts, dependencies, lockfiles, schemas, production backend behavior, auth, sync, deployment, or write paths.

Task 4.27 result: plan only. First future candidate is DataHealth issue dismiss. Write-path migration remains blocked. App must not call mutation routes yet. The only recommended next task is `Task 4.28 DataHealth Dismiss Mutation Prototype Plan V1`, and implementation must require explicit user approval.

### Task 4.28: DataHealth Dismiss Mutation Prototype V1

Completed as a dev-only, explicit opt-in, one-route mutation prototype for DataHealth issue dismiss. It is not full mutation integration, source-of-truth migration, localStorage replacement, or production backend work.

- `src/devApi/devApiDataHealthDismissConfig.ts` gates the prototype behind `DEV === true`, `VITE_IRONPATH_DEV_API_COMPARE === "1"`, and `VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT === "datahealth-dismiss"`, with localhost-only Dev API base URL validation.
- `src/devApi/devApiDataHealthDismissClient.ts` exposes only the DataHealth issue dismiss request for `POST /data-health/issues/:issueId/dismiss`; it does not expose session, history, repair, backup, reset, or recovery write paths.
- `src/devApi/DevApiDataHealthDismissPrototype.tsx` mounts as a minimal dev-only experiment, requires confirmation, blocks duplicate submit while pending, preserves local AppData/localStorage, and only reports success after snapshot metadata is returned.
- Task 4.28 tests lock config gating, one-route client behavior, no-fake-success behavior, UI safety, localStorage/AppData preservation, and browser/runtime isolation.

Task 4.28 keeps localStorage as the active App source of truth. API mutation results never overwrite AppData or localStorage. There is no broad frontend mutation client, no source-of-truth switch, no offline queue, no production backend/auth/sync/deployment, no package script or dependency change, no lockfile change, and no normalized table.

Write-path migration remains blocked after Task 4.28. The next recommended task is `Task 4.29 DataHealth Dismiss Prototype Acceptance V1`.

### Task 4.29: DataHealth Dismiss Prototype Acceptance V1

Completed as acceptance tests and manual acceptance documentation for the Task 4.28 one-route DataHealth dismiss prototype. It does not expand mutation capability or add any new browser mutation route.

- `docs/DATAHEALTH_DISMISS_PROTOTYPE_ACCEPTANCE.md` records the manual acceptance runbook for flag matrix, confirmation, duplicate-submit prevention, no-fake-success behavior, API unavailable failure, localStorage integrity, route boundary checks, cleanup, and pass/fail reporting.
- `devApiDataHealthDismissAcceptanceFlagMatrix.test.ts` proves compare-only, mutation-only, production-like, and fully enabled flag states.
- `devApiDataHealthDismissAcceptanceInteraction.test.ts` proves confirmation, pending, duplicate-submit, and local-only success copy.
- `devApiDataHealthDismissAcceptanceFailures.test.ts` proves unavailable, timeout, malformed response, server error, no-change, issue-not-found, write failure, transaction failure, database closed, unsupported route, missing snapshot, and non-2xx success-like responses cannot show success.
- `devApiDataHealthDismissAcceptanceSourceOfTruth.test.ts` proves AppData and localStorage are not mutated or overwritten by prototype success/failure.
- `devApiDataHealthDismissAcceptanceBoundary.test.ts` keeps the browser mutation surface to only `POST /data-health/issues/:issueId/dismiss` and keeps Node-only stack tokens out of browser source.
- `devApiDataHealthDismissManualAcceptanceDocs.test.ts` locks the runbook structure, flags, commands, route allowlist, forbidden routes, cleanup, and pass/fail template.

Task 4.29 keeps localStorage as the active App source of truth. API mutation results never overwrite AppData or localStorage. There is no session/history/DataHealth repair/backup/import/export/reset/recovery browser route, no broad frontend mutation client, no source-of-truth switch, no offline queue, no production backend/auth/sync/deployment, no package script or dependency change, no lockfile change, and no normalized table.

Write-path migration remains blocked after Task 4.29. The next recommended task is `Task 4.30 DataHealth Dismiss Manual App Acceptance V1`.

### Task 4.30: DataHealth Dismiss Manual App Acceptance V1

Completed as manual App acceptance documentation and docs/static tests for the existing Task 4.28 DataHealth dismiss prototype. It does not add runtime behavior, expand mutation capability, or add new browser mutation routes.

- `docs/DATAHEALTH_DISMISS_MANUAL_APP_ACCEPTANCE.md` records the human-run App acceptance checklist for `npm run api:dev`, `npm run dev`, browser DevTools, dedicated test browser profile, flag matrix checks, confirmation, duplicate-submit prevention, success/failure behavior, localStorage integrity, route boundary checks, forbidden controls, cleanup, and pass/fail reporting.
- `dataHealthDismissManualAppAcceptanceDocs.test.ts` locks required sections, checkbox format, commands, flags, cleanup, ready line, allowed routes, forbidden routes, safety warnings, localStorage source-of-truth wording, and pass/fail template.
- `dataHealthDismissManualAppAcceptanceDocsParity.test.ts` keeps the runbook aligned with the Task 4.28 route and required acceptance scenarios while rejecting production-readiness or expanded-mutation instructions.
- `dataHealthDismissManualAppAcceptanceBoundary.test.ts` keeps runtime source unchanged for Task 4.30, blocks Node-only browser imports, blocks broad mutation clients and API-backed storage, and keeps package scripts/dependencies unchanged.

Task 4.30 keeps localStorage as the active App source of truth. API mutation results never overwrite AppData or localStorage. The only accepted browser mutation route remains `POST /data-health/issues/:issueId/dismiss`; session/history/DataHealth repair/backup/import/export/reset/recovery routes remain blocked. There is no production backend/auth/sync/deployment, package script or dependency change, lockfile change, or normalized table.

Write-path migration remains blocked after Task 4.30. The next recommended task is `Task 4.31 DataHealth Dismiss Prototype Hardening V1`.

### Task 4.31: DataHealth Dismiss Prototype Hardening V1

Completed as hardening for the existing dev-only, one-route DataHealth dismiss prototype. It does not add a second mutation prototype, expand mutation capability, or add new browser mutation routes.

- `DevApiDataHealthDismissPrototype.tsx` now uses a synchronous pending lock, abort/unmount completion guard, confirmation reset after success/failure, and stale confirmation clearing when the selected issue changes.
- `devApiDataHealthDismissHardeningNoFakeSuccess.test.ts` locks the strict success shape and missing snapshot/no-change/write-failure behavior.
- `devApiDataHealthDismissHardeningFailureStates.test.ts` locks unavailable, timeout, abort, malformed response, issue-not-found, requires-confirmation, unsupported-route, database-closed, and raw-stack-safe failure handling.
- `devApiDataHealthDismissHardeningConcurrency.test.tsx` locks duplicate-submit prevention, pending disabled state, retry lock release, and abort/unmount guard coverage.
- `devApiDataHealthDismissHardeningConfirmation.test.tsx` locks cancel/no-confirmation behavior, confirmation reset, disabled rendering, and issue-change stale-confirmation clearing.
- `devApiDataHealthDismissHardeningBoundary.test.ts` keeps browser mutation code one-route-only and keeps read-only client, storage, package, and Node-only boundaries intact.
- `devApiDataHealthDismissHardeningDocsParity.test.ts` keeps manual/prototype acceptance docs aligned with the hardening edge cases.

Task 4.31 keeps localStorage as the active App source of truth. API mutation results never overwrite AppData or localStorage. The only accepted browser mutation route remains `POST /data-health/issues/:issueId/dismiss`; session/history/DataHealth repair/backup/import/export/reset/recovery routes remain blocked. There is no production backend/auth/sync/deployment, package script or dependency change, lockfile change, or normalized table.

Write-path migration remains blocked after Task 4.31. The next recommended task is `Task 4.32 DataHealth Dismiss Recovery/Observability V1`.

### Task 4.32: DataHealth Dismiss Prototype Observability & Recovery Notes V1

Completed as safe observability and manual recovery guidance for the existing dev-only, one-route DataHealth dismiss prototype. It does not add a second mutation prototype, expand mutation capability, add a new HTTP endpoint, or add browser reset/recovery actions.

- `DevApiDataHealthDismissPrototype.tsx` exposes safe diagnostic fields for issue id, mutation state, HTTP status, failure code/message, snapshot metadata presence, request timing, and duplicate-submit blocked state.
- `devApiDataHealthDismissClient.ts` keeps strict success handling and maps abort/unavailable/timeout/invalid response/repository failures to safe diagnostics without raw stack text.
- `devApiDataHealthDismissObservabilitySummary.test.ts` locks safe diagnostic state and no raw dump behavior.
- `devApiDataHealthDismissObservabilityFailureMapping.test.ts` locks safe failure copy for unavailable, timeout, invalid response, issue-not-found, no-change, write failure, database closed, missing snapshot metadata, and abort/unmount cases.
- `devApiDataHealthDismissRecoveryNotes.test.ts` locks recovery guidance in manual/prototype acceptance docs.
- `devApiDataHealthDismissObservabilityBoundary.test.ts` keeps browser mutation code one-route-only and keeps read-only client, storage, package, and Node-only boundaries intact.
- `devApiDataHealthDismissObservabilityDocsParity.test.ts` keeps API/refactor/manual docs aligned with the observability and recovery scope.

Task 4.32 keeps localStorage as the active App source of truth. API mutation results never overwrite AppData or localStorage. The only accepted browser mutation route remains `POST /data-health/issues/:issueId/dismiss`; session/history/DataHealth repair/backup/import/export/reset/recovery routes remain blocked. There is no production backend/auth/sync/deployment, package script or dependency change, lockfile change, or normalized table.

Write-path migration remains blocked after Task 4.32. The next recommended task is `Task 4.33 DataHealth Dismiss Regression Lock V1`.

### Task 4.33: DataHealth Dismiss Regression Lock V1

Completed as a regression/testing lock for the existing dev-only, one-route DataHealth dismiss prototype. It does not add runtime features, a second mutation prototype, new mutation routes, source-of-truth switching, AppData/localStorage overwrite behavior, production backend, auth, sync, deployment, package changes, lockfile changes, or normalized tables.

- `dataHealthDismissRegressionRouteLock.test.ts` locks the one-route browser mutation boundary and keeps the read-only client GET-only.
- `dataHealthDismissRegressionSuccessContract.test.ts` locks strict success/no-fake-success behavior and localStorage/AppData integrity.
- `dataHealthDismissRegressionFailureMapping.test.ts` locks known failure states as non-success with safe recovery copy.
- `dataHealthDismissRegressionUxControls.test.ts` locks confirmation, pending/duplicate-submit, retry, dev-only copy, source-of-truth copy, and forbidden-control boundaries.
- `dataHealthDismissRegressionObservabilityDocs.test.ts` locks safe diagnostics, redacted visible issue references, recovery docs, and no production readiness.
- `dataHealthDismissRegressionBoundary.test.ts` locks global browser/Node/package/storage/build-output boundaries.

Task 4.33 keeps localStorage as the active App source of truth. API mutation results never overwrite AppData or localStorage. The only accepted browser mutation route remains `POST /data-health/issues/:issueId/dismiss`; session/history/DataHealth repair/backup/import/export/reset/recovery routes remain blocked.

Write-path migration remains blocked after Task 4.33. The next recommended task is `Task 4.34 Second Mutation Candidate Readiness Audit V1`.

### Task 4.34: Second Mutation Candidate Readiness Audit V1

Completed as an audit and decision record only. It does not add runtime features, a second mutation route, App POST wiring, frontend mutation client work, source-of-truth switching, AppData/localStorage overwrite behavior, production backend, auth, sync, deployment, package changes, lockfile changes, or normalized tables.

- `SECOND_MUTATION_CANDIDATE_READINESS_AUDIT.md` records the candidate inventory, evaluation criteria, data-flag readiness analysis, rejected candidates, required gates, future route boundary rules, decision record, and final recommendation.
- `secondMutationCandidateReadinessAudit.test.ts` locks the audit content and confirms `POST /history/:id/data-flag` is only a future candidate.
- `secondMutationCandidateBoundaryStillBlocked.test.ts` keeps browser runtime code from adding `POST /history/:id/data-flag`, any other mutation route, broad mutation clients, Node-only imports, or package/script changes.

Task 4.34 keeps localStorage as the active App source of truth. API mutation results never overwrite AppData or localStorage. The only implemented browser mutation route remains `POST /data-health/issues/:issueId/dismiss`; the second future candidate is `POST /history/:id/data-flag`, but no second mutation is implemented.

Write-path migration remains blocked after Task 4.34. The next recommended task is `Task 4.35 History Data-flag Mutation Prototype Plan V1`.

### Task 4.35: History Data-flag Mutation Prototype Plan V1

Completed as a plan and decision record only. It does not add runtime features, a second mutation route, App POST wiring, frontend mutation client work, mutation feature flag runtime wiring, source-of-truth switching, AppData/localStorage overwrite behavior, production backend, auth, sync, deployment, package changes, lockfile changes, schema changes, training algorithm changes, or normalized tables.

- `HISTORY_DATA_FLAG_MUTATION_PROTOTYPE_PLAN.md` records dataFlag semantics, data semantics impact, future route/payload plan, confirmation UX, pending/success/failure UX, idempotency, source snapshot conflict handling, rollback, audit trail visibility, manual acceptance, rejected scope, decision record, and final recommendation.
- `historyDataFlagMutationPrototypePlan.test.ts` locks the plan content and confirms `POST /history/:id/data-flag` is only a future prototype candidate.
- `historyDataFlagMutationBoundaryStillBlocked.test.ts` keeps browser runtime code from adding `POST /history/:id/data-flag`, any other mutation route, broad mutation clients, Node-only imports, package/script changes, or API-backed localStorage behavior.

Task 4.35 keeps localStorage as the active App source of truth. API mutation results never overwrite AppData or localStorage. The only implemented browser mutation route remains `POST /data-health/issues/:issueId/dismiss`; history data-flag remains plan-only and no second mutation is implemented.

Write-path migration remains blocked after Task 4.35. The next recommended task is `Task 4.36 History Data-flag Mutation Prototype V1` only if gates are accepted.

### Task 4.36: History Data-flag Mutation Prototype V1

Completed as a dev-only, explicit opt-in, one-route browser mutation prototype. It does not add production backend behavior, auth, sync, deployment, package changes, lockfile changes, package scripts, normalized tables, training algorithm changes, localStorage replacement, AppData overwrite behavior, or a broad mutation client.

- `devApiHistoryDataFlagConfig.ts` enables the prototype only in DEV with read-only comparison enabled and `VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT="history-data-flag"`.
- `devApiHistoryDataFlagClient.ts` exposes only `POST /history/:id/data-flag` and sends the server-compatible `{ dataFlag }` body.
- `DevApiHistoryDataFlagPrototype.tsx` adds the minimal guarded App-side experiment with confirmation, pending lock, no-fake-success handling, source fingerprint diagnostics, and no local AppData/localStorage write.
- `devApiHistoryDataFlag*.test.ts` locks config, client, prototype, server parity, dataFlag semantics, and browser route boundaries.

Task 4.36 keeps localStorage as the active App source of truth. API mutation results never overwrite AppData or localStorage. The only browser mutation prototypes are `POST /data-health/issues/:issueId/dismiss` and `POST /history/:id/data-flag`; session mutation, history edit, DataHealth repair, backup/import/export/reset/recovery routes, and broader write-path migration remain blocked.

Write-path migration remains blocked after Task 4.36. The next recommended task is `Task 4.37 History Data-flag Prototype Acceptance V1`.

### Task 4.37: History Data-flag Prototype Acceptance V1

Completed as acceptance tests and manual acceptance documentation for the Task 4.36 History data-flag prototype. It does not add a third mutation route, expand mutation capability, add production backend behavior, auth, sync, deployment, package changes, lockfile changes, package scripts, normalized tables, training algorithm changes, localStorage replacement, AppData overwrite behavior, or a broad mutation client.

- `docs/HISTORY_DATA_FLAG_PROTOTYPE_ACCEPTANCE.md` records the checkbox manual runbook for dedicated test profile safety, startup commands, flag matrix, target record checks, confirmation, pending/duplicate-submit behavior, strict success, failure/no-fake-success, dataFlag semantics, localStorage integrity, route boundaries, cleanup, and browser build safety.
- `devApiHistoryDataFlagAcceptanceFlagMatrix.test.ts` locks DEV/compare/experiment flag behavior and DataHealth dismiss experiment isolation.
- `devApiHistoryDataFlagAcceptanceInteraction.test.ts` locks target record diagnostics, current/target dataFlag display, confirmation/cancel, pending duplicate-submit prevention, retry re-confirmation, and forbidden control boundaries.
- `devApiHistoryDataFlagAcceptanceNoFakeSuccess.test.ts` locks strict success shape and no-fake-success behavior.
- `devApiHistoryDataFlagAcceptanceFailureStates.test.ts` locks unavailable, timeout, abort, malformed response, server error, no-change, record-not-found, invalid dataFlag, requires-confirmation, source mismatch, repository failures, unsupported-route, and missing snapshot failures.
- `devApiHistoryDataFlagAcceptanceSourceOfTruth.test.ts` locks localStorage/AppData integrity and keeps read-only comparison separate from the mutation prototype.
- `devApiHistoryDataFlagAcceptanceSemantics.test.ts` locks `normal`, `test`, and `excluded` semantics and readMirror/server parity.
- `devApiHistoryDataFlagAcceptanceBoundary.test.ts` locks the exact browser mutation route allowlist, browser/Node boundary, package boundary, and storage boundary.
- `devApiHistoryDataFlagManualAcceptanceDocs.test.ts` locks the manual runbook structure and wording.

Task 4.37 keeps localStorage as the active App source of truth. API mutation results never overwrite AppData or localStorage. Browser mutation routes remain exactly `POST /data-health/issues/:issueId/dismiss` and `POST /history/:id/data-flag`; session mutation, history edit, DataHealth repair, backup/import/export/reset/recovery routes, and broader write-path migration remain blocked.

Write-path migration remains blocked after Task 4.37. The next recommended task is `Task 4.38 History Data-flag Manual App Acceptance V1` or `Task 4.38 History Data-flag Prototype Hardening V1`.

### Task 4.38: History Data-flag Manual App Acceptance V1

Completed as manual App acceptance documentation and docs/static tests for the existing Task 4.36/4.37 History data-flag prototype. It does not add runtime behavior, mutation capability, a third route, production backend behavior, auth, sync, deployment, package changes, lockfile changes, package scripts, normalized tables, training algorithm changes, localStorage replacement, AppData overwrite behavior, or a broad mutation client.

- `docs/HISTORY_DATA_FLAG_MANUAL_APP_ACCEPTANCE.md` records the human-run App acceptance checklist for `npm run api:dev`, `npm run dev`, browser DevTools, a dedicated test browser profile, dedicated dev DB file, flag matrix checks, target record checks, confirmation, duplicate-submit prevention, success/failure behavior, `normal | test | excluded` semantics, localStorage integrity, route boundary checks, forbidden controls, cleanup, and pass/fail reporting.
- `historyDataFlagManualAppAcceptanceDocs.test.ts` locks required sections, checkbox format, commands, flags, cleanup, ready line, target record preparation, allowed routes, forbidden routes, safety warnings, localStorage source-of-truth wording, dataFlag semantics, and pass/fail template.
- `historyDataFlagManualAppAcceptanceDocsParity.test.ts` keeps the manual runbook aligned with the Task 4.36 route and required acceptance scenarios while rejecting production-readiness or expanded-mutation instructions.
- `historyDataFlagManualAppAcceptanceBoundary.test.ts` keeps runtime source unchanged for Task 4.38, blocks Node-only browser imports, blocks broad mutation clients and API-backed storage, and keeps package scripts/dependencies unchanged.

Task 4.38 keeps localStorage as the active App source of truth. API mutation results never overwrite AppData or localStorage. Browser mutation routes remain exactly `POST /data-health/issues/:issueId/dismiss` and `POST /history/:id/data-flag`; session mutation, history edit, DataHealth repair, backup/import/export/reset/recovery routes, and broader write-path migration remain blocked.

Write-path migration remains blocked after Task 4.38. The next recommended task is `Task 4.39 History Data-flag Prototype Hardening V1` or `Task 4.39 Write-path Two-Route Checkpoint V1`.

### Task 4.39: History Data-flag Prototype Hardening V1

Completed as hardening tests and docs parity for the existing Task 4.36 History data-flag prototype. It does not add runtime behavior, mutation capability, a third route, production backend behavior, auth, sync, deployment, package changes, lockfile changes, package scripts, normalized tables, training algorithm changes, localStorage replacement, AppData overwrite behavior, or a broad mutation client.

- `devApiHistoryDataFlagHardeningNoFakeSuccess.test.ts` locks the strict success shape and no-fake-success behavior for missing snapshot metadata, no_change, status mismatch, HTTP errors, and repository/write failures.
- `devApiHistoryDataFlagHardeningFailureStates.test.ts` locks unavailable, timeout, abort, malformed response, record_not_found, invalid flag, requiresConfirmation, unsupported_route, database_closed, and no raw stack behavior.
- `devApiHistoryDataFlagHardeningConcurrency.test.tsx` and `devApiHistoryDataFlagHardeningConfirmation.test.tsx` lock duplicate-submit prevention, pending-state behavior, abort/unmount guards, and confirmation reset.
- `devApiHistoryDataFlagHardeningSemantics.test.ts` locks `normal | test | excluded` semantics and keeps PR/e1RM/effectiveSet/training and backup/import rules unchanged.
- `devApiHistoryDataFlagHardeningBoundary.test.ts` keeps browser mutation routes exactly `POST /data-health/issues/:issueId/dismiss` and `POST /history/:id/data-flag`, with no session/history edit/repair/backup/reset routes.
- `devApiHistoryDataFlagHardeningDocsParity.test.ts` keeps the manual runbook, contract, and refactor docs aligned with the hardening boundary.

Task 4.39 keeps localStorage as the active App source of truth. API mutation results never overwrite AppData or localStorage. Browser mutation routes remain exactly `POST /data-health/issues/:issueId/dismiss` and `POST /history/:id/data-flag`; session mutation, history edit, DataHealth repair, backup/import/export/reset/recovery routes, and broader write-path migration remain blocked.

Write-path migration remains blocked after Task 4.39. The next recommended task is `Task 4.40 Write-path Two-route Checkpoint V1` or `Task 4.40 Second-route Observability & Recovery Notes V1`.

### Task 4.40: Write-path Two-route Checkpoint V1

Completed as a checkpoint/audit document and static regression tests for the current two-route write-path prototype state. It does not add runtime behavior, mutation capability, a third route, production backend behavior, auth, sync, deployment, package changes, lockfile changes, package scripts, normalized tables, training algorithm changes, localStorage replacement, AppData overwrite behavior, or a broad mutation client.

- `docs/WRITE_PATH_TWO_ROUTE_CHECKPOINT.md` records the current accepted browser mutation allowlist, DataHealth dismiss status, History data-flag status, shared safety rules, route boundary matrix, source-of-truth checkpoint, data semantics checkpoint, manual acceptance inventory, regression test inventory, risk register, gates before any third mutation audit, and decision record.
- `writePathTwoRouteCheckpoint.test.ts` locks the checkpoint document structure, accepted route list, source-of-truth statement, prototype status summaries, route matrix, data semantics, manual inventory, regression inventory, risk register, and Task 4.41 recommendation.
- `writePathTwoRouteBoundaryLock.test.ts` keeps browser mutation routes exactly `POST /data-health/issues/:issueId/dismiss` and `POST /history/:id/data-flag`, with no session/history edit/repair/backup/reset routes, no broad mutation client, read-only GET-only behavior, package boundary, and browser build isolation.
- `writePathTwoRouteDocsParity.test.ts` keeps DataHealth and History docs aligned with the current two-route checkpoint while preserving historical one-route statements only when scoped to a prototype's own flow.
- `writePathTwoRouteRegressionMatrix.test.ts` checks that DataHealth dismiss, History data-flag, read-only diagnostics, mutation planning, and runtime boundary regression coverage remain present.

Task 4.40 keeps localStorage as the active App source of truth. API mutation results never overwrite AppData or localStorage. Browser mutation routes remain exactly `POST /data-health/issues/:issueId/dismiss` and `POST /history/:id/data-flag`; no third mutation route is approved, and session mutation, history edit, DataHealth repair, backup/import/export/reset/recovery routes, and broader write-path migration remain blocked.

Write-path migration remains blocked after Task 4.40. The next recommended task is `Task 4.41 Write-path Two-route Manual Regression V1`.

### Task 4.41: Write-path Two-route Manual Regression V1

Completed as a manual regression runbook and static tests for validating both accepted dev-only mutation prototypes together in one local App and Dev API session. It does not add runtime behavior, mutation capability, a third route, production backend behavior, auth, sync, deployment, package changes, lockfile changes, package scripts, normalized tables, training algorithm changes, localStorage replacement, AppData overwrite behavior, or a broad mutation client.

- `docs/WRITE_PATH_TWO_ROUTE_MANUAL_REGRESSION.md` records the human-run two-route regression checklist for Dev API runner startup, App read-only compare startup, DataHealth dismiss flag flow, History data-flag flag flow, mutation experiment isolation, Network route boundaries, no-fake-success, localStorage integrity, failure recovery, forbidden controls, cleanup, and browser build safety.
- `writePathTwoRouteManualRegressionDocs.test.ts` locks required runbook sections, checkbox format, commands, flags, cleanup, ready line, allowed routes, forbidden routes, safety warnings, no-fake-success wording, localStorage source-of-truth wording, and pass/fail template.
- `writePathTwoRouteManualRegressionDocsParity.test.ts` keeps the runbook aligned with the current two-route allowlist and existing manual runbooks while rejecting production-readiness or third-route instructions.
- `writePathTwoRouteManualRegressionBoundary.test.ts` keeps Task 4.41 docs/static-only, blocks Node-only browser imports, blocks broad mutation clients and API-backed storage, and keeps package scripts/dependencies unchanged.
- `writePathTwoRouteManualRegressionMatrix.test.ts` verifies the DataHealth manual runbook, History manual runbook, Task 4.40 checkpoint, read-only GET-only docs, exact two-route allowlist, and write-path blocked status remain present.

Task 4.41 keeps localStorage as the active App source of truth. API mutation results never overwrite AppData or localStorage. Browser mutation routes remain exactly `POST /data-health/issues/:issueId/dismiss` and `POST /history/:id/data-flag`; no third mutation route is approved, and session mutation, history edit, DataHealth repair, backup/import/export/reset/recovery routes, and broader write-path migration remain blocked.

Write-path migration remains blocked after Task 4.41. The next recommended task is `Task 4.42 Third Mutation Candidate Readiness Audit V1` or `Task 4.42 Write-path Two-route Regression Lock V1`.

## High-Risk Files

Do not start the refactor by rewriting these files:

- `src/App.tsx`
- `src/storage/persistence.ts`
- `src/models/training-model.ts`
- `src/engines/enginePipeline.ts`
- `src/engines/trainingDecisionContext.ts`
- `src/features/focus/TrainingFocusView.tsx`
- `src/features/record/RecordView.tsx`

They should only be touched after parity tests and contracts are stable.

## Required Test Gates

Every full-stack refactor stage must keep these categories green:

- typecheck
- full test suite
- production build
- real data fixture regression
- backup import/export round-trip
- schema migration compatibility
- Focus ActionResult and session mutation regressions
- Record Summary / Calendar / DataHealth trust regressions
- Today scheduler and PPL cycle boundary regressions

## Prohibited During Early Refactor

- Do not introduce a backend without endpoint contracts and parity tests.
- Do not move `AppData` ownership before backup and migration are protected.
- Do not duplicate model definitions across `src` and `packages/contracts`.
- Do not use cached summaries as source of truth.
- Do not let API work change training algorithms.
- Do not replace local backup/export before a tested recovery path exists.
