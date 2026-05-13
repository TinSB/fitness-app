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

### Task 4.42: Write-path Two-route Regression Lock V1

Completed as a regression-lock decision record and static tests for the current two-route write-path prototype state. It does not add runtime behavior, mutation capability, a third route, production backend behavior, auth, sync, deployment, package changes, lockfile changes, package scripts, normalized tables, training algorithm changes, localStorage replacement, AppData overwrite behavior, or a broad mutation client.

- `docs/WRITE_PATH_TWO_ROUTE_REGRESSION_LOCK.md` records the accepted two-route allowlist, explicitly blocked routes, DataHealth dismiss regression state, History data-flag regression state, shared two-route rules, source-of-truth lock, data semantics lock, coverage inventory, manual acceptance inventory, future gates, and decision record.
- `writePathTwoRouteRegressionLock.test.ts` locks the regression-lock document structure and recommendation.
- `writePathTwoRouteAllowlistLock.test.ts` and `writePathTwoRouteBoundaryStillBlocked.test.ts` keep browser mutation routes exactly `POST /data-health/issues/:issueId/dismiss` and `POST /history/:id/data-flag`, with no session/history edit/repair/backup/reset routes, no broad mutation client, read-only GET-only behavior, package boundary, and browser build isolation.
- `writePathTwoRouteNoFakeSuccessLock.test.ts` and `writePathTwoRouteCoverageInventory.test.ts` lock the presence of no-fake-success, snapshot metadata, duplicate-submit, acceptance, manual, hardening, regression, read-only, runtime boundary, and server/http/sqlite coverage.
- `writePathTwoRouteDocsLock.test.ts` keeps contract, refactor, manual, DataHealth, and History docs aligned with Task 4.42 while rejecting production-readiness and forbidden-route instructions.

Task 4.42 keeps localStorage as the active App source of truth. API mutation results never overwrite AppData or localStorage. Browser mutation routes remain exactly `POST /data-health/issues/:issueId/dismiss` and `POST /history/:id/data-flag`; no third mutation route is approved, and session mutation, history edit, DataHealth repair, backup/import/export/reset/recovery routes, and broader write-path migration remain blocked.

Write-path migration remains blocked after Task 4.42. The next recommended task is `Task 4.43 Third Mutation Candidate Readiness Audit V1`, audit-only.

### Task 4.43: Third Mutation Candidate Readiness Audit V1

Completed as an audit decision record and static tests for possible third browser mutation candidates after the two-route regression lock. It does not add runtime behavior, mutation capability, a third route, production backend behavior, auth, sync, deployment, package changes, lockfile changes, package scripts, normalized tables, training algorithm changes, localStorage replacement, AppData overwrite behavior, offline mutation queues, API-backed persistence, or a broad mutation client.

- `docs/THIRD_MUTATION_CANDIDATE_READINESS_AUDIT.md` records scope and non-goals, the current two-route baseline, candidate inventory, evaluation criteria, limited history edit readiness analysis, session mutation readiness analysis, DataHealth repair analysis, backup/import/export/reset/recovery analysis, source-of-truth migration analysis, risk matrix, required gates, decision record, and final recommendation.
- `thirdMutationCandidateReadinessAudit.test.ts` locks the audit structure, no-implementation statements, current two-route baseline, candidate inventory, evaluation criteria, limited history edit planning-only status, and Task 4.44 recommendation.
- `thirdMutationCandidateBoundaryStillBlocked.test.ts` keeps browser mutation routes exactly `POST /data-health/issues/:issueId/dismiss` and `POST /history/:id/data-flag`, with no history edit/session/repair/backup/reset routes, no broad mutation client, no third mutation feature flag wiring, read-only GET-only behavior, package boundary, and browser build isolation.
- `thirdMutationCandidateRiskMatrix.test.ts` locks the required risk rows, severity/mitigation/gate columns, history edit high-risk planning-only status, and blocked status for session mutation, repair, backup/reset, and source-of-truth migration.
- `thirdMutationCandidateDocsParity.test.ts` keeps contract, refactor, regression-lock, manual checklist, and audit docs aligned with Task 4.43 while rejecting production-readiness and forbidden-route instructions.

Task 4.43 keeps localStorage as the active App source of truth. API mutation results never overwrite AppData or localStorage. Browser mutation routes remain exactly `POST /data-health/issues/:issueId/dismiss` and `POST /history/:id/data-flag`; no third mutation route is approved, and session mutation, DataHealth repair, backup/import/export/reset/recovery routes, source-of-truth migration, and broader write-path migration remain blocked.

Write-path migration remains blocked after Task 4.43. The next recommended task is `Task 4.44 Limited History Edit Mutation Prototype Plan V1`, planning-only. Task 4.44 must not implement `POST /history/:id/edit`; it must define field-level constraints, reject broad history edit, require PR/e1RM/effectiveSet impact documentation, plan audit before/after display, plan rollback UX, and write a manual acceptance plan before any prototype.

### Task 4.44: Limited History Edit Mutation Prototype Plan V1

Completed as a planning-only decision record and static tests for a possible future limited history edit prototype. It does not add runtime behavior, mutation capability, a third route, production backend behavior, auth, sync, deployment, package changes, lockfile changes, package scripts, normalized tables, training algorithm changes, localStorage replacement, AppData overwrite behavior, offline mutation queues, API-backed persistence, or a broad mutation client.

- `docs/LIMITED_HISTORY_EDIT_MUTATION_PROTOTYPE_PLAN.md` records scope and non-goals, the current two-route baseline, future route boundary, field-level constraints, rejected broad history edit scope, data semantics and calculation impact, readMirror/history surface impact, request metadata plan, confirmation UX, pending/success/failure UX, audit before/after plan, rollback plan, manual acceptance plan, route/source-of-truth gates, prototype gate checklist, decision record, and final recommendation.
- `limitedHistoryEditMutationPrototypePlan.test.ts` locks the planning-only boundaries, current two-route baseline, future candidate route status, request metadata, confirmation, no-fake-success, audit, rollback, manual acceptance, and no automatic next-task decision.
- `limitedHistoryEditMutationFieldConstraints.test.ts` locks the allowed future fields, rejected broad edit fields, and calculation-impact statements.
- `limitedHistoryEditMutationBoundaryStillBlocked.test.ts` keeps browser mutation routes exactly `POST /data-health/issues/:issueId/dismiss` and `POST /history/:id/data-flag`, with no history edit/session/repair/backup/reset routes, no broad mutation client, no history edit feature flag wiring, read-only GET-only behavior, package boundary, storage boundary, and browser build isolation.
- `limitedHistoryEditMutationDocsParity.test.ts` keeps contract, refactor, Task 4.43 audit, manual checklist, and Task 4.44 plan docs aligned while rejecting production-readiness and forbidden-route instructions.

Task 4.44 keeps localStorage as the active App source of truth. API mutation results never overwrite AppData or localStorage. Browser mutation routes remain exactly `POST /data-health/issues/:issueId/dismiss` and `POST /history/:id/data-flag`; `POST /history/:id/edit` remains blocked from browser runtime.

Write-path migration remains blocked after Task 4.44. There is no automatic next task. A future implementation task remains blocked until a later user-approved single-route prototype task explicitly defines implementation files, gates, validation, and rollback.

### Task 4.45: Limited History Edit Mutation Prototype Readiness Gate V1

Completed as a readiness gate decision record and static tests for the possible future limited history edit prototype. It does not add runtime behavior, mutation capability, a third route, production backend behavior, auth, sync, deployment, package changes, lockfile changes, package scripts, normalized tables, training algorithm changes, localStorage replacement, AppData overwrite behavior, offline mutation queues, API-backed persistence, server handler changes, or a broad mutation client.

- `docs/LIMITED_HISTORY_EDIT_MUTATION_READINESS_GATE.md` records scope and non-goals, current baseline, gate summary, field constraint gate, server contract gate, source snapshot/conflict gate, no-fake-success gate, calculation impact gate, audit before/after gate, UX/confirmation gate, manual acceptance gate, risk gate, decision record, rejected alternatives, and final recommendation.
- `limitedHistoryEditMutationReadinessGate.test.ts` locks the readiness gate structure, no-implementation statements, no third route boundary, source-of-truth boundary, and Task 4.46 explicit approval requirement.
- `limitedHistoryEditMutationServerContractReadiness.test.ts` locks the server-side-only route status, future payload compatibility requirement, metadata fallback, and no server changes in Task 4.45.
- `limitedHistoryEditMutationFieldGate.test.ts` locks allowed fields, rejected fields, broad edit rejection, actualWeightKg trust, display-only fields, and rejected derived summaries/dataFlag/active-session state.
- `limitedHistoryEditMutationDocsGate.test.ts` keeps contract, refactor, Task 4.43 audit, Task 4.44 plan, and manual checklist docs aligned while rejecting forbidden history-edit implementation, third-route, App wiring, source-of-truth, production, auth, and sync instructions.
- `limitedHistoryEditMutationBoundaryStillBlocked.test.ts` continues to keep browser mutation routes exactly `POST /data-health/issues/:issueId/dismiss` and `POST /history/:id/data-flag`, with no history edit/session/repair/backup/reset routes, no broad mutation client, no history edit feature flag wiring, read-only GET-only behavior, package boundary, storage boundary, and browser build isolation.

Task 4.45 keeps localStorage as the active App source of truth. API mutation results never overwrite AppData or localStorage. Browser mutation routes remain exactly `POST /data-health/issues/:issueId/dismiss` and `POST /history/:id/data-flag`; `POST /history/:id/edit` remains blocked from browser runtime and no third mutation route is added.

Write-path migration remains blocked after Task 4.45. The next recommended task is `Task 4.46 Limited History Edit Mutation Prototype V1` only with explicit user approval. Task 4.46 must not be auto-started, and it must be a separate one-route, dev-only, explicit opt-in implementation task if the user approves it later.

### Task 4.46: Limited History Edit Mutation Prototype V1

Completed as the explicitly user-approved third dev-only browser mutation prototype.

- Adds only the `POST /history/:id/edit` browser prototype.
- Keeps DataHealth dismiss and History data-flag intact.
- Browser mutation routes are exactly `POST /data-health/issues/:issueId/dismiss`, `POST /history/:id/data-flag`, and `POST /history/:id/edit`.
- Keeps localStorage as the active App source of truth.
- API results never overwrite AppData or localStorage.
- Success requires HTTP success, `ok=true`, `changed=true`, `status="success"`, and snapshot metadata.
- No session mutation, DataHealth repair, backup/import/export/reset/recovery browser route, production backend, auth, sync, deployment, package change, lockfile change, package script, normalized table, broad mutation client, source-of-truth migration, localStorage replacement, offline queue, or training algorithm change is added.

Write-path migration remains limited to dev-only prototypes. The next recommended task is `Task 4.47 Limited History Edit Prototype Acceptance V1`.

### Task 4.47: Limited History Edit Prototype Acceptance V1

Completed as acceptance coverage and manual runbook documentation for the existing Task 4.46 dev-only prototype.

- Adds `docs/LIMITED_HISTORY_EDIT_PROTOTYPE_ACCEPTANCE.md`.
- Adds acceptance tests for flag matrix isolation, target set behavior, confirmation and pending states, no-fake-success, source-of-truth integrity, field constraints, data semantics, route boundary, and docs parity.
- Does not add any new mutation route.
- Does not expand runtime write capability beyond the accepted three-route set.
- Browser mutation routes remain exactly `POST /data-health/issues/:issueId/dismiss`, `POST /history/:id/data-flag`, and `POST /history/:id/edit`.
- localStorage remains source of truth and API results never overwrite AppData or localStorage.

The next recommended task is `Task 4.48 Limited History Edit Manual App Acceptance V1`.

### Task 4.48: Limited History Edit Manual App Acceptance V1

Completed as human-run App acceptance documentation and static lock tests for the existing Task 4.46 prototype.

- Adds `docs/LIMITED_HISTORY_EDIT_MANUAL_APP_ACCEPTANCE.md`.
- Adds manual acceptance docs, boundary, and docs parity tests.
- Does not add any new mutation route.
- Does not expand runtime write capability beyond the accepted three-route set.
- Browser mutation routes remain exactly `POST /data-health/issues/:issueId/dismiss`, `POST /history/:id/data-flag`, and `POST /history/:id/edit`.
- localStorage remains source of truth and API results never overwrite AppData or localStorage.

The next recommended task is `Task 4.49 Limited History Edit Prototype Hardening V1`.

### Task 4.49: Limited History Edit Prototype Hardening V1

Completed as hardening coverage and documentation for the existing Task 4.46 dev-only prototype.

- Adds `docs/LIMITED_HISTORY_EDIT_PROTOTYPE_HARDENING.md`.
- Adds hardening tests for strict no-fake-success behavior, source fingerprint diagnostics, confirmation reset, pending duplicate-submit prevention, route boundary, data semantics, and docs parity.
- Does not add any new mutation route.
- Does not expand runtime write capability beyond the accepted three-route set.
- Browser mutation routes remain exactly `POST /data-health/issues/:issueId/dismiss`, `POST /history/:id/data-flag`, and `POST /history/:id/edit`.
- localStorage remains source of truth and API results never overwrite AppData or localStorage.
- No production backend, auth, sync, deployment, package change, lockfile change, package script, normalized table, broad mutation client, offline queue, source-of-truth migration, localStorage replacement, or training algorithm change is added.

The next recommended task is `Task 4.50 Limited History Edit Observability & Recovery Notes V1`.

### Task 4.50: Limited History Edit Observability & Recovery Notes V1

Completed as safe observability and manual recovery notes for the existing Task 4.46 dev-only prototype.

- Adds `docs/LIMITED_HISTORY_EDIT_OBSERVABILITY_RECOVERY_NOTES.md`.
- Adds observability tests for diagnostic summary, failure-code recovery mapping, route/build boundary, read-only separation, and docs parity.
- Does not add any new mutation route.
- Does not expand runtime write capability beyond the accepted three-route set.
- Browser mutation routes remain exactly `POST /data-health/issues/:issueId/dismiss`, `POST /history/:id/data-flag`, and `POST /history/:id/edit`.
- localStorage remains source of truth and API results never overwrite AppData or localStorage.
- No browser reset/recovery action, production backend, auth, sync, deployment, package change, lockfile change, package script, normalized table, broad mutation client, offline queue, source-of-truth migration, localStorage replacement, or training algorithm change is added.

The next recommended task is `Task 4.51 Limited History Edit Regression Lock V1`.

### Task 4.51: Limited History Edit Regression Lock V1

Completed as a regression lock for the existing Task 4.46 Limited History Edit dev-only prototype.

- Adds `docs/LIMITED_HISTORY_EDIT_REGRESSION_LOCK.md`.
- Adds regression-lock tests for exact three-route allowlist, Limited History Edit field constraints, source-of-truth integrity, route/build boundary, coverage inventory, and docs parity.
- Renames Limited History Edit prototype/acceptance interaction tests to `.test.ts` so they run under the repo's configured Vitest include glob.
- Does not add any new mutation route.
- Does not expand runtime write capability beyond the accepted three-route set.
- Browser mutation routes remain exactly `POST /data-health/issues/:issueId/dismiss`, `POST /history/:id/data-flag`, and `POST /history/:id/edit`.
- localStorage remains source of truth and API results never overwrite AppData or localStorage.
- No production backend, auth, sync, deployment, package change, lockfile change, package script, normalized table, broad mutation client, offline queue, source-of-truth migration, localStorage replacement, fourth mutation route, or training algorithm change is added.

The next recommended task is `Task 4.52 Write-path Three-route Checkpoint V1`.

### Task 4.52: Write-path Three-route Checkpoint V1

Completed as a checkpoint/audit for the current three-route write-path prototype state.

- Adds `docs/WRITE_PATH_THREE_ROUTE_CHECKPOINT.md`.
- Adds checkpoint tests for exact three-route allowlist, route/build boundary, source-of-truth integrity, manual/regression inventory, and docs parity.
- Does not add any new mutation route.
- Does not expand runtime write capability beyond the accepted three-route set.
- Browser mutation routes remain exactly `POST /data-health/issues/:issueId/dismiss`, `POST /history/:id/data-flag`, and `POST /history/:id/edit`.
- localStorage remains source of truth and API results never overwrite AppData or localStorage.
- No production backend, auth, sync, deployment, package change, lockfile change, package script, normalized table, broad mutation client, offline queue, source-of-truth migration, localStorage replacement, fourth mutation route, or training algorithm change is added.

The next recommended task is `Task 4.53 Write-path Three-route Manual Regression V1`.

### Task 4.53: Write-path Three-route Manual Regression V1

Completed as manual regression documentation and static checks for validating all three accepted dev-only mutation prototypes together.

- Adds `docs/WRITE_PATH_THREE_ROUTE_MANUAL_REGRESSION.md`.
- Adds manual regression tests for runbook sections, commands, route matrix, cleanup, source-of-truth, docs inventory, and boundary wording.
- Does not add any new mutation route.
- Does not expand runtime write capability beyond the accepted three-route set.
- Browser mutation routes remain exactly `POST /data-health/issues/:issueId/dismiss`, `POST /history/:id/data-flag`, and `POST /history/:id/edit`.
- localStorage remains source of truth and API results never overwrite AppData or localStorage.
- No production backend, auth, sync, deployment, package change, lockfile change, package script, normalized table, broad mutation client, offline queue, source-of-truth migration, localStorage replacement, fourth mutation route, or training algorithm change is added.

The next recommended task is `Task 4.54 Write-path Three-route Regression Lock V1`.

### Task 4.54: Write-path Three-route Regression Lock V1

Completed as the regression lock for the current three-route write-path prototype state.

- Adds `docs/WRITE_PATH_THREE_ROUTE_REGRESSION_LOCK.md`.
- Adds regression-lock tests for exact three-route allowlist, blocked fourth-route/source-of-truth migration, source/build boundary, coverage inventory, and docs parity.
- Does not add any new mutation route.
- Does not expand runtime write capability beyond the accepted three-route set.
- Browser mutation routes remain exactly `POST /data-health/issues/:issueId/dismiss`, `POST /history/:id/data-flag`, and `POST /history/:id/edit`.
- localStorage remains source of truth and API results never overwrite AppData or localStorage.
- No production backend, auth, sync, deployment, package change, lockfile change, package script, normalized table, broad mutation client, offline queue, source-of-truth migration, localStorage replacement, fourth mutation route, or training algorithm change is added.

The next recommended task is `Task 4.55 Fourth Mutation Candidate Readiness Audit V1`, audit-only. Do not auto-start it.

### Task 4.55: Fourth Mutation Candidate Readiness Audit V1

Completed as an audit and decision record for possible fourth browser mutation candidates after the three-route regression lock.

- Adds `docs/FOURTH_MUTATION_CANDIDATE_READINESS_AUDIT.md`.
- Adds static tests for audit content, route/build boundary, candidate risk matrix, and docs parity.
- Does not add any new mutation route.
- Does not expand runtime write capability beyond the accepted three-route set.
- Browser mutation routes remain exactly `POST /data-health/issues/:issueId/dismiss`, `POST /history/:id/data-flag`, and `POST /history/:id/edit`.
- localStorage remains source of truth and API results never overwrite AppData or localStorage.
- No production backend, auth, sync, deployment, package change, lockfile change, package script, normalized table, broad mutation client, offline queue, source-of-truth migration, localStorage replacement, fourth mutation route, or training algorithm change is added.

Task 4.55 rejects direct fourth-mutation implementation. Active-session mutation is the only plausible future product-value candidate area, but it requires planning first.

The next recommended task is `Task 4.56 Active Session Mutation Readiness & Recovery Plan V1`, planning-only. It must not implement `POST /sessions/start`, `POST /sessions/active/patches`, `POST /sessions/active/complete`, or `POST /sessions/active/discard`.

### Task 4.56: Active Session Mutation Readiness & Recovery Plan V1

Completed as a planning-only readiness and recovery plan for possible future active-session mutation work.

- Adds `docs/ACTIVE_SESSION_MUTATION_READINESS_RECOVERY_PLAN.md`.
- Adds static tests for plan content, blocked session mutation boundaries, recovery gates, and docs parity.
- Does not add any new mutation route.
- Does not implement `POST /sessions/start`, `POST /sessions/active/patches`, `POST /sessions/active/complete`, or `POST /sessions/active/discard`.
- Browser mutation routes remain exactly `POST /data-health/issues/:issueId/dismiss`, `POST /history/:id/data-flag`, and `POST /history/:id/edit`.
- localStorage remains source of truth and API results never overwrite AppData or localStorage.
- No production backend, auth, sync, deployment, package change, lockfile change, package script, normalized table, broad mutation client, offline queue, source-of-truth migration, localStorage replacement, fourth mutation route, or training algorithm change is added.

Task 4.56 defines required future gates for active-session recovery, source snapshot strategy, idempotency, duplicate-submit prevention, patch sequencing, offline failure behavior, confirmation UX, rollback/recovery UX, no-fake-success behavior, data semantics impact, and manual acceptance planning.

No automatic next task is approved. Any future active-session prototype plan requires explicit user approval before starting.

### Task 4.57: Active Session Source Snapshot & Idempotency Plan V1

Completed as a planning-only source snapshot and idempotency plan for future active-session mutation work.

- Adds `docs/ACTIVE_SESSION_SOURCE_SNAPSHOT_IDEMPOTENCY_PLAN.md`.
- Adds static tests for plan content, blocked browser route boundaries, and docs parity.
- Does not add any new mutation route.
- Does not implement `POST /sessions/start`, `POST /sessions/active/patches`, `POST /sessions/active/complete`, or `POST /sessions/active/discard`.
- Browser mutation routes remain exactly `POST /data-health/issues/:issueId/dismiss`, `POST /history/:id/data-flag`, and `POST /history/:id/edit`.
- localStorage remains source of truth and API results never overwrite AppData or localStorage.

Task 4.57 defines `sourceSnapshotHash`, `sourceSnapshotVersion`, `mutationId`, `idempotencyKey`, `requestFingerprint`, activeSession and plan-template target identity, duplicate start prevention, conflict detection, no auto-merge, and no-fake-success gates.

The next recommended task is `Task 4.58 Active Session UX Confirmation & Rollback Plan V1`, docs/static-tests only.

### Task 4.58: Active Session UX Confirmation & Rollback Plan V1

Status: Completed in this branch as planning-only docs/static tests.

Task 4.58 adds `docs/ACTIVE_SESSION_UX_CONFIRMATION_ROLLBACK_PLAN.md`.

Task 4.58 defines future session-start confirmation, pending, duplicate-submit protection, visible failure, no optimistic success, no auto-retry, rollback by disabling the mutation experiment flag, App usability on Dev API failure, and local App fallback requirements.

No active-session route is implemented. Runtime write capability remains limited to DataHealth dismiss, History data-flag, and Limited History Edit. localStorage remains source of truth, API results never overwrite AppData/localStorage, and source-of-truth migration remains blocked.

Next recommended task: Task 4.59 Session Start Mutation Prototype Plan V1.

### Task 4.59: Session Start Mutation Prototype Plan V1

Status: Completed in this branch as planning-only docs/static tests.

Task 4.59 adds `docs/SESSION_START_MUTATION_PROTOTYPE_PLAN.md`.

Task 4.59 defines a possible future `POST /sessions/start` prototype, accepted request payload metadata, source snapshot/idempotency/fingerprint requirements, target identity, confirmation UX, duplicate start prevention, strict no-fake-success, manual recovery behavior, and manual acceptance plan.

No session-start route is implemented. Runtime write capability remains limited to DataHealth dismiss, History data-flag, and Limited History Edit. localStorage remains source of truth, API results never overwrite AppData/localStorage, and source-of-truth migration remains blocked.

Next recommended task: Task 4.60 Session Start Mutation Prototype V1 only if gates pass.

### Task 4.60: Session Start Mutation Prototype V1

Status: Completed in this branch as the fourth dev-only explicit opt-in browser mutation prototype.

Task 4.60 adds:

- `src/devApi/devApiSessionStartConfig.ts`
- `src/devApi/devApiSessionStartClient.ts`
- `src/devApi/DevApiSessionStartPrototype.tsx`

Task 4.60 minimally mounts the guarded prototype in `src/App.tsx`.

Runtime write capability is now limited to exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`

The session-start prototype is default-off, DEV-only, read-only-compare-gated, `session-start` experiment-gated, localhost-only, source-snapshot/idempotency-gated, and confirmation-gated. Success requires HTTP success, `ok=true`, `changed=true`, `status="success"`, and snapshot metadata.

localStorage remains source of truth. API results never overwrite AppData/localStorage. No active patch, complete, discard, DataHealth repair, backup/import/export/reset/recovery route, broad mutation client, source-of-truth migration, production backend/auth/sync/deployment, package dependency, package script, lockfile change, normalized table, offline queue, or training algorithm change is added.

Next recommended task: Task 4.61 Session Start Prototype Acceptance V1.

### Task 4.61: Session Start Prototype Acceptance V1

Status: Completed in this branch as acceptance documentation and test coverage for the existing Task 4.60 prototype.

Task 4.61 adds `docs/SESSION_START_PROTOTYPE_ACCEPTANCE.md`.

Task 4.61 adds acceptance tests for flag matrix isolation, no stable target, confirmation/cancel, pending duplicate-submit, strict no-fake-success, localStorage integrity, route boundary, blocked active patch/complete/discard routes, and manual runbook coverage.

No new mutation route is added. Runtime write capability remains limited to DataHealth dismiss, History data-flag, Limited History Edit, and Session Start. localStorage remains source of truth, API results never overwrite AppData/localStorage, and source-of-truth migration remains blocked.

Next recommended task: Task 4.62 Session Start Manual App Acceptance V1.

### Task 4.62: Session Start Manual App Acceptance V1

Status: Completed in this branch as human-run manual App acceptance documentation and static tests for the existing Task 4.60 prototype.

Task 4.62 adds `docs/SESSION_START_MANUAL_APP_ACCEPTANCE.md`.

The runbook covers dedicated test profile/dev DB safety, flag matrix, confirmation/cancel, duplicate start, strict success/no-fake-success, localStorage integrity, DevTools Network route boundary, cleanup/env reset, and browser build safety.

No new mutation route is added. Runtime write capability remains limited to DataHealth dismiss, History data-flag, Limited History Edit, and Session Start. localStorage remains source of truth, API results never overwrite AppData/localStorage, and source-of-truth migration remains blocked.

Next recommended task: Task 4.63 Session Start Prototype Hardening V1.

### Task 4.63: Session Start Prototype Hardening V1

Status: Completed in this branch as hardening coverage and documentation for the existing Task 4.60 prototype.

Task 4.63 adds `docs/SESSION_START_PROTOTYPE_HARDENING.md`.

Task 4.63 adds hardening tests for strict no-fake-success, missing source snapshot/idempotency metadata, active_session_exists, missing snapshot metadata, unavailable/timeout/abort/malformed response, repository errors, duplicate-submit/pending lock, confirmation requirements, no localStorage/AppData mutation, and route boundary.

No new mutation route is added. Runtime write capability remains limited to DataHealth dismiss, History data-flag, Limited History Edit, and Session Start. localStorage remains source of truth, API results never overwrite AppData/localStorage, and source-of-truth migration remains blocked.

Next recommended task: Task 4.64 Session Start Observability & Recovery Notes V1.

### Task 4.64: Session Start Observability & Recovery Notes V1

Status: Completed in this branch as safe observability and manual recovery notes for the existing Task 4.60 prototype.

Task 4.64 adds `docs/SESSION_START_OBSERVABILITY_RECOVERY_NOTES.md`.

Task 4.64 adds tests for safe diagnostic summaries, safe failure-to-recovery-note mapping, no raw stack/raw response/AppData/localStorage/SQLite leaks, no browser recovery controls, read-only GET-only separation, and route boundary.

No new mutation route is added. Runtime write capability remains limited to DataHealth dismiss, History data-flag, Limited History Edit, and Session Start. localStorage remains source of truth, API results never overwrite AppData/localStorage, and source-of-truth migration remains blocked.

Next recommended task: Task 4.65 Session Start Regression Lock V1.

### Task 4.65: Session Start Regression Lock V1

Status: Completed in this branch as regression-lock documentation and static coverage for the existing Task 4.60 prototype.

Task 4.65 adds `docs/SESSION_START_REGRESSION_LOCK.md`.

Task 4.65 adds regression tests for exact four-route allowlist, active patch/complete/discard still blocked, no broad mutation client, no API-backed storage, coverage inventory, manual inventory, no-fake-success expectations, localStorage/AppData integrity, and docs parity.

No new mutation route is added. Runtime write capability remains limited to DataHealth dismiss, History data-flag, Limited History Edit, and Session Start. localStorage remains source of truth, API results never overwrite AppData/localStorage, and source-of-truth migration remains blocked.

Next recommended task: Task 4.66 Write-path Four-route Checkpoint V1.

### Task 4.66: Write-path Four-route Checkpoint V1

Status: Completed in this branch as checkpoint documentation and static coverage for the current four-route write-path prototype state.

Task 4.66 adds `docs/WRITE_PATH_FOUR_ROUTE_CHECKPOINT.md`.

Task 4.66 adds checkpoint tests for exact four-route allowlist, active patch/complete/discard still blocked, no broad mutation client, no API-backed storage, source-of-truth checkpoint, data semantics checkpoint, coverage inventory, manual inventory, risk register, and docs parity.

No new mutation route is added. Runtime write capability remains limited to DataHealth dismiss, History data-flag, Limited History Edit, and Session Start. localStorage remains source of truth, API results never overwrite AppData/localStorage, and source-of-truth migration remains blocked.

Next recommended task: Task 4.67 Write-path Four-route Manual Regression V1.

### Task 4.67: Write-path Four-route Manual Regression V1

Status: Completed in this branch as manual regression documentation and static coverage for the current four-route write-path prototype state.

Task 4.67 adds `docs/WRITE_PATH_FOUR_ROUTE_MANUAL_REGRESSION.md`.

Task 4.67 adds manual-regression tests for read-only diagnostics, DataHealth dismiss, History data-flag, Limited History Edit, Session Start, experiment isolation, DevTools Network route boundary, no-fake-success, localStorage integrity, failure recovery, cleanup/env reset, browser build safety, and docs parity.

No new mutation route is added. Runtime write capability remains limited to DataHealth dismiss, History data-flag, Limited History Edit, and Session Start. localStorage remains source of truth, API results never overwrite AppData/localStorage, and source-of-truth migration remains blocked.

Next recommended task: Task 4.68 Write-path Four-route Regression Lock V1.

### Task 4.68: Write-path Four-route Regression Lock V1

Status: Completed in this branch as regression-lock documentation and static coverage for the current four-route write-path prototype state.

Task 4.68 adds `docs/WRITE_PATH_FOUR_ROUTE_REGRESSION_LOCK.md`.

Task 4.68 adds regression-lock tests for exact four-route allowlist, active patch/complete/discard still blocked, no broad mutation client, no API-backed storage, localStorage/AppData integrity, data semantics, coverage inventory, manual inventory, future gates, and docs parity.

No new mutation route is added. Runtime write capability remains limited to DataHealth dismiss, History data-flag, Limited History Edit, and Session Start. localStorage remains source of truth, API results never overwrite AppData/localStorage, and source-of-truth migration remains blocked.

Next recommended task: Task 4.69 Phase 4 Source-of-truth Migration Readiness Audit V1.

### Task 4.69: Phase 4 Source-of-truth Migration Readiness Audit V1

Status: Completed in this branch as audit-only documentation and static boundary coverage.

Task 4.69 adds `docs/PHASE4_SOURCE_OF_TRUTH_MIGRATION_READINESS_AUDIT.md`.

Task 4.69 finds Phase 4 is not ready to switch source of truth. localStorage remains source of truth, API results never overwrite AppData/localStorage, and source-of-truth migration remains Phase 5 work. No runtime behavior, storage adapter, package, schema, production backend, auth, sync, deployment, or mutation route is added.

Next recommended task: Task 4.70 API-backed Runtime Strategy Plan V1.

### Task 4.70: API-backed Runtime Strategy Plan V1

Status: Completed in this branch as planning-only documentation and static boundary coverage.

Task 4.70 adds `docs/API_BACKED_RUNTIME_STRATEGY_PLAN.md`.

Task 4.70 covers localStorage fallback models, migration approach, feature flags, read/write client architecture, offline strategy, rollback strategy, and production/auth/sync assumptions. It does not implement API-backed runtime behavior, source-of-truth migration, localStorage replacement, production backend, auth, sync, deployment, package changes, or mutation routes.

Next recommended task: Task 4.71 Phase 4 Final Data Safety Audit V1.

### Task 4.71: Phase 4 Final Data Safety Audit V1

Status: Completed in this branch as audit-only documentation and static boundary coverage.

Task 4.71 adds `docs/PHASE4_FINAL_DATA_SAFETY_AUDIT.md`.

Task 4.71 records accepted routes, blocked routes, source-of-truth lock, localStorage integrity, no-fake-success, backup/import safety, readMirror parity, and runtime boundary. It does not implement runtime behavior, source-of-truth migration, localStorage replacement, API-backed runtime, production backend, auth, sync, deployment, package changes, or mutation routes.

Next recommended task: Task 4.72 Phase 4 Manual Final Acceptance V1.

### Task 4.72: Phase 4 Manual Final Acceptance V1

Status: Completed in this branch as final manual acceptance documentation and static boundary coverage.

Task 4.72 adds `docs/PHASE4_MANUAL_FINAL_ACCEPTANCE.md`.

Task 4.72 covers the Dev API runner, read-only diagnostics, all four accepted mutation prototypes, route boundaries, localStorage integrity, no-fake-success, failure recovery, cleanup/env reset, browser build safety, and pass/fail recording. It does not implement runtime behavior, source-of-truth migration, localStorage replacement, API-backed runtime, production backend, auth, sync, deployment, package changes, or mutation routes.

Next recommended task: Task 4.73 Phase 4 Exit Regression Lock V1.

### Task 4.73: Phase 4 Exit Regression Lock V1

Status: Completed in this branch as Phase 4 exit regression-lock documentation and static boundary coverage.

Task 4.73 adds `docs/PHASE4_EXIT_REGRESSION_LOCK.md`.

Task 4.73 locks the final accepted route allowlist, final blocked route list, localStorage source-of-truth, browser build isolation, no production/auth/sync/deployment, no source-of-truth migration, and Phase 5 handoff-only next step. It does not implement runtime behavior, source-of-truth migration, localStorage replacement, API-backed runtime, production backend, auth, sync, deployment, package changes, or mutation routes.

Next recommended task: Task 4.74 Phase 5 Handoff Plan V1.

### Task 4.74: Phase 5 Handoff Plan V1

Status: Completed in this branch as Phase 5 handoff planning and static boundary coverage.

Task 4.74 adds `docs/PHASE5_HANDOFF_PLAN.md`.

Task 4.74 records Phase 4 final state, source-of-truth migration prerequisites, API-backed runtime prerequisites, production/auth/sync prerequisites, risk register, and recommended Phase 5 first task. It does not implement Phase 5, source-of-truth migration, localStorage replacement, API-backed runtime, production backend, auth, sync, deployment, package changes, or mutation routes.

Next recommended task: Task 4.75 Phase 4 Completion & Archive V1.

### Task 4.75: Phase 4 Completion & Archive V1

Status: Completed in this branch as Phase 4 completion archive documentation and static boundary coverage.

Task 4.75 adds `docs/PHASE4_COMPLETION_ARCHIVE.md`.

Task 4.75 marks Phase 4 complete, records the final accepted routes and blocked routes, records final validation commands, and stops the automatic Phase 4 chain before Phase 5. It does not implement Phase 5, source-of-truth migration, localStorage replacement, API-backed runtime, production backend, auth, sync, deployment, package changes, or mutation routes.

Recommended Phase 5 starting task: Task 5.1 Source-of-truth Migration Architecture Gate V1.

### Task 5.1: Source-of-truth Migration Architecture Gate V1

Status: Completed in this branch as architecture-gate documentation and static boundary coverage.

Task 5.1 adds `docs/SOURCE_OF_TRUTH_MIGRATION_ARCHITECTURE_GATE.md`.

Task 5.1 records the Phase 4 exit state, localStorage source-of-truth baseline, API/SQLite candidate ownership area, migration risks, fallback strategy, rollback strategy, and required gates before implementation. It does not implement source-of-truth migration, localStorage replacement, API-backed runtime, production backend, auth, sync, cloud, deployment, package changes, normalized tables, App.tsx changes, or mutation routes.

Next recommended task: Task 5.2 AppData Ownership Matrix V1.

### Task 5.2: AppData Ownership Matrix V1

Status: Completed in this branch as ownership-matrix documentation and static boundary coverage.

Task 5.2 adds `docs/APPDATA_OWNERSHIP_MATRIX.md`.

Task 5.2 classifies training history, active session, program templates, settings, screening profile, DataHealth, backup metadata, readMirror summaries, derived analytics, migration-only state, fallback-only state, and blocked capabilities into API-owned, local-only, derived, migration-only, fallback-only, or blocked categories. It does not implement source-of-truth migration, localStorage replacement, API-backed runtime, production backend, auth, sync, cloud, deployment, package changes, normalized tables, App.tsx changes, storage adapters, or mutation routes.

Next recommended task: Task 5.3 API Client Runtime Strategy V1.

### Task 5.3: API Client Runtime Strategy V1

Status: Completed in this branch as API client strategy documentation and static boundary coverage.

Task 5.3 adds `docs/API_CLIENT_RUNTIME_STRATEGY.md`.

Task 5.3 plans typed route clients, GET-only read client boundaries, route-specific mutation client boundaries, safe error shape, timeout, abort, retry policy, request fingerprint, snapshot metadata handling, and source snapshot strategy. It does not implement API clients, a broad mutation client, API-backed runtime, source-of-truth migration, localStorage replacement, production backend, auth, sync, cloud, deployment, package changes, normalized tables, App.tsx changes, storage adapters, or mutation routes.

Next recommended task: Task 5.4 Runtime Source Switch Feature Flag Plan V1.

### Task 5.4: Runtime Source Switch Feature Flag Plan V1

Status: Completed in this branch as runtime-source flag planning and static boundary coverage.

Task 5.4 adds `docs/RUNTIME_SOURCE_SWITCH_FEATURE_FLAG_PLAN.md`.

Task 5.4 plans `localStorage`, `api-readonly`, and `api-primary-dev` runtime source modes, keeps `localStorage` as default, requires explicit dev/local opt-in for non-localStorage modes, and defines fallback behavior. It does not implement a runtime source selector, API-backed runtime, source-of-truth migration, localStorage replacement, production backend, auth, sync, cloud, deployment, package changes, normalized tables, App.tsx changes, storage adapters, or mutation routes.

Next recommended task: Task 5.5 Migration Backup & Rollback Strategy V1.

### Task 5.5: Migration Backup & Rollback Strategy V1

Status: Completed in this branch as migration backup/rollback strategy documentation and static boundary coverage.

Task 5.5 adds `docs/MIGRATION_BACKUP_ROLLBACK_STRATEGY.md`.

Task 5.5 plans localStorage backup, SQLite snapshot backup, dry-run behavior, apply behavior, rollback to localStorage, corrupt snapshot handling, schema mismatch handling, and backup-first rules. It does not implement migration dry-run, migration apply, SQLite writes, localStorage deletion, source-of-truth migration, localStorage replacement, API-backed runtime, production backend, auth, sync, cloud, deployment, package changes, normalized tables, App.tsx changes, storage adapters, or mutation routes.

Next recommended task: Task 5.6 Offline / PWA Conflict Strategy V1.

### Task 5.6: Offline / PWA Conflict Strategy V1

Status: Completed in this branch as offline/PWA conflict strategy documentation and static boundary coverage.

Task 5.6 adds `docs/OFFLINE_PWA_CONFLICT_STRATEGY.md`.

Task 5.6 plans API unavailable behavior, offline training behavior, active session persistence risk handling, visible failure states, conflict diagnostics, and the decision that no full offline mutation queue is approved by this task. It does not implement offline mutation queue, background sync, queued write replay, API-backed runtime, source-of-truth migration, localStorage replacement, production backend, auth, sync, cloud, deployment, package changes, normalized tables, App.tsx changes, storage adapters, or mutation routes.

Next recommended task: Task 5.7 API-backed Read Runtime Plan V1.

### Task 5.7: API-backed Read Runtime Plan V1

Status: Completed in this branch as API-backed read runtime planning and static boundary coverage.

Task 5.7 adds `docs/API_BACKED_READ_RUNTIME_PLAN.md`.

Task 5.7 plans boot data from API snapshot, localStorage fallback, API unavailable UI, snapshot metadata display, readMirror parity, GET-only boundaries, and source-switch boundaries. It does not implement API-backed read runtime, API clients, POST writes, runtime source selection, source-of-truth migration, localStorage replacement, production backend, auth, sync, cloud, deployment, package changes, normalized tables, App.tsx changes, storage adapters, or mutation routes.

Next recommended task: Task 5.8 API-backed Read Client Prototype V1.

### Task 5.8: API-backed Read Client Prototype V1

Status: Completed in this branch as a dev/local GET-only API-backed read client prototype.

Task 5.8 adds:

- `src/devApi/apiBackedReadConfig.ts`
- `src/devApi/apiBackedReadClient.ts`
- `src/devApi/ApiBackedReadDiagnostics.tsx`

The prototype is explicit opt-in only with `VITE_IRONPATH_RUNTIME_SOURCE=api-readonly`, development mode, and a localhost Dev API base URL. It allows only:

- `GET /health`
- `GET /app-data/summary`
- `GET /sessions/summary`
- `GET /history`
- `GET /history/:id`
- `GET /data-health/summary`

Task 5.8 adds no POST write, no runtime source selector, no API-backed persistence adapter, no App.tsx mount, no source-of-truth migration, no localStorage write, no AppData overwrite, no production backend, no auth, no sync, no cloud, no deployment, no package change, no normalized table, and no browser mutation route.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`

localStorage remains source of truth. API results never overwrite AppData or localStorage.

Next recommended task: Task 5.9 API-backed Read Runtime Acceptance V1.

### Task 5.9: API-backed Read Runtime Acceptance V1

Status: Completed in this branch as acceptance documentation and tests for the Task 5.8 GET-only client prototype.

Task 5.9 adds `docs/API_BACKED_READ_RUNTIME_ACCEPTANCE.md`.

Acceptance covers API available, API unavailable, malformed response, timeout, abort, missing snapshot metadata, snapshot mismatch diagnostics, readMirror parity, localStorage integrity, GET-only route boundary, and browser build safety.

Accepted API-backed read routes remain:

- `GET /health`
- `GET /app-data/summary`
- `GET /sessions/summary`
- `GET /history`
- `GET /history/:id`
- `GET /data-health/summary`

Task 5.9 adds no POST write, no runtime source selector, no API-backed persistence adapter, no App.tsx mount, no source-of-truth migration, no localStorage write, no AppData overwrite, no production backend, no auth, no sync, no cloud, no deployment, no package change, no normalized table, and no browser mutation route.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`

localStorage remains source of truth. API results never overwrite AppData or localStorage.

Next recommended task: Task 5.10 API-backed Read Manual App Acceptance V1.

### Task 5.10: API-backed Read Manual App Acceptance V1

Status: Completed in this branch as a human browser manual acceptance runbook for the Task 5.8 GET-only prototype.

Task 5.10 adds `docs/API_BACKED_READ_MANUAL_APP_ACCEPTANCE.md`.

The runbook covers a dedicated test browser profile, dedicated dev DB, Dev API runner, App dev server, Network GET-only verification, API available scenario, API unavailable fallback scenario, localStorage integrity, forbidden UI controls, browser build safety, cleanup/env reset, and pass/fail template.

Task 5.10 adds no POST write, no runtime source selector, no API-backed persistence adapter, no App.tsx mount, no source-of-truth migration, no localStorage write, no AppData overwrite, no production backend, no auth, no sync, no cloud, no deployment, no package change, no normalized table, and no browser mutation route.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`

localStorage remains source of truth. API results never overwrite AppData or localStorage.

Next recommended task: Task 5.11 API-backed Read Runtime Regression Lock V1.

### Task 5.11: API-backed Read Runtime Regression Lock V1

Status: Completed in this branch as the regression lock for the dev/local GET-only API-backed read prototype.

Task 5.11 adds `docs/API_BACKED_READ_RUNTIME_REGRESSION_LOCK.md`.

The lock covers the exact GET-only route list, source switch boundary, localStorage/AppData integrity, visible failure behavior, browser Node-only boundary, coverage inventory, manual acceptance inventory, and future work gate.

Accepted API-backed read routes remain:

- `GET /health`
- `GET /app-data/summary`
- `GET /sessions/summary`
- `GET /history`
- `GET /history/:id`
- `GET /data-health/summary`

Task 5.11 adds no POST write, no runtime source selector, no API-backed persistence adapter, no App.tsx mount, no source-of-truth migration, no localStorage write, no AppData overwrite, no production backend, no auth, no sync, no cloud, no deployment, no package change, no normalized table, and no browser mutation route.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`

localStorage remains source of truth. API results never overwrite AppData or localStorage.

Next recommended task: Task 5.12 Active Session Write Coverage Gap Audit V1.

### Task 5.12: Active Session Write Coverage Gap Audit V1

Status: Completed in this branch as an audit-only review of remaining active-session browser write gaps.

Task 5.12 adds `docs/ACTIVE_SESSION_WRITE_COVERAGE_GAP_AUDIT.md`.

Gap routes:

- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

These routes remain blocked from browser runtime by Task 5.12. Future browser exposure requires route-specific planning and prototype tasks.

Task 5.12 adds no browser route, no session patch prototype, no session complete prototype, no session discard prototype, no broad mutation client, no runtime source selector, no API-backed persistence adapter, no App.tsx mount, no source-of-truth migration, no localStorage write, no AppData overwrite, no production backend, no auth, no sync, no cloud, no deployment, no package change, and no normalized table.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`

localStorage remains source of truth. API results never overwrite AppData or localStorage.

Next recommended task: Task 5.13 Session Patch Mutation Prototype Plan V1.

### Task 5.13: Session Patch Mutation Prototype Plan V1

Status: Completed in this branch as a planning-only route-specific plan for future `POST /sessions/active/patches`.

Task 5.13 adds `docs/SESSION_PATCH_MUTATION_PROTOTYPE_PLAN.md`.

The plan covers patch ordering, stale step/set risk, duplicate patch risk, partial update risk, current set corruption risk, source snapshot metadata, request fingerprint, idempotency key, strict no-fake-success behavior, localStorage/AppData integrity, route boundary, and manual acceptance.

Task 5.13 does not implement `POST /sessions/active/patches`, does not add browser route exposure, does not implement session complete or discard, does not add a broad mutation client, does not add App.tsx wiring, does not add API primary runtime, does not switch source of truth, does not write localStorage, does not overwrite AppData, does not add package changes, and does not add production backend/auth/sync/cloud/deployment.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`

localStorage remains source of truth. API results never overwrite AppData or localStorage.

Next recommended task: Task 5.14 Session Patch Mutation Prototype V1.

### Task 5.14: Session Patch Mutation Prototype V1

Status: Completed in this branch as a dev-only, route-specific prototype for `POST /sessions/active/patches`.

Task 5.14 adds `src/devApi/devApiSessionPatchConfig.ts`, `src/devApi/devApiSessionPatchClient.ts`, and `src/devApi/DevApiSessionPatchPrototype.tsx`, with a minimal guarded mount in `src/App.tsx`.

The prototype is default-off and requires `VITE_IRONPATH_DEV_API_COMPARE === "1"` plus `VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT === "session-patch"`. It preserves source snapshot metadata, idempotency key, request fingerprint, confirmation, pending duplicate-submit lock, strict success shape, and snapshot metadata requirements.

Task 5.14 does not implement session complete or discard, does not add DataHealth repair, does not add backup/import/export/reset/recovery HTTP routes, does not add a broad mutation client, does not add API primary runtime, does not switch source of truth, does not write localStorage, does not overwrite AppData, does not add package changes, and does not add production backend/auth/sync/cloud/deployment.

Accepted browser mutation routes are now exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`

localStorage remains source of truth. API results never overwrite AppData or localStorage.

Next recommended task: Task 5.15 Session Patch Prototype Acceptance / Hardening V1.

### Task 5.15: Session Patch Prototype Acceptance / Hardening V1

Status: Completed in this branch as acceptance and hardening coverage for `POST /sessions/active/patches`.

Task 5.15 adds `docs/SESSION_PATCH_PROTOTYPE_ACCEPTANCE_HARDENING.md` plus session patch acceptance, hardening, docs, and boundary tests.

The coverage locks duplicate submit prevention, stale source snapshot and target mismatch, invalid active session or patch target, timeout/unavailable/malformed response, missing snapshot metadata, server non-success states, no-fake-success behavior, localStorage/AppData integrity, and route boundary.

Task 5.15 does not add a browser route, does not implement session complete or discard, does not add DataHealth repair, does not add backup/import/export/reset/recovery HTTP routes, does not add a broad mutation client, does not add API primary runtime, does not switch source of truth, does not write localStorage, does not overwrite AppData, does not add package changes, and does not add production backend/auth/sync/cloud/deployment.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`

localStorage remains source of truth. API results never overwrite AppData or localStorage.

Next recommended task: Task 5.16 Session Complete Mutation Prototype Plan V1.

### Task 5.16: Session Complete Mutation Prototype Plan V1

Status: Completed in this branch as a planning-only route-specific plan for future `POST /sessions/active/complete`.

Task 5.16 adds `docs/SESSION_COMPLETE_MUTATION_PROTOTYPE_PLAN.md`.

The plan covers duplicate complete risk, active session missing behavior, history duplicate risk, source snapshot mismatch, idempotency key, request fingerprint, incomplete-main-work confirmation, failure recovery, strict no-fake-success behavior, localStorage/AppData integrity, route boundary, and manual acceptance requirements.

Task 5.16 does not implement `POST /sessions/active/complete`, does not add browser route exposure, does not implement session discard, does not add a broad mutation client, does not add App.tsx wiring, does not add API primary runtime, does not switch source of truth, does not write localStorage, does not overwrite AppData, does not add package changes, and does not add production backend/auth/sync/cloud/deployment.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`

localStorage remains source of truth. API results never overwrite AppData or localStorage.

Next recommended task: Task 5.17 Session Complete Mutation Prototype V1.

### Task 5.17: Session Complete Mutation Prototype V1

Status: Completed in this branch as a dev-only, route-specific prototype for `POST /sessions/active/complete`.

Task 5.17 adds `src/devApi/devApiSessionCompleteConfig.ts`, `src/devApi/devApiSessionCompleteClient.ts`, and `src/devApi/DevApiSessionCompletePrototype.tsx`, with a minimal guarded mount in `src/App.tsx`.

The prototype is default-off and requires `VITE_IRONPATH_DEV_API_COMPARE === "1"` plus `VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT === "session-complete"`. It preserves source snapshot metadata, idempotency key, request fingerprint, confirmation, pending duplicate-submit lock, strict success shape, and snapshot metadata requirements.

Task 5.17 does not implement session discard, does not add DataHealth repair, does not add backup/import/export/reset/recovery HTTP routes, does not add a broad mutation client, does not add API primary runtime, does not switch source of truth, does not write localStorage, does not overwrite AppData, does not add package changes, and does not add production backend/auth/sync/cloud/deployment.

Accepted browser mutation routes are now exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`

localStorage remains source of truth. API results never overwrite AppData or localStorage.

Next recommended task: Task 5.18 Session Complete Acceptance / Hardening V1.

### Task 5.18: Session Complete Acceptance / Hardening V1

Status: Completed in this branch as acceptance and hardening coverage for the existing `POST /sessions/active/complete` prototype.

Task 5.18 adds `docs/SESSION_COMPLETE_ACCEPTANCE_HARDENING.md`, `tests/devApiSessionCompleteAcceptance.test.ts`, `tests/devApiSessionCompleteHardening.test.ts`, `tests/sessionCompleteAcceptanceBoundary.test.ts`, and `tests/sessionCompleteAcceptanceDocsParity.test.ts`.

The coverage locks duplicate complete prevention, missing active session behavior, invalid active session identity, incomplete-main-work confirmation behavior, write failure, transaction failure, database closed, timeout/unavailable/malformed response handling, missing snapshot metadata, strict no-fake-success behavior, pending lock behavior, confirmation reset behavior, localStorage/AppData integrity, and route boundary.

Task 5.18 does not add a browser route, does not implement session discard, does not add DataHealth repair, does not add backup/import/export/reset/recovery HTTP routes, does not add a broad mutation client, does not add API primary runtime, does not switch source of truth, does not write localStorage, does not overwrite AppData, does not add package changes, and does not add production backend/auth/sync/cloud/deployment.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`

localStorage remains source of truth. API results never overwrite AppData or localStorage.

Next recommended task: Task 5.19 Session Discard Mutation Prototype Plan V1.

### Task 5.19: Session Discard Mutation Prototype Plan V1

Status: Completed in this branch as a planning-only route-specific plan for future `POST /sessions/active/discard`.

Task 5.19 adds `docs/SESSION_DISCARD_MUTATION_PROTOTYPE_PLAN.md`, `tests/sessionDiscardMutationPrototypePlan.test.ts`, `tests/sessionDiscardMutationBoundaryStillBlocked.test.ts`, and `tests/sessionDiscardMutationDocsParity.test.ts`.

The plan covers unsaved training state loss risk, strong confirmation, visible recovery policy, no history write behavior, source snapshot metadata, mutation id, idempotency key, request fingerprint, duplicate discard prevention, strict no-fake-success behavior, localStorage/AppData integrity, route boundary, and manual acceptance requirements.

Task 5.19 does not implement `POST /sessions/active/discard`, does not add browser route exposure, does not change session patch or session complete behavior, does not add a broad mutation client, does not add App.tsx wiring, does not add API primary runtime, does not switch source of truth, does not write localStorage, does not overwrite AppData, does not add package changes, and does not add production backend/auth/sync/cloud/deployment.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`

localStorage remains source of truth. API results never overwrite AppData or localStorage.

Next recommended task: Task 5.20 Session Discard Mutation Prototype V1.

### Task 5.20: Session Discard Mutation Prototype V1

Status: Completed in this branch as a dev-only, route-specific prototype for `POST /sessions/active/discard`.

Task 5.20 adds `src/devApi/devApiSessionDiscardConfig.ts`, `src/devApi/devApiSessionDiscardClient.ts`, and `src/devApi/DevApiSessionDiscardPrototype.tsx`, with a minimal guarded mount in `src/App.tsx`.

The prototype is default-off and requires `VITE_IRONPATH_DEV_API_COMPARE === "1"` plus `VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT === "session-discard"`. It preserves source snapshot metadata, idempotency key, request fingerprint, strong confirmation, pending duplicate-submit lock, strict success shape, and snapshot metadata requirements.

Task 5.20 does not change session patch or session complete behavior, does not add DataHealth repair, does not add backup/import/export/reset/recovery HTTP routes, does not add a broad mutation client, does not add API primary runtime, does not switch source of truth, does not write localStorage, does not overwrite AppData, does not add package changes, and does not add production backend/auth/sync/cloud/deployment.

Accepted browser mutation routes are now exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

localStorage remains source of truth. API results never overwrite AppData or localStorage.

Next recommended task: Task 5.21 Session Discard Acceptance / Hardening V1.

### Task 5.21: Session Discard Acceptance / Hardening V1

Status: Completed in this branch as acceptance and hardening coverage for the dev-only `POST /sessions/active/discard` prototype.

Task 5.21 adds `docs/SESSION_DISCARD_ACCEPTANCE_HARDENING.md`, `tests/devApiSessionDiscardAcceptance.test.ts`, `tests/devApiSessionDiscardHardening.test.ts`, `tests/sessionDiscardAcceptanceBoundary.test.ts`, and `tests/sessionDiscardAcceptanceDocsParity.test.ts`.

The coverage locks duplicate discard prevention, missing active session behavior, invalid active session identity, strong confirmation and cancel behavior, write failure, transaction failure, database closed, timeout/unavailable/malformed response handling, missing snapshot metadata, strict no-fake-success behavior, pending lock behavior, confirmation reset behavior, localStorage/AppData integrity, no history write behavior, route boundary, and manual acceptance requirements.

Task 5.21 does not add a browser route, does not add an eighth mutation route, does not add DataHealth repair, does not add backup/import/export/reset/recovery HTTP routes, does not add a broad mutation client, does not add API primary runtime, does not switch source of truth, does not write localStorage, does not overwrite AppData, does not add package changes, and does not add production backend/auth/sync/cloud/deployment.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

localStorage remains source of truth. API results never overwrite AppData or localStorage.

Next recommended task: Task 5.22 Active Session Full Write-path Regression Lock V1.

### Task 5.22: Active Session Full Write-path Regression Lock V1

Status: Completed in this branch as a docs/static regression lock for the full active-session write path.

Task 5.22 adds `docs/ACTIVE_SESSION_FULL_WRITE_PATH_REGRESSION_LOCK.md`, `tests/activeSessionFullWritePathRegressionLock.test.ts`, `tests/activeSessionFullWritePathBoundaryLock.test.ts`, `tests/activeSessionFullWritePathCoverageInventory.test.ts`, and `tests/activeSessionFullWritePathDocsParity.test.ts`.

The lock covers the exact seven-route allowlist, blocked DataHealth repair, backup/import/export, reset/recovery, broad mutation client, eighth-route, production/auth/sync/cloud/deployment boundaries, active-session no-fake-success rules, localStorage/AppData integrity, coverage inventory, manual acceptance inventory, and browser build isolation.

Task 5.22 does not add a browser route, does not add an eighth mutation route, does not add DataHealth repair, does not add backup/import/export/reset/recovery HTTP routes, does not add a broad mutation client, does not implement API-backed persistence, does not add API primary runtime, does not switch source of truth, does not write localStorage, does not overwrite AppData, does not add package changes, and does not add production backend/auth/sync/cloud/deployment.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

localStorage remains source of truth. API results never overwrite AppData or localStorage.

Next recommended task: Task 5.23 API-backed Persistence Facade Plan V1.

### Task 5.23: API-backed Persistence Facade Plan V1

Status: Completed in this branch as a planning-only persistence facade design.

Task 5.23 adds `docs/API_BACKED_PERSISTENCE_FACADE_PLAN.md`, `tests/apiBackedPersistenceFacadePlan.test.ts`, `tests/apiBackedPersistenceFacadeBoundaryStillBlocked.test.ts`, and `tests/apiBackedPersistenceFacadeDocsParity.test.ts`.

The plan defines the future boundary as `App.tsx -> persistence facade -> localStorageAdapter or apiStorageAdapter -> AppData`, keeps localStorage as the default source of truth, keeps API/SQLite source-of-truth behavior blocked until explicit later runtime-source tasks, and defines rollback/fallback gates before any adapter implementation.

Task 5.23 does not implement `src/storage/apiStorageAdapter.ts`, does not add a runtime source selector, does not modify App.tsx, does not switch source of truth, does not replace localStorage, does not add API primary runtime, does not add a browser mutation route, does not add DataHealth repair, does not add backup/import/export/reset/recovery HTTP routes, does not add package changes, and does not add production backend/auth/sync/cloud/deployment.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

localStorage remains source of truth. API results never overwrite AppData or localStorage.

Next recommended task: Task 5.24 API-backed Persistence Adapter Prototype V1.

### Task 5.24: API-backed Persistence Adapter Prototype V1

Status: Completed in this branch as a default-off API storage adapter prototype.

Task 5.24 adds `src/storage/apiStorageAdapter.ts`, `tests/apiStorageAdapter.test.ts`, `tests/apiStorageAdapterBoundary.test.ts`, and `tests/apiStorageAdapterErrorHandling.test.ts`.

The adapter is dev/local-only, requires `VITE_IRONPATH_RUNTIME_SOURCE === "api-primary-dev"`, requires a localhost-only Dev API base URL, exposes route-specific typed read/write facade methods, requires snapshot metadata for write success, and surfaces visible failure for disabled config, invalid target, timeout, unavailable API, malformed response, missing snapshot, and server non-success states.

Task 5.24 does not modify App.tsx, does not wire `loadData` or `saveData`, does not replace localStorage, does not switch source of truth, does not add a runtime source selector, does not add boot-from-API snapshot behavior, does not add API write-through runtime, does not add production backend/auth/sync/cloud/deployment, does not add package changes, does not add DataHealth repair, does not add backup/import/export/reset/recovery HTTP routes, and does not add an eighth browser mutation route.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

localStorage remains source of truth by default. The API storage adapter never silently overwrites AppData or localStorage.

Next recommended task: Task 5.25 Runtime Source Selector Prototype V1.

### Task 5.25: Runtime Source Selector Prototype V1

Status: Completed in this branch as a default-off runtime source selector prototype.

Task 5.25 adds `src/storage/runtimeSourceConfig.ts`, `src/storage/runtimeSourceSelector.ts`, `tests/runtimeSourceConfig.test.ts`, `tests/runtimeSourceSelector.test.ts`, and `tests/runtimeSourceSelectorBoundary.test.ts`.

The selector resolves only `localStorage`, `api-readonly`, and `api-primary-dev`. `localStorage` remains the default and fallback. Non-localStorage modes require development mode, explicit `VITE_IRONPATH_RUNTIME_SOURCE`, and a localhost-only Dev API base URL. `api-readonly` keeps App writes on localStorage. `api-primary-dev` is marked dev/local only and not production-ready.

Task 5.25 does not modify App.tsx, does not wire `loadData` or `saveData`, does not add boot-from-API snapshot behavior, does not add API write-through runtime, does not replace localStorage, does not silently overwrite AppData/localStorage, does not add production backend/auth/sync/cloud/deployment, does not add package changes, does not add DataHealth repair, does not add backup/import/export/reset/recovery HTTP routes, and does not add an eighth browser mutation route.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

localStorage remains source of truth by default and remains fallback/migration source.

Next recommended task: Task 5.26 Boot From API Snapshot Prototype V1.

### Task 5.26: Boot From API Snapshot Prototype V1

Status: Completed in this branch as a guarded API snapshot boot helper.

Task 5.26 adds `src/storage/bootFromApiSnapshot.ts`, `tests/bootFromApiSnapshotPrototype.test.ts`, `tests/bootFromApiSnapshotBoundary.test.ts`, and `tests/bootFromApiSnapshotFailureModes.test.ts`.

The helper requires explicit dev/local `api-primary-dev`, accepts an explicit snapshot reader, validates AppData-shaped payloads and snapshot metadata, validates schema before accepting the payload, never writes localStorage, and returns visible fallback-to-localStorage failures when disabled, unavailable, malformed, missing metadata, or schema-invalid.

Task 5.26 does not modify App.tsx, does not wire `loadData` or `saveData`, does not add a new server route, does not add POST writes, does not add API write-through runtime, does not silently overwrite AppData/localStorage, does not replace localStorage, does not add production backend/auth/sync/cloud/deployment, does not add package changes, does not add DataHealth repair, does not add backup/import/export/reset/recovery HTTP routes, and does not add an eighth browser mutation route.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

localStorage remains the default source of truth and fallback/migration source.

Next recommended task: Task 5.27 API Write-through Runtime Prototype V1.

### Task 5.27: API Write-through Runtime Prototype V1

Status: Completed in this branch as a default-off API write-through runtime helper.

Task 5.27 adds `src/storage/apiWriteThroughRuntime.ts`, `tests/apiWriteThroughRuntimePrototype.test.ts`, `tests/apiWriteThroughRuntimeBoundary.test.ts`, `tests/apiWriteThroughRuntimeFailureModes.test.ts`, and `tests/apiWriteThroughRuntimeLocalStorageIntegrity.test.ts`.

The helper requires explicit dev/local `api-primary-dev`, delegates only to route-specific `apiStorageAdapter` methods, preserves strict no-fake-success and snapshot metadata behavior through the adapter, returns visible failure for disabled/invalid/API failure states, and never reads or writes localStorage.

Task 5.27 does not modify App.tsx, does not wire `loadData` or `saveData`, does not add a broad mutation client, does not add production backend/auth/sync/cloud/deployment, does not add package changes, does not add DataHealth repair, does not add backup/import/export/reset/recovery HTTP routes, and does not add an eighth browser mutation route.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

localStorage remains default runtime source and fallback/migration source.

Next recommended task: Task 5.28 API Primary Runtime Acceptance V1.

### Task 5.28: API Primary Runtime Acceptance V1

Status: Completed in this branch as API primary runtime acceptance documentation and tests.

Task 5.28 adds `docs/API_PRIMARY_RUNTIME_ACCEPTANCE.md`, `tests/apiPrimaryRuntimeAcceptance.test.ts`, `tests/apiPrimaryRuntimeAcceptanceBoundary.test.ts`, and `tests/apiPrimaryRuntimeAcceptanceDocs.test.ts`.

Acceptance covers API primary boot, read, all seven accepted write-through operations, API unavailable behavior, strict no-fake-success behavior, localStorage fallback, route boundary, and manual acceptance inventory.

Task 5.28 does not modify App.tsx, does not wire API primary as default, does not replace localStorage, does not add a browser mutation route, does not add a broad mutation client, does not add production backend/auth/sync/cloud/deployment, does not add package changes, does not add DataHealth repair, does not add backup/import/export/reset/recovery HTTP routes, and does not add an eighth browser mutation route.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

localStorage remains the default runtime source and remains fallback/migration source. API primary remains explicit dev/local `api-primary-dev` only.

Next recommended task: Task 5.29 API Primary Runtime Manual Acceptance V1.

### Task 5.29: API Primary Runtime Manual Acceptance V1

Status: Completed in this branch as a manual App acceptance runbook for API primary dev runtime.

Task 5.29 adds `docs/API_PRIMARY_RUNTIME_MANUAL_ACCEPTANCE.md`, `tests/apiPrimaryRuntimeManualAcceptanceDocs.test.ts`, `tests/apiPrimaryRuntimeManualAcceptanceBoundary.test.ts`, and `tests/apiPrimaryRuntimeManualAcceptanceDocsParity.test.ts`.

The runbook requires a dedicated test browser profile, dedicated dev DB, no real personal training data, explicit `api-primary-dev`, API primary boot/read/all-seven-write checks, API unavailable fallback, localStorage integrity, forbidden network/UI checks, browser build safety, cleanup, and pass/fail template.

Task 5.29 does not modify App.tsx, does not wire API primary as default, does not replace localStorage, does not delete localStorage, does not add a browser mutation route, does not add a broad mutation client, does not add production backend/auth/sync/cloud/deployment, does not add package changes, does not add DataHealth repair, does not add backup/import/export/reset/recovery HTTP routes, and does not add an eighth browser mutation route.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

localStorage remains the default runtime source and remains fallback/migration source. API primary remains explicit dev/local `api-primary-dev` only.

Next recommended task: Task 5.30 API Primary Runtime Hardening V1.

### Task 5.30: API Primary Runtime Hardening V1

Status: Completed in this branch as API primary runtime hardening docs and tests.

Task 5.30 adds `docs/API_PRIMARY_RUNTIME_HARDENING.md`, `tests/apiPrimaryRuntimeHardening.test.ts`, `tests/apiPrimaryRuntimeHardeningBoundary.test.ts`, and `tests/apiPrimaryRuntimeHardeningDocs.test.ts`.

Hardening covers startup race, API unavailable, snapshot mismatch, reload behavior, stale AppData, failure rollback, no silent overwrite, route boundary, and manual retest inventory.

Task 5.30 does not modify App.tsx, does not wire API primary as default, does not replace or delete localStorage, does not add a browser mutation route, does not add a broad mutation client, does not add production backend/auth/sync/cloud/deployment, does not add package changes, does not add DataHealth repair, does not add backup/import/export/reset/recovery HTTP routes, and does not add an eighth browser mutation route.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

localStorage remains the default runtime source and remains fallback/migration source. API primary remains explicit dev/local `api-primary-dev` only.

Next recommended task: Task 5.31 API Primary Runtime Regression Lock V1.

### Task 5.31: API Primary Runtime Regression Lock V1

Status: Completed in this branch as the API primary runtime regression lock.

Task 5.31 adds `docs/API_PRIMARY_RUNTIME_REGRESSION_LOCK.md`, `tests/apiPrimaryRuntimeRegressionLock.test.ts`, `tests/apiPrimaryRuntimeBoundaryLock.test.ts`, `tests/apiPrimaryRuntimeCoverageInventory.test.ts`, and `tests/apiPrimaryRuntimeDocsParity.test.ts`.

The lock proves the runtime source selector works, localStorage fallback works, `api-primary-dev` does not silently pollute localStorage, browser build isolation remains clean, and no production mode is introduced.

Task 5.31 does not modify App.tsx, does not wire API primary as default, does not replace or delete localStorage, does not add a browser mutation route, does not add a broad mutation client, does not add production backend/auth/sync/cloud/deployment, does not add package changes, does not add DataHealth repair, does not add backup/import/export/reset/recovery HTTP routes, and does not add an eighth browser mutation route.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

localStorage remains the default runtime source and remains fallback/migration source. API primary remains explicit dev/local `api-primary-dev` only.

Next recommended task: Task 5.32 LocalStorage to SQLite Migration Dry-run V1.

### Task 5.32: LocalStorage to SQLite Migration Dry-run V1

Status: Completed in this branch as a no-write migration dry-run helper.

Task 5.32 adds `src/storage/localStorageToSqliteMigrationDryRun.ts`, `docs/LOCALSTORAGE_TO_SQLITE_MIGRATION_DRY_RUN.md`, `tests/localStorageToSqliteMigrationDryRun.test.ts`, `tests/localStorageToSqliteMigrationDryRunBoundary.test.ts`, and `tests/localStorageToSqliteMigrationDryRunDocs.test.ts`.

The dry-run validates localStorage AppData, sanitizes and schema-checks payloads, summarizes schema/history/template/active-session/settings state, compares optional API snapshot summary fields as warnings, and keeps `shouldWriteSqlite`, `shouldWriteLocalStorage`, and `shouldSwitchSource` false.

Task 5.32 does not write SQLite, does not write localStorage, does not delete localStorage, does not switch source of truth, does not auto-apply migration, does not modify App.tsx, does not add a browser mutation route, does not add production backend/auth/sync/cloud/deployment, does not add package changes, does not add DataHealth repair, does not add backup/import/export/reset/recovery HTTP routes, and does not add an eighth browser mutation route.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

localStorage remains the default runtime source and remains fallback/migration source. API primary remains explicit dev/local `api-primary-dev` only.

Next recommended task: Task 5.33 LocalStorage to SQLite Migration Apply Prototype V1.

### Task 5.33: LocalStorage to SQLite Migration Apply Prototype V1

Status: Completed in this branch as a dev-only migration apply helper.

Task 5.33 adds `src/storage/localStorageToSqliteMigrationApply.ts`, `docs/LOCALSTORAGE_TO_SQLITE_MIGRATION_APPLY_PROTOTYPE.md`, `tests/localStorageToSqliteMigrationApply.test.ts`, `tests/localStorageToSqliteMigrationApplyBoundary.test.ts`, and `tests/localStorageToSqliteMigrationApplySafety.test.ts`.

The helper requires development mode, `VITE_IRONPATH_MIGRATION_APPLY="localstorage-to-sqlite-apply"`, explicit confirmation, backup metadata, a successful dry-run, and an injected SQLite snapshot writer.

Task 5.33 does not delete localStorage, does not write localStorage, does not auto-switch source of truth, does not modify App.tsx, does not add an HTTP migration endpoint, does not add a browser mutation route, does not add production backend/auth/sync/cloud/deployment, does not add package changes, does not add DataHealth repair, does not add backup/import/export/reset/recovery HTTP routes, and does not add an eighth browser mutation route.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

localStorage remains available as fallback and migration source. API primary remains explicit dev/local `api-primary-dev` only.

Next recommended task: Task 5.34 Migration Acceptance / Manual Acceptance V1.

### Task 5.34: Migration Acceptance / Manual Acceptance V1

Status: Completed in this branch as migration acceptance and manual acceptance coverage.

Task 5.34 adds `docs/MIGRATION_ACCEPTANCE_MANUAL.md`, `tests/migrationAcceptance.test.ts`, `tests/migrationAcceptanceBoundary.test.ts`, and `tests/migrationManualAcceptanceDocs.test.ts`.

Acceptance covers valid localStorage, invalid localStorage, legacy monolith payloads, backup restore expectations, SQLite snapshot read metadata, rollback expectations, dedicated test browser profile, dedicated dev DB, no real personal training data, localStorage preservation, and no automatic source switch.

Task 5.34 does not add runtime behavior, does not delete localStorage, does not write localStorage, does not auto-switch source of truth, does not modify App.tsx, does not add an HTTP migration endpoint, does not add a browser mutation route, does not add production backend/auth/sync/cloud/deployment, does not add package changes, does not add DataHealth repair, does not add backup/import/export/reset/recovery HTTP routes, and does not add an eighth browser mutation route.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

localStorage remains available as fallback and migration source. API primary remains explicit dev/local `api-primary-dev` only.

Next recommended task: Task 5.35 Migration Rollback & Recovery Hardening V1.

### Task 5.35: Migration Rollback & Recovery Hardening V1

Status: Completed in this branch as migration rollback/recovery hardening docs and helper coverage.

Task 5.35 adds `src/storage/migrationRollbackRecovery.ts`, `docs/MIGRATION_ROLLBACK_RECOVERY_HARDENING.md`, `tests/migrationRollbackRecoveryHardening.test.ts`, `tests/migrationRollbackRecoveryHardeningBoundary.test.ts`, and `tests/migrationRollbackRecoveryHardeningDocs.test.ts`.

The helper covers restore localStorage backup, restore dev DB backup, corrupt snapshot handling, schema mismatch handling, clear success/failure state, injected restore callbacks, and no HTTP reset/recovery route.

Task 5.35 does not delete localStorage, does not auto-switch source of truth, does not modify App.tsx, does not add an HTTP reset/recovery route, does not add a browser mutation route, does not add production backend/auth/sync/cloud/deployment, does not add package changes, does not add DataHealth repair, does not add backup/import/export/reset/recovery HTTP routes, and does not add an eighth browser mutation route.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

localStorage remains available as fallback and migration source. API primary remains explicit dev/local `api-primary-dev` only.

Next recommended task: Task 5.36 Migration Regression Lock V1.

### Task 5.36: Migration Regression Lock V1

Status: Completed in this branch as migration regression lock docs and static/runtime-boundary coverage.

Task 5.36 adds `docs/MIGRATION_REGRESSION_LOCK.md`, `tests/migrationRegressionLock.test.ts`, `tests/migrationRegressionBoundaryLock.test.ts`, `tests/migrationRegressionCoverageInventory.test.ts`, and `tests/migrationRegressionDocsParity.test.ts`.

The lock covers dry-run warning-only behavior, backup-first apply, rollback/recovery callback boundaries, corrupt snapshot handling, schema mismatch handling, no destructive import, no silent overwrite, no automatic source switch, and no HTTP migration/reset/recovery surface.

Task 5.36 does not add runtime behavior, does not delete localStorage, does not write localStorage, does not auto-switch source of truth, does not modify App.tsx, does not add an HTTP migration endpoint, does not add a browser mutation route, does not add production backend/auth/sync/cloud/deployment, does not add package changes, does not add DataHealth repair, does not add backup/import/export/reset/recovery HTTP routes, and does not add an eighth browser mutation route.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

localStorage remains default runtime source, fallback, migration source, and emergency backup. API primary remains explicit dev/local `api-primary-dev` only.

Next recommended task: Task 5.37 Phase 5 Final Source-of-truth Audit V1.

### Task 5.37: Phase 5 Final Source-of-truth Audit V1

Status: Completed in this branch as final source-of-truth audit documentation and static boundary coverage.

Task 5.37 adds `docs/PHASE5_FINAL_SOURCE_OF_TRUTH_AUDIT.md`, `tests/phase5FinalSourceOfTruthAudit.test.ts`, and `tests/phase5FinalSourceOfTruthBoundary.test.ts`.

The audit clarifies API primary dev mode status, localStorage fallback status, migration rollback status, production non-readiness, seven accepted browser mutation routes, blocked routes/capabilities, manual acceptance inputs, and browser build isolation.

Task 5.37 does not add runtime behavior, does not delete localStorage, does not silently overwrite localStorage or AppData, does not switch the default runtime source, does not modify App.tsx, does not add an HTTP migration endpoint, does not add a browser mutation route, does not add production backend/auth/sync/cloud/deployment, does not add package changes, does not add DataHealth repair, does not add backup/import/export/reset/recovery HTTP routes, and does not add an eighth browser mutation route.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

localStorage remains default runtime source, fallback, migration source, and emergency backup. API primary remains explicit dev/local `api-primary-dev` only.

Next recommended task: Task 5.38 Phase 5 Final Manual Acceptance V1.

### Task 5.38: Phase 5 Final Manual Acceptance V1

Status: Completed in this branch as final manual acceptance runbook documentation and static boundary coverage.

Task 5.38 adds `docs/PHASE5_FINAL_MANUAL_ACCEPTANCE.md`, `tests/phase5FinalManualAcceptanceDocs.test.ts`, and `tests/phase5FinalManualAcceptanceBoundary.test.ts`.

The runbook covers API primary boot, full workout flow, history edit, data flag, DataHealth dismiss, migration dry-run/apply/rollback, API unavailable fallback, route boundaries, localStorage integrity, AppData integrity, dedicated test browser profile, dedicated dev DB, no real personal training data, cleanup/env reset, and pass/fail recording.

Task 5.38 does not add runtime behavior, does not delete localStorage, does not silently overwrite localStorage or AppData, does not switch the default runtime source, does not modify App.tsx, does not add an HTTP migration endpoint, does not add a browser mutation route, does not add production backend/auth/sync/cloud/deployment, does not add package changes, does not add DataHealth repair, does not add backup/import/export/reset/recovery HTTP routes, and does not add an eighth browser mutation route.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

localStorage remains default runtime source, fallback, migration source, and emergency backup. API primary remains explicit dev/local `api-primary-dev` only.

Next recommended task: Task 5.39 Phase 5 Exit Regression Lock V1.

### Task 5.39: Phase 5 Exit Regression Lock V1

Status: Completed in this branch as Phase 5 exit regression lock documentation and static boundary/coverage parity tests.

Task 5.39 adds `docs/PHASE5_EXIT_REGRESSION_LOCK.md`, `tests/phase5ExitRegressionLock.test.ts`, `tests/phase5ExitBoundaryLock.test.ts`, `tests/phase5ExitCoverageInventory.test.ts`, and `tests/phase5ExitDocsParity.test.ts`.

The lock covers accepted runtime modes, accepted browser mutation routes, blocked routes/capabilities, source-of-truth exit rules, fallback rules, migration rules, browser build isolation, coverage inventory, and Phase 6 handoff-only next step.

Task 5.39 does not add runtime behavior, does not delete localStorage, does not silently overwrite localStorage or AppData, does not make API primary production default, does not modify App.tsx, does not add an HTTP migration endpoint, does not add a browser mutation route, does not add production backend/auth/sync/cloud/deployment, does not add package changes, does not add DataHealth repair, does not add backup/import/export/reset/recovery HTTP routes, and does not add an eighth browser mutation route.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

localStorage remains default runtime source, fallback, migration source, and emergency backup. API primary remains explicit dev/local `api-primary-dev` only.

Next recommended task: Task 5.40 Phase 6 Handoff Plan V1.

### Task 5.40: Phase 6 Handoff Plan V1

Status: Completed in this branch as Phase 6 handoff planning documentation and static boundary tests.

Task 5.40 adds `docs/PHASE6_HANDOFF_PLAN.md`, `tests/phase6HandoffPlan.test.ts`, and `tests/phase6HandoffBoundaryStillBlocked.test.ts`.

The handoff covers production backend, auth, user accounts, cloud sync, deployment, monitoring, privacy/security, Phase 6 entry gates, and the recommended Phase 6 first task.

Task 5.40 does not start Phase 6 implementation, does not add runtime behavior, does not implement production backend/auth/user accounts/cloud sync/deployment/monitoring, does not delete localStorage, does not silently overwrite localStorage or AppData, does not make API primary production default, does not modify App.tsx, does not add a browser mutation route, does not add package changes, does not add DataHealth repair, does not add backup/import/export/reset/recovery HTTP routes, and does not add an eighth browser mutation route.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

Recommended Phase 6 first task after Phase 5 closes: Task 6.1 Production Backend, Auth, Sync & Deployment Architecture Gate V1.

Next recommended Phase 5 task: Task 5.41 Phase 5 Completion Archive V1.

### Task 5.41: Phase 5 Completion Archive V1

Status: Completed in this branch as Phase 5 completion archive documentation and static boundary tests.

Task 5.41 adds `docs/PHASE5_COMPLETION_ARCHIVE.md`, `tests/phase5CompletionArchive.test.ts`, and `tests/phase5CompletionBoundaryStillBlocked.test.ts`.

The archive states Phase 5 is complete, records API primary dev runtime status, localStorage fallback status, migration dry-run/apply/rollback status, final accepted runtime modes, final accepted routes, final blocked routes/capabilities, final validation commands, and the recommended Phase 6 first task.

Task 5.41 does not start Phase 6, does not add runtime behavior, does not implement production backend/auth/user accounts/cloud sync/deployment/monitoring, does not delete localStorage, does not silently overwrite localStorage or AppData, does not make API primary production default, does not modify App.tsx, does not add a browser mutation route, does not add package changes, does not add DataHealth repair, does not add backup/import/export/reset/recovery HTTP routes, and does not add an eighth browser mutation route.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

Recommended next task, only with explicit future approval, is Task 6.1 Production Backend, Auth, Sync & Deployment Architecture Gate V1.

### Task 6.0: Phase 6 Preflight & Production Boundary Lock V1

Status: Completed in this branch as Phase 6 preflight documentation and static boundary tests.

Task 6.0 adds `docs/PHASE6_PREFLIGHT_PRODUCTION_BOUNDARY_LOCK.md`, `tests/phase6PreflightProductionBoundaryLock.test.ts`, `tests/phase6PreflightBoundaryStillBlocked.test.ts`, `tests/phase6PreflightDocsParity.test.ts`, and `tests/phase6PreflightCiRules.test.ts`.

Phase 5 is complete. Phase 6 preflight has started as a boundary lock only.

This task adds no runtime behavior, no production backend/auth/user accounts/cloud sync/deployment/monitoring, no source-of-truth migration, no normalized tables, no package changes, no browser mutation route, no DataHealth repair, and no backup/import/export/reset/recovery HTTP routes.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

Next recommended task: Task 6.1 Production Backend, Auth, Sync & Deployment Architecture Gate V1.

Task 6.1 must be architecture gate only. It must not implement production backend/auth/sync/deployment and must not auto-start from Task 6.0.

### Task 6.1: Production Backend, Auth, Sync & Deployment Architecture Gate V1

Status: Completed in this branch as Phase 6 architecture gate documentation and static boundary tests.

Task 6.1 adds `docs/PRODUCTION_BACKEND_AUTH_SYNC_DEPLOYMENT_ARCHITECTURE_GATE.md`, `tests/productionArchitectureGate.test.ts`, `tests/productionArchitectureBoundaryStillBlocked.test.ts`, `tests/productionArchitectureRiskMatrix.test.ts`, and `tests/productionArchitectureDocsParity.test.ts`.

Phase 6 architecture gating has started. Production backend, production database/storage, auth/user identity, cloud sync, deployment/environment, privacy/security, production migration/rollback, and CI/ruleset categories are evaluated as planning gates only.

This task adds no runtime behavior, no production backend/auth/user accounts/cloud sync/deployment/monitoring, no source-of-truth migration, no normalized tables, no package changes, no browser mutation route, no DataHealth repair, and no backup/import/export/reset/recovery HTTP routes.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

`localStorage` remains default runtime source, fallback, migration source, and emergency backup. `api-primary-dev` remains explicit dev/local only and not production-ready.

Next recommended task: Task 6.2 Production Data Ownership, Privacy & Security Matrix V1.

Task 6.2 must be docs/static tests only. It must not implement production backend/auth/sync/deployment, migration, source-of-truth switching, normalized tables, routes, package changes, or real personal training data use, and must not auto-start from Task 6.1.

### Task 6.2: Production Data Ownership, Privacy & Security Matrix V1

Status: Completed in this branch as Phase 6 production data ownership, privacy, and security matrix documentation and static boundary tests.

Task 6.2 adds `docs/PRODUCTION_DATA_OWNERSHIP_PRIVACY_SECURITY_MATRIX.md`, `tests/productionDataOwnershipPrivacySecurityMatrix.test.ts`, `tests/productionDataOwnershipBoundaryStillBlocked.test.ts`, `tests/productionDataOwnershipPrivacySecurityControls.test.ts`, and `tests/productionDataOwnershipDocsParity.test.ts`.

Task 6.2 classifies production data ownership, privacy, sensitivity, retention, export/delete, backup/restore, logging, sync eligibility, migration risk, and future gates for current and future data domains.

This task adds no runtime behavior, no production backend/auth/user accounts/cloud sync/deployment/monitoring, no source-of-truth migration, no normalized tables, no package changes, no browser mutation route, no DataHealth repair, and no backup/import/export/reset/recovery HTTP routes.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

`localStorage` remains default runtime source, fallback, migration source, and emergency backup. `api-primary-dev` remains explicit dev/local only and not production-ready.

Next recommended task: Task 6.3 Auth & User Account Lifecycle Architecture Gate V1.

Task 6.3 must be docs/static tests only. It must not implement production backend/auth/sync/deployment, migration, source-of-truth switching, normalized tables, routes, package changes, or real personal training data use, and must not auto-start from Task 6.2.

### Task 6.3: Auth & User Account Lifecycle Architecture Gate V1

Status: Completed in this branch as Phase 6 auth and user account lifecycle architecture gate documentation and static boundary tests.

Task 6.3 adds `docs/AUTH_USER_ACCOUNT_LIFECYCLE_ARCHITECTURE_GATE.md`, `tests/authUserAccountLifecycleArchitectureGate.test.ts`, `tests/authUserAccountBoundaryStillBlocked.test.ts`, `tests/authUserAccountDocsParity.test.ts`, and `tests/authUserAccountRiskMatrix.test.ts`.

Task 6.3 defines anonymous local user, future account identity, local data to account linking, account creation lifecycle, account deletion lifecycle, export/delete responsibilities, auth failure behavior, identity mismatch risk, and localStorage fallback boundaries before implementation.

This task adds no runtime behavior, no auth runtime, no login/signup, no OAuth, no token/session handling, no user table, no production backend, no cloud sync, no deployment, no source-of-truth migration, no normalized tables, no package changes, no browser mutation route, no DataHealth repair, and no backup/import/export/reset/recovery HTTP routes.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

`localStorage` remains default runtime source, fallback, migration source, and emergency backup. `api-primary-dev` remains explicit dev/local only and not production-ready.

Next recommended task: Task 6.4 Production Backend & Database Architecture Decision V1.

Task 6.4 must be planning/docs/static tests only. It must not implement production backend, normalized schema, auth, sync, deployment, migration, source-of-truth switching, routes, package changes, or real personal training data use.

### Task 6.4: Production Backend & Database Architecture Decision V1

Status: Completed in this branch as Phase 6 production backend and database architecture decision documentation and static boundary tests.

Task 6.4 adds `docs/PRODUCTION_BACKEND_DATABASE_ARCHITECTURE_DECISION.md`, `tests/productionBackendDatabaseArchitectureDecision.test.ts`, `tests/productionBackendDatabaseBoundaryStillBlocked.test.ts`, and `tests/productionBackendDatabaseDocsParity.test.ts`.

Task 6.4 evaluates no backend yet, single Node backend, serverless API, hosted backend/database, local-first desktop backend, current SQLite snapshot repository, normalized schema risk, migration/rollback requirements, and backup requirements without implementation.

This task adds no runtime behavior, no production backend, no Fastify/Express/Koa/Hono server, no production database, no normalized schema, no migration, no auth, no sync, no deployment, no source-of-truth migration, no package changes, and no browser mutation route.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

`localStorage` remains default runtime source, fallback, migration source, and emergency backup. `api-primary-dev` remains explicit dev/local only and not production-ready.

Next recommended task: Task 6.5 Cloud Sync & Conflict Resolution Architecture Gate V1.

Task 6.5 must be docs/static tests only. It must not implement cloud sync, remote writes, background sync, production backend, auth, deployment, migration, source-of-truth switching, routes, package changes, or real personal training data use.

### Task 6.5: Cloud Sync & Conflict Resolution Architecture Gate V1

Status: Completed in this branch as Phase 6 cloud sync and conflict resolution architecture gate documentation and static boundary tests.

Task 6.5 adds `docs/CLOUD_SYNC_CONFLICT_RESOLUTION_ARCHITECTURE_GATE.md`, `tests/cloudSyncConflictResolutionArchitectureGate.test.ts`, `tests/cloudSyncConflictBoundaryStillBlocked.test.ts`, and `tests/cloudSyncConflictDocsParity.test.ts`.

Task 6.5 evaluates no sync, manual backup sync, single-device cloud backup, multi-device bidirectional sync, conflict detection, conflict merge policy, remote write duplication, and offline queue risk without implementation.

This task adds no runtime behavior, no cloud sync, no remote writes, no background sync worker, no automatic conflict merge, no production backend, no auth, no deployment, no production migration, no source-of-truth migration, no package changes, and no browser mutation route.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

`localStorage` remains default runtime source, fallback, migration source, and emergency backup. `api-primary-dev` remains explicit dev/local only and not production-ready.

Next recommended task: Task 6.6 Deployment, Environment & Secrets Strategy V1.

Task 6.6 must be docs/static tests only. It must not implement deployment, production hosting, secrets runtime, auth, cloud sync, production backend, migration, routes, source-of-truth switching, package changes, or real personal training data use.

### Task 6.6: Deployment, Environment & Secrets Strategy V1

Status: Completed in this branch as Phase 6 deployment, environment, and secrets strategy documentation and static boundary tests.

Task 6.6 adds `docs/DEPLOYMENT_ENVIRONMENT_SECRETS_STRATEGY.md`, `tests/deploymentEnvironmentSecretsStrategy.test.ts`, `tests/deploymentEnvironmentSecretsBoundaryStillBlocked.test.ts`, and `tests/deploymentEnvironmentSecretsDocsParity.test.ts`.

Task 6.6 documents local/dev/staging/production environments, secrets storage, environment variables, branch rules, required checks, Vercel optional behavior for Codex PRs, and rollback strategy without implementation.

This task adds no runtime behavior, no production deployment, no hosted production configuration, no deployment config, no secret values, no secrets runtime, no auth, no cloud sync, no production backend, no migration, no source-of-truth migration, no package changes, and no browser mutation route.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

`localStorage` remains default runtime source, fallback, migration source, and emergency backup. `api-primary-dev` remains explicit dev/local only and not production-ready.

Next recommended task: Task 6.7 Production Migration, Backup & Rollback Strategy V1.

Task 6.7 must be docs/static tests only. It must not implement destructive migration, real-data automation, production source-of-truth switching, routes, deployment, auth, cloud sync, production backend runtime, package changes, or real personal training data use.

### Task 6.7: Production Migration, Backup & Rollback Strategy V1

Status: Completed in this branch as Phase 6 production migration, backup, rollback, and recovery strategy documentation and static boundary tests.

Task 6.7 adds `docs/PRODUCTION_MIGRATION_BACKUP_ROLLBACK_STRATEGY.md`, `tests/productionMigrationBackupRollbackStrategy.test.ts`, `tests/productionMigrationBackupRollbackBoundaryStillBlocked.test.ts`, and `tests/productionMigrationBackupRollbackDocsParity.test.ts`.

Task 6.7 documents backup-first, dry-run, apply, rollback, recovery drill, export/delete implications, no destructive migration, and no real-data automation without implementation.

This task adds no runtime behavior, no migration implementation, no destructive migration, no production source-of-truth migration, no database writes, no normalized tables, no backup/restore runtime, no export/delete runtime, no production backend, no auth, no cloud sync, no deployment, no package changes, and no browser mutation route.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

`localStorage` remains default runtime source, fallback, migration source, and emergency backup. `api-primary-dev` remains explicit dev/local only and not production-ready.

Next recommended task: Task 6.8 Phase 6 Architecture Checkpoint & Boundary Lock V1.

Task 6.8 must be docs/static tests only. It must not implement production backend runtime, auth runtime, sync runtime, deployment runtime, normalized schema, migration runtime, routes, package changes, source-of-truth switching, or real personal training data use.

### Task 6.8: Phase 6 Architecture Checkpoint & Boundary Lock V1

Status: Completed in this branch as Phase 6 architecture checkpoint and boundary lock documentation and static boundary tests.

Task 6.8 adds `docs/PHASE6_ARCHITECTURE_CHECKPOINT_BOUNDARY_LOCK.md`, `tests/phase6ArchitectureCheckpointBoundaryLock.test.ts`, `tests/phase6ArchitectureCheckpointDocsParity.test.ts`, and `tests/phase6ArchitectureCheckpointCoverageInventory.test.ts`.

Task 6.8 locks architecture decisions, still-blocked implementation, source-of-truth status, route allowlist, CI/ruleset policy, and coverage inventory before narrow skeleton planning.

This task adds no runtime behavior, no production backend runtime, no auth runtime, no sync runtime, no deployment runtime, no normalized schema, no migration runtime, no production source-of-truth migration, no package changes, and no browser mutation route.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

`localStorage` remains default runtime source, fallback, migration source, and emergency backup. `api-primary-dev` remains explicit dev/local only and not production-ready.

Next recommended task: Task 6.9 Production Backend Adapter Skeleton Plan V1.

Task 6.9 must be docs/static tests only. It must not implement production backend runtime, auth, deployment, database migration, production runtime activation, routes, package changes, source-of-truth switching, or real personal training data use.

### Task 6.9: Production Backend Adapter Skeleton Plan V1

Status: Completed in this branch as Phase 6 production backend adapter skeleton planning documentation and static boundary tests.

Task 6.9 adds `docs/PRODUCTION_BACKEND_ADAPTER_SKELETON_PLAN.md`, `tests/productionBackendAdapterSkeletonPlan.test.ts`, `tests/productionBackendAdapterBoundaryStillBlocked.test.ts`, and `tests/productionBackendAdapterDocsParity.test.ts`.

Task 6.9 defines backend adapter boundary, request/response shape, environment boundary, no hosted deployment, no auth, no database migration, and no production runtime activation without implementation.

This task adds no runtime behavior, no production backend runtime, no auto-listening server, no hosted deployment, no auth, no database migration, no production runtime activation, no source-of-truth migration, no package changes, and no browser mutation route.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

`localStorage` remains default runtime source, fallback, migration source, and emergency backup. `api-primary-dev` remains explicit dev/local only and not production-ready.

Next recommended task: Task 6.10 Production Backend Adapter Skeleton V1.

Task 6.10 may add a Node-only adapter skeleton only if safe. It must not add auto-listen behavior, deployment, auth, normalized tables, production data use, browser runtime integration, package dependencies, routes, source-of-truth switching, or real personal training data use.

### Task 6.10: Production Backend Adapter Skeleton V1

Status: Completed in this branch as a minimal Node-only production backend adapter skeleton with isolation tests.

Task 6.10 adds `apps/api/src/node/productionBackendAdapter.ts`, `tests/productionBackendAdapterSkeleton.test.ts`, and `tests/productionBackendAdapterIsolation.test.ts`.

The skeleton is inert by default and exposes typed request/response shapes, the existing seven-route browser mutation allowlist, and safe error envelopes. Accepted routes return `ok: false` with `production_backend_not_activated`; unapproved routes return `route_not_allowed`.

This task adds no auto-listen behavior, no Fastify/Express/Koa/Hono server, no deployment, no auth, no normalized tables, no database migration, no production data use, no browser runtime integration, no package changes, no source-of-truth switch, and no browser mutation route.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

`localStorage` remains default runtime source, fallback, migration source, and emergency backup. `api-primary-dev` remains explicit dev/local only and not production-ready.

Next recommended task: Task 6.11 Production Backend Adapter Acceptance V1.

Task 6.11 must not add auth runtime, deployment, auto-listen behavior, database migration, production data use, browser runtime integration, routes, package changes, source-of-truth switching, or real personal training data use.

### Task 6.11: Production Backend Adapter Acceptance V1

Status: Completed in this branch as acceptance and boundary coverage for the Task 6.10 Node-only adapter skeleton.

Task 6.11 adds `docs/PRODUCTION_BACKEND_ADAPTER_ACCEPTANCE.md`, `tests/productionBackendAdapterAcceptance.test.ts`, `tests/productionBackendAdapterBoundaryLock.test.ts`, and `tests/productionBackendAdapterAcceptanceDocsParity.test.ts`.

Task 6.11 accepts the skeleton as Node-only, inert by default, dependency-free, not exported from browser-facing API index files, and safe-error-only with no fake success.

This task adds no runtime activation, no auto-listen behavior, no auth runtime, no deployment runtime, no database migration, no production data use, no browser runtime integration, no package changes, no source-of-truth switch, and no browser mutation route.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

`localStorage` remains default runtime source, fallback, migration source, and emergency backup. `api-primary-dev` remains explicit dev/local only and not production-ready.

Next recommended task: Task 6.12 Auth Boundary & Account Model Plan V1.

Task 6.12 must be docs/static tests only. It must not implement auth runtime, login/signup, token/session handling, OAuth, user table, production backend activation, routes, package changes, source-of-truth switching, or real personal training data use.

### Task 6.12: Auth Boundary & Account Model Plan V1

Status: Completed in this branch as auth boundary and account model planning documentation and static boundary tests.

Task 6.12 adds `docs/AUTH_BOUNDARY_ACCOUNT_MODEL_PLAN.md`, `tests/authBoundaryAccountModelPlan.test.ts`, `tests/authBoundaryStillBlocked.test.ts`, and `tests/authBoundaryDocsParity.test.ts`.

Task 6.12 documents account identity, local user to account mapping, account deletion, export/delete responsibilities, token/session requirements, auth failure behavior, and localStorage fallback without implementation.

This task adds no auth runtime, no login/signup, no token/session handling, no OAuth, no user table, no account linking runtime, no production backend activation, no package changes, no source-of-truth switch, and no browser mutation route.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

`localStorage` remains default runtime source, fallback, migration source, and emergency backup. `api-primary-dev` remains explicit dev/local only and not production-ready.

Next recommended task: Task 6.13 Auth Provider Adapter Skeleton V1.

Task 6.13 may add type/interface-only auth boundary files if safe. It must not implement real auth, login UI, token storage, OAuth, provider integration, dependencies, routes, production backend activation, source-of-truth switching, or real personal training data use.

### Task 6.13: Auth Provider Adapter Skeleton V1

Status: Completed in this branch as type/interface-only auth provider adapter skeleton files and tests.

Task 6.13 adds `src/auth/authProviderTypes.ts`, `src/auth/authBoundary.ts`, and `tests/authProviderAdapterSkeleton.test.ts`.

The skeleton returns a pure unavailable result with `auth_runtime_not_implemented`. It stores no credentials, starts no provider flow, performs no network request, and writes no browser storage.

This task adds no real auth, no login UI, no token storage, no OAuth, no provider integration, no dependencies, no routes, no production backend activation, no package changes, no source-of-truth switch, and no browser mutation route.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

`localStorage` remains default runtime source, fallback, migration source, and emergency backup. `api-primary-dev` remains explicit dev/local only and not production-ready.

Next recommended task: Task 6.14 Auth Account Lifecycle Acceptance V1.

Task 6.14 must be docs/static tests only. It must not implement login/signup runtime, token/session runtime, OAuth, auth provider integration, user table, routes, production backend activation, package changes, source-of-truth switching, or real personal training data use.

### Task 6.14: Auth Account Lifecycle Acceptance V1

Status: Completed in this branch as auth account lifecycle acceptance documentation and static boundary tests.

Task 6.14 adds `docs/AUTH_ACCOUNT_LIFECYCLE_ACCEPTANCE.md`, `tests/authAccountLifecycleAcceptance.test.ts`, `tests/authAccountLifecycleBoundary.test.ts`, and `tests/authAccountLifecycleDocsParity.test.ts`.

Task 6.14 locks no login/signup runtime, no token/session runtime, account lifecycle gates, deletion/export policy, and identity mismatch prevention.

This task adds no login/signup runtime, no token/session runtime, no OAuth, no auth provider integration, no user table, no account lifecycle runtime, no export/delete runtime, no production backend activation, no package changes, no source-of-truth switch, and no browser mutation route.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

`localStorage` remains default runtime source, fallback, migration source, and emergency backup. `api-primary-dev` remains explicit dev/local only and not production-ready.

Next recommended task: Task 6.15 Production Storage Schema Strategy V1.

Task 6.15 must be docs/static tests only. It must not create normalized tables, implement schema migration, perform database writes, use real personal training data, add routes, add dependencies, or switch source of truth.

### Task 6.15: Production Storage Schema Strategy V1

Status: Completed in this branch as production storage schema strategy documentation and static boundary tests.

Task 6.15 adds `docs/PRODUCTION_STORAGE_SCHEMA_STRATEGY.md`, `tests/productionStorageSchemaStrategy.test.ts`, `tests/productionStorageSchemaBoundaryStillBlocked.test.ts`, and `tests/productionStorageSchemaDocsParity.test.ts`.

Task 6.15 documents snapshot repository strategy, normalized schema future risk, migration strategy, rollback, and backup without implementation.

This task adds no schema implementation, no normalized tables, no production database migration, no database writes, no production source-of-truth migration, no production backend activation, no package changes, and no browser mutation route.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

`localStorage` remains default runtime source, fallback, migration source, and emergency backup. `api-primary-dev` remains explicit dev/local only and not production-ready.

Next recommended task: Task 6.16 Production Storage Migration Dry-run Prototype V1.

Task 6.16 may add docs/tests and a pure dry-run utility only if safe. It must not write a database, create schema migration, use real personal training data, add routes, add dependencies, or switch source of truth.

### Task 6.16: Production Storage Migration Dry-run Prototype V1

Status: Completed in this branch as a pure production storage migration dry-run utility with docs/static tests.

Task 6.16 adds `src/storage/productionStorageMigrationDryRun.ts`, `docs/PRODUCTION_STORAGE_MIGRATION_DRY_RUN.md`, `tests/productionStorageMigrationDryRun.test.ts`, `tests/productionStorageMigrationDryRunBoundary.test.ts`, and `tests/productionStorageMigrationDryRunDocsParity.test.ts`.

The utility is inspection-only and returns structured results with `writesPerformed: false`.

This task adds no database write, no schema migration, no normalized tables, no real-data automation, no migration apply, no production source-of-truth migration, no package changes, and no browser mutation route.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

`localStorage` remains default runtime source, fallback, migration source, and emergency backup. `api-primary-dev` remains explicit dev/local only and not production-ready.

Next recommended task: Task 6.17 Production Storage Backup / Restore Acceptance V1.

Task 6.17 must be docs/static tests only. It must not perform real data automation, destructive restore, database writes, route additions, package changes, or source-of-truth switching.

### Task 6.17: Production Storage Backup / Restore Acceptance V1

Status: Completed in this branch as production storage backup/restore acceptance documentation and static boundary tests.

Task 6.17 adds `docs/PRODUCTION_STORAGE_BACKUP_RESTORE_ACCEPTANCE.md`, `tests/productionStorageBackupRestoreAcceptance.test.ts`, `tests/productionStorageBackupRestoreBoundary.test.ts`, and `tests/productionStorageBackupRestoreDocsParity.test.ts`.

Task 6.17 documents backup-first, restore verification, rollback drill, no real data automation, and no destructive restore without implementation.

This task adds no backup runtime, no restore runtime, no destructive restore, no database writes, no migration apply, no production source-of-truth migration, no package changes, and no browser mutation route.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

`localStorage` remains default runtime source, fallback, migration source, and emergency backup. `api-primary-dev` remains explicit dev/local only and not production-ready.

Next recommended task: Task 6.18 Cloud Sync Model Plan V1.

Task 6.18 must be docs/static tests only. It must not implement sync runtime, network writes, cloud writes, background sync, routes, dependencies, or source-of-truth switching.

### Task 6.18: Cloud Sync Model Plan V1

Status: Completed in this branch as cloud sync model planning documentation and static boundary tests.

Task 6.18 adds `docs/CLOUD_SYNC_MODEL_PLAN.md`, `tests/cloudSyncModelPlan.test.ts`, `tests/cloudSyncModelBoundaryStillBlocked.test.ts`, and `tests/cloudSyncModelDocsParity.test.ts`.

Task 6.18 documents sync model, device identity, conflict policy, idempotency, and no sync runtime without implementation.

This task adds no sync runtime, no network writes, no cloud writes, no remote queue, no background sync worker, no conflict merge runtime, no production source-of-truth migration, no package changes, and no browser mutation route.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

`localStorage` remains default runtime source, fallback, migration source, and emergency backup. `api-primary-dev` remains explicit dev/local only and not production-ready.

Next recommended task: Task 6.19 Sync Metadata & Conflict Detector Prototype V1.

Task 6.19 may add pure local sync metadata/conflict detector functions if safe. It must not add network calls, cloud writes, background sync, auth runtime, routes, dependencies, or source-of-truth switching.

### Task 6.19: Sync Metadata & Conflict Detector Prototype V1

Status: Completed in this branch as a pure local sync metadata conflict detector prototype with docs/static tests.

Task 6.19 adds `src/sync/syncConflictDetector.ts`, `docs/SYNC_METADATA_CONFLICT_DETECTOR_PROTOTYPE.md`, `tests/syncConflictDetector.test.ts`, `tests/syncConflictDetectorBoundary.test.ts`, and `tests/syncConflictDetectorDocsParity.test.ts`.

Task 6.19 classifies no conflict, stale client, stale server, divergent edits, deletion conflict, duplicate operation, account mismatch, and invalid metadata from synthetic metadata only.

This task adds no sync runtime, no network calls, no cloud writes, no remote queue, no background sync worker, no automatic merge runtime, no auth runtime, no production source-of-truth migration, no package changes, and no browser mutation route.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

`localStorage` remains default runtime source, fallback, migration source, and emergency backup. `api-primary-dev` remains explicit dev/local only and not production-ready.

Next recommended task: Task 6.20 Sync Conflict Acceptance V1.

Task 6.20 must be docs/static tests only. It must not add remote writes, sync runtime, automatic merge, network calls, cloud provider configuration, auth runtime, routes, dependencies, or source-of-truth switching.

### Task 6.20: Sync Conflict Acceptance V1

Status: Completed in this branch as sync conflict acceptance documentation and static boundary tests.

Task 6.20 adds `docs/SYNC_CONFLICT_ACCEPTANCE.md`, `tests/syncConflictAcceptance.test.ts`, `tests/syncConflictAcceptanceBoundary.test.ts`, and `tests/syncConflictAcceptanceDocsParity.test.ts`.

Task 6.20 accepts detector conflict cases, keeps `canAutoApply` false, blocks automatic merge, blocks remote writes, and requires future user-visible conflict policy before sync runtime.

This task adds no sync runtime, no remote writes, no cloud writes, no network calls, no remote queue, no background sync worker, no automatic merge runtime, no auth runtime, no production source-of-truth migration, no package changes, and no browser mutation route.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

`localStorage` remains default runtime source, fallback, migration source, and emergency backup. `api-primary-dev` remains explicit dev/local only and not production-ready.

Next recommended task: Task 6.21 Production Environment Config Boundary V1.

Task 6.21 must be docs/static tests only. It must not enable production runtime by default, deploy production, add secret values, add routes, add dependencies, or switch source of truth.

### Task 6.21: Production Environment Config Boundary V1

Status: Completed in this branch as production environment config boundary documentation and static tests.

Task 6.21 adds `docs/PRODUCTION_ENVIRONMENT_CONFIG_BOUNDARY.md`, `tests/productionEnvironmentConfigBoundary.test.ts`, and `tests/productionEnvironmentConfigDocsParity.test.ts`.

Task 6.21 documents `local`, `development`, `staging`, and `production` environment names, secrets separation, no secret values, no production deploy, and no runtime production enable by default.

This task adds no deployment implementation, no production runtime enablement, no secret values, no auth provider configuration, no sync provider configuration, no production source-of-truth migration, no package changes, and no browser mutation route.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

`localStorage` remains default runtime source, fallback, migration source, and emergency backup. `api-primary-dev` remains explicit dev/local only and not production-ready.

Next recommended task: Task 6.22 Deployment Runtime Strategy & Staging Plan V1.

Task 6.22 must be docs/static tests only. It must not implement production deployment, hosted production runtime, secret provisioning, routes, dependencies, or source-of-truth switching.

### Task 6.22: Deployment Runtime Strategy & Staging Plan V1

Status: Completed in this branch as deployment runtime strategy and staging plan documentation with static boundary tests.

Task 6.22 adds `docs/DEPLOYMENT_RUNTIME_STRATEGY_STAGING_PLAN.md`, `tests/deploymentRuntimeStrategyStagingPlan.test.ts`, `tests/deploymentRuntimeBoundaryStillBlocked.test.ts`, and `tests/deploymentRuntimeDocsParity.test.ts`.

Task 6.22 documents staging vs production, rollback, preview deployments optional for Codex PRs, IronPath Validation as required, and no production deployment implementation.

This task adds no production deployment, no hosted production runtime, no deployment config, no secret values, no auth provider configuration, no sync provider configuration, no production source-of-truth migration, no package changes, and no browser mutation route.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

`localStorage` remains default runtime source, fallback, migration source, and emergency backup. `api-primary-dev` remains explicit dev/local only and not production-ready.

Next recommended task: Task 6.23 Secrets & Environment Validation Skeleton V1.

Task 6.23 may add a safe environment validation skeleton only if no dependency is needed. It must not add secret values, production deployment, auth provider, sync provider, package changes, routes, or source-of-truth switching.

### Task 6.23: Secrets & Environment Validation Skeleton V1

Status: Completed in this branch as a safe environment validation skeleton with static tests.

Task 6.23 adds `src/config/environmentValidation.ts`, `tests/environmentValidation.test.ts`, and `tests/environmentValidationDocsParity.test.ts`.

The skeleton validates environment names, runtime source boundaries, secret reference placeholders, and production runtime disabled status. It accepts no secret values and performs no network, storage, provider, or deployment behavior.

This task adds no secret values, no production deployment, no auth provider, no sync provider, no package changes, no routes, no production source-of-truth migration, and no browser mutation route.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

`localStorage` remains default runtime source, fallback, migration source, and emergency backup. `api-primary-dev` remains explicit dev/local only and not production-ready.

Next recommended task: Task 6.24 Observability / Logging Privacy Skeleton V1.

Task 6.24 may add a privacy-safe redaction utility only if safe. It must not add an external logging service, dependency, raw AppData logging, localStorage dumps, token/secret logging, routes, or source-of-truth switching.

### Task 6.24: Observability / Logging Privacy Skeleton V1

Status: Completed in this branch as a privacy-safe redaction utility with static tests.

Task 6.24 adds `src/observability/redaction.ts`, `tests/observabilityRedaction.test.ts`, and `tests/observabilityRedactionDocsParity.test.ts`.

The skeleton redacts sensitive keys, long strings, and bearer-like credentials from synthetic log payloads. It performs no network, storage, provider, deployment, or logging service behavior.

This task adds no external logging service, no dependency, no raw AppData logging, no localStorage dump, no token/secret logging, no production monitoring runtime, no routes, no production source-of-truth migration, and no browser mutation route.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

`localStorage` remains default runtime source, fallback, migration source, and emergency backup. `api-primary-dev` remains explicit dev/local only and not production-ready.

Next recommended task: Task 6.25 Production Readiness Security Hardening V1.

Task 6.25 must be docs/static tests and tiny redaction/env validation fixes only. It must not add auth runtime, deployment runtime, sync runtime, routes, dependencies, or source-of-truth switching.

### Task 6.25: Production Readiness Security Hardening V1

Status: Completed in this branch as production readiness security hardening documentation and static boundary tests.

Task 6.25 adds `docs/PRODUCTION_READINESS_SECURITY_HARDENING.md`, `tests/productionReadinessSecurityHardening.test.ts`, `tests/productionReadinessSecurityHardeningBoundary.test.ts`, and `tests/productionReadinessSecurityHardeningDocsParity.test.ts`.

Task 6.25 locks secret leakage controls, sensitive data logging controls, route boundaries, privacy controls, and continued no-auth/no-deployment runtime status.

This task adds no auth runtime, no deployment runtime, no sync runtime, no production backend activation, no production monitoring service, no secret values, no route additions, no package changes, no production source-of-truth migration, and no browser mutation route.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

`localStorage` remains default runtime source, fallback, migration source, and emergency backup. `api-primary-dev` remains explicit dev/local only and not production-ready.

Next recommended task: Task 6.26 Production Manual Acceptance Runbook V1.

Task 6.26 must be docs/static tests only. It must not add production runtime, auth runtime, sync runtime, deployment runtime, package changes, routes, or source-of-truth switching.

### Task 6.26: Production Manual Acceptance Runbook V1

Status: Completed in this branch as production manual acceptance documentation and static boundary tests.

Task 6.26 adds `docs/PRODUCTION_MANUAL_ACCEPTANCE_RUNBOOK.md`, `tests/productionManualAcceptanceRunbook.test.ts`, `tests/productionManualAcceptanceBoundary.test.ts`, and `tests/productionManualAcceptanceDocsParity.test.ts`.

Task 6.26 requires a dedicated test environment, dedicated browser profile, dedicated dev DB where applicable, synthetic data, source-of-truth checks, auth/account if implemented, sync if implemented, backup/export/delete/recovery checks, deployment if implemented, rollback checks, and pass/fail template.

This task adds no production runtime, no auth runtime, no sync runtime, no deployment runtime, no production backend activation, no secret values, no route additions, no package changes, no production source-of-truth migration, and no browser mutation route.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

`localStorage` remains default runtime source, fallback, migration source, and emergency backup. `api-primary-dev` remains explicit dev/local only and not production-ready.

Next recommended task: Task 6.27 Production Rollback & Incident Runbook V1.

Task 6.27 must be docs/static tests only. It must not add runtime incident handling, production deployment, auth runtime, sync runtime, package changes, routes, or source-of-truth switching.

### Task 6.27: Production Rollback & Incident Runbook V1

Status: Completed in this branch as production rollback and incident runbook documentation with static boundary tests.

Task 6.27 adds `docs/PRODUCTION_ROLLBACK_INCIDENT_RUNBOOK.md`, `tests/productionRollbackIncidentRunbook.test.ts`, `tests/productionRollbackIncidentBoundary.test.ts`, and `tests/productionRollbackIncidentDocsParity.test.ts`.

Task 6.27 documents rollback, incident detection, data safety, restore verification, privacy incident handling, and rollback procedure template without implementation.

This task adds no runtime incident handling, no production deployment, no auth runtime, no sync runtime, no production backend activation, no secret values, no route additions, no package changes, no production source-of-truth migration, and no browser mutation route.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

`localStorage` remains default runtime source, fallback, migration source, and emergency backup. `api-primary-dev` remains explicit dev/local only and not production-ready.

Next recommended task: Task 6.28 Production Data Export / Delete Plan V1.

Task 6.28 must be docs/static tests only. It must not add export/delete runtime, account deletion runtime, backup retention runtime, audit retention runtime, package changes, routes, or source-of-truth switching.

### Task 6.28: Production Data Export / Delete Plan V1

Status: Completed in this branch as production data export/delete planning documentation and static boundary tests.

Task 6.28 adds `docs/PRODUCTION_DATA_EXPORT_DELETE_PLAN.md`, `tests/productionDataExportDeletePlan.test.ts`, `tests/productionDataExportDeleteBoundaryStillBlocked.test.ts`, and `tests/productionDataExportDeleteDocsParity.test.ts`.

Task 6.28 plans export, delete, account deletion, backup retention, and audit record retention responsibilities without implementation.

This task adds no export/delete runtime, no account deletion runtime, no backup retention runtime, no audit retention runtime, no secret values, no route additions, no package changes, no production source-of-truth migration, and no browser mutation route.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

`localStorage` remains default runtime source, fallback, migration source, and emergency backup. `api-primary-dev` remains explicit dev/local only and not production-ready.

Next recommended task: Task 6.29 Production Phase Implementation Boundary Lock V1.

Task 6.29 must be docs/static tests only. It must not add production runtime, auth runtime, sync runtime, deployment runtime, package changes, routes, or source-of-truth switching.

### Task 6.29: Production Phase Implementation Boundary Lock V1

Status: Completed in this branch as production phase implementation boundary lock documentation and static boundary tests.

Task 6.29 adds `docs/PRODUCTION_PHASE_IMPLEMENTATION_BOUNDARY_LOCK.md`, `tests/productionPhaseImplementationBoundaryLock.test.ts`, `tests/productionPhaseImplementationBoundary.test.ts`, and `tests/productionPhaseImplementationDocsParity.test.ts`.

Task 6.29 locks accepted capabilities, planned-only capabilities, blocked capabilities, route allowlist, source-of-truth status, and auth/sync/deployment status.

This task adds no production runtime, no auth runtime, no sync runtime, no deployment runtime, no secret values, no route additions, no package changes, no production source-of-truth migration, and no browser mutation route.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

`localStorage` remains default runtime source, fallback, migration source, and emergency backup. `api-primary-dev` remains explicit dev/local only and not production-ready.

Next recommended task: Task 6.30 Production Release Readiness Checkpoint V1.

Task 6.30 must be docs/static tests only. It must not add production runtime, auth runtime, sync runtime, deployment runtime, package changes, routes, or source-of-truth switching.

### Task 6.30: Production Release Readiness Checkpoint V1

Status: Completed in this branch as production release readiness checkpoint documentation and static tests.

Task 6.30 adds `docs/PRODUCTION_RELEASE_READINESS_CHECKPOINT.md`, `tests/productionReleaseReadinessCheckpoint.test.ts`, `tests/productionReleaseReadinessBoundary.test.ts`, and `tests/productionReleaseReadinessDocsParity.test.ts`.

Task 6.30 checkpoints implemented production capabilities, still blocked production capabilities, auth/account status, backend status, sync status, deployment status, source-of-truth status, data migration status, privacy/security status, rollback status, and CI/ruleset status.

This task adds no production runtime, no auth runtime, no sync runtime, no deployment runtime, no secret values, no route additions, no package changes, no production source-of-truth migration, and no browser mutation route.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

`localStorage` remains default runtime source, fallback, migration source, and emergency backup. `api-primary-dev` remains explicit dev/local only and not production-ready.

Next recommended task: Task 6.31 Production Manual Acceptance Runbook V1.

Task 6.31 must be docs/static tests only. It must not add production runtime, auth runtime, sync runtime, deployment runtime, package changes, routes, or source-of-truth switching.

### Task 6.31: Production Manual Acceptance Runbook V1

Status: Completed in this branch as final production manual acceptance runbook alignment and static tests.

Task 6.31 updates `docs/PRODUCTION_MANUAL_ACCEPTANCE_RUNBOOK.md`, `tests/productionManualAcceptanceRunbook.test.ts`, `tests/productionManualAcceptanceBoundary.test.ts`, and `tests/productionManualAcceptanceDocsParity.test.ts`.

Task 6.31 records final manual acceptance expectations for dedicated test environment, no real personal data, source-of-truth checks, auth/account if implemented, sync if implemented, backup/export/delete/recovery checks, deployment if implemented, rollback checks, and privacy/security checks.

This task adds no production runtime, no auth runtime, no sync runtime, no deployment runtime, no secret values, no route additions, no package changes, no production source-of-truth migration, and no browser mutation route.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

`localStorage` remains default runtime source, fallback, migration source, and emergency backup. `api-primary-dev` remains explicit dev/local only and not production-ready.

Next recommended task: Task 6.32 Production Security & Privacy Final Hardening V1.

Task 6.32 must be docs/static tests and narrow privacy/security fixes only. It must not add a new auth provider, sync engine, production deployment surface, route, package dependency, package script, lockfile change, production source-of-truth switch, or real-data migration.

### Task 6.32: Production Security & Privacy Final Hardening V1

Status: Completed in this branch as final security/privacy hardening documentation and static tests.

Task 6.32 adds `docs/PRODUCTION_SECURITY_PRIVACY_FINAL_HARDENING.md`, `tests/productionSecurityPrivacyFinalHardening.test.ts`, `tests/productionSecurityPrivacyBoundary.test.ts`, and `tests/productionSecurityPrivacyDocsParity.test.ts`.

Task 6.32 locks secret leakage controls, sensitive data logging controls, privacy controls, route boundaries, source-of-truth boundaries, and final hardening checks. Raw AppData logging is blocked. localStorage dump logging is blocked. Token and secret logging is blocked. Automated checks remain synthetic data only.

This task adds no production runtime, no auth runtime, no sync runtime, no deployment runtime, no monitoring service, no secret values, no route additions, no package changes, no production source-of-truth migration, and no browser mutation route.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

`localStorage` remains default runtime source, fallback, migration source, and emergency backup. `api-primary-dev` remains explicit dev/local only and not production-ready.

Next recommended task: Task 6.33 Production Backup, Export, Delete & Recovery Acceptance V1.

Task 6.33 must be docs/static tests only. It must not add destructive automated real-data operations, backup/import/export HTTP routes, reset/recovery HTTP routes, package changes, source-of-truth switching, or real-data migration.

### Task 6.33: Production Backup, Export, Delete & Recovery Acceptance V1

Status: Completed in this branch as production backup/export/delete/recovery acceptance documentation and static tests.

Task 6.33 adds `docs/PRODUCTION_BACKUP_EXPORT_DELETE_RECOVERY_ACCEPTANCE.md`, `tests/productionBackupExportDeleteRecoveryAcceptance.test.ts`, `tests/productionBackupExportDeleteRecoveryBoundary.test.ts`, and `tests/productionBackupExportDeleteRecoveryDocsParity.test.ts`.

Task 6.33 documents export policy acceptance, delete policy acceptance, account deletion implications if accounts exist, backup-first rule, restore verification, rollback drill, no destructive automated real-data operation, and no silent overwrite.

This task adds no backup runtime, no export runtime, no delete runtime, no recovery runtime, no destructive automated real-data operation, no backup/import/export HTTP route, no reset/recovery HTTP route, no route additions, no package changes, no production source-of-truth migration, and no browser mutation route.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

`localStorage` remains default runtime source, fallback, migration source, and emergency backup. `api-primary-dev` remains explicit dev/local only and not production-ready.

Next recommended task: Task 6.34 Production Sync / Conflict Final Audit V1.

Task 6.34 must be docs/static tests only. It must not add sync runtime, network writes, cloud writes, background sync workers, remote write queues, package changes, source-of-truth switching, or real-data migration.

### Task 6.34: Production Sync / Conflict Final Audit V1

Status: Completed in this branch as production sync/conflict final audit documentation and static tests.

Task 6.34 adds `docs/PRODUCTION_SYNC_CONFLICT_FINAL_AUDIT.md`, `tests/productionSyncConflictFinalAudit.test.ts`, `tests/productionSyncConflictBoundary.test.ts`, and `tests/productionSyncConflictDocsParity.test.ts`.

Task 6.34 audits no sync runtime, sync scope if implemented later, conflict model, idempotency, duplicate cloud write prevention, offline behavior, source-of-truth rules, rollback, and route boundaries.

This task adds no sync runtime, no network writes, no cloud writes, no background sync worker, no remote write queue, no automatic merge runtime, no route additions, no package changes, no production source-of-truth migration, and no browser mutation route.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

`localStorage` remains default runtime source, fallback, migration source, and emergency backup. `api-primary-dev` remains explicit dev/local only and not production-ready.

Next recommended task: Task 6.35 Production Deployment & Environment Final Audit V1.

Task 6.35 must be docs/static tests only. It must not add production deployment, deployment config that changes production behavior, secret values, package changes, routes, source-of-truth switching, or real-data migration.

### Task 6.35: Production Deployment & Environment Final Audit V1

Status: Completed in this branch as production deployment/environment final audit documentation and static tests.

Task 6.35 adds `docs/PRODUCTION_DEPLOYMENT_ENVIRONMENT_FINAL_AUDIT.md`, `tests/productionDeploymentEnvironmentFinalAudit.test.ts`, `tests/productionDeploymentEnvironmentBoundary.test.ts`, and `tests/productionDeploymentEnvironmentDocsParity.test.ts`.

Task 6.35 audits environments, secrets, branch rules, required checks, rollback, preview vs production distinction, no Vercel required check assumption for Codex PRs, and no deployment if deployment was not implemented.

This task adds no production deployment, no deployment config that changes production behavior, no hosted backend activation, no secret values, no route additions, no package changes, no production source-of-truth migration, and no browser mutation route.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

`localStorage` remains default runtime source, fallback, migration source, and emergency backup. `api-primary-dev` remains explicit dev/local only and not production-ready.

Next recommended task: Task 6.36 Production Monitoring & Logging Privacy Lock V1.

Task 6.36 must be docs/static tests only. It must not add external monitoring service, production telemetry runtime, package changes, routes, source-of-truth switching, or real-data logging.

### Task 6.36: Production Monitoring & Logging Privacy Lock V1

Status: Completed in this branch as production monitoring/logging privacy lock documentation and static tests.

Task 6.36 adds `docs/PRODUCTION_MONITORING_LOGGING_PRIVACY_LOCK.md`, `tests/productionMonitoringLoggingPrivacyLock.test.ts`, `tests/productionMonitoringLoggingBoundary.test.ts`, and `tests/productionMonitoringLoggingDocsParity.test.ts`.

Task 6.36 locks sensitive data redaction, no raw AppData logging, no localStorage dump logging, no token or secret logging, privacy-safe diagnostics, and future observability gates.

This task adds no external monitoring service, no production telemetry runtime, no analytics runtime, no route additions, no package changes, no production source-of-truth migration, and no browser mutation route.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

`localStorage` remains default runtime source, fallback, migration source, and emergency backup. `api-primary-dev` remains explicit dev/local only and not production-ready.

Next recommended task: Task 6.37 Production Release Candidate Regression Lock V1.

Task 6.37 must be docs/static tests only. It must not add production runtime, auth runtime, sync runtime, deployment runtime, package changes, routes, source-of-truth switching, or real-data migration.

### Task 6.37: Production Release Candidate Regression Lock V1

Status: Completed in this branch as production release candidate regression lock documentation and static tests.

Task 6.37 adds `docs/PRODUCTION_RELEASE_CANDIDATE_REGRESSION_LOCK.md`, `tests/productionReleaseCandidateRegressionLock.test.ts`, `tests/productionReleaseCandidateBoundary.test.ts`, `tests/productionReleaseCandidateCoverageInventory.test.ts`, and `tests/productionReleaseCandidateDocsParity.test.ts`.

Task 6.37 locks accepted production capabilities, blocked capabilities, source-of-truth rules, auth/sync/deployment status, migration/rollback status, CI/ruleset status, browser build isolation, no unapproved routes, and coverage inventory.

This task adds no production runtime, no auth runtime, no sync runtime, no deployment runtime, no monitoring runtime, no route additions, no package changes, no production source-of-truth migration, and no browser mutation route.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

`localStorage` remains default runtime source, fallback, migration source, and emergency backup. `api-primary-dev` remains explicit dev/local only and not production-ready.

Next recommended task: Task 6.38 Phase 6 Final Manual Acceptance V1.

Task 6.38 must be docs/static tests only. It must not add production runtime, auth runtime, sync runtime, deployment runtime, package changes, routes, source-of-truth switching, or real-data migration.

### Task 6.38: Phase 6 Final Manual Acceptance V1

Status: Completed in this branch as Phase 6 final manual acceptance documentation and static tests.

Task 6.38 adds `docs/PHASE6_FINAL_MANUAL_ACCEPTANCE.md`, `tests/phase6FinalManualAcceptanceDocs.test.ts`, `tests/phase6FinalManualAcceptanceBoundary.test.ts`, and `tests/phase6FinalManualAcceptanceDocsParity.test.ts`.

Task 6.38 documents the production readiness scenario matrix, local/dev fallback, source-of-truth checks, auth/account if implemented, sync if implemented, backup/export/delete/recovery, deployment if implemented, rollback, and pass/fail template.

This task adds no production runtime, no auth runtime, no sync runtime, no deployment runtime, no monitoring runtime, no route additions, no package changes, no production source-of-truth migration, and no browser mutation route.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

`localStorage` remains default runtime source, fallback, migration source, and emergency backup. `api-primary-dev` remains explicit dev/local only and not production-ready.

Next recommended task: Task 6.39 Phase 6 Exit Regression Lock V1.

Task 6.39 must be docs/static tests only. It must not add production runtime, auth runtime, sync runtime, deployment runtime, package changes, routes, source-of-truth switching, real-data migration, or Phase 7 work.

### Task 6.39: Phase 6 Exit Regression Lock V1

Status: Completed in this branch as Phase 6 exit regression lock documentation and static tests.

Task 6.39 adds `docs/PHASE6_EXIT_REGRESSION_LOCK.md`, `tests/phase6ExitRegressionLock.test.ts`, `tests/phase6ExitBoundaryLock.test.ts`, `tests/phase6ExitCoverageInventory.test.ts`, and `tests/phase6ExitDocsParity.test.ts`.

Task 6.39 locks final Phase 6 accepted capabilities, final blocked capabilities, final source-of-truth status, final auth/sync/deployment status, final migration/rollback status, final route allowlist, final CI/ruleset policy, and no Phase 7 auto-start.

This task adds no Phase 7 work, no production runtime, no auth runtime, no sync runtime, no deployment runtime, no monitoring runtime, no route additions, no package changes, no production source-of-truth migration, and no browser mutation route.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

`localStorage` remains default runtime source, fallback, migration source, and emergency backup. `api-primary-dev` remains explicit dev/local only and not production-ready.

Next recommended task: Task 6.40 Phase 6 Completion Archive V1.

Task 6.40 must be docs/static tests only. It must not start Phase 7, Task 6.41, production runtime implementation, auth runtime, sync runtime, deployment runtime, source-of-truth switching, routes, package changes, or real-data migration.

### Task 6.40: Phase 6 Completion Archive V1

Status: Completed in this branch as Phase 6 completion archive documentation and static tests.

Task 6.40 adds `docs/PHASE6_COMPLETION_ARCHIVE.md`, `tests/phase6CompletionArchive.test.ts`, and `tests/phase6CompletionBoundaryStillBlocked.test.ts`.

Task 6.40 states Phase 6 complete, production readiness status, source-of-truth status, auth/account status, sync status, deployment status, privacy/security status, migration/backup/recovery status, final accepted routes, final blocked routes, final validation commands, final CI/ruleset policy, and recommended next task only.

This task adds no Phase 7 work, no Task 6.41 work, no production runtime, no auth runtime, no sync runtime, no deployment runtime, no monitoring runtime, no route additions, no package changes, no production source-of-truth migration, and no browser mutation route.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

`localStorage` remains default runtime source, fallback, migration source, and emergency backup. `api-primary-dev` remains explicit dev/local only and not production-ready.

Recommended next task: Phase 7 Task 7.1 Production Runtime Implementation Authorization Gate V1.

Do not auto-start Phase 7. Do not auto-start Task 6.41.

### Task 7.1: Production Runtime Implementation Authorization Gate V1

Status: Phase 7 starts with a docs/static authorization gate.

Task 7.1 adds `docs/PHASE7_PRODUCTION_RUNTIME_IMPLEMENTATION_AUTHORIZATION_GATE.md` and `tests/phase7ProductionRuntimeAuthorizationGate.test.ts`.

This task records Task 6.40 / PR #152 / merge commit `790c49d`, preserves `localStorage` as default/fallback/migration/emergency source, preserves `api-primary-dev` as explicit dev/local only, and authorizes no production backend/auth/sync/deployment/monitoring/source-of-truth implementation.

Next recommended task: Task 7.2 Production Runtime Contract Scaffold Authorization V1. Task 7.2 is not started by Task 7.1.

### Task 7.2: Production Runtime Contract Scaffold Authorization V1

Status: Production contract scaffold authorization documentation and static tests.

Task 7.2 adds `docs/PRODUCTION_RUNTIME_CONTRACT_SCAFFOLD_AUTHORIZATION.md` and `tests/productionRuntimeContractScaffoldAuthorization.test.ts`.

This task defines candidate contract areas and blocked runtime surfaces without implementing backend runtime, auth, sync, deployment, monitoring, route additions, package changes, or source-of-truth switching.

Next recommended task: Task 7.3 Production Route Surface Freeze V1. Task 7.3 is not started by Task 7.2.

### Task 7.3: Production Route Surface Freeze V1

Status: Production route surface freeze documentation and static tests.

Task 7.3 adds `docs/PRODUCTION_ROUTE_SURFACE_FREEZE.md` and `tests/productionRouteSurfaceFreeze.test.ts`.

This task freezes the accepted seven browser mutation routes, documents read route candidates as candidates only, and keeps blocked route surfaces blocked without adding routes or runtime behavior.

Next recommended task: Task 7.4 Production Source-of-Truth Migration Preconditions V1. Task 7.4 is not started by Task 7.3.

### Task 7.4: Production Source-of-Truth Migration Preconditions V1

Status: Production source-of-truth migration preconditions documentation and static tests.

Task 7.4 adds `docs/PRODUCTION_SOURCE_OF_TRUTH_MIGRATION_PRECONDITIONS.md` and `tests/productionSourceOfTruthMigrationPreconditions.test.ts`.

This task defines backend, auth, ownership, backup/export, rollback, dry-run, localStorage emergency backup, confirmation, diagnostics, manual acceptance, privacy, and route-freeze preconditions. It does not authorize a source-of-truth switch.

Next recommended task: Task 7.5 Production Auth & User Data Boundary Plan V1. Task 7.5 is not started by Task 7.4.

### Task 7.5: Production Auth & User Data Boundary Plan V1

Status: Production auth/user data boundary documentation and static tests.

Task 7.5 adds `docs/PRODUCTION_AUTH_USER_DATA_BOUNDARY_PLAN.md` and `tests/productionAuthUserDataBoundaryPlan.test.ts`.

This task documents auth, user identity, data ownership, local data association, cloud sync dependency, source-of-truth dependency, privacy, and synthetic test-data boundaries without implementing auth or account runtime.

Next recommended task: Task 7.6 Production Backend Architecture Decision V1. Task 7.6 is not started by Task 7.5.

### Task 7.6: Production Backend Architecture Decision V1

Status: Production backend architecture decision documentation and static tests.

Task 7.6 adds `docs/PRODUCTION_BACKEND_ARCHITECTURE_DECISION.md` and `tests/productionBackendArchitectureDecision.test.ts`.

This task rejects dev API production promotion and keeps production backend/runtime implementation, auth, sync, deployment, monitoring, database/schema changes, routes, package changes, and source-of-truth switching blocked.

Next recommended task: Task 7.7 Production Runtime Skeleton Authorization V1. Task 7.7 is not started by Task 7.6.

### Task 7.7: Production Runtime Skeleton Authorization V1

Status: Production runtime skeleton authorization documentation and static tests.

Task 7.7 adds `docs/PRODUCTION_RUNTIME_SKELETON_AUTHORIZATION.md` and `tests/productionRuntimeSkeletonAuthorization.test.ts`.

This task authorizes only future skeleton rules, not a skeleton implementation. It keeps live backend, auth, sync, deployment, monitoring, source-of-truth switch, routes, normalized tables, destructive migration, and package changes blocked.

Next recommended task: Task 7.8 Frontend Runtime Selector Production Guard V1. Task 7.8 is not started by Task 7.7.

### Task 7.8: Frontend Runtime Selector Production Guard V1

Status: Frontend runtime selector production guard documentation and static tests.

Task 7.8 adds `docs/FRONTEND_RUNTIME_SELECTOR_PRODUCTION_GUARD.md` and `tests/frontendRuntimeSelectorProductionGuard.test.ts`.

This task documents env-var safety, production build safety, Vercel preview/production boundary, dev API source-of-truth prevention, route boundaries, and dist token expectations without changing runtime behavior.

Next recommended task: Task 7.9 Production Release Readiness Checklist V1. Task 7.9 is not started by Task 7.8.

### Task 7.9: Production Release Readiness Checklist V1

Status: Production release readiness checklist documentation and static tests.

Task 7.9 adds `docs/PRODUCTION_RELEASE_READINESS_CHECKLIST.md` and `tests/productionReleaseReadinessChecklist.test.ts`.

This task records required readiness areas before future production runtime or source-of-truth release. It does not authorize implementation or production source-of-truth switching.

Next recommended task: Task 7.10 Phase 7 Completion Archive V1. Task 7.10 is not started by Task 7.9.

### Task 7.10: Phase 7 Completion Archive V1

Status: Phase 7 completion archive documentation and static tests.

Task 7.10 adds `docs/PHASE7_COMPLETION_ARCHIVE.md` and `tests/phase7CompletionArchive.test.ts`.

This task archives Phase 7 completion, records completed Task 7.1-7.9 evidence, records validation evidence, preserves localStorage/api-primary-dev boundaries, confirms accepted routes remain exactly seven, and recommends Task 8.1 only. Phase 8 is not started automatically.

### Task 8.1: Production Runtime Implementation Entry Gate V1

Status: Phase 8 implementation entry gate documentation and static tests.

Task 8.1 adds `docs/PHASE8_PRODUCTION_RUNTIME_IMPLEMENTATION_ENTRY_GATE.md`, `tests/phase8ProductionRuntimeImplementationEntryGate.test.ts`, and `tests/phase8ProductionRuntimeBoundaryStillBlocked.test.ts`.

This task opens Phase 8 for narrow explicit implementation categories only. It does not add runtime code, production backend/auth/sync/deployment/monitoring, source-of-truth switching, routes, package changes, lockfile changes, normalized tables, destructive migration, or real personal training data.

### Task 8.2: Production Runtime Skeleton Boundary V1

Status: Inert Node-only production runtime skeleton boundary.

Task 8.2 adds `apps/api/src/node/productionRuntimeSkeleton.ts`, `docs/PRODUCTION_RUNTIME_SKELETON_BOUNDARY.md`, and `tests/productionRuntimeSkeletonBoundary.test.ts`.

This task creates disabled/scaffold-only production runtime capability objects without browser-facing export, server listener, real data access, production persistence, source-of-truth switching, auth, sync, deployment, monitoring, routes, package changes, or normalized tables.

### Task 8.3: Production Runtime Config Guard V1

Status: Node-only fail-closed production runtime config guard.

Task 8.3 adds `apps/api/src/node/productionRuntimeConfig.ts`, `docs/PRODUCTION_RUNTIME_CONFIG_GUARD.md`, and `tests/productionRuntimeConfigGuard.test.ts`.

This task rejects dev/local runtime promotion, `api-primary-dev` production use, localhost/dev API backend URLs, missing required config, and secret values. It does not activate production runtime, add routes, add frontend runtime switching, switch source-of-truth, add package changes, or implement backend/auth/sync/deployment/monitoring.

### Task 8.4: Production Health & Capability Endpoint V1

Status: Node-only health/capability route-like handlers.

Task 8.4 adds `apps/api/src/node/productionRuntimeRoutes.ts`, `docs/PRODUCTION_HEALTH_CAPABILITY_ENDPOINT.md`, and `tests/productionHealthCapabilityEndpoint.test.ts`.

This task supports plain function handling for `GET /health` and `GET /capabilities` only. It does not register HTTP routes, auto-listen, add browser mutation routes, connect to real data, perform writes, switch source-of-truth, add deployment config, add package changes, or implement auth/sync/monitoring.

### Task 8.5: Production Persistence Strategy Adapter V1

Status: Production persistence adapter boundary with synthetic in-memory test adapter.

Task 8.5 adds `apps/api/src/node/productionPersistence.ts`, `docs/PRODUCTION_PERSISTENCE_STRATEGY_ADAPTER.md`, and `tests/productionPersistenceStrategyAdapter.test.ts`.

This task defines read-oriented persistence interfaces and a fake adapter for synthetic tests only. It does not add a real database, ORM, normalized schema, migrations, node:sqlite import, sqliteRepository production promotion, backend source-of-truth writes, package dependencies, or real personal data.

### Task 8.6: Production Read Contract Implementation V1

Status: Minimal Node-only production read contract route-like handling.

Task 8.6 adds `apps/api/src/node/productionReadContract.ts`, `docs/PRODUCTION_READ_CONTRACT_IMPLEMENTATION.md`, and `tests/productionReadContractImplementation.test.ts`.

This task handles approved GET read candidates through the production persistence adapter with synthetic tests only. It does not add write routes, mutation routes, App runtime integration, real database access, source-of-truth switching, package changes, auth, sync, deployment, monitoring, or real personal data.

### Task 8.7: Frontend Production API Client Skeleton V1

Status: Disabled-by-default browser-safe production API client skeleton.

Task 8.7 adds `src/productionApi/productionApiClient.ts`, `src/productionApi/productionApiConfig.ts`, `docs/FRONTEND_PRODUCTION_API_CLIENT_SKELETON.md`, and `tests/productionApiClientSkeleton.test.ts`.

This task supports explicit opt-in read/capability calls only. It does not integrate with App runtime, expose mutation methods, write to backend, replace localStorage, switch source-of-truth, import Node-only modules, add routes, add package changes, or add auth/sync behavior.

### Task 8.8: Production Dual-Read Comparison V1

Status: Diagnostic-only production dual-read comparison logic.

Task 8.8 adds `src/productionApi/productionDualReadComparison.ts`, `docs/PRODUCTION_DUAL_READ_COMPARISON.md`, and `tests/productionDualReadComparison.test.ts`.

This task compares local read values with production API read values only when explicitly enabled. It is non-blocking, never mutates local data, never writes backend data, never calls mutation routes, does not integrate with App runtime, and does not switch source-of-truth.

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
