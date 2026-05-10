# Write-path Source-of-truth & Offline Strategy

Task 4.25 defines the strategy for future IronPath write-path work. It is a strategy and decision record only.

## Scope / Non-goals

- This is a write-path strategy.
- This is not mutation integration implementation.
- There is no App.tsx mutation integration.
- There are no UI writes to API.
- There is no frontend mutation client.
- There is no mutation feature flag.
- There is no localStorage replacement.
- There is no source-of-truth switch.
- There is no App write-path migration.
- There is no production backend.
- There is no auth, sync, or deployment.
- There are no normalized tables.
- There is no package dependency or package script.
- Write-path migration remains blocked.

## Current Baseline

- App runtime still uses localStorage through `App.tsx`, `src/storage/persistence.ts`, and `src/storage/localStorageAdapter.ts`.
- Read-only diagnostics are dev-only and explicit opt-in.
- The frontend Dev API client is GET-only.
- App calls no mutation routes.
- Node/dev API has pure mutation boundaries in `sessionMutation` and `recordDataHealthMutation`.
- serverAdapter writes SQLite snapshots only when a mutation boundary returns `nextData`.
- writeSnapshot failure does not return fake success.
- Recovery/reset safety exists for local dev DB artifacts.
- Read-only manual acceptance exists at `docs/READONLY_APP_MANUAL_ACCEPTANCE.md`.

## Source-of-truth Options

### Option A: localStorage remains primary; API mutation disabled

- This is the current state.
- It is the safest short-term state.
- It avoids double-write and snapshot conflict.
- It does not solve future write-path integration.

### Option B: localStorage primary; API writes shadow snapshots only

- UI would still treat localStorage as truth.
- API writes would produce comparison snapshots only.
- This can be useful for diagnostics.
- It can also create localStorage/API divergence if not carefully gated.

### Option C: API/SQLite becomes write source of truth; localStorage read fallback

- This is closest to a future full-stack runtime.
- It requires complete offline, rollback, migration, reconciliation, and failure UX strategy.
- Current risk is too high.

### Option D: dual-write localStorage + API

- This is the most dangerous short-term option.
- It can split App state when one write succeeds and the other fails.
- It is not recommended without a tested reconciliation plan.

### Option E: staged migration with read-only comparison -> lowest-risk mutation prototype -> explicit source-of-truth switch later

- This is the unique short-term recommendation.
- It preserves the completed read-only diagnostics path.
- It allows later lowest-risk mutation planning without switching ownership.
- Mutation remains blocked until strategy gates pass.

Not recommended:

- immediate API source-of-truth switch
- dual-write without reconciliation
- App mutation prototype before offline, idempotency, and rollback strategy

## Recommended Short-term Source-of-truth Rule

- localStorage remains current App source of truth.
- App must not call mutation routes yet.
- No API response overwrites localStorage.
- No dual-write yet.
- No API-backed persistence adapter.
- No source-of-truth switch until explicit future acceptance.
- No write-path prototype until lowest-risk category and rollback gates are defined.

## Offline / PWA Strategy

Current state:

- App can continue using localStorage during offline or PWA-like usage.
- API unavailable must not produce fake mutation success.
- No offline mutation queue exists.
- No optimistic write is allowed before recovery behavior exists.
- No silent retry may mutate data.

Future offline queue requirements, if one is ever designed:

- mutation id
- idempotency key
- createdAt
- source local snapshot id/hash
- user confirmation state
- retry policy
- conflict policy
- cancellation / discard policy
- visible failed state

Short-term conclusion:

- No offline mutation queue in first mutation prototype.
- First mutation prototype must require online Dev API availability and explicit user confirmation.

## Idempotency / Duplicate-submit Strategy

Future mutation work needs:

- stable mutationId
- idempotency key
- request fingerprint
- target record/session id
- source snapshot id or hash
- server-side duplicate handling
- UI disable/confirm while pending
- no repeated completion / discard
- no double history write

Short-term requirement:

- No mutation integration before the idempotency plan is tested.

## Conflict / Reconciliation Strategy

Known conflicts:

- localStorage AppData may differ from latest SQLite snapshot.
- API snapshot may be stale.
- User may have changed local data while Dev API is running.
- History edit may target a stale record.
- Active session mutation may target a stale active session.
- DataHealth issue may no longer exist.

Future comparison requirements:

- Compare source snapshot hash/version before mutation.
- Reject mutation if source mismatch.
- Show conflict diagnostics.
- No automatic merge.
- No automatic repair.
- No localStorage overwrite.

## Rollback Strategy

Before any mutation prototype:

- Create localStorage backup.
- Backup dev DB.
- Mutation failure must leave UI in a clear failed state.
- If API write fails, no fake success.
- If UI local state changes but API fails, rollback UI or block local mutation.
- Disable mutation flag to rollback feature.
- Stop dev API runner.
- Recover/reset dev DB using `docs/DEV_API_RECOVERY_RESET.md`.
- There is no production rollback needed yet.

## Mutation Category Strategy

### Category A: Lowest-risk future candidate

Candidates:

- DataHealth issue dismiss
- diagnostics acknowledged state, if ever added

Strategy:

- Could be first prototype candidate.
- Still requires source snapshot check, confirmation, no-op handling, and rollback state.
- No auto-dismiss.

### Category B: Medium-risk

Candidates:

- history data-flag
- limited history edit

Strategy:

- Requires audit trail visibility.
- Requires confirmation UX.
- Requires readMirror parity after mutation.
- Requires rollback plan.

### Category C: High-risk

Candidates:

- session start
- session patches
- session complete
- session discard

Strategy:

- Not first mutation prototype.
- Active training state is fragile.
- Requires offline/session recovery plan.
- Requires duplicate-submit protection.
- Requires unsaved session confirmation UX.

### Category D: Very high-risk / blocked

Candidates:

- DataHealth repair apply
- backup import/export over HTTP
- reset/recovery over HTTP
- source-of-truth migration

Strategy:

- Remains blocked.
- Not considered for first mutation prototype.

## First Mutation Prototype Recommendation

Do not implement mutation prototype next.

Task 4.25 does not approve direct mutation prototype.

Task 4.25 does not approve App POST calls.

The only recommended next task is `Task 4.26 Mutation UX Confirmation & Rollback Plan V1`.

Reason: source-of-truth and offline policy are necessary but not enough. Any later POST work still needs confirmation UX, rollback UX, failed write UX, and clear user-visible pending/failure state.

## Required Gates Before Any Mutation Prototype

- `npm run api:dev:build`
- `npm run typecheck`
- `npm test`
- `npm run build`
- read-only manual app acceptance passed
- write-path source-of-truth strategy completed
- mutation UX confirmation plan completed
- rollback UX plan completed
- idempotency key strategy documented
- source snapshot hash/version strategy documented
- conflict/reconciliation strategy documented
- offline behavior documented
- failed mutation UI behavior documented
- backup localStorage before experiments
- backup dev DB before experiments
- no production/auth/sync assumption
- browser build has no `node:http` or `node:sqlite`
- App mutation calls still absent until a future prototype task

## Decision Record

- Date: 2026-05-10
- Branch / commit: record during manual acceptance
- Decision: Define write-path source-of-truth and offline strategy without implementing mutation integration.
- Source-of-truth recommendation: Option E staged migration; localStorage remains current App source of truth.
- Offline recommendation: no offline mutation queue in the first mutation prototype; require online Dev API availability and explicit confirmation.
- Rejected options: immediate API source-of-truth switch, dual-write without reconciliation, App mutation prototype before offline/idempotency/rollback strategy, direct active-session mutation prototype.
- Required next task: `Task 4.26 Mutation UX Confirmation & Rollback Plan V1`.
- Risks: data loss, double-write divergence, stale snapshots, failed offline writes, duplicate submission, rollback complexity, user confusion.
- Rollback requirement: a future write prototype must be disableable, backed up, explicit, and unable to report success when snapshot persistence fails.

## Final Recommendation

Task 4.25 result: Strategy only.

Write-path migration remains blocked.

App must not call mutation routes yet.

Source-of-truth remains localStorage.

No offline mutation queue yet.

Next task should be Task 4.26 Mutation UX Confirmation & Rollback Plan V1.

## Task 4.26 Follow-up Note

Task 4.26 adds `docs/MUTATION_UX_CONFIRMATION_ROLLBACK_PLAN.md` as UX/rollback planning only.

The Task 4.25 conclusion does not change: source-of-truth remains localStorage, no offline mutation queue exists yet, App must not call mutation routes, and write-path migration remains blocked.

Task 4.26 defines confirmation levels, no-fake-success rules, pending/success/failure states, rollback UX, duplicate-submit prevention, and conflict UX. Its next recommended task is `Task 4.27 Lowest-risk Mutation Prototype Plan V1`, which should still be a plan before any App POST calls.

## Task 4.27 Follow-up Note

Task 4.27 adds `docs/LOWEST_RISK_MUTATION_PROTOTYPE_PLAN.md` as planning only.

The Task 4.25 conclusion does not change: source-of-truth remains localStorage, no offline mutation queue exists yet, App must not call mutation routes, and write-path migration remains blocked.

Task 4.27 chooses DataHealth issue dismiss as the first future candidate, but the recommended first prototype source-of-truth mode remains shadow-only / diagnostics unless a later task explicitly designs localStorage reconciliation.

## Task 4.28 Note

Task 4.28 was explicitly approved as `DataHealth Dismiss Mutation Prototype V1`.

It implements only the one-route dev-only DataHealth dismiss prototype. It does not switch source of truth, does not add an offline mutation queue, and does not add localStorage reconciliation.

The Task 4.25 source-of-truth rule still governs broader write-path work: localStorage remains the active App source of truth, API results do not overwrite AppData or localStorage, and write-path migration remains blocked.

## Task 4.29 Note

Task 4.29 adds acceptance coverage and a manual acceptance runbook for the one-route DataHealth dismiss prototype.

The acceptance scope confirms the Task 4.25 source-of-truth rule: localStorage remains the active App source of truth, API mutation results do not overwrite AppData or localStorage, and snapshot metadata is not persisted into localStorage by the browser prototype.

Task 4.29 does not add an offline mutation queue, localStorage reconciliation, source-of-truth switching, production backend, auth, sync, deployment, broad mutation client, package changes, lockfile changes, or normalized tables. Write-path migration remains blocked.

## Task 4.34 Note

Task 4.34 adds a second mutation candidate readiness audit only.

The Task 4.25 source-of-truth rule does not change: localStorage remains the active App source of truth, API mutation results do not overwrite AppData or localStorage, and there is still no offline mutation queue, source-of-truth switch, localStorage reconciliation, production backend, auth, sync, deployment, broad mutation client, package change, lockfile change, or normalized table.

The audit identifies `POST /history/:id/data-flag` as the second future candidate for a planning task, but no second mutation is implemented and write-path migration remains blocked.

## Task 4.35 Note

Task 4.35 plans a future History data-flag mutation prototype without implementing it.

The Task 4.25 source-of-truth rule still applies: localStorage remains the active App source of truth, API mutation results must not overwrite AppData or localStorage, there is no offline mutation queue, and no source-of-truth switch or localStorage reconciliation is introduced.

History data-flag planning must keep DataHealth dismiss as the only implemented browser mutation route until a later explicitly approved task.

## Task 4.36 Note

Task 4.36 implements the explicitly approved History data-flag prototype as the second dev-only browser mutation experiment.

This does not switch source of truth. localStorage remains the active App source of truth, API mutation results never overwrite AppData or localStorage, and no localStorage reconciliation or offline mutation queue is introduced.

The only browser mutation prototypes are `POST /data-health/issues/:issueId/dismiss` and `POST /history/:id/data-flag`; session mutation, history edit, DataHealth repair, backup/import/export/reset/recovery, production backend, auth, sync, and deployment remain blocked.

## Task 4.37 Note

Task 4.37 adds acceptance tests and a manual runbook for the History data-flag prototype while keeping the write-path source-of-truth strategy unchanged.

localStorage remains the active App source of truth. API results never overwrite AppData or localStorage, snapshot metadata is not stored in localStorage by the prototype, and read-only comparison remains separate from the mutation experiment.

The acceptance layer does not add an offline queue, localStorage reconciliation, production backend, auth, sync, deployment, or any browser mutation route beyond DataHealth dismiss and History data-flag.

## Task 4.46 Note

Task 4.46 adds a dev-only, explicit opt-in Limited History Edit prototype for `POST /history/:id/edit`.

This does not switch source of truth. localStorage remains the active App source of truth, API mutation results never overwrite AppData or localStorage, snapshot metadata is not stored in localStorage by the browser prototype, and no localStorage reconciliation or offline mutation queue is introduced.

The only accepted browser mutation prototypes are now `POST /data-health/issues/:issueId/dismiss`, `POST /history/:id/data-flag`, and `POST /history/:id/edit`; session mutation, DataHealth repair, backup/import/export/reset/recovery, production backend, auth, sync, and deployment remain blocked.

## Task 4.47 Note

Task 4.47 adds acceptance tests and a manual runbook for the Limited History Edit prototype while keeping the write-path source-of-truth strategy unchanged.

localStorage remains the active App source of truth. API results never overwrite AppData or localStorage, snapshot metadata is not stored in localStorage by the prototype, and read-only comparison remains separate from the mutation experiment.

The acceptance layer does not add an offline queue, localStorage reconciliation, production backend, auth, sync, deployment, or any browser mutation route beyond DataHealth dismiss, History data-flag, and Limited History Edit.

## Task 4.49 Note

Task 4.49 hardens the Limited History Edit prototype without changing the write-path source-of-truth strategy.

localStorage remains the active App source of truth. API results never overwrite AppData or localStorage, snapshot metadata is not stored in localStorage by the prototype, and no localStorage reconciliation or offline mutation queue is introduced.

The hardening layer does not add production backend, auth, sync, deployment, or any browser mutation route beyond DataHealth dismiss, History data-flag, and Limited History Edit.
