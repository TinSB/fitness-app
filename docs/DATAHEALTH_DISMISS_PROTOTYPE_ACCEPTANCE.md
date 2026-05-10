# DataHealth Dismiss Prototype Acceptance

## Scope / Non-goals

- [ ] This is dev-only manual acceptance for Task 4.28 DataHealth dismiss mutation prototype.
- [ ] This is not production readiness.
- [ ] This is not full mutation integration.
- [ ] This is not App runtime migration or write-path migration.
- [ ] This does not replace localStorage; App runtime still uses localStorage as source of truth.
- [ ] This does not enable session, history, DataHealth repair, backup, import, export, reset, or recovery routes from the browser.
- [ ] This does not add production backend, auth, sync, deployment, package dependencies, package scripts, lockfile changes, or normalized tables.

## Safety Before Testing

- [ ] Use a dedicated test browser profile.
- [ ] Do not use real personal training data.
- [ ] Do not clear the real daily-use browser profile.
- [ ] Do not clear real browser localStorage.
- [ ] If localStorage must be cleared, do it only inside the dedicated test browser profile.
- [ ] Do not commit `.sqlite`, `.sqlite-wal`, `.sqlite-shm`, or manual acceptance database artifacts.

## Prerequisites

- [ ] Work from `C:\Users\xuhao\PycharmProjects\fitness-app`.
- [ ] Confirm Task 4.28 is present in the branch under test.
- [ ] Run `npm run api:dev:build`.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Use a localhost Dev API URL such as `http://127.0.0.1:8787`.

## Start Dev API Runner

- [ ] Start with an empty dev database:

```powershell
npm run api:dev -- --seed-empty
```

- [ ] Optional explicit port and database:

```powershell
npm run api:dev -- --port 8787 --seed-empty --db .ironpath/datahealth-dismiss-acceptance.sqlite
```

- [ ] Expected stdout includes `IronPath dev API ready: <url>`.
- [ ] Expected URL is localhost or `127.0.0.1`.
- [ ] Expected dev runner does not expose raw stack text.

## Start App With Read-only Compare + Mutation Experiment Flags

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

- [ ] Expected App opens normally in the dedicated test browser profile.
- [ ] Expected read-only diagnostics may appear.
- [ ] Expected DataHealth dismiss experiment appears only with all required flags.

## Confirm Prototype Appears Only With Required Flags

- [ ] With compare flag off, expected no DataHealth dismiss experiment UI and no POST.
- [ ] With mutation experiment flag off, expected no DataHealth dismiss experiment UI and no POST.
- [ ] With production-like build/env, expected no DataHealth dismiss experiment UI and no POST.
- [ ] With read-only compare flag only, expected read-only diagnostics may appear but mutation prototype does not appear.
- [ ] With mutation experiment flag only, expected mutation prototype does not appear.
- [ ] With all required dev flags, expected the prototype may appear.

## Confirm No Mutation Without Confirmation

- [ ] Confirm the panel says `Dev API DataHealth dismiss experiment`.
- [ ] Confirm the panel says `localStorage remains source of truth`.
- [ ] Leave the confirmation checkbox unchecked.
- [ ] Expected submit control is disabled.
- [ ] Expected no POST request is sent.
- [ ] Uncheck the confirmation box after checking it.
- [ ] Expected this cancel state prevents POST.

## Confirm Successful Dismiss

- [ ] Use only test data in the dedicated profile.
- [ ] Select a DataHealth issue.
- [ ] Check the confirmation checkbox.
- [ ] Submit the dismiss request.
- [ ] Expected browser Network shows exactly `POST /data-health/issues/:issueId/dismiss`.
- [ ] Expected success appears only after HTTP success, mutation success, `changed=true`, `status=success`, and snapshot metadata.
- [ ] Expected text says no data was changed locally.
- [ ] Expected localStorage remains source of truth.
- [ ] Expected API results do not overwrite AppData or localStorage.

## Confirm Duplicate-submit Prevention

- [ ] Check the confirmation checkbox.
- [ ] Submit once and repeatedly click while pending.
- [ ] Expected pending state is visible.
- [ ] Expected submit is disabled while pending.
- [ ] Expected only one POST request is sent.
- [ ] Expected no optimistic success appears while pending.
- [ ] Expected localStorage is not written while pending.

## Confirm API Unavailable Failure

- [ ] Stop the Dev API runner.
- [ ] Keep App running with flags enabled.
- [ ] Attempt a confirmed dismiss.
- [ ] Expected visible failure or diagnostic error.
- [ ] Expected no success state.
- [ ] Expected no automatic retry.
- [ ] Expected App continues using localStorage.
- [ ] Expected localStorage is not written.

## Confirm Issue-not-found / No-change Failure

- [ ] Use a stale issue or a test setup where the issue no longer exists.
- [ ] Attempt a confirmed dismiss.
- [ ] Expected `issue_not_found`, `no_change`, or equivalent safe failure text.
- [ ] Expected no success state.
- [ ] Expected no localStorage write.
- [ ] Expected no AppData mutation.

## Confirm Write Failure / No-fake-success Behavior

- [ ] Use a test setup that returns `write_failed`, `transaction_failed`, or `database_closed`.
- [ ] Expected visible failure.
- [ ] Expected no success state.
- [ ] Expected no fake success when snapshot metadata is missing.
- [ ] Expected no localStorage write.
- [ ] Expected no AppData mutation.

## Confirm LocalStorage Integrity

- [ ] Snapshot localStorage in the dedicated test browser profile before the attempt.
- [ ] Run disabled flag, pending, success, and failure checks.
- [ ] Snapshot localStorage after each check.
- [ ] Expected localStorage is unchanged by the prototype.
- [ ] Expected snapshot metadata is not stored in localStorage.
- [ ] Expected API response data is not merged into AppData.

## Confirm Browser Network Only Shows Allowed POST Route

- [ ] Open browser DevTools Network.
- [ ] Filter by `POST`.
- [ ] Expected allowed browser mutation route:
  - [ ] `POST /data-health/issues/:issueId/dismiss`
- [ ] Expected no other POST routes from the App.

## Confirm No Session / History / Repair / Backup / Reset Routes

- [ ] Confirm Network does not show `POST /sessions/start`.
- [ ] Confirm Network does not show `POST /sessions/active/patches`.
- [ ] Confirm Network does not show `POST /sessions/active/complete`.
- [ ] Confirm Network does not show `POST /sessions/active/discard`.
- [ ] Confirm Network does not show `POST /history/:id/edit`.
- [ ] Confirm Network does not show `POST /history/:id/data-flag`.
- [ ] Confirm Network does not show `POST /data-health/repair/apply`.
- [ ] Confirm Network does not show backup/import/export HTTP routes.
- [ ] Confirm Network does not show reset/recovery HTTP routes.

## Browser Build Isolation Check

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
- [ ] Expected no matches in build output.

## Shutdown / Cleanup

- [ ] Stop the App dev server with `Ctrl+C`.
- [ ] Stop the Dev API runner with `Ctrl+C`.
- [ ] Clear PowerShell env vars:

```powershell
Remove-Item Env:VITE_IRONPATH_DEV_API_COMPARE
Remove-Item Env:VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT
Remove-Item Env:VITE_IRONPATH_DEV_API_BASE_URL
```

- [ ] Clear macOS/Linux env vars if they were exported:

```bash
unset VITE_IRONPATH_DEV_API_COMPARE
unset VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT
unset VITE_IRONPATH_DEV_API_BASE_URL
```

- [ ] Remove temporary dev DB artifacts if created.
- [ ] Confirm `git status` does not include `.sqlite`, `.sqlite-wal`, or `.sqlite-shm` artifacts.

## Manual Pass / Fail Template

- [ ] Date:
- [ ] Branch:
- [ ] Commit:
- [ ] Node version:
- [ ] Dev API command:
- [ ] Dev API URL:
- [ ] App dev command:
- [ ] Browser/profile used:
- [ ] Flag matrix result:
- [ ] Confirmation result:
- [ ] Pending/duplicate-submit result:
- [ ] Success/no-fake-success result:
- [ ] API unavailable result:
- [ ] Issue-not-found/no-change result:
- [ ] Write failure result:
- [ ] LocalStorage integrity result:
- [ ] Network route boundary result:
- [ ] Browser build isolation result:
- [ ] Notes:
- [ ] Pass / Fail:
