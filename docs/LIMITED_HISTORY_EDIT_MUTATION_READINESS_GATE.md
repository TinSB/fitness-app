# Limited History Edit Mutation Readiness Gate

Task 4.45 evaluates whether the Task 4.44 limited history edit mutation prototype plan is ready to become a separate future implementation task.

## Scope / Non-goals

- This is a limited history edit readiness gate.
- This is not implementation.
- This does not implement `POST /history/:id/edit`.
- This does not add `POST /history/:id/edit` to the App.
- This does not add a third browser mutation route.
- This does not expand the current browser mutation allowlist.
- This does not modify App.tsx.
- This does not modify src/devApi runtime behavior.
- This does not add a frontend mutation client.
- This does not add App.tsx mutation integration.
- This does not add UI writes to API.
- This does not replace localStorage.
- This does not switch source of truth.
- This does not add an offline mutation queue.
- This does not add production backend, auth, sync, or deployment.
- This does not add a dependency, lockfile change, or package script.
- This does not add normalized tables.
- This does not change training algorithms, templates, scheduler, PR, e1RM, effectiveSet, weighted effectiveSet, or backup import/export safety behavior.
- Write-path migration remains limited to the two accepted dev-only prototypes.

## Current Baseline

- DataHealth dismiss remains implemented and locked as `POST /data-health/issues/:issueId/dismiss`.
- History data-flag remains implemented and locked as `POST /history/:id/data-flag`.
- Limited history edit is plan-only from Task 4.44.
- Browser mutation routes remain exactly:
  - `POST /data-health/issues/:issueId/dismiss`
  - `POST /history/:id/data-flag`
- localStorage remains source of truth.
- API results never overwrite AppData or localStorage.
- Read-only Dev API client remains GET-only.
- No session mutation route is exposed from browser code.
- No history edit route is exposed from browser code.
- No DataHealth repair route is exposed from browser code.
- No backup, import, export, reset, recovery, repair, sync, overwrite, apply, or source-of-truth migration route is exposed from browser code.

## Gate Summary

Readiness decision categories:

| Category | Meaning |
| --- | --- |
| Ready for implementation task | The next task may implement the candidate directly from current docs, with exact files and validation already defined. |
| Ready with blockers | The candidate is coherent enough for a separate user-approved implementation prompt, but implementation must not start until the prompt names files, gates, validation, rollback, and manual acceptance. |
| Not ready | The candidate lacks enough constraints or safety semantics to create an implementation prompt. |

Task 4.45 result: Ready with blockers, not direct implementation.

Task 4.45 result: Ready for a user-approved implementation prompt, but not direct implementation.

Reason: the Task 4.44 plan exists and its field boundaries are sufficient for a future single-route plan, but implementation still needs explicit user approval and a final implementation prompt with exact files, route allowlist update, validation, rollback, and acceptance gates.

## Field Constraint Gate

Task 4.44 allowed fields are precise enough for a future single-route implementation plan.

Allowed future fields:

| Field | Gate decision |
| --- | --- |
| `exerciseId` locator | Sufficient as a locator only; it must match an existing exercise and must not replace exercise identity. |
| `setId` locator | Sufficient as a locator only; it must match an existing set id or set index and must not replace set identity or structure. |
| `patch.weightKg` | Sufficient only if treated as actualWeightKg-derived load and validated as finite non-negative load. |
| `patch.displayWeight` | Sufficient only as display-only data; it must not become the trusted calculation source. |
| `patch.displayUnit` | Sufficient only as display-only `kg` or `lb`; it must not change trusted load semantics. |
| `patch.reps` | Sufficient only as a finite non-negative integer. |
| `patch.rir` | Sufficient only when validation keeps it non-negative or blank and rejects raw objects. |
| `patch.techniqueQuality` | Sufficient only as `good`, `acceptable`, or `poor`. |
| `patch.painFlag` | Sufficient only as boolean safety context. |
| `patch.note` | Sufficient only as capped or validated string context with no calculation impact. |

Rejected fields and operations remain rejected:

| Rejected scope | Gate decision |
| --- | --- |
| `dataFlag` | Rejected; use existing `POST /history/:id/data-flag`, not the edit route. |
| Session identity fields | Rejected; no edit to `id`, `date`, `templateId`, `templateName`, `programTemplateId`, or `programTemplateName`. |
| Session state fields | Rejected; no edit to `trainingMode`, `focus`, `status`, `startedAt`, `finishedAt`, `completed`, or `durationMin`. |
| Exercise identity fields | Rejected; no patch to `exerciseId`, `actualExerciseId`, `originalExerciseId`, `replacementExerciseId`, `legacyActualExerciseId`, or identity review fields. |
| Set identity/structure fields | Rejected; no patch to set `id`, `setIndex`, `type`, `warmupType`, `done`, `completedAt`, `completionStatus`, or `incompleteReason`. |
| Add/remove/reorder operations | Rejected; no adding, removing, replacing, or reordering exercises, sets, warmups, support logs, or blocks. |
| Active session state | Rejected; no mutation of `activeSession`, Focus state, current step, current set, or unsaved training draft state. |
| Direct audit writes | Rejected; no direct edit to `editedAt`, `editHistory`, `affectedStats`, before/after summaries, or audit ids. |
| Derived summaries | Rejected; no client-supplied PR, e1RM, effectiveSet, weighted effectiveSet, calendar, history, or summary totals. |
| AppData replacement | Rejected; no raw AppData, history array, localStorage snapshot, or API snapshot replacement. |
| Non-training data | Rejected; no edits to body weights, health data, user profile, screening profile, settings, templates, backups, imports, exports, reset, or recovery state. |

Decision: field constraints are sufficient for a future single-route implementation plan, and broad history edit remains rejected.

## Server Contract Gate

Existing server-side route readiness:

- `POST /history/:id/edit` exists server-side only in the Node/dev API mutation skeleton.
- Browser runtime must not call `POST /history/:id/edit` yet.
- The existing server handler body shape must be inspected again before future implementation.
- Current inspected handler shape accepts route session id plus body fields compatible with `exerciseId`, `setId`, `patch`, and optional `reason`.
- Future client may send only server-compatible payload.
- Metadata may need to stay frontend-local if server contract does not accept it.
- No server contract changes are allowed in Task 4.45.
- No server handler changes are allowed in Task 4.45.
- No serverAdapter changes are allowed in Task 4.45.
- No httpRuntimeAdapter changes are allowed in Task 4.45.
- No sqliteRepository changes are allowed in Task 4.45.

Future implementation will need one of these explicit choices:

| Contract option | Gate decision |
| --- | --- |
| server contract extension | Requires explicit user approval in Task 4.46 and must not be assumed. |
| frontend-only metadata | Preferred if source snapshot, idempotency, request fingerprint, and audit display can be satisfied without changing server handlers. |
| adapter-side no-change | Acceptable only if the future browser client sends the current server-compatible payload and keeps unsupported metadata local. |

Task 4.45 does not choose an implementation path. It records that server route/handler readiness is good enough for a future prompt only after the final body contract is re-inspected.

## Source Snapshot / Conflict Gate

A future request or local diagnostic state must include:

- `sourceSnapshotHash` or `sourceSnapshotVersion`
- `requestFingerprint`
- `mutationId`
- `idempotencyKey`
- target session id
- target exercise id
- target set id
- constrained patch
- `confirmed: true`

Conflict rules:

- No mutation if source fingerprint is missing.
- No mutation if `sourceSnapshotHash` or `sourceSnapshotVersion` is missing.
- No mutation on source mismatch.
- No mutation if target session id, target exercise id, or target set id is missing.
- No auto-merge.
- No localStorage overwrite.
- No AppData overwrite.
- Conflict diagnostics must show the target session, target exercise, target set, expected snapshot metadata, current snapshot metadata if available, and a visible failure state.
- Conflict diagnostics must not expose raw AppData, localStorage dumps, SQLite internals, stack traces, or environment dumps.

## No-fake-success Gate

Future success is allowed only when all of these are true:

- HTTP success.
- `result.ok === true`.
- `result.changed === true`.
- `result.status === "success"`.
- Snapshot metadata exists.

Future failure is required for:

- missing snapshot metadata
- `ok=false`
- `changed=false`
- `no_change`
- `record_not_found`
- `exercise_not_found`
- `set_not_found`
- invalid patch
- validation failure
- source mismatch
- `write_failed`
- `transaction_failed`
- `database_closed`
- `unsupported_route`
- malformed response
- timeout, unavailable, or abort

Failure must remain visible and must not be converted to a success toast, local preview commit, localStorage write, AppData replacement, repair prompt, sync prompt, import/export prompt, reset prompt, or recovery prompt.

## Calculation Impact Gate

The future implementation prompt must document the effect of every allowed edit on:

- volume
- PR
- e1RM
- effectiveSet
- weighted effectiveSet
- history summaries
- calendar summaries
- session detail summaries
- DataHealth warnings
- readMirror history list/detail
- backup export/import semantics

Calculation rules:

- actualWeightKg remains trusted calculation source.
- `patch.weightKg` must keep actualWeightKg-derived load aligned.
- `displayWeight` and `displayUnit` remain display-only unless paired with `weightKg`.
- `patch.displayWeight` and `patch.displayUnit` must not become trusted calculation inputs by themselves.
- `identityInvalid` semantics are unchanged.
- `test` dataFlag semantics are unchanged.
- `excluded` dataFlag semantics are unchanged.
- No training algorithm changes are allowed.
- No template, scheduler, PR, e1RM, effectiveSet, weighted effectiveSet, or backup import/export rule changes are allowed.

## Audit Trail / Before-after Gate

Future implementation must show:

- target session
- target exercise
- target set
- changed fields
- before values
- after values
- affected stats
- reason
- editedAt
- audit trail entry

Rejected audit behavior:

- direct editHistory patch from browser
- hidden changes
- client-supplied derived summaries
- client-supplied affectedStats
- client-supplied before/after summaries
- audit changes that are not visible in confirmation and success/failure review

The server or existing session edit engine must own audit record creation. Browser code may display audit context, but it must not author trusted audit fields.

## UX / Confirmation Gate

Future UI must require:

- explicit confirmation
- cancel sends no request
- pending state
- duplicate submit block
- no optimistic success
- no automatic retry
- failure visible
- no repair, sync, overwrite, import, export, reset, apply, fix, or recovery controls
- dev-only copy
- localStorage source-of-truth copy
- calculation impact warning

Future UI must not imply production readiness, backend sync, source-of-truth migration, broad edit ability, repair workflow, or automatic reconciliation.

## Manual Acceptance Gate

A future manual runbook must require:

- dedicated test browser profile
- dedicated dev DB
- no real personal training data
- flag off no UI/no POST
- read-only compare only no UI/no POST
- wrong mutation flag no UI/no POST
- future history edit flag one route only
- cancel prevents POST
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
- source mismatch failure
- write failure no fake success
- missing snapshot metadata no fake success
- readMirror parity after mutation
- localStorage unchanged
- DevTools Network only `POST /history/:id/edit`
- no session, repair, backup, reset, import, export, recovery, sync, overwrite, source-of-truth, or production routes
- cleanup and pass/fail reporting

The runbook must also require a final statement that browser mutation routes before Task 4.46 remain exactly the two accepted prototypes.

## Risk Gate

| Risk | Severity | Mitigation | Required gate |
| --- | --- | --- | --- |
| history edit corruption | High | Keep the edit field-constrained to one existing set, require before/after review, and reject broad history edits. | Field Constraint Gate; Audit Trail / Before-after Gate |
| calculation drift | High | Document volume, history, calendar, session detail, readMirror, and backup effects before any implementation. | Calculation Impact Gate |
| PR/e1RM/effectiveSet drift | High | Keep actualWeightKg trusted, keep display fields display-only, and lock PR/e1RM/effectiveSet impact tests. | Calculation Impact Gate |
| audit trail gap | High | Require engine/server-owned audit entries with visible before values, after values, affected stats, reason, and editedAt. | Audit Trail / Before-after Gate |
| broad edit creep | High | Reject session identity, session state, exercise identity, set identity, add/remove/reorder, derived summaries, direct audit writes, AppData replacement, and non-training data. | Field Constraint Gate |
| route expansion | High | Keep browser mutation routes exactly two until a separate explicit Task 4.46 updates one route only. | Server Contract Gate; Manual Acceptance Gate |
| localStorage/source-of-truth divergence | High | Keep localStorage authoritative and forbid API responses from overwriting AppData or localStorage. | Source Snapshot / Conflict Gate |
| duplicate submit | Medium | Require pending state, idempotencyKey, requestFingerprint, mutationId, and disabled duplicate submit. | Source Snapshot / Conflict Gate; UX / Confirmation Gate |
| offline failure | Medium | Require visible timeout/unavailable/abort failure and no automatic retry or optimistic success. | No-fake-success Gate; UX / Confirmation Gate |
| user confusion | Medium | Use dev-only copy, explicit confirmation, calculation impact warning, and localStorage source-of-truth copy. | UX / Confirmation Gate; Manual Acceptance Gate |
| production exposure | High | Keep the future prototype dev-only, explicit opt-in, and absent from production backend/auth/sync/deployment work. | Scope / Non-goals; Manual Acceptance Gate |

## Decision

Task 4.45 result: Ready for a user-approved implementation prompt, but not direct implementation.

Meaning:

- It is acceptable for the user to request Task 4.46 Limited History Edit Mutation Prototype V1.
- Task 4.46 must be a separate, explicit implementation task.
- Task 4.46 must implement only `POST /history/:id/edit`.
- Task 4.46 must be dev-only, explicit opt-in, one-route only.
- Task 4.46 must not add a broad frontend mutation client.
- Task 4.46 must not replace localStorage or switch source of truth.
- Task 4.46 must not let API results overwrite AppData or localStorage.
- Task 4.46 must not add production backend, auth, sync, or deployment.
- Task 4.46 must not be auto-started by Task 4.45.
- Task 4.46 must include exact files, validation, rollback, and acceptance gates.

## Rejected Alternatives

- Implement immediately.
- Broad history edit.
- Session mutation.
- DataHealth repair.
- Backup/import/export/reset/recovery.
- Source-of-truth migration.
- Production backend/auth/sync/deployment.
- Offline mutation queue.
- localStorage replacement.
- Broad mutation client.
- Direct editHistory patch from browser.
- Client-supplied derived summaries.
- AppData or localStorage overwrite from API responses.

## Final Recommendation

Task 4.45 result: Readiness gate only.

No third mutation is implemented.

`POST /history/:id/edit` remains blocked from browser runtime.

Browser mutation routes remain exactly DataHealth dismiss and History data-flag:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`

localStorage remains source of truth.

API results never overwrite AppData or localStorage.

No production backend, auth, sync, or deployment is added.

No dependency, lockfile, or package script is changed.

No normalized tables are added.

Task 4.46 Limited History Edit Mutation Prototype V1 may be created only after explicit user approval.

Task 4.46 requires explicit user approval and must not auto-start.

Do not auto-start Task 4.46.

## Task 4.46 Implementation Note

Explicit user approval was provided for Task 4.46 Limited History Edit Mutation Prototype V1.

Task 4.46 implemented only the approved one-route prototype for `POST /history/:id/edit`.

- It is dev-only and explicit opt-in.
- It does not add broad history edit.
- It does not switch source of truth.
- It does not let API results overwrite AppData or localStorage.
- It does not add session mutation, DataHealth repair, backup/import/export/reset/recovery routes, production backend, auth, sync, deployment, package changes, scripts, lockfile changes, or normalized tables.
- Browser mutation routes are exactly `POST /data-health/issues/:issueId/dismiss`, `POST /history/:id/data-flag`, and `POST /history/:id/edit`.
- Task 4.47 Limited History Edit Prototype Acceptance V1 is the next recommended acceptance-only task.

## Task 4.47 Acceptance Note

Task 4.47 adds acceptance tests and `docs/LIMITED_HISTORY_EDIT_PROTOTYPE_ACCEPTANCE.md` for the existing Task 4.46 prototype.

No new browser mutation route is added. The accepted browser mutation routes remain exactly `POST /data-health/issues/:issueId/dismiss`, `POST /history/:id/data-flag`, and `POST /history/:id/edit`.

Task 4.48 Limited History Edit Manual App Acceptance V1 is the next recommended task.

## Task 4.49 Hardening Note

Task 4.49 hardens the existing Limited History Edit prototype after explicit implementation and acceptance.

No new browser mutation route is added. The accepted browser mutation routes remain exactly `POST /data-health/issues/:issueId/dismiss`, `POST /history/:id/data-flag`, and `POST /history/:id/edit`.

localStorage remains source of truth, API results never overwrite AppData or localStorage, and broader write-path migration remains blocked.

Task 4.50 Limited History Edit Observability & Recovery Notes V1 is the next recommended task.

## Task 4.50 Observability / Recovery Note

Task 4.50 adds safe observability and manual recovery notes for the existing Limited History Edit prototype.

No new browser mutation route is added. The accepted browser mutation routes remain exactly `POST /data-health/issues/:issueId/dismiss`, `POST /history/:id/data-flag`, and `POST /history/:id/edit`.

localStorage remains source of truth, API results never overwrite AppData or localStorage, browser reset/recovery actions remain blocked, and broader write-path migration remains blocked.

Task 4.51 Limited History Edit Regression Lock V1 is the next recommended task.

## Task 4.51 Regression Lock Note

Task 4.51 locks the existing Limited History Edit prototype after implementation, acceptance, manual acceptance, hardening, and observability/recovery notes.

No new browser mutation route is added. The accepted browser mutation routes remain exactly `POST /data-health/issues/:issueId/dismiss`, `POST /history/:id/data-flag`, and `POST /history/:id/edit`.

localStorage remains source of truth, API results never overwrite AppData or localStorage, fourth mutation routes remain blocked, and broader write-path migration remains blocked.

Task 4.52 Write-path Three-route Checkpoint V1 is the next recommended task.
