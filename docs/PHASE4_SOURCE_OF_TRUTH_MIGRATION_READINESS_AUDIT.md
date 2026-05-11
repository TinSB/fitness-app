# Phase 4 Source-of-truth Migration Readiness Audit

## Scope / Non-goals

Task 4.69 is an audit-only readiness review for a future source-of-truth migration.

- This does not switch source of truth.
- This does not replace localStorage.
- This does not add API-backed runtime persistence.
- This does not add dual-write.
- This does not add an offline mutation queue.
- This does not add production backend, auth, sync, or deployment.
- This does not add a browser mutation route.
- This does not add package dependencies, package scripts, lockfile changes, normalized tables, schemas, storage adapters, or training algorithm changes.
- Phase 5 is required before any source-of-truth migration implementation.

## Current Phase 4 Baseline

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`

All four routes are dev-only, explicit opt-in prototypes. localStorage remains source of truth. API results never overwrite AppData or localStorage.

## Readiness Finding

Phase 4 is not ready to switch source of truth.

The four-route prototype state proves narrow browser mutation experiments can be guarded, accepted, manually tested, hardened, observed, and regression-locked. It does not prove the App can safely replace localStorage with API-backed runtime persistence.

## Required Gates Before Migration

- Four-route regression lock remains green.
- Four-route manual regression remains valid.
- Read-only diagnostics remain GET-only and green.
- localStorage integrity is verified.
- API results still never overwrite AppData/localStorage.
- No-fake-success remains green for all accepted routes.
- Browser build remains clean of Node-only runtime tokens.
- API-backed runtime strategy is planned.
- Offline/fallback behavior is planned.
- Rollback strategy is planned.
- Data migration and validation strategy is planned.
- Production backend/auth/sync/deployment assumptions are explicit.
- Manual acceptance for source-of-truth migration is written before implementation.
- Phase 5 migration approval is explicit.

## Source-of-truth Risks

| Risk | Severity | Mitigation | Required gate |
| --- | --- | --- | --- |
| AppData/localStorage overwrite | High | Keep API responses diagnostic-only in Phase 4. | Source-of-truth boundary tests pass. |
| Local/API divergence | High | Plan read/write reconciliation before implementation. | API-backed runtime strategy approved. |
| Offline data loss | High | Define offline fallback and recovery before writes become authoritative. | Offline strategy approved. |
| Dual-write corruption | High | Do not enable dual-write in Phase 4. | Phase 5 implementation gate. |
| Production exposure | High | Keep Phase 4 dev-only. | Auth/sync/deployment plan approved. |
| Migration rollback gap | High | Define rollback and backup validation before migration. | Rollback strategy approved. |
| Browser Node-only pollution | High | Keep Node-only runtime out of browser build. | Dist scan remains clean. |

## Decision

Do not implement source-of-truth migration in Phase 4.

Next recommended task: `Task 4.70 API-backed Runtime Strategy Plan V1`.

Task 4.70 must be planning-only. It must not replace localStorage, add API-backed runtime behavior, add production backend/auth/sync/deployment, or add another mutation route.

## Decision Record

- Date: 2026-05-11
- Branch / commit: `codex/task4.69-phase4-source-of-truth-migration-readiness-audit` / pending until merge
- Decision: Phase 4 is not ready to switch source of truth; migration remains Phase 5 work.
- Current accepted routes: `POST /data-health/issues/:issueId/dismiss`; `POST /history/:id/data-flag`; `POST /history/:id/edit`; `POST /sessions/start`
- Rejected next steps: localStorage replacement, API-backed runtime implementation, dual-write, offline mutation queue, production backend/auth/sync/deployment, fifth mutation implementation.
- Recommended next task: `Task 4.70 API-backed Runtime Strategy Plan V1`
- Rollback requirement: because this audit adds docs/static tests only, rollback is reverting the audit commit.

## Final Recommendation

Task 4.69 result: audit only.
localStorage remains source of truth.
API results never overwrite AppData or localStorage.
No API-backed runtime is implemented.
No production backend, auth, sync, or deployment is added.
Next task should be Task 4.70 API-backed Runtime Strategy Plan V1, planning-only.
