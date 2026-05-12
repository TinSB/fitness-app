# Cloud Sync Conflict Resolution Architecture Gate

## Scope / Non-goals

Task 6.5 is a cloud sync and conflict resolution architecture gate at planning level.

This is docs/static tests only. This is not cloud sync implementation. This is not a remote write queue implementation. This is not a background sync worker implementation. This is not multi-device runtime implementation. This is not production backend implementation. This is not auth implementation. This is not deployment implementation. This is not production migration implementation. This is not production source-of-truth migration implementation.

This does not add routes, dependencies, package scripts, lockfile changes, browser runtime changes, storage runtime changes, cloud provider configuration, or real personal training data.

## Phase 6 Baseline

Task 6.0 preflight, Task 6.1 production architecture gate, Task 6.2 data ownership/privacy/security matrix, Task 6.3 auth lifecycle architecture gate, and Task 6.4 production backend/database architecture decision are complete.

`localStorage` remains default runtime source, fallback, migration source, and emergency backup. `api-primary-dev` remains explicit dev/local only and not production-ready.

Production backend, auth runtime, sync runtime, deployment runtime, monitoring runtime, normalized schema, and production source-of-truth migration remain unimplemented.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

## Sync Architecture Options

| Option | Benefits | Risks | Current blocker | Decision |
| --- | --- | --- | --- | --- |
| no sync | Preserves local-first safety and avoids remote corruption. | Does not support multi-device continuity. | Product must decide whether production accounts require sync. | Keep as baseline until future gates approve implementation. |
| manual backup sync | Uses explicit user intent and can remain backup-first. | User can import stale data or overwrite newer local state. | Needs export/delete/restore acceptance and conflict warnings. | Planning candidate only. |
| single-device cloud backup | Provides recovery without bidirectional merge complexity. | Cloud write duplication and privacy exposure still need controls. | Needs backend, auth, encryption, retention, and rollback gates. | Planning candidate only. |
| multi-device bidirectional sync | Supports accounts across devices. | Highest risk for conflict corruption, identity mismatch, duplicate writes, and silent data loss. | Needs conflict detector, idempotency, account identity, offline queue, and manual conflict policy. | Not approved for implementation by Task 6.5. |

## Conflict Detection

Future sync work must define source snapshot identity, device identity, server revision, client revision, write idempotency key, last acknowledged revision, and conflict reason before any remote write.

Task 6.5 does not implement conflict detection runtime. Any future detector must be pure and local first until a later task explicitly approves remote sync behavior.

## Conflict Merge Policy

Future sync work must define a conflict merge policy before any remote reconciliation is approved.

Automatic merge is not approved. Future merge work must distinguish safe metadata reconciliation from user-visible training data conflicts.

Training history, active sessions, settings, account identity, and deletion/export records require visible conflict policy, no fake success, and rollback before any auto-merge is considered.

## Remote Write Duplication

Future sync work must explicitly mitigate remote write duplication before any retrying cloud write path is approved.

Remote writes must be idempotent before sync runtime is approved. A future design must include a stable operation id, duplicate detection, retry policy, and visible failure when write confirmation is missing.

Task 6.5 adds no remote write queue and no cloud write runtime.

## Offline Queue Risk

Offline queues can replay stale AppData, duplicate cloud writes, or apply mutations to the wrong account. Future work must define queue ownership, expiry, account binding, revision checks, replay ordering, and rollback.

Task 6.5 adds no offline queue and no background sync worker.

## Source-of-truth Boundary

`localStorage` remains the default runtime source at Task 6.5. `api-primary-dev` remains explicit dev/local only and not production-ready.

Production cloud sync does not become a source of truth in Task 6.5. A production source-of-truth switch requires a future architecture gate, manual acceptance, migration/rollback plan, and explicit approval.

## Decision

Task 6.5 result: cloud sync and conflict resolution architecture gate only.

Decision: do not implement cloud sync, remote writes, background sync workers, or conflict merge runtime yet. Continue with deployment/environment/secrets planning before any sync runtime.

Recommended next task: `Task 6.6 Deployment, Environment & Secrets Strategy V1`.

Task 6.6 must be docs/static tests only. Task 6.6 must not implement deployment, production hosting, secrets runtime, auth, cloud sync, production backend, migration, routes, or source-of-truth switching.

## Decision Record

- Date: 2026-05-12
- Branch / commit: `codex/task6.5-cloud-sync-conflict-resolution-architecture-gate` / pending until merge
- Decision: keep sync/conflict work at architecture gate level and reject immediate cloud sync implementation.
- Baseline: `localStorage` remains default runtime source and `api-primary-dev` remains dev/local only.
- Accepted routes: `POST /data-health/issues/:issueId/dismiss`; `POST /history/:id/data-flag`; `POST /history/:id/edit`; `POST /sessions/start`; `POST /sessions/active/patches`; `POST /sessions/active/complete`; `POST /sessions/active/discard`
- Rejected immediate implementations: cloud sync runtime, multi-device sync, remote write queue, background sync worker, automatic conflict merge, production source-of-truth switch, production backend, auth runtime, deployment runtime.
- Required future gates: sync model plan, conflict detector prototype, sync conflict acceptance, account identity binding, backend adapter boundary, privacy/security review, migration/rollback, and manual acceptance.
- Next task: `Task 6.6 Deployment, Environment & Secrets Strategy V1`
- Rollback requirement: because this task adds docs/static tests only, rollback is reverting the Task 6.5 commit.

## Final Recommendation

Task 6.5 is complete after this task.

Do not start cloud sync implementation yet. Next task should be Task 6.6 Deployment, Environment & Secrets Strategy V1.

## Task 6.6 Follow-up

Task 6.6 Deployment, Environment & Secrets Strategy V1 records local/dev/staging/production environments, secrets storage, environment variables, branch rules, required checks, Vercel optional behavior, and rollback strategy as docs/static tests only.

It must keep production deployment, hosted production configuration, deployment config, secret values, secrets runtime, production backend runtime, auth runtime, cloud sync runtime, production migration, source-of-truth migration, package changes, browser routes, and real personal training data migration unimplemented.
