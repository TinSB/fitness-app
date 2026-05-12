# Production Sync Conflict Final Audit

## Scope / Non-goals

Task 6.34 is the final Phase 6 audit for sync and conflict behavior.

This is docs/static tests only. This is not sync runtime implementation. This is not network write implementation. This is not cloud write implementation. This is not background sync worker implementation. This is not remote write queue implementation. This is not automatic merge implementation. This is not production source-of-truth migration implementation.

This task adds no dependencies, package scripts, lockfile changes, browser routes, server routes, auth provider, deployment provider, sync provider, secret values, production data migration, normalized tables, or real personal training data.

## Phase 6 Baseline

Tasks 6.0 through 6.33 are complete. Task 6.18 planned the cloud sync model. Task 6.19 added a pure local sync metadata/conflict detector. Task 6.20 accepted the detector semantics. Task 6.33 accepted backup/export/delete/recovery boundaries.

Cloud sync runtime remains unimplemented. The accepted sync artifact is a pure local metadata classifier only.

`localStorage` remains default runtime source, fallback, migration source, and emergency backup. `api-primary-dev` remains explicit dev/local only and not production-ready.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

## No Sync Runtime

No sync runtime is implemented. No cloud provider is configured. No background sync worker is registered. No remote write queue is created. No network write path is added.

Manual acceptance must record sync status as `not implemented` unless a future approved task explicitly adds sync runtime.

## Sync Scope If Implemented Later

Future sync scope must define account identity, device identity, snapshot identity, idempotency key, conflict status, source-of-truth boundary, rollback behavior, and user-visible failure state before any write path is approved.

Future sync must not silently overwrite AppData or localStorage.

## Conflict Model

The accepted conflict model classifies `no_conflict`, `stale_client`, `stale_server`, `divergent_edits`, `deletion_conflict`, `duplicate_operation`, `account_mismatch`, and `invalid_metadata`.

The model classifies metadata only. It does not apply changes, reconcile snapshots, delete records, upload data, or mark conflicts resolved.

## Idempotency

Duplicate operation detection is accepted only as local metadata classification. It is not a remote acknowledgement and does not approve cloud writes.

Any future retry path must use stable operation ids, idempotency keys, visible failure, and source snapshot validation.

## Duplicate Cloud Write Prevention

Future sync must prevent duplicate cloud writes by requiring idempotency keys, source snapshot metadata, account identity validation, device identity validation, and visible retry/failure state.

Task 6.34 adds no duplicate cloud write prevention runtime because no cloud write runtime exists.

## Offline Behavior

Offline behavior is not implemented. Future offline behavior must define queue ownership, retry policy, stale snapshot detection, conflict surfacing, cancellation, and rollback before any background sync worker is approved.

## Source-of-truth Rules

Production source-of-truth switching is not approved. API/SQLite production primary is not approved. localStorage fallback and emergency backup remain required.

The detector result must never silently overwrite AppData or localStorage.

## Rollback

Future sync rollback must define rollback owner, trigger, snapshot recovery, duplicate operation handling, account mismatch handling, privacy response, and post-rollback validation.

Task 6.34 performs no rollback runtime operation.

## Route Boundary

No new browser mutation route is added. DataHealth repair remains blocked. Backup/import/export over HTTP remains blocked. Reset/recovery over HTTP remains blocked. Auth/sync/cloud routes remain blocked unless a future approved task explicitly adds them.

## Decision

Task 6.34 result: production sync/conflict final audit documentation and static tests only.

Decision: accept the current sync state as planned/pure-local conflict classification only. Keep sync runtime, network writes, cloud writes, background sync, remote write queues, automatic merge, and production source-of-truth switching blocked.

Recommended next task: `Task 6.35 Production Deployment & Environment Final Audit V1`.

Task 6.35 must be docs/static tests only. It must not add production deployment, deployment config that changes production behavior, secret values, package changes, routes, source-of-truth switching, or real-data migration.

## Decision Record

- Date: 2026-05-12
- Branch / commit: `codex/task6.34-production-sync-conflict-final-audit` / pending until merge
- Decision: lock sync/conflict final audit without sync runtime.
- Baseline: `localStorage` remains default runtime source and `api-primary-dev` remains dev/local only.
- Accepted routes: `POST /data-health/issues/:issueId/dismiss`; `POST /history/:id/data-flag`; `POST /history/:id/edit`; `POST /sessions/start`; `POST /sessions/active/patches`; `POST /sessions/active/complete`; `POST /sessions/active/discard`
- Still blocked: sync runtime, cloud writes, network writes, background sync worker, remote write queue, automatic merge, source-of-truth switch.
- Required future gates: deployment environment final audit, monitoring/logging privacy lock, release candidate regression lock, Phase 6 exit lock.
- Next task: `Task 6.35 Production Deployment & Environment Final Audit V1`
- Rollback requirement: revert the Task 6.34 commit; no runtime state is involved.

## Final Recommendation

Task 6.34 is complete after this task.

Do not start sync runtime yet. Next task should be Task 6.35 Production Deployment & Environment Final Audit V1.
