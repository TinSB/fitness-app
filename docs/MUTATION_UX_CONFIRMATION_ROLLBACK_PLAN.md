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
