# Task 12.1 Cloud Database / Sync Integration Entry Gate V1

This entry gate opens Phase 12 for guarded cloud database and manual sync candidate work only. It does not connect to Supabase, add dependencies, build tables, write cloud data, pull cloud data, or sync data.

## Phase 11 Completion Evidence

- Task 11.11 Phase 11 Completion Archive V1 completed in PR #213.
- Final Phase 11 merge commit: `407f2b993b1208c0098e49040b324706e4005637`.
- Final Phase 11 validation passed:
  - `npm run api:dev:build`
  - `npm run typecheck`
  - `npm test`: 992 files / 3892 tests
  - `npm run build`
  - dist token scan clean

## Phase 11 Delivered Boundaries

- Supabase Auth candidate decision
- Auth provider integration entry gate
- Auth environment and callback guard
- Provider-candidate adapter
- Auth session boundary
- Login/logout candidate UI
- Local account linking dry run
- Account-scoped backend-primary auth candidate
- Auth failure/emergency local mode
- Auth provider manual acceptance
- Phase 11 completion archive

Phase 11 did not implement real cloud sync, production deployment runtime, external monitoring upload, SaaS/multi-user runtime, normalized tables, destructive migration, or real personal training data.

## Phase 12 Authorized Candidate Categories

- Cloud database provider and architecture decision
- Supabase environment/project guard
- Cloud AppData data model strategy
- RLS/ownership policy plan
- Supabase client dependency authorization
- Supabase client adapter candidate
- Account-scoped cloud AppData repository candidate
- Local-to-cloud migration dry run
- Cloud read/pull candidate
- Cloud write/push candidate
- Cloud sync conflict detection
- Manual conflict resolution candidate
- Cloud operation journal and idempotency candidate
- Cloud fallback/rollback/emergency local mode
- Cloud database/sync manual acceptance
- Cloud database/sync regression lock
- Phase 12 completion archive

## Still Blocked

- Default cloud sync
- Background sync
- Automatic sync worker
- Timer or polling sync
- Service-worker sync
- Multi-device automatic sync
- Production deployment runtime
- External monitoring upload
- SaaS/multi-user runtime
- Normalized training tables
- Destructive migration
- Real personal training data
- Eighth browser mutation route
- Backup/import/export over HTTP
- Reset/recovery over HTTP
- `POST /data-health/repair/apply`
- Service role key in browser

## Preserved Invariants

- `localStorage` remains default, fallback, migration source, and emergency backup.
- Backend-primary candidate remains explicit opt-in and reversible.
- Fallback, rollback, and emergency restore remain available.
- `api-primary-dev` remains explicit dev/local only and not production-ready.
- Supabase Auth remains provider candidate only and does not imply cloud sync.
- Accepted browser mutation routes remain exactly seven.

Recommended next task: Task 12.2 Cloud Database Provider & Architecture Decision V1.

Task 12.2 is not part of Task 12.1. Auto-continue mode may begin Task 12.2 only after Task 12.1 is fully merged.
