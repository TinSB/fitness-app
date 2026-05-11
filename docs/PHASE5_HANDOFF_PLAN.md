# Phase 5 Handoff Plan

## Scope / Non-goals

Task 4.74 is a handoff plan only.

- This does not start Phase 5 implementation.
- This does not switch source of truth.
- This does not replace localStorage.
- This does not implement API-backed runtime.
- This does not add production backend, auth, sync, or deployment.
- This does not add a browser mutation route.
- This does not add package dependencies, package scripts, lockfile changes, normalized tables, schemas, storage adapters, or training algorithm changes.

## Phase 4 Final State

Accepted browser mutation routes at Phase 4 exit are exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`

localStorage remains source of truth. API results never overwrite AppData or localStorage. All accepted mutation prototypes are dev-only and explicit opt-in.

## Source-of-truth Migration Prerequisites

Before Phase 5 source-of-truth migration:

- source snapshot and checksum strategy approved.
- migration dry-run and validation report designed.
- backup-before-migration path designed.
- rollback and restore path designed.
- localStorage fallback model chosen.
- AppData overwrite rules approved.
- manual acceptance runbook written.

## API-backed Runtime Prerequisites

Before API-backed runtime implementation:

- read client architecture approved.
- route-specific write client architecture approved.
- broad mutation client remains rejected unless separately approved.
- offline behavior defined.
- no-fake-success and snapshot metadata rules preserved.
- browser build isolation rules preserved.

## Production / Auth / Sync Prerequisites

Before production backend readiness:

- production environment ownership defined.
- authentication model designed.
- sync model designed.
- deployment strategy designed.
- privacy and personal training data handling reviewed.
- monitoring and recovery ownership defined.

## Risk Register

| Risk | Severity | Mitigation | Required gate |
| --- | --- | --- | --- |
| Source-of-truth switch data loss | High | Require migration dry-run, backup, validation, and rollback. | Phase 5 migration gate. |
| API/localStorage divergence | High | Choose explicit fallback model and overwrite rules. | API-backed runtime plan approval. |
| Offline mutation loss | High | Define offline policy before writes become authoritative. | Offline strategy gate. |
| Production exposure | High | Design auth/sync/deployment before production use. | Production readiness gate. |
| Broad mutation client expansion | High | Keep route-specific clients unless separately approved. | Route allowlist gate. |
| Browser Node-only pollution | High | Keep runtime boundary and dist scans. | Browser build clean. |

## Recommended Phase 5 First Task

Recommended Phase 5 first task:

`Task 5.1 Source-of-truth Migration Architecture Gate V1`

Task 5.1 should be planning/gate work first. It should not immediately replace localStorage or implement API-backed runtime without the prerequisites above.

## Decision Record

- Date: 2026-05-11
- Branch / commit: `codex/task4.74-phase5-handoff-plan` / pending until merge
- Decision: hand off Phase 4 final state to future Phase 5 planning without starting Phase 5 implementation.
- Current accepted routes: `POST /data-health/issues/:issueId/dismiss`; `POST /history/:id/data-flag`; `POST /history/:id/edit`; `POST /sessions/start`
- Rejected next steps: automatic Phase 5 implementation, source-of-truth switch, localStorage replacement, API-backed runtime implementation, production backend/auth/sync/deployment, fifth mutation route.
- Recommended next task in Phase 4 chain: `Task 4.75 Phase 4 Completion & Archive V1`
- Recommended Phase 5 starting task after Phase 4 closes: `Task 5.1 Source-of-truth Migration Architecture Gate V1`

## Final Recommendation

Task 4.74 result: Phase 5 handoff planning only.
Do not start Phase 5 automatically.
localStorage remains source of truth at Phase 4 exit.
API-backed runtime is Phase 5 work.
production backend, auth, sync, and deployment are Phase 5+ work.
Next Phase 4 task should be Task 4.75 Phase 4 Completion & Archive V1.

## Task 4.75 Phase 4 Completion Follow-up

Task 4.75 adds `docs/PHASE4_COMPLETION_ARCHIVE.md` as the final Phase 4 archive.

- It marks Phase 4 complete.
- It does not start Phase 5 automatically.
- It keeps localStorage as source of truth at Phase 4 exit.
- It keeps API-backed runtime as Phase 5 work.
- It keeps production backend, auth, sync, and deployment as Phase 5+ work.
- It recommends Task 5.1 Source-of-truth Migration Architecture Gate V1 as the Phase 5 starting task only.
