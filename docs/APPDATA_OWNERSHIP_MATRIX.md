# AppData Ownership Matrix

## Scope / Non-goals

Task 5.2 defines an AppData ownership matrix for Phase 5 planning.

- This is documentation and static-test coverage only.
- This does not implement API-backed runtime.
- This does not switch source of truth.
- This does not replace localStorage.
- This does not modify `App.tsx`.
- This does not add a storage adapter, runtime source selector, migration tool, dual-write path, or offline mutation queue.
- This does not add production backend, auth, sync, cloud, deployment, or monitoring.
- This does not add a browser mutation route.
- This does not add package dependencies, package scripts, lockfile changes, normalized tables, schemas, storage adapters, or training algorithm changes.

## Current Baseline

At Task 5.2 entry, localStorage remains the App runtime source of truth.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`

API results never overwrite AppData or localStorage. API-backed runtime remains future Phase 5 work.

## Ownership Categories

Use these categories for Phase 5 planning:

- API-owned: data may be owned by API/SQLite only in a future explicit dev/local API primary mode.
- local-only: data remains browser-local and is not owned by API/SQLite.
- derived: data is recalculated from source data and must not become its own source of truth.
- migration-only: data exists only to validate, apply, or roll back migration.
- fallback-only: data exists only for backup, emergency fallback, or rollback.
- blocked: data or capability is not approved for Phase 5 ownership.

## AppData Ownership Matrix

| AppData area | Phase 5 category | Ownership decision | Gate before implementation |
| --- | --- | --- | --- |
| training history | API-owned | Candidate API/SQLite owner in explicit `api-primary-dev`; localStorage remains fallback. | API primary runtime acceptance and migration rollback. |
| active session | API-owned | Candidate API/SQLite owner after active-session write path is accepted and locked. | Session patch/complete/discard acceptance and regression lock. |
| program templates | API-owned | Candidate API/SQLite owner in explicit `api-primary-dev`; no template algorithm changes. | Runtime source selector and boot-from-API acceptance. |
| settings | API-owned | App training/settings data may be API-owned in `api-primary-dev`; browser-only dev flags remain local-only. | AppData schema parity and fallback policy. |
| screening profile | API-owned | Candidate API/SQLite owner in explicit `api-primary-dev`; no production profile sync. | Migration dry-run validation. |
| DataHealth | derived | DataHealth summaries remain derived; accepted dismiss state may be API-owned only through the approved dismiss route. | DataHealth route lock and source snapshot checks. |
| backup metadata | fallback-only | Backup/export metadata remains fallback and rollback support, not API runtime authority. | Backup-first migration strategy. |
| readMirror summaries | derived | Summaries are diagnostics and parity outputs, not source of truth. | Read runtime regression lock. |
| derived analytics | derived | Analytics, PR, e1RM, effectiveSet, and summaries remain derived from source data. | Training algorithm regression tests. |
| migration-only state | migration-only | Dry-run reports, apply records, and validation results are migration support only. | Migration dry-run and apply acceptance. |
| fallback-only state | fallback-only | localStorage backups and emergency recovery snapshots are fallback only. | Rollback and recovery hardening. |
| DataHealth repair | blocked | Browser DataHealth repair remains blocked. | Separate future approval only. |
| backup/import/export over HTTP | blocked | Browser backup/import/export HTTP routes remain blocked. | Separate future approval only. |
| reset/recovery over HTTP | blocked | Browser reset/recovery HTTP routes remain blocked. | Separate future approval only. |
| production/auth/sync/cloud state | blocked | Production identity, sync, cloud, deployment, and monitoring are Phase 6+ work. | Phase 6 architecture gate. |

## Source-of-truth Rules

- localStorage remains default source of truth.
- API/SQLite ownership is only a future dev/local candidate unless later Phase 5 implementation tasks pass their gates.
- Derived data must not overwrite source data.
- Migration-only state must not become App runtime source.
- Fallback-only state must not silently overwrite AppData or localStorage.
- Blocked capabilities remain unavailable from browser runtime.

## Implementation Gates

Before an AppData area can move from candidate ownership to implemented API ownership:

- runtime source flag plan must be complete.
- typed API client strategy must be complete.
- localStorage fallback behavior must be accepted.
- migration backup and rollback strategy must be accepted.
- offline/PWA conflict behavior must be accepted.
- manual acceptance must use a dedicated test browser profile and dedicated dev DB.
- browser build isolation must remain clean.

## Decision

Use this matrix as the Phase 5 ownership planning source.

Next task: `Task 5.3 API Client Runtime Strategy V1`.

Task 5.3 must be docs/static tests only. It must not implement API clients, runtime source selection, localStorage replacement, source-of-truth migration, production backend/auth/sync/deployment, or a new browser mutation route.

## Decision Record

- Date: 2026-05-11
- Branch / commit: `codex/task5.2-appdata-ownership-matrix` / pending until merge
- Decision: define candidate ownership categories and AppData area classifications before API client/runtime strategy work.
- Current accepted routes: `POST /data-health/issues/:issueId/dismiss`; `POST /history/:id/data-flag`; `POST /history/:id/edit`; `POST /sessions/start`
- Rejected next steps: immediate API ownership implementation, localStorage replacement, source-of-truth switch, dual-write, offline mutation queue, production backend/auth/sync/deployment, new mutation route.
- Recommended next task: `Task 5.3 API Client Runtime Strategy V1`
- Rollback requirement: because this matrix adds docs/static tests only, rollback is reverting the matrix commit.

## Final Recommendation

Task 5.2 result: ownership matrix only.
localStorage remains source of truth.
API results never overwrite AppData or localStorage.
No API-backed runtime is implemented.
No source-of-truth migration is implemented.
No production backend, auth, sync, cloud, deployment, or monitoring is added.
Next task should be Task 5.3 API Client Runtime Strategy V1.
