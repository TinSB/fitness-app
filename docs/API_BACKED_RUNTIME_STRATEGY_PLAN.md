# API-backed Runtime Strategy Plan

## Scope / Non-goals

Task 4.70 is a planning-only strategy document for a future API-backed runtime phase.

- This does not implement API-backed runtime behavior.
- This does not switch source of truth.
- This does not replace localStorage.
- This does not add dual-write.
- This does not add an offline mutation queue.
- This does not add production backend, auth, sync, or deployment.
- This does not add a browser mutation route.
- This does not add package dependencies, package scripts, lockfile changes, normalized tables, schemas, storage adapters, or training algorithm changes.

## Phase 4 Baseline

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`

localStorage remains source of truth. API results never overwrite AppData or localStorage.

## LocalStorage Fallback Models

Future Phase 5 planning should compare:

- localStorage primary with API diagnostics only.
- API primary with localStorage read-only fallback.
- API primary with localStorage recovery snapshot.
- explicit migration window with localStorage backup and rollback.
- no silent dual-write unless separately designed and accepted.

## Migration Approach

Required before implementation:

- schema/version compatibility plan.
- source snapshot and checksum strategy.
- migration dry-run and validation report.
- backup-before-migration requirement.
- rollback route and UX design.
- manual acceptance runbook.
- production/auth/sync assumptions.

## Feature Flag Strategy

Future runtime migration must be:

- explicit opt-in.
- disabled by default.
- environment-scoped.
- reversible without data loss.
- observable without raw AppData/localStorage dumps.
- blocked in production-like builds until production assumptions are approved.

## Read / Write Client Architecture

Future clients must be planned before implementation:

- read client for API-backed AppData loading.
- write client for accepted mutation routes only.
- route-specific mutation clients rather than broad arbitrary mutation client.
- source snapshot and idempotency on writes.
- strict no-fake-success and snapshot metadata requirements.
- AppData/localStorage overwrite rules defined before any write becomes authoritative.

## Offline Strategy

Future offline behavior must define:

- offline read fallback.
- offline write blocking or queueing policy.
- queue conflict detection if queueing is ever allowed.
- recovery after failed sync.
- user-visible state for stale data.
- no hidden offline mutation queue in Phase 4.

## Rollback Strategy

Future rollback must define:

- localStorage backup restore path.
- API snapshot rollback or discard path.
- manual recovery runbook.
- safe failure messaging.
- no browser reset/recovery route until explicitly approved.
- no production data recovery promise in Phase 4.

## Production / Auth / Sync Assumptions

Before API-backed runtime can be implemented:

- production backend environment must be designed.
- authentication must be designed.
- sync behavior must be designed.
- deployment and migration ownership must be defined.
- privacy and personal training data handling must be reviewed.

## Decision

Do not implement API-backed runtime in Phase 4.

Next recommended task: `Task 4.71 Phase 4 Final Data Safety Audit V1`.

Task 4.71 must be audit-only. It must not switch source of truth, replace localStorage, add API-backed runtime behavior, add production backend/auth/sync/deployment, or add another mutation route.

## Decision Record

- Date: 2026-05-11
- Branch / commit: `codex/task4.70-api-backed-runtime-strategy-plan` / pending until merge
- Decision: document Phase 5 API-backed runtime strategy requirements without implementing runtime behavior.
- Current accepted routes: `POST /data-health/issues/:issueId/dismiss`; `POST /history/:id/data-flag`; `POST /history/:id/edit`; `POST /sessions/start`
- Rejected next steps: API-backed runtime implementation, source-of-truth switch, localStorage replacement, dual-write, offline mutation queue, production backend/auth/sync/deployment, fifth mutation implementation.
- Recommended next task: `Task 4.71 Phase 4 Final Data Safety Audit V1`
- Rollback requirement: because this plan adds docs/static tests only, rollback is reverting the plan commit.

## Final Recommendation

Task 4.70 result: planning only.
localStorage remains source of truth.
API results never overwrite AppData or localStorage.
No API-backed runtime is implemented.
No production backend, auth, sync, or deployment is added.
Next task should be Task 4.71 Phase 4 Final Data Safety Audit V1, audit-only.
