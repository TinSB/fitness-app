# History Data-flag Manual App Acceptance

This is the human-run App acceptance checklist for the existing dev-only History data-flag mutation prototype.

Task 4.40 adds the write-path two-route checkpoint at `docs/WRITE_PATH_TWO_ROUTE_CHECKPOINT.md`. This runbook remains scoped to the History data-flag prototype's own one-route flow, while the global browser mutation allowlist is exactly `POST /data-health/issues/:issueId/dismiss` and `POST /history/:id/data-flag`. No third mutation route is approved, localStorage remains source of truth, and API results never overwrite AppData or localStorage.

## Scope / Non-goals

- [ ] This is dev-only manual App acceptance.
- [ ] This is not production readiness.
- [ ] This is not broad mutation integration.
- [ ] This is not source-of-truth migration.
- [ ] This does not approve session mutation, history edit mutation, DataHealth repair mutation, backup/import/export mutation, reset, or recovery mutation.
- [ ] localStorage remains source of truth.
- [ ] API result never overwrites AppData or localStorage.
- [ ] No auth, sync, or deployment is added.
- [ ] No normalized tables are added.
- [ ] No package dependency or package script is added.
- [ ] Use dedicated test browser profile only.
- [ ] Accepted browser mutation routes remain exactly:
  - [ ] `POST /data-health/issues/:issueId/dismiss`
  - [ ] `POST /history/:id/data-flag`

Expected results:
- [ ] This runbook is used only for manual App acceptance of the existing History data-flag prototype.

Failure criteria:
- [ ] Fail if manual testing requires a runtime source change, a third route, source-of-truth switch, or production backend behavior.

## Task 4.39 Hardening Checks

- [ ] Confirm already-current dataFlag attempts are failures, not successes:
  - [ ] `normal -> normal`
  - [ ] `test -> test`
  - [ ] `excluded -> excluded`
- [ ] Confirm no_change / already-current dataFlag does not write localStorage, mutate AppData, or auto-retry.
- [ ] Confirm `record_not_found` remains a visible failure and does not show success.
- [ ] Confirm invalid dataFlag is not selectable in the UI and invalid dataFlag responses do not show success.
- [ ] Confirm missing snapshot metadata is treated as failed persistence.
- [ ] Confirm API unavailable, timeout, and navigation away / abort do not show success.
- [ ] Confirm duplicate-submit hardening: repeated click or repeated Enter while pending sends at most one request.
- [ ] Confirm confirmation resets after success, after failure, when target dataFlag changes, and when the target record changes.
- [ ] Success requires HTTP 2xx, result.ok === true, result.changed === true, result.status === "success", and snapshot metadata.
- [ ] No-fake-success remains enforced for write_failed, transaction_failed, database_closed, snapshot_validation_failed, repository_schema_mismatch, requiresConfirmation, and unsupported_route.
- [ ] localStorage remains source of truth.
- [ ] API result never overwrites AppData or localStorage.
- [ ] `normal` participates in default statistics.
- [ ] `test` remains visible but excluded from default production-like statistics.
- [ ] `excluded` remains visible but excluded from default production-like statistics.
- [ ] Browser mutation routes remain exactly `POST /data-health/issues/:issueId/dismiss` and `POST /history/:id/data-flag`.

Expected results:
- [ ] Task 4.39 hardening confirms edge failures remain visible and local App data remains untouched.

Failure criteria:
- [ ] Fail if any hardening case shows success without the strict success shape, writes localStorage, mutates AppData, or introduces another browser mutation route.

## Safety Before Testing

- [ ] Do not use real personal training data.
- [ ] Do not use or clear the daily browser profile.
- [ ] Use a dedicated test browser profile.
- [ ] Use a dedicated dev DB file, for example `.ironpath/manual-history-data-flag-acceptance.sqlite`.
- [ ] Do not commit `.sqlite`, `.sqlite-wal`, `.sqlite-shm`, or `.sqlite-journal` files.
- [ ] Do not treat this as production backend validation.
- [ ] Keep the test browser profile separate from daily training data.

Expected results:
- [ ] The test uses disposable browser state and a disposable dev DB file only.

Failure criteria:
- [ ] Fail if real personal training data or a daily browser profile is used.

## Prerequisites

- [ ] Confirm the git worktree is clean.
- [ ] Confirm Task 4.37 is merged into `main`.
- [ ] Confirm the Dev API runner is available.
- [ ] Confirm the App dev server is available.
- [ ] Confirm a dedicated browser profile is ready.
- [ ] Run `npm run api:dev:build`.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm test`.
- [ ] Run `npm run build`.

Expected results:
- [ ] All prerequisite commands pass before manual testing starts.

Failure criteria:
- [ ] Fail if any prerequisite validation fails.

## Start Dev API Runner

- [ ] Start the Dev API runner with the dedicated test DB:

```powershell
npm run api:dev -- --port 8787 --seed-empty --db .ironpath/manual-history-data-flag-acceptance.sqlite
```

- [ ] Confirm stdout includes `IronPath dev API ready: <url>`.
- [ ] Confirm the URL is localhost or `127.0.0.1`.
- [ ] Confirm there is no raw stack trace in stdout.
- [ ] Confirm `seedEmpty` creates `dev-launcher:seed-empty` only if no latest snapshot exists.

Expected results:
- [ ] The Dev API runner is available at `http://127.0.0.1:8787` or another localhost URL.

Failure criteria:
- [ ] Fail if the runner URL is non-localhost, startup emits raw stack text, or the test DB is not dedicated to this run.

## Prepare Test Data

- [ ] Note that `--seed-empty` may not contain a meaningful history record.
- [ ] seedEmpty may not contain a meaningful history record.
- [ ] A successful manual dataFlag change requires an existing stable history record in local AppData and the Dev API snapshot.
- [ ] Use a dedicated test browser profile and test fixture or test state.
- [ ] Do not use real personal training data.
- [ ] Do not modify production or daily localStorage.
- [ ] Confirm there is a visible stable history record available for testing.
- [ ] Confirm the selected record has a current dataFlag or safe default.
- [ ] Confirm the Dev API snapshot corresponds to the test state if testing success.

Expected results:
- [ ] The target record is stable and safe to mutate in the dedicated dev DB only.

Failure criteria:
- [ ] Fail if no stable test record exists and the scenario requires a successful mutation.

## Start App With Required Flags

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

- [ ] Open the App in the dedicated test profile.
- [ ] Confirm the App opens normally.
- [ ] Confirm read-only diagnostics may appear.
- [ ] Confirm the History data-flag mutation prototype appears only when all required flags are enabled and a stable target record exists.
- [ ] Confirm the UI clearly says dev-only mutation experiment.
- [ ] Confirm the UI clearly says localStorage remains source of truth.

Expected results:
- [ ] The App loads normally and only the explicitly flagged History data-flag prototype can appear.

Failure criteria:
- [ ] Fail if the prototype appears without all required flags or with a non-localhost base URL.

## Flag Matrix Manual Checks

- [ ] Compare flag off: no History data-flag prototype appears.
- [ ] Mutation flag off: no History data-flag prototype appears.
- [ ] Compare flag on only: read-only diagnostics may show, mutation prototype is absent.
- [ ] Mutation flag on only: mutation prototype is absent.
- [ ] `VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT="datahealth-dismiss"` does not enable History data-flag.
- [ ] Production-like build: History data-flag prototype is disabled.
- [ ] All required flags enabled: History prototype may appear when a stable target record exists.

Expected results:
- [ ] No `POST /history/:id/data-flag` occurs unless all flags are enabled and the user confirms.

Failure criteria:
- [ ] Fail if compare-only, mutation-only, DataHealth dismiss flag, or production-like state enables History data-flag.

## Target Record Manual Check

- [ ] No stable record: no POST occurs and the UI shows a safe empty or disabled state.
- [ ] Stable record exists: current dataFlag is visible.
- [ ] Confirm target dataFlag choices are exactly `normal`, `test`, and `excluded`.
- [ ] Confirm invalid dataFlag is not selectable.
- [ ] Confirm changing target flag resets stale confirmation.
- [ ] Confirm changing target record resets stale confirmation.

Expected results:
- [ ] The prototype can target only a stable test record and only accepted dataFlag values.

Failure criteria:
- [ ] Fail if invalid dataFlag is selectable or stale confirmation survives record/target changes.

## Confirmation Manual Check

- [ ] Confirm the prototype is visible.
- [ ] Leave confirmation unchecked.
- [ ] Try to change dataFlag.
- [ ] Confirm no POST before explicit confirmation.
- [ ] No POST before explicit confirmation.
- [ ] Click Cancel and confirm Cancel prevents POST.
- [ ] Confirm a confirmed change is required before POST.
- [ ] Confirm confirmation copy shows current flag and target flag.
- [ ] Confirm confirmation copy explains statistics may change.

Expected results:
- [ ] No request is sent until the user explicitly confirms the selected record and target flag.

Failure criteria:
- [ ] Fail if any POST occurs before confirmation or after Cancel.

## Pending / Duplicate-submit Manual Check

- [ ] Submit a confirmed dataFlag change.
- [ ] Confirm submit becomes pending.
- [ ] Confirm repeated click while pending does not send duplicate POST.
- [ ] Repeated click while pending does not send duplicate POST.
- [ ] Confirm pending state is visible.
- [ ] Confirm no optimistic success appears before response.
- [ ] No optimistic success appears before response.
- [ ] Confirm no localStorage write occurs during pending.
- [ ] Confirm failure releases pending state.
- [ ] Confirm retry after failure requires explicit user action and confirmation.

Expected results:
- [ ] One confirmed submit sends at most one `POST /history/:id/data-flag`.

Failure criteria:
- [ ] Fail if repeated click or repeated submit sends duplicate POSTs or shows optimistic success.

## Successful Data-flag Change Manual Check

- [ ] Submit a confirmed valid dataFlag change.
- [ ] Browser Network shows exactly `POST /history/:id/data-flag` for the History data-flag mutation.
- [ ] Confirm no session, history edit, repair, backup, or reset POST appears.
- [ ] Confirm success appears only after HTTP 2xx plus result success plus snapshot metadata.
- [ ] Confirm UI does not overwrite localStorage.
- [ ] Confirm AppData is not replaced by API result.
- [ ] Confirm success state does not claim production sync.

Expected results:
- [ ] Success is visible only after HTTP success, mutation success, and snapshot metadata.

Failure criteria:
- [ ] Fail if success appears without snapshot metadata or if the API result overwrites AppData/localStorage.

## Failure / No-fake-success Manual Checks

- [ ] Stop Dev API runner, then attempt a confirmed change.
- [ ] Use invalid or no stable record scenario if safely reproducible.
- [ ] Use record not found or no_change scenario if safely reproducible.
- [ ] Use malformed or invalid response only if a test harness allows; otherwise rely on automated tests.
- [ ] Confirm API unavailable shows failure.
- [ ] Confirm timeout, unavailable, or error does not show success.
- [ ] Confirm `record_not_found` or `no_change` does not show success.
- [ ] Confirm invalid dataFlag does not show success.
- [ ] Confirm write failure does not show success.
- [ ] Confirm missing snapshot metadata does not show success.
- [ ] Confirm no raw stack is shown.
- [ ] Confirm no auto-retry occurs.
- [ ] Confirm no localStorage write occurs.

Expected results:
- [ ] Failure states remain visibly failed and never become fake success.

Failure criteria:
- [ ] Fail if unavailable, timeout, no_change, record_not_found, invalid dataFlag, write failure, or missing snapshot metadata shows success.

## normal / test / excluded Semantics Manual Check

- [ ] Confirm `normal` participates in default statistics.
- [ ] Confirm `test` remains visible but excluded from default production-like statistics.
- [ ] Confirm `excluded` remains visible but excluded from default production-like statistics.
- [ ] Confirm changing dataFlag can affect summaries.
- [ ] Confirm this prototype does not change PR, e1RM, or effectiveSet algorithms.
- [ ] Confirm App still uses localStorage as source of truth.
- [ ] Confirm the developer verifies visibility and summary expectations in the test profile.
- [ ] Confirm no API result overwrites localStorage.
- [ ] If mismatch appears, confirm it is diagnostics-only.

Expected results:
- [ ] DataFlag visibility and summary behavior match the current `normal`, `test`, and `excluded` semantics.

Failure criteria:
- [ ] Fail if test/excluded become hidden, enter default production-like statistics, or alter training algorithms.

## LocalStorage Integrity Manual Check

- [ ] Snapshot localStorage before the test in the dedicated test profile only.
- [ ] Run matching, mismatch, success, and failure scenarios as available.
- [ ] Compare localStorage after the test.
- [ ] Confirm API response snapshot metadata is not stored in localStorage.
- [ ] Confirm API result does not overwrite AppData or localStorage.
- [ ] Confirm localStorage remains the only active App source of truth.

Expected results:
- [ ] localStorage before/after remains unchanged by API response data.

Failure criteria:
- [ ] Fail if API response snapshot metadata or mutation result is written into localStorage or merged into AppData.

## Network Route Boundary Manual Check

- [ ] Using DevTools Network, verify allowed read-only routes:
  - [ ] `GET /health`
  - [ ] `GET /app-data/summary`
  - [ ] `GET /sessions/summary`
  - [ ] `GET /history`
  - [ ] `GET /history/:id`
  - [ ] `GET /data-health/summary`
- [ ] Confirm `POST /data-health/issues/:issueId/dismiss` appears only if that separate flag/prototype is explicitly enabled in its own flow.
- [ ] Confirm `POST /history/:id/data-flag` appears only after History data-flag confirmation.
- [ ] Forbidden: `POST /sessions/start`.
- [ ] Forbidden: `POST /sessions/active/patches`.
- [ ] Forbidden: `POST /sessions/active/complete`.
- [ ] Forbidden: `POST /sessions/active/discard`.
- [ ] Forbidden: `POST /history/:id/edit`.
- [ ] Forbidden: `POST /data-health/repair/apply`.
- [ ] Forbidden: backup/import/export/reset/recovery HTTP routes.

Expected results:
- [ ] Browser mutation routes remain exactly `POST /data-health/issues/:issueId/dismiss` and `POST /history/:id/data-flag`.

Failure criteria:
- [ ] Fail if DevTools Network shows any session, history edit, repair, backup, import, export, reset, or recovery POST from browser code.

## Forbidden UI Controls Manual Check

- [ ] Confirm there are no controls or labels for repair.
- [ ] Confirm there are no controls or labels for sync.
- [ ] Confirm there are no controls or labels for overwrite.
- [ ] Confirm there are no controls or labels for import.
- [ ] Confirm there are no controls or labels for export.
- [ ] Confirm there are no controls or labels for reset.
- [ ] Confirm there are no controls or labels for apply.
- [ ] Confirm there are no controls or labels for fix.
- [ ] Confirm there are no controls or labels for migrate.

Expected results:
- [ ] The History data-flag prototype exposes no repair/sync/overwrite/import/export/reset/apply/fix/migrate controls.

Failure criteria:
- [ ] Fail if any forbidden write or recovery control appears in the prototype.

## Cleanup

- [ ] Ctrl+C stop App dev server.
- [ ] Ctrl+C stop Dev API runner.
- [ ] PowerShell:

```powershell
Remove-Item Env:VITE_IRONPATH_DEV_API_COMPARE -ErrorAction SilentlyContinue
Remove-Item Env:VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT -ErrorAction SilentlyContinue
Remove-Item Env:VITE_IRONPATH_DEV_API_BASE_URL -ErrorAction SilentlyContinue
```

- [ ] macOS/Linux:

```bash
unset VITE_IRONPATH_DEV_API_COMPARE
unset VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT
unset VITE_IRONPATH_DEV_API_BASE_URL
```

- [ ] Remove test dev DB artifacts if needed:
  - [ ] `.ironpath/manual-history-data-flag-acceptance.sqlite`
  - [ ] `.ironpath/manual-history-data-flag-acceptance.sqlite-wal`
  - [ ] `.ironpath/manual-history-data-flag-acceptance.sqlite-shm`
  - [ ] `.ironpath/manual-history-data-flag-acceptance.sqlite-journal`
- [ ] Do not delete `.ironpath/dev-api-runner`.
- [ ] Check `git status`.
- [ ] Do not commit dev DB artifacts.

Expected results:
- [ ] Env vars are cleared and test DB artifacts are removed or left untracked only when intentionally retained for local debugging.

Failure criteria:
- [ ] Fail if env vars remain set accidentally or dev DB artifacts are staged for commit.

## Browser Build Safety

- [ ] `npm run build` passes.
- [ ] Scan `dist/` for `node:http`; expected result is no match.
- [ ] Scan `dist/` for `node:sqlite`; expected result is no match.
- [ ] Scan `dist/` for `devLauncher`; expected result is no match.
- [ ] Scan `dist/` for `httpRuntimeAdapter`; expected result is no match.
- [ ] Scan `dist/` for `serverAdapter`; expected result is no match.
- [ ] Scan `dist/` for `sqliteRepository`; expected result is no match.
- [ ] Scan `dist/` for `devApiRunner`; expected result is no match.
- [ ] Scan `dist/` for `devDbRecovery`; expected result is no match.

Expected results:
- [ ] Browser build remains free of Node-only stack tokens.

Failure criteria:
- [ ] Fail if the production browser build contains Node-only stack tokens.

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
- [ ] Target record used:
- [ ] Current dataFlag:
- [ ] Target dataFlag:
- [ ] Flag matrix result:
- [ ] Target record result:
- [ ] Confirmation result:
- [ ] Duplicate-submit result:
- [ ] Success result:
- [ ] Failure result:
- [ ] Data semantics result:
- [ ] LocalStorage integrity result:
- [ ] Network route boundary result:
- [ ] Forbidden controls result:
- [ ] Cleanup result:
- [ ] Browser build result:
- [ ] Notes:
- [ ] Pass / Fail:
