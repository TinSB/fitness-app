# Limited History Edit Manual App Acceptance

This is the human-run App acceptance checklist for the existing dev-only Limited History Edit mutation prototype.

Task 4.48 does not add runtime behavior. It validates the Task 4.46 route and Task 4.47 acceptance runbook in a local App/dev API session. The accepted browser mutation routes remain exactly `POST /data-health/issues/:issueId/dismiss`, `POST /history/:id/data-flag`, and `POST /history/:id/edit`.

## Scope / Non-goals

- [ ] This is dev-only manual App acceptance.
- [ ] This is not production readiness.
- [ ] This is not broad mutation integration.
- [ ] This is not source-of-truth migration.
- [ ] This does not approve session mutation, DataHealth repair mutation, backup/import/export mutation, reset, or recovery mutation.
- [ ] localStorage remains source of truth.
- [ ] API result never overwrites AppData or localStorage.
- [ ] No auth, sync, or deployment is added.
- [ ] No normalized tables are added.
- [ ] No package dependency or package script is added.
- [ ] Use dedicated test browser profile only.
- [ ] Accepted browser mutation routes remain exactly:
  - [ ] `POST /data-health/issues/:issueId/dismiss`
  - [ ] `POST /history/:id/data-flag`
  - [ ] `POST /history/:id/edit`

Expected results:
- [ ] This runbook is used only for manual App acceptance of the existing Limited History Edit prototype.

Failure criteria:
- [ ] Fail if manual testing requires a runtime source change, a fourth route, source-of-truth switch, or production backend behavior.

## Safety Before Testing

- [ ] Do not use real personal training data.
- [ ] Do not use or clear the daily browser profile.
- [ ] Use a dedicated test browser profile.
- [ ] Use a dedicated dev DB file, for example `.ironpath/manual-limited-history-edit-acceptance.sqlite`.
- [ ] Do not commit `.sqlite`, `.sqlite-wal`, `.sqlite-shm`, or `.sqlite-journal` files.
- [ ] Do not treat this as production backend validation.
- [ ] Keep the test browser profile separate from daily training data.

Expected results:
- [ ] The test uses disposable browser state and a disposable dev DB file only.

Failure criteria:
- [ ] Fail if real personal training data or a daily browser profile is used.

## Prerequisites

- [ ] Confirm the git worktree is clean.
- [ ] Confirm latest `main` includes Task 4.47.
- [ ] Run `npm run api:dev:build`.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Confirm `dist/` token scan is clean for `node:http`, `node:sqlite`, `devLauncher`, `httpRuntimeAdapter`, `serverAdapter`, `sqliteRepository`, `devApiRunner`, and `devDbRecovery`.

Expected results:
- [ ] Automated validation is green before manual acceptance.

Failure criteria:
- [ ] Fail if validation is red or if the browser build contains Node-only tokens.

## Start Dev API Runner

PowerShell:

```powershell
npm run api:dev -- --port 8787 --seed-empty --db .ironpath/manual-limited-history-edit-acceptance.sqlite
```

- [ ] Confirm the runner prints `IronPath dev API ready: <url>`.
- [ ] Confirm `GET /health` responds.
- [ ] Confirm Dev API base URL is `http://127.0.0.1:8787` or `http://localhost:8787`.

Expected results:
- [ ] Dev API is local-only and ready.

Failure criteria:
- [ ] Fail if the Dev API uses a non-localhost URL.

## Prepare Test Data

- [ ] Seed or create a disposable App history session with at least one exercise and one existing set.
- [ ] Confirm the same stable history record exists in local AppData and the Dev API snapshot.
- [ ] Confirm the target has a visible stable history record, exercise id, and set id.
- [ ] Do not use real personal training data.

Expected results:
- [ ] A disposable target exists for `POST /history/:id/edit`.

Failure criteria:
- [ ] Fail if seed data has no stable target or if real training data is required.

## Start App With Required Flags

PowerShell:

```powershell
$env:VITE_IRONPATH_DEV_API_COMPARE="1"
$env:VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT="limited-history-edit"
$env:VITE_IRONPATH_DEV_API_BASE_URL="http://127.0.0.1:8787"
npm run dev
```

POSIX:

```bash
VITE_IRONPATH_DEV_API_COMPARE=1 VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT=limited-history-edit VITE_IRONPATH_DEV_API_BASE_URL=http://127.0.0.1:8787 npm run dev
```

Expected results:
- [ ] App starts with the Limited History Edit prototype visible only when required flags are present.

Failure criteria:
- [ ] Fail if the prototype renders without both required flags.

## Flag Matrix Manual Checks

- [ ] Compare flag off: no Limited History Edit UI and no POST.
- [ ] Mutation flag off: no Limited History Edit UI and no POST.
- [ ] Compare flag on only: read-only diagnostics may render, Limited History Edit does not.
- [ ] Mutation flag on only: Limited History Edit does not.
- [ ] `datahealth-dismiss` flag does not render Limited History Edit.
- [ ] `history-data-flag` flag does not render Limited History Edit.
- [ ] Production-like build does not render Limited History Edit.
- [ ] All required flags enabled renders Limited History Edit only when a stable target exists.

Expected results:
- [ ] Flag matrix is isolated.

Failure criteria:
- [ ] Fail if another mutation flag enables Limited History Edit.

## Target Session / Exercise / Set Manual Check

- [ ] Target session is visible.
- [ ] Target exercise is visible.
- [ ] Target set is visible.
- [ ] Movement pattern is visible.
- [ ] Primary muscle is visible.
- [ ] Prescription summary is visible.
- [ ] Set type is visible.
- [ ] Before values are visible.
- [ ] After values are visible.
- [ ] Changed fields are visible.
- [ ] Calculation impact warning is visible.
- [ ] No stable session/exercise/set shows a safe empty state and no POST.

Expected results:
- [ ] The prototype targets one existing set only.

Failure criteria:
- [ ] Fail if the UI allows add/remove/reorder, arbitrary nested patch, whole-session JSON patch, or active-session mutation.

## Confirmation Manual Check

- [ ] No POST before explicit confirmation.
- [ ] Cancel prevents POST.
- [ ] Confirmed submit sends exactly one `POST /history/:id/edit`.
- [ ] Confirmation copy states localStorage remains source of truth.
- [ ] Confirmation copy shows before and after values.
- [ ] Confirmation copy explains calculation impact.
- [ ] Confirmation resets after success.
- [ ] Confirmation resets after failure.
- [ ] Confirmation resets when target session/exercise/set changes.
- [ ] Confirmation resets when patch changes.

Expected results:
- [ ] Submit is explicit and reversible by cancellation before request.

Failure criteria:
- [ ] Fail if POST can occur before explicit confirmation.

## Pending / Duplicate-submit Manual Check

- [ ] Submit disabled while pending.
- [ ] Pending state visible.
- [ ] Repeated click while pending sends at most one request.
- [ ] Repeated Enter while pending sends at most one request if applicable.
- [ ] No optimistic success appears before response.
- [ ] No localStorage write occurs during pending.
- [ ] Failure releases pending state.
- [ ] Retry after failure requires explicit user action and confirmation.

Expected results:
- [ ] Pending state prevents duplicate writes.

Failure criteria:
- [ ] Fail if duplicate POSTs are sent for one confirmed attempt.

## Successful Limited Edit Manual Check

- [ ] HTTP response is 2xx.
- [ ] `result.ok === true`.
- [ ] `result.changed === true`.
- [ ] `result.status === "success"`.
- [ ] Snapshot metadata exists.
- [ ] UI shows success only after all required success fields.
- [ ] UI shows snapshot metadata.
- [ ] localStorage remains unchanged.
- [ ] AppData remains unchanged.
- [ ] Rerun read-only comparison manually after success.

Expected results:
- [ ] Success is strict and not optimistic.

Failure criteria:
- [ ] Fail if success appears without snapshot metadata or if local App data changes.

## Failure / No-fake-success Manual Checks

- [ ] API unavailable does not show success.
- [ ] Timeout does not show success.
- [ ] Abort does not show success.
- [ ] Malformed response does not show success.
- [ ] Server error shape does not show success.
- [ ] `ok=false` does not show success.
- [ ] `changed=false` / no_change does not show success.
- [ ] record_not_found does not show success.
- [ ] exercise_not_found does not show success.
- [ ] set_not_found does not show success.
- [ ] invalid patch does not show success.
- [ ] validation failed does not show success.
- [ ] source snapshot mismatch does not show success.
- [ ] requiresConfirmation does not show success.
- [ ] write_failed does not show success.
- [ ] transaction_failed does not show success.
- [ ] database_closed does not show success.
- [ ] unsupported_route does not show success.
- [ ] Missing snapshot metadata does not show success.
- [ ] Failure copy does not expose raw stack.
- [ ] No failure auto-retries.

Expected results:
- [ ] Every failure remains visible and local-only.

Failure criteria:
- [ ] Fail if any failure state looks successful.

## Field Constraint Manual Check

- [ ] Allowed patch fields are exactly `weightKg`, `displayWeight`, `displayUnit`, `reps`, `rir`, `techniqueQuality`, `painFlag`, and `note`.
- [ ] `dataFlag` is not accepted through this route.
- [ ] Session identity fields are rejected.
- [ ] Session state fields are rejected.
- [ ] Exercise identity fields are rejected.
- [ ] Set identity and structure fields are rejected.
- [ ] Add/remove/reorder operations are not available.
- [ ] Active session mutation is not available.
- [ ] Direct audit writes are not available.
- [ ] Derived summary writes are not available.

Expected results:
- [ ] Manual checks match the constrained one-set patch contract.

Failure criteria:
- [ ] Fail if broad edit fields are accepted by the browser prototype.

## Data Semantics Manual Check

- [ ] `actualWeightKg` remains trusted for calculation.
- [ ] `displayWeight` and `displayUnit` remain display-only unless paired with `weightKg`.
- [ ] `identityInvalid` semantics remain unchanged.
- [ ] `test` remains visible but excluded from default production-like statistics.
- [ ] `excluded` remains visible but excluded from default production-like statistics.
- [ ] PR rules remain unchanged.
- [ ] e1RM rules remain unchanged.
- [ ] effective-set rules remain unchanged.
- [ ] Backup/import semantics remain unchanged.

Expected results:
- [ ] Data semantics are unchanged except for the server-side dev DB snapshot of the selected set edit.

Failure criteria:
- [ ] Fail if training algorithms or backup/import behavior changes.

## LocalStorage Integrity Manual Check

- [ ] Capture localStorage before mutation attempt.
- [ ] Success does not change localStorage.
- [ ] Failure does not change localStorage.
- [ ] Pending does not change localStorage.
- [ ] Snapshot metadata is not stored in localStorage.
- [ ] API result is not merged into AppData.

Expected results:
- [ ] localStorage is identical before and after the prototype request.

Failure criteria:
- [ ] Fail if the browser prototype writes localStorage.

## Network Route Boundary Manual Check

- [ ] Limited History Edit sends only `POST /history/:id/edit`.
- [ ] No `POST /sessions/start`.
- [ ] No `POST /sessions/active/patches`.
- [ ] No `POST /sessions/active/complete`.
- [ ] No `POST /sessions/active/discard`.
- [ ] No `POST /data-health/repair/apply`.
- [ ] No backup/import/export/reset/recovery HTTP route.

Expected results:
- [ ] Network panel shows only the accepted route for the tested flow.

Failure criteria:
- [ ] Fail if any fourth mutation route appears.

## Forbidden UI Controls Manual Check

- [ ] No repair control.
- [ ] No sync control.
- [ ] No overwrite control.
- [ ] No import/export control.
- [ ] No reset control.
- [ ] No apply/fix all control.

Expected results:
- [ ] Prototype UI exposes only the constrained Limited History Edit controls.

Failure criteria:
- [ ] Fail if destructive or broad write controls appear.

## Cleanup

PowerShell:

```powershell
Remove-Item Env:VITE_IRONPATH_DEV_API_COMPARE -ErrorAction SilentlyContinue
Remove-Item Env:VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT -ErrorAction SilentlyContinue
Remove-Item Env:VITE_IRONPATH_DEV_API_BASE_URL -ErrorAction SilentlyContinue
```

POSIX:

```bash
unset VITE_IRONPATH_DEV_API_COMPARE
unset VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT
unset VITE_IRONPATH_DEV_API_BASE_URL
```

- [ ] Stop the Dev API runner.
- [ ] Refresh app and confirm mutation UI is hidden.
- [ ] Remove disposable dev DB artifacts if no longer needed.
- [ ] Keep real localStorage untouched.

Expected results:
- [ ] Environment returns to default-off state.

Failure criteria:
- [ ] Fail if mutation UI remains visible after cleanup.

## Browser Build Safety

- [ ] Run `npm run build`.
- [ ] Scan `dist/` for `node:http`, `node:sqlite`, `devLauncher`, `httpRuntimeAdapter`, `serverAdapter`, `sqliteRepository`, `devApiRunner`, and `devDbRecovery`.

Expected results:
- [ ] Browser build remains free of Node-only tokens.

Failure criteria:
- [ ] Fail if a Node-only token appears in `dist/`.

## Manual Pass / Fail Template

- [ ] Date:
- [ ] Branch / commit:
- [ ] Dev API URL:
- [ ] Test browser profile:
- [ ] Target session:
- [ ] Target exercise:
- [ ] Target set:
- [ ] Changed fields:
- [ ] Flag matrix result:
- [ ] Target set result:
- [ ] Confirmation result:
- [ ] Duplicate-submit result:
- [ ] Success result:
- [ ] Failure result:
- [ ] Field constraint result:
- [ ] Data semantics result:
- [ ] LocalStorage integrity result:
- [ ] Network route boundary result:
- [ ] Forbidden controls result:
- [ ] Cleanup result:
- [ ] Browser build result:
- [ ] Notes:
- [ ] Pass / Fail:
