# History Data-flag Prototype Acceptance

This checklist accepts the dev-only History data-flag mutation prototype from Task 4.36.

Task 4.38 adds the dedicated manual App acceptance runbook at `docs/HISTORY_DATA_FLAG_MANUAL_APP_ACCEPTANCE.md`. Task 4.38 is manual acceptance documentation and docs/static tests only; it adds no runtime behavior and no mutation route.

Task 4.39 hardens the existing History data-flag prototype with no-fake-success, failure-state, duplicate-submit, abort/unmount, confirmation reset, data semantics, docs parity, and route-boundary tests. It adds no runtime capability and no browser mutation route. The History data-flag prototype remains one-route-only, and the global browser mutation allowlist remains exactly `POST /data-health/issues/:issueId/dismiss` and `POST /history/:id/data-flag`.

Task 4.40 adds the write-path two-route checkpoint at `docs/WRITE_PATH_TWO_ROUTE_CHECKPOINT.md`. It confirms the current global browser mutation allowlist remains exactly `POST /data-health/issues/:issueId/dismiss` and `POST /history/:id/data-flag`, no third mutation route is approved, localStorage remains source of truth, and API results never overwrite AppData or localStorage.

## Scope / Non-goals

- [ ] This is acceptance coverage for the existing History data-flag prototype only.
- [ ] This is not a new mutation capability.
- [ ] This does not add a third browser mutation route.
- [ ] This does not implement history edit, session mutation, repair, backup, reset, recovery, auth, sync, deployment, or production backend behavior.
- [ ] This does not replace localStorage or switch source of truth.
- [ ] This does not let API responses overwrite AppData or localStorage.
- [ ] This does not add a frontend mutation client, offline queue, dependency, package script, lockfile change, normalized table, or training algorithm change.
- [ ] Browser mutation routes must remain exactly `POST /data-health/issues/:issueId/dismiss` and `POST /history/:id/data-flag`.

## Safety before testing

- [ ] Use a dedicated test browser profile.
- [ ] Do not use real personal training data.
- [ ] Do not clear real browser profile localStorage.
- [ ] Confirm localStorage remains source of truth before testing.
- [ ] Confirm API results never overwrite AppData or localStorage.
- [ ] Confirm this checklist is dev-only acceptance and not production readiness.

## Prerequisites

- [ ] Work from `C:\Users\xuhao\PycharmProjects\fitness-app`.
- [ ] Run `npm run api:dev:build`.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Open browser DevTools Network before submitting any mutation.
- [ ] Record branch, commit, Node version, browser/profile, and Dev API URL in the pass/fail template.

## Start Dev API runner

- [ ] Start the runner with an empty test snapshot:

```powershell
npm run api:dev -- --seed-empty
```

- [ ] Confirm the runner prints an `IronPath dev API ready: <url>` line.
- [ ] Confirm the URL is localhost, for example `http://127.0.0.1:8787`.
- [ ] Do not point the App at a non-localhost Dev API URL.

## Start App with required flags

- [ ] PowerShell:

```powershell
$env:VITE_IRONPATH_DEV_API_COMPARE='1'
$env:VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT='history-data-flag'
$env:VITE_IRONPATH_DEV_API_BASE_URL='http://127.0.0.1:8787'
npm run dev
```

- [ ] macOS/Linux:

```bash
export VITE_IRONPATH_DEV_API_COMPARE=1
export VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT=history-data-flag
export VITE_IRONPATH_DEV_API_BASE_URL=http://127.0.0.1:8787
npm run dev
```

- [ ] Open the App in the dedicated test profile only.
- [ ] Confirm the History data-flag experiment appears only when a stable history record exists.

## Flag matrix manual check

- [ ] Compare flag off: no History data-flag mutation UI appears and no `POST /history/:id/data-flag` is sent.
- [ ] Mutation flag off: no History data-flag mutation UI appears and no `POST /history/:id/data-flag` is sent.
- [ ] `DEV=false` or production-like build: History data-flag mutation UI is disabled.
- [ ] Compare flag on with mutation experiment missing: read-only diagnostics may appear, but History data-flag mutation UI does not.
- [ ] Mutation experiment set without compare flag: History data-flag mutation UI does not appear.
- [ ] `VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT='datahealth-dismiss'`: DataHealth dismiss remains isolated and History data-flag does not enable.
- [ ] `VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT='history-data-flag'`: History data-flag may enable and DataHealth dismiss does not auto-enable.
- [ ] All required flags enabled: History data-flag prototype may render when a stable target record exists.

## Target record manual check

- [ ] With no stable history record, the prototype shows a safe empty or disabled diagnostic and sends no POST.
- [ ] With a stable record, the UI shows the current dataFlag.
- [ ] Confirm target dataFlag can be selected only from `normal`, `test`, and `excluded`.
- [ ] Confirm invalid target dataFlag is rejected before request if encountered.
- [ ] Change target dataFlag and confirm stale confirmation is cleared.
- [ ] Change target record and confirm stale confirmation is cleared.
- [ ] Confirm the visible target record reference is safe and does not dump full AppData or personal training data.

## Confirmation manual check

- [ ] Try submitting without explicit confirmation; expected result is no POST.
- [ ] Check confirmation copy shows current dataFlag and target dataFlag.
- [ ] Check confirmation copy explains that statistics may change.
- [ ] Click Cancel; expected result is no POST and confirmation cleared.
- [ ] Confirm the final submit sends exactly one `POST /history/:id/data-flag`.
- [ ] After success or failure, confirmation state resets and retry requires explicit confirmation again.

## Pending / duplicate-submit manual check

- [ ] Submit once after confirmation and verify visible pending state.
- [ ] While pending, submit control is disabled.
- [ ] While pending, repeated click sends only one POST.
- [ ] While pending, repeated Enter key or repeated submit event sends only one POST.
- [ ] Pending state must not show optimistic success.
- [ ] Pending state must not write localStorage.
- [ ] After failure, pending clears.
- [ ] Retry after failure requires a new explicit confirmation.
- [ ] There is no automatic retry.

## Successful dataFlag change manual check

- [ ] Submit a valid dataFlag change.
- [ ] DevTools Network shows HTTP 2xx.
- [ ] Response has `result.ok === true`.
- [ ] Response has `result.changed === true`.
- [ ] Response has `result.status === "success"`.
- [ ] Response includes snapshot metadata.
- [ ] UI shows success only after all success conditions are true.
- [ ] UI says no data was changed locally and suggests manual read-only recheck.
- [ ] localStorage remains source of truth after success.

## Failure / no-fake-success manual checks

- [ ] API unavailable shows failure or diagnostic, not success.
- [ ] Timeout shows failure or diagnostic, not success.
- [ ] Abort or navigation away does not show success.
- [ ] Malformed response shows failure or diagnostic, not success.
- [ ] Server error shape shows failure or diagnostic, not success.
- [ ] `result.ok=false` shows failure, not success.
- [ ] `changed=false` or `no_change` shows failure or no-change diagnostic, not success.
- [ ] `record_not_found` shows failure or diagnostic, not success.
- [ ] Invalid dataFlag shows failure or diagnostic, not success.
- [ ] `requiresConfirmation` shows failure or diagnostic, not success.
- [ ] Source snapshot mismatch, if surfaced, shows failure or diagnostic, not success.
- [ ] `write_failed` shows failure or diagnostic, not success.
- [ ] `transaction_failed` shows failure or diagnostic, not success.
- [ ] `database_closed` shows failure or diagnostic, not success.
- [ ] `unsupported_route` shows failure or diagnostic, not success.
- [ ] Missing snapshot metadata is failure and must not show success.
- [ ] Failure states do not auto-retry, write localStorage, mutate AppData, or expose raw stack traces.

## normal / test / excluded semantics manual check

- [ ] `normal` records remain visible and participate in default production-like statistics.
- [ ] `test` records remain visible but are excluded from default production-like statistics.
- [ ] `excluded` records remain visible but are excluded from default production-like statistics.
- [ ] Confirm test/excluded behavior is visible in read-only diagnostics after manual recheck.
- [ ] Confirm no PR, e1RM, effectiveSet, weighted effectiveSet, scheduler, template, or backup import/export semantics changed.
- [ ] Confirm `actualWeightKg` remains the trusted calculation source.
- [ ] Confirm `identityInvalid` semantics are unchanged.

## localStorage integrity manual check

- [ ] Before submitting, snapshot dedicated-profile localStorage for the test profile only.
- [ ] After success, compare localStorage; expected result is unchanged by API response.
- [ ] After failure, compare localStorage; expected result is unchanged by API response.
- [ ] Confirm snapshot metadata is not stored in localStorage.
- [ ] Confirm API response result is not merged into AppData.
- [ ] Confirm read-only comparison remains separate from the mutation prototype.
- [ ] Do not delete or clear real browser profile localStorage.

## Network route boundary manual check

- [ ] Allowed read-only GET routes may appear:
  - [ ] `GET /health`
  - [ ] `GET /app-data/summary`
  - [ ] `GET /sessions/summary`
  - [ ] `GET /history`
  - [ ] `GET /history/:id`
  - [ ] `GET /data-health/summary`
- [ ] Allowed browser mutation routes are exactly:
  - [ ] `POST /data-health/issues/:issueId/dismiss`
  - [ ] `POST /history/:id/data-flag`
- [ ] During this History data-flag acceptance, the confirmed mutation request is only `POST /history/:id/data-flag`.
- [ ] Fail if Network shows `POST /sessions/start`.
- [ ] Fail if Network shows `POST /sessions/active/patches`.
- [ ] Fail if Network shows `POST /sessions/active/complete`.
- [ ] Fail if Network shows `POST /sessions/active/discard`.
- [ ] Fail if Network shows `POST /history/:id/edit`.
- [ ] Fail if Network shows `POST /data-health/repair/apply`.
- [ ] Fail if Network shows backup/import/export/reset/recovery HTTP routes.

## Forbidden UI controls manual check

- [ ] Confirm no UI control or action label offers repair.
- [ ] Confirm no UI control or action label offers sync.
- [ ] Confirm no UI control or action label offers overwrite.
- [ ] Confirm no UI control or action label offers import.
- [ ] Confirm no UI control or action label offers export.
- [ ] Confirm no UI control or action label offers reset.
- [ ] Confirm no UI control or action label offers apply.
- [ ] Confirm no UI control or action label offers fix.
- [ ] Confirm no UI control or action label offers migrate.

## Cleanup / env reset

- [ ] Ctrl+C stop the App dev server.
- [ ] Ctrl+C stop the Dev API runner.
- [ ] PowerShell cleanup:

```powershell
Remove-Item Env:VITE_IRONPATH_DEV_API_COMPARE -ErrorAction SilentlyContinue
Remove-Item Env:VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT -ErrorAction SilentlyContinue
Remove-Item Env:VITE_IRONPATH_DEV_API_BASE_URL -ErrorAction SilentlyContinue
```

- [ ] macOS/Linux cleanup:

```bash
unset VITE_IRONPATH_DEV_API_COMPARE
unset VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT
unset VITE_IRONPATH_DEV_API_BASE_URL
```

- [ ] Remove only test dev DB artifacts if created:
  - [ ] `.ironpath/manual-history-data-flag-acceptance.sqlite`
  - [ ] `.ironpath/manual-history-data-flag-acceptance.sqlite-wal`
  - [ ] `.ironpath/manual-history-data-flag-acceptance.sqlite-shm`
  - [ ] `.ironpath/manual-history-data-flag-acceptance.sqlite-journal`
- [ ] Do not delete `.ironpath/dev-api-runner`.
- [ ] Check `git status`.
- [ ] Do not commit dev DB artifacts.

## Browser build safety

- [ ] `npm run build` passes.
- [ ] Scan `dist/` for `node:http`; expected result is no match.
- [ ] Scan `dist/` for `node:sqlite`; expected result is no match.
- [ ] Scan `dist/` for `devLauncher`; expected result is no match.
- [ ] Scan `dist/` for `httpRuntimeAdapter`; expected result is no match.
- [ ] Scan `dist/` for `serverAdapter`; expected result is no match.
- [ ] Scan `dist/` for `sqliteRepository`; expected result is no match.
- [ ] Scan `dist/` for `devApiRunner`; expected result is no match.
- [ ] Scan `dist/` for `devDbRecovery`; expected result is no match.

## Manual Pass / Fail template

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
- [ ] Target record result:
- [ ] Confirmation result:
- [ ] Pending / duplicate-submit result:
- [ ] Success result:
- [ ] Failure / no-fake-success result:
- [ ] normal / test / excluded semantics result:
- [ ] localStorage integrity result:
- [ ] Network route boundary result:
- [ ] Forbidden controls result:
- [ ] Cleanup / env reset result:
- [ ] Browser build result:
- [ ] Notes:
- [ ] Pass / Fail:
