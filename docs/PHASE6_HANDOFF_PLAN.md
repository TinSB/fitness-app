# Phase 6 Handoff Plan

## Scope / Non-goals

Task 5.40 is a Phase 6 handoff plan only.

This task does not start Phase 6 implementation, does not add runtime behavior, does not modify App.tsx, does not add a browser mutation route, does not implement production backend, does not implement auth, does not implement user accounts, does not implement cloud sync, does not implement deployment, does not implement monitoring, does not delete localStorage, does not silently overwrite localStorage, does not silently overwrite AppData, does not make API primary production default, does not add package dependency, package script, normalized table, DataHealth repair, backup/import/export over HTTP, reset/recovery over HTTP, or an eighth browser mutation route.

## Phase 5 Final State

Accepted runtime modes at Phase 5 exit are exactly:

- `localStorage`
- `api-readonly`
- `api-primary-dev`

Accepted browser mutation routes at Phase 5 exit are exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

`localStorage` remains default runtime source, fallback, migration source, and emergency backup. `api-primary-dev` remains explicit dev/local only and not production-ready.

## Production Backend Prerequisites

Before production backend work:

- define production data ownership.
- define hosted database strategy.
- define environment separation for local/dev/staging/production.
- define backup and restore ownership.
- define operational rollback policy.
- define data retention policy.
- define rate limits and abuse controls.
- define production incident response ownership.

## Auth And User Account Prerequisites

Before auth or user accounts:

- choose identity provider or in-house auth strategy.
- define account lifecycle.
- define sign-up/sign-in/sign-out behavior.
- define account deletion/export requirements.
- define session expiry behavior.
- define local-only to account-bound migration rules.
- define authorization boundaries for personal training data.
- define support and recovery workflow.

## Cloud Sync Prerequisites

Before cloud sync:

- define conflict model.
- define offline write behavior.
- define device identity and ordering strategy.
- define last-writer or merge rules.
- define recovery from partial sync.
- define privacy boundaries for personal training data.
- define sync opt-in and opt-out behavior.
- define audit trail for destructive sync conflicts.

## Deployment Prerequisites

Before deployment:

- define hosting target.
- define environment variables and secrets handling.
- define build and release workflow.
- define database migration workflow.
- define rollback deployment workflow.
- define preview/staging verification.
- define production domain and TLS plan.
- define data backup before launch.

## Monitoring And Operations Prerequisites

Before monitoring:

- define health checks.
- define structured logging policy.
- define metrics and alert thresholds.
- define privacy-safe error reporting.
- define backup verification checks.
- define migration/recovery drills.
- define on-call or owner response process.
- define user-facing status and support path.

## Privacy And Security Prerequisites

Before production readiness:

- classify personal training data.
- define encryption requirements.
- define access controls.
- define audit logging requirements.
- define data export and deletion requirements.
- define privacy policy requirements.
- define abuse and account recovery protections.
- define secrets handling and rotation.

## Still Blocked At Phase 5 Exit

Still blocked:

- production backend implementation
- auth implementation
- user accounts implementation
- cloud sync implementation
- deployment implementation
- monitoring implementation
- production source-of-truth switch
- `POST /data-health/repair/apply`
- backup/import/export over HTTP
- reset/recovery over HTTP
- any eighth browser mutation route
- destructive real user data migration

## Phase 6 Entry Gate

Phase 6 should start with architecture and readiness gating, not direct production implementation.

Required gates:

- Phase 5 exit regression lock remains green.
- Phase 5 final manual acceptance is recorded.
- production backend architecture is approved.
- auth/account architecture is approved.
- cloud sync conflict strategy is approved.
- deployment and rollback strategy is approved.
- privacy/security checklist is approved.
- monitoring and recovery ownership is approved.
- real personal training data migration remains blocked until backup/export/delete policy exists.

## Recommended Phase 6 First Task

Recommended Phase 6 first task:

`Task 6.1 Production Backend, Auth, Sync & Deployment Architecture Gate V1`

Task 6.1 should be planning/gate work first. It must not immediately implement production backend, auth, user accounts, cloud sync, deployment, monitoring, or production source-of-truth switching.

## Decision Record

- Date: 2026-05-12
- Branch / commit: `codex/task5.40-phase6-handoff-plan` / pending until merge
- Decision: hand off Phase 5 final state to future Phase 6 planning without starting Phase 6 implementation.
- Runtime modes: `localStorage`; `api-readonly`; `api-primary-dev`
- Accepted routes: `POST /data-health/issues/:issueId/dismiss`; `POST /history/:id/data-flag`; `POST /history/:id/edit`; `POST /sessions/start`; `POST /sessions/active/patches`; `POST /sessions/active/complete`; `POST /sessions/active/discard`
- Rejected next steps: automatic Phase 6 implementation, production backend/auth/sync/deployment, monitoring, production source-of-truth switch, eighth browser mutation route, destructive real user data migration.
- Recommended next task in Phase 5 chain: `Task 5.41 Phase 5 Completion Archive V1`
- Recommended Phase 6 starting task after Phase 5 closes: `Task 6.1 Production Backend, Auth, Sync & Deployment Architecture Gate V1`

## Final Recommendation

Task 5.40 result: Phase 6 handoff planning only.
Do not start Phase 6 automatically.
No production backend, auth, user accounts, cloud sync, deployment, monitoring, package change, normalized table, DataHealth repair, backup/import/export HTTP, reset/recovery HTTP, or eighth browser mutation route is added.
localStorage remains default runtime source, fallback, migration source, and emergency backup at Phase 5 exit.
Next Phase 5 task should be Task 5.41 Phase 5 Completion Archive V1.

## Task 6.0 Preflight Alignment

Task 6.0 Phase 6 Preflight & Production Boundary Lock V1 adds `docs/PHASE6_PREFLIGHT_PRODUCTION_BOUNDARY_LOCK.md` as the Phase 6 preflight production boundary lock before Task 6.1.

The Task 6.0 boundary keeps production backend, auth/user accounts, cloud sync, deployment, monitoring, source-of-truth migration, normalized tables, package changes, browser route changes, and real personal training data migration unimplemented.

Task 6.1 remains the recommended Phase 6 first task as architecture gate only. It must not implement production backend/auth/sync/deployment and must not auto-start from Task 6.0.

## Task 6.1 Architecture Gate Alignment

Task 6.1 Production Backend, Auth, Sync & Deployment Architecture Gate V1 adds `docs/PRODUCTION_BACKEND_AUTH_SYNC_DEPLOYMENT_ARCHITECTURE_GATE.md` as an architecture gate and decision record.

Task 6.1 evaluates production backend, production database/storage, auth/user identity, cloud sync, deployment/environment, privacy/security, production migration/rollback, backup/recovery, and CI/ruleset categories without implementing production runtime.

Task 6.1 keeps production backend, auth/user accounts, cloud sync, deployment, monitoring, production source-of-truth migration, normalized tables, package changes, browser route changes, and real personal training data migration unimplemented.

The next recommended task is Task 6.2 Production Data Ownership, Privacy & Security Matrix V1, docs/static tests only. Task 6.2 must not implement auth, production backend, sync, deployment, migration, or source-of-truth switching, and must not auto-start from Task 6.1.

## Task 6.2 Data Ownership Alignment

Task 6.2 Production Data Ownership, Privacy & Security Matrix V1 adds `docs/PRODUCTION_DATA_OWNERSHIP_PRIVACY_SECURITY_MATRIX.md` as a matrix and decision record.

Task 6.2 classifies production data ownership, privacy, sensitivity, retention, export/delete, backup/restore, logging, sync eligibility, migration risk, and future gates for current and future production data domains.

Task 6.2 keeps production backend, auth/user accounts, cloud sync, deployment, monitoring, production source-of-truth migration, normalized tables, package changes, browser route changes, and real personal training data migration unimplemented.

The next recommended task is Task 6.3 Auth & User Account Lifecycle Architecture Gate V1, docs/static tests only. Task 6.3 must not implement auth, production backend, sync, deployment, migration, or source-of-truth switching, and must not auto-start from Task 6.2.

## Task 6.3 Auth Account Lifecycle Alignment

Task 6.3 Auth & User Account Lifecycle Architecture Gate V1 adds `docs/AUTH_USER_ACCOUNT_LIFECYCLE_ARCHITECTURE_GATE.md` as an auth and user account lifecycle architecture gate and decision record.

Task 6.3 defines anonymous local user, future account identity, local data to account linking, account creation lifecycle, account deletion lifecycle, export/delete responsibilities, auth failure behavior, identity mismatch risk, and localStorage fallback boundaries before implementation.

Task 6.3 keeps auth runtime, login/signup, OAuth, token/session handling, user tables, production backend, cloud sync, deployment, source-of-truth migration, normalized tables, package changes, browser route changes, and real personal training data migration unimplemented.

The next recommended task is Task 6.4 Production Backend & Database Architecture Decision V1, planning/docs/static tests only. Task 6.4 must not implement production backend, normalized schema, auth, sync, deployment, migration, or source-of-truth switching.

## Task 6.4 Backend Database Alignment

Task 6.4 Production Backend & Database Architecture Decision V1 adds `docs/PRODUCTION_BACKEND_DATABASE_ARCHITECTURE_DECISION.md` as a planning-level backend and database architecture decision.

Task 6.4 evaluates no backend yet, single Node backend, serverless API, hosted backend/database, local-first desktop backend, current SQLite snapshot repository, normalized schema risk, migration/rollback requirements, and backup requirements without implementation.

Task 6.4 keeps production backend runtime, production database runtime, normalized schema, migration, auth, sync, deployment, source-of-truth migration, package changes, browser routes, and real personal training data migration unimplemented.

The next recommended task is Task 6.5 Cloud Sync & Conflict Resolution Architecture Gate V1, docs/static tests only. Task 6.5 must not implement cloud sync, remote writes, background sync, production backend, auth, deployment, migration, or source-of-truth switching.

## Task 6.5 Cloud Sync Conflict Alignment

Task 6.5 Cloud Sync & Conflict Resolution Architecture Gate V1 adds `docs/CLOUD_SYNC_CONFLICT_RESOLUTION_ARCHITECTURE_GATE.md` as a planning-level sync/conflict architecture gate.

Task 6.5 evaluates no sync, manual backup sync, single-device cloud backup, multi-device bidirectional sync, conflict detection, conflict merge policy, remote write duplication, and offline queue risk without implementation.

Task 6.5 keeps cloud sync runtime, remote writes, background sync workers, automatic conflict merge, production backend runtime, auth runtime, deployment runtime, production migration, source-of-truth migration, package changes, browser routes, and real personal training data migration unimplemented.

The next recommended task is Task 6.6 Deployment, Environment & Secrets Strategy V1, docs/static tests only. Task 6.6 must not implement deployment, production hosting, secrets runtime, auth, cloud sync, production backend, migration, routes, or source-of-truth switching.

## Task 6.6 Deployment Environment Secrets Alignment

Task 6.6 Deployment, Environment & Secrets Strategy V1 adds `docs/DEPLOYMENT_ENVIRONMENT_SECRETS_STRATEGY.md` as a planning-level deployment, environment, and secrets strategy.

Task 6.6 documents local/dev/staging/production environments, secrets storage, environment variables, branch rules, required checks, Vercel optional behavior for Codex PRs, and rollback strategy without implementation.

Task 6.6 keeps production deployment, hosted production configuration, deployment config, secret values, secrets runtime, production backend runtime, auth runtime, cloud sync runtime, production migration, source-of-truth migration, package changes, browser routes, and real personal training data migration unimplemented.

The next recommended task is Task 6.7 Production Migration, Backup & Rollback Strategy V1, docs/static tests only. Task 6.7 must not implement destructive migration, real-data automation, production source-of-truth switching, routes, deployment, auth, cloud sync, production backend runtime, or package changes.

## Task 6.7 Production Migration Backup Rollback Alignment

Task 6.7 Production Migration, Backup & Rollback Strategy V1 adds `docs/PRODUCTION_MIGRATION_BACKUP_ROLLBACK_STRATEGY.md` as a planning-level migration, backup, rollback, and recovery strategy.

Task 6.7 documents backup-first, dry-run, apply, rollback, recovery drill, export/delete implications, no destructive migration, and no real-data automation without implementation.

Task 6.7 keeps migration runtime, destructive migration, real-data automation, backup/restore runtime, export/delete runtime, production source-of-truth migration, production backend runtime, auth runtime, cloud sync runtime, deployment runtime, package changes, browser routes, and real personal training data migration unimplemented.

The next recommended task is Task 6.8 Phase 6 Architecture Checkpoint & Boundary Lock V1, docs/static tests only. Task 6.8 must not implement production backend runtime, auth runtime, sync runtime, deployment runtime, normalized schema, migration runtime, routes, package changes, or source-of-truth switching.

## Task 6.8 Architecture Checkpoint Alignment

Task 6.8 Phase 6 Architecture Checkpoint & Boundary Lock V1 adds `docs/PHASE6_ARCHITECTURE_CHECKPOINT_BOUNDARY_LOCK.md` as the architecture checkpoint before skeleton/prototype work.

Task 6.8 locks architecture decisions, still-blocked implementation, source-of-truth status, route allowlist, CI/ruleset policy, and coverage inventory before narrow skeleton planning.

Task 6.8 keeps production backend runtime, auth runtime, sync runtime, deployment runtime, normalized schema, migration runtime, production source-of-truth migration, package changes, browser routes, and real personal training data migration unimplemented.

The next recommended task is Task 6.9 Production Backend Adapter Skeleton Plan V1, docs/static tests only. Task 6.9 must not implement production backend runtime, auth, deployment, database migration, production runtime activation, routes, package changes, or source-of-truth switching.

## Task 6.9 Production Backend Adapter Plan Alignment

Task 6.9 Production Backend Adapter Skeleton Plan V1 adds `docs/PRODUCTION_BACKEND_ADAPTER_SKELETON_PLAN.md` as a planning-level backend adapter skeleton plan.

Task 6.9 defines backend adapter boundary, request/response shape, environment boundary, no hosted deployment, no auth, no database migration, and no production runtime activation without implementation.

Task 6.9 keeps production backend runtime, auto-listening server behavior, hosted deployment, auth runtime, database migration, production runtime activation, source-of-truth migration, package changes, browser routes, and real personal training data migration unimplemented.

The next recommended task is Task 6.10 Production Backend Adapter Skeleton V1. Task 6.10 may add a Node-only adapter skeleton only if safe and must not add auto-listen behavior, deployment, auth, normalized tables, production data use, browser runtime integration, package dependencies, routes, or source-of-truth switching.

## Task 6.10 Production Backend Adapter Skeleton Alignment

Task 6.10 Production Backend Adapter Skeleton V1 adds `apps/api/src/node/productionBackendAdapter.ts` as an inert Node-only adapter skeleton.

Task 6.10 exposes typed request/response shapes, the existing seven-route browser mutation allowlist, and safe error envelopes. Accepted routes return `ok: false` with `production_backend_not_activated`; unapproved routes return `route_not_allowed`.

Task 6.10 keeps auto-listen behavior, Fastify/Express/Koa/Hono server runtime, deployment, auth runtime, normalized tables, database migration, production data use, browser runtime integration, package changes, source-of-truth switching, browser route additions, and real personal training data migration unimplemented.

The next recommended task is Task 6.11 Production Backend Adapter Acceptance V1. Task 6.11 must not add auth runtime, deployment, auto-listen behavior, database migration, production data use, browser runtime integration, routes, package changes, or source-of-truth switching.

## Task 6.11 Production Backend Adapter Acceptance Alignment

Task 6.11 Production Backend Adapter Acceptance V1 adds `docs/PRODUCTION_BACKEND_ADAPTER_ACCEPTANCE.md` and acceptance/boundary tests for the Task 6.10 Node-only adapter skeleton.

Task 6.11 accepts the skeleton as Node-only, inert by default, dependency-free, not exported from browser-facing API index files, and safe-error-only with no fake success.

Task 6.11 keeps runtime activation, auto-listen behavior, auth runtime, deployment runtime, database migration, production data use, browser runtime integration, package changes, route additions, source-of-truth switching, and real personal training data migration blocked.

The next recommended task is Task 6.12 Auth Boundary & Account Model Plan V1, docs/static tests only. Task 6.12 must not implement auth runtime, login/signup, token/session handling, OAuth, user table, production backend activation, routes, package changes, or source-of-truth switching.

## Task 6.12 Auth Boundary Account Model Alignment

Task 6.12 Auth Boundary & Account Model Plan V1 adds `docs/AUTH_BOUNDARY_ACCOUNT_MODEL_PLAN.md` as an auth boundary and account model plan.

Task 6.12 documents account identity, local user to account mapping, account deletion, export/delete responsibilities, token/session requirements, auth failure behavior, and localStorage fallback without implementation.

Task 6.12 keeps auth runtime, login/signup, token/session handling, OAuth, user table, account linking runtime, production backend activation, package changes, route additions, source-of-truth switching, and real personal training data migration blocked.

The next recommended task is Task 6.13 Auth Provider Adapter Skeleton V1. Task 6.13 may add type/interface-only auth boundary files if safe and must not implement real auth, login UI, token storage, OAuth, provider integration, dependencies, routes, production backend activation, or source-of-truth switching.

## Task 6.13 Auth Provider Adapter Skeleton Alignment

Task 6.13 Auth Provider Adapter Skeleton V1 adds `src/auth/authProviderTypes.ts` and `src/auth/authBoundary.ts` as type/interface-only auth provider adapter skeleton files.

Task 6.13 returns a pure unavailable result with `auth_runtime_not_implemented`. It stores no credentials, starts no provider flow, performs no network request, and writes no browser storage.

Task 6.13 keeps real auth, login UI, token storage, OAuth, provider integration, dependencies, routes, production backend activation, package changes, source-of-truth switching, and real personal training data migration unimplemented.

The next recommended task is Task 6.14 Auth Account Lifecycle Acceptance V1, docs/static tests only. Task 6.14 must not implement login/signup runtime, token/session runtime, OAuth, auth provider integration, user table, routes, production backend activation, package changes, or source-of-truth switching.

## Task 6.14 Auth Account Lifecycle Acceptance Alignment

Task 6.14 Auth Account Lifecycle Acceptance V1 adds `docs/AUTH_ACCOUNT_LIFECYCLE_ACCEPTANCE.md` as auth account lifecycle acceptance documentation.

Task 6.14 locks no login/signup runtime, no token/session runtime, account lifecycle gates, deletion/export policy, and identity mismatch prevention.

Task 6.14 keeps auth runtime, account lifecycle runtime, export/delete runtime, auth provider integration, user table, routes, package changes, source-of-truth switching, and real personal training data migration unimplemented.

The next recommended task is Task 6.15 Production Storage Schema Strategy V1, docs/static tests only. Task 6.15 must not create normalized tables, implement schema migration, perform database writes, use real personal training data, add routes, add dependencies, or switch source of truth.

## Task 6.15 Production Storage Schema Strategy Alignment

Task 6.15 Production Storage Schema Strategy V1 adds `docs/PRODUCTION_STORAGE_SCHEMA_STRATEGY.md` as production storage schema strategy documentation.

Task 6.15 documents snapshot repository strategy, normalized schema future risk, migration strategy, rollback, and backup without implementation.

Task 6.15 keeps schema implementation, normalized tables, production database migration, database writes, production source-of-truth migration, production backend activation, package changes, route additions, and real personal training data migration unimplemented.

The next recommended task is Task 6.16 Production Storage Migration Dry-run Prototype V1. Task 6.16 may add docs/tests and a pure dry-run utility only if safe and must not write a database, create schema migration, use real personal training data, add routes, add dependencies, or switch source of truth.
