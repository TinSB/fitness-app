# Phase 6 Architecture Checkpoint Boundary Lock

## Scope / Non-goals

Task 6.8 is the Phase 6 architecture checkpoint and boundary lock before skeleton/prototype work.

This is docs/static tests only. This is not production backend runtime implementation. This is not auth runtime implementation. This is not sync runtime implementation. This is not deployment runtime implementation. This is not normalized schema implementation. This is not migration runtime implementation. This is not production source-of-truth migration implementation.

This does not add routes, dependencies, package scripts, lockfile changes, browser runtime changes, storage runtime changes, deployment config, normalized tables, or real personal training data.

## Completed Architecture Decisions

- Task 6.0 Phase 6 preflight and production boundary lock.
- Task 6.1 production backend, auth, sync, and deployment architecture gate.
- Task 6.2 production data ownership, privacy, and security matrix.
- Task 6.3 auth and user account lifecycle architecture gate.
- Task 6.4 production backend and database architecture decision.
- Task 6.5 cloud sync and conflict resolution architecture gate.
- Task 6.6 deployment, environment, and secrets strategy.
- Task 6.7 production migration, backup, and rollback strategy.

## Phase 6 Baseline

`localStorage` remains default runtime source, fallback, migration source, and emergency backup. `api-primary-dev` remains explicit dev/local only and not production-ready.

Production backend runtime, auth runtime, sync runtime, deployment runtime, monitoring runtime, normalized schema, migration runtime, and production source-of-truth migration remain unimplemented.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

## Still-blocked Implementation

The following remain blocked at the Task 6.8 checkpoint:

- production backend runtime
- Fastify/Express/Koa/Hono auto-listening server
- auth runtime, login/signup, token/session handling, OAuth, and user table
- cloud sync runtime, remote write queue, background sync worker, and automatic conflict merge
- production deployment, hosted environment provisioning, production secrets runtime, and monitoring runtime
- normalized schema and normalized tables
- migration runtime, destructive migration, real-data automation, and production source-of-truth switch
- `POST /data-health/repair/apply`
- backup/import/export over HTTP
- reset/recovery over HTTP
- any eighth browser mutation route

## Source-of-truth Boundary

Source-of-truth remains explicit and unchanged. `localStorage` remains default. API/SQLite production primary is not approved. `api-primary-dev` remains dev/local only.

Any future production source-of-truth change requires a separate future gate, manual acceptance, backup-first migration, rollback, and explicit approval.

## Checkpoint Coverage Inventory

Task 6.8 locks that the architecture phase has coverage for preflight, production architecture, data ownership/privacy/security, auth lifecycle, backend/database, sync/conflict, deployment/secrets, and migration/backup/rollback.

The next phase may add narrow skeletons only when prior docs explicitly allow them, with static boundary tests proving no browser pollution, no production activation, no unapproved routes, and no package drift.

## CI / Ruleset Boundary

GitHub Actions `IronPath Validation` remains the required PR check. Codex must use `gh pr checks <PR_NUMBER> --required --watch`.

Never use `--admin`. Never bypass branch protection. IronPath Validation failure blocks merge. Optional Vercel checks must not block merge if GitHub allows normal squash merge and required checks pass.

## Decision

Task 6.8 result: Phase 6 architecture checkpoint and boundary lock only.

Decision: architecture gates are sufficient to proceed to a planning task for a narrow production backend adapter skeleton, but no skeleton/runtime is implemented by Task 6.8.

Recommended next task: `Task 6.9 Production Backend Adapter Skeleton Plan V1`.

Task 6.9 must be docs/static tests only. Task 6.9 must not implement production backend runtime, auth, deployment, database migration, production runtime activation, routes, package changes, or source-of-truth switching.

## Decision Record

- Date: 2026-05-12
- Branch / commit: `codex/task6.8-phase6-architecture-checkpoint-boundary-lock` / pending until merge
- Decision: lock Phase 6 architecture-only work before skeleton/prototype tasks.
- Baseline: `localStorage` remains default runtime source and `api-primary-dev` remains dev/local only.
- Accepted routes: `POST /data-health/issues/:issueId/dismiss`; `POST /history/:id/data-flag`; `POST /history/:id/edit`; `POST /sessions/start`; `POST /sessions/active/patches`; `POST /sessions/active/complete`; `POST /sessions/active/discard`
- Still blocked: production backend runtime, auth runtime, sync runtime, deployment runtime, normalized schema, migration runtime, production source-of-truth switch, unapproved routes, package drift, real-data automation.
- Required future gates: backend adapter skeleton plan, backend adapter acceptance, auth boundary plan, storage schema strategy, sync model plan, environment config boundary, observability/privacy, and final release locks.
- Next task: `Task 6.9 Production Backend Adapter Skeleton Plan V1`
- Rollback requirement: because this task adds docs/static tests only, rollback is reverting the Task 6.8 commit.

## Final Recommendation

Task 6.8 is complete after this task.

Do not start production backend runtime implementation yet. Next task should be Task 6.9 Production Backend Adapter Skeleton Plan V1.

## Task 6.9 Follow-up

Task 6.9 Production Backend Adapter Skeleton Plan V1 records backend adapter boundary, request/response shape, environment boundary, no hosted deployment, no auth, no database migration, and no production runtime activation as docs/static tests only.

It must keep production backend runtime, auto-listening server behavior, hosted deployment, auth runtime, database migration, production runtime activation, source-of-truth migration, package changes, browser routes, and real personal training data migration unimplemented.
