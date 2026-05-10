# Mutation Integration Readiness Audit

Task 4.24 audits whether IronPath is ready for future App mutation integration. It is an audit and decision record only.

## Scope / Non-goals

- This is a mutation integration readiness audit.
- This is not mutation integration implementation.
- There is no App.tsx mutation integration.
- There are no UI writes to API.
- There is no frontend mutation client.
- There are no browser POST, PUT, PATCH, or DELETE client methods.
- There is no mutation feature flag runtime wiring.
- There is no localStorage replacement.
- There is no source-of-truth switch.
- There is no App write-path migration.
- There is no production backend.
- There is no auth, sync, or deployment.
- There are no normalized tables.
- There is no package dependency or package script.
- Write-path migration remains blocked.

## Current Safe Baseline

- App runtime still uses localStorage through `App.tsx`, `src/storage/persistence.ts`, and `src/storage/localStorageAdapter.ts`.
- Read-only diagnostics are dev-only and explicit opt-in.
- The frontend Dev API client is GET-only.
- No mutation routes are called from App.
- Dev API read results are diagnostics only and never overwrite AppData or localStorage.
- ServerAdapter mutation routes exist only in the Node/dev API stack.
- `sessionMutation` and `recordDataHealthMutation` are pure boundaries.
- SQLite repository writes snapshots only through the Node-only serverAdapter/dev API stack.
- Read-only manual acceptance exists at `docs/READONLY_APP_MANUAL_ACCEPTANCE.md`.

## Existing Mutation Route Inventory

These routes exist in the server/dev API boundary. They are not browser App runtime routes, they are not approved for UI integration, and they require future readiness gates.

Session mutation:

- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

Record and DataHealth mutation:

- `POST /history/:id/edit`
- `POST /history/:id/data-flag`
- `POST /data-health/issues/:issueId/dismiss`
- `POST /data-health/repair/apply`

## Remaining Blockers Before Any Mutation Integration

- no frontend mutation client strategy
- no mutation feature flag strategy
- no source-of-truth switch strategy
- no offline/PWA mutation queue strategy
- no idempotency / duplicate-submit strategy
- no optimistic update / rollback strategy
- no conflict resolution strategy
- no localStorage/API snapshot reconciliation strategy
- no user confirmation UX strategy
- no API unavailable mutation fallback strategy
- no auth/privacy model
- no production deployment model
- no manual mutation acceptance runbook
- no mutation observability/diagnostics model
- no safe backup/restore checkpoint strategy before writes

## Risk Analysis

| Risk | Description | Severity | Mitigation | Required test gate |
| --- | --- | --- | --- | --- |
| data loss | A UI write could persist an incomplete or wrong AppData snapshot. | critical | Define source-of-truth, backup, confirmation, and rollback rules before writes. | write rollback and snapshot failure tests |
| double-write divergence | Writing both localStorage and the API can leave different states. | critical | Avoid dual-write until reconciliation rules exist. | dual-write divergence tests |
| localStorage vs API snapshot conflict | The App may read one source while the dev API writes another. | high | Keep localStorage authoritative until a switch plan exists. | source-of-truth parity tests |
| duplicate mutation submission | Repeated clicks or retries may apply a mutation twice. | high | Design idempotency keys or duplicate-submit guards first. | duplicate-submit tests |
| stale active session mutation | Active training writes may target stale session state. | high | Add conflict checks and user-visible stale-state handling. | stale active-session tests |
| offline/PWA failed mutation | Offline UI writes may fail after the user expects success. | high | Document offline queue or no-offline-write behavior first. | offline/PWA mutation tests |
| partial snapshot write | A mutation may calculate nextData but fail persistence. | critical | Treat persisted snapshot success as the only success condition. | failed write no-success tests |
| user thinks write succeeded but snapshot failed | The UI could show success while storage rejected the write. | high | Require explicit mutation error diagnostics and no false success state. | failed write UX tests |
| accidental production exposure | Dev write endpoints could be mistaken for a production backend. | high | Keep dev-only, localhost-only, no production deployment assumption. | production exposure boundary tests |
| backup/import safety regression | HTTP write work could bypass existing backup/import safety boundaries. | high | Keep backup/import outside App HTTP routes until separately approved. | backup/import parity tests |
| DataHealth repair misuse | Repair routes can mutate many records and are easy to over-trust. | critical | Keep repair out of App integration until confirmation and audit gates exist. | DataHealth repair safety tests |
| history edit corruption | Record edits may corrupt historical analytics or audit trails. | high | Require confirmation, audit trail parity, and rollback gates. | history edit audit tests |
| active session loss | Session discard/complete paths can lose in-progress training state. | critical | Do not start with active-session routes; require active-session rollback design. | active-session loss tests |
| rollback complexity | Mutation prototypes may be hard to undo after mixed storage writes. | high | Require disable flag, backups, and no silent source-of-truth switch. | rollback acceptance tests |
| browser bundle pollution | Browser code could import Node-only API or SQLite modules. | high | Keep Node-only stack isolated and scan browser builds. | browser bundle isolation tests |
| UX confusion | Users may mistake diagnostics or failed writes for saved App changes. | medium | Use explicit write-state labels and failure copy before any prototype. | mutation UX acceptance tests |
| auth/privacy gap | Write endpoints have no auth/privacy model yet. | critical | Do not expose write APIs beyond dev-only localhost experiments. | auth/privacy readiness gate |

## Mutation Category Readiness Matrix

| Category | Candidate mutations | Readiness status | Why blocked | Required gates before prototype |
| --- | --- | --- | --- | --- |
| Category A: Lowest-risk future candidate, still blocked | DataHealth issue dismiss; read-only diagnostics acknowledged state, if ever added | Blocked | Even low-risk state changes still need source-of-truth, fallback, duplicate-submit, and rollback strategy. | source-of-truth strategy, duplicate-submit guard, confirmation copy, rollback tests |
| Category B: Medium-risk future candidate | history data-flag; limited history edit | Blocked | History changes affect analytics, audit trails, and correction trust. | confirmation UX, audit trail parity, rollback gates, history integrity tests |
| Category C: High-risk future candidate | session start; session patches; session complete; session discard | Blocked and not first | Active training state is easy to lose or duplicate, especially offline or during stale session conflicts. | active-session conflict plan, idempotency, offline behavior, failed-write UX, rollback acceptance |
| Category D: Very high-risk / not ready | DataHealth repair apply; backup import/export over HTTP; reset/recovery over HTTP; source-of-truth migration | Not ready | These can mutate broad data, bypass safety boundaries, or switch ownership. | separate safety audits, manual acceptance, recovery proof, explicit migration plan |

## Recommended Mutation Integration Path

Task 4.24 result: Not ready for mutation integration.

The only recommended next task is `Task 4.25 Write-path Source-of-truth & Offline Strategy V1`.

Task 4.25 must be strategy/planning only:

- no App mutation calls
- no POST route UI wiring
- no source-of-truth switch implementation
- no production write backend
- no auth or sync implementation

Recommended sequence:

- `Task 4.25 Write-path Source-of-truth & Offline Strategy V1`
- `Task 4.26 Mutation UX Confirmation & Rollback Plan V1`
- `Task 4.27 Lowest-risk Mutation Prototype Plan V1`
- only later: dev-only mutation prototype behind an explicit flag

## Source-of-truth Rules For Future Mutation Work

- localStorage remains current App source of truth.
- No mutation route from App until a source-of-truth strategy exists.
- No dual-write without a reconciliation plan.
- No API write without a rollback plan.
- No mutation optimistic update without failure recovery.
- No mutation response overwrites localStorage automatically.
- No backup/import/reset over HTTP from App.
- No repair automation from App.
- No production write API assumption.

## Required Gates Before Any Mutation Prototype

- `npm run api:dev:build`
- `npm run typecheck`
- `npm test`
- `npm run build`
- read-only manual app acceptance passed
- mutation source-of-truth strategy completed
- offline/PWA mutation behavior documented
- duplicate-submit/idempotency strategy documented
- rollback strategy documented
- confirmation UX strategy documented
- mutation error diagnostics documented
- localStorage/API reconciliation documented
- no production/auth/sync assumption
- browser build has no `node:http` or `node:sqlite`
- no App mutation route calls until gated

## Rollback Plan Requirements

Future mutation prototype work must define:

- disable mutation flag
- stop dev API runner
- keep localStorage as source of truth unless explicitly migrated
- backup localStorage before write experiments
- backup dev DB before write experiments
- no production migration to undo
- no auth/sync rollback
- clear user-visible failure state
- no silent successful UI when snapshot write fails

## Decision Record

- Date: 2026-05-10
- Branch / commit: record during manual acceptance
- Decision: Mutation integration is not ready.
- Recommendation: Do Task 4.25 Write-path Source-of-truth & Offline Strategy V1 as planning only.
- Rejected next steps: direct mutation prototype, App POST route wiring, source-of-truth switch implementation, production write backend, auth/sync implementation.
- Required next task: `Task 4.25 Write-path Source-of-truth & Offline Strategy V1`.
- Risks: data loss, double-write divergence, stale active sessions, offline failed writes, rollback complexity, browser bundle pollution, auth/privacy gap.
- Rollback requirement: a future write prototype must be disableable, backed up, explicit, and unable to report success when snapshot persistence fails.

## Final Recommendation

Task 4.24 result: Not ready for mutation integration.

Write-path migration remains blocked.

Next task should be Task 4.25 Write-path Source-of-truth & Offline Strategy V1.

Do not implement App mutation routes yet.

## Task 4.25 Follow-up Note

Task 4.25 adds `docs/WRITE_PATH_SOURCE_OF_TRUTH_OFFLINE_STRATEGY.md` as strategy-only follow-up work.

The Task 4.24 conclusion does not change: mutation integration is not ready, write-path migration remains blocked, existing mutation routes remain server/dev API only, and App runtime still does not call mutation routes.

Task 4.25 chooses Option E staged migration as the short-term source-of-truth direction while keeping localStorage as the current App source of truth. It also records that there is no offline mutation queue yet and that the next task should be `Task 4.26 Mutation UX Confirmation & Rollback Plan V1`.

## Task 4.26 Note

Task 4.26 adds mutation UX confirmation and rollback planning at `docs/MUTATION_UX_CONFIRMATION_ROLLBACK_PLAN.md`.

The Task 4.24 conclusion does not change: mutation integration is not ready, write-path migration remains blocked, existing mutation routes remain server/dev API only, and App runtime still does not call mutation routes.

Task 4.26 records no-fake-success rules, confirmation levels, rollback UX, duplicate-submit prevention, and conflict UX. No mutation prototype is implemented.

## Task 4.27 Note

Task 4.27 adds the lowest-risk mutation prototype plan at `docs/LOWEST_RISK_MUTATION_PROTOTYPE_PLAN.md`.

The Task 4.24 conclusion does not change: mutation integration is not ready, write-path migration remains blocked, existing mutation routes remain server/dev API only, and App runtime still does not call mutation routes.

Task 4.27 selects DataHealth issue dismiss as the first future candidate while keeping implementation blocked until a later explicit task.
