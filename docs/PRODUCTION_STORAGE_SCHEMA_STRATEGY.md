# Production Storage Schema Strategy

## Scope / Non-goals

Task 6.15 is a production storage schema strategy before any migration dry-run prototype.

This is docs/static tests only. This is not schema implementation. This is not normalized table implementation. This is not production database migration implementation. This is not database write implementation. This is not production source-of-truth migration implementation. This is not production backend activation.

This does not add routes, dependencies, package scripts, lockfile changes, browser runtime changes, storage runtime changes, migration files, normalized tables, SQL files, or real personal training data.

## Phase 6 Baseline

Task 6.0 through Task 6.14 are complete. Production backend activation, auth runtime, sync runtime, deployment runtime, production source-of-truth migration, and normalized schema remain unimplemented.

`localStorage` remains default runtime source, fallback, migration source, and emergency backup. `api-primary-dev` remains explicit dev/local only and not production-ready.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

## Snapshot Repository Strategy

The current SQLite snapshot repository remains a dev/local prototype model, not a production schema commitment. Snapshot storage keeps AppData shape intact and reduces migration risk while production ownership, auth, sync, and rollback gates mature.

Future production storage may start with snapshot-style storage for parity and recovery, but must document versioning, validation, backup/restore, export/delete, and rollback before production use.

## Normalized Schema Future Risk

Normalized schema may improve queryability, reporting, and account-level operations later, but it introduces migration risk, rollback complexity, derived data drift, route parity risk, and destructive data-loss risk.

No normalized schema and no normalized tables are added in Task 6.15. Any future normalized schema requires separate approval, fixtures, dry-run, backup-first apply, rollback, and source-of-truth gates.

Task 6.15 approves no normalized schema and no schema implementation.

## Migration Strategy

Future migration strategy must be backup-first, dry-run first, idempotent, versioned, visible on failure, and reversible. It must preserve localStorage as fallback, migration source, and emergency backup.

Task 6.15 does not implement migration dry-run, migration apply, production writes, or real-data automation.

## Rollback Strategy

Future storage schema work must define rollback from target storage to verified backup, localStorage fallback behavior, account binding rollback, schema version rollback, and recovery drill evidence.

No rollback runtime is implemented in Task 6.15.

## Backup Strategy

Future production storage work must define backup contents, restore verification, retention, encryption/key ownership, export/delete implications, and incident recovery.

Task 6.15 adds no backup runtime, no restore runtime, and no backup/import/export over HTTP.

## Decision

Task 6.15 result: production storage schema strategy only.

Decision: keep snapshot repository strategy as the safest near-term production storage planning baseline and reject normalized schema implementation for Task 6.15.

Recommended next task: `Task 6.16 Production Storage Migration Dry-run Prototype V1`.

Task 6.16 may add docs/tests and a pure dry-run utility only if safe. It must not write a database, create schema migration, use real personal training data, add routes, add dependencies, or switch source of truth.

## Decision Record

- Date: 2026-05-12
- Branch / commit: `codex/task6.15-production-storage-schema-strategy` / pending until merge
- Decision: document storage schema strategy and keep normalized schema unimplemented.
- Baseline: `localStorage` remains default runtime source and `api-primary-dev` remains dev/local only.
- Accepted routes: `POST /data-health/issues/:issueId/dismiss`; `POST /history/:id/data-flag`; `POST /history/:id/edit`; `POST /sessions/start`; `POST /sessions/active/patches`; `POST /sessions/active/complete`; `POST /sessions/active/discard`
- Still blocked: normalized tables, schema migration, database writes, production source-of-truth switch, destructive migration, backup/import/export over HTTP.
- Required future gates: migration dry-run prototype, backup/restore acceptance, rollback drill, export/delete plan, privacy/security hardening, and manual acceptance.
- Next task: `Task 6.16 Production Storage Migration Dry-run Prototype V1`
- Rollback requirement: because this task adds docs/static tests only, rollback is reverting the Task 6.15 commit.

## Final Recommendation

Task 6.15 is complete after this task.

Do not create normalized tables yet. Next task should be Task 6.16 Production Storage Migration Dry-run Prototype V1.

## Task 6.16 Follow-up

Task 6.16 Production Storage Migration Dry-run Prototype V1 adds `src/storage/productionStorageMigrationDryRun.ts` as a pure inspection-only dry-run utility with `writesPerformed: false`.

It must keep database writes, schema migration, normalized tables, real-data automation, migration apply, production source-of-truth migration, package changes, route additions, and real personal training data migration unimplemented.
