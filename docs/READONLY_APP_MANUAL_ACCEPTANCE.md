# Read-only App Manual Acceptance

This runbook manually accepts the dev-only read-only App diagnostics prototype from Tasks 4.20-4.22.

Task 4.24 mutation readiness audit confirms that this read-only manual acceptance does not authorize mutation integration. Existing mutation routes remain server/dev API only, App runtime does not call them, and write-path migration remains blocked.

## Scope / Non-goals

- [ ] Confirm this is dev-only read-only App manual acceptance.
- [ ] Confirm this is not production readiness.
- [ ] Confirm there is no production backend.
- [ ] Confirm this is not App runtime migration.
- [ ] Confirm this is not write-path migration.
- [ ] Confirm this does not replace localStorage.
- [ ] Confirm there is no auth, sync, or deployment.
- [ ] Confirm there is no backup import/export over HTTP.
- [ ] Confirm there is no reset/recovery over HTTP.
- [ ] Confirm there is no mutation integration.
- [ ] Confirm App runtime still uses localStorage.
- [ ] Confirm localStorage remains source of truth.
- [ ] Confirm no UI writes to API.
- [ ] Confirm no mutation routes are called from App.
- [ ] Confirm diagnostics exposes no repair/sync/overwrite/import/export/reset/apply/fix controls.

## Safety Before Testing

- [ ] Use a dedicated test browser profile.
- [ ] Do not use or clear the real daily-use browser profile.
- [ ] Do not use real personal training data for mismatch or unavailable testing.
- [ ] If localStorage must be cleared, clear it only in the dedicated test browser profile.
- [ ] Treat `.ironpath/dev-api.sqlite` and other `.sqlite` files as dev DB files that may contain training data.
- [ ] Do not commit `.sqlite`, `.sqlite-wal`, `.sqlite-shm`, or manual acceptance DB artifacts.
- [ ] Use `docs/DEV_API_RECOVERY_RESET.md` if a dev DB needs backup or reset.

## Prerequisites

- [ ] Work from project path: `C:\Users\xuhao\PycharmProjects\fitness-app`.
- [ ] Record the Node version with `node --version`.
- [ ] Confirm the git worktree is clean before manual acceptance.
- [ ] Confirm Task 4.22 has been merged to main or this branch contains it.
- [ ] Confirm the Dev API runner is available.
- [ ] Confirm the browser dev server is available.
- [ ] Run `npm run api:dev:build`.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm test`.
- [ ] Run `npm run build`.

## Start Dev API Runner

Command:

```powershell
npm run api:dev -- --seed-empty --db .ironpath/manual-readonly-acceptance.sqlite
```

Fixed port example:

```powershell
npm run api:dev -- --port 8787 --seed-empty --db .ironpath/manual-readonly-acceptance.sqlite
```

Acceptance:

- [ ] stdout includes `IronPath dev API ready: <url>`.
- [ ] The ready URL uses localhost or `127.0.0.1`.
- [ ] `seedEmpty=true` creates only the `dev-launcher:seed-empty` snapshot when no latest snapshot exists.
- [ ] Runner output does not expose raw stack traces.
- [ ] Fail if the runner binds a non-localhost URL without explicit network opt-in.

## Start App With Flag Off

Start the App normally without setting `VITE_IRONPATH_DEV_API_COMPARE`.

```powershell
npm run dev
```

Acceptance:

- [ ] App opens normally.
- [ ] Diagnostics panel is not visible.
- [ ] Diagnostics are disabled and render no visible panel.
- [ ] DevTools Network shows no Dev API fetch from the App.
- [ ] localStorage behavior matches the normal App behavior.
- [ ] Browser console has no `node:http`, `node:sqlite`, or SQLite runtime error.
- [ ] Fail if diagnostics appears while the flag is off.

## Start App With Read-only Compare Flag On

PowerShell:

```powershell
$env:VITE_IRONPATH_DEV_API_COMPARE="1"
$env:VITE_IRONPATH_DEV_API_BASE_URL="http://127.0.0.1:8787"
npm run dev
```

macOS/Linux:

```bash
VITE_IRONPATH_DEV_API_COMPARE=1 VITE_IRONPATH_DEV_API_BASE_URL=http://127.0.0.1:8787 npm run dev
```

Acceptance:

- [ ] Diagnostics panel appears only in dev mode with the explicit flag enabled.
- [ ] Panel shows read-only diagnostics.
- [ ] Panel does not show repair, sync, overwrite, import, export, reset, apply, or fix controls.
- [ ] App remains normally usable.
- [ ] localStorage remains source of truth.
- [ ] Fail if the panel offers any data-changing action.

## Health / Read-only Route Manual Check

Use browser DevTools Network while the flag is enabled.

Allowed GET routes:

- [ ] `GET /health`
- [ ] `GET /app-data/summary`
- [ ] `GET /sessions/summary`
- [ ] `GET /history`
- [ ] `GET /history/:id` only if a stable local history id exists
- [ ] `GET /data-health/summary`

Forbidden write or mutation routes:

- [ ] Confirm there is no `POST`.
- [ ] Confirm there is no `PUT`, `PATCH`, or `DELETE`.
- [ ] Confirm there is no `/sessions/start`.
- [ ] Confirm there is no `/sessions/active/patches`.
- [ ] Confirm there is no `/sessions/active/complete`.
- [ ] Confirm there is no `/sessions/active/discard`.
- [ ] Confirm there is no `/history/:id/edit`.
- [ ] Confirm there is no `/history/:id/data-flag`.
- [ ] Confirm there is no `/data-health/issues/:issueId/dismiss`.
- [ ] Confirm there is no `/data-health/repair/apply`.
- [ ] Confirm there is no backup/import/reset/recovery HTTP route.
- [ ] Fail if any App request uses a mutation route.

## Matching Scenario

To observe matching, the browser local AppData and Dev API snapshot data must align.

Recommended safe setup:

- [ ] Use a dedicated test browser profile.
- [ ] Use the `seedEmpty=true` Dev API DB from this runbook.
- [ ] In the test profile only, use an empty or initial localStorage state.
- [ ] Do not clear the real daily-use browser profile.
- [ ] Do not use real personal training data.

Acceptance:

- [ ] Diagnostics status is matching.
- [ ] Mismatch count is `0`.
- [ ] localStorage remains source of truth.
- [ ] Panel states `No data was changed`.
- [ ] Fail if API data is copied into localStorage.

## Mismatch Scenario

Mismatch is diagnostics-only. A safe way to observe it is to use a dedicated test browser profile whose localStorage state differs from the `seedEmpty=true` Dev API DB.

Acceptance:

- [ ] Diagnostics status is mismatch.
- [ ] Panel shows mismatch count.
- [ ] Panel shows endpoint summary.
- [ ] Panel states localStorage remains source of truth.
- [ ] Panel states `No data was changed`.
- [ ] Panel does not show repair, sync, overwrite, import, export, reset, apply, or fix controls.
- [ ] localStorage is not overwritten.
- [ ] AppData is not replaced by API results.
- [ ] Fail if mismatch changes data.

## API Unavailable Scenario

Steps:

- [ ] Stop the Dev API runner.
- [ ] Keep the App flag enabled.
- [ ] Refresh the App in the dedicated test browser profile.

Acceptance:

- [ ] App opens normally.
- [ ] Diagnostics status is unavailable or error.
- [ ] Panel says App continues using localStorage.
- [ ] Comparison is skipped or unavailable.
- [ ] Training is not blocked.
- [ ] Panel does not show repair, sync, overwrite, import, export, reset, apply, or fix controls.
- [ ] localStorage is not written by diagnostics.
- [ ] Fail if App usage is blocked by Dev API unavailability.

## Misconfigured Base URL Scenario

PowerShell invalid URL example:

```powershell
$env:VITE_IRONPATH_DEV_API_COMPARE="1"
$env:VITE_IRONPATH_DEV_API_BASE_URL="https://example.com"
npm run dev
```

Acceptance:

- [ ] Diagnostics status is misconfigured.
- [ ] No Dev API fetch occurs.
- [ ] Panel explains localhost-only requirement.
- [ ] Panel does not show raw env values.
- [ ] Panel does not suggest a production URL.
- [ ] App still uses localStorage.
- [ ] Fail if the App fetches the non-localhost URL.

## LocalStorage Integrity Check

Use only the dedicated test browser profile.

- [ ] Capture localStorage before flag-off testing.
- [ ] Confirm flag-off testing does not change localStorage because of diagnostics.
- [ ] Capture localStorage before matching testing.
- [ ] Confirm matching diagnostics do not change localStorage.
- [ ] Capture localStorage before mismatch testing.
- [ ] Confirm mismatch diagnostics do not change localStorage.
- [ ] Capture localStorage before API unavailable testing.
- [ ] Confirm unavailable diagnostics do not change localStorage.
- [ ] Confirm API response snapshot metadata is not written into localStorage.
- [ ] Fail if diagnostics writes localStorage in any state.

## Shutdown / Cleanup

Steps:

- [ ] Stop the App dev server with Ctrl+C.
- [ ] Stop the Dev API runner with Ctrl+C.
- [ ] Clear PowerShell env vars after testing:

```powershell
Remove-Item Env:VITE_IRONPATH_DEV_API_COMPARE
Remove-Item Env:VITE_IRONPATH_DEV_API_BASE_URL
```

- [ ] Clear macOS/Linux env vars after testing:

```bash
unset VITE_IRONPATH_DEV_API_COMPARE
unset VITE_IRONPATH_DEV_API_BASE_URL
```

- [ ] If needed, use `docs/DEV_API_RECOVERY_RESET.md` to clean up the dev DB.

Acceptance:

- [ ] Do not commit `.ironpath/manual-readonly-acceptance.sqlite`.
- [ ] Do not commit `.sqlite-wal` or `.sqlite-shm`.
- [ ] `git status --short` shows no dev DB artifacts.
- [ ] Fail if manual acceptance leaves tracked DB artifacts.

## Browser Build Safety

Commands:

```powershell
npm run build
rg "node:http|node:sqlite|devLauncher|httpRuntimeAdapter|serverAdapter|sqliteRepository|devApiRunner|devDbRecovery" dist
```

Acceptance:

- [ ] `npm run build` passes.
- [ ] For browser bundle proof, scan build output only: `dist/`.
- [ ] Do not scan docs, tests, or source comments for browser bundle pollution proof.
- [ ] The `dist/` scan has no matches for `node:http`.
- [ ] The `dist/` scan has no matches for `node:sqlite`.
- [ ] The `dist/` scan has no matches for `devLauncher`.
- [ ] The `dist/` scan has no matches for `httpRuntimeAdapter`.
- [ ] The `dist/` scan has no matches for `serverAdapter`.
- [ ] The `dist/` scan has no matches for `sqliteRepository`.
- [ ] The `dist/` scan has no matches for `devApiRunner`.
- [ ] The `dist/` scan has no matches for `devDbRecovery`.
- [ ] `rg` may exit with code 1 when there are no matches; that is acceptable for this scan.

## Manual Pass / Fail Template

- [ ] Date:
- [ ] Branch:
- [ ] Commit:
- [ ] Node version:
- [ ] Dev API command:
- [ ] Dev API URL:
- [ ] App dev command:
- [ ] Browser/profile used:
- [ ] Flag off result:
- [ ] Flag on result:
- [ ] Matching result:
- [ ] Mismatch result:
- [ ] API unavailable result:
- [ ] Misconfiguration result:
- [ ] LocalStorage integrity result:
- [ ] Network GET-only result:
- [ ] Browser build result:
- [ ] Notes:
- [ ] Pass / Fail:
