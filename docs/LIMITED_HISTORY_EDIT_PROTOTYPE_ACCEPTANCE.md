# Limited History Edit Prototype Acceptance

## Scope / Non-goals

- [ ] Accept only the dev-only Limited History Edit prototype for `POST /history/:id/edit`.
- [ ] Do not treat this as production readiness.
- [ ] Do not add broad history edit, session mutation, DataHealth repair, backup/import/export/reset/recovery, source-of-truth migration, auth, sync, deployment, normalized tables, or a broad mutation client.

## Safety Before Testing

- [ ] Use only synthetic or disposable dev data.
- [ ] Confirm localStorage remains the App source of truth.
- [ ] Confirm API results must not overwrite AppData or localStorage.
- [ ] Confirm the Dev API database can be discarded or recovered with the existing dev runbook.

## Prerequisites

- [ ] Latest `main` includes Task 4.46.
- [ ] Browser mutation routes are exactly:
  - [ ] `POST /data-health/issues/:issueId/dismiss`
  - [ ] `POST /history/:id/data-flag`
  - [ ] `POST /history/:id/edit`
- [ ] No session/DataHealth repair/backup/reset route is approved.

## Start Dev API Runner

- [ ] Run `npm run api:dev`.
- [ ] Confirm the Dev API base URL is localhost only.
- [ ] Confirm read-only diagnostics can run separately from mutation experiments.

## Start App With Required Flags

- [ ] Start the app with `VITE_IRONPATH_DEV_API_COMPARE=1`.
- [ ] Set `VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT=limited-history-edit`.
- [ ] Use optional `VITE_IRONPATH_DEV_API_BASE_URL` only for localhost.
- [ ] Confirm the prototype remains hidden without both required flags.

## Flag Matrix Manual Check

- [ ] Compare flag off: no Limited History Edit UI and no POST.
- [ ] Mutation flag off: no Limited History Edit UI and no POST.
- [ ] Production-like env: disabled.
- [ ] Compare flag only: read-only diagnostics may exist, Limited History Edit does not.
- [ ] Mutation flag only: Limited History Edit does not.
- [ ] `datahealth-dismiss` flag does not enable Limited History Edit.
- [ ] `history-data-flag` flag does not enable Limited History Edit.
- [ ] `limited-history-edit` enables only Limited History Edit.

## Target Set Manual Check

- [ ] No stable history session: safe disabled/empty diagnostic and no POST.
- [ ] No stable exercise: safe disabled/empty diagnostic and no POST.
- [ ] No stable set: safe disabled/empty diagnostic and no POST.
- [ ] Stable target exists: target session, exercise, and set are visible.
- [ ] Before values are visible.
- [ ] After values are visible.
- [ ] Changed fields are visible.
- [ ] Target patch uses only allowed fields.
- [ ] Invalid patch values are rejected before request where practical.
- [ ] Changing target session/exercise/set clears stale confirmation.
- [ ] Changing patch clears stale confirmation.

## Confirmation Manual Check

- [ ] Cannot submit before explicit confirmation.
- [ ] Cancel prevents POST.
- [ ] Confirmed submit sends exactly one `POST /history/:id/edit`.
- [ ] Confirmation copy shows before and after values.
- [ ] Confirmation copy explains calculation impact.
- [ ] Confirmation copy states localStorage remains source of truth.
- [ ] Confirmation state resets after success/failure.

## Pending / Duplicate-submit Manual Check

- [ ] Submit is disabled while pending.
- [ ] Repeated click while pending sends only one request.
- [ ] Repeated Enter key while pending sends only one request if applicable.
- [ ] Pending state is visible.
- [ ] No optimistic success appears during pending.
- [ ] No localStorage write occurs during pending.
- [ ] Failure releases pending state.
- [ ] Retry after failure requires explicit user action and confirmation.

## Successful Limited Edit Manual Check

- [ ] Success appears only after HTTP 2xx.
- [ ] Success appears only with `result.ok === true`.
- [ ] Success appears only with `result.changed === true`.
- [ ] Success appears only with `result.status === "success"`.
- [ ] Success appears only with snapshot metadata.
- [ ] Snapshot metadata is displayed but not stored in localStorage.
- [ ] AppData is not updated from the API response.

## Failure / No-fake-success Manual Checks

- [ ] API unavailable shows failure and no success.
- [ ] Timeout shows failure and no success.
- [ ] Abort shows failure and no success.
- [ ] Malformed response shows failure and no success.
- [ ] Server error shape shows failure and no success.
- [ ] `ok=false` shows failure and no success.
- [ ] `changed=false` / no_change shows failure and no success.
- [ ] record_not_found shows failure and no success.
- [ ] exercise_not_found shows failure and no success.
- [ ] set_not_found shows failure and no success.
- [ ] invalid patch shows failure and no success.
- [ ] validation failed shows failure and no success.
- [ ] source snapshot mismatch shows failure and no success.
- [ ] requiresConfirmation shows failure and no success.
- [ ] write_failed shows failure and no success.
- [ ] transaction_failed shows failure and no success.
- [ ] database_closed shows failure and no success.
- [ ] unsupported_route shows failure and no success.
- [ ] Missing snapshot metadata shows failure and no success.
- [ ] No failure exposes raw stack text.

## Field Constraint Manual Check

- [ ] Allowed fields are exactly `weightKg`, `displayWeight`, `displayUnit`, `reps`, `rir`, `techniqueQuality`, `painFlag`, and `note`.
- [ ] `dataFlag` is rejected through the edit route.
- [ ] Session identity/state fields are rejected.
- [ ] Exercise identity fields are rejected.
- [ ] Set identity/structure fields are rejected.
- [ ] Add/remove/reorder is not available.
- [ ] Active session mutation is not available.
- [ ] Direct `editHistory` patch is not available.
- [ ] Derived summary patch is not available.

## Data Semantics Manual Check

- [ ] `actualWeightKg` remains trusted.
- [ ] `displayWeight` and `displayUnit` remain display-only unless paired with `weightKg`.
- [ ] `identityInvalid` semantics are unchanged.
- [ ] `test` and `excluded` semantics are unchanged.
- [ ] Training algorithms are unchanged.
- [ ] PR/e1RM/effectiveSet rules are unchanged.
- [ ] readMirror/server-side parity is preserved after a dev DB mutation where practical.
- [ ] Backup/import semantics are unchanged.

## localStorage Integrity Manual Check

- [ ] localStorage value before mutation attempt is recorded.
- [ ] localStorage value after success remains unchanged.
- [ ] localStorage value after failure remains unchanged.
- [ ] Snapshot metadata is not stored in localStorage.
- [ ] API response result is not merged into AppData.

## Network Route Boundary Manual Check

- [ ] Limited History Edit sends only `POST /history/:id/edit`.
- [ ] DataHealth dismiss sends only `POST /data-health/issues/:issueId/dismiss`.
- [ ] History data-flag sends only `POST /history/:id/data-flag`.
- [ ] No `POST /sessions/start`.
- [ ] No `POST /sessions/active/patches`.
- [ ] No `POST /sessions/active/complete`.
- [ ] No `POST /sessions/active/discard`.
- [ ] No `POST /data-health/repair/apply`.
- [ ] No backup/import/export/reset/recovery HTTP route.

## Forbidden UI Controls Manual Check

- [ ] No repair control.
- [ ] No sync control.
- [ ] No overwrite control.
- [ ] No import/export control.
- [ ] No reset control.
- [ ] No apply/fix all control.

## Cleanup / Env Reset

- [ ] Disable `VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT`.
- [ ] Stop Dev API runner.
- [ ] Refresh the app and confirm mutation UI is hidden.
- [ ] Discard or recover dev DB artifacts if needed.

## Browser Build Safety

- [ ] Run `npm run build`.
- [ ] Scan `dist/` for `node:http`, `node:sqlite`, `devLauncher`, `httpRuntimeAdapter`, `serverAdapter`, `sqliteRepository`, `devApiRunner`, and `devDbRecovery`.
- [ ] Confirm no Node-only token appears in browser build output.

## Manual Pass / Fail Template

- [ ] Date:
- [ ] Branch / commit:
- [ ] Dev API base URL:
- [ ] App flags:
- [ ] Browser:
- [ ] Network routes observed:
- [ ] localStorage before/after result:
- [ ] Success scenario result:
- [ ] Failure scenario result:
- [ ] Build/token scan result:
- [ ] Notes:
- [ ] Pass / Fail:
