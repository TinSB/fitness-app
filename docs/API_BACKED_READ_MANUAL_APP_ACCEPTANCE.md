# API-backed Read Manual App Acceptance

## Scope / Non-goals

- [ ] This is manual App acceptance for the dev/local API-backed read prototype.
- [ ] This is not production readiness.
- [ ] This is not API primary runtime.
- [ ] This is not source-of-truth migration.
- [ ] This is not localStorage replacement.
- [ ] This does not add POST writes.
- [ ] This does not add a runtime source selector.
- [ ] This does not add an API-backed persistence adapter.
- [ ] This does not add production backend, auth, sync, cloud, deployment, or monitoring.
- [ ] localStorage remains source of truth.
- [ ] API results never overwrite AppData or localStorage.
- [ ] Use a dedicated test browser profile only.

## Safety Before Testing

- [ ] Do not use real personal training data.
- [ ] Do not use or clear the daily browser profile.
- [ ] Use a dedicated test browser profile.
- [ ] Use a dedicated dev DB file, for example `.ironpath/manual-api-backed-read.sqlite`.
- [ ] Do not commit `.sqlite`, `.sqlite-wal`, `.sqlite-shm`, or `.sqlite-journal` files.
- [ ] Do not treat this as production backend validation.

## Prerequisites

- [ ] Clean git worktree.
- [ ] Task 5.9 is merged into `main`.
- [ ] Dev API runner is available.
- [ ] App dev server is available.
- [ ] Dedicated browser profile is ready.
- [ ] Dedicated dev DB path is ready.
- [ ] `npm run api:dev:build` passes.
- [ ] `npm run typecheck` passes.
- [ ] `npm test` passes.
- [ ] `npm run build` passes.

## Start Dev API Runner

PowerShell:

```powershell
npm run api:dev -- --port 8787 --seed-empty --db .ironpath/manual-api-backed-read.sqlite
```

Acceptance:

- [ ] stdout includes `IronPath dev API ready: <url>`.
- [ ] URL is `localhost` or `127.0.0.1`.
- [ ] No raw stack trace is printed.
- [ ] The dedicated DB file is under `.ironpath/`.
- [ ] `--seed-empty` creates a dev-launcher seed only if no latest snapshot exists.

## Start App Dev Server

PowerShell:

```powershell
$env:VITE_IRONPATH_RUNTIME_SOURCE="api-readonly"
$env:VITE_IRONPATH_DEV_API_BASE_URL="http://127.0.0.1:8787"
npm run dev
```

macOS/Linux:

```bash
VITE_IRONPATH_RUNTIME_SOURCE=api-readonly VITE_IRONPATH_DEV_API_BASE_URL=http://127.0.0.1:8787 npm run dev
```

Acceptance:

- [ ] App opens normally.
- [ ] App data remains available from localStorage.
- [ ] API-backed read diagnostics may be inspected only as a dev/local read surface.
- [ ] No mutation prototype appears solely because `api-readonly` is set.
- [ ] No localStorage overwrite occurs from API results.

## DevTools Network GET-only Check

Allowed GET:

- [ ] `GET /health`
- [ ] `GET /app-data/summary`
- [ ] `GET /sessions/summary`
- [ ] `GET /history`
- [ ] `GET /history/:id` when a stable id exists.
- [ ] `GET /data-health/summary`

Forbidden POST in this flow:

- [ ] `POST /data-health/issues/:issueId/dismiss`
- [ ] `POST /history/:id/data-flag`
- [ ] `POST /history/:id/edit`
- [ ] `POST /sessions/start`
- [ ] `POST /sessions/active/patches`
- [ ] `POST /sessions/active/complete`
- [ ] `POST /sessions/active/discard`
- [ ] `POST /data-health/repair/apply`
- [ ] backup/import/export over HTTP.
- [ ] reset/recovery over HTTP.

Acceptance:

- [ ] Network panel shows GET-only traffic for this runbook.
- [ ] No POST write occurs.
- [ ] No production, auth, sync, cloud, or deployment endpoint is used.

## API Available Scenario

- [ ] Confirm the Dev API runner is still running.
- [ ] Refresh the App.
- [ ] Inspect Network for the allowed GET routes.
- [ ] Confirm safe response summaries can be inspected.
- [ ] Confirm missing snapshot metadata, if present, is visible as metadata absence only.
- [ ] Confirm API results do not overwrite AppData.
- [ ] Confirm API results do not overwrite localStorage.

## API Unavailable Fallback Scenario

- [ ] Stop the Dev API runner with `Ctrl+C`.
- [ ] Refresh the App or retry the read diagnostics.
- [ ] Confirm visible API unavailable behavior.
- [ ] Confirm the App remains usable from localStorage.
- [ ] Confirm no fake success.
- [ ] Confirm no automatic retry loop.
- [ ] Confirm no localStorage write.
- [ ] Restart the Dev API runner and confirm the App can recover after refresh/retry.

## LocalStorage Integrity Check

Before testing:

- [ ] Snapshot localStorage from the dedicated test profile.

After API available and unavailable scenarios:

- [ ] Compare localStorage with the before snapshot.
- [ ] Confirm API response snapshot metadata is not stored in localStorage.
- [ ] Confirm API result does not overwrite AppData or localStorage.
- [ ] Confirm localStorage remains the only active App source of truth.

## Forbidden UI Controls Check

Confirm the API-backed read flow does not show controls or labels for:

- [ ] repair
- [ ] sync
- [ ] overwrite
- [ ] import
- [ ] export
- [ ] reset
- [ ] apply
- [ ] fix
- [ ] migrate

## Browser Build Safety

Acceptance:

- [ ] `npm run build` passes.
- [ ] `dist/` scan finds no `node:http`.
- [ ] `dist/` scan finds no `node:sqlite`.
- [ ] `dist/` scan finds no `devLauncher`.
- [ ] `dist/` scan finds no `httpRuntimeAdapter`.
- [ ] `dist/` scan finds no `serverAdapter`.
- [ ] `dist/` scan finds no `sqliteRepository`.
- [ ] `dist/` scan finds no `devApiRunner`.
- [ ] `dist/` scan finds no `devDbRecovery`.

## Cleanup

- [ ] Stop the App dev server with `Ctrl+C`.
- [ ] Stop the Dev API runner with `Ctrl+C`.
- [ ] Clear env vars.

PowerShell:

```powershell
Remove-Item Env:VITE_IRONPATH_RUNTIME_SOURCE -ErrorAction SilentlyContinue
Remove-Item Env:VITE_IRONPATH_DEV_API_BASE_URL -ErrorAction SilentlyContinue
```

macOS/Linux:

```bash
unset VITE_IRONPATH_RUNTIME_SOURCE
unset VITE_IRONPATH_DEV_API_BASE_URL
```

- [ ] Remove dedicated dev DB artifacts if needed:
  - `.ironpath/manual-api-backed-read.sqlite`
  - `.ironpath/manual-api-backed-read.sqlite-wal`
  - `.ironpath/manual-api-backed-read.sqlite-shm`
  - `.ironpath/manual-api-backed-read.sqlite-journal`
- [ ] Do not delete `.ironpath/dev-api-runner`.
- [ ] Check `git status`.
- [ ] Do not commit dev DB artifacts.

## Manual Pass / Fail Template

- [ ] Date:
- [ ] Branch:
- [ ] Commit:
- [ ] Node version:
- [ ] Dev API command:
- [ ] Dev API URL:
- [ ] App dev command:
- [ ] Browser/profile used:
- [ ] Runtime source flag:
- [ ] Dev API base URL:
- [ ] API available result:
- [ ] API unavailable fallback result:
- [ ] Network GET-only result:
- [ ] Forbidden POST result:
- [ ] LocalStorage integrity result:
- [ ] Forbidden controls result:
- [ ] Browser build result:
- [ ] Cleanup result:
- [ ] Notes:
- [ ] Pass / Fail:

## Decision

Task 5.10 adds human manual App acceptance for the API-backed read prototype only.

It does not approve POST writes, source-of-truth migration, API primary runtime, production readiness, auth, sync, cloud, deployment, or monitoring.

Next recommended task: `Task 5.11 API-backed Read Runtime Regression Lock V1`.

## Final Recommendation

Task 5.10 result: manual App acceptance only.
The API-backed read prototype remains GET-only.
localStorage remains source of truth.
API results never overwrite AppData or localStorage.
No POST write, runtime source selector, API-backed persistence adapter, production backend, auth, sync, cloud, deployment, package change, normalized table, or browser mutation route is added.
Next task should be Task 5.11 API-backed Read Runtime Regression Lock V1.

## Task 5.11 Follow-up: Regression Lock

Task 5.11 adds `docs/API_BACKED_READ_RUNTIME_REGRESSION_LOCK.md` and locks the API-backed read prototype as GET-only diagnostics.

The lock preserves the allowed GET route list, source switch boundary, localStorage/AppData integrity, failure behavior, browser Node-only boundary, coverage inventory, manual acceptance inventory, and future work gate.

Task 5.11 adds no POST write, no runtime source selector, no API-backed persistence adapter, no App.tsx mount, no localStorage write, no AppData overwrite, no production backend, no auth, no sync, no deployment, and no browser mutation route.

Next task: `Task 5.12 Active Session Write Coverage Gap Audit V1`.
