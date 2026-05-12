# Production Migration Backup Rollback Strategy

## Scope / Non-goals

Task 6.7 is a production migration, backup, rollback, and recovery strategy at planning level.

This is docs/static tests only. This is not migration implementation. This is not destructive migration implementation. This is not production source-of-truth migration implementation. This is not production database implementation. This is not backup runtime implementation. This is not restore runtime implementation. This is not export/delete runtime implementation. This is not production backend implementation. This is not auth implementation. This is not cloud sync implementation. This is not deployment implementation.

This does not add routes, database writes, normalized tables, migration files, dependencies, package scripts, lockfile changes, browser runtime changes, storage runtime changes, or real personal training data.

## Phase 6 Baseline

Task 6.0 through Task 6.6 are complete. Production backend, auth runtime, sync runtime, deployment runtime, monitoring runtime, normalized schema, and production source-of-truth migration remain unimplemented.

`localStorage` remains default runtime source, fallback, migration source, and emergency backup. `api-primary-dev` remains explicit dev/local only and not production-ready.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

## Backup-first Rule

The backup-first rule is mandatory for any future production migration.

Any future production migration must create a verified backup before apply. Backup must include source data, target snapshot metadata, schema/version metadata, account identity mapping when accounts exist, and restore instructions.

No backup runtime, backup route, backup export route, or cloud backup is implemented in Task 6.7.

## Dry-run Strategy

Future migration dry-run must validate source data, target schema expectations, ownership mapping, export/delete implications, rollback readiness, and expected warnings without writing production data.

Dry-run results must be visible and must not silently overwrite `localStorage`, AppData, SQLite snapshots, or production storage.

## Apply Strategy

Future apply must require explicit approval, verified backup, source snapshot identity, idempotency key, visible progress, visible failure, and no fake success.

Task 6.7 does not implement migration apply, production writes, normalized schema writes, or real-data automation.

## Rollback Strategy

Future rollback must define restore target, restore verification, source-of-truth restoration, account binding restoration, localStorage fallback behavior, incident owner, and user-visible recovery state.

Rollback must be rehearsed in a dedicated test environment before any real production migration approval.

## Recovery Drill

Future recovery drills must verify backup readability, restore completeness, schema/version compatibility, source-of-truth consistency, export/delete records, and privacy-safe logging.

No recovery runtime, reset route, or restore route is implemented in Task 6.7.

## Export / Delete Implications

Future production migration must preserve export/delete responsibilities. Account deletion, training data deletion, backup retention, audit retention, and deletion tombstones require separate approval before production use.

Task 6.7 does not implement export over HTTP, delete over HTTP, backup/import/export over HTTP, or account deletion runtime.

## Real Data Safety

Automated tasks must use no real personal training data. Manual validation must use a dedicated browser profile, dedicated dev DB, and synthetic data unless a future task explicitly approves controlled real-data handling.

Task 6.7 requires no destructive migration and no real-data automation.

No destructive migration, automatic localStorage deletion, production data overwrite, or cloud upload is approved by Task 6.7.

## Decision

Task 6.7 result: production migration, backup, rollback, and recovery strategy only.

Decision: do not implement migration runtime, backup/restore runtime, export/delete runtime, destructive migration, real-data automation, or production source-of-truth switching yet. Continue with the Phase 6 architecture checkpoint and boundary lock.

Recommended next task: `Task 6.8 Phase 6 Architecture Checkpoint & Boundary Lock V1`.

Task 6.8 must be docs/static tests only. Task 6.8 must not implement production backend runtime, auth runtime, sync runtime, deployment runtime, normalized schema, migration runtime, routes, package changes, or source-of-truth switching.

## Decision Record

- Date: 2026-05-12
- Branch / commit: `codex/task6.7-production-migration-backup-rollback-strategy` / pending until merge
- Decision: keep production migration, backup, rollback, and recovery work at strategy level.
- Baseline: `localStorage` remains default runtime source and `api-primary-dev` remains dev/local only.
- Accepted routes: `POST /data-health/issues/:issueId/dismiss`; `POST /history/:id/data-flag`; `POST /history/:id/edit`; `POST /sessions/start`; `POST /sessions/active/patches`; `POST /sessions/active/complete`; `POST /sessions/active/discard`
- Rejected immediate implementations: migration runtime, backup runtime, restore runtime, export/delete runtime, destructive real-data migration, normalized schema, production source-of-truth switch, production backend runtime.
- Required future gates: migration dry-run, migration apply approval, backup/restore acceptance, rollback/incident runbook, export/delete plan, privacy/security review, and manual acceptance.
- Next task: `Task 6.8 Phase 6 Architecture Checkpoint & Boundary Lock V1`
- Rollback requirement: because this task adds docs/static tests only, rollback is reverting the Task 6.7 commit.

## Final Recommendation

Task 6.7 is complete after this task.

Do not start production migration implementation yet. Next task should be Task 6.8 Phase 6 Architecture Checkpoint & Boundary Lock V1.

## Task 6.8 Follow-up

Task 6.8 Phase 6 Architecture Checkpoint & Boundary Lock V1 records architecture decisions, still-blocked implementation, source-of-truth status, route allowlist, CI/ruleset policy, and coverage inventory as docs/static tests only.

It must keep production backend runtime, auth runtime, sync runtime, deployment runtime, normalized schema, migration runtime, production source-of-truth migration, package changes, browser routes, and real personal training data migration unimplemented.
