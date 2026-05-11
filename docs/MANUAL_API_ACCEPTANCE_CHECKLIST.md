# Manual API Acceptance Checklist

This checklist is for manually accepting the dev-only local API stack:

`local Node HTTP server -> httpRuntimeAdapter -> serverAdapter -> sqliteRepository`

It is a manual local development checklist, not a production backend checklist.

Task 4.13 adds automated smoke coverage for the highest-risk items in this checklist. The manual checklist remains a human acceptance procedure and does not require a package script or App/UI integration.

Task 4.14 records local API runner strategy. Task 4.15 adds a dev-only compiled runner prototype; it is still not App/UI integration or production backend readiness.

Task 4.16 adds the focused runner runbook at `docs/DEV_API_RUNNER_MANUAL_ACCEPTANCE.md`. Use that document for real `npm run api:dev` command acceptance; this checklist remains the broader local API boundary checklist and is still not App runtime migration.

Task 4.17 adds the dev DB recovery/reset checklist at `docs/DEV_API_RECOVERY_RESET.md`. It is a Node-only/programmatic safety boundary, not an HTTP reset endpoint.

Task 4.18 adds the App runtime migration readiness audit at `docs/APP_RUNTIME_MIGRATION_READINESS_AUDIT.md`. The audit result is that App runtime migration remains blocked; this checklist does not authorize App.tsx integration.

Task 4.19 adds the read-only App integration plan at `docs/DEV_API_READONLY_APP_INTEGRATION_PLAN.md`. It is still planning-only: no App.tsx integration, no frontend API client, no feature flag runtime, and no localStorage replacement.

Task 4.20 adds a dev-only, explicit opt-in read-only App comparison prototype. It is diagnostic-only: localStorage remains source of truth, API results never overwrite App data, and no App mutation routes are called.

Task 4.21 marks read-only runtime parity accepted only for dev diagnostics. It confirms flag-off parity, GET-only reads, API unavailable fallback, mismatch diagnostics-only behavior, localStorage integrity, diagnostics UI safety, and browser isolation. It does not authorize write-path migration or production readiness.

Task 4.22 hardens read-only diagnostics UX for dev-only comparison. The panel is clearer and safer, but it remains read-only diagnostics only: localStorage remains source of truth, no data is changed by mismatch, and production readiness is not implied.

Task 4.23 adds the read-only App manual acceptance runbook at `docs/READONLY_APP_MANUAL_ACCEPTANCE.md`. It is for dev-only diagnostics acceptance and does not imply production readiness or write-path migration readiness.

Task 4.24 adds the mutation integration readiness audit at `docs/MUTATION_INTEGRATION_READINESS_AUDIT.md`. The result is not ready for mutation integration; write-path integration remains blocked and the next step is planning-only source-of-truth/offline strategy work.

Task 4.25 adds the write-path source-of-truth and offline strategy at `docs/WRITE_PATH_SOURCE_OF_TRUTH_OFFLINE_STRATEGY.md`. It is planning-only: source-of-truth remains localStorage, no offline mutation queue exists yet, and write-path migration remains blocked.

Task 4.26 adds mutation UX confirmation and rollback planning at `docs/MUTATION_UX_CONFIRMATION_ROLLBACK_PLAN.md`. It is planning-only and does not authorize App writes, mutation client work, or write-path migration.

Task 4.27 adds the lowest-risk mutation prototype plan at `docs/LOWEST_RISK_MUTATION_PROTOTYPE_PLAN.md`. It is planning-only: DataHealth issue dismiss is only a future candidate, and the plan does not authorize App writes or mutation client work.

Task 4.28 adds a dev-only, explicit opt-in, one-route DataHealth dismiss mutation prototype. It only allows `POST /data-health/issues/:issueId/dismiss` under the mutation experiment flag, keeps localStorage as source of truth, requires snapshot metadata before success, and does not imply production readiness or broader write-path migration.

Task 4.32 adds safe observability and manual recovery notes for the existing one-route DataHealth dismiss prototype. It adds no endpoint, no browser reset action, no production readiness, no source-of-truth switch, and no new mutation route.

Task 4.33 adds a regression lock for the DataHealth dismiss line. It is tests/docs hardening only and does not add runtime capability, another mutation route, production readiness, or write-path migration.

Task 4.34 adds a second mutation candidate readiness audit at `docs/SECOND_MUTATION_CANDIDATE_READINESS_AUDIT.md`. It is audit-only: `POST /history/:id/data-flag` is only a future candidate for a planning task, and no second browser mutation route is implemented or accepted.

Task 4.35 adds the History data-flag mutation prototype plan at `docs/HISTORY_DATA_FLAG_MUTATION_PROTOTYPE_PLAN.md`. It is plan-only: no history data-flag browser route is enabled, no second mutation prototype is implemented, and DataHealth dismiss remains the only implemented browser mutation route.

Task 4.36 adds a dev-only, explicit opt-in History data-flag mutation prototype. It is one-route only: `POST /history/:id/data-flag`. DataHealth dismiss remains intact, localStorage remains source of truth, success requires snapshot metadata, and no production readiness or broader write-path migration is implied.

Task 4.37 adds the History data-flag prototype acceptance runbook at `docs/HISTORY_DATA_FLAG_PROTOTYPE_ACCEPTANCE.md`. It is acceptance/testing only: browser mutation routes remain exactly DataHealth dismiss and History data-flag, localStorage remains source of truth, and no production readiness or broader write-path migration is implied.

Task 4.38 adds the History data-flag manual App acceptance runbook at `docs/HISTORY_DATA_FLAG_MANUAL_APP_ACCEPTANCE.md`. It is human-run manual acceptance only: use a dedicated test browser profile and dedicated dev DB file, keep localStorage as source of truth, and do not treat the flow as production readiness or broader write-path migration.

Task 4.39 hardens the existing History data-flag prototype. It is hardening/testing only: no third browser mutation route is added, browser mutation routes remain exactly `POST /data-health/issues/:issueId/dismiss` and `POST /history/:id/data-flag`, success requires the strict result shape plus snapshot metadata, localStorage remains source of truth, and no production readiness or broader write-path migration is implied.

Task 4.40 adds the write-path two-route checkpoint at `docs/WRITE_PATH_TWO_ROUTE_CHECKPOINT.md`. It is checkpoint/audit documentation and static-test coverage only: browser mutation routes remain exactly `POST /data-health/issues/:issueId/dismiss` and `POST /history/:id/data-flag`, no third route is approved, localStorage remains source of truth, and no production readiness or broader write-path migration is implied. Use the checkpoint before any future two-route manual regression or third-candidate audit.

Task 4.41 adds the write-path two-route manual regression runbook at `docs/WRITE_PATH_TWO_ROUTE_MANUAL_REGRESSION.md`. It is manual regression documentation and static-test coverage only: validate DataHealth dismiss and History data-flag together in one local App/dev API session, keep browser mutation routes exactly `POST /data-health/issues/:issueId/dismiss` and `POST /history/:id/data-flag`, keep localStorage as source of truth, and do not treat the flow as production readiness or broader write-path migration.

Task 4.42 adds the write-path two-route regression lock at `docs/WRITE_PATH_TWO_ROUTE_REGRESSION_LOCK.md`. It is regression-lock documentation and static-test coverage only: keep browser mutation routes exactly `POST /data-health/issues/:issueId/dismiss` and `POST /history/:id/data-flag`, keep localStorage as source of truth, preserve no-fake-success and snapshot-metadata success requirements, and do not treat the flow as production readiness or broader write-path migration.

Task 4.43 adds the third mutation candidate readiness audit at `docs/THIRD_MUTATION_CANDIDATE_READINESS_AUDIT.md`. It is audit-only and docs/static-test coverage only: no third mutation route is implemented, browser mutation routes remain exactly `POST /data-health/issues/:issueId/dismiss` and `POST /history/:id/data-flag`, localStorage remains source of truth, API results never overwrite AppData or localStorage, and no production readiness implication is created. Limited history edit is only a future planning candidate for `Task 4.44 Limited History Edit Mutation Prototype Plan V1`.

Task 4.44 adds the limited history edit mutation prototype plan at `docs/LIMITED_HISTORY_EDIT_MUTATION_PROTOTYPE_PLAN.md`. It is planning-only and docs/static-test coverage only: `POST /history/:id/edit` remains blocked from browser runtime, browser mutation routes remain exactly `POST /data-health/issues/:issueId/dismiss` and `POST /history/:id/data-flag`, localStorage remains source of truth, API results never overwrite AppData or localStorage, and no production readiness implication is created. The plan defines field-level constraints and rejects broad history edit before any future prototype can be considered.

Task 4.45 adds the limited history edit mutation readiness gate at `docs/LIMITED_HISTORY_EDIT_MUTATION_READINESS_GATE.md`. It is gate-only and docs/static-test coverage only: limited history edit remains gate-only and not implemented, `POST /history/:id/edit` remains blocked from browser runtime, no third browser mutation route is added, localStorage remains source of truth, API results never overwrite AppData or localStorage, and no production readiness implication is created. Task 4.46 requires explicit user approval and must not auto-start.

Task 4.55 adds the fourth mutation candidate readiness audit at `docs/FOURTH_MUTATION_CANDIDATE_READINESS_AUDIT.md`. It is audit-only and docs/static-test coverage only: no fourth mutation is implemented, browser mutation routes remain exactly `POST /data-health/issues/:issueId/dismiss`, `POST /history/:id/data-flag`, and `POST /history/:id/edit`, localStorage remains source of truth, API results never overwrite AppData or localStorage, and no production readiness implication is created. Active-session mutation is only a future planning candidate area for `Task 4.56 Active Session Mutation Readiness & Recovery Plan V1`.

Task 4.56 adds the active-session mutation readiness and recovery plan at `docs/ACTIVE_SESSION_MUTATION_READINESS_RECOVERY_PLAN.md`. It is planning-only and docs/static-test coverage only: no active-session mutation is implemented, no fourth mutation route is added, browser mutation routes remain exactly `POST /data-health/issues/:issueId/dismiss`, `POST /history/:id/data-flag`, and `POST /history/:id/edit`, localStorage remains source of truth, API results never overwrite AppData or localStorage, and no production readiness implication is created.

Task 4.57 adds the active-session source snapshot and idempotency plan at `docs/ACTIVE_SESSION_SOURCE_SNAPSHOT_IDEMPOTENCY_PLAN.md`. It is planning-only and docs/static-test coverage only: no active-session route is implemented, no fourth mutation route is added, browser mutation routes remain exactly `POST /data-health/issues/:issueId/dismiss`, `POST /history/:id/data-flag`, and `POST /history/:id/edit`, and source snapshot/idempotency metadata is documented before any future session-start prototype.

Task 4.58 adds the active-session UX confirmation and rollback plan at `docs/ACTIVE_SESSION_UX_CONFIRMATION_ROLLBACK_PLAN.md`. It is planning-only and docs/static-test coverage only: no active-session route is implemented, no fourth mutation route is added, browser mutation routes remain exactly `POST /data-health/issues/:issueId/dismiss`, `POST /history/:id/data-flag`, and `POST /history/:id/edit`, and future session-start UX must require confirmation, pending duplicate-submit protection, visible failure, no optimistic success, no auto retry, rollback by disabling the mutation experiment flag, and local App fallback.

Task 4.59 adds the session-start mutation prototype plan at `docs/SESSION_START_MUTATION_PROTOTYPE_PLAN.md`. It is planning-only and docs/static-test coverage only: `POST /sessions/start` remains blocked from browser runtime, no fourth mutation route is added, browser mutation routes remain exactly `POST /data-health/issues/:issueId/dismiss`, `POST /history/:id/data-flag`, and `POST /history/:id/edit`, and future session-start implementation must remain one-route, dev-only, explicit opt-in, source-snapshot/idempotency guarded, no-fake-success guarded, and localStorage-source-of-truth.

Task 4.60 adds the dev-only session-start mutation prototype. Browser mutation routes are now exactly `POST /data-health/issues/:issueId/dismiss`, `POST /history/:id/data-flag`, `POST /history/:id/edit`, and `POST /sessions/start`. The session-start prototype is DEV-only, compare-gated, `session-start` experiment-gated, localhost-only, source-snapshot/idempotency-gated, confirmation-gated, no-fake-success guarded, and localStorage-source-of-truth. It adds no active patch, complete, discard, DataHealth repair, backup/import/export, reset/recovery, production backend, auth, sync, deployment, package, lockfile, script, normalized table, broad mutation client, or source-of-truth migration behavior.

Task 4.61 adds the session-start prototype acceptance runbook at `docs/SESSION_START_PROTOTYPE_ACCEPTANCE.md`. It is acceptance documentation and test coverage only: no new mutation route is added, browser mutation routes remain exactly `POST /data-health/issues/:issueId/dismiss`, `POST /history/:id/data-flag`, `POST /history/:id/edit`, and `POST /sessions/start`, localStorage remains source of truth, API results never overwrite AppData/localStorage, and active patch/complete/discard remain blocked.

Task 4.62 adds the session-start manual App acceptance runbook at `docs/SESSION_START_MANUAL_APP_ACCEPTANCE.md`. It is human-run manual acceptance only: use a dedicated test browser profile and dedicated dev DB, do not use real personal training data, keep browser mutation routes exactly `POST /data-health/issues/:issueId/dismiss`, `POST /history/:id/data-flag`, `POST /history/:id/edit`, and `POST /sessions/start`, keep localStorage as source of truth, and do not treat the flow as production readiness.

Task 4.63 hardens the existing Session Start prototype at `docs/SESSION_START_PROTOTYPE_HARDENING.md`. It is hardening/testing only: no new mutation route is added, browser mutation routes remain exactly `POST /data-health/issues/:issueId/dismiss`, `POST /history/:id/data-flag`, `POST /history/:id/edit`, and `POST /sessions/start`, localStorage remains source of truth, API results never overwrite AppData/localStorage, and active patch/complete/discard remain blocked.

Task 4.64 adds safe observability and manual recovery notes at `docs/SESSION_START_OBSERVABILITY_RECOVERY_NOTES.md`. It is observability/testing only: no browser reset/recovery action is added, no new mutation route is added, browser mutation routes remain exactly `POST /data-health/issues/:issueId/dismiss`, `POST /history/:id/data-flag`, `POST /history/:id/edit`, and `POST /sessions/start`, localStorage remains source of truth, API results never overwrite AppData/localStorage, and recovery remains manual/dev-only.

Task 4.65 locks the existing Session Start prototype at `docs/SESSION_START_REGRESSION_LOCK.md`. It is regression-lock/testing only: no new mutation route is added, browser mutation routes remain exactly `POST /data-health/issues/:issueId/dismiss`, `POST /history/:id/data-flag`, `POST /history/:id/edit`, and `POST /sessions/start`, active patch/complete/discard remain blocked, localStorage remains source of truth, and API results never overwrite AppData/localStorage.

Task 4.66 checkpoints the current four-route write-path state at `docs/WRITE_PATH_FOUR_ROUTE_CHECKPOINT.md`. It is checkpoint/audit documentation and static-test coverage only: no new mutation route is added, browser mutation routes remain exactly `POST /data-health/issues/:issueId/dismiss`, `POST /history/:id/data-flag`, `POST /history/:id/edit`, and `POST /sessions/start`, active patch/complete/discard remain blocked, localStorage remains source of truth, and API results never overwrite AppData/localStorage.

Task 4.67 adds the four-route manual regression runbook at `docs/WRITE_PATH_FOUR_ROUTE_MANUAL_REGRESSION.md`. It is manual regression documentation and static-test coverage only: no new mutation route is added, browser mutation routes remain exactly `POST /data-health/issues/:issueId/dismiss`, `POST /history/:id/data-flag`, `POST /history/:id/edit`, and `POST /sessions/start`, active patch/complete/discard remain blocked, localStorage remains source of truth, and API results never overwrite AppData/localStorage.

Task 4.68 locks the current four-route write-path state at `docs/WRITE_PATH_FOUR_ROUTE_REGRESSION_LOCK.md`. It is regression-lock documentation and static-test coverage only: no new mutation route is added, browser mutation routes remain exactly `POST /data-health/issues/:issueId/dismiss`, `POST /history/:id/data-flag`, `POST /history/:id/edit`, and `POST /sessions/start`, active patch/complete/discard remain blocked, localStorage remains source of truth, and API results never overwrite AppData/localStorage.

Task 4.69 adds the Phase 4 source-of-truth migration readiness audit at `docs/PHASE4_SOURCE_OF_TRUTH_MIGRATION_READINESS_AUDIT.md`. It is audit-only: localStorage remains source of truth, API results never overwrite AppData/localStorage, no API-backed runtime persistence is added, and Phase 5 is required before any source-of-truth migration implementation.

Task 4.70 adds the API-backed runtime strategy plan at `docs/API_BACKED_RUNTIME_STRATEGY_PLAN.md`. It is planning-only: localStorage remains source of truth, API results never overwrite AppData/localStorage, no API-backed runtime behavior is added, and production backend/auth/sync/deployment remain future assumptions.

Task 4.71 adds the Phase 4 final data safety audit at `docs/PHASE4_FINAL_DATA_SAFETY_AUDIT.md`. It is audit-only: accepted/blocked routes, source-of-truth lock, localStorage integrity, no-fake-success, backup/import safety, readMirror parity, and runtime boundary are recorded without runtime changes.

Task 4.72 adds the Phase 4 manual final acceptance runbook at `docs/PHASE4_MANUAL_FINAL_ACCEPTANCE.md`. It is manual acceptance documentation only: validate the Dev API runner, read-only diagnostics, all four accepted mutation prototypes, route boundaries, localStorage integrity, failure recovery, cleanup/env reset, and browser build safety without runtime changes.

Task 4.73 adds the Phase 4 exit regression lock at `docs/PHASE4_EXIT_REGRESSION_LOCK.md`. It is regression-lock documentation only: final accepted routes, blocked routes, localStorage source-of-truth, browser build isolation, no production/auth/sync/deployment, no source-of-truth migration, and Phase 5 handoff-only next step are locked without runtime changes.

Task 4.74 adds the Phase 5 handoff plan at `docs/PHASE5_HANDOFF_PLAN.md`. It is handoff planning only: Phase 4 final state, source-of-truth migration prerequisites, API-backed runtime prerequisites, production/auth/sync prerequisites, risk register, and recommended Phase 5 first task are recorded without starting Phase 5.

## Scope / Non-goals

- [ ] Confirm this is a dev-only manual checklist.
- [ ] Confirm there is no App.tsx integration.
- [ ] Confirm there is no UI integration.
- [ ] Confirm there is no localStorage replacement.
- [ ] Confirm there is no production server.
- [ ] Confirm there is no auth.
- [ ] Confirm there is no sync.
- [ ] Confirm there is no deployment.
- [ ] Confirm there are no normalized tables.
- [ ] Confirm there is no backup import/export HTTP endpoint.
- [ ] Confirm the App runtime still uses the existing browser localStorage persistence path.

## Prerequisites

- [ ] Work from the project checkout: `C:\Users\xuhao\PycharmProjects\fitness-app`.
- [ ] Confirm the branch and commit under test are recorded in the pass/fail template.
- [ ] Run `npm run typecheck` before manual acceptance.
- [ ] Run `npm test` before manual acceptance.
- [ ] Run `npm run build` before manual acceptance.
- [ ] Confirm there is no production package script required for this checklist; only the dev-only runner prototype scripts are used when checking the runner.
- [ ] Confirm `.ironpath/dev-api.sqlite` is not committed.
- [ ] Confirm no real training data or local dev SQLite files are committed.

## Dev Runner Prototype Acceptance

- [ ] Review the dedicated runner runbook: `docs/DEV_API_RUNNER_MANUAL_ACCEPTANCE.md`.
- [ ] `npm run api:dev:build` writes generated files only under `.ironpath/dev-api-runner`.
- [ ] Runner build does not delete `.ironpath/dev-api.sqlite`, `.sqlite-wal`, `.sqlite-shm`, or sibling dev artifacts.
- [ ] `npm run api:dev -- --port 0 --seed-empty --db <temp-db>` starts the dev-only API runner.
- [ ] Runner stdout includes `IronPath dev API ready: <url>`.
- [ ] The ready URL serves `GET /health` as JSON.
- [ ] With `--seed-empty`, `GET /app-data/summary` is readable.
- [ ] SIGINT or SIGTERM closes the HTTP server and SQLite repository.
- [ ] Runner usage remains dev-only and does not require App.tsx or UI integration.

## Launcher Boundary Verification

- [ ] Importing or creating `createDevLocalApiLauncher(options)` does not listen on a port.
- [ ] `start()` is required before any HTTP server exists.
- [ ] Default host is `127.0.0.1`.
- [ ] Default DB file is `.ironpath/dev-api.sqlite`.
- [ ] Repeated `start()` returns the same running `url`, `host`, and `port`.
- [ ] Repeated `start()` does not create a second HTTP server.
- [ ] Repeated `start()` does not create a second SQLite repository instance.
- [ ] `close()` closes the HTTP server.
- [ ] `close()` closes the SQLite repository.
- [ ] Repeated `close()` is safe.

## Health Check Acceptance

- [ ] With `seedEmpty=false`, `GET /health` returns a JSON response.
- [ ] With an empty repository, `GET /health` does not require an AppData snapshot.
- [ ] With an empty repository, non-health data routes may return `snapshot_not_found`.
- [ ] `GET /health` does not write a snapshot.
- [ ] Health responses do not expose raw stack traces.
- [ ] Health responses do not expose raw SQLite error objects.

## Seed Empty Acceptance

- [ ] `seedEmpty=false` does not create an AppData snapshot automatically.
- [ ] `seedEmpty=true` creates one empty AppData snapshot only when no latest snapshot exists.
- [ ] The seed snapshot label is `dev-launcher:seed-empty`.
- [ ] Starting again with `seedEmpty=true` does not create a duplicate seed snapshot when a latest snapshot exists.
- [ ] After the seed snapshot exists, `GET /app-data/summary` can read through the stack.

## Read Route Acceptance

- [ ] `GET /app-data/summary` returns data through serverAdapter/readMirror.
- [ ] `GET /sessions/summary` returns data through serverAdapter/readMirror.
- [ ] `GET /history` returns data through serverAdapter/readMirror.
- [ ] `GET /history/:id` returns data through serverAdapter/readMirror.
- [ ] `GET /data-health/summary` returns data through serverAdapter/readMirror.
- [ ] GET routes do not write snapshots.
- [ ] Successful responses use `{ "result": <adapter result>, "snapshot": <metadata if present> }`.
- [ ] Error responses use `{ "error": { "code": string, "message": string } }`.
- [ ] Unsupported business routes may return `{ "result": { "reasonCode": "unsupported_route" } }` from serverAdapter.
- [ ] Read routes do not add business logic outside serverAdapter/readMirror.

## Mutation Route Acceptance

- [ ] `POST /sessions/start` persists a new snapshot only when the lower-level handler returns `nextData`.
- [ ] `POST /sessions/active/patches` persists a new snapshot only when the lower-level handler returns `nextData`.
- [ ] `POST /sessions/active/complete` persists a new snapshot only when the lower-level handler returns `nextData`.
- [ ] `POST /sessions/active/discard` persists a new snapshot only when the lower-level handler returns `nextData`.
- [ ] `POST /history/:id/edit` persists a new snapshot only when the lower-level handler returns `nextData`.
- [ ] `POST /history/:id/data-flag` persists a new snapshot only when the lower-level handler returns `nextData`.
- [ ] `POST /data-health/issues/:issueId/dismiss` persists a new snapshot only when the lower-level handler returns `nextData`.
- [ ] `POST /data-health/repair/apply` persists a new snapshot only when the lower-level handler returns `nextData`.
- [ ] Successful mutation persistence returns snapshot metadata.
- [ ] No-op mutations do not write snapshots.
- [ ] Invalid mutations do not write snapshots.
- [ ] Not-found mutations do not write snapshots.
- [ ] Requires-confirmation mutations do not write snapshots.
- [ ] Unsupported mutations do not write snapshots.
- [ ] If `writeSnapshot` fails, the response is a stable repository error, not a successful mutation result.
- [ ] Mutation responses do not expose raw stack traces.

## HTTP Parsing Acceptance

- [ ] POST with an empty body is allowed without `Content-Type`.
- [ ] POST with an empty body forwards `body: undefined`.
- [ ] POST with a non-empty body requires JSON.
- [ ] Malformed JSON returns `400` with `invalid_json`.
- [ ] Body larger than `maxBodyBytes` returns `413` with `request_body_too_large`.
- [ ] Unsupported media type returns `415` with `unsupported_media_type`.
- [ ] Query string values are forwarded as `Record<string, string>`.
- [ ] GET does not read a request body.
- [ ] HEAD does not read a request body.
- [ ] HEAD forwards to serverAdapter and usually returns `405` with `unsupported_route`.
- [ ] Parsing errors do not write snapshots.

## Localhost Safety Acceptance

- [ ] Default host is `127.0.0.1`.
- [ ] `localhost` is treated as local-safe.
- [ ] `127.0.0.1` is treated as local-safe.
- [ ] `::1` is treated as local-safe.
- [ ] `0.0.0.0` requires `allowNetworkAccess=true`.
- [ ] Non-localhost host values require `allowNetworkAccess=true`.
- [ ] LAN exposure is opt-in only because there is no auth.
- [ ] Host safety errors expose stable code/message only.

## DB File Safety Acceptance

- [ ] Review the dev DB recovery/reset checklist: `docs/DEV_API_RECOVERY_RESET.md`.
- [ ] `.ironpath/` is ignored by git.
- [ ] `*.sqlite` is ignored by git.
- [ ] `*.sqlite-wal` is ignored by git.
- [ ] `*.sqlite-shm` is ignored by git.
- [ ] Do not commit the dev DB.
- [ ] Do not commit real training data.
- [ ] File-backed DB close/reopen can read the latest snapshot.
- [ ] Temporary SQLite, WAL, and SHM files used during testing are cleaned up.

## Browser Build Safety Acceptance

- [ ] Browser-facing `apps/api/src/index.ts` does not export Node-only modules.
- [ ] `src/**` does not import `devLauncher`.
- [ ] `src/**` does not import `httpRuntimeAdapter`.
- [ ] `src/**` does not import `serverAdapter`.
- [ ] `src/**` does not import `sqliteRepository`.
- [ ] `src/**` does not import `node:http`.
- [ ] `src/**` does not import `node:sqlite`.
- [ ] `npm run build` passes.
- [ ] Browser build is not polluted by `node:http`.
- [ ] Browser build is not polluted by `node:sqlite`.

## DataHealth Dismiss Prototype Acceptance

- [ ] Use `docs/DATAHEALTH_DISMISS_PROTOTYPE_ACCEPTANCE.md` for the dev-only one-route DataHealth dismiss prototype runbook.
- [ ] Use `docs/DATAHEALTH_DISMISS_MANUAL_APP_ACCEPTANCE.md` for the human-run App acceptance checklist with `npm run api:dev`, `npm run dev`, browser DevTools, and a dedicated test browser profile.
- [ ] The only accepted browser mutation route is `POST /data-health/issues/:issueId/dismiss`.
- [ ] Task 4.31 hardening keeps this one-route scope and adds checks for no-change/already-dismissed, missing snapshot metadata, unavailable/timeout/abort, duplicate-submit, and confirmation reset behavior.
- [ ] Task 4.32 observability keeps this one-route scope and adds safe diagnostics plus manual recovery notes for unavailable, timeout, invalid response, no-change, issue-not-found, write failure, database closed, missing snapshot metadata, and abort/unmount behavior.
- [ ] Use the Task 4.32 section in `docs/DATAHEALTH_DISMISS_MANUAL_APP_ACCEPTANCE.md` to confirm no raw stack trace, raw API response, full AppData, localStorage dump, SQLite internals, or environment object is shown.
- [ ] Confirm recovery guidance is manual and dev-only; there is no HTTP reset endpoint and no browser recovery/reset action.
- [ ] Task 4.33 regression lock must remain green before any second mutation candidate is considered.
- [ ] Confirm Task 4.33 still locks strict success, no fake success, failure mapping, confirmation, pending duplicate-submit prevention, safe observability, and docs/manual acceptance boundaries.
- [ ] Task 4.34 second mutation audit must remain audit-only before any history data-flag plan begins.
- [ ] Confirm DataHealth dismiss remains `POST /data-health/issues/:issueId/dismiss`.
- [ ] Confirm Task 4.36 implements History data-flag only as `POST /history/:id/data-flag` under explicit dev-only opt-in.
- [ ] Confirm the only browser mutation prototypes are DataHealth dismiss and History data-flag.
- [ ] Task 4.35 history data-flag prototype plan remains the planning record; Task 4.36 is the explicitly approved one-route implementation.
- [ ] Confirm the history data-flag prototype does not change localStorage source-of-truth, AppData overwrite behavior, or browser route boundaries.
- [ ] Use `docs/HISTORY_DATA_FLAG_PROTOTYPE_ACCEPTANCE.md` for the History data-flag prototype acceptance runbook.
- [ ] Use `docs/HISTORY_DATA_FLAG_MANUAL_APP_ACCEPTANCE.md` for the human-run History data-flag manual App acceptance checklist.
- [ ] Confirm Task 4.37 acceptance keeps browser mutation routes exactly `POST /data-health/issues/:issueId/dismiss` and `POST /history/:id/data-flag`.
- [ ] Confirm Task 4.37 acceptance covers flag matrix, target record, confirmation, pending/duplicate-submit, success/failure/no-fake-success, dataFlag semantics, localStorage integrity, Network boundary, forbidden controls, cleanup, and browser build safety.
- [ ] Confirm Task 4.38 manual acceptance requires a dedicated test browser profile, no real personal training data, a dedicated dev DB file, DevTools Network route checks, target record checks, normal/test/excluded semantics checks, cleanup, and pass/fail reporting.
- [ ] Do not treat this as production readiness.
- [ ] Do not enable session, history edit, DataHealth repair, backup/import/export, reset, or recovery routes from browser code.
- [ ] Confirm localStorage remains source of truth and API results do not overwrite AppData or localStorage.

## Limited History Edit Readiness Gate Acceptance

- [ ] Review `docs/LIMITED_HISTORY_EDIT_MUTATION_READINESS_GATE.md`.
- [ ] Confirm Task 4.45 is readiness gate only.
- [ ] Confirm limited history edit remains gate-only and not implemented.
- [ ] Confirm `POST /history/:id/edit` remains blocked from browser runtime.
- [ ] Confirm no third browser mutation route is added.
- [ ] Confirm browser mutation routes remain exactly `POST /data-health/issues/:issueId/dismiss` and `POST /history/:id/data-flag`.
- [ ] Confirm App.tsx and src/devApi runtime behavior are unchanged by Task 4.45.
- [ ] Confirm localStorage remains source of truth.
- [ ] Confirm API results never overwrite AppData or localStorage.
- [ ] Confirm no production backend, auth, sync, or deployment is added.
- [ ] Confirm no dependency, lockfile, package script, or normalized table is added.
- [ ] Confirm Task 4.46 Limited History Edit Mutation Prototype V1 requires explicit user approval and must not auto-start.

## Data Semantics Acceptance

- [ ] Backup unsafe import remains rejected by existing backup safety boundaries.
- [ ] Cleaned backup import semantics remain unchanged.
- [ ] Needs-review backup import semantics remain unchanged.
- [ ] `actualWeightKg` remains the only trusted calculation source.
- [ ] `displayWeight` and `displayUnit` remain legacy fallback data only.
- [ ] `identityInvalid` records do not enter PR, e1RM, or effective-set calculations.
- [ ] `legacyActualExerciseId` semantics remain unchanged.
- [ ] `test` records remain excluded from default statistics.
- [ ] `excluded` records remain excluded from default statistics.
- [ ] DataHealth repair logs remain summary-only.
- [ ] Read mirror output stays consistent before and after repository round-trip.

## Manual Pass / Fail Template

- [ ] Date:
- [ ] Branch / commit:
- [ ] Node version:
- [ ] Commands run:
- [ ] Health check result:
- [ ] Seed result:
- [ ] Read route result:
- [ ] Mutation route result:
- [ ] Failure route result:
- [ ] Browser build result:
- [ ] Notes:
- [ ] Pass / Fail:

## Task 4.46 Limited History Edit Prototype Note

- [ ] Confirm Task 4.46 is dev-only and one-route only.
- [ ] Confirm the only new route is `POST /history/:id/edit`.
- [ ] Confirm browser mutation routes are exactly `POST /data-health/issues/:issueId/dismiss`, `POST /history/:id/data-flag`, and `POST /history/:id/edit`.
- [ ] Confirm this does not imply production readiness.
- [ ] Confirm localStorage remains source of truth and API results do not overwrite AppData or localStorage.
- [ ] Confirm no session/DataHealth repair/backup/import/export/reset/recovery browser mutation route is exposed.

## Task 4.47 Limited History Edit Acceptance Runbook

- [ ] Use `docs/LIMITED_HISTORY_EDIT_PROTOTYPE_ACCEPTANCE.md` for Limited History Edit manual acceptance.
- [ ] Confirm Task 4.47 does not add a new mutation route.
- [ ] Confirm Task 4.47 docs do not imply production readiness.
- [ ] Confirm the runbook covers flag matrix, target set, confirmation, pending duplicate-submit, success, failure, field constraints, data semantics, localStorage integrity, route boundary, forbidden UI controls, cleanup, and browser build safety.

## Task 4.48 Limited History Edit Manual App Acceptance

- [ ] Use `docs/LIMITED_HISTORY_EDIT_MANUAL_APP_ACCEPTANCE.md` for human-run App acceptance.
- [ ] Confirm Task 4.48 does not add a new mutation route.
- [ ] Confirm manual testing uses disposable data and a dedicated browser profile.
- [ ] Confirm browser mutation routes remain exactly `POST /data-health/issues/:issueId/dismiss`, `POST /history/:id/data-flag`, and `POST /history/:id/edit`.
- [ ] Confirm localStorage remains source of truth and API results do not overwrite AppData or localStorage.

## Task 4.49 Limited History Edit Hardening

- [ ] Use `docs/LIMITED_HISTORY_EDIT_PROTOTYPE_HARDENING.md` for hardening scope.
- [ ] Confirm Task 4.49 does not add a new mutation route.
- [ ] Confirm no-fake-success requires HTTP success, `ok=true`, `changed=true`, `status="success"`, and snapshot metadata.
- [ ] Confirm source fingerprint missing is failure and no request is sent.
- [ ] Confirm pending duplicate submit stays blocked.
- [ ] Confirm browser mutation routes remain exactly `POST /data-health/issues/:issueId/dismiss`, `POST /history/:id/data-flag`, and `POST /history/:id/edit`.
- [ ] Confirm localStorage remains source of truth and API results do not overwrite AppData or localStorage.

## Task 4.50 Limited History Edit Observability & Recovery Notes

- [ ] Use `docs/LIMITED_HISTORY_EDIT_OBSERVABILITY_RECOVERY_NOTES.md` for safe observability and manual recovery guidance.
- [ ] Confirm Task 4.50 does not add a new mutation route.
- [ ] Confirm safe diagnostics do not expose raw stack traces, raw API responses, full AppData, localStorage dumps, SQLite internals, or environment objects.
- [ ] Confirm recovery guidance does not expose browser reset/recovery/import/export/apply/fix controls.
- [ ] Confirm browser mutation routes remain exactly `POST /data-health/issues/:issueId/dismiss`, `POST /history/:id/data-flag`, and `POST /history/:id/edit`.
- [ ] Confirm localStorage remains source of truth and API results do not overwrite AppData or localStorage.

## Task 4.51 Limited History Edit Regression Lock

- [ ] Use `docs/LIMITED_HISTORY_EDIT_REGRESSION_LOCK.md` for the Limited History Edit regression lock.
- [ ] Confirm Task 4.51 does not add a new mutation route.
- [ ] Confirm browser mutation routes remain exactly `POST /data-health/issues/:issueId/dismiss`, `POST /history/:id/data-flag`, and `POST /history/:id/edit`.
- [ ] Confirm no fourth mutation route, session mutation, DataHealth repair, backup/import/export/reset/recovery route, or broad mutation client is exposed.
- [ ] Confirm allowed Limited History Edit patch fields remain exactly `weightKg`, `displayWeight`, `displayUnit`, `reps`, `rir`, `techniqueQuality`, `painFlag`, and `note`.
- [ ] Confirm localStorage remains source of truth and API results do not overwrite AppData or localStorage.

## Task 4.52 Write-path Three-route Checkpoint

- [ ] Use `docs/WRITE_PATH_THREE_ROUTE_CHECKPOINT.md` as the three-route checkpoint.
- [ ] Confirm Task 4.52 does not add a new mutation route.
- [ ] Confirm browser mutation routes remain exactly `POST /data-health/issues/:issueId/dismiss`, `POST /history/:id/data-flag`, and `POST /history/:id/edit`.
- [ ] Confirm no fourth mutation route, session mutation, DataHealth repair, backup/import/export/reset/recovery route, or broad mutation client is exposed.
- [ ] Confirm DataHealth dismiss, History data-flag, and Limited History Edit remain dev-only explicit opt-in prototypes.
- [ ] Confirm localStorage remains source of truth and API results do not overwrite AppData or localStorage.

## Task 4.53 Write-path Three-route Manual Regression

- [ ] Use `docs/WRITE_PATH_THREE_ROUTE_MANUAL_REGRESSION.md` as the three-route manual regression runbook.
- [ ] Confirm Task 4.53 does not add a new mutation route.
- [ ] Confirm manual testing uses disposable data and a dedicated browser profile.
- [ ] Confirm DataHealth dismiss, History data-flag, and Limited History Edit are validated in separate mutation-flag flows.
- [ ] Confirm browser mutation routes remain exactly `POST /data-health/issues/:issueId/dismiss`, `POST /history/:id/data-flag`, and `POST /history/:id/edit`.
- [ ] Confirm no fourth mutation route, session mutation, DataHealth repair, backup/import/export/reset/recovery route, or broad mutation client is exposed.
- [ ] Confirm localStorage remains source of truth and API results do not overwrite AppData or localStorage.

## Task 4.54 Write-path Three-route Regression Lock

- [ ] Use `docs/WRITE_PATH_THREE_ROUTE_REGRESSION_LOCK.md` as the final three-route regression lock.
- [ ] Confirm Task 4.54 does not add a new mutation route.
- [ ] Confirm browser mutation routes remain exactly `POST /data-health/issues/:issueId/dismiss`, `POST /history/:id/data-flag`, and `POST /history/:id/edit`.
- [ ] Confirm no fourth mutation route, session mutation, DataHealth repair, backup/import/export/reset/recovery route, or broad mutation client is exposed.
- [ ] Confirm localStorage remains source of truth and API results do not overwrite AppData or localStorage.
- [ ] Confirm next recommended task is `Task 4.55 Fourth Mutation Candidate Readiness Audit V1`, audit-only.

## Task 4.55 Fourth Mutation Candidate Readiness Audit

- [ ] Use `docs/FOURTH_MUTATION_CANDIDATE_READINESS_AUDIT.md` as the fourth mutation candidate readiness audit.
- [ ] Confirm Task 4.55 does not add a new mutation route.
- [ ] Confirm no fourth mutation is implemented.
- [ ] Confirm browser mutation routes remain exactly `POST /data-health/issues/:issueId/dismiss`, `POST /history/:id/data-flag`, and `POST /history/:id/edit`.
- [ ] Confirm session start, session patch, session complete, session discard, DataHealth repair, backup/import/export over HTTP, reset/recovery over HTTP, and source-of-truth migration remain blocked.
- [ ] Confirm localStorage remains source of truth and API results do not overwrite AppData or localStorage.
- [ ] Confirm there is no production backend, auth, sync, deployment, dependency, package script, normalized table, broad mutation client, offline queue, or source-of-truth switch.
- [ ] Confirm next recommended task is `Task 4.56 Active Session Mutation Readiness & Recovery Plan V1`, planning-only.

## Task 4.56 Active Session Mutation Readiness & Recovery Plan

- [ ] Use `docs/ACTIVE_SESSION_MUTATION_READINESS_RECOVERY_PLAN.md` as the active-session readiness and recovery plan.
- [ ] Confirm Task 4.56 does not add a new mutation route.
- [ ] Confirm no active-session mutation is implemented.
- [ ] Confirm `POST /sessions/start`, `POST /sessions/active/patches`, `POST /sessions/active/complete`, and `POST /sessions/active/discard` remain blocked from browser runtime.
- [ ] Confirm browser mutation routes remain exactly `POST /data-health/issues/:issueId/dismiss`, `POST /history/:id/data-flag`, and `POST /history/:id/edit`.
- [ ] Confirm source snapshot strategy, idempotency, duplicate-submit prevention, patch sequencing, offline failure behavior, confirmation UX, rollback/recovery UX, no-fake-success, and manual acceptance gates are documented.
- [ ] Confirm localStorage remains source of truth and API results do not overwrite AppData or localStorage.
- [ ] Confirm no production backend, auth, sync, deployment, dependency, package script, normalized table, broad mutation client, offline queue, source-of-truth switch, or automatic next task is approved.

## Task 4.57 Active Session Source Snapshot & Idempotency Plan

- [ ] Use `docs/ACTIVE_SESSION_SOURCE_SNAPSHOT_IDEMPOTENCY_PLAN.md` as the source snapshot and idempotency plan.
- [ ] Confirm Task 4.57 does not add a new mutation route.
- [ ] Confirm no active-session route is implemented.
- [ ] Confirm `sourceSnapshotHash`, `sourceSnapshotVersion`, `mutationId`, `idempotencyKey`, and `requestFingerprint` are documented.
- [ ] Confirm activeSession target identity and planTemplate/session-start target identity are documented.
- [ ] Confirm duplicate start prevention, duplicate patch/complete/discard risks, conflict detection, no auto-merge, and no-fake-success are documented.
- [ ] Confirm browser mutation routes remain exactly `POST /data-health/issues/:issueId/dismiss`, `POST /history/:id/data-flag`, and `POST /history/:id/edit`.
- [ ] Confirm localStorage remains source of truth and API results do not overwrite AppData or localStorage.
- [ ] Confirm next recommended task is `Task 4.58 Active Session UX Confirmation & Rollback Plan V1`.

## Task 4.58 Active Session UX Confirmation & Rollback Plan

- [ ] Use `docs/ACTIVE_SESSION_UX_CONFIRMATION_ROLLBACK_PLAN.md` as the active-session UX confirmation and rollback plan.
- [ ] Confirm Task 4.58 does not add a new mutation route.
- [ ] Confirm no active-session route is implemented.
- [ ] Confirm future session-start confirmation and cancel-prevents-POST behavior are documented.
- [ ] Confirm pending state, duplicate start protection, no optimistic success, no auto retry, and visible safe failure requirements are documented.
- [ ] Confirm rollback by disabling `VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT` and using local App state is documented.
- [ ] Confirm browser mutation routes remain exactly `POST /data-health/issues/:issueId/dismiss`, `POST /history/:id/data-flag`, and `POST /history/:id/edit`.
- [ ] Confirm localStorage remains source of truth and API results do not overwrite AppData or localStorage.
- [ ] Confirm next recommended task is `Task 4.59 Session Start Mutation Prototype Plan V1`.

## Task 4.59 Session Start Mutation Prototype Plan

- [ ] Use `docs/SESSION_START_MUTATION_PROTOTYPE_PLAN.md` as the future session-start prototype plan.
- [ ] Confirm Task 4.59 does not add a new mutation route.
- [ ] Confirm `POST /sessions/start` remains blocked from browser runtime during Task 4.59.
- [ ] Confirm the future accepted request payload includes `templateId`, `sourceSnapshotHash`, `sourceSnapshotVersion`, `mutationId`, `idempotencyKey`, `requestFingerprint`, and `confirmed`.
- [ ] Confirm confirmation UX, duplicate start prevention, strict no-fake-success, recovery behavior, and manual acceptance plan are documented.
- [ ] Confirm active patch, complete, discard, DataHealth repair, backup/import/export, reset/recovery, and source-of-truth migration routes remain blocked.
- [ ] Confirm browser mutation routes remain exactly `POST /data-health/issues/:issueId/dismiss`, `POST /history/:id/data-flag`, and `POST /history/:id/edit`.
- [ ] Confirm localStorage remains source of truth and API results do not overwrite AppData or localStorage.
- [ ] Confirm next recommended task is `Task 4.60 Session Start Mutation Prototype V1` only if gates pass.

## Task 4.60 Session Start Mutation Prototype

- [ ] Confirm `src/devApi/devApiSessionStartConfig.ts`, `src/devApi/devApiSessionStartClient.ts`, and `src/devApi/DevApiSessionStartPrototype.tsx` exist.
- [ ] Confirm the prototype is DEV-only, read-only-compare-gated, `session-start` experiment-gated, localhost-only, source-snapshot/idempotency-gated, and confirmation-gated.
- [ ] Confirm browser mutation routes are now exactly `POST /data-health/issues/:issueId/dismiss`, `POST /history/:id/data-flag`, `POST /history/:id/edit`, and `POST /sessions/start`.
- [ ] Confirm active patch, complete, discard, DataHealth repair, backup/import/export, reset/recovery, and source-of-truth migration routes remain blocked.
- [ ] Confirm strict success requires HTTP success, result success, changed true, status success, and snapshot metadata.
- [ ] Confirm localStorage remains source of truth and API results do not overwrite AppData or localStorage.
- [ ] Confirm next recommended task is `Task 4.61 Session Start Prototype Acceptance V1`.

## Task 4.61 Session Start Prototype Acceptance

- [ ] Use `docs/SESSION_START_PROTOTYPE_ACCEPTANCE.md` as the Session Start acceptance runbook.
- [ ] Confirm Task 4.61 does not add a new mutation route.
- [ ] Confirm flag matrix, no stable target, confirmation/cancel, pending duplicate-submit, strict success, failure/no-fake-success, localStorage integrity, and route boundary checks are covered.
- [ ] Confirm browser mutation routes remain exactly `POST /data-health/issues/:issueId/dismiss`, `POST /history/:id/data-flag`, `POST /history/:id/edit`, and `POST /sessions/start`.
- [ ] Confirm active patch, complete, discard, DataHealth repair, backup/import/export, reset/recovery, and source-of-truth migration routes remain blocked.
- [ ] Confirm localStorage remains source of truth and API results do not overwrite AppData or localStorage.
- [ ] Confirm next recommended task is `Task 4.62 Session Start Manual App Acceptance V1`.

## Task 4.62 Session Start Manual App Acceptance

- [ ] Use `docs/SESSION_START_MANUAL_APP_ACCEPTANCE.md` as the Session Start browser manual acceptance runbook.
- [ ] Confirm Task 4.62 does not add a new mutation route.
- [ ] Confirm dedicated test browser profile, dedicated dev DB, and no-real-personal-training-data warnings are present.
- [ ] Confirm flag matrix, confirmation/cancel, duplicate start, success, failure/no-fake-success, localStorage integrity, Network route boundary, cleanup/env reset, and browser build safety are covered.
- [ ] Confirm browser mutation routes remain exactly `POST /data-health/issues/:issueId/dismiss`, `POST /history/:id/data-flag`, `POST /history/:id/edit`, and `POST /sessions/start`.
- [ ] Confirm active patch, complete, discard, DataHealth repair, backup/import/export, reset/recovery, and source-of-truth migration routes remain blocked.
- [ ] Confirm localStorage remains source of truth and API results do not overwrite AppData or localStorage.
- [ ] Confirm next recommended task is `Task 4.63 Session Start Prototype Hardening V1`.

## Task 4.63 Session Start Prototype Hardening

- [ ] Use `docs/SESSION_START_PROTOTYPE_HARDENING.md` as the Session Start hardening note.
- [ ] Confirm Task 4.63 does not add a new mutation route.
- [ ] Confirm duplicate submit/pending lock, source snapshot missing, idempotency missing, active session exists, missing snapshot metadata, unavailable/timeout/abort, malformed response, repository errors, confirmation reset, no localStorage/AppData mutation, and route boundary are covered.
- [ ] Confirm browser mutation routes remain exactly `POST /data-health/issues/:issueId/dismiss`, `POST /history/:id/data-flag`, `POST /history/:id/edit`, and `POST /sessions/start`.
- [ ] Confirm active patch, complete, discard, DataHealth repair, backup/import/export, reset/recovery, and source-of-truth migration routes remain blocked.
- [ ] Confirm next recommended task is `Task 4.64 Session Start Observability & Recovery Notes V1`.

## Task 4.64 Session Start Observability & Recovery Notes

- [ ] Use `docs/SESSION_START_OBSERVABILITY_RECOVERY_NOTES.md` as the Session Start observability and recovery note.
- [ ] Confirm Task 4.64 does not add a new mutation route.
- [ ] Confirm safe diagnostics are limited to state, redacted target reference, source snapshot/idempotency presence, snapshot metadata presence, HTTP status, failure code, duplicate-submit blocked flag, timestamps, and safe recovery note.
- [ ] Confirm raw stack traces, raw API responses, AppData dumps, localStorage dumps, SQLite internals, and unrestricted server errors are not exposed.
- [ ] Confirm no browser repair, sync, overwrite, import, export, reset, apply, fix, migrate, active patch, active complete, or active discard control is added.
- [ ] Confirm browser mutation routes remain exactly `POST /data-health/issues/:issueId/dismiss`, `POST /history/:id/data-flag`, `POST /history/:id/edit`, and `POST /sessions/start`.
- [ ] Confirm localStorage remains source of truth and API results never overwrite AppData/localStorage.
- [ ] Confirm next recommended task is `Task 4.65 Session Start Regression Lock V1`.

## Task 4.65 Session Start Regression Lock

- [ ] Use `docs/SESSION_START_REGRESSION_LOCK.md` as the Session Start regression lock.
- [ ] Confirm Task 4.65 does not add a new mutation route.
- [ ] Confirm Session Start remains `POST /sessions/start` only.
- [ ] Confirm active patch, active complete, active discard, DataHealth repair, backup/import/export, reset/recovery, and source-of-truth migration routes remain blocked.
- [ ] Confirm browser mutation routes remain exactly `POST /data-health/issues/:issueId/dismiss`, `POST /history/:id/data-flag`, `POST /history/:id/edit`, and `POST /sessions/start`.
- [ ] Confirm localStorage remains source of truth and API results never overwrite AppData/localStorage.
- [ ] Confirm no fifth mutation is approved.
- [ ] Confirm next recommended task is `Task 4.66 Write-path Four-route Checkpoint V1`.

## Task 4.66 Write-path Four-route Checkpoint

- [ ] Use `docs/WRITE_PATH_FOUR_ROUTE_CHECKPOINT.md` as the four-route checkpoint.
- [ ] Confirm Task 4.66 does not add a new mutation route.
- [ ] Confirm browser mutation routes remain exactly `POST /data-health/issues/:issueId/dismiss`, `POST /history/:id/data-flag`, `POST /history/:id/edit`, and `POST /sessions/start`.
- [ ] Confirm DataHealth dismiss, History data-flag, Limited History Edit, and Session Start are documented as dev-only accepted prototypes.
- [ ] Confirm active patch, active complete, active discard, DataHealth repair, backup/import/export, reset/recovery, and source-of-truth migration routes remain blocked.
- [ ] Confirm localStorage remains source of truth and API results never overwrite AppData/localStorage.
- [ ] Confirm no fifth mutation is approved.
- [ ] Confirm next recommended task is `Task 4.67 Write-path Four-route Manual Regression V1`.

## Task 4.67 Write-path Four-route Manual Regression

- [ ] Use `docs/WRITE_PATH_FOUR_ROUTE_MANUAL_REGRESSION.md` as the four-route manual regression runbook.
- [ ] Confirm Task 4.67 does not add a new mutation route.
- [ ] Confirm browser mutation routes remain exactly `POST /data-health/issues/:issueId/dismiss`, `POST /history/:id/data-flag`, `POST /history/:id/edit`, and `POST /sessions/start`.
- [ ] Confirm DataHealth dismiss, History data-flag, Limited History Edit, and Session Start are each verified under their own experiment flag.
- [ ] Confirm active patch, active complete, active discard, DataHealth repair, backup/import/export, reset/recovery, and source-of-truth migration routes remain blocked.
- [ ] Confirm localStorage remains source of truth and API results never overwrite AppData/localStorage.
- [ ] Confirm no fifth mutation is approved.
- [ ] Confirm next recommended task is `Task 4.68 Write-path Four-route Regression Lock V1`.

## Task 4.68 Write-path Four-route Regression Lock

- [ ] Use `docs/WRITE_PATH_FOUR_ROUTE_REGRESSION_LOCK.md` as the four-route regression lock.
- [ ] Confirm Task 4.68 does not add a new mutation route.
- [ ] Confirm browser mutation routes remain exactly `POST /data-health/issues/:issueId/dismiss`, `POST /history/:id/data-flag`, `POST /history/:id/edit`, and `POST /sessions/start`.
- [ ] Confirm active patch, active complete, active discard, DataHealth repair, backup/import/export, reset/recovery, and source-of-truth migration routes remain blocked.
- [ ] Confirm localStorage remains source of truth and API results never overwrite AppData/localStorage.
- [ ] Confirm no fifth mutation is approved.
- [ ] Confirm next recommended task is `Task 4.69 Phase 4 Source-of-truth Migration Readiness Audit V1`.

## Task 4.69 Phase 4 Source-of-truth Migration Readiness Audit

- [ ] Use `docs/PHASE4_SOURCE_OF_TRUTH_MIGRATION_READINESS_AUDIT.md` as the source-of-truth migration readiness audit.
- [ ] Confirm Task 4.69 does not switch source of truth.
- [ ] Confirm Task 4.69 does not add localStorage replacement.
- [ ] Confirm Task 4.69 does not add API-backed runtime persistence, dual-write, or offline mutation queue.
- [ ] Confirm browser mutation routes remain exactly `POST /data-health/issues/:issueId/dismiss`, `POST /history/:id/data-flag`, `POST /history/:id/edit`, and `POST /sessions/start`.
- [ ] Confirm localStorage remains source of truth and API results never overwrite AppData/localStorage.
- [ ] Confirm next recommended task is `Task 4.70 API-backed Runtime Strategy Plan V1`.

## Task 4.70 API-backed Runtime Strategy Plan

- [ ] Use `docs/API_BACKED_RUNTIME_STRATEGY_PLAN.md` as the API-backed runtime strategy plan.
- [ ] Confirm Task 4.70 does not implement API-backed runtime behavior.
- [ ] Confirm Task 4.70 does not switch source of truth.
- [ ] Confirm Task 4.70 does not add localStorage replacement, dual-write, or offline mutation queue.
- [ ] Confirm browser mutation routes remain exactly `POST /data-health/issues/:issueId/dismiss`, `POST /history/:id/data-flag`, `POST /history/:id/edit`, and `POST /sessions/start`.
- [ ] Confirm localStorage remains source of truth and API results never overwrite AppData/localStorage.
- [ ] Confirm next recommended task is `Task 4.71 Phase 4 Final Data Safety Audit V1`.

## Task 4.71 Phase 4 Final Data Safety Audit

- [ ] Use `docs/PHASE4_FINAL_DATA_SAFETY_AUDIT.md` as the final data safety audit.
- [ ] Confirm Task 4.71 does not add runtime behavior.
- [ ] Confirm accepted routes remain exactly `POST /data-health/issues/:issueId/dismiss`, `POST /history/:id/data-flag`, `POST /history/:id/edit`, and `POST /sessions/start`.
- [ ] Confirm active patch, active complete, active discard, DataHealth repair, backup/import/export, reset/recovery, fifth mutation, and source-of-truth migration remain blocked.
- [ ] Confirm localStorage remains source of truth and API results never overwrite AppData/localStorage.
- [ ] Confirm next recommended task is `Task 4.72 Phase 4 Manual Final Acceptance V1`.

## Task 4.72 Phase 4 Manual Final Acceptance

- [ ] Use `docs/PHASE4_MANUAL_FINAL_ACCEPTANCE.md` as the Phase 4 final manual acceptance runbook.
- [ ] Confirm Task 4.72 does not add runtime behavior.
- [ ] Confirm Dev API runner, read-only diagnostics, DataHealth dismiss, History data-flag, Limited History Edit, and Session Start are covered.
- [ ] Confirm accepted routes remain exactly `POST /data-health/issues/:issueId/dismiss`, `POST /history/:id/data-flag`, `POST /history/:id/edit`, and `POST /sessions/start`.
- [ ] Confirm active patch, active complete, active discard, DataHealth repair, backup/import/export, reset/recovery, fifth mutation, and source-of-truth migration remain blocked.
- [ ] Confirm localStorage remains source of truth and API results never overwrite AppData/localStorage.
- [ ] Confirm next recommended task is `Task 4.73 Phase 4 Exit Regression Lock V1`.

## Task 4.73 Phase 4 Exit Regression Lock

- [ ] Use `docs/PHASE4_EXIT_REGRESSION_LOCK.md` as the Phase 4 exit regression lock.
- [ ] Confirm Task 4.73 does not add runtime behavior.
- [ ] Confirm accepted routes remain exactly `POST /data-health/issues/:issueId/dismiss`, `POST /history/:id/data-flag`, `POST /history/:id/edit`, and `POST /sessions/start`.
- [ ] Confirm active patch, active complete, active discard, DataHealth repair, backup/import/export, reset/recovery, fifth mutation, and source-of-truth migration remain blocked.
- [ ] Confirm localStorage remains source of truth and API results never overwrite AppData/localStorage.
- [ ] Confirm Phase 5 handoff is the only next step.
- [ ] Confirm next recommended task is `Task 4.74 Phase 5 Handoff Plan V1`.

## Task 4.74 Phase 5 Handoff Plan

- [ ] Use `docs/PHASE5_HANDOFF_PLAN.md` as the Phase 5 handoff plan.
- [ ] Confirm Task 4.74 does not start Phase 5 implementation.
- [ ] Confirm source-of-truth migration, API-backed runtime, production backend, auth, sync, and deployment remain prerequisites only.
- [ ] Confirm accepted routes remain exactly `POST /data-health/issues/:issueId/dismiss`, `POST /history/:id/data-flag`, `POST /history/:id/edit`, and `POST /sessions/start`.
- [ ] Confirm localStorage remains source of truth and API results never overwrite AppData/localStorage.
- [ ] Confirm next recommended Phase 4 task is `Task 4.75 Phase 4 Completion & Archive V1`.

## Task 4.75 Phase 4 Completion & Archive

- [ ] Use `docs/PHASE4_COMPLETION_ARCHIVE.md` as the Phase 4 completion archive.
- [ ] Confirm Phase 4 is complete.
- [ ] Confirm Phase 5 is not started automatically.
- [ ] Confirm accepted routes remain exactly `POST /data-health/issues/:issueId/dismiss`, `POST /history/:id/data-flag`, `POST /history/:id/edit`, and `POST /sessions/start`.
- [ ] Confirm active patch, active complete, active discard, DataHealth repair, backup/import/export, reset/recovery, fifth mutation, and source-of-truth migration remain blocked.
- [ ] Confirm localStorage remains source of truth at Phase 4 exit and API results never overwrite AppData/localStorage.
- [ ] Confirm API-backed runtime is Phase 5 work.
- [ ] Confirm production backend, auth, sync, and deployment are Phase 5+ work.
- [ ] Confirm recommended Phase 5 starting task is `Task 5.1 Source-of-truth Migration Architecture Gate V1`.

## Task 5.1 Source-of-truth Migration Architecture Gate

- [ ] Use `docs/SOURCE_OF_TRUTH_MIGRATION_ARCHITECTURE_GATE.md` as the source-of-truth migration architecture gate.
- [ ] Confirm Task 5.1 does not implement source-of-truth migration.
- [ ] Confirm Task 5.1 does not modify `App.tsx`.
- [ ] Confirm Task 5.1 adds no localStorage replacement and no API-backed runtime.
- [ ] Confirm accepted routes remain exactly `POST /data-health/issues/:issueId/dismiss`, `POST /history/:id/data-flag`, `POST /history/:id/edit`, and `POST /sessions/start`.
- [ ] Confirm localStorage remains source of truth and API results never overwrite AppData/localStorage.
- [ ] Confirm production backend, auth, sync, cloud, deployment, and monitoring remain Phase 6+ work.
- [ ] Confirm next recommended task is `Task 5.2 AppData Ownership Matrix V1`.

## Task 5.2 AppData Ownership Matrix

- [ ] Use `docs/APPDATA_OWNERSHIP_MATRIX.md` as the AppData ownership matrix.
- [ ] Confirm training history, active session, program templates, settings, screening profile, DataHealth, backup metadata, readMirror summaries, derived analytics, migration-only state, fallback-only state, and blocked capabilities are classified.
- [ ] Confirm categories include API-owned, local-only, derived, migration-only, fallback-only, and blocked.
- [ ] Confirm Task 5.2 adds no API-backed runtime implementation.
- [ ] Confirm Task 5.2 adds no source-of-truth migration and no localStorage replacement.
- [ ] Confirm accepted routes remain exactly `POST /data-health/issues/:issueId/dismiss`, `POST /history/:id/data-flag`, `POST /history/:id/edit`, and `POST /sessions/start`.
- [ ] Confirm localStorage remains source of truth and API results never overwrite AppData/localStorage.
- [ ] Confirm next recommended task is `Task 5.3 API Client Runtime Strategy V1`.

## Task 5.3 API Client Runtime Strategy

- [ ] Use `docs/API_CLIENT_RUNTIME_STRATEGY.md` as the API client runtime strategy.
- [ ] Confirm typed route clients, read client boundaries, route-specific mutation client boundaries, and no broad mutation client are documented.
- [ ] Confirm error shape, timeout, abort, retry policy, request fingerprint, snapshot metadata handling, and source snapshot strategy are documented.
- [ ] Confirm Task 5.3 adds no API client implementation and no API-backed runtime.
- [ ] Confirm Task 5.3 adds no source-of-truth migration and no localStorage replacement.
- [ ] Confirm accepted routes remain exactly `POST /data-health/issues/:issueId/dismiss`, `POST /history/:id/data-flag`, `POST /history/:id/edit`, and `POST /sessions/start`.
- [ ] Confirm localStorage remains source of truth and API results never overwrite AppData/localStorage.
- [ ] Confirm next recommended task is `Task 5.4 Runtime Source Switch Feature Flag Plan V1`.

## Task 5.4 Runtime Source Switch Feature Flag Plan

- [ ] Use `docs/RUNTIME_SOURCE_SWITCH_FEATURE_FLAG_PLAN.md` as the runtime source switch feature flag plan.
- [ ] Confirm planned modes are `localStorage`, `api-readonly`, and `api-primary-dev`.
- [ ] Confirm `localStorage` remains the default and fallback mode.
- [ ] Confirm non-localStorage modes require explicit dev/local opt-in.
- [ ] Confirm Task 5.4 adds no runtime source selector and no API-backed runtime.
- [ ] Confirm Task 5.4 adds no source-of-truth migration and no localStorage replacement.
- [ ] Confirm accepted routes remain exactly `POST /data-health/issues/:issueId/dismiss`, `POST /history/:id/data-flag`, `POST /history/:id/edit`, and `POST /sessions/start`.
- [ ] Confirm next recommended task is `Task 5.5 Migration Backup & Rollback Strategy V1`.

## Task 5.5 Migration Backup & Rollback Strategy

- [ ] Use `docs/MIGRATION_BACKUP_ROLLBACK_STRATEGY.md` as the migration backup and rollback strategy.
- [ ] Confirm backup-first, localStorage backup, SQLite snapshot backup, dry-run, apply, rollback to localStorage, corrupt snapshot, and schema mismatch handling are documented.
- [ ] Confirm Task 5.5 adds no migration dry-run implementation.
- [ ] Confirm Task 5.5 adds no migration apply implementation.
- [ ] Confirm Task 5.5 does not delete localStorage or auto-switch runtime source.
- [ ] Confirm accepted routes remain exactly `POST /data-health/issues/:issueId/dismiss`, `POST /history/:id/data-flag`, `POST /history/:id/edit`, and `POST /sessions/start`.
- [ ] Confirm localStorage remains source of truth and API results never overwrite AppData/localStorage.
- [ ] Confirm next recommended task is `Task 5.6 Offline / PWA Conflict Strategy V1`.

## Task 5.6 Offline / PWA Conflict Strategy

- [ ] Use `docs/OFFLINE_PWA_CONFLICT_STRATEGY.md` as the offline/PWA conflict strategy.
- [ ] Confirm API unavailable, offline training, active session persistence, visible failure, and conflict diagnostics are documented.
- [ ] Confirm Task 5.6 adds no offline mutation queue, background sync, or queued write replay.
- [ ] Confirm Task 5.6 adds no source-of-truth switch and no API-backed runtime.
- [ ] Confirm accepted routes remain exactly `POST /data-health/issues/:issueId/dismiss`, `POST /history/:id/data-flag`, `POST /history/:id/edit`, and `POST /sessions/start`.
- [ ] Confirm localStorage remains source of truth and API results never overwrite AppData/localStorage.
- [ ] Confirm next recommended task is `Task 5.7 API-backed Read Runtime Plan V1`.

## Task 5.7 API-backed Read Runtime Plan

- [ ] Use `docs/API_BACKED_READ_RUNTIME_PLAN.md` as the API-backed read runtime plan.
- [ ] Confirm boot data from API snapshot, localStorage fallback, API unavailable UI, snapshot metadata display, readMirror parity, and GET-only boundaries are documented.
- [ ] Confirm Task 5.7 adds no API-backed read runtime implementation.
- [ ] Confirm Task 5.7 adds no POST writes and no runtime source switch implementation.
- [ ] Confirm accepted routes remain exactly `POST /data-health/issues/:issueId/dismiss`, `POST /history/:id/data-flag`, `POST /history/:id/edit`, and `POST /sessions/start`.
- [ ] Confirm localStorage remains source of truth and API results never overwrite AppData/localStorage.
- [ ] Confirm next recommended task is `Task 5.8 API-backed Read Client Prototype V1`.

## Task 5.8 API-backed Read Client Prototype

- [ ] Confirm `src/devApi/apiBackedReadConfig.ts`, `src/devApi/apiBackedReadClient.ts`, and `src/devApi/ApiBackedReadDiagnostics.tsx` exist.
- [ ] Confirm the prototype is development/local only and requires `VITE_IRONPATH_RUNTIME_SOURCE=api-readonly`.
- [ ] Confirm the Dev API base URL remains localhost-only.
- [ ] Confirm allowed GET routes are exactly `GET /health`, `GET /app-data/summary`, `GET /sessions/summary`, `GET /history`, `GET /history/:id`, and `GET /data-health/summary`.
- [ ] Confirm no POST write is added by Task 5.8.
- [ ] Confirm no runtime source selector, API-backed persistence adapter, App.tsx mount, source-of-truth migration, localStorage write, or AppData overwrite is added.
- [ ] Confirm accepted browser mutation routes remain exactly `POST /data-health/issues/:issueId/dismiss`, `POST /history/:id/data-flag`, `POST /history/:id/edit`, and `POST /sessions/start`.
- [ ] Confirm localStorage remains source of truth and API results never overwrite AppData/localStorage.
- [ ] Confirm production backend, auth, sync, cloud, deployment, and monitoring remain out of scope.
- [ ] Confirm next recommended task is `Task 5.9 API-backed Read Runtime Acceptance V1`.

## Task 5.9 API-backed Read Runtime Acceptance

- [ ] Use `docs/API_BACKED_READ_RUNTIME_ACCEPTANCE.md` as the API-backed read acceptance record.
- [ ] Confirm API available, API unavailable, malformed response, timeout, abort, missing snapshot metadata, and snapshot mismatch diagnostics are covered.
- [ ] Confirm readMirror parity and localStorage integrity are covered.
- [ ] Confirm allowed GET routes remain exactly `GET /health`, `GET /app-data/summary`, `GET /sessions/summary`, `GET /history`, `GET /history/:id`, and `GET /data-health/summary`.
- [ ] Confirm no POST write is added by Task 5.9.
- [ ] Confirm no runtime source selector, API-backed persistence adapter, App.tsx mount, source-of-truth migration, localStorage write, or AppData overwrite is added.
- [ ] Confirm accepted browser mutation routes remain exactly `POST /data-health/issues/:issueId/dismiss`, `POST /history/:id/data-flag`, `POST /history/:id/edit`, and `POST /sessions/start`.
- [ ] Confirm localStorage remains source of truth and API results never overwrite AppData/localStorage.
- [ ] Confirm next recommended task is `Task 5.10 API-backed Read Manual App Acceptance V1`.

## Task 5.10 API-backed Read Manual App Acceptance

- [ ] Use `docs/API_BACKED_READ_MANUAL_APP_ACCEPTANCE.md` as the human browser runbook.
- [ ] Confirm the runbook requires a dedicated test browser profile and dedicated dev DB.
- [ ] Confirm the runbook warns against real personal training data.
- [ ] Confirm Dev API runner and App dev server commands are included.
- [ ] Confirm `VITE_IRONPATH_RUNTIME_SOURCE=api-readonly` setup and cleanup are included.
- [ ] Confirm DevTools Network GET-only verification is included.
- [ ] Confirm API available and API unavailable fallback scenarios are included.
- [ ] Confirm localStorage integrity and forbidden UI controls checks are included.
- [ ] Confirm no POST write is added by Task 5.10.
- [ ] Confirm accepted browser mutation routes remain exactly `POST /data-health/issues/:issueId/dismiss`, `POST /history/:id/data-flag`, `POST /history/:id/edit`, and `POST /sessions/start`.
- [ ] Confirm localStorage remains source of truth and API results never overwrite AppData/localStorage.
- [ ] Confirm next recommended task is `Task 5.11 API-backed Read Runtime Regression Lock V1`.
