# DataHealth Dismiss Manual App Acceptance

## Scope / Non-goals

- [ ] This is dev-only manual App acceptance for the DataHealth dismiss mutation prototype.
- [ ] This is not production readiness.
- [ ] This is not broad mutation integration.
- [ ] This is not source-of-truth migration.
- [ ] This does not approve any session, history, DataHealth repair, backup, import, export, reset, or recovery mutation from browser code.
- [ ] `localStorage` remains source of truth.
- [ ] API result never overwrites AppData or localStorage.
- [ ] No production backend, auth, sync, or deployment is validated here.
- [ ] No normalized tables, package dependency, package script, or lockfile change is validated here.
- [ ] Use a dedicated test browser profile only.

Failure criteria:

- [ ] Fail this acceptance if any browser mutation route other than `POST /data-health/issues/:issueId/dismiss` appears.
- [ ] Fail this acceptance if the App writes API results into localStorage or replaces AppData from the API response.
- [ ] Fail this acceptance if the run is treated as production readiness.

## Safety Before Testing

- [ ] Do not use real personal training data.
- [ ] Do not use the daily browser profile.
- [ ] Do not clear the daily browser profile.
- [ ] Use a dedicated test browser profile.
- [ ] Use a dedicated dev DB file such as `.ironpath/manual-datahealth-dismiss-acceptance.sqlite`.
- [ ] Do not commit `.sqlite`, `.sqlite-wal`, `.sqlite-shm`, or `.sqlite-journal` files.
- [ ] Do not treat this as production backend validation.

## Prerequisites

- [ ] Work from `C:\Users\xuhao\PycharmProjects\fitness-app`.
- [ ] Confirm `git status` is clean before starting manual acceptance.
- [ ] Confirm Task 4.29 is merged into `main`.
- [ ] Run `npm run api:dev:build`.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Confirm the Dev API runner is available.
- [ ] Confirm the App dev server is available.
- [ ] Prepare a dedicated browser profile.

## Start Dev API Runner

- [ ] Start the Dev API runner with a dedicated manual acceptance DB:

```powershell
npm run api:dev -- --port 8787 --seed-empty --db .ironpath/manual-datahealth-dismiss-acceptance.sqlite
```

Expected results:

- [ ] stdout includes `IronPath dev API ready: <url>`.
- [ ] URL is localhost or `127.0.0.1`.
- [ ] No raw stack is printed.
- [ ] `seedEmpty` creates `dev-launcher:seed-empty` only if no latest snapshot exists.

Failure criteria:

- [ ] Fail if the ready URL is non-localhost.
- [ ] Fail if raw stack text is shown to the manual tester.

## Start App With Required Flags

- [ ] PowerShell setup:

```powershell
$env:VITE_IRONPATH_DEV_API_COMPARE="1"
$env:VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT="datahealth-dismiss"
$env:VITE_IRONPATH_DEV_API_BASE_URL="http://127.0.0.1:8787"
npm run dev
```

- [ ] macOS/Linux setup:

```bash
VITE_IRONPATH_DEV_API_COMPARE=1 VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT=datahealth-dismiss VITE_IRONPATH_DEV_API_BASE_URL=http://127.0.0.1:8787 npm run dev
```

Expected results:

- [ ] App opens normally in the dedicated test browser profile.
- [ ] Read-only diagnostics may appear.
- [ ] DataHealth dismiss mutation prototype appears only when all required flags are enabled.
- [ ] UI clearly says this is a dev-only mutation experiment.
- [ ] UI clearly says `localStorage remains source of truth`.

Failure criteria:

- [ ] Fail if the mutation prototype appears without all required flags.
- [ ] Fail if App startup depends on production backend, auth, sync, or deployment.

## Flag Matrix Manual Checks

- [ ] Compare flag off: no mutation prototype.
- [ ] Mutation flag off: no mutation prototype.
- [ ] Compare flag on only: read-only diagnostics may show, mutation prototype absent.
- [ ] Mutation flag on only: mutation prototype absent.
- [ ] Production-like build: mutation prototype disabled.
- [ ] All required flags enabled: prototype may appear.

Expected results:

- [ ] No POST unless all flags are enabled and user confirms.

Failure criteria:

- [ ] Fail if compare flag alone enables mutation.
- [ ] Fail if mutation experiment flag alone enables mutation.
- [ ] Fail if a production-like build enables mutation.

## Confirmation Manual Check

- [ ] Confirm the prototype is visible.
- [ ] Leave the confirmation checkbox unchecked.
- [ ] Try to dismiss the selected issue.
- [ ] Uncheck the confirmation box after checking it to simulate cancel.
- [ ] Check the confirmation box again only when ready for the confirmed dismiss path.

Expected results:

- [ ] No POST before explicit confirmation.
- [ ] Cancel prevents POST.
- [ ] Confirmed dismiss is required before POST.
- [ ] Confirmation copy is clear and dev-only.

Failure criteria:

- [ ] Fail if any POST is sent before explicit confirmation.

## Pending / Duplicate-submit Manual Check

- [ ] Check the confirmation checkbox.
- [ ] Submit once.
- [ ] Click repeatedly while pending.

Expected results:

- [ ] Submit becomes pending.
- [ ] Repeated click while pending does not send duplicate POST.
- [ ] Pending state is visible.
- [ ] No optimistic success appears before response.
- [ ] No localStorage write occurs during pending.

Failure criteria:

- [ ] Fail if repeated clicks produce duplicate POST requests.
- [ ] Fail if success appears before a response.

## Successful Dismiss Manual Check

- [ ] Use browser DevTools Network.
- [ ] Select a DataHealth issue.
- [ ] Confirm and submit the dismiss request.

Expected results:

- [ ] Browser Network shows exactly `POST /data-health/issues/:issueId/dismiss`.
- [ ] No session, history, repair, backup, import, export, reset, or recovery POSTs appear.
- [ ] Success appears only after HTTP 2xx, result success, `changed=true`, `status=success`, and snapshot metadata.
- [ ] UI does not overwrite localStorage.
- [ ] AppData is not replaced by API result.
- [ ] Success state does not claim production sync.

Failure criteria:

- [ ] Fail if success appears without snapshot metadata.
- [ ] Fail if no fake success behavior is violated.
- [ ] Fail if success claims production sync or remote source-of-truth migration.

## Failure Manual Checks

- [ ] Stop the Dev API runner, then attempt a confirmed dismiss.
- [ ] Use an issue-not-found case if safely reproducible in the test profile.
- [ ] Use malformed or invalid response only if a test harness allows it; otherwise rely on automated tests.

Expected results:

- [ ] API unavailable shows failure.
- [ ] Timeout, unavailable, or error does not show success.
- [ ] `issue_not_found` or `no_change` does not show success.
- [ ] Write failure must not show success.
- [ ] No raw stack is shown.
- [ ] No auto-retry occurs.
- [ ] No localStorage write occurs.

Failure criteria:

- [ ] Fail if unavailable, timeout, no-change, not-found, write failure, or missing snapshot metadata shows success.

## LocalStorage Integrity Manual Check

- [ ] Snapshot localStorage in the dedicated test browser profile before testing.
- [ ] Run flag matrix checks.
- [ ] Run pending checks.
- [ ] Run success checks.
- [ ] Run failure checks.
- [ ] Snapshot localStorage after each check.

Expected results:

- [ ] API response snapshot metadata is not stored in localStorage.
- [ ] API result does not overwrite AppData or localStorage.
- [ ] localStorage remains the only active App source of truth.

Failure criteria:

- [ ] Fail if API response data is merged into AppData.
- [ ] Fail if snapshot metadata appears in localStorage due to the prototype.

## Network Route Boundary Manual Check

- [ ] Open browser DevTools Network.
- [ ] Verify allowed GET routes:
  - [ ] `GET /health`
  - [ ] `GET /app-data/summary`
  - [ ] `GET /sessions/summary`
  - [ ] `GET /history`
  - [ ] `GET /history/:id` if stable id exists
  - [ ] `GET /data-health/summary`
- [ ] Verify allowed POST route only after confirmation:
  - [ ] `POST /data-health/issues/:issueId/dismiss`

Forbidden routes:

- [ ] No `POST /sessions/start`.
- [ ] No `POST /sessions/active/patches`.
- [ ] No `POST /sessions/active/complete`.
- [ ] No `POST /sessions/active/discard`.
- [ ] No `POST /history/:id/edit`.
- [ ] No `POST /history/:id/data-flag`.
- [ ] No `POST /data-health/repair/apply`.
- [ ] No backup/import/export HTTP routes.
- [ ] No reset/recovery HTTP routes.

Failure criteria:

- [ ] Fail if any forbidden route appears in browser Network.

## Forbidden UI Controls Manual Check

- [ ] Confirm there are no controls or action labels for `repair`.
- [ ] Confirm there are no controls or action labels for `sync`.
- [ ] Confirm there are no controls or action labels for `overwrite`.
- [ ] Confirm there are no controls or action labels for `import`.
- [ ] Confirm there are no controls or action labels for `export`.
- [ ] Confirm there are no controls or action labels for `reset`.
- [ ] Confirm there are no controls or action labels for `apply`.
- [ ] Confirm there are no controls or action labels for `fix`.
- [ ] Confirm there are no controls or action labels for `migrate`.

Failure criteria:

- [ ] Fail if the prototype offers any repair, sync, overwrite, import, export, reset, apply, fix, or migrate action.

## Cleanup

- [ ] Stop the App dev server with `Ctrl+C`.
- [ ] Stop the Dev API runner with `Ctrl+C`.
- [ ] Clear PowerShell env vars:

```powershell
Remove-Item Env:VITE_IRONPATH_DEV_API_COMPARE -ErrorAction SilentlyContinue
Remove-Item Env:VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT -ErrorAction SilentlyContinue
Remove-Item Env:VITE_IRONPATH_DEV_API_BASE_URL -ErrorAction SilentlyContinue
```

- [ ] Clear macOS/Linux env vars:

```bash
unset VITE_IRONPATH_DEV_API_COMPARE
unset VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT
unset VITE_IRONPATH_DEV_API_BASE_URL
```

- [ ] Remove test dev DB artifacts if needed:
  - [ ] `.ironpath/manual-datahealth-dismiss-acceptance.sqlite`
  - [ ] `.ironpath/manual-datahealth-dismiss-acceptance.sqlite-wal`
  - [ ] `.ironpath/manual-datahealth-dismiss-acceptance.sqlite-shm`
  - [ ] `.ironpath/manual-datahealth-dismiss-acceptance.sqlite-journal`
- [ ] Do not delete `.ironpath/dev-api-runner`.
- [ ] Run `git status`.
- [ ] Do not commit dev DB artifacts.

Failure criteria:

- [ ] Fail cleanup if test DB artifacts are staged or committed.

## Browser Build Safety

- [ ] Run `npm run build`.
- [ ] Scan `dist/` only for:
  - [ ] `node:http`
  - [ ] `node:sqlite`
  - [ ] `devLauncher`
  - [ ] `httpRuntimeAdapter`
  - [ ] `serverAdapter`
  - [ ] `sqliteRepository`
  - [ ] `devApiRunner`
  - [ ] `devDbRecovery`

Expected results:

- [ ] Build passes.
- [ ] `dist/` scan finds no listed Node-only token.

Failure criteria:

- [ ] Fail if browser build output contains listed Node-only stack tokens.

## Manual Pass / Fail Template

- [ ] Date:
- [ ] Branch:
- [ ] Commit:
- [ ] Node version:
- [ ] Dev API command:
- [ ] Dev API URL:
- [ ] App dev command:
- [ ] Browser/profile used:
- [ ] Flags used:
- [ ] Flag matrix result:
- [ ] Confirmation result:
- [ ] Duplicate-submit result:
- [ ] Success result:
- [ ] Failure result:
- [ ] LocalStorage integrity result:
- [ ] Network route boundary result:
- [ ] Forbidden controls result:
- [ ] Cleanup result:
- [ ] Browser build result:
- [ ] Notes:
- [ ] Pass / Fail:
