# API Primary Runtime Manual Acceptance

## Scope / Non-goals

- [ ] This is manual App acceptance for explicit dev/local API primary runtime.
- [ ] This is not production readiness.
- [ ] This does not make API primary the default runtime source.
- [ ] This does not replace localStorage.
- [ ] This does not delete localStorage.
- [ ] This does not add a browser mutation route.
- [ ] This does not add DataHealth repair.
- [ ] This does not add backup/import/export over HTTP.
- [ ] This does not add reset/recovery over HTTP.
- [ ] This does not add production backend, auth, sync, cloud, deployment, or monitoring.
- [ ] localStorage remains default and fallback/migration source.
- [ ] API results must not silently overwrite localStorage.
- [ ] Use a dedicated test browser profile only.

## Safety Before Testing

- [ ] Do not use real personal training data.
- [ ] Do not use or clear the daily browser profile.
- [ ] Use a dedicated test browser profile.
- [ ] Use a dedicated dev DB file, for example `.ironpath/manual-api-primary-runtime.sqlite`.
- [ ] Snapshot dedicated-profile localStorage before testing.
- [ ] Do not commit `.sqlite`, `.sqlite-wal`, `.sqlite-shm`, or `.sqlite-journal` files.
- [ ] Do not treat this as production backend validation.

## Prerequisites

- [ ] Clean git worktree.
- [ ] Task 5.28 is merged into `main`.
- [ ] Dev API runner is available.
- [ ] App dev server is available.
- [ ] Dedicated browser profile is ready.
- [ ] Dedicated dev DB path is ready.
- [ ] `npm run api:dev:build` passes.
- [ ] `npm run typecheck` passes.
- [ ] `npm test` passes.
- [ ] `npm run build` passes.
- [ ] `dist/` token scan is clean.

## Start Dev API Runner

PowerShell:

```powershell
npm run api:dev -- --port 8787 --seed-empty --db .ironpath/manual-api-primary-runtime.sqlite
```

Acceptance:

- [ ] stdout includes `IronPath dev API ready: <url>`.
- [ ] URL is `localhost` or `127.0.0.1`.
- [ ] No raw stack trace is printed.
- [ ] The dedicated DB file is under `.ironpath/`.
- [ ] No real personal training data is loaded.

## Start App Dev Server

PowerShell:

```powershell
$env:VITE_IRONPATH_RUNTIME_SOURCE="api-primary-dev"
$env:VITE_IRONPATH_DEV_API_BASE_URL="http://127.0.0.1:8787"
npm run dev
```

macOS/Linux:

```bash
VITE_IRONPATH_RUNTIME_SOURCE=api-primary-dev VITE_IRONPATH_DEV_API_BASE_URL=http://127.0.0.1:8787 npm run dev
```

Acceptance:

- [ ] App opens normally.
- [ ] Runtime source flag is explicit `api-primary-dev`.
- [ ] Dev API base URL is localhost-only.
- [ ] Default unflagged App remains localStorage.
- [ ] No production, auth, sync, cloud, or deployment endpoint is used.

## API Primary Boot Check

- [ ] Confirm boot uses the explicit dev/local API snapshot path only when `api-primary-dev` is selected.
- [ ] Confirm validated AppData-shaped snapshot is required.
- [ ] Confirm snapshot metadata is required.
- [ ] Confirm malformed, unavailable, missing metadata, and schema-invalid boot states fall back visibly to localStorage.
- [ ] Confirm boot does not silently write localStorage.

## API Primary Read Check

- [ ] Confirm allowed reads remain route-specific diagnostics.
- [ ] Confirm `GET /app-data/summary` can be inspected.
- [ ] Confirm unavailable, timeout, malformed response, and server error states are visible failures.
- [ ] Confirm safe snapshot metadata does not overwrite AppData.
- [ ] Confirm safe snapshot metadata does not overwrite localStorage.

## API Primary Write Check

Accepted browser mutation routes:

- [ ] `POST /data-health/issues/:issueId/dismiss`
- [ ] `POST /history/:id/data-flag`
- [ ] `POST /history/:id/edit`
- [ ] `POST /sessions/start`
- [ ] `POST /sessions/active/patches`
- [ ] `POST /sessions/active/complete`
- [ ] `POST /sessions/active/discard`

For each accepted route:

- [ ] Confirm the route only runs under explicit `api-primary-dev`.
- [ ] Confirm pending/confirmation behavior remains visible when relevant.
- [ ] Confirm success requires HTTP success.
- [ ] Confirm success requires `ok=true`.
- [ ] Confirm success requires `changed=true`.
- [ ] Confirm success requires `status="success"`.
- [ ] Confirm success requires snapshot metadata.
- [ ] Confirm no fake success on failed response.
- [ ] Confirm no silent localStorage write.

## API Unavailable Fallback Check

- [ ] Stop the Dev API runner with `Ctrl+C`.
- [ ] Refresh the App or retry API primary actions.
- [ ] Confirm boot fallback is visible.
- [ ] Confirm read failures are visible.
- [ ] Confirm write failures are visible.
- [ ] Confirm no fake success.
- [ ] Confirm no automatic retry loop.
- [ ] Confirm App remains recoverable by restarting the Dev API runner and retrying.
- [ ] Confirm localStorage remains available as fallback.

## LocalStorage Integrity Check

Before testing:

- [ ] Snapshot localStorage from the dedicated test profile.

After boot, read, write, and unavailable scenarios:

- [ ] Compare localStorage with the before snapshot.
- [ ] Confirm API snapshot metadata is not silently stored in localStorage.
- [ ] Confirm API results do not silently overwrite localStorage.
- [ ] Confirm localStorage is not deleted.
- [ ] Confirm localStorage remains available as fallback and migration source.

## Forbidden Network And UI Check

Forbidden routes and controls:

- [ ] `POST /data-health/repair/apply`
- [ ] backup/import/export over HTTP
- [ ] reset/recovery over HTTP
- [ ] any eighth browser mutation route
- [ ] production backend endpoint
- [ ] auth endpoint
- [ ] sync endpoint
- [ ] cloud endpoint
- [ ] deployment endpoint
- [ ] broad mutation client control

Acceptance:

- [ ] DevTools Network shows only accepted API primary routes.
- [ ] No repair, sync, overwrite, import, export, reset, apply, fix, production, auth, cloud, or deployment control appears.

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
  - `.ironpath/manual-api-primary-runtime.sqlite`
  - `.ironpath/manual-api-primary-runtime.sqlite-wal`
  - `.ironpath/manual-api-primary-runtime.sqlite-shm`
  - `.ironpath/manual-api-primary-runtime.sqlite-journal`
- [ ] Do not delete daily localStorage.
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
- [ ] Dedicated dev DB:
- [ ] API primary boot result:
- [ ] API primary read result:
- [ ] DataHealth dismiss result:
- [ ] History dataFlag result:
- [ ] Limited History Edit result:
- [ ] Session Start result:
- [ ] Session Patch result:
- [ ] Session Complete result:
- [ ] Session Discard result:
- [ ] API unavailable fallback result:
- [ ] LocalStorage integrity result:
- [ ] Forbidden network/UI result:
- [ ] Browser build result:
- [ ] Cleanup result:
- [ ] Notes:
- [ ] Pass / Fail:

## Decision

Task 5.29 adds human manual App acceptance for API primary dev runtime only.

It does not approve production readiness, production backend, auth, sync, cloud, deployment, DataHealth repair, backup/import/export over HTTP, reset/recovery over HTTP, an eighth browser mutation route, localStorage deletion, or default API primary runtime.

Next recommended task: `Task 5.30 API Primary Runtime Hardening V1`.

## Final Recommendation

Task 5.29 result: manual App acceptance only.
API primary remains explicit dev/local `api-primary-dev`.
localStorage remains default and fallback/migration source.
No browser mutation route is added.
No production backend, auth, sync, cloud, deployment, package change, normalized table, DataHealth repair, backup/import/export HTTP, reset/recovery HTTP, or eighth route is added.
Next task should be Task 5.30 API Primary Runtime Hardening V1.
