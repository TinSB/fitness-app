# Dev API Read-only App Integration Plan

Task 4.19 defines the safest future path for a dev-only read-only App prototype. It is a plan and decision record only; it does not implement browser runtime integration.

## Scope / Non-goals

- This is a read-only App integration plan.
- This is not App integration implementation.
- There is no App.tsx implementation.
- There is no UI change.
- There is no frontend API client implementation.
- There is no feature flag runtime implementation.
- There is no localStorage replacement.
- There is no mutation integration.
- There is no production backend.
- There is no auth / sync / deployment.
- There is no package dependency.
- There is no package script.
- There are no normalized tables.
- There is no HTTP backup, import, reset, or delete endpoint.
- App runtime still uses localStorage by default.
- Formal App.tsx HTTP migration and write-path migration remain blocked.

## Current Architecture Baseline

Browser runtime:

- `App.tsx`
- `src/storage/persistence.ts` compatibility facade
- `src/storage/localStorageAdapter.ts`
- `AppData`

Shared and pure boundaries:

- `appDataSanitize`
- `appDataMigration`
- `appDataValidation`
- `readMirror`
- `sessionMutation`
- `recordDataHealthMutation`

Node-only stack:

- `sqliteRepository`
- `serverAdapter`
- `httpRuntimeAdapter`
- `devLauncher`
- `devApiRunner`
- `devDbRecovery`

`apps/api/src/index.ts` is browser-facing. `apps/api/src/node/index.ts` is Node-only. The Dev API is local/dev only. Browser build must remain free of `node:http`, `node:sqlite`, devLauncher, httpRuntimeAdapter, serverAdapter, sqliteRepository, devApiRunner, and devDbRecovery.

## Recommended Mode

Recommended mode: Dual-read comparison mode only.

- localStorage remains the only active App source of truth.
- Dev API read results are used only for comparison and diagnostics.
- UI must not write to API.
- UI must not replace localStorage data.
- API unavailable must not block normal App usage.
- There is no automatic sync.
- There is no automatic migration.
- There is no silent overwrite.
- Rollback is done by disabling the future dev-only comparison path.

## Read-only Scope Candidate

Future read-only prototype candidates:

- App data summary
- Sessions summary
- History list
- History detail
- DataHealth summary

Not included:

- Focus Mode runtime
- session start / complete / discard from UI
- record edit from UI
- DataHealth repair from UI
- backup import/export over HTTP
- nutrition / algorithm changes
- scheduler mutation
- plan/template mutation

## Future API Client Strategy

Task 4.20, if accepted, must first design a dev-only frontend API client. Task 4.19 does not create API client files.

Future client requirements:

- dev-only client
- explicit opt-in flag input
- timeout behavior
- error normalization
- no mutation methods
- no backup import/export methods
- no automatic retry that changes data
- no localStorage writes from API result
- no production base URL assumption

## Future Feature Flag Strategy

Task 4.20, if accepted, must design an explicit dev-only flag. Task 4.19 does not implement a feature flag.

Future flag requirements:

- explicit dev-only flag
- default off
- visible label or diagnostic state
- easy disable
- no production default
- no automatic enable when the dev API is running
- no persisted user-facing migration switch without acceptance

## Source-of-truth Rules

- localStorage is default and active source of truth.
- Dev API is comparison/shadow read only.
- API response must never overwrite localStorage.
- There is no dual-write.
- There is no mutation route from App.
- There is no backup/import route from App.
- There is no repair/reset route from App.
- There is no automatic merge.
- There is no automatic migration.

## API-unavailable Fallback Plan

If the Dev API is unavailable:

- App continues using localStorage.
- There is no user-facing hard failure.
- Diagnostics can show API unavailable.
- No data mutation happens.
- Comparison mode is skipped.
- User can continue training normally.

## Data Comparison Strategy

Future read-only comparison should compare:

- localStorage-derived readMirror equivalent
- Dev API readMirror result
- summary-level outputs first

Comparison rules:

- Avoid comparing volatile timestamps unless normalized.
- Report mismatch only as diagnostics.
- Mismatch never overwrites data.
- Mismatch never blocks training.
- Mismatch never triggers repair automatically.

## Security / Privacy / Localhost Boundary

- Dev API is localhost-only by default.
- No auth exists yet.
- There is no LAN exposure by default.
- There is no production deployment.
- There is no personal data upload.
- There is no cloud sync.
- Dev DB may contain personal training data and must not be committed.
- Use `docs/DEV_API_RECOVERY_RESET.md` for dev DB cleanup.

## Rollback Plan

- Remove or disable the future read-only comparison flag.
- Keep App runtime on localStorage.
- Stop the dev API runner.
- There are no API writes to revert.
- No localStorage overwrite happened.
- Reset or backup the dev DB using `docs/DEV_API_RECOVERY_RESET.md` if needed.
- There is no dependency rollback needed.
- There is no production migration rollback needed.

## Required Acceptance Gates Before Task 4.20

- `npm run api:dev:build`
- `npm run typecheck`
- `npm test`
- `npm run build`
- Dev runner manual acceptance passed.
- Recovery/reset runbook exists.
- Browser build has no `node:http` or `node:sqlite`.
- No frontend API client yet.
- No App.tsx integration yet.
- No mutation route used by App.
- No localStorage replacement.
- API unavailable fallback documented.
- Comparison mismatch behavior documented.
- Rollback plan documented.

## Proposed Task 4.20

The only next recommended task, if Task 4.19 acceptance passes, is `Task 4.20 Read-only App Integration Prototype V1`.

Task 4.20 must remain:

- dev-only
- explicit opt-in
- dual-read comparison mode only
- no UI writes to API
- no localStorage replacement
- no mutation migration
- no backup/import over HTTP
- no production server assumption
- no auth/sync
- visible fallback
- easy rollback

## Decision Record

- Date: 2026-05-10
- Branch / commit: record during manual acceptance
- Decision: Plan a future dev-only read-only App prototype without implementing it in Task 4.19.
- Recommendation: Dual-read comparison mode only.
- Rejected options: direct App.tsx HTTP migration, API-primary source of truth, frontend API client now, feature flag runtime now, UI writes to API, localStorage replacement, mutation migration, production backend.
- Required next task: `Task 4.20 Read-only App Integration Prototype V1`, only if Task 4.19 acceptance passes.
- Risks: data loss, stale API snapshots, unavailable dev API, accidental production exposure, browser bundle pollution, user confusion.
- Rollback plan: keep App runtime on localStorage, stop dev API runner, disable future comparison path, and use recovery/reset runbook for dev DB cleanup.

## Final Recommendation

Task 4.19 result: Plan only.

Ready for Task 4.20 Read-only App Integration Prototype V1 only if explicit dev-only dual-read comparison mode is maintained.

Formal App.tsx HTTP migration and write-path migration remain blocked.

## Task 4.20 Prototype Result

Task 4.20 implements the minimal dev-only prototype described by this plan.

Implemented opt-in:

- `import.meta.env.DEV` must be true.
- `VITE_IRONPATH_DEV_API_COMPARE` must be `"1"`.
- `VITE_IRONPATH_DEV_API_BASE_URL` is optional and defaults to `http://127.0.0.1:8787`.
- The base URL must be localhost-only: `localhost`, `127.0.0.1`, `[::1]`, or `::1`.
- `VITE_IRONPATH_DEV_API_TIMEOUT_MS` is optional and defaults to `1500`.

Implemented comparison scope:

- `/app-data/summary`
- `/sessions/summary`
- `/history`
- `/data-health/summary`
- `/history/:id` only when a stable local history id exists

Prototype behavior:

- localStorage remains the active source of truth.
- API results never overwrite localStorage.
- UI never writes to the API.
- No mutation route is called from App.
- API unavailable becomes diagnostic `unavailable` state and does not block App usage.
- Mismatch becomes diagnostic `mismatch` state and does not repair, overwrite, merge, or migrate data.
- Diagnostics render only when explicitly enabled or when the explicit config is invalid.
- Diagnostics expose no repair, sync, overwrite, import, export, reset, or mutation controls.

Rollback remains disabling the dev-only comparison flag and stopping the dev API runner. Formal App.tsx HTTP migration and write-path migration remain blocked after Task 4.20.

## Task 4.21 Acceptance Result

Task 4.21 adds read-only runtime parity acceptance for the existing Task 4.20 prototype. It is an acceptance/testing layer only and does not add runtime features, widen read-only routes, connect write routes, or change App state flow.

Accepted parity points:

- flag-off parity: when the explicit dev flag is off, diagnostics render null, no fetch calls are made, AppData is not changed, localStorage is not written, and production-like env keeps comparison disabled even if `VITE_IRONPATH_DEV_API_COMPARE="1"`.
- GET-only runtime proof: enabled diagnostics may call only read-only GET routes for `/health`, `/app-data/summary`, `/sessions/summary`, `/history`, `/history/:id`, and `/data-health/summary`.
- API unavailable fallback proof: network failure or timeout returns unavailable/error diagnostics only; App usage remains on localStorage and does not throw to the App root.
- mismatch diagnostics-only proof: local/remote readMirror differences produce mismatch diagnostics and mismatch counts only.
- localStorage remains source of truth: API results never overwrite localStorage or AppData, snapshot metadata from API responses is ignored for persistence, and no dual-write path exists.
- no UI writes to API: the diagnostics panel has no mutation, repair, sync, overwrite, import, export, reset, apply, or fix controls.
- no mutation route used by App: App code does not call session, history, DataHealth, backup/import, reset, or recovery mutation endpoints.
- browser isolation proof: browser/runtime source remains free of `node:http`, `node:sqlite`, and the Node-only stack.

API unavailable fallback remains diagnostic-only. Formal App.tsx HTTP migration, source-of-truth switching, and write-path migration remains blocked after Task 4.21.

## Task 4.22 Diagnostics UX Hardening Result

Task 4.22 hardens the read-only diagnostics UX for development use only. It does not add runtime features, routes, mutation methods, source-of-truth switching, production backend behavior, auth, sync, deployment, package dependencies, or package scripts.

UX hardening result:

- The diagnostics display model covers disabled, checking, matching, mismatch, unavailable, error, and misconfigured states.
- Disabled remains model-only and renders no visible panel.
- Mismatch is warning-level diagnostics only. localStorage remains source of truth, and No data was changed.
- Unavailable is non-fatal diagnostics only. The App continues using localStorage.
- Misconfigured explains the localhost-only requirement without exposing raw env values or suggesting production URLs.
- Endpoint summary stays compact and shows checked, skipped, matching, mismatch, unavailable, or error status with safe short reasons.
- `/history/:id` is shown as skipped when no stable local history id exists.
- Rendered diagnostics expose no repair, sync, overwrite, import, export, reset, apply, or fix controls.
- `DevApiReadOnlyDiagnostics.tsx` is presentational only; the browser-safe controller owns the cancellable comparison effect.

Read-only diagnostics remain comparison-only. API results never overwrite AppData or localStorage. No UI writes to API, no mutation route is used by App, and write-path migration remains blocked after Task 4.22.
