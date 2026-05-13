# IronPath API Contract

Last updated: 2026-05-11

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

Task 4.35 adds `docs/HISTORY_DATA_FLAG_MUTATION_PROTOTYPE_PLAN.md` as History Data-flag Mutation Prototype Plan V1. It is plan-only and does not add browser runtime behavior, `POST /history/:id/data-flag` App wiring, a second mutation prototype, a frontend mutation client, mutation feature flag runtime wiring, source-of-truth switching, production backend, auth, sync, deployment, package changes, lockfile changes, or normalized tables. DataHealth dismiss remains the only implemented browser mutation route.

Task 4.36 adds a dev-only, explicit opt-in History data-flag mutation prototype. It adds only `POST /history/:id/data-flag` as the second single-route browser mutation experiment, guarded by `VITE_IRONPATH_DEV_API_COMPARE="1"` and `VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT="history-data-flag"`. DataHealth dismiss remains intact. The only browser mutation prototypes are now `POST /data-health/issues/:issueId/dismiss` and `POST /history/:id/data-flag`. localStorage remains source of truth, API results never overwrite AppData or localStorage, success requires strict mutation result plus snapshot metadata, and no session/history edit/DataHealth repair/backup/import/export/reset/recovery routes, broad mutation client, production backend, auth, sync, deployment, package changes, lockfile changes, scripts, normalized tables, or training algorithm changes are added.

Task 4.37 adds History Data-flag Prototype Acceptance V1. It is an acceptance/testing layer and manual runbook for the existing Task 4.36 prototype, not an expansion of mutation capability. The browser mutation allowlist remains exactly `POST /data-health/issues/:issueId/dismiss` and `POST /history/:id/data-flag`; localStorage remains source of truth; API results never overwrite AppData or localStorage; no session/history edit/DataHealth repair/backup/import/export/reset/recovery routes, broad mutation client, production backend, auth, sync, deployment, package changes, lockfile changes, scripts, normalized tables, or training algorithm changes are added.

Task 4.38 adds History Data-flag Manual App Acceptance V1. It is a human-run manual App acceptance checklist and docs/static-test layer for the existing Task 4.36/4.37 prototype, not new runtime capability. The browser mutation allowlist remains exactly `POST /data-health/issues/:issueId/dismiss` and `POST /history/:id/data-flag`; localStorage remains source of truth; API results never overwrite AppData or localStorage; no session/history edit/DataHealth repair/backup/import/export/reset/recovery routes, broad mutation client, production backend, auth, sync, deployment, package changes, lockfile changes, scripts, normalized tables, or training algorithm changes are added.

Task 4.39 adds History Data-flag Prototype Hardening V1. It hardens the existing History data-flag prototype only: no new mutation route, no third prototype, no source-of-truth switch, no localStorage overwrite, and no AppData overwrite. The browser mutation allowlist remains exactly `POST /data-health/issues/:issueId/dismiss` and `POST /history/:id/data-flag`. Success shape is strict: HTTP success, `result.ok === true`, `result.changed === true`, `result.status === "success"`, and snapshot metadata are required. no_change, record_not_found, invalid dataFlag, missing snapshot metadata, unavailable, timeout, abort, malformed response, write_failed, transaction_failed, database_closed, snapshot_validation_failed, repository_schema_mismatch, requiresConfirmation, and unsupported_route remain no-fake-success failures.

Task 4.40 adds `docs/WRITE_PATH_TWO_ROUTE_CHECKPOINT.md` as Write-path Two-route Checkpoint V1. It is checkpoint/audit documentation and static tests only, not new runtime capability. The accepted browser mutation routes are exactly `POST /data-health/issues/:issueId/dismiss` and `POST /history/:id/data-flag`; no third browser mutation route is approved. localStorage remains source of truth, API results never overwrite AppData or localStorage, and production backend/auth/sync/deployment, package changes, lockfile changes, package scripts, normalized tables, source-of-truth migration, and broad write-path migration remain blocked.

Task 4.41 adds `docs/WRITE_PATH_TWO_ROUTE_MANUAL_REGRESSION.md` as Write-path Two-route Manual Regression V1. It is manual regression documentation and static tests only, not new runtime capability. Browser mutation routes remain exactly `POST /data-health/issues/:issueId/dismiss` and `POST /history/:id/data-flag`; no third route is added or approved. localStorage remains source of truth, API results never overwrite AppData or localStorage, and production backend/auth/sync/deployment, package changes, lockfile changes, package scripts, normalized tables, source-of-truth migration, and broad write-path migration remain blocked.

Task 4.42 adds `docs/WRITE_PATH_TWO_ROUTE_REGRESSION_LOCK.md` as Write-path Two-route Regression Lock V1. It is a regression/testing layer only, not new runtime capability. Browser mutation routes remain exactly `POST /data-health/issues/:issueId/dismiss` and `POST /history/:id/data-flag`; no third route is added or approved. localStorage remains source of truth, API results never overwrite AppData or localStorage, and production backend/auth/sync/deployment, package changes, lockfile changes, package scripts, normalized tables, source-of-truth migration, and broad write-path migration remain blocked.

Task 4.43 adds `docs/THIRD_MUTATION_CANDIDATE_READINESS_AUDIT.md` as Third Mutation Candidate Readiness Audit V1. It is audit-only and docs/static-test only: no third mutation route is added, App.tsx and src/devApi runtime behavior remain unchanged, no frontend mutation client is added, localStorage remains source of truth, and API results never overwrite AppData or localStorage. Browser mutation routes remain exactly `POST /data-health/issues/:issueId/dismiss` and `POST /history/:id/data-flag`. Limited history edit is the only plausible future third candidate, but it is planning-only for `Task 4.44 Limited History Edit Mutation Prototype Plan V1`; Task 4.43 does not recommend direct implementation.

Task 4.44 adds `docs/LIMITED_HISTORY_EDIT_MUTATION_PROTOTYPE_PLAN.md` as Limited History Edit Mutation Prototype Plan V1. It is planning-only and docs/static-test only: `POST /history/:id/edit` remains blocked from browser runtime, no third mutation route is added, no browser allowlist expansion occurs, App.tsx and src/devApi runtime behavior remain unchanged, localStorage remains source of truth, and API results never overwrite AppData or localStorage. The plan defines field-level constraints for a possible future one-set history edit route and rejects broad history edit, source-of-truth migration, production backend/auth/sync/deployment, dependencies, scripts, lockfile changes, normalized tables, and training algorithm changes.

Task 4.45 adds `docs/LIMITED_HISTORY_EDIT_MUTATION_READINESS_GATE.md` as Limited History Edit Mutation Prototype Readiness Gate V1. It is gate-only and docs/static-test only: no third mutation route is added, `POST /history/:id/edit` remains blocked from browser runtime, App.tsx and src/devApi runtime behavior remain unchanged, localStorage remains source of truth, and API results never overwrite AppData or localStorage. Task 4.45 result is ready for a user-approved implementation prompt, but not direct implementation. Task 4.46 Limited History Edit Mutation Prototype V1 requires explicit user approval and must not auto-start.

Task 4.55 adds `docs/FOURTH_MUTATION_CANDIDATE_READINESS_AUDIT.md` as Fourth Mutation Candidate Readiness Audit V1. It is audit-only and docs/static-test only: no fourth mutation route is added, App.tsx and src/devApi runtime behavior remain unchanged, no frontend mutation client is added, localStorage remains source of truth, and API results never overwrite AppData or localStorage. Browser mutation routes remain exactly `POST /data-health/issues/:issueId/dismiss`, `POST /history/:id/data-flag`, and `POST /history/:id/edit`. Active-session mutation is only a future planning candidate area for `Task 4.56 Active Session Mutation Readiness & Recovery Plan V1`; Task 4.55 does not recommend direct implementation.

Task 4.56 adds `docs/ACTIVE_SESSION_MUTATION_READINESS_RECOVERY_PLAN.md` as Active Session Mutation Readiness & Recovery Plan V1. It is planning-only and docs/static-test only: no active-session mutation is implemented, no fourth mutation route is added, App.tsx and src/devApi runtime behavior remain unchanged, no frontend mutation client is added, localStorage remains source of truth, and API results never overwrite AppData or localStorage. Browser mutation routes remain exactly `POST /data-health/issues/:issueId/dismiss`, `POST /history/:id/data-flag`, and `POST /history/:id/edit`. Session start, patch, complete, and discard routes remain blocked from browser runtime, and no automatic next task is approved without explicit user approval.

Task 4.57 adds `docs/ACTIVE_SESSION_SOURCE_SNAPSHOT_IDEMPOTENCY_PLAN.md` as Active Session Source Snapshot & Idempotency Plan V1. It is planning-only and docs/static-test only: no active-session route is implemented, no fourth mutation route is added, and browser mutation routes remain exactly `POST /data-health/issues/:issueId/dismiss`, `POST /history/:id/data-flag`, and `POST /history/:id/edit`. The plan defines required `sourceSnapshotHash`, `sourceSnapshotVersion`, `mutationId`, `idempotencyKey`, and `requestFingerprint` metadata for any future session-start prototype while keeping localStorage as source of truth and preventing API results from overwriting AppData or localStorage.

Task 4.58 adds `docs/ACTIVE_SESSION_UX_CONFIRMATION_ROLLBACK_PLAN.md` as Active Session UX Confirmation & Rollback Plan V1. It is planning-only and docs/static-test only: no active-session route is implemented, no fourth mutation route is added, App.tsx and src/devApi runtime behavior remain unchanged, and browser mutation routes remain exactly `POST /data-health/issues/:issueId/dismiss`, `POST /history/:id/data-flag`, and `POST /history/:id/edit`. The plan locks future session-start confirmation, pending, duplicate-submit, visible failure, no optimistic success, no auto-retry, rollback, and local App fallback requirements while keeping localStorage as source of truth and preventing API results from overwriting AppData or localStorage.

Task 4.59 adds `docs/SESSION_START_MUTATION_PROTOTYPE_PLAN.md` as Session Start Mutation Prototype Plan V1. It is planning-only and docs/static-test only: `POST /sessions/start` remains blocked from browser runtime, no fourth mutation route is added, App.tsx and src/devApi runtime behavior remain unchanged, and browser mutation routes remain exactly `POST /data-health/issues/:issueId/dismiss`, `POST /history/:id/data-flag`, and `POST /history/:id/edit`. The plan defines the future route, request payload metadata, source snapshot/idempotency/fingerprint gates, confirmation UX, duplicate start prevention, strict no-fake-success, recovery behavior, and manual acceptance plan for a possible Task 4.60 implementation.

Task 4.60 adds a dev-only, explicit opt-in Session Start mutation prototype. It adds exactly one browser mutation route: `POST /sessions/start`. Browser mutation routes are now exactly `POST /data-health/issues/:issueId/dismiss`, `POST /history/:id/data-flag`, `POST /history/:id/edit`, and `POST /sessions/start`. The prototype is guarded by DEV, read-only compare, `VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT="session-start"`, localhost-only Dev API base URL, source snapshot metadata, idempotency metadata, and explicit confirmation. localStorage remains source of truth; API results never overwrite AppData or localStorage; no active patch, complete, discard, repair, backup/import/export, reset/recovery, broad mutation client, source-of-truth migration, production backend, auth, sync, deployment, package change, lockfile change, package script, normalized table, or training algorithm change is added.

Task 4.61 adds `docs/SESSION_START_PROTOTYPE_ACCEPTANCE.md` as Session Start Prototype Acceptance V1. It is acceptance documentation and test coverage for the existing Task 4.60 prototype, not new runtime capability. Browser mutation routes remain exactly `POST /data-health/issues/:issueId/dismiss`, `POST /history/:id/data-flag`, `POST /history/:id/edit`, and `POST /sessions/start`. localStorage remains source of truth; API results never overwrite AppData or localStorage; no active patch, complete, discard, repair, backup/import/export, reset/recovery, broad mutation client, production backend, auth, sync, deployment, package change, lockfile change, package script, normalized table, source-of-truth migration, or training algorithm change is added.

Task 4.62 adds `docs/SESSION_START_MANUAL_APP_ACCEPTANCE.md` as Session Start Manual App Acceptance V1. It is a human-run manual browser acceptance runbook and docs/static-test layer for the existing Task 4.60 prototype, not new runtime capability. Browser mutation routes remain exactly `POST /data-health/issues/:issueId/dismiss`, `POST /history/:id/data-flag`, `POST /history/:id/edit`, and `POST /sessions/start`. localStorage remains source of truth; API results never overwrite AppData or localStorage; active patch, complete, discard, repair, backup/import/export, reset/recovery, broad mutation client, production backend, auth, sync, deployment, package change, lockfile change, package script, normalized table, source-of-truth migration, and training algorithm changes remain blocked.

Task 4.63 adds `docs/SESSION_START_PROTOTYPE_HARDENING.md` as Session Start Prototype Hardening V1. It hardens the existing Task 4.60 prototype only: no new mutation route is added, browser mutation routes remain exactly `POST /data-health/issues/:issueId/dismiss`, `POST /history/:id/data-flag`, `POST /history/:id/edit`, and `POST /sessions/start`, and active patch/complete/discard remain blocked. Hardening locks duplicate-submit/pending behavior, missing source snapshot/idempotency failure, active_session_exists failure, missing snapshot metadata failure, unavailable/timeout/abort/malformed response failure, repository error failure, confirmation reset, no localStorage write, and no AppData mutation.

Task 4.64 Session Start Observability & Recovery Notes V1 adds `docs/SESSION_START_OBSERVABILITY_RECOVERY_NOTES.md` as safe observability and manual recovery guidance for the existing Task 4.60 prototype. It adds no runtime capability and no browser reset/recovery action. Browser mutation routes remain exactly `POST /data-health/issues/:issueId/dismiss`, `POST /history/:id/data-flag`, `POST /history/:id/edit`, and `POST /sessions/start`. Safe diagnostics may expose state, redacted target reference, source snapshot/idempotency presence, snapshot metadata presence, HTTP status, failure code, duplicate-submit blocked flag, timestamps, and a safe recovery note only. Raw stack traces, raw API responses, AppData dumps, localStorage dumps, SQLite internals, active patch, active complete, active discard, repair, backup/import/export, reset/recovery, broad mutation client, production backend, auth, sync, deployment, source-of-truth migration, and training algorithm changes remain blocked.

Task 4.65 Session Start Regression Lock V1 adds `docs/SESSION_START_REGRESSION_LOCK.md` as a regression-lock and decision record for the existing Task 4.60 prototype. It adds no runtime capability and no new route. Browser mutation routes remain exactly `POST /data-health/issues/:issueId/dismiss`, `POST /history/:id/data-flag`, `POST /history/:id/edit`, and `POST /sessions/start`. Active patch, active complete, active discard, DataHealth repair, backup/import/export, reset/recovery, broad mutation client, production backend, auth, sync, deployment, source-of-truth migration, localStorage replacement, package change, lockfile change, package script, normalized table, and training algorithm changes remain blocked.

Task 4.66 Write-path Four-route Checkpoint V1 adds `docs/WRITE_PATH_FOUR_ROUTE_CHECKPOINT.md` as a checkpoint/audit document and static-test layer for the current four dev-only mutation prototypes. It adds no runtime capability and no new route. Browser mutation routes remain exactly `POST /data-health/issues/:issueId/dismiss`, `POST /history/:id/data-flag`, `POST /history/:id/edit`, and `POST /sessions/start`. Active patch, active complete, active discard, DataHealth repair, backup/import/export, reset/recovery, broad mutation client, production backend, auth, sync, deployment, source-of-truth migration, localStorage replacement, package change, lockfile change, package script, normalized table, and training algorithm changes remain blocked.

Task 4.67 Write-path Four-route Manual Regression V1 adds `docs/WRITE_PATH_FOUR_ROUTE_MANUAL_REGRESSION.md` as a manual regression runbook and static-test layer for validating all four dev-only mutation prototypes together in one local App and Dev API session. It adds no runtime capability and no new route. Browser mutation routes remain exactly `POST /data-health/issues/:issueId/dismiss`, `POST /history/:id/data-flag`, `POST /history/:id/edit`, and `POST /sessions/start`. Active patch, active complete, active discard, DataHealth repair, backup/import/export, reset/recovery, broad mutation client, production backend, auth, sync, deployment, source-of-truth migration, localStorage replacement, package change, lockfile change, package script, normalized table, and training algorithm changes remain blocked.

Task 4.68 Write-path Four-route Regression Lock V1 adds `docs/WRITE_PATH_FOUR_ROUTE_REGRESSION_LOCK.md` as a regression-lock and decision record for the current four dev-only mutation prototypes. It adds no runtime capability and no new route. Browser mutation routes remain exactly `POST /data-health/issues/:issueId/dismiss`, `POST /history/:id/data-flag`, `POST /history/:id/edit`, and `POST /sessions/start`. Active patch, active complete, active discard, DataHealth repair, backup/import/export, reset/recovery, broad mutation client, production backend, auth, sync, deployment, source-of-truth migration, localStorage replacement, package change, lockfile change, package script, normalized table, and training algorithm changes remain blocked. The next task is an audit-only source-of-truth migration readiness review.

Task 4.69 Phase 4 Source-of-truth Migration Readiness Audit V1 adds `docs/PHASE4_SOURCE_OF_TRUTH_MIGRATION_READINESS_AUDIT.md` as audit-only documentation and static boundary coverage. It does not switch source of truth, replace localStorage, add API-backed runtime persistence, add dual-write, add offline mutation queue, add production backend/auth/sync/deployment, or add another mutation route. Browser mutation routes remain exactly `POST /data-health/issues/:issueId/dismiss`, `POST /history/:id/data-flag`, `POST /history/:id/edit`, and `POST /sessions/start`.

Task 4.70 API-backed Runtime Strategy Plan V1 adds `docs/API_BACKED_RUNTIME_STRATEGY_PLAN.md` as planning-only documentation and static boundary coverage. It does not implement API-backed runtime behavior, switch source of truth, replace localStorage, add dual-write, add offline mutation queue, add production backend/auth/sync/deployment, or add another mutation route. Browser mutation routes remain exactly `POST /data-health/issues/:issueId/dismiss`, `POST /history/:id/data-flag`, `POST /history/:id/edit`, and `POST /sessions/start`.

Task 4.71 Phase 4 Final Data Safety Audit V1 adds `docs/PHASE4_FINAL_DATA_SAFETY_AUDIT.md` as audit-only documentation and static boundary coverage. It records accepted routes, blocked routes, source-of-truth lock, localStorage integrity, no-fake-success lock, backup/import safety, readMirror parity, and runtime boundary. It does not add runtime behavior, switch source of truth, replace localStorage, add API-backed runtime behavior, add production backend/auth/sync/deployment, or add another mutation route.

Task 4.72 Phase 4 Manual Final Acceptance V1 adds `docs/PHASE4_MANUAL_FINAL_ACCEPTANCE.md` as manual final acceptance documentation and static boundary coverage. It covers the Dev API runner, read-only diagnostics, all four accepted mutation prototypes, route boundaries, localStorage integrity, failure recovery, cleanup/env reset, browser build safety, and pass/fail recording. It does not add runtime behavior, switch source of truth, replace localStorage, add API-backed runtime behavior, add production backend/auth/sync/deployment, or add another mutation route.

Task 4.73 Phase 4 Exit Regression Lock V1 adds `docs/PHASE4_EXIT_REGRESSION_LOCK.md` as the Phase 4 exit regression lock and static boundary coverage. It locks the final accepted route allowlist, blocked route list, localStorage source-of-truth, browser build isolation, no production/auth/sync/deployment, no source-of-truth migration, and Phase 5 handoff-only next step. It does not add runtime behavior or another mutation route.

Task 4.74 Phase 5 Handoff Plan V1 adds `docs/PHASE5_HANDOFF_PLAN.md` as handoff-only planning documentation and static boundary coverage. It records Phase 4 final state, source-of-truth migration prerequisites, API-backed runtime prerequisites, production/auth/sync prerequisites, a risk register, and the recommended Phase 5 first task. It does not start Phase 5 implementation, switch source of truth, replace localStorage, add API-backed runtime behavior, add production backend/auth/sync/deployment, or add another mutation route.

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

## History Data-flag Mutation Prototype Plan

Owner files:

- `docs/HISTORY_DATA_FLAG_MUTATION_PROTOTYPE_PLAN.md`
- `tests/historyDataFlagMutationPrototypePlan.test.ts`
- `tests/historyDataFlagMutationBoundaryStillBlocked.test.ts`

Task 4.35 creates a concrete future prototype plan for `POST /history/:id/data-flag`. It is planning and static-test coverage only.

Plan facts:

- No second mutation is implemented.
- DataHealth dismiss remains the only implemented browser mutation route.
- `POST /history/:id/data-flag` remains future prototype candidate only.
- The plan defines `normal`, `test`, and `excluded` semantics and keeps test/excluded records excluded from default production-like statistics.
- The plan records impact on history list/detail, calendar summaries, session summaries, readMirror output, DataHealth report context, PR/e1RM, effectiveSet/weighted effectiveSet, audit/editHistory, and backup export/import semantic safety.
- `identityInvalid` semantics remain unchanged.
- `actualWeightKg` remains the trusted calculation source.
- No training algorithm, template, scheduler, PR, e1RM, effectiveSet, backup/import/export, storage, package, schema, auth, sync, deployment, or production backend behavior changes.
- localStorage remains source of truth.
- API results never overwrite AppData or localStorage.

Write-path migration remains blocked after Task 4.35. The next recommended task is `Task 4.36 History Data-flag Mutation Prototype V1` only if gates are accepted.

## History Data-flag Mutation Prototype

Owner files:

- `src/devApi/devApiHistoryDataFlagConfig.ts`
- `src/devApi/devApiHistoryDataFlagClient.ts`
- `src/devApi/DevApiHistoryDataFlagPrototype.tsx`
- `tests/devApiHistoryDataFlagConfig.test.ts`
- `tests/devApiHistoryDataFlagClient.test.ts`
- `tests/devApiHistoryDataFlagPrototype.test.ts`
- `tests/devApiHistoryDataFlagBoundary.test.ts`
- `tests/devApiHistoryDataFlagServerParity.test.ts`
- `tests/devApiHistoryDataFlagSemantics.test.ts`

Task 4.36 implements `POST /history/:id/data-flag` as a dev-only explicit opt-in one-route prototype.

Contract facts:

- The browser prototype is enabled only in DEV when read-only comparison is enabled and `VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT` is `history-data-flag`.
- The browser sends only the server-compatible body `{ dataFlag }`.
- Accepted target values are `normal`, `test`, and `excluded`.
- `normal` records participate in default statistics; `test` and `excluded` records remain visible but excluded from default production-like statistics.
- Success requires HTTP success, `result.ok === true`, `result.changed === true`, `result.status === "success"`, and snapshot metadata.
- Missing snapshot metadata, no-change, record-not-found, invalid dataFlag, unavailable, timeout, abort, malformed response, write failure, transaction failure, database closed, unsupported route, and source fingerprint failure remain failure states.
- The prototype does not update localStorage, call `saveData` or `loadData`, mutate AppData, or auto-apply API results locally.
- The only browser mutation prototypes are `POST /data-health/issues/:issueId/dismiss` and `POST /history/:id/data-flag`.
- No session mutation, history edit, DataHealth repair, backup/import/export/reset/recovery HTTP route, broad mutation client, production backend, auth, sync, deployment, package dependency, package script, lockfile change, normalized table, or training algorithm change is added.

Write-path migration remains blocked after Task 4.36. The next recommended task is `Task 4.37 History Data-flag Prototype Acceptance V1`.

## History Data-flag Prototype Acceptance

Owner files:

- `docs/HISTORY_DATA_FLAG_PROTOTYPE_ACCEPTANCE.md`
- `tests/devApiHistoryDataFlagAcceptanceFlagMatrix.test.ts`
- `tests/devApiHistoryDataFlagAcceptanceInteraction.test.ts`
- `tests/devApiHistoryDataFlagAcceptanceNoFakeSuccess.test.ts`
- `tests/devApiHistoryDataFlagAcceptanceFailureStates.test.ts`
- `tests/devApiHistoryDataFlagAcceptanceSourceOfTruth.test.ts`
- `tests/devApiHistoryDataFlagAcceptanceSemantics.test.ts`
- `tests/devApiHistoryDataFlagAcceptanceBoundary.test.ts`
- `tests/devApiHistoryDataFlagManualAcceptanceDocs.test.ts`

Task 4.37 accepts the existing Task 4.36 History data-flag prototype with automated tests and a human-run runbook.

Acceptance facts:

- The flag matrix keeps the prototype disabled unless DEV, read-only comparison, and `VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT="history-data-flag"` are all active.
- DataHealth dismiss and History data-flag experiment flags remain isolated.
- A stable target history record is required before any request can be sent.
- Confirmation is required before any POST, cancel prevents POST, pending disables duplicate submit, and retry after failure requires explicit re-confirmation.
- Success requires HTTP success, `result.ok === true`, `result.changed === true`, `result.status === "success"`, and snapshot metadata.
- Missing snapshot metadata, no-change, record-not-found, invalid dataFlag, requires-confirmation, unsupported-route, unavailable, timeout, abort, malformed response, write failure, transaction failure, and database-closed cases must not show success.
- localStorage remains the active App source of truth.
- API results never overwrite AppData or localStorage, and snapshot metadata is not stored in localStorage by the prototype.
- `normal`, `test`, and `excluded` remain the only accepted dataFlag values; test and excluded records remain visible but excluded from default production-like statistics.
- Browser mutation routes remain exactly `POST /data-health/issues/:issueId/dismiss` and `POST /history/:id/data-flag`.
- No session mutation, history edit, DataHealth repair, backup/import/export/reset/recovery HTTP route, broad mutation client, production backend, auth, sync, deployment, package dependency, package script, lockfile change, normalized table, or training algorithm change is added.

Write-path migration remains blocked after Task 4.37. The next recommended task is `Task 4.38 History Data-flag Manual App Acceptance V1` or `Task 4.38 History Data-flag Prototype Hardening V1`.

## History Data-flag Manual App Acceptance

Owner files:

- `docs/HISTORY_DATA_FLAG_MANUAL_APP_ACCEPTANCE.md`
- `tests/historyDataFlagManualAppAcceptanceDocs.test.ts`
- `tests/historyDataFlagManualAppAcceptanceDocsParity.test.ts`
- `tests/historyDataFlagManualAppAcceptanceBoundary.test.ts`

Task 4.38 adds manual App acceptance documentation and docs/static boundary tests for the existing History data-flag prototype.

Manual acceptance facts:

- A dedicated test browser profile is required.
- Real personal training data must not be used.
- The manual flow uses `npm run api:dev`, `npm run dev`, browser DevTools Network, a dedicated dev DB file, and explicit env flags.
- The flag matrix confirms compare-only, mutation-only, DataHealth-dismiss flag, and production-like states do not enable the History data-flag prototype.
- A stable target history record is required for success testing.
- Confirmation is required before the History data-flag POST, cancel prevents POST, and pending state must block duplicate submits.
- Success is accepted only after HTTP 2xx, mutation success, `changed=true`, `status="success"`, and snapshot metadata.
- Failure states must not show success, auto-retry, write localStorage, or replace AppData.
- `normal`, `test`, and `excluded` semantics remain locked; test and excluded records remain visible but excluded from default production-like statistics.
- Browser Network must show only read-only GET routes plus accepted prototype POST routes after explicit confirmation.
- Browser mutation routes remain exactly `POST /data-health/issues/:issueId/dismiss` and `POST /history/:id/data-flag`.
- API results never overwrite AppData or localStorage.
- No session mutation, history edit, DataHealth repair, backup/import/export/reset/recovery HTTP route, broad mutation client, production backend, auth, sync, deployment, package dependency, package script, lockfile change, normalized table, or training algorithm change is added.

Write-path migration remains blocked after Task 4.38. The next recommended task is `Task 4.39 History Data-flag Prototype Hardening V1` or `Task 4.39 Write-path Two-Route Checkpoint V1`.

## History Data-flag Prototype Hardening

Owner files:

- `src/devApi/DevApiHistoryDataFlagPrototype.tsx`
- `src/devApi/devApiHistoryDataFlagClient.ts`
- `src/devApi/devApiHistoryDataFlagConfig.ts`
- `tests/devApiHistoryDataFlagHardeningNoFakeSuccess.test.ts`
- `tests/devApiHistoryDataFlagHardeningFailureStates.test.ts`
- `tests/devApiHistoryDataFlagHardeningConcurrency.test.tsx`
- `tests/devApiHistoryDataFlagHardeningConfirmation.test.tsx`
- `tests/devApiHistoryDataFlagHardeningSemantics.test.ts`
- `tests/devApiHistoryDataFlagHardeningBoundary.test.ts`
- `tests/devApiHistoryDataFlagHardeningDocsParity.test.ts`

Task 4.39 hardens the existing Task 4.36 History data-flag prototype with no-fake-success, failure-state, duplicate-submit, abort/unmount, confirmation reset, data semantics, docs parity, and route-boundary tests.

- This is hardening/testing only and does not add runtime capability beyond the existing History data-flag route.
- Browser mutation routes remain exactly `POST /data-health/issues/:issueId/dismiss` and `POST /history/:id/data-flag`.
- Success requires HTTP success, `result.ok === true`, `result.changed === true`, `result.status === "success"`, and snapshot metadata.
- Missing snapshot metadata, no_change, record_not_found, invalid dataFlag, requiresConfirmation, unsupported_route, API unavailable, timeout, abort, malformed response, write_failed, transaction_failed, database_closed, snapshot_validation_failed, and repository_schema_mismatch are failures.
- localStorage remains source of truth and API results never overwrite AppData or localStorage.
- `normal`, `test`, and `excluded` semantics remain locked; test and excluded records stay visible but excluded from default production-like statistics.
- No session mutation, history edit, DataHealth repair, backup/import/export/reset/recovery route, broad mutation client, production backend, auth, sync, deployment, package change, lockfile change, package script, normalized table, source-of-truth switch, localStorage replacement, or training algorithm change is added.

Write-path migration remains blocked after Task 4.39. The next recommended task is `Task 4.40 Write-path Two-route Checkpoint V1` or `Task 4.40 Second-route Observability & Recovery Notes V1`.

## Task 4.40: Write-path Two-route Checkpoint V1

Task 4.40 checkpoints the complete dev-only two-route write-path prototype state after DataHealth dismiss and History data-flag hardening. It adds `docs/WRITE_PATH_TWO_ROUTE_CHECKPOINT.md` and static/docs tests only.

- Browser mutation routes remain exactly `POST /data-health/issues/:issueId/dismiss` and `POST /history/:id/data-flag`.
- This is checkpoint/audit coverage, not new runtime capability and not a third mutation route.
- DataHealth dismiss remains implemented, accepted, manually accepted, hardened, observable/recoverable, regression locked, dev-only, and localStorage-source-of-truth.
- History data-flag remains planned, implemented, accepted, manually accepted, hardened, semantics-locked, dev-only, and localStorage-source-of-truth.
- Both prototypes preserve strict no-fake-success behavior, snapshot metadata success requirements, duplicate-submit prevention, confirmation, visible failure states, no localStorage writes, and no AppData overwrite.
- Session mutation, history edit, DataHealth repair, backup/import/export/reset/recovery routes, broad mutation clients, API-backed persistence, offline mutation queues, production backend/auth/sync/deployment, package changes, lockfile changes, package scripts, normalized tables, source-of-truth migration, and training algorithm changes remain blocked.

Write-path migration remains blocked after Task 4.40. The next recommended task is `Task 4.41 Write-path Two-route Manual Regression V1`.

## Task 4.41: Write-path Two-route Manual Regression V1

Task 4.41 adds a manual regression runbook for validating DataHealth dismiss and History data-flag together in one local App and Dev API session. It adds documentation and static tests only.

- Browser mutation routes remain exactly `POST /data-health/issues/:issueId/dismiss` and `POST /history/:id/data-flag`.
- This is manual regression coverage, not new runtime capability and not a third mutation route.
- The runbook covers read-only compare startup, DataHealth dismiss flag flow, History data-flag flag flow, mutation experiment isolation, DevTools Network boundaries, no-fake-success behavior, localStorage integrity, failure recovery, cleanup/env reset, and browser build safety.
- DataHealth dismiss and History data-flag remain single-route dev-only prototypes in their own flows.
- Session mutation, history edit, DataHealth repair, backup/import/export/reset/recovery routes, broad mutation clients, API-backed persistence, offline mutation queues, production backend/auth/sync/deployment, package changes, lockfile changes, package scripts, normalized tables, source-of-truth migration, and training algorithm changes remain blocked.

Write-path migration remains blocked after Task 4.41. The next recommended task is `Task 4.42 Third Mutation Candidate Readiness Audit V1` or `Task 4.42 Write-path Two-route Regression Lock V1`.

## Task 4.42: Write-path Two-route Regression Lock V1

Task 4.42 locks the current two-route write-path prototype state after the DataHealth dismiss and History data-flag lines, the two-route checkpoint, and the two-route manual regression runbook. It adds documentation and static tests only.

- Browser mutation routes remain exactly `POST /data-health/issues/:issueId/dismiss` and `POST /history/:id/data-flag`.
- This is regression-lock coverage, not new runtime capability and not a third mutation route.
- Both prototypes remain dev-only, explicit opt-in, route-specific, no-fake-success locked, snapshot-metadata guarded, duplicate-submit guarded, and localStorage-source-of-truth.
- Session mutation, history edit, DataHealth repair, backup/import/export/reset/recovery routes, broad mutation clients, API-backed persistence, offline mutation queues, production backend/auth/sync/deployment, package changes, lockfile changes, package scripts, normalized tables, source-of-truth migration, and training algorithm changes remain blocked.

Write-path migration remains blocked after Task 4.42. The next recommended task is `Task 4.43 Third Mutation Candidate Readiness Audit V1`, audit-only.

## Task 4.43: Third Mutation Candidate Readiness Audit V1

Task 4.43 audits possible third browser mutation candidates after the two-route regression lock. It adds `docs/THIRD_MUTATION_CANDIDATE_READINESS_AUDIT.md` and static tests only.

- Browser mutation routes remain exactly `POST /data-health/issues/:issueId/dismiss` and `POST /history/:id/data-flag`.
- No third mutation route is added or approved.
- Limited history edit, route `POST /history/:id/edit`, is the only plausible future third candidate for planning.
- Limited history edit is not implemented and not approved for direct implementation.
- Session mutations, DataHealth repair, backup/import/export over HTTP, reset/recovery over HTTP, and source-of-truth migration remain blocked.
- localStorage remains source of truth.
- API results never overwrite AppData or localStorage.
- There is no production backend, auth, sync, deployment, package dependency, package script, lockfile change, normalized table, broad mutation client, offline mutation queue, or API-backed persistence adapter.

Write-path migration remains blocked after Task 4.43. The next recommended task is `Task 4.44 Limited History Edit Mutation Prototype Plan V1`, planning-only. Task 4.44 must not implement `POST /history/:id/edit`; it must define field-level constraints and reject broad history edit.

## Task 4.44: Limited History Edit Mutation Prototype Plan V1

Task 4.44 creates a planning-only future prototype plan for limited history edit. It adds `docs/LIMITED_HISTORY_EDIT_MUTATION_PROTOTYPE_PLAN.md` and static tests only.

- Browser mutation routes remain exactly `POST /data-health/issues/:issueId/dismiss` and `POST /history/:id/data-flag`.
- `POST /history/:id/edit` remains blocked from browser runtime.
- No third mutation route is added or approved.
- No App.tsx integration, src/devApi runtime behavior, frontend mutation client, or feature flag runtime wiring is added.
- The plan constrains a possible future edit to one existing set in one existing history session.
- Allowed future patch fields are limited to set load, display weight/unit, reps, RIR, technique quality, pain flag, and note, with `exerciseId` and `setId` as locators only.
- Broad history edit, whole-session patches, arbitrary JSON paths, dataFlag edits, session mutations, DataHealth repair, backup/import/export/reset/recovery, source-of-truth migration, production backend/auth/sync/deployment, dependencies, scripts, lockfile changes, normalized tables, and training algorithm changes remain blocked.
- localStorage remains source of truth.
- API results never overwrite AppData or localStorage.

Write-path migration remains blocked after Task 4.44. There is no automatic next task. A future implementation task remains blocked until a later user-approved single-route prototype task explicitly defines implementation files, gates, validation, and rollback.

## Task 4.45: Limited History Edit Mutation Prototype Readiness Gate V1

Task 4.45 creates a readiness gate for the possible future limited history edit prototype. It adds `docs/LIMITED_HISTORY_EDIT_MUTATION_READINESS_GATE.md` and static tests only.

- Browser mutation routes remain exactly `POST /data-health/issues/:issueId/dismiss` and `POST /history/:id/data-flag`.
- `POST /history/:id/edit` remains blocked from browser runtime.
- No third mutation route is added or approved.
- No App.tsx integration, src/devApi runtime behavior, frontend mutation client, broad mutation client, or feature flag runtime wiring is added.
- No server contract, server handler, serverAdapter, httpRuntimeAdapter, sqliteRepository, source-of-truth, storage, training algorithm, package, lockfile, script, dependency, production backend, auth, sync, deployment, or normalized-table change is added.
- Field constraints from Task 4.44 are sufficient for a future single-route implementation plan, and broad history edit remains rejected.
- Future implementation must keep source snapshot and conflict checks, strict no-fake-success semantics, calculation impact review, audit before/after display, and manual acceptance gates.
- localStorage remains source of truth.
- API results never overwrite AppData or localStorage.

Task 4.45 result: Ready for a user-approved implementation prompt, but not direct implementation. The next recommended task is `Task 4.46 Limited History Edit Mutation Prototype V1` only with explicit user approval. Task 4.46 must not be auto-started.

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

## Task 4.46: Limited History Edit Mutation Prototype V1

Task 4.46 adds a dev-only, explicit opt-in, one-route Limited History Edit browser mutation prototype.

Implemented route:

- `POST /history/:id/edit`

Accepted browser mutation allowlist is now exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`

The App source of truth remains localStorage. API results never overwrite AppData or localStorage. The browser prototype sends only server-compatible `exerciseId`, `setId`, `patch`, and optional `reason`; frontend metadata remains local diagnostics.

Success requires HTTP success, `result.ok === true`, `result.changed === true`, `result.status === "success"`, and snapshot metadata. Missing snapshot metadata, no_change, record_not_found, exercise_not_found, set_not_found, invalid patch, validation failure, source snapshot mismatch, write failure, transaction failure, database_closed, and unsupported_route are failures in the browser prototype.

No session mutation, DataHealth repair, backup/import/export/reset/recovery route, production backend, auth, sync, deployment, package dependency, package script, lockfile change, normalized table, broad mutation client, source-of-truth switch, localStorage replacement, offline queue, or training algorithm change is added.

## Task 4.47: Limited History Edit Prototype Acceptance V1

Task 4.47 adds acceptance tests and `docs/LIMITED_HISTORY_EDIT_PROTOTYPE_ACCEPTANCE.md` for the existing Task 4.46 prototype.

No new mutation route is added. Browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`

The acceptance contract locks flag matrix isolation, stable target selection, confirmation, pending duplicate-submit behavior, strict no-fake-success, source-of-truth integrity, field constraints, data semantics, route boundary, and manual cleanup/build-safety checks.

Task 4.48 Limited History Edit Manual App Acceptance V1 is the next recommended task.

## Task 4.48: Limited History Edit Manual App Acceptance V1

Task 4.48 adds `docs/LIMITED_HISTORY_EDIT_MANUAL_APP_ACCEPTANCE.md` for human-run App acceptance of the existing dev-only Limited History Edit prototype.

No new mutation route is added. Runtime write capability remains limited to:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`

The manual acceptance contract covers disposable data, localhost-only Dev API, required flags, target session/exercise/set, confirmation, pending duplicate-submit, success, failure/no-fake-success, field constraints, data semantics, localStorage integrity, network route boundary, forbidden UI controls, cleanup, and browser build safety.

Task 4.49 Limited History Edit Prototype Hardening V1 is the next recommended task.

## Task 4.49: Limited History Edit Prototype Hardening V1

Task 4.49 adds `docs/LIMITED_HISTORY_EDIT_PROTOTYPE_HARDENING.md` and regression coverage that hardens the existing dev-only Limited History Edit prototype.

No new mutation route is added. Runtime write capability remains limited to:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`

The hardening contract locks strict no-fake-success behavior, required snapshot metadata, source fingerprint diagnostics, confirmation and pending duplicate-submit behavior, source-of-truth integrity, field constraints, data semantics, and browser build isolation.

localStorage remains source of truth. API results never overwrite AppData or localStorage. No session mutation, DataHealth repair, backup/import/export/reset/recovery route, production backend, auth, sync, deployment, package dependency, package script, lockfile change, normalized table, broad mutation client, offline queue, source-of-truth switch, or training algorithm change is added.

Task 4.50 Limited History Edit Observability & Recovery Notes V1 is the next recommended task.

## Task 4.50: Limited History Edit Observability & Recovery Notes V1

Task 4.50 adds `docs/LIMITED_HISTORY_EDIT_OBSERVABILITY_RECOVERY_NOTES.md` plus observability/recovery tests for the existing dev-only Limited History Edit prototype.

No new mutation route is added. Runtime write capability remains limited to:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`

The observability contract allows only safe diagnostic fields: mutation state, redacted target reference, source fingerprint presence, snapshot metadata presence, HTTP status, failure code, duplicate-submit blocked flag, timestamps, and safe recovery note. It must not expose raw API responses, raw stack traces, full AppData, localStorage dumps, SQLite internals, environment objects, or unrestricted server errors.

Manual recovery remains outside browser write capability: disable the mutation experiment flag, stop the Dev API runner, rerun read-only diagnostics, and make a dev DB copy before inspection if persistence may be inconsistent. The browser prototype adds no reset/recovery action.

localStorage remains the active App source of truth. API results never overwrite AppData or localStorage. No session mutation, DataHealth repair, backup/import/export/reset/recovery route, production backend, auth, sync, deployment, package dependency, package script, lockfile change, normalized table, broad mutation client, offline queue, source-of-truth switch, or training algorithm change is added.

Task 4.51 Limited History Edit Regression Lock V1 is the next recommended task.

## Task 4.51: Limited History Edit Regression Lock V1

Task 4.51 adds `docs/LIMITED_HISTORY_EDIT_REGRESSION_LOCK.md` and regression-lock tests for the existing dev-only Limited History Edit prototype.

No new mutation route is added. Runtime write capability remains limited to:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`

The regression lock freezes Limited History Edit as the third dev-only browser mutation prototype after planning, readiness gate, explicit approval, implementation, acceptance, manual acceptance, hardening, and observability/recovery notes.

Allowed Limited History Edit patch fields remain exactly `weightKg`, `displayWeight`, `displayUnit`, `reps`, `rir`, `techniqueQuality`, `painFlag`, and `note`. Broad edit fields, dataFlag through edit route, session mutation, DataHealth repair, backup/import/export/reset/recovery routes, and fourth mutation routes remain blocked.

localStorage remains the active App source of truth. API results never overwrite AppData or localStorage. No production backend, auth, sync, deployment, package dependency, package script, lockfile change, normalized table, broad mutation client, offline queue, source-of-truth switch, or training algorithm change is added.

Task 4.52 Write-path Three-route Checkpoint V1 is the next recommended task.

## Task 4.52: Write-path Three-route Checkpoint V1

Task 4.52 adds `docs/WRITE_PATH_THREE_ROUTE_CHECKPOINT.md` as a checkpoint/audit for the current three-route write-path prototype state.

No new mutation route is added. Runtime write capability remains limited to:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`

The checkpoint records DataHealth dismiss, History data-flag, and Limited History Edit as dev-only, explicit opt-in, route-specific prototypes with strict no-fake-success behavior, snapshot metadata success requirements, duplicate-submit prevention, confirmation, visible failure states, no localStorage writes, and no AppData overwrite.

localStorage remains the active App source of truth. API results never overwrite AppData or localStorage. No session mutation, DataHealth repair, backup/import/export/reset/recovery route, fourth mutation route, production backend, auth, sync, deployment, package dependency, package script, lockfile change, normalized table, broad mutation client, offline queue, source-of-truth switch, or training algorithm change is added.

Task 4.53 Write-path Three-route Manual Regression V1 is the next recommended task.

## Task 4.53: Write-path Three-route Manual Regression V1

Task 4.53 adds `docs/WRITE_PATH_THREE_ROUTE_MANUAL_REGRESSION.md` as a manual regression runbook for validating all three accepted dev-only mutation prototypes in one local App and Dev API session.

No new mutation route is added. Runtime write capability remains limited to:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`

The runbook covers dedicated test data, Dev API runner startup, read-only compare startup, DataHealth dismiss flow, History data-flag flow, Limited History Edit flow, mutation experiment isolation, DevTools Network route boundary, no-fake-success behavior, localStorage integrity, forbidden controls, failure recovery, cleanup, and browser build safety.

localStorage remains the active App source of truth. API results never overwrite AppData or localStorage. No session mutation, DataHealth repair, backup/import/export/reset/recovery route, fourth mutation route, production backend, auth, sync, deployment, package dependency, package script, lockfile change, normalized table, broad mutation client, offline queue, source-of-truth switch, or training algorithm change is added.

Task 4.54 Write-path Three-route Regression Lock V1 is the next recommended task.

## Task 4.54: Write-path Three-route Regression Lock V1

Task 4.54 adds `docs/WRITE_PATH_THREE_ROUTE_REGRESSION_LOCK.md` as the regression lock for the current three-route write-path prototype state.

No new mutation route is added. Runtime write capability remains limited to:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`

The regression lock freezes DataHealth dismiss, History data-flag, and Limited History Edit as the only accepted dev-only browser mutation prototypes. All remain explicit opt-in, route-specific, no-fake-success locked, snapshot-metadata guarded, duplicate-submit guarded, confirmation-gated where they mutate data, localStorage-source-of-truth, and browser-build isolated.

localStorage remains the active App source of truth. API results never overwrite AppData or localStorage. No session mutation, DataHealth repair, backup/import/export/reset/recovery route, fourth mutation route, production backend, auth, sync, deployment, package dependency, package script, lockfile change, normalized table, broad mutation client, offline queue, source-of-truth switch, or training algorithm change is added.

Task 4.55 Fourth Mutation Candidate Readiness Audit V1 is the next recommended task. It must be audit/planning only and must not implement a fourth mutation.

## Task 4.55: Fourth Mutation Candidate Readiness Audit V1

Task 4.55 adds `docs/FOURTH_MUTATION_CANDIDATE_READINESS_AUDIT.md` as a fourth mutation candidate readiness audit and decision record.

No fourth mutation route is added. Runtime write capability remains limited to:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`

The audit evaluates session start, session patches, session complete, session discard, DataHealth repair, backup/import/export over HTTP, reset/recovery over HTTP, source-of-truth migration, and the option to continue three-route hardening without a fourth mutation.

The result is audit-only: do not implement a fourth mutation next. Active-session mutation is the only plausible future product-value candidate area, but only for planning. The next recommended task is `Task 4.56 Active Session Mutation Readiness & Recovery Plan V1`, planning-only. It must not implement `POST /sessions/start`, `POST /sessions/active/patches`, `POST /sessions/active/complete`, or `POST /sessions/active/discard`.

localStorage remains the active App source of truth. API results never overwrite AppData or localStorage. No DataHealth repair, backup/import/export/reset/recovery route, fourth mutation route, production backend, auth, sync, deployment, package dependency, package script, lockfile change, normalized table, broad mutation client, offline queue, source-of-truth switch, localStorage replacement, or training algorithm change is added.

## Task 4.56: Active Session Mutation Readiness & Recovery Plan V1

Task 4.56 adds `docs/ACTIVE_SESSION_MUTATION_READINESS_RECOVERY_PLAN.md` as a planning-only readiness and recovery plan for possible future active-session mutation work.

No active-session mutation is implemented. Runtime write capability remains limited to:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`

The plan defines required gates for active-session recovery, source snapshot strategy, idempotency, duplicate-submit prevention, patch sequencing, offline failure behavior, confirmation UX, rollback/recovery UX, no-fake-success behavior, data semantics impact, and manual acceptance planning.

The plan does not implement `POST /sessions/start`, `POST /sessions/active/patches`, `POST /sessions/active/complete`, or `POST /sessions/active/discard`. It does not add a fourth browser mutation route.

localStorage remains the active App source of truth. API results never overwrite AppData or localStorage. No production backend, auth, sync, deployment, package dependency, package script, lockfile change, normalized table, broad mutation client, offline queue, source-of-truth switch, localStorage replacement, or training algorithm change is added.

No automatic next task is approved by Task 4.56. Any future active-session prototype plan requires explicit user approval before starting.

## Task 4.57: Active Session Source Snapshot & Idempotency Plan V1

Task 4.57 adds `docs/ACTIVE_SESSION_SOURCE_SNAPSHOT_IDEMPOTENCY_PLAN.md` as a planning-only source snapshot and idempotency plan for future active-session work.

No active-session route is implemented. Runtime write capability remains limited to:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`

The plan defines `sourceSnapshotHash`, `sourceSnapshotVersion`, `mutationId`, `idempotencyKey`, `requestFingerprint`, activeSession target identity, planTemplate/session-start target identity, duplicate start prevention, duplicate patch/complete/discard risks, conflict detection, no auto-merge, no localStorage overwrite, no AppData overwrite, and no-fake-success gates.

localStorage remains source of truth. API results never overwrite AppData or localStorage. Task 4.57 adds no production backend, auth, sync, deployment, package dependency, package script, lockfile change, normalized table, broad mutation client, offline queue, source-of-truth switch, localStorage replacement, or training algorithm change.

The next recommended task is `Task 4.58 Active Session UX Confirmation & Rollback Plan V1`, docs/static-tests only.

## Task 4.58: Active Session UX Confirmation & Rollback Plan V1

Task 4.58 adds `docs/ACTIVE_SESSION_UX_CONFIRMATION_ROLLBACK_PLAN.md` as a planning-only confirmation, pending, failure, rollback, and recovery UX plan for future active-session work.

No active-session route is implemented. Runtime write capability remains limited to:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`

The plan requires explicit start confirmation, duplicate start protection, visible pending state, visible safe failure, no optimistic success, no automatic retry, App usability on Dev API failure, rollback by disabling the mutation experiment flag, and local App fallback from localStorage.

localStorage remains source of truth. API results never overwrite AppData or localStorage. Task 4.58 adds no production backend, auth, sync, deployment, package dependency, package script, lockfile change, normalized table, broad mutation client, offline queue, source-of-truth switch, localStorage replacement, or training algorithm change.

The next recommended task is `Task 4.59 Session Start Mutation Prototype Plan V1`, docs/static-tests only.

## Task 4.59: Session Start Mutation Prototype Plan V1

Task 4.59 adds `docs/SESSION_START_MUTATION_PROTOTYPE_PLAN.md` as a planning-only future prototype plan for `POST /sessions/start`.

No session-start route is implemented. Runtime write capability remains limited to:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`

The plan defines the future one-route session-start scope, required opt-in flags, accepted request payload shape, `sourceSnapshotHash`, `sourceSnapshotVersion`, `mutationId`, `idempotencyKey`, `requestFingerprint`, target identity, confirmation UX, duplicate start prevention, strict no-fake-success contract, manual recovery behavior, and manual acceptance plan.

localStorage remains source of truth. API results never overwrite AppData or localStorage. Task 4.59 adds no production backend, auth, sync, deployment, package dependency, package script, lockfile change, normalized table, broad mutation client, offline queue, source-of-truth switch, localStorage replacement, active patch, active complete, active discard, or training algorithm change.

The next recommended task is `Task 4.60 Session Start Mutation Prototype V1` only if gates pass.

## Task 4.60: Session Start Mutation Prototype V1

Task 4.60 adds the fourth dev-only browser mutation prototype.

Implemented route:

- `POST /sessions/start`

Accepted browser mutation allowlist is now exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`

The App source of truth remains localStorage. API results never overwrite AppData or localStorage. The browser prototype sends `templateId`, `sourceSnapshotHash`, `sourceSnapshotVersion`, `mutationId`, `idempotencyKey`, `requestFingerprint`, and `confirmed: true` to the existing Dev API session-start route.

The prototype is default-off and enabled only in DEV when read-only comparison is enabled, `VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT` is `session-start`, the base URL is localhost-only, no local active session exists, a stable target template exists, source snapshot metadata exists, idempotency metadata exists, and the user explicitly confirms.

Success requires HTTP success, `result.ok === true`, `result.changed === true`, `result.status === "success"`, and snapshot metadata. Missing snapshot metadata, active_session_exists, template_not_found, source snapshot missing, idempotency missing, requiresConfirmation, unsupported_route, unavailable, timeout, abort, malformed response, write_failed, transaction_failed, and database_closed are failures.

No active patch, active complete, active discard, DataHealth repair, backup/import/export/reset/recovery route, production backend, auth, sync, deployment, package dependency, package script, lockfile change, normalized table, broad mutation client, offline queue, source-of-truth switch, localStorage replacement, or training algorithm change is added.

The next recommended task is `Task 4.61 Session Start Prototype Acceptance V1`.

## Task 4.61: Session Start Prototype Acceptance V1

Task 4.61 adds `docs/SESSION_START_PROTOTYPE_ACCEPTANCE.md` and acceptance tests for the existing Task 4.60 Session Start prototype.

No new mutation route is added. Runtime write capability remains limited to:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`

Acceptance locks flag matrix isolation, no-stable-target behavior, confirmation/cancel, pending duplicate-submit behavior, strict no-fake-success, localStorage integrity, route boundary, blocked active patch/complete/discard routes, and manual runbook requirements.

localStorage remains source of truth. API results never overwrite AppData or localStorage. Task 4.61 adds no production backend, auth, sync, deployment, package dependency, package script, lockfile change, normalized table, broad mutation client, offline queue, source-of-truth switch, localStorage replacement, or training algorithm change.

The next recommended task is `Task 4.62 Session Start Manual App Acceptance V1`.

## Task 4.62: Session Start Manual App Acceptance V1

Task 4.62 adds `docs/SESSION_START_MANUAL_APP_ACCEPTANCE.md` as the human-run browser manual acceptance runbook for the existing Session Start prototype.

No new mutation route is added. Runtime write capability remains limited to:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`

The runbook requires a dedicated test browser profile, dedicated dev DB, no real personal training data, flag matrix checks, confirmation/cancel checks, duplicate start checks, strict success/no-fake-success checks, localStorage integrity checks, DevTools Network route boundary checks, cleanup/env reset, and browser build safety.

localStorage remains source of truth. API results never overwrite AppData or localStorage. Task 4.62 adds no production backend, auth, sync, deployment, package dependency, package script, lockfile change, normalized table, broad mutation client, offline queue, source-of-truth switch, localStorage replacement, active patch, active complete, active discard, or training algorithm change.

The next recommended task is `Task 4.63 Session Start Prototype Hardening V1`.

## Task 4.63: Session Start Prototype Hardening V1

Task 4.63 adds `docs/SESSION_START_PROTOTYPE_HARDENING.md` and hardening tests for the existing Session Start prototype.

No new mutation route is added. Runtime write capability remains limited to:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`

Hardening locks strict no-fake-success behavior, required snapshot metadata, source snapshot and idempotency metadata, active_session_exists failure, missing target failure, unavailable, timeout, abort, malformed response, write_failed, transaction_failed, database_closed, duplicate-submit/pending behavior, confirmation requirements, no localStorage write, no AppData mutation, and route boundary.

localStorage remains source of truth. API results never overwrite AppData or localStorage. Task 4.63 adds no production backend, auth, sync, deployment, package dependency, package script, lockfile change, normalized table, broad mutation client, offline queue, source-of-truth switch, localStorage replacement, active patch, active complete, active discard, or training algorithm change.

The next recommended task is `Task 4.64 Session Start Observability & Recovery Notes V1`.

## Task 4.64: Session Start Observability & Recovery Notes V1

Task 4.64 adds `docs/SESSION_START_OBSERVABILITY_RECOVERY_NOTES.md` and observability/recovery tests for the existing Session Start prototype.

No new mutation route is added. Runtime write capability remains limited to:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`

Observability is limited to safe diagnostic fields: mutation state, redacted target reference, source snapshot/idempotency presence, snapshot metadata presence, HTTP status, failure code, duplicate-submit blocked flag, timestamps, and safe recovery note. Failure mapping remains manual and dev-only; unavailable, timeout, abort, malformed response, missing snapshot metadata, source snapshot missing, idempotency missing, active_session_exists, write_failed, transaction_failed, database_closed, and unsupported_route do not show success.

localStorage remains the active App source of truth. API results never overwrite AppData or localStorage. Task 4.64 adds no browser reset/recovery action, production backend, auth, sync, deployment, package dependency, package script, lockfile change, normalized table, broad mutation client, offline queue, source-of-truth switch, localStorage replacement, active patch, active complete, active discard, or training algorithm change.

The next recommended task is `Task 4.65 Session Start Regression Lock V1`.

## Task 4.65: Session Start Regression Lock V1

Task 4.65 adds `docs/SESSION_START_REGRESSION_LOCK.md` and regression-lock tests for the existing Session Start prototype.

No new mutation route is added. Runtime write capability remains limited to:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`

The Session Start route remains one-route-only and dev-only. It requires the session-start mutation flag, compare flag, localhost Dev API base URL, source snapshot metadata, mutation id, idempotency key, request fingerprint, and explicit confirmation. It does not implement active patch, active complete, active discard, repair, backup/import/export, reset/recovery, broad mutation client, or source-of-truth migration.

localStorage remains current source of truth. API results never overwrite AppData or localStorage. Task 4.65 adds no production backend, auth, sync, deployment, package dependency, package script, lockfile change, normalized table, broad mutation client, offline queue, source-of-truth switch, localStorage replacement, active patch, active complete, active discard, or training algorithm change.

The next recommended task is `Task 4.66 Write-path Four-route Checkpoint V1`.

## Task 4.66: Write-path Four-route Checkpoint V1

Task 4.66 adds `docs/WRITE_PATH_FOUR_ROUTE_CHECKPOINT.md` and checkpoint tests for the current four-route write-path prototype state.

No new mutation route is added. Runtime write capability remains limited to:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`

The checkpoint records DataHealth dismiss, History data-flag, Limited History Edit, and Session Start as accepted dev-only prototypes. It keeps active patch, active complete, active discard, DataHealth repair, backup/import/export, reset/recovery, broad mutation client, source-of-truth migration, and production backend/auth/sync/deployment blocked.

localStorage remains current source of truth. API results never overwrite AppData or localStorage. Task 4.66 adds no package dependency, package script, lockfile change, normalized table, storage adapter change, schema change, runtime behavior change, or training algorithm change.

The next recommended task is `Task 4.67 Write-path Four-route Manual Regression V1`.

## Task 4.67: Write-path Four-route Manual Regression V1

Task 4.67 adds `docs/WRITE_PATH_FOUR_ROUTE_MANUAL_REGRESSION.md` and manual-regression static tests for the current four-route write-path prototype state.

No new mutation route is added. Runtime write capability remains limited to:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`

The runbook validates read-only diagnostics, DataHealth dismiss, History data-flag, Limited History Edit, and Session Start in one local App and Dev API session. It covers experiment isolation, DevTools Network route boundary, no-fake-success, localStorage integrity, failure recovery, cleanup/env reset, and browser build safety.

localStorage remains source of truth. API results never overwrite AppData or localStorage. Task 4.67 adds no package dependency, package script, lockfile change, normalized table, storage adapter change, schema change, runtime behavior change, or training algorithm change.

The next recommended task is `Task 4.68 Write-path Four-route Regression Lock V1`.

## Task 4.68: Write-path Four-route Regression Lock V1

Task 4.68 adds `docs/WRITE_PATH_FOUR_ROUTE_REGRESSION_LOCK.md` and regression-lock tests for the current four-route write-path prototype state.

No new mutation route is added. Runtime write capability remains limited to:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`

The regression lock keeps active patch, active complete, active discard, DataHealth repair, backup/import/export, reset/recovery, broad mutation client, source-of-truth migration implementation, API-backed runtime persistence, and production backend/auth/sync/deployment blocked.

localStorage remains current source of truth. API results never overwrite AppData or localStorage. Task 4.68 adds no package dependency, package script, lockfile change, normalized table, storage adapter change, schema change, runtime behavior change, or training algorithm change.

The next recommended task is `Task 4.69 Phase 4 Source-of-truth Migration Readiness Audit V1`.

## Task 4.69: Phase 4 Source-of-truth Migration Readiness Audit V1

Task 4.69 adds `docs/PHASE4_SOURCE_OF_TRUTH_MIGRATION_READINESS_AUDIT.md` and static boundary tests.

Phase 4 is not ready to switch source of truth. localStorage remains source of truth. API results never overwrite AppData or localStorage. No API-backed runtime persistence, dual-write, offline mutation queue, production backend, auth, sync, deployment, normalized tables, storage adapter change, schema change, runtime behavior change, or training algorithm change is added.

Runtime write capability remains limited to:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`

The next recommended task is `Task 4.70 API-backed Runtime Strategy Plan V1`.

## Task 4.70: API-backed Runtime Strategy Plan V1

Task 4.70 adds `docs/API_BACKED_RUNTIME_STRATEGY_PLAN.md` and static boundary tests.

The plan covers localStorage fallback models, migration approach, feature flag strategy, read/write client architecture, offline strategy, rollback strategy, and production/auth/sync assumptions. It is planning-only and adds no API-backed runtime behavior.

localStorage remains source of truth. API results never overwrite AppData or localStorage. Runtime write capability remains limited to:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`

The next recommended task is `Task 4.71 Phase 4 Final Data Safety Audit V1`.

## Task 4.71: Phase 4 Final Data Safety Audit V1

Task 4.71 adds `docs/PHASE4_FINAL_DATA_SAFETY_AUDIT.md` and final data safety boundary tests.

The audit covers accepted routes, blocked routes, source-of-truth lock, localStorage integrity, no-fake-success, backup/import safety, readMirror parity, and runtime boundary.

localStorage remains source of truth. API results never overwrite AppData or localStorage. Runtime write capability remains limited to:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`

The next recommended task is `Task 4.72 Phase 4 Manual Final Acceptance V1`.

## Task 4.72: Phase 4 Manual Final Acceptance V1

Task 4.72 adds `docs/PHASE4_MANUAL_FINAL_ACCEPTANCE.md` and final manual-acceptance boundary tests.

The runbook covers the Dev API runner, read-only diagnostics, DataHealth dismiss, History data-flag, Limited History Edit, Session Start, route boundaries, localStorage integrity, no-fake-success, failure recovery, cleanup/env reset, browser build safety, and pass/fail recording.

localStorage remains source of truth. API results never overwrite AppData or localStorage. Runtime write capability remains limited to:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`

The next recommended task is `Task 4.73 Phase 4 Exit Regression Lock V1`.

## Task 4.73: Phase 4 Exit Regression Lock V1

Task 4.73 adds `docs/PHASE4_EXIT_REGRESSION_LOCK.md` and Phase 4 exit regression-lock tests.

The lock covers the final accepted route allowlist, final blocked route list, localStorage source-of-truth, browser build isolation, no production/auth/sync/deployment, no source-of-truth migration, and Phase 5 handoff-only next step.

localStorage remains source of truth. API results never overwrite AppData or localStorage. Runtime write capability remains limited to:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`

The next recommended task is `Task 4.74 Phase 5 Handoff Plan V1`.

## Task 4.74: Phase 5 Handoff Plan V1

Task 4.74 adds `docs/PHASE5_HANDOFF_PLAN.md` and Phase 5 handoff boundary tests.

The handoff records Phase 4 final state, source-of-truth migration prerequisites, API-backed runtime prerequisites, production/auth/sync prerequisites, risk register, and recommended Phase 5 first task.

localStorage remains source of truth. API results never overwrite AppData or localStorage. Runtime write capability remains limited to:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`

The next recommended Phase 4 task is `Task 4.75 Phase 4 Completion & Archive V1`.

## Task 4.75: Phase 4 Completion & Archive V1

Task 4.75 adds `docs/PHASE4_COMPLETION_ARCHIVE.md` and completion/archive boundary tests.

Phase 4 is complete. Do not start Phase 5 automatically.

Runtime write capability remains limited to:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`

localStorage remains source of truth at Phase 4 exit. API results never overwrite AppData or localStorage.

API-backed runtime is Phase 5 work. production backend, auth, sync, and deployment are Phase 5+ work. Task 4.75 adds no package dependency, package script, lockfile change, normalized table, storage adapter change, schema change, runtime behavior change, source-of-truth migration, or mutation route.

The recommended Phase 5 starting task is `Task 5.1 Source-of-truth Migration Architecture Gate V1`.

## Task 5.1: Source-of-truth Migration Architecture Gate V1

Task 5.1 adds `docs/SOURCE_OF_TRUTH_MIGRATION_ARCHITECTURE_GATE.md` and source-of-truth migration gate boundary tests.

This is an architecture gate only. No source-of-truth migration, API-backed runtime, App.tsx integration, localStorage replacement, package dependency, package script, lockfile change, normalized table, production backend, auth, sync, cloud, deployment, monitoring, or browser mutation route is added.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`

localStorage remains source of truth. API results never overwrite AppData or localStorage.

The next recommended task is `Task 5.2 AppData Ownership Matrix V1`.

## Task 5.2: AppData Ownership Matrix V1

Task 5.2 adds `docs/APPDATA_OWNERSHIP_MATRIX.md` and AppData ownership matrix boundary tests.

This is ownership planning only. It classifies training history, active session, program templates, settings, screening profile, DataHealth, backup metadata, readMirror summaries, derived analytics, migration-only state, fallback-only state, and blocked capabilities. It does not implement API-backed runtime, source-of-truth migration, localStorage replacement, App.tsx integration, storage adapters, package changes, production backend, auth, sync, cloud, deployment, monitoring, or a browser mutation route.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`

localStorage remains source of truth. API results never overwrite AppData or localStorage.

The next recommended task is `Task 5.3 API Client Runtime Strategy V1`.

## Task 5.3: API Client Runtime Strategy V1

Task 5.3 adds `docs/API_CLIENT_RUNTIME_STRATEGY.md` and API client runtime strategy boundary tests.

This is strategy-only. It plans typed route clients, GET-only read client boundaries, route-specific mutation client boundaries, safe error shape, timeout, abort, retry policy, request fingerprint, snapshot metadata handling, and source snapshot strategy. It adds no API client implementation, broad mutation client, API-backed runtime, source-of-truth migration, localStorage replacement, App.tsx integration, package changes, production backend, auth, sync, cloud, deployment, monitoring, or browser mutation route.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`

localStorage remains source of truth. API results never overwrite AppData or localStorage.

The next recommended task is `Task 5.4 Runtime Source Switch Feature Flag Plan V1`.

## Task 5.4: Runtime Source Switch Feature Flag Plan V1

Task 5.4 adds `docs/RUNTIME_SOURCE_SWITCH_FEATURE_FLAG_PLAN.md` and runtime source switch boundary tests.

This is feature-flag planning only. It plans `localStorage`, `api-readonly`, and `api-primary-dev` runtime source modes, keeps `localStorage` as default, requires explicit dev/local opt-in for non-localStorage modes, and defines fallback behavior. It adds no runtime source selector, API-backed runtime, source-of-truth migration, localStorage replacement, App.tsx integration, storage adapter, package change, production backend, auth, sync, cloud, deployment, monitoring, or browser mutation route.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`

localStorage remains source of truth. API results never overwrite AppData or localStorage.

The next recommended task is `Task 5.5 Migration Backup & Rollback Strategy V1`.

## Task 5.5: Migration Backup & Rollback Strategy V1

Task 5.5 adds `docs/MIGRATION_BACKUP_ROLLBACK_STRATEGY.md` and migration backup/rollback boundary tests.

This is strategy-only. It plans localStorage backup, SQLite snapshot backup, dry-run behavior, apply behavior, rollback to localStorage, corrupt snapshot handling, schema mismatch handling, and the backup-first rule. It adds no migration dry-run implementation, migration apply implementation, SQLite snapshot write, localStorage deletion, localStorage replacement, API-backed runtime, source-of-truth migration, App.tsx integration, package changes, production backend, auth, sync, cloud, deployment, monitoring, or browser mutation route.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`

localStorage remains source of truth. API results never overwrite AppData or localStorage.

The next recommended task is `Task 5.6 Offline / PWA Conflict Strategy V1`.

## Task 5.6: Offline / PWA Conflict Strategy V1

Task 5.6 adds `docs/OFFLINE_PWA_CONFLICT_STRATEGY.md` and offline/PWA conflict boundary tests.

This is strategy-only. It plans API unavailable behavior, offline training behavior, active session persistence risk handling, visible failure states, conflict diagnostics, and the decision that no full offline mutation queue is approved by this task. It adds no offline mutation queue, background sync, queued write replay, API-backed runtime, source-of-truth migration, localStorage replacement, App.tsx integration, package changes, production backend, auth, sync, cloud, deployment, monitoring, or browser mutation route.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`

localStorage remains source of truth. API results never overwrite AppData or localStorage.

The next recommended task is `Task 5.7 API-backed Read Runtime Plan V1`.

## Task 5.7: API-backed Read Runtime Plan V1

Task 5.7 adds `docs/API_BACKED_READ_RUNTIME_PLAN.md` and API-backed read runtime boundary tests.

This is planning-only. It plans boot data from API snapshot, localStorage fallback, API unavailable UI, snapshot metadata display, readMirror parity, GET-only boundaries, and source-switch boundaries. It adds no API-backed read runtime implementation, API client implementation, POST write, runtime source selection, source-of-truth migration, localStorage replacement, App.tsx integration, package changes, production backend, auth, sync, cloud, deployment, monitoring, or browser mutation route.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`

localStorage remains source of truth. API results never overwrite AppData or localStorage.

The next recommended task is `Task 5.8 API-backed Read Client Prototype V1`.

## Task 5.8: API-backed Read Client Prototype V1

Task 5.8 adds a dev/local GET-only API-backed read client prototype.

Added browser-facing prototype files:

- `src/devApi/apiBackedReadConfig.ts`
- `src/devApi/apiBackedReadClient.ts`
- `src/devApi/ApiBackedReadDiagnostics.tsx`

The prototype is explicit opt-in only:

- development mode only.
- `VITE_IRONPATH_RUNTIME_SOURCE=api-readonly`.
- localhost-only `VITE_IRONPATH_DEV_API_BASE_URL`.

Accepted API-backed read routes are:

- `GET /health`
- `GET /app-data/summary`
- `GET /sessions/summary`
- `GET /history`
- `GET /history/:id`
- `GET /data-health/summary`

This task adds no POST write, no runtime source selector, no API-backed persistence adapter, no App.tsx integration, no source-of-truth migration, no localStorage write, no AppData overwrite, no package change, no production backend, no auth, no sync, no cloud, no deployment, and no browser mutation route.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`

localStorage remains source of truth. API results never overwrite AppData or localStorage.

The next recommended task is `Task 5.9 API-backed Read Runtime Acceptance V1`.

## Task 5.9: API-backed Read Runtime Acceptance V1

Task 5.9 adds acceptance documentation and tests for the Task 5.8 dev/local GET-only API-backed read client prototype.

Acceptance covers:

- API available.
- API unavailable.
- malformed response.
- timeout and abort.
- missing snapshot metadata.
- snapshot mismatch diagnostics.
- readMirror parity.
- localStorage integrity.
- GET-only route boundary.
- browser build safety.

Accepted API-backed read routes remain:

- `GET /health`
- `GET /app-data/summary`
- `GET /sessions/summary`
- `GET /history`
- `GET /history/:id`
- `GET /data-health/summary`

This task adds no POST write, no runtime source selector, no API-backed persistence adapter, no App.tsx integration, no source-of-truth migration, no localStorage write, no AppData overwrite, no package change, no production backend, no auth, no sync, no cloud, no deployment, and no browser mutation route.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`

localStorage remains source of truth. API results never overwrite AppData or localStorage.

The next recommended task is `Task 5.10 API-backed Read Manual App Acceptance V1`.

## Task 5.10: API-backed Read Manual App Acceptance V1

Task 5.10 adds `docs/API_BACKED_READ_MANUAL_APP_ACCEPTANCE.md` as a human browser runbook for the dev/local GET-only API-backed read prototype.

The runbook covers:

- dedicated test browser profile.
- dedicated dev DB.
- Dev API runner startup.
- App dev server startup with `VITE_IRONPATH_RUNTIME_SOURCE=api-readonly`.
- DevTools Network GET-only verification.
- API available scenario.
- API unavailable fallback scenario.
- localStorage integrity check.
- forbidden UI controls check.
- cleanup and env reset.
- pass/fail template.

This task adds no POST write, no runtime source selector, no API-backed persistence adapter, no App.tsx integration, no source-of-truth migration, no localStorage write, no AppData overwrite, no package change, no production backend, no auth, no sync, no cloud, no deployment, and no browser mutation route.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`

localStorage remains source of truth. API results never overwrite AppData or localStorage.

The next recommended task is `Task 5.11 API-backed Read Runtime Regression Lock V1`.

## Task 5.11: API-backed Read Runtime Regression Lock V1

Task 5.11 adds `docs/API_BACKED_READ_RUNTIME_REGRESSION_LOCK.md` as the regression lock for the dev/local GET-only API-backed read prototype.

The lock covers:

- exact GET-only route list.
- no POST writes.
- no runtime source selector.
- no API-backed persistence adapter.
- localStorage/AppData integrity.
- API unavailable, timeout, abort, malformed response, and server error behavior.
- coverage inventory.
- manual acceptance inventory.
- browser Node-only boundary.

Accepted API-backed read routes remain:

- `GET /health`
- `GET /app-data/summary`
- `GET /sessions/summary`
- `GET /history`
- `GET /history/:id`
- `GET /data-health/summary`

This task adds no POST write, no runtime source selector, no API-backed persistence adapter, no App.tsx integration, no source-of-truth migration, no localStorage write, no AppData overwrite, no package change, no production backend, no auth, no sync, no cloud, no deployment, and no browser mutation route.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`

localStorage remains source of truth. API results never overwrite AppData or localStorage.

The next recommended task is `Task 5.12 Active Session Write Coverage Gap Audit V1`.

## Task 5.12: Active Session Write Coverage Gap Audit V1

Task 5.12 adds `docs/ACTIVE_SESSION_WRITE_COVERAGE_GAP_AUDIT.md` as an audit-only review of remaining active-session browser write gaps.

Gap routes:

- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

These routes remain blocked from browser runtime by Task 5.12. The lower-level server contract may know the routes, but browser exposure requires explicit future route-specific planning and prototype tasks.

This task adds no browser route, no session patch prototype, no session complete prototype, no session discard prototype, no broad mutation client, no runtime source selector, no API-backed persistence adapter, no App.tsx integration, no source-of-truth migration, no localStorage write, no AppData overwrite, no package change, no production backend, no auth, no sync, no cloud, and no deployment.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`

localStorage remains source of truth. API results never overwrite AppData or localStorage.

The next recommended task is `Task 5.13 Session Patch Mutation Prototype Plan V1`.

## Task 5.13: Session Patch Mutation Prototype Plan V1

Task 5.13 adds `docs/SESSION_PATCH_MUTATION_PROTOTYPE_PLAN.md` as a planning-only route-specific plan for future `POST /sessions/active/patches`.

The plan covers patch ordering, stale step/set risk, duplicate patch risk, partial update risk, current set corruption risk, source snapshot metadata, request fingerprint, idempotency key, strict no-fake-success behavior, localStorage/AppData integrity, route boundary, and manual acceptance.

Task 5.13 does not implement `POST /sessions/active/patches`, does not add browser route exposure, does not implement session complete or discard, does not add a broad mutation client, does not add App.tsx wiring, does not add API primary runtime, does not switch source of truth, does not write localStorage, does not overwrite AppData, does not add package changes, and does not add production backend/auth/sync/cloud/deployment.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`

localStorage remains source of truth. API results never overwrite AppData or localStorage.

The next recommended task is `Task 5.14 Session Patch Mutation Prototype V1`.

## Task 5.14: Session Patch Mutation Prototype V1

Task 5.14 implements a dev-only, explicit opt-in browser mutation prototype for `POST /sessions/active/patches`.

The prototype is route-specific and guarded by `import.meta.env.DEV`, `VITE_IRONPATH_DEV_API_COMPARE === "1"`, `VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT === "session-patch"`, and the existing localhost-only Dev API base URL validation. It uses source snapshot metadata, source snapshot version, mutation id, idempotency key, request fingerprint, explicit confirmation, duplicate-submit prevention, strict no-fake-success handling, and snapshot metadata validation.

Task 5.14 does not implement `POST /sessions/active/complete`, does not implement `POST /sessions/active/discard`, does not add DataHealth repair, does not add backup/import/export/reset/recovery HTTP routes, does not add a broad mutation client, does not add API primary runtime, does not switch source of truth, does not write localStorage, does not overwrite AppData, does not add package changes, and does not add production backend/auth/sync/cloud/deployment.

Accepted browser mutation routes are now exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`

localStorage remains source of truth. API results never overwrite AppData or localStorage.

The next recommended task is `Task 5.15 Session Patch Prototype Acceptance / Hardening V1`.

## Task 5.15: Session Patch Prototype Acceptance / Hardening V1

Task 5.15 adds acceptance and hardening coverage for the dev-only `POST /sessions/active/patches` prototype.

The acceptance and hardening layer covers duplicate patch submit prevention, stale source snapshot and target mismatch, invalid active session or patch target, timeout, unavailable Dev API, malformed response, missing snapshot metadata, server non-success states, no-fake-success behavior, localStorage integrity, AppData integrity, and route boundary.

Task 5.15 does not add a browser route, does not implement `POST /sessions/active/complete`, does not implement `POST /sessions/active/discard`, does not add DataHealth repair, does not add backup/import/export/reset/recovery HTTP routes, does not add a broad mutation client, does not add API primary runtime, does not switch source of truth, does not write localStorage, does not overwrite AppData, does not add package changes, and does not add production backend/auth/sync/cloud/deployment.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`

localStorage remains source of truth. API results never overwrite AppData or localStorage.

The next recommended task is `Task 5.16 Session Complete Mutation Prototype Plan V1`.

## Task 5.16: Session Complete Mutation Prototype Plan V1

Task 5.16 adds `docs/SESSION_COMPLETE_MUTATION_PROTOTYPE_PLAN.md` as a planning-only route-specific plan for future `POST /sessions/active/complete`.

The plan covers duplicate complete risk, active session missing behavior, history duplicate risk, source snapshot mismatch, idempotency key, request fingerprint, incomplete-main-work confirmation, failure recovery, strict no-fake-success behavior, localStorage/AppData integrity, route boundary, and manual acceptance requirements.

Task 5.16 does not implement `POST /sessions/active/complete`, does not add browser route exposure, does not implement session discard, does not add a broad mutation client, does not add App.tsx wiring, does not add API primary runtime, does not switch source of truth, does not write localStorage, does not overwrite AppData, does not add package changes, and does not add production backend/auth/sync/cloud/deployment.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`

localStorage remains source of truth. API results never overwrite AppData or localStorage.

The next recommended task is `Task 5.17 Session Complete Mutation Prototype V1`.

## Task 5.17: Session Complete Mutation Prototype V1

Task 5.17 implements a dev-only, explicit opt-in browser mutation prototype for `POST /sessions/active/complete`.

The prototype is route-specific and guarded by `import.meta.env.DEV`, `VITE_IRONPATH_DEV_API_COMPARE === "1"`, `VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT === "session-complete"`, and the existing localhost-only Dev API base URL validation. It uses source snapshot metadata, source snapshot version, mutation id, idempotency key, request fingerprint, explicit confirmation, duplicate-submit prevention, strict no-fake-success handling, and snapshot metadata validation.

Task 5.17 does not implement `POST /sessions/active/discard`, does not add DataHealth repair, does not add backup/import/export/reset/recovery HTTP routes, does not add a broad mutation client, does not add API primary runtime, does not switch source of truth, does not write localStorage, does not overwrite AppData, does not add package changes, and does not add production backend/auth/sync/cloud/deployment.

Accepted browser mutation routes are now exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`

localStorage remains source of truth. API results never overwrite AppData or localStorage.

The next recommended task is `Task 5.18 Session Complete Acceptance / Hardening V1`.

## Task 5.18: Session Complete Acceptance / Hardening V1

Task 5.18 accepts and hardens the existing dev-only, explicit opt-in browser mutation prototype for `POST /sessions/active/complete`.

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

The next recommended task is `Task 5.19 Session Discard Mutation Prototype Plan V1`.

## Task 5.19: Session Discard Mutation Prototype Plan V1

Task 5.19 adds `docs/SESSION_DISCARD_MUTATION_PROTOTYPE_PLAN.md` as a planning-only route-specific plan for future `POST /sessions/active/discard`.

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

The next recommended task is `Task 5.20 Session Discard Mutation Prototype V1`.

## Task 5.20: Session Discard Mutation Prototype V1

Task 5.20 implements a dev-only, explicit opt-in browser mutation prototype for `POST /sessions/active/discard`.

The prototype is route-specific and guarded by `import.meta.env.DEV`, `VITE_IRONPATH_DEV_API_COMPARE === "1"`, `VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT === "session-discard"`, and the existing localhost-only Dev API base URL validation. It uses source snapshot metadata, source snapshot version, mutation id, idempotency key, request fingerprint, strong confirmation, duplicate-submit prevention, strict no-fake-success handling, and snapshot metadata validation.

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

The next recommended task is `Task 5.21 Session Discard Acceptance / Hardening V1`.

## Task 5.21: Session Discard Acceptance / Hardening V1

Task 5.21 accepts and hardens the existing dev-only, explicit opt-in browser mutation prototype for `POST /sessions/active/discard`.

The coverage locks duplicate discard prevention, missing active session behavior, invalid active session identity, strong confirmation and cancel behavior, write failure, transaction failure, database closed, timeout/unavailable/malformed response handling, missing snapshot metadata, strict no-fake-success behavior, pending lock behavior, confirmation reset behavior, localStorage/AppData integrity, no history write behavior, and route boundary.

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

The next recommended task is `Task 5.22 Active Session Full Write-path Regression Lock V1`.

## Task 5.22: Active Session Full Write-path Regression Lock V1

Task 5.22 regression-locks the full active-session write path after Session Start, Session Patch, Session Complete, and Session Discard have been planned, implemented, accepted, and hardened.

This is docs/static regression coverage only. It does not add a browser route, does not add an eighth mutation route, does not add DataHealth repair, does not add backup/import/export/reset/recovery HTTP routes, does not add a broad mutation client, does not implement API-backed persistence, does not add API primary runtime, does not switch source of truth, does not write localStorage, does not overwrite AppData, does not add package changes, and does not add production backend/auth/sync/cloud/deployment.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

localStorage remains source of truth. API results never overwrite AppData or localStorage.

The next recommended task is `Task 5.23 API-backed Persistence Facade Plan V1`.

## Task 5.23: API-backed Persistence Facade Plan V1

Task 5.23 adds `docs/API_BACKED_PERSISTENCE_FACADE_PLAN.md` as a planning-only facade design for a future AppData persistence boundary:

`App.tsx -> persistence facade -> localStorageAdapter or apiStorageAdapter -> AppData`

This task does not implement `src/storage/apiStorageAdapter.ts`, does not add a runtime source selector, does not modify App.tsx, does not switch source of truth, does not replace localStorage, does not add API primary runtime, does not add a browser mutation route, does not add DataHealth repair, does not add backup/import/export/reset/recovery HTTP routes, does not add package changes, and does not add production backend/auth/sync/cloud/deployment.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

localStorage remains source of truth. API results never overwrite AppData or localStorage.

The next recommended task is `Task 5.24 API-backed Persistence Adapter Prototype V1`.

## Task 5.24: API-backed Persistence Adapter Prototype V1

Task 5.24 adds `src/storage/apiStorageAdapter.ts` as a default-off, dev/local-only API storage adapter prototype.

The adapter is not mounted in App.tsx, is not used by `loadData` or `saveData`, and does not replace localStorage. It requires development mode plus `VITE_IRONPATH_RUNTIME_SOURCE === "api-primary-dev"` and a localhost-only Dev API base URL. It exposes typed route-specific read/write facade methods only; it does not add a broad mutation client or route dispatcher.

Task 5.24 does not switch source of truth, does not add a runtime source selector, does not add boot-from-API snapshot behavior, does not add API write-through runtime, does not add production backend/auth/sync/cloud/deployment, does not add package changes, does not add DataHealth repair, does not add backup/import/export/reset/recovery HTTP routes, and does not add an eighth browser mutation route.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

localStorage remains source of truth by default. The API storage adapter never silently overwrites AppData or localStorage.

The next recommended task is `Task 5.25 Runtime Source Selector Prototype V1`.

## Task 5.25: Runtime Source Selector Prototype V1

Task 5.25 adds `src/storage/runtimeSourceConfig.ts` and `src/storage/runtimeSourceSelector.ts` as a default-off dev/local runtime source selector prototype.

The selector defines only three Phase 5 modes: `localStorage`, `api-readonly`, and `api-primary-dev`. Missing, empty, invalid, non-dev, or non-localhost API mode inputs fall back to `localStorage`. `localStorage` remains the default runtime source. `api-readonly` keeps App writes on localStorage and allows only API diagnostics. `api-primary-dev` is explicit dev/local opt-in only and is not production-ready.

Task 5.25 does not modify App.tsx, does not wire `loadData` or `saveData`, does not boot the App from an API snapshot, does not add API write-through runtime, does not silently overwrite AppData or localStorage, does not replace localStorage, does not add production backend/auth/sync/cloud/deployment, does not add package changes, does not add DataHealth repair, does not add backup/import/export/reset/recovery HTTP routes, and does not add an eighth browser mutation route.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

localStorage remains the default source of truth and remains the fallback/migration source. API results never silently overwrite AppData or localStorage.

The next recommended task is `Task 5.26 Boot From API Snapshot Prototype V1`.

## Task 5.26: Boot From API Snapshot Prototype V1

Task 5.26 adds `src/storage/bootFromApiSnapshot.ts` as a guarded API snapshot boot helper for explicit dev/local `api-primary-dev` mode.

The helper is not mounted in App.tsx and is not wired to `loadData` or `saveData`. It accepts an explicit snapshot reader, requires `api-primary-dev`, requires AppData-shaped payloads, requires snapshot metadata, validates the AppData schema before accepting the payload, and returns visible localStorage fallback failures when disabled, unavailable, malformed, missing metadata, or schema-invalid.

Task 5.26 does not add a new server route, does not add a POST route, does not add API write-through runtime, does not silently overwrite AppData or localStorage, does not write localStorage, does not replace localStorage, does not add production backend/auth/sync/cloud/deployment, does not add package changes, does not add DataHealth repair, does not add backup/import/export/reset/recovery HTTP routes, and does not add an eighth browser mutation route.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

localStorage remains the default source of truth and remains fallback/migration source. API snapshot boot results never silently overwrite AppData or localStorage.

The next recommended task is `Task 5.27 API Write-through Runtime Prototype V1`.

## Task 5.27: API Write-through Runtime Prototype V1

Task 5.27 adds `src/storage/apiWriteThroughRuntime.ts` as a default-off dev/local API write-through runtime helper for explicit `api-primary-dev` mode.

The helper is not mounted in App.tsx and is not wired to `loadData`, `saveData`, or localStorage. It delegates only to the Task 5.24 route-specific API storage adapter methods for the seven accepted browser mutation routes. It returns visible failures when `api-primary-dev` is not selected, when adapter configuration is invalid, or when the adapter reports timeout, unavailable API, malformed response, missing snapshot metadata, or server non-success.

Task 5.27 does not add a broad mutation client, does not add production backend/auth/sync/cloud/deployment, does not add package changes, does not add DataHealth repair, does not add backup/import/export/reset/recovery HTTP routes, and does not add an eighth browser mutation route.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

localStorage remains the default runtime source and remains fallback/migration source. API write-through results never silently write localStorage.

The next recommended task is `Task 5.28 API Primary Runtime Acceptance V1`.

## Task 5.28: API Primary Runtime Acceptance V1

Task 5.28 adds `docs/API_PRIMARY_RUNTIME_ACCEPTANCE.md` and acceptance coverage for the Task 5.24 through Task 5.27 dev/local API primary runtime helpers.

This is acceptance only. It does not modify App.tsx, does not wire API primary as the default runtime, does not replace localStorage, does not add a browser mutation route, does not add a broad mutation client, does not add production backend/auth/sync/cloud/deployment, does not add package changes, does not add DataHealth repair, does not add backup/import/export/reset/recovery HTTP routes, and does not add an eighth browser mutation route.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

`localStorage` remains the default runtime source and remains fallback/migration source. API primary remains explicit dev/local `api-primary-dev` only and is not production-ready.

The next recommended task is `Task 5.29 API Primary Runtime Manual Acceptance V1`.

## Task 5.29: API Primary Runtime Manual Acceptance V1

Task 5.29 adds `docs/API_PRIMARY_RUNTIME_MANUAL_ACCEPTANCE.md` as the human browser runbook for the explicit dev/local API primary runtime.

This is manual acceptance only. It does not modify App.tsx, does not wire API primary as the default runtime, does not replace localStorage, does not delete localStorage, does not add a browser mutation route, does not add a broad mutation client, does not add production backend/auth/sync/cloud/deployment, does not add package changes, does not add DataHealth repair, does not add backup/import/export/reset/recovery HTTP routes, and does not add an eighth browser mutation route.

The manual runbook requires a dedicated test browser profile, dedicated dev DB, no real personal training data, API primary boot/read/write checks, API unavailable fallback, localStorage integrity, forbidden network/UI checks, browser build safety, cleanup, and pass/fail template.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

`localStorage` remains the default runtime source and remains fallback/migration source. API primary remains explicit dev/local `api-primary-dev` only and is not production-ready.

The next recommended task is `Task 5.30 API Primary Runtime Hardening V1`.

## Task 5.30: API Primary Runtime Hardening V1

Task 5.30 adds `docs/API_PRIMARY_RUNTIME_HARDENING.md` and hardening coverage for API primary startup race, API unavailable, snapshot mismatch, reload behavior, stale AppData, failure rollback, and no silent overwrite boundaries.

This is hardening only. It does not modify App.tsx, does not wire API primary as the default runtime, does not replace or delete localStorage, does not add a browser mutation route, does not add a broad mutation client, does not add production backend/auth/sync/cloud/deployment, does not add package changes, does not add DataHealth repair, does not add backup/import/export/reset/recovery HTTP routes, and does not add an eighth browser mutation route.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

`localStorage` remains the default runtime source and remains fallback/migration source. API primary remains explicit dev/local `api-primary-dev` only and is not production-ready.

The next recommended task is `Task 5.31 API Primary Runtime Regression Lock V1`.

## Task 5.31: API Primary Runtime Regression Lock V1

Task 5.31 adds `docs/API_PRIMARY_RUNTIME_REGRESSION_LOCK.md` and regression-lock coverage for API primary dev runtime.

The lock covers runtime source selector behavior, localStorage fallback, guarded API snapshot boot, route-specific reads and writes, strict no-fake-success writes, no silent localStorage pollution, browser build isolation, coverage inventory, manual inventory, and future work gates.

This is a regression lock only. It does not modify App.tsx, does not wire API primary as the default runtime, does not replace or delete localStorage, does not add a browser mutation route, does not add a broad mutation client, does not add production backend/auth/sync/cloud/deployment, does not add package changes, does not add DataHealth repair, does not add backup/import/export/reset/recovery HTTP routes, and does not add an eighth browser mutation route.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

`localStorage` remains the default runtime source and remains fallback/migration source. API primary remains explicit dev/local `api-primary-dev` only and is not production-ready.

The next recommended task is `Task 5.32 LocalStorage to SQLite Migration Dry-run V1`.

## Task 5.32: LocalStorage to SQLite Migration Dry-run V1

Task 5.32 adds `src/storage/localStorageToSqliteMigrationDryRun.ts` as a dry-run-only helper and `docs/LOCALSTORAGE_TO_SQLITE_MIGRATION_DRY_RUN.md`.

The dry-run validates localStorage AppData, sanitizes and schema-checks the payload, summarizes schema/history/template/active-session/settings state, optionally compares an API snapshot summary, and reports warnings only.

This task does not write SQLite, does not write localStorage, does not delete localStorage, does not switch source of truth, does not auto-apply migration, does not modify App.tsx, does not add a browser mutation route, does not add production backend/auth/sync/cloud/deployment, does not add package changes, does not add DataHealth repair, does not add backup/import/export/reset/recovery HTTP routes, and does not add an eighth browser mutation route.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

`localStorage` remains the default runtime source and remains fallback/migration source. API primary remains explicit dev/local `api-primary-dev` only and is not production-ready.

The next recommended task is `Task 5.33 LocalStorage to SQLite Migration Apply Prototype V1`.

## Task 5.33: LocalStorage to SQLite Migration Apply Prototype V1

Task 5.33 adds `src/storage/localStorageToSqliteMigrationApply.ts` as a dev-only, backup-first, confirmation-gated migration apply helper and `docs/LOCALSTORAGE_TO_SQLITE_MIGRATION_APPLY_PROTOTYPE.md`.

The helper runs the Task 5.32 dry-run first, requires `VITE_IRONPATH_MIGRATION_APPLY="localstorage-to-sqlite-apply"`, requires explicit confirmation, requires localStorage backup metadata, and writes SQLite snapshot data only through an injected writer.

This task does not delete localStorage, does not write localStorage, does not auto-switch source of truth, does not modify App.tsx, does not add an HTTP migration endpoint, does not add a browser mutation route, does not add production backend/auth/sync/cloud/deployment, does not add package changes, does not add DataHealth repair, does not add backup/import/export/reset/recovery HTTP routes, and does not add an eighth browser mutation route.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

`localStorage` remains available as fallback and migration source. API primary remains explicit dev/local `api-primary-dev` only and is not production-ready.

The next recommended task is `Task 5.34 Migration Acceptance / Manual Acceptance V1`.

## Task 5.34: Migration Acceptance / Manual Acceptance V1

Task 5.34 adds `docs/MIGRATION_ACCEPTANCE_MANUAL.md` as acceptance and manual acceptance coverage for the Task 5.32 dry-run helper and Task 5.33 apply prototype.

Acceptance covers valid localStorage, invalid localStorage, legacy monolith payloads, backup restore expectations, SQLite snapshot read metadata, rollback expectations, dedicated test browser profile, dedicated dev DB, no real personal training data, localStorage preservation, and no automatic source switch.

This task does not add runtime behavior, does not delete localStorage, does not write localStorage, does not auto-switch source of truth, does not modify App.tsx, does not add an HTTP migration endpoint, does not add a browser mutation route, does not add production backend/auth/sync/cloud/deployment, does not add package changes, does not add DataHealth repair, does not add backup/import/export/reset/recovery HTTP routes, and does not add an eighth browser mutation route.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

`localStorage` remains available as fallback and migration source. API primary remains explicit dev/local `api-primary-dev` only and is not production-ready.

The next recommended task is `Task 5.35 Migration Rollback & Recovery Hardening V1`.

## Task 5.35: Migration Rollback & Recovery Hardening V1

Task 5.35 adds `src/storage/migrationRollbackRecovery.ts` and `docs/MIGRATION_ROLLBACK_RECOVERY_HARDENING.md` for dev-only rollback and recovery hardening.

The helper requires `VITE_IRONPATH_MIGRATION_ROLLBACK="localstorage-to-sqlite-rollback"`, explicit confirmation, backup metadata, and injected localStorage/dev DB restore callbacks. It validates AppData backups, validates SQLite snapshot metadata, surfaces corrupt snapshot and schema mismatch failures, and returns clear failure-state indicators.

This task does not add an HTTP reset route, does not add an HTTP recovery route, does not delete localStorage, does not auto-switch source of truth, does not modify App.tsx, does not add a browser mutation route, does not add production backend/auth/sync/cloud/deployment, does not add package changes, does not add DataHealth repair, does not add backup/import/export/reset/recovery HTTP routes, and does not add an eighth browser mutation route.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

`localStorage` remains available as fallback and migration source. API primary remains explicit dev/local `api-primary-dev` only and is not production-ready.

The next recommended task is `Task 5.36 Migration Regression Lock V1`.

## Task 5.36: Migration Regression Lock V1

Task 5.36 adds `docs/MIGRATION_REGRESSION_LOCK.md` as the regression lock for the Phase 5 migration dry-run, apply, acceptance, rollback, and recovery state from Tasks 5.32 through 5.35.

The lock keeps migration dry-run warning-only, migration apply dev-only and backup-first, rollback/recovery dev-only and callback-based, and all migration flows non-destructive. It explicitly locks no localStorage deletion, no silent localStorage/AppData overwrite, no automatic source switch, and no HTTP migration/reset/recovery surface.

This task does not add runtime behavior, does not delete localStorage, does not write localStorage, does not auto-switch source of truth, does not modify App.tsx, does not add an HTTP migration endpoint, does not add a browser mutation route, does not add production backend/auth/sync/cloud/deployment, does not add package changes, does not add DataHealth repair, does not add backup/import/export/reset/recovery HTTP routes, and does not add an eighth browser mutation route.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

`localStorage` remains default runtime source, fallback, migration source, and emergency backup. API primary remains explicit dev/local `api-primary-dev` only and is not production-ready.

The next recommended task is `Task 5.37 Phase 5 Final Source-of-truth Audit V1`.

## Task 5.37: Phase 5 Final Source-of-truth Audit V1

Task 5.37 adds `docs/PHASE5_FINAL_SOURCE_OF_TRUTH_AUDIT.md` as the final Phase 5 source-of-truth audit before final manual acceptance.

The audit records that accepted runtime modes are `localStorage`, `api-readonly`, and `api-primary-dev`; `localStorage` remains the default runtime source and fallback/migration source; `api-primary-dev` remains explicit dev/local only and not production-ready; migration dry-run/apply/rollback remains backup-first, non-destructive, and reversible.

This task does not add runtime behavior, does not delete localStorage, does not silently overwrite localStorage or AppData, does not switch the default runtime source, does not modify App.tsx, does not add an HTTP migration endpoint, does not add a browser mutation route, does not add production backend/auth/sync/cloud/deployment, does not add package changes, does not add DataHealth repair, does not add backup/import/export/reset/recovery HTTP routes, and does not add an eighth browser mutation route.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

The next recommended task is `Task 5.38 Phase 5 Final Manual Acceptance V1`.

## Task 5.38: Phase 5 Final Manual Acceptance V1

Task 5.38 adds `docs/PHASE5_FINAL_MANUAL_ACCEPTANCE.md` as the final manual acceptance runbook for Phase 5.

The runbook requires a dedicated test browser profile, dedicated dev DB, no real personal training data, local Dev API only, default localStorage boot, `api-readonly` diagnostics, `api-primary-dev` boot and failure behavior, full workout flow, history edit, data-flag, DataHealth dismiss, migration dry-run/apply/rollback, API unavailable fallback, route boundary checks, cleanup/env reset, and pass/fail recording.

This task does not add runtime behavior, does not delete localStorage, does not silently overwrite localStorage or AppData, does not switch the default runtime source, does not modify App.tsx, does not add an HTTP migration endpoint, does not add a browser mutation route, does not add production backend/auth/sync/cloud/deployment, does not add package changes, does not add DataHealth repair, does not add backup/import/export/reset/recovery HTTP routes, and does not add an eighth browser mutation route.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

The next recommended task is `Task 5.39 Phase 5 Exit Regression Lock V1`.

## Task 5.39: Phase 5 Exit Regression Lock V1

Task 5.39 adds `docs/PHASE5_EXIT_REGRESSION_LOCK.md` as the Phase 5 exit regression lock.

The lock records accepted runtime modes (`localStorage`, `api-readonly`, `api-primary-dev`), accepted browser mutation routes, blocked routes, source-of-truth rules, fallback rules, migration rules, browser build isolation, and final Phase 5 coverage inventory.

This task does not add runtime behavior, does not delete localStorage, does not silently overwrite localStorage or AppData, does not make API primary production default, does not modify App.tsx, does not add an HTTP migration endpoint, does not add a browser mutation route, does not add production backend/auth/sync/cloud/deployment, does not add package changes, does not add DataHealth repair, does not add backup/import/export/reset/recovery HTTP routes, and does not add an eighth browser mutation route.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

The next recommended task is `Task 5.40 Phase 6 Handoff Plan V1`.

## Task 5.40: Phase 6 Handoff Plan V1

Task 5.40 adds `docs/PHASE6_HANDOFF_PLAN.md` as a planning-only handoff from Phase 5 to Phase 6.

The handoff covers production backend prerequisites, auth and user account prerequisites, cloud sync prerequisites, deployment prerequisites, monitoring and operations prerequisites, privacy/security prerequisites, Phase 6 entry gates, and the recommended planning-only first Phase 6 task.

This task does not start Phase 6 implementation, does not add runtime behavior, does not implement production backend/auth/user accounts/cloud sync/deployment/monitoring, does not delete localStorage, does not silently overwrite localStorage or AppData, does not make API primary production default, does not modify App.tsx, does not add a browser mutation route, does not add package changes, does not add DataHealth repair, does not add backup/import/export/reset/recovery HTTP routes, and does not add an eighth browser mutation route.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

Recommended Phase 6 first task after Phase 5 closes: `Task 6.1 Production Backend, Auth, Sync & Deployment Architecture Gate V1`.

The next recommended Phase 5 task is `Task 5.41 Phase 5 Completion Archive V1`.

## Task 5.41: Phase 5 Completion Archive V1

Task 5.41 adds `docs/PHASE5_COMPLETION_ARCHIVE.md` as the Phase 5 completion archive.

The archive marks Phase 5 complete; records API primary dev runtime status, localStorage fallback status, migration dry-run/apply/rollback status, final accepted runtime modes, final accepted browser mutation routes, final blocked routes/capabilities, final validation commands, and the Phase 6 handoff recommendation.

This task does not start Phase 6, does not add runtime behavior, does not implement production backend/auth/user accounts/cloud sync/deployment/monitoring, does not delete localStorage, does not silently overwrite localStorage or AppData, does not make API primary production default, does not modify App.tsx, does not add a browser mutation route, does not add package changes, does not add DataHealth repair, does not add backup/import/export/reset/recovery HTTP routes, and does not add an eighth browser mutation route.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

Recommended next task, only with explicit future approval, is `Task 6.1 Production Backend, Auth, Sync & Deployment Architecture Gate V1`.

## Task 6.0: Phase 6 Preflight & Production Boundary Lock V1

Task 6.0 adds `docs/PHASE6_PREFLIGHT_PRODUCTION_BOUNDARY_LOCK.md` as the Phase 6 preflight and production boundary lock.

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

Recommended next task is `Task 6.1 Production Backend, Auth, Sync & Deployment Architecture Gate V1`, architecture gate only. Task 6.1 must not implement production backend/auth/sync/deployment and must not auto-start from Task 6.0.

## Task 6.1: Production Backend, Auth, Sync & Deployment Architecture Gate V1

Task 6.1 adds `docs/PRODUCTION_BACKEND_AUTH_SYNC_DEPLOYMENT_ARCHITECTURE_GATE.md` as a Phase 6 architecture gate and decision record.

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

Task 6.1 evaluates production backend, production database/storage, auth/user identity, cloud sync, deployment/environment, privacy/security, production migration/rollback, and CI/ruleset architecture categories without selecting or implementing production runtime.

Recommended next task is `Task 6.2 Production Data Ownership, Privacy & Security Matrix V1`, docs/static tests only. Task 6.2 must not implement auth, production backend, sync, deployment, migration, or source-of-truth switching, and must not auto-start from Task 6.1.

## Task 6.2: Production Data Ownership, Privacy & Security Matrix V1

Task 6.2 adds `docs/PRODUCTION_DATA_OWNERSHIP_PRIVACY_SECURITY_MATRIX.md` as a production data ownership, privacy, and security matrix and decision record.

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

Task 6.2 classifies production data ownership, privacy, sensitivity, retention, export/delete, backup/restore, logging, sync eligibility, migration risk, and required future gates for training history, active session, templates, settings, screening, DataHealth, backups, readMirror summaries, analytics, migration state, account identity, auth/session metadata, sync metadata, audit/security logs, support diagnostics, and deletion/export records.

Recommended next task is `Task 6.3 Auth & User Account Lifecycle Architecture Gate V1`, docs/static tests only. Task 6.3 must not implement auth, production backend, sync, deployment, migration, or source-of-truth switching, and must not auto-start from Task 6.2.

## Task 6.3: Auth & User Account Lifecycle Architecture Gate V1

Task 6.3 adds `docs/AUTH_USER_ACCOUNT_LIFECYCLE_ARCHITECTURE_GATE.md` as an auth and user account lifecycle architecture gate and decision record.

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

Task 6.3 defines anonymous local user, future account identity, local data to account linking, account creation lifecycle, account deletion lifecycle, export/delete responsibilities, auth failure behavior, identity mismatch risk, and localStorage fallback boundaries before any auth implementation.

Recommended next task is `Task 6.4 Production Backend & Database Architecture Decision V1`, planning/docs/static tests only. Task 6.4 must not implement production backend, normalized schema, auth, sync, deployment, migration, or source-of-truth switching.

## Task 6.4: Production Backend & Database Architecture Decision V1

Task 6.4 adds `docs/PRODUCTION_BACKEND_DATABASE_ARCHITECTURE_DECISION.md` as a planning-level production backend and database architecture decision.

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

Task 6.4 evaluates no backend yet, single Node backend, serverless API, hosted backend/database, local-first desktop backend, current SQLite snapshot repository, normalized schema risk, migration/rollback requirements, and backup requirements without implementation.

Recommended next task is `Task 6.5 Cloud Sync & Conflict Resolution Architecture Gate V1`, docs/static tests only. Task 6.5 must not implement cloud sync, remote writes, background sync, production backend, auth, deployment, migration, or source-of-truth switching.

## Task 6.5: Cloud Sync & Conflict Resolution Architecture Gate V1

Task 6.5 adds `docs/CLOUD_SYNC_CONFLICT_RESOLUTION_ARCHITECTURE_GATE.md` as a planning-level cloud sync and conflict resolution architecture gate.

This task adds no runtime behavior, no cloud sync, no multi-device sync runtime, no remote write queue, no background sync worker, no automatic conflict merge, no production backend, no auth, no deployment, no production migration, no source-of-truth migration, no package changes, and no browser mutation route.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

`localStorage` remains default runtime source, fallback, migration source, and emergency backup. `api-primary-dev` remains explicit dev/local only and not production-ready.

Task 6.5 evaluates no sync, manual backup sync, single-device cloud backup, multi-device bidirectional sync, conflict detection, conflict merge policy, remote write duplication, and offline queue risk without implementation.

Recommended next task is `Task 6.6 Deployment, Environment & Secrets Strategy V1`, docs/static tests only. Task 6.6 must not implement deployment, production hosting, secrets runtime, auth, cloud sync, production backend, migration, routes, or source-of-truth switching.

## Task 6.6: Deployment, Environment & Secrets Strategy V1

Task 6.6 adds `docs/DEPLOYMENT_ENVIRONMENT_SECRETS_STRATEGY.md` as a planning-level deployment, environment, and secrets strategy.

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

Task 6.6 documents local/dev/staging/production environments, secrets storage, environment variables, branch rules, required checks, Vercel optional behavior for Codex PRs, and rollback strategy without implementation.

Recommended next task is `Task 6.7 Production Migration, Backup & Rollback Strategy V1`, docs/static tests only. Task 6.7 must not implement destructive migration, real-data automation, production source-of-truth switching, routes, deployment, auth, cloud sync, production backend runtime, or package changes.

## Task 6.7: Production Migration, Backup & Rollback Strategy V1

Task 6.7 adds `docs/PRODUCTION_MIGRATION_BACKUP_ROLLBACK_STRATEGY.md` as a planning-level production migration, backup, rollback, and recovery strategy.

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

Task 6.7 documents backup-first, dry-run, apply, rollback, recovery drill, export/delete implications, no destructive migration, and no real-data automation without implementation.

Recommended next task is `Task 6.8 Phase 6 Architecture Checkpoint & Boundary Lock V1`, docs/static tests only. Task 6.8 must not implement production backend runtime, auth runtime, sync runtime, deployment runtime, normalized schema, migration runtime, routes, package changes, or source-of-truth switching.

## Task 6.8: Phase 6 Architecture Checkpoint & Boundary Lock V1

Task 6.8 adds `docs/PHASE6_ARCHITECTURE_CHECKPOINT_BOUNDARY_LOCK.md` as the architecture checkpoint and boundary lock before skeleton/prototype work.

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

Task 6.8 locks architecture decisions, still-blocked implementation, source-of-truth status, route allowlist, CI/ruleset policy, and coverage inventory before narrow skeleton planning.

Recommended next task is `Task 6.9 Production Backend Adapter Skeleton Plan V1`, docs/static tests only. Task 6.9 must not implement production backend runtime, auth, deployment, database migration, production runtime activation, routes, package changes, or source-of-truth switching.

## Task 6.9: Production Backend Adapter Skeleton Plan V1

Task 6.9 adds `docs/PRODUCTION_BACKEND_ADAPTER_SKELETON_PLAN.md` as a planning-level production backend adapter skeleton plan.

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

Task 6.9 defines backend adapter boundary, request/response shape, environment boundary, no hosted deployment, no auth, no database migration, and no production runtime activation without implementation.

Recommended next task is `Task 6.10 Production Backend Adapter Skeleton V1`. Task 6.10 may add a Node-only adapter skeleton only if safe. It must not add auto-listen behavior, deployment, auth, normalized tables, production data use, browser runtime integration, package dependencies, routes, or source-of-truth switching.

## Task 6.10: Production Backend Adapter Skeleton V1

Task 6.10 adds `apps/api/src/node/productionBackendAdapter.ts` as a minimal Node-only production backend adapter skeleton.

This task adds no auto-listen behavior, no Fastify/Express/Koa/Hono server, no deployment, no auth, no normalized tables, no database migration, no production data use, no browser runtime integration, no package changes, no source-of-truth switch, and no browser mutation route.

The skeleton is inert by default. It exposes typed request/response shapes, the existing seven-route browser mutation allowlist, and safe error envelopes. Accepted routes return `ok: false` with `production_backend_not_activated`; unapproved routes return `route_not_allowed`.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

`localStorage` remains default runtime source, fallback, migration source, and emergency backup. `api-primary-dev` remains explicit dev/local only and not production-ready.

Recommended next task is `Task 6.11 Production Backend Adapter Acceptance V1`, docs/static and boundary tests. Task 6.11 must not add auth runtime, deployment, auto-listen behavior, database migration, production data use, browser runtime integration, routes, package changes, or source-of-truth switching.

## Task 6.11: Production Backend Adapter Acceptance V1

Task 6.11 adds `docs/PRODUCTION_BACKEND_ADAPTER_ACCEPTANCE.md` and acceptance/boundary tests for the Task 6.10 Node-only adapter skeleton.

This task adds no runtime activation, no auto-listen behavior, no auth runtime, no deployment runtime, no database migration, no production data use, no browser runtime integration, no package changes, no source-of-truth switch, and no browser mutation route.

The accepted skeleton remains Node-only, inert by default, dependency-free, and not exported from browser-facing API index files. It returns safe error envelopes and no fake success.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

`localStorage` remains default runtime source, fallback, migration source, and emergency backup. `api-primary-dev` remains explicit dev/local only and not production-ready.

Recommended next task is `Task 6.12 Auth Boundary & Account Model Plan V1`, docs/static tests only. Task 6.12 must not implement auth runtime, login/signup, token/session handling, OAuth, user table, production backend activation, routes, package changes, or source-of-truth switching.

## Task 6.12: Auth Boundary & Account Model Plan V1

Task 6.12 adds `docs/AUTH_BOUNDARY_ACCOUNT_MODEL_PLAN.md` as an auth boundary and account model plan.

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

Task 6.12 documents account identity, local user to account mapping, account deletion, export/delete responsibilities, token/session requirements, auth failure behavior, and localStorage fallback without implementation.

Recommended next task is `Task 6.13 Auth Provider Adapter Skeleton V1`. Task 6.13 may add type/interface-only auth boundary files if safe. It must not implement real auth, login UI, token storage, OAuth, provider integration, dependencies, routes, production backend activation, or source-of-truth switching.

## Task 6.13: Auth Provider Adapter Skeleton V1

Task 6.13 adds `src/auth/authProviderTypes.ts` and `src/auth/authBoundary.ts` as type/interface-only auth provider adapter skeleton files.

This task adds no real auth, no login UI, no token storage, no OAuth, no provider integration, no dependencies, no routes, no production backend activation, no package changes, no source-of-truth switch, and no browser mutation route.

The skeleton returns a pure unavailable result with `auth_runtime_not_implemented`. It stores no credentials, starts no provider flow, performs no network request, and writes no browser storage.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

`localStorage` remains default runtime source, fallback, migration source, and emergency backup. `api-primary-dev` remains explicit dev/local only and not production-ready.

Recommended next task is `Task 6.14 Auth Account Lifecycle Acceptance V1`, docs/static tests only. Task 6.14 must not implement login/signup runtime, token/session runtime, OAuth, auth provider integration, user table, routes, production backend activation, package changes, or source-of-truth switching.

## Task 6.14: Auth Account Lifecycle Acceptance V1

Task 6.14 adds `docs/AUTH_ACCOUNT_LIFECYCLE_ACCEPTANCE.md` as auth account lifecycle acceptance and boundary documentation.

This task adds no login/signup runtime, no token/session runtime, no OAuth, no auth provider integration, no user table, no account lifecycle runtime, no export/delete runtime, no production backend activation, no package changes, no source-of-truth switch, and no browser mutation route.

The Task 6.13 auth skeleton remains pure and unavailable by design with `auth_runtime_not_implemented`.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

`localStorage` remains default runtime source, fallback, migration source, and emergency backup. `api-primary-dev` remains explicit dev/local only and not production-ready.

Recommended next task is `Task 6.15 Production Storage Schema Strategy V1`, docs/static tests only. Task 6.15 must not create normalized tables, implement schema migration, perform database writes, use real personal training data, add routes, add dependencies, or switch source of truth.

## Task 6.15: Production Storage Schema Strategy V1

Task 6.15 adds `docs/PRODUCTION_STORAGE_SCHEMA_STRATEGY.md` as production storage schema strategy documentation.

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

Task 6.15 documents snapshot repository strategy, normalized schema future risk, migration strategy, rollback, and backup without implementation.

Recommended next task is `Task 6.16 Production Storage Migration Dry-run Prototype V1`. Task 6.16 may add docs/tests and a pure dry-run utility only if safe. It must not write a database, create schema migration, use real personal training data, add routes, add dependencies, or switch source of truth.

## Task 6.16: Production Storage Migration Dry-run Prototype V1

Task 6.16 adds `src/storage/productionStorageMigrationDryRun.ts` as a pure production storage migration dry-run utility plus `docs/PRODUCTION_STORAGE_MIGRATION_DRY_RUN.md`.

This task adds no database write, no schema migration, no normalized tables, no real-data automation, no migration apply, no production source-of-truth migration, no package changes, and no browser mutation route.

The utility is inspection-only and returns structured results with `writesPerformed: false`.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

`localStorage` remains default runtime source, fallback, migration source, and emergency backup. `api-primary-dev` remains explicit dev/local only and not production-ready.

Recommended next task is `Task 6.17 Production Storage Backup / Restore Acceptance V1`, docs/static tests only. Task 6.17 must not perform real data automation, destructive restore, database writes, route additions, package changes, or source-of-truth switching.

## Task 6.17: Production Storage Backup / Restore Acceptance V1

Task 6.17 adds `docs/PRODUCTION_STORAGE_BACKUP_RESTORE_ACCEPTANCE.md` as production storage backup/restore acceptance documentation.

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

Task 6.17 documents backup-first, restore verification, rollback drill, no real data automation, and no destructive restore without implementation.

Recommended next task is `Task 6.18 Cloud Sync Model Plan V1`, docs/static tests only. Task 6.18 must not implement sync runtime, network writes, cloud writes, background sync, routes, dependencies, or source-of-truth switching.

## Task 6.18: Cloud Sync Model Plan V1

Task 6.18 adds `docs/CLOUD_SYNC_MODEL_PLAN.md` as a planning-level cloud sync model plan.

This task adds no runtime behavior, no sync runtime, no network writes, no cloud writes, no remote queue, no background sync worker, no conflict merge runtime, no production source-of-truth migration, no package changes, and no browser mutation route.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

`localStorage` remains default runtime source, fallback, migration source, and emergency backup. `api-primary-dev` remains explicit dev/local only and not production-ready.

Task 6.18 documents sync model, device identity, conflict policy, idempotency, offline/retry boundaries, and no sync runtime without implementation.

Recommended next task is `Task 6.19 Sync Metadata & Conflict Detector Prototype V1`. Task 6.19 may add pure local sync metadata/conflict detector functions if safe. It must not add network calls, cloud writes, background sync, auth runtime, routes, dependencies, or source-of-truth switching.

## Task 6.19: Sync Metadata & Conflict Detector Prototype V1

Task 6.19 adds `src/sync/syncConflictDetector.ts` and `docs/SYNC_METADATA_CONFLICT_DETECTOR_PROTOTYPE.md` as a pure local sync metadata conflict detector prototype.

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

Task 6.19 classifies synthetic metadata conflict states and idempotency state without reading or writing app data.

Recommended next task is `Task 6.20 Sync Conflict Acceptance V1`, docs/static tests only. Task 6.20 must not add remote writes, sync runtime, automatic merge, network calls, cloud provider configuration, auth runtime, routes, dependencies, or source-of-truth switching.

## Task 6.20: Sync Conflict Acceptance V1

Task 6.20 adds `docs/SYNC_CONFLICT_ACCEPTANCE.md` as acceptance documentation for the Task 6.19 pure sync conflict detector.

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

Task 6.20 accepts detector conflict cases, keeps `canAutoApply` false, and requires user-visible conflict policy before future sync runtime.

Recommended next task is `Task 6.21 Production Environment Config Boundary V1`, docs/static tests only. Task 6.21 must not enable production runtime by default, deploy production, add secret values, add routes, add dependencies, or switch source of truth.

## Task 6.21: Production Environment Config Boundary V1

Task 6.21 adds `docs/PRODUCTION_ENVIRONMENT_CONFIG_BOUNDARY.md` as environment configuration boundary documentation.

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

Task 6.21 documents `local`, `development`, `staging`, and `production` names, secrets separation, no secret values, no production deploy, and no runtime production enable by default.

Recommended next task is `Task 6.22 Deployment Runtime Strategy & Staging Plan V1`, docs/static tests only. Task 6.22 must not implement production deployment, hosted production runtime, secret provisioning, routes, dependencies, or source-of-truth switching.

## Task 6.22: Deployment Runtime Strategy & Staging Plan V1

Task 6.22 adds `docs/DEPLOYMENT_RUNTIME_STRATEGY_STAGING_PLAN.md` as deployment runtime strategy and staging planning documentation.

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

Task 6.22 documents staging vs production, rollback, preview deployments optional for Codex PRs, IronPath Validation as required, and no production deployment implementation.

Recommended next task is `Task 6.23 Secrets & Environment Validation Skeleton V1`. Task 6.23 may add a safe environment validation skeleton only if no dependency is needed. It must not add secret values, production deployment, auth provider, sync provider, package changes, routes, or source-of-truth switching.

## Task 6.23: Secrets & Environment Validation Skeleton V1

Task 6.23 adds `src/config/environmentValidation.ts` as a safe environment validation skeleton.

This task adds no secret values, no production deployment, no auth provider, no sync provider, no package changes, no routes, no production source-of-truth migration, and no browser mutation route.

The skeleton validates environment names, runtime source boundaries, secret reference placeholders, and production runtime disabled status. It accepts no secret values and performs no network, storage, provider, or deployment behavior.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

`localStorage` remains default runtime source, fallback, migration source, and emergency backup. `api-primary-dev` remains explicit dev/local only and not production-ready.

Recommended next task is `Task 6.24 Observability / Logging Privacy Skeleton V1`. Task 6.24 may add a privacy-safe redaction utility only if safe. It must not add an external logging service, dependency, raw AppData logging, localStorage dumps, token/secret logging, routes, or source-of-truth switching.

## Task 6.24: Observability / Logging Privacy Skeleton V1

Task 6.24 adds `src/observability/redaction.ts` as a privacy-safe redaction utility.

This task adds no external logging service, no dependency, no raw AppData logging, no localStorage dump, no token/secret logging, no production monitoring runtime, no routes, no production source-of-truth migration, and no browser mutation route.

The skeleton redacts sensitive keys, long strings, and bearer-like credentials from synthetic log payloads. It performs no network, storage, provider, deployment, or logging service behavior.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

`localStorage` remains default runtime source, fallback, migration source, and emergency backup. `api-primary-dev` remains explicit dev/local only and not production-ready.

Recommended next task is `Task 6.25 Production Readiness Security Hardening V1`, docs/static tests and tiny redaction/env validation fixes only. Task 6.25 must not add auth runtime, deployment runtime, sync runtime, routes, dependencies, or source-of-truth switching.

## Task 6.25: Production Readiness Security Hardening V1

Task 6.25 adds `docs/PRODUCTION_READINESS_SECURITY_HARDENING.md` as production readiness security hardening documentation and static tests.

This task adds no auth runtime, no deployment runtime, no sync runtime, no production backend activation, no production monitoring service, no secret values, no route additions, no package changes, no production source-of-truth migration, and no browser mutation route.

Task 6.25 locks secret leakage controls, sensitive data logging controls, route boundaries, privacy controls, and continued no-auth/no-deployment runtime status.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

`localStorage` remains default runtime source, fallback, migration source, and emergency backup. `api-primary-dev` remains explicit dev/local only and not production-ready.

Recommended next task is `Task 6.26 Production Manual Acceptance Runbook V1`, docs/static tests only. Task 6.26 must not add production runtime, auth runtime, sync runtime, deployment runtime, package changes, routes, or source-of-truth switching.

## Task 6.26: Production Manual Acceptance Runbook V1

Task 6.26 adds `docs/PRODUCTION_MANUAL_ACCEPTANCE_RUNBOOK.md` as a production-readiness manual acceptance runbook.

This task adds no production runtime, no auth runtime, no sync runtime, no deployment runtime, no production backend activation, no secret values, no route additions, no package changes, no production source-of-truth migration, and no browser mutation route.

Task 6.26 requires a dedicated test environment, dedicated browser profile, dedicated dev DB where applicable, synthetic data, source-of-truth checks, auth/account status checks, sync status checks, backup/export/delete/recovery checks, deployment status checks, rollback checks, and pass/fail template.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

`localStorage` remains default runtime source, fallback, migration source, and emergency backup. `api-primary-dev` remains explicit dev/local only and not production-ready.

Recommended next task is `Task 6.27 Production Rollback & Incident Runbook V1`, docs/static tests only. Task 6.27 must not add runtime incident handling, production deployment, auth runtime, sync runtime, package changes, routes, or source-of-truth switching.

## Task 6.27: Production Rollback & Incident Runbook V1

Task 6.27 adds `docs/PRODUCTION_ROLLBACK_INCIDENT_RUNBOOK.md` as production rollback and incident runbook documentation.

This task adds no runtime incident handling, no production deployment, no auth runtime, no sync runtime, no production backend activation, no secret values, no route additions, no package changes, no production source-of-truth migration, and no browser mutation route.

Task 6.27 documents rollback, incident detection, data safety, restore verification, privacy incident handling, and rollback procedure template without implementation.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

`localStorage` remains default runtime source, fallback, migration source, and emergency backup. `api-primary-dev` remains explicit dev/local only and not production-ready.

Recommended next task is `Task 6.28 Production Data Export / Delete Plan V1`, docs/static tests only. Task 6.28 must not add export/delete runtime, account deletion runtime, backup retention runtime, audit retention runtime, package changes, routes, or source-of-truth switching.

## Task 6.28: Production Data Export / Delete Plan V1

Task 6.28 adds `docs/PRODUCTION_DATA_EXPORT_DELETE_PLAN.md` as production data export/delete planning documentation.

This task adds no export/delete runtime, no account deletion runtime, no backup retention runtime, no audit retention runtime, no secret values, no route additions, no package changes, no production source-of-truth migration, and no browser mutation route.

Task 6.28 plans export, delete, account deletion, backup retention, and audit record retention responsibilities without implementation.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

`localStorage` remains default runtime source, fallback, migration source, and emergency backup. `api-primary-dev` remains explicit dev/local only and not production-ready.

Recommended next task is `Task 6.29 Production Phase Implementation Boundary Lock V1`, docs/static tests only. Task 6.29 must not add production runtime, auth runtime, sync runtime, deployment runtime, package changes, routes, or source-of-truth switching.

## Task 6.29: Production Phase Implementation Boundary Lock V1

Task 6.29 adds `docs/PRODUCTION_PHASE_IMPLEMENTATION_BOUNDARY_LOCK.md` as the production phase implementation boundary lock.

This task adds no production runtime, no auth runtime, no sync runtime, no deployment runtime, no secret values, no route additions, no package changes, no production source-of-truth migration, and no browser mutation route.

Task 6.29 locks accepted capabilities, planned-only capabilities, blocked capabilities, route allowlist, source-of-truth status, and auth/sync/deployment status.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

`localStorage` remains default runtime source, fallback, migration source, and emergency backup. `api-primary-dev` remains explicit dev/local only and not production-ready.

Recommended next task is `Task 6.30 Production Release Readiness Checkpoint V1`, docs/static tests only. Task 6.30 must not add production runtime, auth runtime, sync runtime, deployment runtime, package changes, routes, or source-of-truth switching.

## Task 6.30: Production Release Readiness Checkpoint V1

Task 6.30 adds `docs/PRODUCTION_RELEASE_READINESS_CHECKPOINT.md` as the production release readiness checkpoint.

This task adds no production runtime, no auth runtime, no sync runtime, no deployment runtime, no secret values, no route additions, no package changes, no production source-of-truth migration, and no browser mutation route.

Task 6.30 checkpoints implemented production capabilities, still blocked production capabilities, auth/account status, backend status, sync status, deployment status, source-of-truth status, data migration status, privacy/security status, rollback status, and CI/ruleset status.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

`localStorage` remains default runtime source, fallback, migration source, and emergency backup. `api-primary-dev` remains explicit dev/local only and not production-ready.

Recommended next task is `Task 6.31 Production Manual Acceptance Runbook V1`, docs/static tests only. Task 6.31 must not add production runtime, auth runtime, sync runtime, deployment runtime, package changes, routes, or source-of-truth switching.

## Task 6.31: Production Manual Acceptance Runbook V1

Task 6.31 updates `docs/PRODUCTION_MANUAL_ACCEPTANCE_RUNBOOK.md` with final readiness alignment for Phase 6 manual acceptance.

This task adds no production runtime, no auth runtime, no sync runtime, no deployment runtime, no secret values, no route additions, no package changes, no production source-of-truth migration, and no browser mutation route.

Task 6.31 records final manual acceptance expectations for dedicated test environment, synthetic data only, source-of-truth checks, auth/account if implemented, sync if implemented, backup/export/delete/recovery checks, deployment if implemented, rollback checks, and privacy/security checks.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

`localStorage` remains default runtime source, fallback, migration source, and emergency backup. `api-primary-dev` remains explicit dev/local only and not production-ready.

Recommended next task is `Task 6.32 Production Security & Privacy Final Hardening V1`, docs/static tests and narrow privacy/security fixes only. Task 6.32 must not add a new auth provider, sync engine, production deployment surface, route, package dependency, package script, lockfile change, production source-of-truth switch, or real-data migration.

## Task 6.32: Production Security & Privacy Final Hardening V1

Task 6.32 adds `docs/PRODUCTION_SECURITY_PRIVACY_FINAL_HARDENING.md` as the Phase 6 final security/privacy hardening decision record.

This task adds no production runtime, no auth runtime, no sync runtime, no deployment runtime, no monitoring service, no secret values, no route additions, no package changes, no production source-of-truth migration, and no browser mutation route.

Task 6.32 locks secret leakage controls, sensitive data logging controls, privacy controls, route boundaries, source-of-truth boundaries, and final hardening checks. Raw AppData logging is blocked. localStorage dump logging is blocked. Token and secret logging is blocked. Automated checks remain synthetic data only.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

`localStorage` remains default runtime source, fallback, migration source, and emergency backup. `api-primary-dev` remains explicit dev/local only and not production-ready.

Recommended next task is `Task 6.33 Production Backup, Export, Delete & Recovery Acceptance V1`, docs/static tests only. Task 6.33 must not add destructive automated real-data operations, backup/import/export HTTP routes, reset/recovery HTTP routes, package changes, source-of-truth switching, or real-data migration.

## Task 6.33: Production Backup, Export, Delete & Recovery Acceptance V1

Task 6.33 adds `docs/PRODUCTION_BACKUP_EXPORT_DELETE_RECOVERY_ACCEPTANCE.md` as production backup/export/delete/recovery acceptance documentation.

This task adds no backup runtime, no export runtime, no delete runtime, no recovery runtime, no destructive automated real-data operation, no backup/import/export HTTP route, no reset/recovery HTTP route, no route additions, no package changes, no production source-of-truth migration, and no browser mutation route.

Task 6.33 documents export policy acceptance, delete policy acceptance, account deletion implications if accounts exist, backup-first rule, restore verification, rollback drill, no destructive automated real-data operation, and no silent overwrite.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

`localStorage` remains default runtime source, fallback, migration source, and emergency backup. `api-primary-dev` remains explicit dev/local only and not production-ready.

Recommended next task is `Task 6.34 Production Sync / Conflict Final Audit V1`, docs/static tests only. Task 6.34 must not add sync runtime, network writes, cloud writes, background sync workers, remote write queues, package changes, source-of-truth switching, or real-data migration.

## Task 6.34: Production Sync / Conflict Final Audit V1

Task 6.34 adds `docs/PRODUCTION_SYNC_CONFLICT_FINAL_AUDIT.md` as production sync/conflict final audit documentation.

This task adds no sync runtime, no network writes, no cloud writes, no background sync worker, no remote write queue, no automatic merge runtime, no route additions, no package changes, no production source-of-truth migration, and no browser mutation route.

Task 6.34 audits no sync runtime, sync scope if implemented later, conflict model, idempotency, duplicate cloud write prevention, offline behavior, source-of-truth rules, rollback, and route boundaries.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

`localStorage` remains default runtime source, fallback, migration source, and emergency backup. `api-primary-dev` remains explicit dev/local only and not production-ready.

Recommended next task is `Task 6.35 Production Deployment & Environment Final Audit V1`, docs/static tests only. Task 6.35 must not add production deployment, deployment config that changes production behavior, secret values, package changes, routes, source-of-truth switching, or real-data migration.

## Task 6.35: Production Deployment & Environment Final Audit V1

Task 6.35 adds `docs/PRODUCTION_DEPLOYMENT_ENVIRONMENT_FINAL_AUDIT.md` as production deployment/environment final audit documentation.

This task adds no production deployment, no deployment config that changes production behavior, no hosted backend activation, no secret values, no route additions, no package changes, no production source-of-truth migration, and no browser mutation route.

Task 6.35 audits environments, secrets, branch rules, required checks, rollback, preview vs production distinction, no Vercel required check assumption for Codex PRs, and no deployment if deployment was not implemented.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

`localStorage` remains default runtime source, fallback, migration source, and emergency backup. `api-primary-dev` remains explicit dev/local only and not production-ready.

Recommended next task is `Task 6.36 Production Monitoring & Logging Privacy Lock V1`, docs/static tests only. Task 6.36 must not add external monitoring service, production telemetry runtime, package changes, routes, source-of-truth switching, or real-data logging.

## Task 6.36: Production Monitoring & Logging Privacy Lock V1

Task 6.36 adds `docs/PRODUCTION_MONITORING_LOGGING_PRIVACY_LOCK.md` as production monitoring/logging privacy lock documentation.

This task adds no external monitoring service, no production telemetry runtime, no analytics runtime, no route additions, no package changes, no production source-of-truth migration, and no browser mutation route.

Task 6.36 locks sensitive data redaction, no raw AppData logging, no localStorage dump logging, no token or secret logging, privacy-safe diagnostics, and future observability gates.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

`localStorage` remains default runtime source, fallback, migration source, and emergency backup. `api-primary-dev` remains explicit dev/local only and not production-ready.

Recommended next task is `Task 6.37 Production Release Candidate Regression Lock V1`, docs/static tests only. Task 6.37 must not add production runtime, auth runtime, sync runtime, deployment runtime, package changes, routes, source-of-truth switching, or real-data migration.

## Task 6.37: Production Release Candidate Regression Lock V1

Task 6.37 adds `docs/PRODUCTION_RELEASE_CANDIDATE_REGRESSION_LOCK.md` as production release candidate regression lock documentation.

This task adds no production runtime, no auth runtime, no sync runtime, no deployment runtime, no monitoring runtime, no route additions, no package changes, no production source-of-truth migration, and no browser mutation route.

Task 6.37 locks accepted production capabilities, blocked capabilities, source-of-truth rules, auth/sync/deployment status, migration/rollback status, CI/ruleset status, browser build isolation, no unapproved routes, and coverage inventory.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

`localStorage` remains default runtime source, fallback, migration source, and emergency backup. `api-primary-dev` remains explicit dev/local only and not production-ready.

Recommended next task is `Task 6.38 Phase 6 Final Manual Acceptance V1`, docs/static tests only. Task 6.38 must not add production runtime, auth runtime, sync runtime, deployment runtime, package changes, routes, source-of-truth switching, or real-data migration.

## Task 6.38: Phase 6 Final Manual Acceptance V1

Task 6.38 adds `docs/PHASE6_FINAL_MANUAL_ACCEPTANCE.md` as Phase 6 final manual acceptance documentation.

This task adds no production runtime, no auth runtime, no sync runtime, no deployment runtime, no monitoring runtime, no route additions, no package changes, no production source-of-truth migration, and no browser mutation route.

Task 6.38 documents the production readiness scenario matrix, local/dev fallback, source-of-truth checks, auth/account if implemented, sync if implemented, backup/export/delete/recovery, deployment if implemented, rollback, and pass/fail template.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

`localStorage` remains default runtime source, fallback, migration source, and emergency backup. `api-primary-dev` remains explicit dev/local only and not production-ready.

Recommended next task is `Task 6.39 Phase 6 Exit Regression Lock V1`, docs/static tests only. Task 6.39 must not add production runtime, auth runtime, sync runtime, deployment runtime, package changes, routes, source-of-truth switching, real-data migration, or Phase 7 work.

## Task 6.39: Phase 6 Exit Regression Lock V1

Task 6.39 adds `docs/PHASE6_EXIT_REGRESSION_LOCK.md` as Phase 6 exit regression lock documentation.

This task adds no Phase 7 work, no production runtime, no auth runtime, no sync runtime, no deployment runtime, no monitoring runtime, no route additions, no package changes, no production source-of-truth migration, and no browser mutation route.

Task 6.39 locks final Phase 6 accepted capabilities, final blocked capabilities, final source-of-truth status, final auth/sync/deployment status, final migration/rollback status, final route allowlist, final CI/ruleset policy, and no Phase 7 auto-start.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

`localStorage` remains default runtime source, fallback, migration source, and emergency backup. `api-primary-dev` remains explicit dev/local only and not production-ready.

Recommended next task is `Task 6.40 Phase 6 Completion Archive V1`, docs/static tests only. Task 6.40 must not start Phase 7, Task 6.41, production runtime implementation, auth runtime, sync runtime, deployment runtime, source-of-truth switching, routes, package changes, or real-data migration.

## Task 6.40: Phase 6 Completion Archive V1

Task 6.40 adds `docs/PHASE6_COMPLETION_ARCHIVE.md` as Phase 6 completion archive documentation.

This task adds no Phase 7 work, no Task 6.41 work, no production runtime, no auth runtime, no sync runtime, no deployment runtime, no monitoring runtime, no route additions, no package changes, no production source-of-truth migration, and no browser mutation route.

Task 6.40 states Phase 6 complete, production readiness status, source-of-truth status, auth/account status, sync status, deployment status, privacy/security status, migration/backup/recovery status, final accepted routes, final blocked routes, final validation commands, final CI/ruleset policy, and recommended next task only.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

`localStorage` remains default runtime source, fallback, migration source, and emergency backup. `api-primary-dev` remains explicit dev/local only and not production-ready.

Recommended next task is `Phase 7 Task 7.1 Production Runtime Implementation Authorization Gate V1`. Do not auto-start Phase 7. Do not auto-start Task 6.41.

## Task 7.1: Production Runtime Implementation Authorization Gate V1

Task 7.1 opens Phase 7 with `docs/PHASE7_PRODUCTION_RUNTIME_IMPLEMENTATION_AUTHORIZATION_GATE.md`.

This task authorizes docs/static tests only. It adds no production backend, auth runtime, cloud sync runtime, deployment runtime, monitoring runtime, production source-of-truth switch, route, package change, normalized table, or destructive real-data migration.

`localStorage` remains default runtime source, fallback, migration source, and emergency backup. `api-primary-dev` remains explicit dev/local only and not production-ready.

Recommended next task is `Task 7.2 Production Runtime Contract Scaffold Authorization V1`. Task 7.2 is not started by Task 7.1.

## Task 7.2: Production Runtime Contract Scaffold Authorization V1

Task 7.2 adds `docs/PRODUCTION_RUNTIME_CONTRACT_SCAFFOLD_AUTHORIZATION.md`.

This task defines future production contract scaffold boundaries without implementing backend runtime, auth, sync, deployment, monitoring, route additions, package changes, or source-of-truth switching.

Recommended next task is `Task 7.3 Production Route Surface Freeze V1`. Task 7.3 is not started by Task 7.2.

## Task 7.3: Production Route Surface Freeze V1

Task 7.3 adds `docs/PRODUCTION_ROUTE_SURFACE_FREEZE.md`.

This task freezes the seven accepted browser mutation routes, separates read route candidates from mutation candidates, and keeps blocked routes blocked. It adds no routes, handlers, clients, backend runtime, or source-of-truth switching.

Recommended next task is `Task 7.4 Production Source-of-Truth Migration Preconditions V1`. Task 7.4 is not started by Task 7.3.

## Task 7.4: Production Source-of-Truth Migration Preconditions V1

Task 7.4 adds `docs/PRODUCTION_SOURCE_OF_TRUTH_MIGRATION_PRECONDITIONS.md`.

This task defines required evidence before any production source-of-truth switch. It does not implement migration, modify persistence behavior, replace localStorage, add backend/auth/sync, or authorize production source-of-truth switching.

Recommended next task is `Task 7.5 Production Auth & User Data Boundary Plan V1`. Task 7.5 is not started by Task 7.4.

## Task 7.5: Production Auth & User Data Boundary Plan V1

Task 7.5 adds `docs/PRODUCTION_AUTH_USER_DATA_BOUNDARY_PLAN.md`.

This task defines auth, user identity, data ownership, local-data association, cloud-sync dependency, source-of-truth dependency, privacy, and test-data boundaries. It does not add auth runtime, login UI, user table, backend runtime, sync runtime, package changes, or source-of-truth switching.

Recommended next task is `Task 7.6 Production Backend Architecture Decision V1`. Task 7.6 is not started by Task 7.5.

## Task 7.6: Production Backend Architecture Decision V1

Task 7.6 adds `docs/PRODUCTION_BACKEND_ARCHITECTURE_DECISION.md`.

This task rejects promoting `devApiRunner`, `api-primary-dev`, or local `node:sqlite` snapshot repository into production. It recommends a separate future production backend direction without implementing backend, auth, sync, deployment, monitoring, database, route, package, or source-of-truth changes.

Recommended next task is `Task 7.7 Production Runtime Skeleton Authorization V1`. Task 7.7 is not started by Task 7.6.

## Task 7.7: Production Runtime Skeleton Authorization V1

Task 7.7 adds `docs/PRODUCTION_RUNTIME_SKELETON_AUTHORIZATION.md`.

This task defines allowed and disallowed scope for a possible future disabled-by-default skeleton. It does not implement a skeleton, backend, auth, sync, deployment, monitoring, source-of-truth switch, routes, normalized tables, or package changes.

Recommended next task is `Task 7.8 Frontend Runtime Selector Production Guard V1`. Task 7.8 is not started by Task 7.7.

## Task 7.8: Frontend Runtime Selector Production Guard V1

Task 7.8 adds `docs/FRONTEND_RUNTIME_SELECTOR_PRODUCTION_GUARD.md`.

This task locks production guard rules for frontend runtime selection, environment variable safety, production build safety, Vercel preview/production boundary, dev API source-of-truth prevention, route boundaries, and dist token expectations. It changes no runtime selector behavior.

Recommended next task is `Task 7.9 Production Release Readiness Checklist V1`. Task 7.9 is not started by Task 7.8.

## Task 7.9: Production Release Readiness Checklist V1

Task 7.9 adds `docs/PRODUCTION_RELEASE_READINESS_CHECKLIST.md`.

This task creates the production release readiness checklist that must be completed before future production release or source-of-truth switch. It does not authorize implementation, source-of-truth switching, backend, auth, sync, deployment, monitoring, package changes, or routes.

Recommended next task is `Task 7.10 Phase 7 Completion Archive V1`. Task 7.10 is not started by Task 7.9.

## Task 7.10: Phase 7 Completion Archive V1

Task 7.10 adds `docs/PHASE7_COMPLETION_ARCHIVE.md`.

This task archives Phase 7 completion, records completed Task 7.1-7.9 PR/merge evidence, records validation evidence, confirms Phase 7 stayed within authorization/planning/guard/readiness/archive scope, and recommends `Task 8.1 Production Runtime Implementation Entry Gate V1` only.

Task 7.10 does not start Phase 8 and does not implement production runtime, backend, auth, sync, deployment, monitoring, source-of-truth switching, routes, package changes, or real-data migration.

## Task 8.1: Production Runtime Implementation Entry Gate V1

Task 8.1 adds `docs/PHASE8_PRODUCTION_RUNTIME_IMPLEMENTATION_ENTRY_GATE.md`.

This task opens Phase 8 as a narrow implementation entry gate. It authorizes only explicit Task 8.x scoped boundary work, keeps localStorage as default/fallback/migration/emergency source, keeps `api-primary-dev` dev/local only and not production-ready, and preserves the seven accepted browser mutation routes.

Task 8.1 does not add runtime code, backend runtime, auth, sync, deployment, monitoring, source-of-truth switching, package changes, lockfile changes, normalized tables, destructive migrations, real personal training data, or an eighth browser mutation route.

## Task 8.2: Production Runtime Skeleton Boundary V1

Task 8.2 adds `apps/api/src/node/productionRuntimeSkeleton.ts` and `docs/PRODUCTION_RUNTIME_SKELETON_BOUNDARY.md`.

This task creates an inert Node-only production runtime skeleton boundary with stable disabled/scaffold-only capabilities. It is not exported from the browser-facing API index, does not auto-listen, does not read or write user data, and does not change App runtime behavior.

Task 8.2 does not add a live backend, auth, sync, deployment, monitoring, persistence, source-of-truth switching, routes, package changes, lockfile changes, normalized tables, destructive migration, or real personal training data.

## Task 8.3: Production Runtime Config Guard V1

Task 8.3 adds `apps/api/src/node/productionRuntimeConfig.ts` and `docs/PRODUCTION_RUNTIME_CONFIG_GUARD.md`.

This task adds a fail-closed Node-only config guard for future production runtime skeleton work. It rejects `api-primary-dev`, dev/local runtime kinds, localhost/dev API backend URLs, missing required production config, and secret values.

Task 8.3 does not activate production runtime, add frontend runtime switching, add routes, implement backend/auth/sync/deployment/monitoring, switch source-of-truth, change packages, modify lockfiles, add normalized tables, or use real personal training data.

## Task 8.4: Production Health & Capability Endpoint V1

Task 8.4 adds `apps/api/src/node/productionRuntimeRoutes.ts` and `docs/PRODUCTION_HEALTH_CAPABILITY_ENDPOINT.md`.

This task adds Node-only route-like handling for `GET /health` and `GET /capabilities`. The handlers are plain functions, not registered HTTP routes, and capability payloads report production runtime, source-of-truth, auth, sync, deployment, monitoring, read, and write status separately.

Task 8.4 does not add browser mutation routes, auto-start a server, listen on ports, connect to real user data, perform writes, add deployment config, switch source-of-truth, add package changes, or implement auth/sync/monitoring.

## Task 8.5: Production Persistence Strategy Adapter V1

Task 8.5 adds `apps/api/src/node/productionPersistence.ts` and `docs/PRODUCTION_PERSISTENCE_STRATEGY_ADAPTER.md`.

This task defines a production persistence adapter boundary and a synthetic in-memory test adapter for read summaries and history detail. The adapter reports `sourceOfTruth: false` and is not a real production database.

Task 8.5 does not import `node:sqlite`, use sqliteRepository as production persistence, add normalized tables, add migrations, write real data, change source-of-truth, add package dependencies, add routes, or use real personal training data.

## Task 8.6: Production Read Contract Implementation V1

Task 8.6 adds `apps/api/src/node/productionReadContract.ts` and `docs/PRODUCTION_READ_CONTRACT_IMPLEMENTATION.md`.

This task implements Node-only route-like read handling for `GET /app-data/summary`, `GET /sessions/summary`, `GET /history`, `GET /history/:id`, and `GET /data-health/summary` through the production persistence adapter boundary. Responses report `sourceOfTruth: false`.

Task 8.6 does not add write routes, browser mutation routes, App runtime integration, localStorage backend persistence, real database access, auth, sync, deployment, monitoring, source-of-truth switching, package changes, or real personal training data.

## Task 8.7: Frontend Production API Client Skeleton V1

Task 8.7 adds `src/productionApi/productionApiClient.ts`, `src/productionApi/productionApiConfig.ts`, and `docs/FRONTEND_PRODUCTION_API_CLIENT_SKELETON.md`.

This task adds a browser-safe, disabled-by-default production API client skeleton with explicit opt-in config and safe read/capability calls only.

Task 8.7 does not integrate with `App.tsx`, auto-call a backend, expose mutation methods, write to backend, replace localStorage, switch source-of-truth, import Node-only modules, add auth/sync behavior, add routes, or change packages/lockfiles.

## Task 8.8: Production Dual-Read Comparison V1

Task 8.8 adds `src/productionApi/productionDualReadComparison.ts` and `docs/PRODUCTION_DUAL_READ_COMPARISON.md`.

This task adds disabled-by-default diagnostic comparison between local read values and production API read values. Results are non-blocking and report `diagnosticOnly: true`, `appCanContinue: true`, and `mutatedLocal: false`.

Task 8.8 does not integrate with App runtime, overwrite localStorage or AppData, repair data, sync data, write backend data, call mutation routes, switch source-of-truth, import Node-only modules, add package changes, or use real personal training data.

## Task 8.9: Production Mutation Contract Guard V1

Task 8.9 adds `docs/PRODUCTION_MUTATION_CONTRACT_GUARD.md`.

This task locks the production mutation contract before write shadow mode. The accepted browser mutation route allowlist remains exactly seven, blocked repair/backup/import/export/reset/recovery routes remain blocked, and production write path remains not source-of-truth.

Task 8.9 is docs/static tests only. It does not add mutation endpoints, route handlers, backend source-of-truth writes, browser clients, runtime integration, package changes, lockfile changes, or real personal training data.

## Task 8.10: Production Write Shadow Mode V1

Task 8.10 adds `src/productionApi/productionWriteShadowMode.ts` and `docs/PRODUCTION_WRITE_SHADOW_MODE.md`.

This task adds disabled-by-default write shadow mode with stable statuses `disabled`, `unsupported`, `accepted_shadow`, `rejected`, and `failed`. Shadow mode uses only the existing seven accepted mutation route names as candidates and reports `sourceOfTruth: false` and `localStorageMutated: false`.

Task 8.10 does not write backend data, overwrite localStorage, overwrite AppData, switch source-of-truth, add routes, call repair/import/export/reset, implement auth/sync/deployment/monitoring, add package changes, or use real personal training data.

## Task 8.11: Production Backend Deployment Boundary V1

Task 8.11 adds `docs/PRODUCTION_BACKEND_DEPLOYMENT_BOUNDARY.md`.

This task documents that Vercel frontend deployment does not equal backend production readiness, `api-primary-dev` and devApiRunner must not be deployed as production backend, and future backend deployment needs a separate service/security/environment model.

Task 8.11 is docs/static tests only. It does not add deployment config, Vercel functions, CI scripts, package scripts, dependencies, lockfile changes, monitoring runtime, production source-of-truth switching, or backend deployment.
