# Lowest-risk Mutation Prototype Plan

Task 4.27 identifies the first future lowest-risk mutation prototype candidate. It is a planning and decision record only.

## Scope / Non-goals

- This is a lowest-risk mutation prototype plan.
- This is not mutation prototype implementation.
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
- Task 4.26 defined confirmation, rollback, no-fake-success, duplicate-submit, conflict, and failure UX gates.
- Existing mutation routes remain server/dev API only and are not approved for App runtime use.

## Candidate Evaluation

### Candidate A1: DataHealth issue dismiss

- Route: `POST /data-health/issues/:issueId/dismiss`
- Category: A
- Risk level: Lowest-risk candidate
- Reason: does not change training set logs, does not alter PR/e1RM/effectiveSet calculations, and affects only a dismissed issue marker.
- Risk caveat: reversible only in concept unless audit/log and undo behavior are designed.
- Status: still blocked until prototype gates pass.

### Candidate A2: Diagnostics acknowledged state, if ever added

- Route: none today.
- Category: A idea only.
- This is not currently an existing mutation route unless explicitly designed later.
- This task must not invent the route, state model, or storage behavior.
- Status: future idea only.

### Candidate B1: history data-flag

- Route: `POST /history/:id/data-flag`
- Category: B
- Risk level: medium.
- Reason: affects inclusion/exclusion semantics and downstream summaries.
- Required before consideration: stronger audit trail, explicit confirmation, rollback UX, and readMirror parity after mutation.
- Status: not first.

### Candidate B2: limited history edit

- Route: `POST /history/:id/edit`
- Category: B
- Risk level: medium.
- Reason: can affect summaries, PR/e1RM/effectiveSet calculations, and audit trail trust.
- Required before consideration: edit review UX, audit trail display, rollback UX, validation UX, and readMirror parity.
- Status: not first.

### Candidate C: session mutations

- Routes:
  - `POST /sessions/start`
  - `POST /sessions/active/patches`
  - `POST /sessions/active/complete`
  - `POST /sessions/active/discard`
- Category: C
- Risk level: high.
- Reason: active session state is fragile and can lose or duplicate in-progress training.
- Required before consideration: offline/session recovery plan, duplicate-submit protection, unsaved session confirmation, and active-session rollback UX.
- Status: not first.

### Candidate D: blocked high-risk operations

- `POST /data-health/repair/apply`
- backup import/export over HTTP
- reset/recovery over HTTP
- source-of-truth migration

These remain blocked. They are too broad, destructive, or ownership-changing for the first mutation prototype.

## Unique Recommendation

First future prototype candidate: DataHealth issue dismiss.

Task 4.27 does not implement it.

Task 4.27 does not approve direct App POST calls.

Task 4.28 may only be considered as `Task 4.28 DataHealth Dismiss Mutation Prototype Plan V1` unless the user explicitly approves implementation.

If implementation is ever considered, it must still be:

- dev-only
- explicit opt-in
- localStorage remains source of truth unless explicitly blocked/handled
- no source-of-truth switch
- no offline queue
- no broad mutation client
- one route only
- no session mutation
- no record edit
- no repair
- no backup/reset

## Required Prototype Gates

Before any future DataHealth dismiss prototype:

- source-of-truth strategy complete
- UX confirmation/rollback plan complete
- localStorage backup plan
- dev DB backup plan
- idempotency key design
- mutationId design
- request fingerprint design
- source snapshot hash/version design
- duplicate-submit prevention
- no fake success rule
- pending state UX
- failure state UX
- rollback display
- no-op handling
- issue-not-found handling
- API unavailable handling
- database_closed handling
- write_failed / transaction_failed handling
- readMirror parity after mutation
- browser build clean
- no Node-only imports
- no mutation route beyond the single candidate

## Proposed DataHealth Dismiss Prototype Shape

This is a plan only and does not implement the prototype.

Future route:

- `POST /data-health/issues/:issueId/dismiss`

Future request payload must include:

- `issueId`
- `mutationId`
- `idempotencyKey`
- `requestFingerprint`
- `sourceSnapshotHash` or `sourceSnapshotVersion`
- `confirmed: true`
- optional `nowIso` for tests

Future UI requirements:

- explicit confirmation or light confirmation
- pending lock
- disable repeated submit
- success only after snapshot write success
- failure visible if no `nextData` or write fails
- no automatic repair
- no localStorage overwrite
- no offline queue
- no retry that mutates silently

Future response handling:

- success only if HTTP response includes snapshot metadata
- no fake success on write failure
- no-op / issue not found / requiresConfirmation must not show success
- mismatch/source conflict must show conflict diagnostic

## Source-of-truth Handling For First Prototype

- localStorage remains source of truth.
- Dev API mutation result does not overwrite localStorage automatically.
- Future prototype must choose one of these options before implementation:
  - Option 1: API write is shadow-only diagnostic.
  - Option 2: localStorage mutation remains primary and API write only follows after backup.
  - Option 3: block prototype until explicit source-of-truth switch.
- Recommendation: for the first prototype, use shadow-only / diagnostics mode unless a later task explicitly designs localStorage reconciliation.

## Rollback Plan For First Prototype

- disable mutation flag
- stop dev API runner
- localStorage remains usable
- no localStorage overwrite means no user data rollback needed
- if prototype touches local UI state, restore previous UI state
- backup dev DB before experiments
- use `docs/DEV_API_RECOVERY_RESET.md`
- no production rollback
- no auth/sync rollback

## Manual Acceptance Requirements

Future prototype manual runbook must cover:

- flag off no mutation
- flag on only one route available
- confirm dismiss
- cancel dismiss
- duplicate click blocked
- API unavailable failure
- issue not found failure
- write failure no fake success
- readMirror after mutation
- localStorage unchanged unless explicitly designed
- browser network shows only allowed POST route
- no session/history/repair/backup/reset POSTs

## Explicitly Rejected First Prototypes

- session start rejected as first prototype
- session complete rejected as first prototype
- history edit rejected as first prototype
- history data-flag rejected as first prototype
- DataHealth repair rejected
- backup/import over HTTP rejected
- reset/recovery over HTTP rejected
- API source-of-truth switch rejected
- dual-write rejected

## Task 4.28 Recommendation

Task 4.27 result: Plan only.

First future candidate: DataHealth issue dismiss.

Write-path migration remains blocked.

App must not call mutation routes yet.

Next task should be Task 4.28 DataHealth Dismiss Mutation Prototype Plan V1.

Task 4.28 should still be a plan. If implementation is ever considered, it must be explicitly approved by the user.

## Decision Record

- Date: 2026-05-10
- Branch / commit: record during manual acceptance
- Decision: Select a future lowest-risk mutation prototype candidate without implementing it.
- Recommended candidate: DataHealth issue dismiss.
- Rejected candidates: session start, session complete, session patches, session discard, history edit, history data-flag, DataHealth repair, backup/import over HTTP, reset/recovery over HTTP, API source-of-truth switch, and dual-write.
- Required gates: source-of-truth, UX confirmation/rollback, idempotency, source snapshot, failure state, backup, readMirror parity, and browser isolation gates.
- Next task: `Task 4.28 DataHealth Dismiss Mutation Prototype Plan V1`.
- Risks: false success, duplicate dismiss, stale issue, source snapshot mismatch, localStorage/API divergence, and user confusion.
- Rollback requirement: keep localStorage authoritative, avoid automatic localStorage overwrite, disable the mutation flag, stop the Dev API runner, and recover/reset dev DB if needed.
