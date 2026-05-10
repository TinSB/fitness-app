# Write-path Two-route Manual Regression

This runbook validates both existing dev-only browser mutation prototypes together in one local App and Dev API session.

## Scope / Non-goals

- [ ] This is dev-only two-route manual regression.
- [ ] This is not production readiness.
- [ ] This is not broad mutation integration.
- [ ] This is not source-of-truth migration.
- [ ] This does not approve a third mutation.
- [ ] This does not approve session, history edit, repair, backup, reset, or recovery mutation.
- [ ] localStorage remains source of truth.
- [ ] API result never overwrites AppData or localStorage.
- [ ] No auth, sync, or deployment is added.
- [ ] No normalized tables are added.
- [ ] No package dependency or package script is added.
- [ ] Use dedicated test browser profile only.
- [ ] Browser mutation routes remain exactly:
  - [ ] `POST /data-health/issues/:issueId/dismiss`
  - [ ] `POST /history/:id/data-flag`

Failure criteria:

- [ ] Fail if the regression requires runtime source changes.
- [ ] Fail if a third mutation route appears.
- [ ] Fail if source-of-truth behavior changes.
- [ ] Fail if production readiness is implied.

## Safety Before Testing

- [ ] Do not use real personal training data.
- [ ] Do not use or clear the daily browser profile.
- [ ] Use a dedicated test browser profile.
- [ ] Use a dedicated dev DB file, for example `.ironpath/manual-two-route-regression.sqlite`.
- [ ] Do not commit `.sqlite`, `.sqlite-wal`, `.sqlite-shm`, or `.sqlite-journal` files.
- [ ] Do not treat this as production backend validation.
- [ ] Keep daily localStorage separate from all manual regression checks.

## Prerequisites

- [ ] Confirm the git worktree is clean.
- [ ] Run `npm run api:dev:build`.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Confirm Task 4.40 is merged into `main`.
- [ ] Confirm the Dev API runner is available.
- [ ] Confirm the App dev server is available.
- [ ] Confirm the dedicated browser profile is ready.
- [ ] Confirm the DataHealth dismiss manual runbook exists at `docs/DATAHEALTH_DISMISS_MANUAL_APP_ACCEPTANCE.md`.
- [ ] Confirm the History data-flag manual runbook exists at `docs/HISTORY_DATA_FLAG_MANUAL_APP_ACCEPTANCE.md`.

## Start Dev API Runner

- [ ] Start the Dev API runner:

```powershell
npm run api:dev -- --port 8787 --seed-empty --db .ironpath/manual-two-route-regression.sqlite
```

Acceptance:

- [ ] stdout includes `IronPath dev API ready: <url>`.
- [ ] URL is localhost or `127.0.0.1`.
- [ ] No raw stack is printed.
- [ ] `seedEmpty` creates `dev-launcher:seed-empty` only if no latest snapshot exists.

Failure criteria:

- [ ] Fail if the ready URL is non-localhost.
- [ ] Fail if raw stack text is printed.
- [ ] Fail if the runner requires production backend configuration.

## Prepare Test Data

- [ ] `seedEmpty` may be enough for read-only diagnostics, but may not contain meaningful DataHealth issues or history records.
- [ ] DataHealth dismiss requires a visible DataHealth issue.
- [ ] History data-flag requires an existing stable history record.
- [ ] Use a dedicated test profile and dedicated test state.
- [ ] Do not use real personal training data.
- [ ] Do not modify production or daily localStorage.

Acceptance:

- [ ] There is a visible DataHealth issue or known safe issue fixture/state if testing dismiss success.
- [ ] There is a visible stable history record for testing dataFlag success.
- [ ] The Dev API snapshot corresponds to the test state if testing success.
- [ ] If success-state data is not available, failure/no-fake-success scenarios can still be manually verified.

## Start App With Read-only Compare Flag

- [ ] PowerShell:

```powershell
$env:VITE_IRONPATH_DEV_API_COMPARE="1"
$env:VITE_IRONPATH_DEV_API_BASE_URL="http://127.0.0.1:8787"
npm run dev
```

- [ ] macOS/Linux:

```bash
VITE_IRONPATH_DEV_API_COMPARE=1 VITE_IRONPATH_DEV_API_BASE_URL=http://127.0.0.1:8787 npm run dev
```

Acceptance:

- [ ] App opens normally.
- [ ] Read-only diagnostics may appear.
- [ ] No mutation prototype appears unless a mutation experiment flag is set.
- [ ] localStorage remains source of truth.
- [ ] API result never overwrites AppData or localStorage.

## DataHealth Dismiss Flag Regression

- [ ] PowerShell:

```powershell
$env:VITE_IRONPATH_DEV_API_COMPARE="1"
$env:VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT="datahealth-dismiss"
$env:VITE_IRONPATH_DEV_API_BASE_URL="http://127.0.0.1:8787"
npm run dev
```

- [ ] macOS/Linux:

```bash
VITE_IRONPATH_DEV_API_COMPARE=1 VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT=datahealth-dismiss VITE_IRONPATH_DEV_API_BASE_URL=http://127.0.0.1:8787 npm run dev
```

Acceptance:

- [ ] DataHealth dismiss prototype may appear.
- [ ] History data-flag prototype must not appear solely because `datahealth-dismiss` flag is enabled.
- [ ] No POST occurs before confirmation.
- [ ] Confirmed dismiss may send exactly `POST /data-health/issues/:issueId/dismiss`.
- [ ] No `POST /history/:id/data-flag` occurs in this flow.
- [ ] No session, history edit, repair, backup, or reset routes occur.
- [ ] localStorage remains source of truth.
- [ ] no fake success.

## History Data-flag Flag Regression

- [ ] PowerShell:

```powershell
$env:VITE_IRONPATH_DEV_API_COMPARE="1"
$env:VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT="history-data-flag"
$env:VITE_IRONPATH_DEV_API_BASE_URL="http://127.0.0.1:8787"
npm run dev
```

- [ ] macOS/Linux:

```bash
VITE_IRONPATH_DEV_API_COMPARE=1 VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT=history-data-flag VITE_IRONPATH_DEV_API_BASE_URL=http://127.0.0.1:8787 npm run dev
```

Acceptance:

- [ ] History data-flag prototype may appear when a stable target record exists.
- [ ] DataHealth dismiss prototype must not appear solely because `history-data-flag` flag is enabled.
- [ ] No POST occurs before confirmation.
- [ ] Confirmed dataFlag change may send exactly `POST /history/:id/data-flag`.
- [ ] No `POST /data-health/issues/:issueId/dismiss` occurs in this flow unless its own flag is explicitly used in a separate flow.
- [ ] No session, history edit, repair, backup, or reset routes occur.
- [ ] localStorage remains source of truth.
- [ ] no fake success.

## Mutation Experiment Isolation Matrix

- [ ] No mutation flag: no mutation prototype appears.
- [ ] `datahealth-dismiss` flag: only DataHealth dismiss prototype appears.
- [ ] `history-data-flag` flag: only History data-flag prototype appears.
- [ ] Invalid mutation flag: no mutation prototype appears or safe misconfiguration is shown.
- [ ] Production-like build: no mutation prototype appears.
- [ ] Read-only compare flag alone: read-only diagnostics only.

Acceptance:

- [ ] DataHealth dismiss flag enables only its own prototype.
- [ ] History data-flag flag enables only its own prototype.
- [ ] No flag combination enables a third mutation route.

## DevTools Network Route Boundary

Allowed GET:

- [ ] `GET /health`
- [ ] `GET /app-data/summary`
- [ ] `GET /sessions/summary`
- [ ] `GET /history`
- [ ] `GET /history/:id` if stable id exists
- [ ] `GET /data-health/summary`

Allowed POST:

- [ ] `POST /data-health/issues/:issueId/dismiss` only in DataHealth dismiss flow after confirmation.
- [ ] `POST /history/:id/data-flag` only in History data-flag flow after confirmation.

Forbidden:

- [ ] `POST /sessions/start`
- [ ] `POST /sessions/active/patches`
- [ ] `POST /sessions/active/complete`
- [ ] `POST /sessions/active/discard`
- [ ] `POST /history/:id/edit`
- [ ] `POST /data-health/repair/apply`
- [ ] backup/import/export/reset/recovery HTTP routes

## No-fake-success Regression

For both mutation prototypes, verify:

- [ ] No POST before confirmation.
- [ ] No optimistic success during pending.
- [ ] Success requires snapshot metadata.
- [ ] Unavailable, timeout, or error does not show success.
- [ ] no_change or not_found does not show success.
- [ ] Missing snapshot metadata does not show success.
- [ ] No raw stack is displayed.
- [ ] No auto-retry occurs.

Failure criteria:

- [ ] Fail if either prototype shows success without HTTP success, mutation success, changed state, and snapshot metadata.
- [ ] Fail if either prototype writes localStorage or mutates AppData.

## LocalStorage Integrity Regression

- [ ] Snapshot localStorage before tests.
- [ ] Run read-only compare.
- [ ] Run DataHealth dismiss flow.
- [ ] Run History data-flag flow.
- [ ] Run success and failure scenarios if possible.
- [ ] Compare localStorage after tests.

Acceptance:

- [ ] API response snapshot metadata is not stored in localStorage.
- [ ] API result does not overwrite AppData or localStorage.
- [ ] localStorage remains the only active App source of truth.

## Forbidden UI Controls Regression

- [ ] Confirm no controls or labels named `repair`.
- [ ] Confirm no controls or labels named `sync`.
- [ ] Confirm no controls or labels named `overwrite`.
- [ ] Confirm no controls or labels named `import`.
- [ ] Confirm no controls or labels named `export`.
- [ ] Confirm no controls or labels named `reset`.
- [ ] Confirm no controls or labels named `apply`.
- [ ] Confirm no controls or labels named `fix`.
- [ ] Confirm no controls or labels named `migrate`.

## Failure Scenario Regression

- [ ] Stop Dev API runner and retry the DataHealth dismiss flow.
- [ ] Stop Dev API runner and retry the History data-flag flow.
- [ ] Verify failure/unavailable state.
- [ ] Verify App remains usable.
- [ ] Verify no localStorage writes.
- [ ] Verify no fake success.
- [ ] Restart runner and verify App can recover after refresh/retry.

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
  - [ ] `.ironpath/manual-two-route-regression.sqlite`
  - [ ] `.ironpath/manual-two-route-regression.sqlite-wal`
  - [ ] `.ironpath/manual-two-route-regression.sqlite-shm`
  - [ ] `.ironpath/manual-two-route-regression.sqlite-journal`
- [ ] Do not delete `.ironpath/dev-api-runner`.
- [ ] Check `git status`.
- [ ] Do not commit dev DB artifacts.

## Browser Build Safety

Acceptance:

- [ ] `npm run build` passes.
- [ ] `dist/` scan finds no:
  - [ ] `node:http`
  - [ ] `node:sqlite`
  - [ ] `devLauncher`
  - [ ] `httpRuntimeAdapter`
  - [ ] `serverAdapter`
  - [ ] `sqliteRepository`
  - [ ] `devApiRunner`
  - [ ] `devDbRecovery`

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
- [ ] DataHealth dismiss flow result:
- [ ] History data-flag flow result:
- [ ] Mutation experiment isolation result:
- [ ] Network route boundary result:
- [ ] No-fake-success result:
- [ ] LocalStorage integrity result:
- [ ] Failure scenario result:
- [ ] Forbidden controls result:
- [ ] Cleanup result:
- [ ] Browser build result:
- [ ] Notes:
- [ ] Pass / Fail:

## Task 4.42 Regression Lock Follow-up

- [ ] Task 4.42 adds `docs/WRITE_PATH_TWO_ROUTE_REGRESSION_LOCK.md` as the two-route regression lock.
- [ ] Browser mutation routes remain exactly `POST /data-health/issues/:issueId/dismiss` and `POST /history/:id/data-flag`.
- [ ] No third mutation route is approved.
- [ ] localStorage remains source of truth.
- [ ] API result never overwrites AppData or localStorage.
- [ ] This follow-up does not imply production readiness or source-of-truth migration.
