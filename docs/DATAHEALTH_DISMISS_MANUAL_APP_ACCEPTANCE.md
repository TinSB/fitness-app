# DataHealth Dismiss Manual App Acceptance

Task 4.40 adds the write-path two-route checkpoint at `docs/WRITE_PATH_TWO_ROUTE_CHECKPOINT.md`. This runbook remains scoped to the DataHealth dismiss prototype's own one-route flow, while the global browser mutation allowlist is exactly `POST /data-health/issues/:issueId/dismiss` and `POST /history/:id/data-flag`. No third mutation route is approved, localStorage remains source of truth, and API results never overwrite AppData or localStorage.

Task 4.41 adds the two-route manual regression companion at `docs/WRITE_PATH_TWO_ROUTE_MANUAL_REGRESSION.md`. Use that runbook when validating DataHealth dismiss and History data-flag together in one local App/dev API session; this DataHealth runbook remains scoped to the DataHealth dismiss flow.

Task 4.42 adds the two-route regression lock at `docs/WRITE_PATH_TWO_ROUTE_REGRESSION_LOCK.md`. This DataHealth runbook remains scoped to the DataHealth dismiss flow, while the global browser mutation allowlist remains exactly `POST /data-health/issues/:issueId/dismiss` and `POST /history/:id/data-flag`.

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

## Task 4.31 Hardening Manual Checks

- [ ] Confirm `no_change` or already dismissed responses show a failure/diagnostic state, not success.
- [ ] Confirm missing snapshot metadata shows failure and preserves no fake success behavior.
- [ ] Confirm API unavailable, timeout, abort, or navigation-away behavior does not produce success.
- [ ] Confirm duplicate-submit hardening: repeated click or Enter while pending sends only one request.
- [ ] Confirm changing the selected issue requires a fresh confirmation.
- [ ] Confirm retry after failure requires explicit re-confirmation.
- [ ] Confirm successful dismiss may be followed by manual refresh/recheck, but does not overwrite localStorage.
- [ ] Confirm localStorage remains the only active App source of truth.

Failure criteria:

- [ ] Fail if `no_change`, already dismissed, issue-not-found, timeout, abort, unavailable, write failure, or missing snapshot metadata appears as success.
- [ ] Fail if duplicate-submit hardening allows more than one POST for one pending request.
- [ ] Fail if abort or navigation-away produces a later success state.
- [ ] Fail if API response data writes AppData or localStorage.

## Task 4.32 Observability / Recovery Notes

- [ ] Confirm the prototype shows a safe mutation diagnostic summary with:
  - [ ] issue id
  - [ ] mutation state: `idle`, `confirming`, `pending`, `success`, or `failure`
  - [ ] last HTTP status when available
  - [ ] failure code when available
  - [ ] short user-safe failure message
  - [ ] whether snapshot metadata is present
  - [ ] request start and finish time when available
  - [ ] duplicate-submit blocked state when a duplicate pending submit is blocked
- [ ] Confirm diagnostics do not show a raw stack trace.
- [ ] Confirm diagnostics do not dump a raw API response.
- [ ] Confirm diagnostics do not dump full AppData.
- [ ] Confirm diagnostics do not dump localStorage contents.
- [ ] Confirm diagnostics do not show SQLite internal objects.
- [ ] Confirm diagnostics do not show environment objects.
- [ ] Confirm diagnostics do not show any non-localhost URL beyond the configured safe Dev API base URL.

Safe failure reason checklist:

- [ ] `dev_api_unavailable` or `dev_mutation_unavailable`: confirm the Dev API runner is running and the base URL is localhost.
- [ ] `dev_api_timeout` or `dev_mutation_timeout`: confirm the Dev API is responsive before retrying.
- [ ] `dev_api_invalid_response` or `dev_mutation_invalid_response`: inspect Dev API logs and response shape; do not treat as persistence success.
- [ ] `issue_not_found`: refresh read-only diagnostics or verify the issue still exists.
- [ ] `no_change` / already dismissed: refresh read-only diagnostics or verify the issue is still dismissible.
- [ ] `requiresConfirmation`: retry only after explicit confirmation.
- [ ] `write_failed` / `transaction_failed`: stop the runner, back up the dev DB, inspect the dev DB, and use the existing recovery/reset runbook only if needed.
- [ ] `database_closed`: restart the Dev API runner, then rerun read-only diagnostics before retrying.
- [ ] `snapshot_validation_failed` / `repository_schema_mismatch`: stop the runner, back up the dev DB, and inspect schema/recovery notes before retrying.
- [ ] `unsupported_route`: verify the only browser mutation route is `POST /data-health/issues/:issueId/dismiss`.
- [ ] Missing snapshot metadata: treat as failed persistence and do not mark success.
- [ ] Aborted request or component unmount: no success should appear after cancellation.

Recovery guidance:

- [ ] If API is unavailable, confirm the dev runner is running and `VITE_IRONPATH_DEV_API_BASE_URL` is localhost.
- [ ] If `database_closed` appears, restart the Dev API runner.
- [ ] If `write_failed` or `transaction_failed` appears, stop the runner, back up the dev DB, inspect the dev DB, and use the existing recovery/reset runbook only if needed.
- [ ] If `issue_not_found` or `no_change` appears, refresh read-only diagnostics or verify the issue still exists.
- [ ] If snapshot metadata is missing, treat the attempt as failed persistence and do not show success.
- [ ] If diagnostics mismatch after success, remember localStorage remains source of truth and manually rerun comparison.
- [ ] Never use production data for this prototype.
- [ ] Never delete real browser profile localStorage.
- [ ] Never use HTTP reset because no browser HTTP reset endpoint exists.

Developer checklist:

- [ ] Confirm flags are enabled.
- [ ] Confirm only `POST /data-health/issues/:issueId/dismiss` appears.
- [ ] Confirm snapshot metadata exists on success.
- [ ] Confirm no localStorage overwrite.
- [ ] Confirm failure code is visible.
- [ ] Confirm no raw stack is visible.
- [ ] Confirm recovery path is manual and dev-only.
- [ ] Confirm no session, history, DataHealth repair, backup, import, export, reset, or recovery routes appear.

Failure criteria:

- [ ] Fail if observability claims localStorage changed.
- [ ] Fail if recovery guidance offers browser repair, sync, overwrite, import, export, reset, apply, fix, or migration controls.
- [ ] Fail if recovery guidance implies production readiness.

## Task 4.33 Regression Lock Checklist

- [ ] Before testing a second mutation candidate, confirm the Task 4.33 regression lock remains green.
- [ ] Confirm only `POST /data-health/issues/:issueId/dismiss` is accepted from browser code.
- [ ] Confirm no session, history, DataHealth repair, backup, import, export, reset, or recovery mutation route is accepted.
- [ ] Confirm no broad frontend mutation client exists.
- [ ] Confirm success still requires HTTP success, `result.ok=true`, `changed=true`, `status=success`, and snapshot metadata.
- [ ] Confirm missing snapshot metadata remains failure.
- [ ] Confirm `no_change`, `issue_not_found`, `requiresConfirmation`, `unsupported_route`, unavailable, timeout, abort, malformed response, `write_failed`, `transaction_failed`, and `database_closed` do not show success.
- [ ] Confirm duplicate submit still sends only one pending POST.
- [ ] Confirm retry after failure still requires explicit user action and re-confirmation.
- [ ] Confirm no fake success appears.
- [ ] Confirm localStorage remains source of truth.
- [ ] Confirm API results never overwrite AppData or localStorage.
- [ ] Confirm observability remains safe: no raw stack, raw response, AppData dump, localStorage dump, SQLite internals, or env object.
- [ ] Confirm recovery remains manual and dev-only.
- [ ] Confirm docs do not imply production readiness, authorize no second mutation route, and do not authorize a second mutation prototype.

Failure criteria:

- [ ] Fail if any new browser mutation route appears.
- [ ] Fail if any API result is written into AppData or localStorage.
- [ ] Fail if recovery guidance becomes an automatic browser action.

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
