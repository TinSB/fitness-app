# Production Backend Database Architecture Decision

## Scope / Non-goals

Task 6.4 is a production backend and database architecture decision at planning level.

This is docs/static tests only. This is not production backend implementation. This is not a Fastify/Express/Koa/Hono server implementation. This is not a database migration implementation. This is not normalized schema implementation. This is not auth implementation. This is not cloud sync implementation. This is not deployment implementation. This is not production source-of-truth migration implementation.

This does not add routes, dependencies, package scripts, lockfile changes, user tables, normalized tables, hosted database configuration, production deployment configuration, or real personal training data.

## Phase 6 Baseline

Task 6.0 preflight, Task 6.1 production architecture gate, Task 6.2 production data ownership/privacy/security matrix, and Task 6.3 auth lifecycle architecture gate are complete.

`localStorage` remains default runtime source, fallback, migration source, and emergency backup. `api-primary-dev` remains explicit dev/local only and not production-ready.

Production backend, production database, normalized schema, auth, sync, deployment, monitoring, and production source-of-truth migration remain unimplemented.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

## Architecture Options

| Option | Benefits | Risks | Current blocker | Decision |
| --- | --- | --- | --- | --- |
| no backend yet | Preserves local-first safety and avoids premature production commitments. | Does not deliver hosted production accounts, sync, or centralized backup. | Phase 6 still needs skeleton boundaries and acceptance gates. | Keep as baseline until skeleton tasks prove boundaries. |
| single Node backend | Reuses existing Node/dev API knowledge and can centralize contracts. | Could accidentally promote dev-only assumptions or auto-listen behavior. | Needs adapter skeleton, auth boundary, deployment strategy, and data migration plan. | Candidate for future narrow skeleton only. |
| serverless API | Aligns with route-level deployment and preview/staging models. | Transaction boundaries, cold starts, secrets, and idempotency need design. | Needs environment strategy, database choice, and observability policy. | Planning candidate only. |
| hosted backend/database | Offloads availability and database operations. | Vendor lock-in, privacy review, export/delete policy, and migration complexity. | Needs provider selection, security review, backup policy, and cost review. | Planning candidate only. |
| local-first desktop backend | Keeps user data local and can reduce cloud privacy exposure. | Limits web production availability and multi-device sync. | Needs packaging/support/recovery plan. | Planning candidate only. |

## Current SQLite Snapshot Repository

The current SQLite snapshot repository model remains a dev/local API-backed runtime and migration prototype surface. It is not a production database architecture by itself.

Future production backend work may reuse route semantics and snapshot validation concepts, but Task 6.4 does not promote SQLite dev storage to production source of truth.

## Production Database Strategy

Production database strategy must decide storage ownership, schema versioning, backup/restore, transaction boundaries, source-of-truth behavior, account identity relationship, export/delete behavior, and rollback before implementation.

Task 6.4 does not create a production database, hosted database, schema migration, or production data store.

## Normalized Schema Risk

Normalized schema may be useful in a future production database, but it carries data loss, migration, rollback, query parity, and source-of-truth risks.

No normalized tables are added in Task 6.4. No normalized schema migration is approved by Task 6.4. Any future normalized schema task requires a separate schema strategy, dry-run, backup-first, rollback, and fixture parity gate.

## Migration / Rollback Requirements

Future production database work must require backup-first, dry-run, apply, rollback, restore verification, no automatic localStorage deletion, no silent overwrite, and explicit user approval before real-data migration.

No production migration is implemented in Task 6.4. No destructive migration is allowed.

## Backup Requirements

Future production backend/database work must define backup creation, backup verification, restore verification, retention, encryption/key ownership, export/delete implications, and incident rollback before production use.

Task 6.4 adds no backup runtime, no backup route, and no backup/import/export over HTTP.

## Decision

Task 6.4 result: production backend and database architecture decision only.

Decision: do not implement production backend or normalized database schema yet. Continue with planning and boundary tasks before any production runtime.

Recommended next task: `Task 6.5 Cloud Sync & Conflict Resolution Architecture Gate V1`.

Task 6.5 must be docs/static tests only. Task 6.5 must not implement cloud sync, remote writes, background sync, production backend, auth, deployment, migration, or source-of-truth switching.

## Decision Record

- Date: 2026-05-12
- Branch / commit: `codex/task6.4-production-backend-database-architecture-decision` / pending until merge
- Decision: keep backend/database work at planning level and reject immediate production backend or normalized schema implementation.
- Baseline: `localStorage` remains default runtime source and `api-primary-dev` remains dev/local only.
- Accepted routes: `POST /data-health/issues/:issueId/dismiss`; `POST /history/:id/data-flag`; `POST /history/:id/edit`; `POST /sessions/start`; `POST /sessions/active/patches`; `POST /sessions/active/complete`; `POST /sessions/active/discard`
- Rejected immediate implementations: production backend runtime, Fastify/Express/Koa/Hono server, hosted database, normalized tables, production migration, auth runtime, sync runtime, deployment runtime.
- Required future gates: backend adapter skeleton plan, database schema strategy, migration/rollback, backup/restore, auth boundary, sync conflict, deployment/environment, privacy/security, and manual acceptance.
- Next task: `Task 6.5 Cloud Sync & Conflict Resolution Architecture Gate V1`
- Rollback requirement: because this task adds docs/static tests only, rollback is reverting the Task 6.4 commit.

## Final Recommendation

Task 6.4 is complete after this task.

Do not start production backend or database implementation yet. Next task should be Task 6.5 Cloud Sync & Conflict Resolution Architecture Gate V1.

## Task 6.5 Follow-up

Task 6.5 Cloud Sync & Conflict Resolution Architecture Gate V1 records cloud sync and conflict resolution architecture as docs/static tests only.

It must keep cloud sync runtime, remote writes, background sync workers, automatic conflict merge, production backend runtime, auth runtime, deployment runtime, source-of-truth migration, package changes, browser routes, and real personal training data migration unimplemented.
