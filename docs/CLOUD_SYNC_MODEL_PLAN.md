# Cloud Sync Model Plan

## Scope / Non-goals

Task 6.18 is a cloud sync model plan before any sync metadata/conflict detector prototype.

This is docs/static tests only. This is not sync runtime implementation. This is not network write implementation. This is not cloud write implementation. This is not background sync implementation. This is not remote queue implementation. This is not production source-of-truth migration implementation.

This does not add routes, dependencies, package scripts, lockfile changes, browser runtime changes, storage runtime changes, cloud provider configuration, or real personal training data.

## Phase 6 Baseline

Task 6.0 through Task 6.17 are complete. Production backend activation, auth runtime, cloud sync runtime, deployment runtime, production source-of-truth migration, and normalized schema remain unimplemented.

`localStorage` remains default runtime source, fallback, migration source, and emergency backup. `api-primary-dev` remains explicit dev/local only and not production-ready.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

## Sync Model

Future sync must define local snapshot id, account id, device id, server revision, client revision, operation id, idempotency key, conflict status, and visible user resolution state.

Sync must start as detection and metadata before any remote write path is approved.

## Device Identity

Future device identity must be generated, scoped, revocable, and bound to account identity only after explicit auth/account approval.

Device identity must not be inferred silently from localStorage and must not attach data to the wrong account.

## Conflict Policy

Future conflict policy must classify no conflict, stale client, stale server, divergent edits, deletion conflict, duplicate operation, and account mismatch.

Automatic merge is not approved. User-visible conflict policy is required before multi-device writes.

## Idempotency

Future remote operations must use stable operation ids and idempotency keys to prevent duplicate cloud writes.

Retries must be safe, visible on failure, and blocked when source snapshot or account identity mismatches.

## No Sync Runtime

Task 6.18 adds no sync runtime, no network writes, no cloud writes, no remote queue, no background sync worker, and no conflict merge runtime.

## Decision

Task 6.18 result: cloud sync model plan only.

Decision: define sync model, device identity, conflict policy, and idempotency before any pure conflict detector prototype.

Recommended next task: `Task 6.19 Sync Metadata & Conflict Detector Prototype V1`.

Task 6.19 may add pure local sync metadata/conflict detector functions if safe. It must not add network calls, cloud writes, background sync, auth runtime, routes, dependencies, or source-of-truth switching.

## Decision Record

- Date: 2026-05-12
- Branch / commit: `codex/task6.18-cloud-sync-model-plan` / pending until merge
- Decision: plan sync metadata/conflict behavior and keep sync runtime blocked.
- Baseline: `localStorage` remains default runtime source and `api-primary-dev` remains dev/local only.
- Accepted routes: `POST /data-health/issues/:issueId/dismiss`; `POST /history/:id/data-flag`; `POST /history/:id/edit`; `POST /sessions/start`; `POST /sessions/active/patches`; `POST /sessions/active/complete`; `POST /sessions/active/discard`
- Still blocked: sync runtime, network writes, cloud writes, remote queue, background sync worker, automatic merge, source-of-truth switch.
- Required future gates: conflict detector prototype, sync conflict acceptance, privacy/security hardening, rollback/incident runbook, and manual acceptance.
- Next task: `Task 6.19 Sync Metadata & Conflict Detector Prototype V1`
- Rollback requirement: because this task adds docs/static tests only, rollback is reverting the Task 6.18 commit.

## Final Recommendation

Task 6.18 is complete after this task.

Do not start cloud sync runtime yet. Next task should be Task 6.19 Sync Metadata & Conflict Detector Prototype V1.

## Task 6.19 Follow-up

Task 6.19 Sync Metadata & Conflict Detector Prototype V1 follows this model plan with a pure local metadata classifier.

Task 6.19 may add `src/sync/syncConflictDetector.ts` and docs/static tests. It must not add sync runtime, network calls, cloud writes, remote queue, background sync worker, automatic merge runtime, auth runtime, routes, dependencies, package scripts, lockfile changes, or source-of-truth switching.

The next recommended task after Task 6.19 is `Task 6.20 Sync Conflict Acceptance V1`, docs/static tests only.
