# Limited History Edit Mutation Prototype Plan

Task 4.44 converts the Task 4.43 third mutation candidate readiness audit into a planning-only future prototype plan for limited history edit.

## Scope / Non-goals

- This is Limited History Edit Mutation Prototype Plan V1.
- This is planning-only.
- This is not implementation.
- This does not implement `POST /history/:id/edit`.
- This does not add `POST /history/:id/edit` to the App.
- This does not add a third browser mutation route.
- This does not expand the current browser mutation allowlist.
- This does not modify App.tsx.
- This does not modify src/devApi runtime behavior.
- This does not add a frontend mutation client.
- This does not add mutation feature flag runtime wiring.
- This does not replace localStorage.
- This does not switch source of truth.
- This does not add an offline mutation queue.
- This does not add production backend, auth, sync, or deployment.
- This does not add a dependency, lockfile change, or package script.
- This does not add normalized tables.
- This does not change training algorithms, templates, scheduler, PR, e1RM, effectiveSet, or backup import/export safety behavior.
- There are no UI writes to API.
- Write-path migration remains blocked beyond the existing two dev-only prototypes.

## Current Two-route Baseline

- DataHealth dismiss remains the first accepted dev-only browser mutation prototype: `POST /data-health/issues/:issueId/dismiss`.
- History data-flag remains the second accepted dev-only browser mutation prototype: `POST /history/:id/data-flag`.
- Browser mutation routes remain exactly:
  - `POST /data-health/issues/:issueId/dismiss`
  - `POST /history/:id/data-flag`
- No third browser mutation route is accepted.
- localStorage remains source of truth.
- API results never overwrite AppData or localStorage.
- Read-only diagnostics remain GET-only.
- No session mutation, DataHealth repair, backup/import/export/reset/recovery route, source-of-truth migration, broad mutation client, offline mutation queue, production backend, auth, sync, deployment, dependency, script, lockfile, normalized table, or training algorithm change is added.

## Future Candidate Route Boundary

Future candidate route:

- `POST /history/:id/edit`

Task 4.44 does not add this browser request.

The route may be considered only in a separate future implementation task after all gates in this plan pass. The future route must remain a single-route, dev-only, explicit opt-in prototype. It must not become a broad mutation client, source-of-truth switch, localStorage replacement, production backend, auth, sync, deployment, or offline mutation queue.

## Field-Level Constraints

The future candidate is limited to editing one existing set within one existing history session. The route path id is only a target session locator. `exerciseId` and `setId` are only locators for the existing set to patch.

Allowed future fields:

| Field | Role | Constraint | Calculation impact |
| --- | --- | --- | --- |
| `exerciseId` | target locator | Required string; must match an existing exercise identity in the target history session; cannot replace exercise identity. | None by itself. |
| `setId` | target locator | Required string; must match an existing set id or set index in the target exercise; cannot replace set identity. | None by itself. |
| `patch.weightKg` | set load edit | Finite number, minimum 0; future implementation must treat it as the actual load source and keep `actualWeightKg` aligned. | Can affect volume, PR, e1RM, effectiveSet, weighted effectiveSet, summaries, calendar, history, and readMirror output. |
| `patch.displayWeight` | display-only weight edit | Finite number, minimum 0; must remain display-only and must not become the trusted calculation source. | None unless paired with `patch.weightKg`; actualWeightKg remains trusted. |
| `patch.displayUnit` | display-only unit edit | Must be `kg` or `lb`; must remain display-only. | None unless paired with `patch.weightKg`; actualWeightKg remains trusted. |
| `patch.reps` | set reps edit | Finite integer, minimum 0; future implementation must round or reject non-integer input consistently. | Can affect volume, PR, e1RM, effectiveSet, weighted effectiveSet, summaries, calendar, history, and readMirror output. |
| `patch.rir` | effort edit | Number or string accepted only if validation keeps it non-negative or blank; no raw object values. | Can affect effectiveSet quality, effort summaries, and coaching interpretation. |
| `patch.techniqueQuality` | quality edit | Must be `good`, `acceptable`, or `poor`. | Can affect PR trust, effectiveSet quality, DataHealth context, and coaching interpretation. |
| `patch.painFlag` | pain safety edit | Must be boolean. | Can affect PR trust, effectiveSet quality, DataHealth context, and coaching interpretation. |
| `patch.note` | set note edit | String only; future implementation must cap or validate display length before showing it. | No calculation impact, but audit trail and user trust impact. |

Rejected fields and operations:

| Field or operation | Status | Reason |
| --- | --- | --- |
| `dataFlag` | Rejected | Use existing `POST /history/:id/data-flag`; do not combine data status and set edit. |
| Session identity fields | Rejected | No edit to `id`, `date`, `templateId`, `templateName`, `programTemplateId`, or `programTemplateName`. |
| Session state fields | Rejected | No edit to `trainingMode`, `focus`, `status`, `startedAt`, `finishedAt`, `completed`, or `durationMin`. |
| Exercise identity fields | Rejected | No patch to `exerciseId`, `actualExerciseId`, `originalExerciseId`, `replacementExerciseId`, `legacyActualExerciseId`, or identity review fields. |
| Set identity and structure fields | Rejected | No patch to set `id`, `setIndex`, `type`, `warmupType`, `done`, `completedAt`, `completionStatus`, or `incompleteReason`. |
| Add/remove/reorder operations | Rejected | No adding, removing, replacing, or reordering exercises, sets, warmups, support logs, or blocks. |
| Active session state | Rejected | No mutation of `activeSession`, Focus state, current step, current set, or unsaved training draft state. |
| Direct audit writes | Rejected | No direct edit to `editedAt`, `editHistory`, `affectedStats`, before/after summaries, or audit ids. |
| Derived summaries | Rejected | No client-supplied PR, e1RM, effectiveSet, weighted effectiveSet, calendar, history, or summary totals. |
| AppData replacement | Rejected | No raw AppData, history array, localStorage snapshot, or API snapshot replacement. |
| Non-training data | Rejected | No edits to body weights, health data, user profile, screening profile, settings, templates, backups, imports, exports, reset, or recovery state. |

## Rejected Broad History Edit

Broad history edit remains rejected.

- No whole-session JSON patch.
- No arbitrary field path patch.
- No array replacement.
- No nested object merge.
- No add/remove/reorder of exercises or sets.
- No edit to active session state.
- No edit to dataFlag through the history edit route.
- No edit to audit records directly.
- No edit to derived summaries.
- No API response overwrite of AppData or localStorage.

## Data Semantics and Calculation Impact

Limited history edit can change calculation inputs and trust labels.

- `patch.weightKg` must be treated as actualWeightKg-derived load and can change volume, PR, e1RM, effectiveSet, weighted effectiveSet, summaries, calendar, history, and readMirror output.
- `patch.reps` can change volume, PR, e1RM, effectiveSet, weighted effectiveSet, summaries, calendar, history, and readMirror output.
- `patch.rir` can change effort interpretation and effective-set quality.
- `patch.techniqueQuality` can change PR trust, effective-set quality, and DataHealth warnings.
- `patch.painFlag` can change PR trust, effective-set quality, and safety warnings.
- `patch.displayWeight` and `patch.displayUnit` are display-only; actualWeightKg remains the trusted calculation source.
- `patch.note` is audit/user-context only and must not change calculations.
- `identityInvalid` semantics remain unchanged.
- `test` and `excluded` dataFlag semantics remain unchanged.
- Training algorithms, templates, scheduler, PR, e1RM, effectiveSet, weighted effectiveSet, and backup import/export rules are not changed by Task 4.44.

## ReadMirror and History Surface Impact

A future limited history edit prototype must prove before implementation that these surfaces remain explainable and consistent:

- History list summary
- History detail before/after rows
- Calendar session summary
- Session detail summary
- DataHealth warnings
- PR and e1RM displays
- Effective set and weighted effective set summaries
- readMirror history list item
- readMirror history detail
- readMirror data health summary
- Backup export/import round trip
- Edit history display

## Request Metadata Plan

A future prototype request should include or locally track:

- target session id from the route
- `exerciseId`
- `setId`
- constrained `patch`
- `mutationId`
- `idempotencyKey`
- `requestFingerprint`
- `sourceSnapshotHash` or `sourceSnapshotVersion`
- `confirmed: true`
- optional user/developer `reason`
- optional test-only `nowIso` if the existing server handler supports it

If the existing server handler accepts only the current body shape, a future frontend prototype may keep metadata in local diagnostic state while sending only the server-compatible fields. That fallback must still satisfy duplicate-submit, source snapshot, no-fake-success, and audit visibility gates.

## Confirmation UX Plan

Future UI must require explicit confirmation before any POST.

The confirmation must show:

- target session date and title
- target exercise name
- target set label
- before values
- after values
- changed fields
- calculation impact summary
- PR/e1RM/effectiveSet impact warning when load, reps, RIR, technique quality, or pain flag changes
- statement that localStorage remains source of truth
- statement that the API result will not overwrite AppData or localStorage
- cancel action that sends no request
- confirm action that is disabled until the before/after review is visible

The confirmation must not use repair, sync, overwrite, import, export, reset, recovery, apply-all, migrate, or source-of-truth wording.

## Pending / Success / Failure UX Plan

Pending state:

- disables duplicate submit
- shows target session, exercise, set, and changed fields
- does not optimistically update localStorage
- does not replace AppData
- does not retry automatically

Success state:

- requires HTTP success
- requires mutation result success
- requires changed result
- requires success status
- requires snapshot metadata
- shows safe success with snapshot metadata summary
- does not overwrite localStorage
- does not overwrite AppData
- instructs manual compare/reload only in a future manual runbook

Failure state:

- no fake success
- no raw stack
- no raw API response dump
- no AppData dump
- no localStorage dump
- no SQLite internals
- no environment dump
- cancel/retry remain explicit user actions

Failure states must include:

- unavailable
- timeout
- abort
- malformed response
- record_not_found
- set_not_found
- invalid patch
- validation failed
- no_change
- source snapshot mismatch
- missing snapshot metadata
- write_failed
- transaction_failed
- database_closed
- unsupported_route

## Audit Trail Before/After Plan

A future prototype must preserve and display audit context.

Required audit visibility:

- before summary
- after summary
- changed fields
- affected stats
- editedAt
- reason
- target session id
- target exercise id
- target set id
- no direct editHistory patching from browser code

The before/after display must make calculation-affecting changes visible before confirmation and after success. It must not hide changes to load, reps, RIR, technique quality, pain flag, or note.

## Rollback Plan

Task 4.44 does not implement local or API writes, so rollback is reverting the Task 4.44 docs/static-test commit.

Future prototype rollback must include:

- disable the future mutation experiment flag
- stop the dev API runner
- keep localStorage authoritative
- avoid optimistic local writes unless separately designed and tested
- preserve the prior values in before/after audit context
- show failure instead of success on any write failure
- keep dev DB backup guidance
- keep localStorage backup guidance for manual tests
- avoid production rollback, auth rollback, sync rollback, and deployment rollback because none are added

## Manual Acceptance Plan

A future manual acceptance runbook must cover:

- dedicated test browser profile
- dedicated dev DB file
- no real personal training data
- flags off: no history edit UI and no POST
- read-only compare only: no history edit UI and no POST
- wrong mutation experiment flag: no history edit UI and no POST
- future history edit flag: one route only after confirmation
- cancel sends no request
- duplicate submit blocked
- load edit success path
- reps edit success path
- RIR edit success path
- technique quality edit success path
- pain flag edit success path
- note edit success path
- no_change failure
- not-found failure
- invalid patch failure
- validation failed failure
- source snapshot mismatch failure
- write failure no fake success
- missing snapshot metadata no fake success
- readMirror parity after mutation
- localStorage unchanged unless a later task explicitly designs local preview state
- DevTools Network shows only `POST /history/:id/edit`
- DevTools Network does not show session, repair, backup, import, export, reset, recovery, or source-of-truth migration routes
- cleanup and pass/fail reporting

## Route Boundary and Source-of-truth Gates

Before any future prototype:

- two-route regression lock remains green
- Task 4.43 audit remains green
- Task 4.44 plan tests remain green
- browser mutation allowlist remains exactly two routes until the explicit future implementation task
- read-only client remains GET-only
- localStorage remains source of truth
- API results never overwrite AppData
- API results never overwrite localStorage
- no broad mutation client exists
- no session mutation route exists in browser runtime
- no DataHealth repair route exists in browser runtime
- no backup/import/export/reset/recovery route exists in browser runtime
- no source-of-truth switch exists
- browser build remains clean
- dist scan remains free of blocked Node/runtime tokens

## Prototype Gate Checklist

A future implementation task is blocked until all of these are explicitly true:

- Allowed fields are locked to the field-level constraints in this plan.
- Rejected broad edit fields remain rejected.
- PR/e1RM/effectiveSet impact is documented.
- readMirror parity test scope is documented.
- before/after confirmation UX is documented.
- audit trail display is documented.
- rollback UX is documented.
- no-fake-success states are documented.
- manual acceptance runbook is written.
- browser route allowlist update is explicitly approved for only `POST /history/:id/edit`.
- no session, repair, backup, reset, recovery, source-of-truth, production backend, auth, sync, deployment, dependency, script, lockfile, normalized table, or broad client work is bundled.

## Decision Record

- Date: 2026-05-10
- Branch / commit: `codex/task4.44-limited-history-edit-mutation-prototype-plan` / pending until commit
- Decision: Create a planning-only limited history edit prototype plan without implementing the route.
- Future candidate route: `POST /history/:id/edit`.
- Allowed scope: one existing set in one existing history session, constrained to locator fields and the allowed patch fields.
- Rejected scope: broad history edit, whole-session patches, arbitrary JSON paths, dataFlag edits, session mutations, DataHealth repair, backup/import/export/reset/recovery, source-of-truth migration, production backend/auth/sync/deployment, dependencies, package scripts, lockfile changes, normalized tables, and training algorithm changes.
- Required gates: field constraints, rejected-field lock, calculation impact documentation, readMirror parity scope, before/after confirmation, audit trail display, rollback UX, no-fake-success, manual acceptance, exact future route allowlist update, localStorage source-of-truth, and browser build isolation.
- Next task: none automatic. A future implementation task remains blocked until a later user-approved single-route prototype task explicitly defines implementation files, gates, validation, and rollback.
- Risks: history edit corruption, calculation drift, audit gaps, broad edit creep, route expansion, source-of-truth divergence, duplicate submit, offline failure, user confusion, and production exposure.
- Rollback requirement: revert the Task 4.44 docs/static-test commit; no runtime behavior is changed.

## Final Recommendation

Task 4.44 result: Plan only.

No third mutation is implemented.

`POST /history/:id/edit` remains blocked from browser runtime.

Browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`

localStorage remains source of truth.

API results never overwrite AppData or localStorage.

No production backend, auth, sync, or deployment is added.

No dependency, lockfile, or package script is changed.

No normalized tables are added.

Do not implement a third mutation automatically after Task 4.44.

## Task 4.45 Follow-up Note

Task 4.45 adds `docs/LIMITED_HISTORY_EDIT_MUTATION_READINESS_GATE.md` as a readiness gate for this plan.

- Task 4.45 is gate-only and docs/static-test only.
- Task 4.45 does not implement `POST /history/:id/edit`.
- Task 4.45 does not add `POST /history/:id/edit` to the App.
- Task 4.45 does not add a third browser mutation route.
- Task 4.45 does not modify App.tsx.
- Task 4.45 does not modify src/devApi runtime behavior.
- Browser mutation routes remain exactly `POST /data-health/issues/:issueId/dismiss` and `POST /history/:id/data-flag`.
- localStorage remains source of truth and API results never overwrite AppData or localStorage.
- The readiness result is ready for a user-approved implementation prompt, but not direct implementation.
- Task 4.46 Limited History Edit Mutation Prototype V1 requires explicit user approval and must not auto-start.
