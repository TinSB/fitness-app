# Production Storage Backup Restore Acceptance

## Scope / Non-goals

Task 6.17 is acceptance documentation and static tests for production storage backup and restore strategy.

This is docs/static tests only. This is not backup runtime implementation. This is not restore runtime implementation. This is not destructive restore implementation. This is not database write implementation. This is not migration apply implementation. This is not production source-of-truth migration implementation.

This does not add routes, dependencies, package scripts, lockfile changes, normalized tables, SQL files, browser storage writes, SQLite writes, cloud writes, or real personal training data.

## Backup-first Acceptance

Future production migration or storage apply must be backup-first. Backup must be created before any write, validated for readability, tied to source snapshot identity, and documented with restore steps.

Task 6.17 adds no backup runtime and no backup/import/export over HTTP.

## Restore Verification

Future restore must verify backup readability, schema/version compatibility, expected record counts or snapshot keys, source-of-truth consistency, localStorage fallback, and user-visible recovery state.

Restore verification must fail visibly. No fake success is allowed.

## Rollback Drill

Future rollback drill must rehearse restore from backup in a dedicated test environment with synthetic data only. It must document rollback owner, rollback trigger, validation checklist, and incident communication.

No rollback runtime is implemented in Task 6.17.

## No Real Data Automation

Automated tasks must use no real personal training data. Manual validation must use a dedicated browser profile, dedicated dev DB, and synthetic data unless a future approved task explicitly defines controlled real-data handling.

## No Destructive Restore

Task 6.17 does not delete localStorage, overwrite production data, write SQLite, clear accounts, upload cloud data, or perform destructive restore.

Any future destructive restore requires explicit separate approval, backup verification, rollback plan, and manual acceptance.

## Route and Source-of-truth Boundary

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

`localStorage` remains default runtime source, fallback, migration source, and emergency backup. `api-primary-dev` remains explicit dev/local only and not production-ready.

## Decision

Task 6.17 result: production storage backup/restore acceptance only.

Decision: keep backup/restore at acceptance/runbook level and keep backup runtime, restore runtime, destructive restore, and migration apply blocked.

Recommended next task: `Task 6.18 Cloud Sync Model Plan V1`.

Task 6.18 must be docs/static tests only. Task 6.18 must not implement sync runtime, network writes, cloud writes, background sync, routes, dependencies, or source-of-truth switching.

## Decision Record

- Date: 2026-05-12
- Branch / commit: `codex/task6.17-production-storage-backup-restore-acceptance` / pending until merge
- Decision: document backup/restore acceptance and keep restore runtime blocked.
- Baseline: `localStorage` remains default runtime source and `api-primary-dev` remains dev/local only.
- Accepted routes: `POST /data-health/issues/:issueId/dismiss`; `POST /history/:id/data-flag`; `POST /history/:id/edit`; `POST /sessions/start`; `POST /sessions/active/patches`; `POST /sessions/active/complete`; `POST /sessions/active/discard`
- Still blocked: backup runtime, restore runtime, destructive restore, database writes, migration apply, backup/import/export over HTTP, reset/recovery over HTTP.
- Required future gates: cloud sync model plan, sync conflict acceptance, rollback/incident runbook, export/delete plan, and manual acceptance.
- Next task: `Task 6.18 Cloud Sync Model Plan V1`
- Rollback requirement: because this task adds docs/static tests only, rollback is reverting the Task 6.17 commit.

## Final Recommendation

Task 6.17 is complete after this task.

Do not start backup/restore runtime yet. Next task should be Task 6.18 Cloud Sync Model Plan V1.

## Task 6.18 Follow-up

Task 6.18 Cloud Sync Model Plan V1 follows this backup/restore acceptance work with docs/static tests only.

Task 6.18 documents sync model, device identity, conflict policy, idempotency, and no sync runtime. It must not implement sync runtime, network writes, cloud writes, remote queue, background sync worker, conflict merge runtime, routes, dependencies, package scripts, lockfile changes, or source-of-truth switching.

The next recommended task after Task 6.18 is `Task 6.19 Sync Metadata & Conflict Detector Prototype V1`, pure local metadata/conflict detector only if safe.
