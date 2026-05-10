# Second Mutation Candidate Readiness Audit

Task 4.34 audits the second possible App-side mutation candidate after the DataHealth dismiss prototype line was implemented, accepted, hardened, observed, and regression-locked.

## Scope / Non-goals

- This is a second mutation candidate readiness audit.
- This is not implementation.
- This does not add `POST /history/:id/data-flag` to the App.
- This does not add any browser mutation route.
- This does not add a frontend mutation client.
- This does not change App.tsx.
- This does not replace localStorage.
- This does not switch source of truth.
- This does not add an offline mutation queue.
- This does not add production backend, auth, sync, or deployment.
- This does not add a package dependency or package script.
- There are no UI writes to API added by Task 4.34.
- There are no normalized tables.
- Write-path migration remains blocked.

## Current Baseline

- DataHealth dismiss is the only implemented browser mutation prototype.
- DataHealth dismiss is dev-only and explicit opt-in.
- DataHealth dismiss is regression-locked.
- The only currently implemented browser mutation route is `POST /data-health/issues/:issueId/dismiss`.
- localStorage remains source of truth.
- API results never overwrite AppData or localStorage.
- Read-only diagnostics remain the only broad App integration mode.
- App does not call session, history, DataHealth repair, backup, import, export, reset, or recovery routes.
- Node/dev API mutation routes still exist server-side, but they are not approved for browser runtime.
- The `POST /history/:id/data-flag` route exists only in the Node/dev API mutation boundary and is not wired to the App.

## Candidate Inventory

### Candidate A status: DataHealth dismiss

- Route: `POST /data-health/issues/:issueId/dismiss`
- Status: already implemented as a dev-only, explicit opt-in, one-route prototype.
- Status: accepted, hardened, observed, and regression-locked.
- Readiness implication: it proves the one-route gated prototype path can be controlled, but it is not a reason to immediately expand write-path surface.

### Candidate B1: history data-flag

- Route: `POST /history/:id/data-flag`
- Candidate status: second future candidate.
- Current browser runtime status: not implemented.
- Risk: medium.
- Why considered: it changes a bounded classification value instead of editing set logs.
- Why still risky: `normal`, `test`, and `excluded` affect analytics inclusion, readMirror summaries, history views, calendar badges, and downstream PR/e1RM/effectiveSet behavior.

### Candidate B2: history edit

- Route: `POST /history/:id/edit`
- Candidate status: rejected as second mutation candidate.
- Risk: higher than data-flag.
- Reason: editing history can change set logs, volumes, exercise identity, summaries, PR/e1RM/effectiveSet calculations, and audit trust.

### Candidate C: session mutations

- Routes:
  - `POST /sessions/start`
  - `POST /sessions/active/patches`
  - `POST /sessions/active/complete`
  - `POST /sessions/active/discard`
- Candidate status: rejected as second mutation candidate.
- Risk: high.
- Reason: active session state is fragile, duplicate start/complete/discard can lose or duplicate training state, and offline/PWA recovery is harder.

### Candidate D: blocked high-risk operations

- `POST /data-health/repair/apply`
- backup import/export over HTTP
- reset/recovery over HTTP
- source-of-truth migration

These remain blocked. They are too broad, destructive, or ownership-changing for a second mutation candidate.

## Candidate Evaluation Criteria

Every future candidate must be evaluated against:

- data semantics risk
- localStorage/source-of-truth impact
- PR/e1RM/effectiveSet impact
- readMirror parity impact
- audit trail requirement
- confirmation UX requirement
- rollback requirement
- duplicate-submit/idempotency requirement
- conflict/source snapshot requirement
- failure/no-fake-success requirement
- manual acceptance requirement
- browser route boundary risk

## History Data-flag Readiness Analysis

The data-flag field currently has three values:

- `normal`
- `test`
- `excluded`

`test` and `excluded` sessions are excluded from default analytics paths. Existing engine and UI behavior treats test/excluded sessions differently from normal sessions in analytics history, PR/e1RM/effectiveSet calculations, detail summaries, profile summaries, calendar/history displays, and readMirror counts.

Changing dataFlag can affect:

- default stats by moving a session into or out of analytics history
- PR/e1RM/effectiveSet eligibility
- record history and calendar labeling
- session summary text and excluded-from-stats reasons
- readMirror `analyticsSessionCount`, `byDataFlag`, list item `dataFlag`, and `excludedFromStats`
- downstream coaching and progression signals that read analytics history

History data-flag is higher risk than DataHealth dismiss because it changes analytics inclusion semantics for an actual training record. DataHealth dismiss only marks a diagnostic issue as dismissed and does not change training set logs.

History data-flag is lower risk than history edit or session mutation because it does not edit exercise sets, reps, weight, active session state, or completion/discard behavior. It still requires stronger gates than DataHealth dismiss.

Required before any prototype:

- explicit confirmation UX with before/after dataFlag value
- visible audit trail for who/when/why the flag changed
- readMirror parity checks after mutation
- manual acceptance for normal -> test, test -> normal, normal -> excluded, and excluded -> normal where safe
- rollback strategy that records the prior dataFlag and blocks fake success
- source snapshot hash/version check
- duplicate-submit prevention and idempotency key
- no automatic localStorage overwrite

## Why Not History Edit Next

- History edit can affect set logs.
- History edit can affect PR/e1RM/effectiveSet calculations.
- History edit can affect summaries, calendar details, progression signals, and audit trail trust.
- History edit needs stronger audit trail visibility, validation, conflict handling, rollback, and before/after review UX than data-flag.
- History edit is not suitable as the second mutation.

## Why Not Session Mutation Next

- Active session state is fragile.
- Duplicate start, complete, or discard can create data loss or duplicate records.
- Offline/PWA issues are harder for active-session writes.
- Unsaved training state requires stronger recovery and rollback behavior.
- Session mutation is not suitable as the second mutation.

## Why Not Repair / Backup / Reset

- DataHealth repair can rewrite derived or legacy display semantics.
- Backup/import over HTTP is high risk and could bypass existing local file safety.
- Reset/recovery over HTTP is destructive.
- Source-of-truth migration is not a mutation prototype.
- DataHealth repair, backup/import/export over HTTP, reset/recovery over HTTP, and source-of-truth migration remain blocked.

## Recommendation

Second future candidate: `POST /history/:id/data-flag`.

Task 4.34 does not implement it.

Task 4.34 does not approve direct implementation.

Task 4.34 does not add `POST /history/:id/data-flag` to browser runtime.

Task 4.34 does not add a frontend mutation client.

Next task should be `Task 4.35 History Data-flag Mutation Prototype Plan V1`.

Task 4.35 should still be planning-only unless explicitly approved otherwise.

## Required Gates Before History Data-flag Prototype

- source-of-truth remains localStorage
- explicit dev-only mutation flag
- single-route-only implementation
- confirmation UX
- audit trail visibility
- idempotency key
- mutationId
- request fingerprint
- source snapshot hash/version
- duplicate-submit prevention
- no-fake-success rule
- readMirror parity after mutation
- test/excluded/default-stat semantics locked
- localStorage backup plan
- dev DB backup plan
- manual acceptance runbook
- no session routes
- no history edit route
- no DataHealth repair route
- no backup/import/export/reset/recovery routes
- no broad mutation client
- no source-of-truth switch

## Route Boundary Rules For Future Prototype

- Only `POST /history/:id/data-flag` may be considered in a future plan.
- No `POST /history/:id/edit`.
- No `POST /sessions/*`.
- No `POST /data-health/repair/apply`.
- No backup/import/export/reset/recovery routes.
- No broad mutation client.
- No source-of-truth switch.
- No localStorage/AppData overwrite by API results.
- No production backend, auth, sync, or deployment.

## Decision Record

- Date: 2026-05-10
- Branch / commit: `codex/task4.34-second-mutation-candidate-readiness-audit` / record after commit
- Decision: Audit the second mutation candidate without implementing it.
- Recommended candidate: `POST /history/:id/data-flag`.
- Rejected candidates: `POST /history/:id/edit`, session mutations, `POST /data-health/repair/apply`, backup/import/export over HTTP, reset/recovery over HTTP, and source-of-truth migration.
- Required gates: localStorage source-of-truth, dev-only single-route flag, confirmation UX, audit trail, idempotency, mutationId, request fingerprint, source snapshot hash/version, duplicate-submit prevention, no-fake-success, readMirror parity, semantics lock, backups, manual acceptance, and route boundary lock.
- Next task: `Task 4.35 History Data-flag Mutation Prototype Plan V1`.
- Risks: analytics inclusion changes, PR/e1RM/effectiveSet shifts, stale source snapshots, audit gaps, duplicate submits, false success, localStorage/API divergence, and route-surface creep.
- Rollback requirement: future prototype must keep localStorage authoritative, avoid API-to-localStorage overwrite, preserve prior dataFlag for audit/rollback review, show failure instead of success on write failure, and remain disableable.

## Final Recommendation

Task 4.34 result: Audit only.

Second future candidate: POST /history/:id/data-flag.

No second mutation is implemented.

Write-path migration remains blocked.

Next task should be Task 4.35 History Data-flag Mutation Prototype Plan V1.

## Task 4.35 Follow-up Note

Task 4.35 adds `docs/HISTORY_DATA_FLAG_MUTATION_PROTOTYPE_PLAN.md` as the planning follow-up for the selected candidate.

The Task 4.34 decision does not change: `POST /history/:id/data-flag` is still a future candidate only, no second mutation is implemented, DataHealth dismiss remains the only implemented browser mutation prototype, localStorage remains source of truth, and write-path migration remains blocked.

Task 4.35 recommends `Task 4.36 History Data-flag Mutation Prototype V1` only if gates are accepted.
