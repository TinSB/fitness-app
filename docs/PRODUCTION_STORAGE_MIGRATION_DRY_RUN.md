# Production Storage Migration Dry-run

## Scope / Non-goals

Task 6.16 adds a safe production storage migration dry-run prototype.

This task adds docs/tests and a pure dry-run utility only. This is not database write implementation. This is not schema migration implementation. This is not production source-of-truth migration implementation. This is not production backend activation. This is not real-data automation.

This does not add routes, dependencies, package scripts, lockfile changes, normalized tables, SQL files, SQLite writes, browser storage writes, cloud writes, or real personal training data.

## Dry-run Utility

The dry-run utility is `src/storage/productionStorageMigrationDryRun.ts`.

It accepts an unknown synthetic snapshot, optional source label, and optional expected version. It returns a structured dry-run result with `ok`, `status`, `errors`, `warnings`, summary metadata, `target: "dry-run-only"`, and `writesPerformed: false`.

The utility does not import SQLite, does not call localStorage, does not write a database, does not create schema migration files, does not upload data, and does not mutate AppData.

## Safety Semantics

Dry-run must be inspection-only. Invalid sources block the dry-run with visible errors. Empty sources and version mismatches produce warnings.

Dry-run output must not be treated as migration apply approval. A future apply task requires separate approval, verified backup, idempotency, rollback, and manual acceptance.

## Real Data Boundary

Automated tests must use synthetic snapshots only. Real personal training data must not be used in automation.

Manual validation must use a dedicated browser profile and dedicated dev DB if a future manual flow is added.

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

Task 6.16 does not switch source of truth and does not delete or overwrite localStorage.

## Decision

Task 6.16 result: safe production storage migration dry-run prototype only.

Decision: allow a pure inspection-only dry-run utility and keep database writes, schema migration, real-data automation, production source-of-truth migration, and migration apply blocked.

Recommended next task: `Task 6.17 Production Storage Backup / Restore Acceptance V1`.

Task 6.17 must be docs/static tests only. It must not perform real data automation, destructive restore, database writes, route additions, package changes, or source-of-truth switching.

## Decision Record

- Date: 2026-05-12
- Branch / commit: `codex/task6.16-production-storage-migration-dry-run` / pending until merge
- Decision: add pure dry-run utility and keep migration apply blocked.
- Baseline: `localStorage` remains default runtime source and `api-primary-dev` remains dev/local only.
- Accepted routes: `POST /data-health/issues/:issueId/dismiss`; `POST /history/:id/data-flag`; `POST /history/:id/edit`; `POST /sessions/start`; `POST /sessions/active/patches`; `POST /sessions/active/complete`; `POST /sessions/active/discard`
- Still blocked: database writes, schema migration, normalized tables, real-data automation, migration apply, production source-of-truth switch, route additions.
- Required future gates: backup/restore acceptance, rollback drill, export/delete plan, privacy/security hardening, and manual acceptance.
- Next task: `Task 6.17 Production Storage Backup / Restore Acceptance V1`
- Rollback requirement: reverting Task 6.16 removes the dry-run utility and docs/static tests.

## Final Recommendation

Task 6.16 is complete after this task.

Do not start migration apply or database writes yet. Next task should be Task 6.17 Production Storage Backup / Restore Acceptance V1.

## Task 6.17 Follow-up

Task 6.17 Production Storage Backup / Restore Acceptance V1 records backup-first, restore verification, rollback drill, no real data automation, and no destructive restore as docs/static tests only.

It must keep backup runtime, restore runtime, destructive restore, database writes, migration apply, production source-of-truth migration, package changes, route additions, and real personal training data migration unimplemented.
