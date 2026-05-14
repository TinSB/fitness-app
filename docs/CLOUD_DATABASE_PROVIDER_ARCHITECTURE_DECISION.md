# Task 12.2 Cloud Database Provider & Architecture Decision V1

Phase 12 selects Supabase Postgres as the preferred cloud database candidate. This is a decision document only; it does not add the Supabase SDK, create schema, apply SQL, connect to a project, or sync data.

## Required Decision

- Preferred cloud database candidate: Supabase Postgres.
- Access pattern: backend-boundary first.
- Frontend direct AppData cloud writes: blocked.
- Initial data model: document-first AppData snapshot model.
- Normalized training tables: blocked.
- Dev SQLite snapshot repository: not a cloud database.
- Firebase/custom DB: not the first path.

## Rationale

Supabase Postgres aligns with the Phase 11 Supabase Auth candidate and gives a plausible later path to user-scoped data and RLS. Backend-boundary first is safer than direct browser AppData writes because owner checks, rollback, validation, and conflict handling can be centralized before any source-of-truth change is considered.

IronPath AppData is currently complex and local-first. A document-first AppData cloud snapshot model preserves the existing AppData contract while Phase 12 builds dry-run, conflict, and manual confirmation boundaries. Normalized exercise, session, history, and set tables are blocked in Phase 12 because they would create high migration risk and premature cloud schema coupling.

## Rejected Phase 12 Paths

- Frontend direct AppData cloud writes.
- Normalized exercise/session/history/set tables.
- Destructive migration.
- Partial cloud table migration.
- Default cloud sync.
- Background or automatic sync.
- Dev SQLite snapshot repository as cloud database.
- Firebase/custom database as first path.

## Boundary Confirmation

No Supabase dependency is added in this task. No database schema, SQL migration, cloud client, cloud read, cloud write, default sync, background sync, or source-of-truth switch is implemented. `localStorage` remains default, fallback, migration source, and emergency backup.

Recommended next task: Task 12.3 Supabase Environment / Project Guard V1.
