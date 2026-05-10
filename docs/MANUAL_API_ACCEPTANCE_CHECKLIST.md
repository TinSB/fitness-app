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
