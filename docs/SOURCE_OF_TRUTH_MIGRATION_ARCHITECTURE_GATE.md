# Source-of-truth Migration Architecture Gate

## Scope / Non-goals

Task 5.1 is an architecture gate for Phase 5 source-of-truth migration work.

- This is not source-of-truth migration implementation.
- This does not modify `App.tsx`.
- This does not replace localStorage.
- This does not implement API-backed runtime.
- This does not add an API-backed persistence adapter.
- This does not add dual-write.
- This does not add an offline mutation queue.
- This does not add production backend, auth, sync, cloud, deployment, or monitoring.
- This does not add a browser mutation route.
- This does not add package dependencies, package scripts, lockfile changes, normalized tables, schemas, storage adapters, or training algorithm changes.

## Current Phase 4 Exit State

Phase 4 is complete. Accepted browser mutation routes at Phase 5 entry are exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`

All four routes are dev-only, explicit opt-in prototypes. API-backed runtime and source-of-truth migration remain Phase 5 work. Production backend, auth, sync, cloud, deployment, and monitoring remain Phase 6+ work.

## localStorage Source-of-truth Baseline

- localStorage remains App runtime source of truth at Phase 5 entry.
- API results do not silently overwrite localStorage.
- API results do not silently overwrite AppData outside approved dev-only prototype behavior.
- localStorage remains the fallback and emergency recovery source until a later Phase 5 task explicitly implements and accepts dev/local API primary mode.
- No destructive real user data migration is approved by this gate.

## API / SQLite Candidate Ownership

API/SQLite is a candidate future owner for App runtime data only after later Phase 5 gates pass.

Candidate ownership must be decided before implementation for:

- training history
- active session
- program templates
- settings
- screening profile
- DataHealth
- backup metadata
- readMirror summaries
- derived analytics
- migration-only state
- fallback-only state

Task 5.1 does not assign final ownership. Task 5.2 must define the AppData ownership matrix before runtime source selection or migration implementation.

## Migration Risks

| Risk | Severity | Mitigation | Required gate |
| --- | --- | --- | --- |
| Silent AppData overwrite | High | Require explicit runtime source mode and visible failure. | Runtime source flag gate. |
| localStorage/API divergence | High | Define ownership and fallback rules before implementation. | AppData ownership matrix. |
| Destructive migration | High | Require backup-first dry-run and rollback. | Migration backup and rollback plan. |
| Offline training loss | High | Define offline/PWA conflict behavior. | Offline conflict strategy. |
| API unavailable at boot | High | Preserve localStorage fallback and visible diagnostics. | API-backed read runtime acceptance. |
| Broad mutation client expansion | High | Keep typed route-specific clients. | API client runtime strategy. |
| Production exposure | High | Keep Phase 5 dev/local only. | Phase 6 production gate. |
| Browser Node-only pollution | High | Keep runtime boundary and dist scans green. | Browser build isolation gate. |

## Fallback Strategy

- Default runtime source remains localStorage.
- Future API-backed read mode must fall back safely when the Dev API is unavailable.
- Future API primary dev mode must be explicit dev/local opt-in only.
- localStorage must remain available as fallback, migration source, and emergency recovery source.
- API primary dev mode must not silently write migration results back into localStorage.
- Failure must be visible; no fake success is accepted.

## Rollback Strategy

- Migration work must be backup-first.
- A future dry-run must validate localStorage AppData before any SQLite write.
- A future apply prototype must require explicit confirmation.
- Rollback must restore from a known localStorage backup or documented SQLite snapshot backup.
- Failed migration must leave localStorage intact.
- No task may delete localStorage automatically.

## Required Gates Before Implementation

- Task 5.2 AppData Ownership Matrix V1 completed.
- Task 5.3 API Client Runtime Strategy V1 completed.
- Task 5.4 Runtime Source Switch Feature Flag Plan V1 completed.
- Task 5.5 Migration Backup & Rollback Strategy V1 completed.
- Task 5.6 Offline / PWA Conflict Strategy V1 completed.
- Task 5.7 API-backed Read Runtime Plan V1 completed.
- Dedicated manual acceptance exists before user-facing migration apply.
- Browser build isolation remains clean.
- No production backend/auth/sync/deployment assumption is introduced.

## Decision

Proceed with Phase 5 planning gates before implementation.

Next task: `Task 5.2 AppData Ownership Matrix V1`.

Task 5.2 must be docs/static tests only. It must not modify `App.tsx`, switch source of truth, replace localStorage, implement API-backed runtime, add a browser mutation route, or add production backend/auth/sync/deployment.

## Decision Record

- Date: 2026-05-11
- Branch / commit: `codex/task5.1-source-of-truth-migration-architecture-gate` / pending until merge
- Decision: start Phase 5 with an architecture gate; do not implement migration or runtime source switching in Task 5.1.
- Current accepted routes: `POST /data-health/issues/:issueId/dismiss`; `POST /history/:id/data-flag`; `POST /history/:id/edit`; `POST /sessions/start`
- Rejected next steps: immediate localStorage replacement, API primary runtime implementation, dual-write, offline mutation queue, production backend/auth/sync/deployment, fifth mutation route.
- Recommended next task: `Task 5.2 AppData Ownership Matrix V1`
- Rollback requirement: because this gate adds docs/static tests only, rollback is reverting the gate commit.

## Final Recommendation

Task 5.1 result: architecture gate only.
localStorage remains source of truth.
API results never silently overwrite AppData or localStorage.
No source-of-truth migration is implemented.
No API-backed runtime is implemented.
No production backend, auth, sync, cloud, deployment, or monitoring is added.
Next task should be Task 5.2 AppData Ownership Matrix V1.

## Task 5.2 AppData Ownership Matrix Follow-up

Task 5.2 adds `docs/APPDATA_OWNERSHIP_MATRIX.md` as an ownership matrix only.

- It classifies AppData areas as API-owned, local-only, derived, migration-only, fallback-only, or blocked.
- It does not implement API-backed runtime.
- It keeps localStorage as source of truth.
- It keeps API results from overwriting AppData/localStorage.
- It recommends Task 5.3 API Client Runtime Strategy V1 as docs/static tests only.
