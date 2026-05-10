# History Data-flag Mutation Prototype Plan

Task 4.35 converts the Task 4.34 second mutation candidate readiness audit into a concrete future prototype plan for `POST /history/:id/data-flag`.

## Task 4.36 Implementation Result

- Task 4.36 implements the planned History data-flag prototype as a dev-only explicit opt-in experiment.
- The only new browser mutation route is `POST /history/:id/data-flag`.
- DataHealth dismiss remains intact as `POST /data-health/issues/:issueId/dismiss`.
- The only browser mutation prototypes are DataHealth dismiss and History data-flag.
- The History data-flag prototype sends only `{ dataFlag }` to the current server handler.
- Mutation metadata remains local diagnostic context: session id, target dataFlag, mutationId, idempotencyKey, request fingerprint, source fingerprint, confirmation state, and request timing.
- Success requires HTTP success, `result.ok === true`, `result.changed === true`, `result.status === "success"`, and snapshot metadata.
- Missing snapshot metadata, no-change, not-found, invalid dataFlag, unavailable, timeout, abort, malformed response, write failure, transaction failure, database closed, unsupported route, and missing source fingerprint remain failure states.
- localStorage remains source of truth.
- API results never overwrite AppData or localStorage.
- No session mutation, history edit, DataHealth repair, backup/import/export/reset/recovery route, broad mutation client, production backend, auth, sync, deployment, package dependency, package script, lockfile change, normalized table, source-of-truth switch, localStorage replacement, or training algorithm change is added.
- Write-path migration remains blocked.

## Task 4.37 Acceptance Result

- Task 4.37 adds acceptance tests and `docs/HISTORY_DATA_FLAG_PROTOTYPE_ACCEPTANCE.md` for the existing History data-flag prototype.
- This is an acceptance/testing layer only and does not add mutation capability.
- Browser mutation routes remain exactly `POST /data-health/issues/:issueId/dismiss` and `POST /history/:id/data-flag`.
- Flag matrix, target record, confirmation, pending/duplicate-submit, strict success, failure/no-fake-success, localStorage integrity, dataFlag semantics, route boundary, and manual runbook parity are covered.
- `normal`, `test`, and `excluded` semantics remain locked: test and excluded records stay visible but excluded from default production-like statistics.
- localStorage remains source of truth and API results never overwrite AppData or localStorage.
- No session mutation, history edit, DataHealth repair, backup/import/export/reset/recovery route, broad mutation client, production backend, auth, sync, deployment, package dependency, package script, lockfile change, normalized table, or training algorithm change is added.
- Write-path migration remains blocked.
- The next recommended task is `Task 4.38 History Data-flag Manual App Acceptance V1` or `Task 4.38 History Data-flag Prototype Hardening V1`.

## Task 4.38 Manual App Acceptance Result

- Task 4.38 adds `docs/HISTORY_DATA_FLAG_MANUAL_APP_ACCEPTANCE.md` as the human manual App acceptance runbook for the existing History data-flag prototype.
- This is manual acceptance documentation and docs/static tests only.
- No new mutation route is added.
- Browser mutation routes remain exactly `POST /data-health/issues/:issueId/dismiss` and `POST /history/:id/data-flag`.
- localStorage remains source of truth and API results never overwrite AppData or localStorage.
- No session mutation, history edit, DataHealth repair, backup/import/export/reset/recovery route, broad mutation client, production backend, auth, sync, deployment, package dependency, package script, lockfile change, normalized table, or training algorithm change is added.
- Write-path migration remains blocked.

## Task 4.39 Hardening Result

- Task 4.39 hardens the existing History data-flag prototype and does not add runtime capability beyond the existing route.
- Browser mutation routes remain exactly `POST /data-health/issues/:issueId/dismiss` and `POST /history/:id/data-flag`.
- History data-flag success remains strict: HTTP success, `result.ok === true`, `result.changed === true`, `result.status === "success"`, and snapshot metadata are required.
- no_change, record_not_found, invalid dataFlag, requiresConfirmation, unsupported_route, missing snapshot metadata, unavailable, timeout, abort, malformed response, write_failed, transaction_failed, database_closed, snapshot_validation_failed, and repository_schema_mismatch remain failure states.
- Confirmation reset, duplicate-submit prevention, abort/unmount guard, and local-only rollback behavior remain locked.
- `normal`, `test`, and `excluded` semantics remain locked: test and excluded records stay visible but excluded from default production-like statistics.
- localStorage remains source of truth and API results never overwrite AppData or localStorage.
- No session mutation, history edit, DataHealth repair, backup/import/export/reset/recovery route, broad mutation client, production backend, auth, sync, deployment, package dependency, package script, lockfile change, normalized table, source-of-truth switch, localStorage replacement, or training algorithm change is added.
- Write-path migration remains blocked.

## Task 4.40 Checkpoint Result

- Task 4.40 adds `docs/WRITE_PATH_TWO_ROUTE_CHECKPOINT.md` as a checkpoint/audit for the current two-route write-path prototype state.
- Browser mutation routes remain exactly `POST /data-health/issues/:issueId/dismiss` and `POST /history/:id/data-flag`.
- No third mutation route is approved.
- localStorage remains source of truth and API results never overwrite AppData or localStorage.
- DataHealth dismiss and History data-flag remain dev-only, explicit opt-in, single-route prototypes in their own flows.
- No session mutation, history edit, DataHealth repair, backup/import/export/reset/recovery route, broad mutation client, production backend, auth, sync, deployment, package dependency, package script, lockfile change, normalized table, source-of-truth switch, localStorage replacement, or training algorithm change is added.
- The next recommended task is `Task 4.41 Write-path Two-route Manual Regression V1`.

## Scope / Non-goals

- This is History data-flag mutation prototype planning.
- This is not implementation.
- This does not add `POST /history/:id/data-flag` to the App.
- This does not add browser mutation client.
- This does not add mutation feature flag runtime wiring.
- This does not modify App.tsx.
- This does not replace localStorage.
- This does not switch source of truth.
- This does not add offline queue.
- This does not add production backend, auth, sync, or deployment.
- This does not add dependency or script.
- There are no UI writes to API.
- There is no frontend mutation client.
- There are no normalized tables.
- Write-path migration remains blocked.

## Current Baseline

- DataHealth dismiss is the only implemented browser mutation prototype.
- DataHealth dismiss is dev-only, explicit opt-in, accepted, manually accepted, hardened, observable, and regression-locked.
- localStorage remains source of truth.
- API results never overwrite AppData or localStorage.
- Read-only diagnostics remain the only broad App integration mode.
- Browser runtime does not call history, session, DataHealth repair, backup, import, export, reset, or recovery routes.
- Node/dev API mutation route `POST /history/:id/data-flag` exists server-side, but is not approved for browser runtime.
- Existing App record controls may still update localStorage through the current local history engine; Task 4.35 does not change that behavior and does not add HTTP writes.

## Data-flag Semantics

DataFlag values:

- `normal`: record participates in normal statistics.
- `test`: record remains visible but is excluded from default production-like statistics.
- `excluded`: record remains visible but is excluded from default production-like statistics.

DataFlag can affect summaries and trust semantics because it controls whether a training record participates in default analytics paths.

DataFlag is more risky than DataHealth dismiss because it affects whether a real training record participates in stats. DataHealth dismiss only marks a diagnostic issue as dismissed.

DataFlag is less risky than history edit because it does not directly edit set logs, reps, weight, exercise identity, or active session state.

## Data Semantics Impact Analysis

Future history data-flag prototype planning must account for these surfaces:

- History list: filter counts, visible flag labels, and normal/test/excluded grouping can change.
- History detail: excluded-from-stats messaging and session summary labels can change.
- Calendar summaries: day badges and session inclusion labels can change.
- Session summaries: analytics-included counts and latest-session context can change.
- readMirror output: `analyticsSessionCount`, `byDataFlag`, list item `dataFlag`, and `excludedFromStats` can change.
- DataHealth report: issue context and trust warnings can change when a record leaves or re-enters default analytics.
- PR / e1RM: test/excluded records must remain excluded from default PR and e1RM calculations.
- effectiveSet / weighted effectiveSet: test/excluded records must remain excluded from default effective-set calculations.
- audit trail / editHistory: dataFlag changes must remain visible as data status edits.
- backup export/import semantic safety: exported and imported data must preserve dataFlag and editHistory semantics.

Locked semantics:

- test/excluded default-stat exclusion must remain locked.
- identityInvalid semantics must remain unchanged.
- actualWeightKg remains the trusted calculation source.
- No training algorithm changes are allowed.
- No training template, scheduler, PR, e1RM, effectiveSet, or backup import/export safety behavior changes are allowed.

## Candidate Route Plan

Future route:

- `POST /history/:id/data-flag`

Future payload should be planned only, not implemented in Task 4.35.

Future request should include:

- record/session id
- target dataFlag: `normal | test | excluded`
- `mutationId`
- `idempotencyKey`
- `requestFingerprint`
- `sourceSnapshotHash` or `sourceSnapshotVersion`
- `confirmed: true`
- optional `reason` developer/user note if safe
- optional `nowIso` for tests if the existing server handler supports it

Task 4.35 does not add this browser request.

Future server contract must not be broken.

If the existing server handler does not accept metadata, a future frontend prototype may track metadata locally in diagnostic/pending state and send only the current server-compatible body shape.

## Confirmation UX Plan

Changing dataFlag requires explicit confirmation before any future POST.

Required confirmation cases:

- `normal` -> `test`: warn that the record stays visible but leaves default production-like statistics.
- `normal` -> `excluded`: warn that the record stays visible but leaves PR, e1RM, effective-set, and default statistics.
- `test` -> `normal`: warn that the record may re-enter default statistics and affect summaries.
- `excluded` -> `normal`: warn that the record may re-enter PR, e1RM, effective-set, and default statistics.
- `test` -> `excluded`: warn that the record remains out of default statistics and receives stronger exclusion semantics.
- `excluded` -> `test`: warn that the record remains out of default statistics but changes review meaning.

Confirmation UI must include:

- user-facing warning
- clear label for current and target state
- explanation that statistics may change
- cancel behavior that sends no request and preserves localStorage/AppData
- confirmation required before POST
- no silent mutation
- no auto-dismiss
- no repair, sync, overwrite, import, export, reset, apply, fix, or migrate wording

## Pending / Success / Failure UX Plan

Pending state:

- pending disables repeated submit
- pending shows visible state with target record and target dataFlag
- no optimistic success
- no automatic retry
- no localStorage/AppData overwrite

Success state:

- success only after strict server success and snapshot metadata
- success requires HTTP success, mutation success, changed result, success status, and snapshot metadata
- success does not overwrite localStorage
- success does not replace AppData
- success prompts manual re-check/comparison after success
- localStorage remains source of truth

Failure state:

- failure states are visible
- no fake success
- no raw stack or raw response dump
- no API response overwrites AppData/localStorage

Failure states must include:

- unavailable
- timeout
- malformed response
- record not found
- invalid dataFlag
- no_change
- source snapshot mismatch
- write_failed
- transaction_failed
- database_closed
- unsupported_route
- missing snapshot metadata

## Idempotency / Duplicate-submit Plan

Future prototype must require:

- `mutationId`
- `idempotencyKey`
- `requestFingerprint`
- target record id
- target dataFlag
- source snapshot hash/version
- pending lock
- duplicate submit disabled
- no repeated writes
- no double audit trail event

## Conflict / Source Snapshot Plan

Future prototype must:

- compare local source snapshot hash/version before mutation
- reject or block mutation on mismatch
- show conflict diagnostics
- not auto-merge
- not overwrite localStorage
- not overwrite API snapshot into AppData
- not repair automatically

## Rollback Plan

- If there is no optimistic local write, rollback is failure state only.
- localStorage remains usable.
- Disable mutation flag to rollback feature.
- Stop dev API runner.
- Backup dev DB before experiments.
- Backup localStorage before experiments if a future implementation touches UI state.
- Use the recovery/reset runbook for dev DB only if needed.
- No production rollback is needed.
- No auth/sync rollback is needed.

## Audit Trail / Visibility Plan

Future mutation must:

- preserve existing audit trail semantics
- make the dataFlag change visible to the user/developer
- show original flag and new flag in audit context
- avoid hidden flag changes
- prove readMirror parity after mutation
- preserve audit semantics through backup export/import

## Manual Acceptance Plan

Future Task 4.36 or Task 4.37 manual runbook must cover:

- flag off no mutation UI
- flag on one route only
- confirm dataFlag change
- cancel dataFlag change
- duplicate-submit blocked
- no_change failure
- record not found failure
- invalid dataFlag failure
- write failure no fake success
- readMirror after mutation
- test/excluded stats behavior
- localStorage unchanged unless explicitly designed
- browser Network shows only `POST /history/:id/data-flag`
- no session POSTs
- no history edit POST
- no DataHealth repair POST
- no backup/import/export/reset/recovery POSTs

## Explicitly Rejected Scope

- no `POST /history/:id/edit`
- no `POST /sessions/*`
- no `POST /data-health/repair/apply`
- no backup/import/export over HTTP
- no reset/recovery over HTTP
- no source-of-truth migration
- no dual-write
- no production backend
- no auth, sync, or deployment
- no broad mutation client
- no localStorage/AppData overwrite

## Task 4.36 Recommendation

Unique recommendation:

`Task 4.36 History Data-flag Mutation Prototype V1`

This recommendation applies only if:

- Task 4.35 acceptance passes
- prototype remains dev-only
- explicit opt-in is required
- one route only
- no localStorage overwrite
- no source-of-truth switch
- no session route
- no history edit route
- no DataHealth repair route
- no backup/reset route
- no broad mutation client

If any required gate is unresolved, Task 4.36 should instead be `Task 4.36 History Data-flag Prototype Blocker Resolution V1`.

## Decision Record

- Date: 2026-05-10
- Branch / commit: `codex/task4.35-history-data-flag-mutation-prototype-plan` / record after commit
- Decision: Create a future prototype plan for history data-flag without implementing it.
- Recommended prototype route: `POST /history/:id/data-flag`.
- Rejected routes: `POST /history/:id/edit`, `POST /sessions/*`, `POST /data-health/repair/apply`, backup/import/export over HTTP, reset/recovery over HTTP, and source-of-truth migration.
- Required gates: dev-only explicit opt-in, single-route boundary, confirmation UX, idempotency, duplicate-submit prevention, source snapshot, conflict diagnostics, no-fake-success, audit trail visibility, readMirror parity, manual acceptance, backup guidance, and browser build isolation.
- Next task: `Task 4.36 History Data-flag Mutation Prototype V1` only if gates are accepted.
- Risks: accidental stats change, stale source snapshot, duplicate write, audit gap, false success, localStorage/API divergence, route-surface expansion, and user confusion.
- Rollback requirement: keep localStorage authoritative, avoid optimistic local writes unless separately designed, show failure instead of success on write failure, preserve prior flag in audit context, disable mutation flag, stop dev API runner, and recover/reset dev DB only if needed.

## Final Recommendation

Task 4.35 result: Plan only.

Task 4.36 result: Implemented only as a dev-only single-route prototype.

Task 4.37 result: Accepted with automated and manual acceptance coverage only.

Task 4.38 result: Manual App acceptance documentation only.

Implemented route: POST /history/:id/data-flag.

DataHealth dismiss and History data-flag are the only implemented browser mutation prototypes.

localStorage remains source of truth.

Write-path migration remains blocked.

Next task should be Task 4.37 History Data-flag Prototype Acceptance V1.
