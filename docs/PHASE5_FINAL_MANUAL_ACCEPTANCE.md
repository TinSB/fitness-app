# Phase 5 Final Manual Acceptance

## Scope / Non-goals

Task 5.38 is the final manual acceptance runbook for Phase 5.

This task does not add runtime behavior, does not modify App.tsx, does not add a browser mutation route, does not delete localStorage, does not silently overwrite localStorage, does not silently overwrite AppData, does not switch the default runtime source, does not add production backend, auth, sync, cloud, deployment, monitoring, package dependency, package script, normalized table, DataHealth repair, backup/import/export over HTTP, reset/recovery over HTTP, or an eighth browser mutation route.

## Required Test Environment

- [ ] Use a dedicated test browser profile.
- [ ] Use a dedicated dev DB.
- [ ] Do not use real personal training data.
- [ ] Start from a clean git worktree.
- [ ] Record branch and commit.
- [ ] Use local Dev API only.
- [ ] Keep production backend/auth/sync/cloud/deployment disabled.
- [ ] Keep localStorage backup available before migration apply.

## Startup Commands

- [ ] Run `npm run api:dev:build`.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Run the browser build isolation token scan.
- [ ] Start the Dev API runner with the dedicated dev DB.
- [ ] Start the App dev server with the dedicated test browser profile.

## Runtime Source Matrix

- [ ] Default launch without runtime source flag uses `localStorage`.
- [ ] `api-readonly` launches diagnostics/read path only.
- [ ] `api-primary-dev` is explicit dev/local opt-in only.
- [ ] Invalid runtime source falls back to `localStorage`.
- [ ] Non-localhost API base URL falls back to `localStorage`.
- [ ] Production-like mode does not enable API primary.

## API Primary Boot Acceptance

- [ ] Boot with `api-primary-dev` and a valid API snapshot.
- [ ] Confirm snapshot metadata is visible or recordable.
- [ ] Confirm schema-valid AppData loads from API primary only under explicit dev/local flag.
- [ ] Confirm localStorage is not silently overwritten during boot.
- [ ] Confirm App shows visible failure and localStorage fallback when API is unavailable.
- [ ] Confirm malformed snapshot response fails visibly.

## Full Workout Flow Acceptance

- [ ] Start from dedicated test data.
- [ ] Start a session through the accepted session start prototype.
- [ ] Apply a session patch through the accepted session patch prototype.
- [ ] Complete a session through the accepted session complete prototype.
- [ ] Discard a separate active test session through the accepted session discard prototype.
- [ ] Confirm no optimistic local mutation is shown as success before strict API success.
- [ ] Confirm no fake success on timeout, unavailable API, malformed response, or missing snapshot metadata.
- [ ] Confirm localStorage remains available as fallback and emergency backup.

## History Edit Acceptance

- [ ] Edit one dedicated test history record through the accepted Limited History Edit route.
- [ ] Confirm strict success shape and snapshot metadata are required.
- [ ] Confirm failed edit does not silently overwrite AppData.
- [ ] Confirm failed edit does not silently overwrite localStorage.

## Data Flag Acceptance

- [ ] Toggle a dedicated test history data flag through the accepted data-flag route.
- [ ] Confirm duplicate-submit prevention.
- [ ] Confirm timeout/unavailable/malformed response is visible failure.
- [ ] Confirm localStorage is not silently overwritten.

## Data Health Dismiss Acceptance

- [ ] Dismiss a dedicated DataHealth issue through the accepted dismiss route.
- [ ] Confirm no DataHealth repair control appears.
- [ ] Confirm no fake success.
- [ ] Confirm localStorage/AppData are not silently overwritten by API result.

## Migration Apply Acceptance

- [ ] Snapshot dedicated test profile localStorage before apply.
- [ ] Run migration dry-run and record warnings.
- [ ] Confirm backup metadata exists.
- [ ] Run apply only after explicit confirmation.
- [ ] Confirm SQLite snapshot metadata is returned.
- [ ] Confirm localStorage is not deleted.
- [ ] Confirm source is not auto-switched after apply.
- [ ] Confirm no HTTP migration route appears in DevTools Network.

## Migration Rollback Acceptance

- [ ] Restore localStorage backup in the dedicated test profile.
- [ ] Restore dev DB backup in the dedicated dev DB.
- [ ] Confirm corrupt backup fails visibly.
- [ ] Confirm schema mismatch fails visibly.
- [ ] Confirm successful restore clears the visible failure state.
- [ ] Confirm rollback does not require production services.
- [ ] Confirm no HTTP reset or recovery route appears in DevTools Network.

## API Unavailable Acceptance

- [ ] Stop the Dev API runner.
- [ ] Confirm `api-readonly` shows diagnostics failure without App crash.
- [ ] Confirm `api-primary-dev` shows visible failure and localStorage fallback.
- [ ] Confirm accepted write attempts fail visibly.
- [ ] Confirm no automatic retry queue or offline mutation queue starts.
- [ ] Restart the Dev API runner and confirm the App remains usable.

## Network Route Boundary

Accepted browser mutation routes must remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

Forbidden routes/capabilities must remain absent:

- `POST /data-health/repair/apply`
- backup/import/export over HTTP
- reset/recovery over HTTP
- any eighth browser mutation route
- production backend/auth/sync/cloud/deployment/monitoring
- broad frontend mutation client
- normalized tables

## Cleanup / Env Reset

- [ ] Stop the App dev server.
- [ ] Stop the Dev API runner.
- [ ] Remove only dedicated dev DB artifacts.
- [ ] Close only the dedicated browser profile.
- [ ] Clear only dedicated test profile data when needed.
- [ ] Preserve daily-use profile and real personal training data.
- [ ] Reset env flags to default `localStorage`.

## Manual Pass / Fail Template

- [ ] Date:
- [ ] Branch:
- [ ] Commit:
- [ ] Dedicated browser profile:
- [ ] Dedicated dev DB:
- [ ] Real personal training data absent:
- [ ] Default localStorage boot:
- [ ] api-readonly diagnostics:
- [ ] api-primary-dev boot:
- [ ] API unavailable fallback:
- [ ] Full workout flow:
- [ ] History edit:
- [ ] Data flag:
- [ ] DataHealth dismiss:
- [ ] Migration dry-run:
- [ ] Migration apply:
- [ ] Migration rollback:
- [ ] Forbidden routes absent:
- [ ] localStorage preserved:
- [ ] AppData not silently overwritten:
- [ ] Browser build isolation:
- [ ] Cleanup complete:
- [ ] Pass / Fail:

## Decision

Task 5.38 records the final Phase 5 manual acceptance runbook.

Next recommended task: `Task 5.39 Phase 5 Exit Regression Lock V1`.

## Final Recommendation

Task 5.38 result: final manual acceptance runbook only.
No runtime behavior, browser mutation route, production backend, auth, sync, cloud, deployment, monitoring, package change, normalized table, DataHealth repair, backup/import/export HTTP, reset/recovery HTTP, or eighth route is added.
localStorage remains default runtime source, fallback, migration source, and emergency backup.
API primary remains explicit dev/local `api-primary-dev`.
Next task should be Task 5.39 Phase 5 Exit Regression Lock V1.
