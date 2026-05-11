# Active Session Write Coverage Gap Audit

## Scope / Non-goals

Task 5.12 audits remaining active-session write gaps after the API-backed read runtime regression lock.

This is audit-only. It does not implement `POST /sessions/active/patches`, `POST /sessions/active/complete`, or `POST /sessions/active/discard` in browser runtime. It does not add a browser route, App.tsx integration, src/devApi runtime behavior, broad mutation client, source-of-truth migration, localStorage replacement, API primary runtime, production backend, auth, sync, cloud, deployment, package change, package script, normalized table, or training algorithm change.

localStorage remains source of truth. API results never overwrite AppData or localStorage.

## Current Baseline

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`

API-backed read runtime is GET-only and regression-locked.

Server-side active-session handlers exist as lower-level API contract surface, but browser runtime exposure remains blocked until explicit prototype tasks approve each route.

## Gap Inventory

Remaining active-session browser write gaps:

| Gap | Route | Current browser status | Future task |
| --- | --- | --- | --- |
| Session patch | `POST /sessions/active/patches` | Blocked from browser runtime | Task 5.13 plan, Task 5.14 prototype |
| Session complete | `POST /sessions/active/complete` | Blocked from browser runtime | Task 5.16 plan, Task 5.17 prototype |
| Session discard | `POST /sessions/active/discard` | Blocked from browser runtime | Task 5.19 plan, Task 5.20 prototype |

No other active-session write route is approved by this audit.

## Session Patch Gap

`POST /sessions/active/patches` is not ready for direct browser implementation without a planning task.

Risks:

- patch ordering can corrupt current workout state.
- stale step/set updates can overwrite newer local training data.
- duplicate patch submission can duplicate or erase training values.
- pending session patch identity must be explicit.
- source snapshot and idempotency metadata must be required.
- failure must be visible with no fake success.

Required gate: `Task 5.13 Session Patch Mutation Prototype Plan V1`.

## Session Complete Gap

`POST /sessions/active/complete` is not ready for direct browser implementation without a planning task.

Risks:

- duplicate complete can create duplicate history records.
- completion failure can leave activeSession/history split state.
- incomplete main work requires confirmation parity.
- source snapshot mismatch can complete the wrong session.
- recovery and rollback behavior must be documented.
- failure must be visible with no fake success.

Required gate: `Task 5.16 Session Complete Mutation Prototype Plan V1`.

## Session Discard Gap

`POST /sessions/active/discard` is not ready for direct browser implementation without a planning task.

Risks:

- discard can destroy unsaved training state.
- duplicate discard can hide a race with stale active session state.
- missing confirmation can cause accidental data loss.
- recovery policy must be visible before prototype work.
- no history write must be locked.
- failure must be visible with no fake success.

Required gate: `Task 5.19 Session Discard Mutation Prototype Plan V1`.

## Shared Requirements Before Each Prototype

Each future active-session write prototype must define:

- route-specific experiment flag.
- explicit confirmation behavior.
- pending and duplicate-submit lock.
- source snapshot metadata.
- request fingerprint.
- idempotency key.
- strict success shape.
- snapshot metadata required for success.
- visible failure states.
- no automatic retry.
- no optimistic local mutation.
- no localStorage write.
- no AppData overwrite from API result.
- no raw stack/raw response/AppData/localStorage dump.
- manual acceptance plan.
- route boundary tests.

## Route Boundary

Still blocked from browser runtime:

- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`
- `POST /data-health/repair/apply`
- backup/import/export over HTTP
- reset/recovery over HTTP
- source-of-truth migration
- production backend/auth/sync/cloud/deployment

## Source-of-truth Boundary

- localStorage remains source of truth.
- API results never overwrite AppData or localStorage.
- API primary runtime remains future work.
- no runtime source selector is implemented by this audit.
- no API-backed persistence adapter is implemented by this audit.
- no source-of-truth switch is approved by this audit.

## Decision

Do not implement remaining active-session write routes directly.

Next recommended task: `Task 5.13 Session Patch Mutation Prototype Plan V1`.

Task 5.13 must be planning-only and must not implement `POST /sessions/active/patches`.

## Decision Record

- Date: 2026-05-11
- Branch / commit: `codex/task5.12-active-session-write-coverage-gap-audit` / pending until merge
- Decision: audit active-session write gaps and keep browser exposure blocked until route-specific plans.
- Current accepted browser mutation routes: `POST /data-health/issues/:issueId/dismiss`; `POST /history/:id/data-flag`; `POST /history/:id/edit`; `POST /sessions/start`
- Gap routes: `POST /sessions/active/patches`; `POST /sessions/active/complete`; `POST /sessions/active/discard`
- Recommended next task: `Task 5.13 Session Patch Mutation Prototype Plan V1`
- Rollback requirement: revert the Task 5.12 docs/static-test commit.

## Final Recommendation

Task 5.12 result: active-session write gap audit only.
No active-session patch, complete, or discard browser route is implemented.
Browser mutation routes remain exactly DataHealth dismiss, History data-flag, Limited History Edit, and Session Start.
localStorage remains source of truth.
API results never overwrite AppData or localStorage.
Next task should be Task 5.13 Session Patch Mutation Prototype Plan V1, planning-only.
