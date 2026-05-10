# Mutation UX Confirmation & Rollback Plan

Task 4.26 defines future mutation confirmation, failure, rollback, and no-fake-success UX. It is a UX strategy and decision record only.

## Scope / Non-goals

- This is a mutation UX confirmation / rollback plan.
- This is not mutation integration implementation.
- There is no App.tsx mutation integration.
- There are no UI writes to API.
- There is no frontend mutation client.
- There is no mutation feature flag.
- There is no localStorage replacement.
- There is no source-of-truth switch.
- There is no offline queue implementation.
- There is no production backend.
- There is no auth, sync, or deployment.
- There is no package dependency or package script.
- There are no normalized tables.
- Write-path migration remains blocked.

## Current Baseline

- localStorage remains source of truth.
- Read-only diagnostics are the only approved App integration.
- App does not call mutation routes.
- Dev API mutation routes exist only in the Node/dev API stack.
- Task 4.25 chose staged migration, and mutation remains blocked.
- Existing mutation routes remain server/dev API only and are not approved for App runtime use.

## Mutation UX Principles

- no fake success
- no silent write
- no hidden overwrite
- no automatic repair
- no automatic sync
- no mutation without user-visible state
- no mutation without source snapshot check in a future prototype
- no mutation without rollback state
- no mutation without failure state
- localStorage remains authoritative until future explicit migration

## Confirmation Levels

| Level | Candidate mutations | User prompt style | Required warning | Cancel behavior | Retry behavior | Rollback requirement | Why not implemented yet |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Level 0: No mutation allowed | DataHealth repair; backup import/export over HTTP; reset/recovery over HTTP; source-of-truth migration | No App prompt because the mutation is blocked | State that this category is not available from App runtime | Cancel means no request and no state change | No retry from App runtime | No rollback path is exposed because the App must not start the mutation | Too broad, destructive, or ownership-changing for a first write-path prototype |
| Level 1: Light confirmation candidate | DataHealth issue dismiss; diagnostics acknowledged state, if ever added | Small confirmation with clear target and reversible wording | Explain the change is dev-only and requires current source snapshot match | Cancel closes the prompt and preserves localStorage state | Retry only after visible failure and same source snapshot check | Failure leaves UI unchanged; future rollback state must clear any pending marker | Still needs idempotency, source snapshot check, pending state, and no-fake-success tests |
| Level 2: Explicit confirmation required | history data-flag; limited history edit | Explicit modal or inline review with before/after summary | Explain analytics/history impact and audit trail behavior | Cancel returns to edit/review without POST | Retry only after failure state and explicit review | Restore previous UI state if any local preview was shown | Needs audit trail display, confirmation UX, conflict UX, and rollback UX |
| Level 3: Strong confirmation / high-risk flow | session start; session patches; session complete; session discard | Strong confirmation flow with active-session context and risk language | Warn about active training state, incomplete work, discard/complete consequences, and duplicate-submit risk | Cancel keeps active session/localStorage state unchanged | Retry requires fresh source snapshot check and pending lock reset | Must restore active-session UI state and never double-write history | Active training state is fragile and not a first mutation prototype candidate |

## Pending State UX

- Disable repeated submit while pending.
- Show pending status with the mutation target.
- Preserve user context and entered data.
- Do not create duplicate mutation requests.
- Do not show optimistic success.
- Timeout becomes a visible pending-to-failed state.
- Cancel/discard pending behavior must be explicit and must not assume the server request stopped unless cancellation is confirmed.
- If the browser closes during pending, future strategy is needed before App mutation work starts.

## Success State UX

- Success only after API confirms writeSnapshot success.
- Success must include snapshot metadata if a future prototype exposes it.
- Success must not be shown if repository write fails.
- Success must not overwrite localStorage automatically.
- Success must lead to diagnostics / comparison state, not migration.
- Success must not silently switch source of truth.

## Failure State UX

| Failure state | User-facing message | Retry allowed | Local state changed | Rollback requirement | Diagnostic log requirement |
| --- | --- | --- | --- | --- | --- |
| network unavailable | Dev API is unavailable; App continues using localStorage. | Yes, after API is available and user retries | No | Show failure only | Log normalized unavailable code |
| timeout | Dev API request timed out; no success was saved. | Yes, after user retry | No | Show failure only | Log timeout code and target route |
| snapshot_not_found | Dev API has no source snapshot for this mutation. | Yes, after snapshot is created/reviewed | No | Show failure only | Log snapshot_not_found |
| source snapshot mismatch | Local data and API snapshot differ. Review before trying again. | Only after explicit review | No | Show conflict state | Log mismatch hash/version context without raw data dump |
| validation error | The requested change did not pass validation. | Only after user edits input | No committed change | Restore preview if needed | Log stable validation code/message |
| requiresConfirmation | More confirmation is required before this change can be saved. | Yes, after explicit confirmation | No committed change | Return to confirmation state | Log requiresConfirmation reason |
| no_change | Nothing changed, so no new snapshot was written. | Usually no | No | Clear pending state only | Log no_change reason |
| write_failed | Dev API could not persist the snapshot. No success was saved. | Yes, after user review | No source-of-truth change | Restore preview if needed | Log write_failed |
| transaction_failed | Dev API transaction failed. No success was saved. | Yes, after user review | No source-of-truth change | Restore preview if needed | Log transaction_failed |
| database_closed | Dev API database is closed; App continues using localStorage. | Yes, after runner restart | No | Show failure only | Log database_closed |
| unsupported_route | This write route is not available to App runtime. | No | No | Show blocked state | Log unsupported_route |

## Rollback UX

- If there is no local optimistic update, rollback is showing failure only.
- If a future prototype uses local optimistic UI, rollback must restore previous UI state.
- localStorage backup is required before write experiments.
- Dev DB backup is required before write experiments.
- Failed mutation must not leave UI in success state.
- User must be able to continue using the localStorage App.
- Disable mutation flag is the feature rollback path.
- Stop the Dev API runner when leaving the experiment.
- Use `docs/DEV_API_RECOVERY_RESET.md` for dev DB cleanup.

## Duplicate-submit Prevention

Future prototype requirements:

- idempotency key
- mutationId
- pending lock
- disable submit button
- request fingerprint
- source snapshot hash
- no repeated complete/discard
- no double history write

## Conflict UX

- Show source mismatch message.
- Show local data changed message.
- Show API snapshot stale message.
- No automatic merge.
- No automatic overwrite.
- No repair button.
- Suggested actions are refresh comparison, cancel, or retry after explicit review.

## Mutation Category UX Matrix

| Category | Confirmation level | Pending UX | Success UX | Failure UX | Rollback UX | Required gates |
| --- | --- | --- | --- | --- | --- | --- |
| Category A: Lowest-risk future candidate | Level 1 | Small pending indicator, disabled submit, target issue shown | Snapshot-confirmed success only, then diagnostics comparison | Visible failure with no localStorage overwrite | Clear pending state; no local optimistic write in first candidate | source snapshot check, idempotency, no-op handling, no-fake-success tests |
| Category B: Medium-risk | Level 2 | Review state remains visible, submit locked | Snapshot-confirmed success with audit trail comparison | Explicit error with editable review state preserved | Restore preview or return to edit review | confirmation UX, audit trail display, readMirror parity, rollback UX |
| Category C: High-risk | Level 3 | Active-session pending state, duplicate-submit lock, no hidden navigation | Snapshot-confirmed success only with active-session diagnostics | Strong failure state that preserves active session context | Restore active-session UI state; never double-write history | offline/session recovery plan, duplicate-submit protection, unsaved session confirmation UX |
| Category D: Very high-risk / blocked | Level 0 | No pending mutation from App | No App success state | Blocked explanation only | No App rollback because no App request starts | separate safety audit and explicit future acceptance |

## First Prototype Recommendation

Do not implement mutation prototype next unless UX gates are accepted.

Task 4.26 does not approve direct mutation implementation.

Task 4.26 does not approve App POST calls.

The only recommended next task is `Task 4.27 Lowest-risk Mutation Prototype Plan V1`.

Task 4.27 should still be a plan. Its first candidate can only consider Category A, such as DataHealth issue dismiss, and still must not directly implement App mutation routes.

## Required Gates Before Mutation Prototype

- source-of-truth strategy completed
- confirmation UX completed
- rollback UX completed
- idempotency strategy documented
- conflict UX documented
- failure state UX documented
- localStorage backup plan documented
- dev DB backup plan documented
- no fake success rule tested
- no duplicate submit rule tested
- read-only manual acceptance still green
- browser build clean
- no App mutation calls until explicit prototype task

## Decision Record

- Date: 2026-05-10
- Branch / commit: record during manual acceptance
- Decision: Define mutation confirmation, failure, rollback, and no-fake-success UX without implementing mutation integration.
- Recommendation: Plan the lowest-risk mutation prototype next, but keep it planning-only.
- Rejected options: silent mutation, optimistic success without persistence, direct App POST calls, active-session-first prototype, DataHealth repair from App, backup/import/reset over HTTP from App.
- Required next task: `Task 4.27 Lowest-risk Mutation Prototype Plan V1`.
- Risks: false success, duplicate submit, stale snapshot conflict, hidden overwrite, active session loss, rollback confusion.
- Rollback requirement: future mutation work must preserve a clear failed state, restore preview UI when needed, keep localStorage authoritative, and remain disableable.

## Final Recommendation

Task 4.26 result: UX/rollback plan only.

Write-path migration remains blocked.

App must not call mutation routes yet.

No mutation prototype is implemented.

Next task should be Task 4.27 Lowest-risk Mutation Prototype Plan V1.

## Task 4.27 Follow-up Note

Task 4.27 adds `docs/LOWEST_RISK_MUTATION_PROTOTYPE_PLAN.md` as planning only.

The Task 4.26 conclusion does not change: no mutation prototype is implemented, App must not call mutation routes, and write-path migration remains blocked.

Task 4.27 selects DataHealth issue dismiss as the first future candidate while keeping it blocked until gates pass. The next recommended task is `Task 4.28 DataHealth Dismiss Mutation Prototype Plan V1`, which should still be a plan unless the user explicitly approves implementation.

## Task 4.28 Note

Task 4.28 was explicitly approved as `DataHealth Dismiss Mutation Prototype V1`.

The no-fake-success rule is implemented for the one-route dev-only prototype: the UI requires confirmation, blocks duplicate submit while pending, and shows success only after the Dev API returns a successful mutation result with snapshot metadata.

The Task 4.26 boundary still holds for broader write paths: no session/history/DataHealth repair/backup/reset App mutations are authorized, AppData and localStorage are not overwritten by API results, and write-path migration remains blocked.

## Task 4.29 Note

Task 4.29 adds acceptance coverage and `docs/DATAHEALTH_DISMISS_PROTOTYPE_ACCEPTANCE.md` for the Task 4.28 DataHealth dismiss prototype.

The no-fake-success rule is covered by tests: API unavailable, timeout, malformed response, server errors, no-change, issue-not-found, write failure, transaction failure, database closed, unsupported route, non-2xx responses, and missing snapshot metadata all remain failure states instead of success states.

The Task 4.26 conclusion remains unchanged for broader write paths: AppData and localStorage are not overwritten by API results, no session/history/DataHealth repair/backup/reset App mutations are authorized, and write-path migration remains blocked.

## Task 4.34 Note

Task 4.34 audits the second mutation candidate without implementing it.

The Task 4.26 UX conclusion remains active: history data-flag is a Level 2 candidate that needs explicit confirmation, audit trail visibility, readMirror parity, duplicate-submit prevention, rollback planning, and no-fake-success handling before any future prototype.

No second mutation is implemented. The only implemented browser mutation route remains `POST /data-health/issues/:issueId/dismiss`, and write-path migration remains blocked.

## Task 4.35 Note

Task 4.35 adds the History data-flag mutation prototype plan.

The future `POST /history/:id/data-flag` candidate remains Level 2: confirmation must show current and target dataFlag, warn that statistics may change, cancel without a request, block duplicate submit while pending, and show success only after strict server success plus snapshot metadata.

Task 4.35 does not implement the route, does not add App POST calls, and does not change localStorage/AppData behavior.

## Task 4.36 Note

Task 4.36 implements the History data-flag prototype as a dev-only one-route experiment.

The no-fake-success rule applies to History data-flag: confirmation is required before POST, pending disables duplicate submit, success requires strict server success plus snapshot metadata, and failure states must not look successful.

Rollback remains local-behavior preserving because the prototype does not optimistically update AppData or localStorage. Disable the mutation flag, stop the Dev API runner, and inspect the dev DB if needed.

## Task 4.37 Note

Task 4.37 adds acceptance tests and `docs/HISTORY_DATA_FLAG_PROTOTYPE_ACCEPTANCE.md` for the existing History data-flag prototype.

The accepted UX boundary covers flag matrix isolation, target record selection, confirmation before POST, cancel with no POST, pending duplicate-submit prevention, retry only after explicit re-confirmation, strict no-fake-success behavior, and localStorage/AppData integrity.

No new mutation route is added; browser mutation routes remain exactly DataHealth dismiss and History data-flag.

## Task 4.46 Note

Task 4.46 implements the dev-only Limited History Edit prototype for `POST /history/:id/edit`.

The no-fake-success rule applies to limited history edit: confirmation is required before POST, pending disables duplicate submit, success requires HTTP success plus `ok=true`, `changed=true`, `status="success"`, and snapshot metadata, and every missing success field is failure.

Rollback remains failure-state only because the prototype never optimistically updates AppData or localStorage. The App remains localStorage-first; users can disable the mutation flag, stop the Dev API runner, and use the existing dev DB runbook if needed.

## Task 4.47 Note

Task 4.47 adds acceptance coverage and a manual acceptance runbook for the Limited History Edit prototype.

The accepted UX boundary covers flag matrix isolation, stable target session/exercise/set selection, before/after display, calculation-impact warning, confirmation before POST, cancel with no POST, pending duplicate-submit prevention, retry only after explicit user action and confirmation, strict no-fake-success behavior, and localStorage/AppData integrity.

No new mutation route is added; browser mutation routes remain exactly DataHealth dismiss, History data-flag, and Limited History Edit.

## Task 4.49 Note

Task 4.49 hardens the Limited History Edit UX boundary without adding runtime write capability.

The no-fake-success rule remains strict: success requires HTTP success plus `ok=true`, `changed=true`, `status="success"`, and snapshot metadata. Missing result, missing snapshot metadata, no_change, not-found, invalid patch, source snapshot mismatch, write failure, transaction failure, database_closed, unsupported_route, timeout, abort, unavailable, and malformed response stay visible failures.

Rollback remains failure-state only because the prototype never optimistically updates AppData or localStorage. Confirmation and pending locks remain required before any retry.

## Task 4.50 Note

Task 4.50 documents observability and manual recovery for the Limited History Edit prototype without adding browser write capability.

Safe diagnostics may show mutation state, redacted target, source fingerprint presence, snapshot metadata presence, HTTP status, failure code, duplicate-submit status, timestamps, and a safe recovery note. They must not expose raw stack traces, raw API responses, full AppData, localStorage dumps, SQLite internals, or environment objects.

Recovery remains manual and outside the browser prototype: disable the mutation flag, stop the Dev API runner, rerun read-only diagnostics, and inspect a copied dev DB if needed.

## Task 4.51 Note

Task 4.51 regression-locks the Limited History Edit UX boundary without adding browser write capability.

The prototype remains confirmation-gated, duplicate-submit guarded, no-fake-success locked, and failure-visible. Rollback remains failure-state only because AppData and localStorage are never optimistically changed by the browser prototype.

## Task 4.52 Note

Task 4.52 checkpoints the three accepted write-path prototypes without adding browser write capability.

DataHealth dismiss, History data-flag, and Limited History Edit remain dev-only, confirmation-aware, duplicate-submit guarded, strict no-fake-success prototypes. Rollback remains failure-state/manual cleanup only because API results never overwrite AppData or localStorage.

## Task 4.53 Note

Task 4.53 adds the manual regression runbook for the three accepted write-path prototypes without adding browser write capability.

Manual regression must verify each prototype in its own mutation-flag flow, confirm no POST before confirmation, confirm no fake success, and confirm localStorage/AppData integrity before and after success and failure attempts.
