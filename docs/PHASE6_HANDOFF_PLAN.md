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

## Task 6.16 Production Storage Migration Dry-run Alignment

Task 6.16 Production Storage Migration Dry-run Prototype V1 adds `src/storage/productionStorageMigrationDryRun.ts` as a pure inspection-only dry-run utility and `docs/PRODUCTION_STORAGE_MIGRATION_DRY_RUN.md`.

Task 6.16 returns structured dry-run results with `writesPerformed: false`.

Task 6.16 keeps database writes, schema migration, normalized tables, real-data automation, migration apply, production source-of-truth migration, package changes, route additions, and real personal training data migration unimplemented.

The next recommended task is Task 6.17 Production Storage Backup / Restore Acceptance V1, docs/static tests only. Task 6.17 must not perform real data automation, destructive restore, database writes, route additions, package changes, or source-of-truth switching.

## Task 6.17 Production Storage Backup Restore Alignment

Task 6.17 Production Storage Backup / Restore Acceptance V1 adds `docs/PRODUCTION_STORAGE_BACKUP_RESTORE_ACCEPTANCE.md` as production storage backup/restore acceptance documentation.

Task 6.17 documents backup-first, restore verification, rollback drill, no real data automation, and no destructive restore without implementation.

Task 6.17 keeps backup runtime, restore runtime, destructive restore, database writes, migration apply, production source-of-truth migration, package changes, route additions, and real personal training data migration unimplemented.

The next recommended task is Task 6.18 Cloud Sync Model Plan V1, docs/static tests only. Task 6.18 must not implement sync runtime, network writes, cloud writes, background sync, routes, dependencies, or source-of-truth switching.

## Task 6.18 Cloud Sync Model Alignment

Task 6.18 Cloud Sync Model Plan V1 adds `docs/CLOUD_SYNC_MODEL_PLAN.md` as a planning-level sync model document.

Task 6.18 documents sync model, device identity, conflict policy, idempotency, offline/retry boundaries, and no sync runtime without implementation.

Task 6.18 keeps sync runtime, network writes, cloud writes, remote queue, background sync worker, conflict merge runtime, package changes, route additions, source-of-truth switching, and real personal training data migration unimplemented.

The next recommended task is Task 6.19 Sync Metadata & Conflict Detector Prototype V1. Task 6.19 may add pure local sync metadata/conflict detector functions if safe and must not add network calls, cloud writes, background sync, auth runtime, routes, dependencies, or source-of-truth switching.

## Task 6.19 Sync Metadata Conflict Detector Alignment

Task 6.19 Sync Metadata & Conflict Detector Prototype V1 adds `src/sync/syncConflictDetector.ts` and `docs/SYNC_METADATA_CONFLICT_DETECTOR_PROTOTYPE.md` as a pure local metadata classifier.

Task 6.19 classifies no conflict, stale client, stale server, divergent edits, deletion conflict, duplicate operation, account mismatch, and invalid metadata from synthetic metadata only.

Task 6.19 keeps sync runtime, network calls, cloud writes, remote queue, background sync worker, automatic merge runtime, auth runtime, package changes, route additions, source-of-truth switching, and real personal training data migration unimplemented.

The next recommended task is Task 6.20 Sync Conflict Acceptance V1, docs/static tests only. Task 6.20 must not add remote writes, sync runtime, automatic merge, network calls, cloud provider configuration, auth runtime, routes, dependencies, or source-of-truth switching.

## Task 6.20 Sync Conflict Acceptance Alignment

Task 6.20 Sync Conflict Acceptance V1 adds `docs/SYNC_CONFLICT_ACCEPTANCE.md` as acceptance documentation for the Task 6.19 detector.

Task 6.20 accepts conflict cases, keeps `canAutoApply` false, blocks automatic merge, blocks remote writes, and requires future user-visible conflict policy before sync runtime.

Task 6.20 keeps sync runtime, remote writes, cloud writes, network calls, remote queue, background sync worker, automatic merge runtime, auth runtime, package changes, route additions, source-of-truth switching, and real personal training data migration unimplemented.

The next recommended task is Task 6.21 Production Environment Config Boundary V1, docs/static tests only. Task 6.21 must not enable production runtime by default, deploy production, add secret values, add routes, add dependencies, or switch source of truth.

## Task 6.21 Production Environment Config Alignment

Task 6.21 Production Environment Config Boundary V1 adds `docs/PRODUCTION_ENVIRONMENT_CONFIG_BOUNDARY.md` as environment configuration boundary documentation.

Task 6.21 documents `local`, `development`, `staging`, and `production` names, secrets separation, no secret values, no production deploy, and no runtime production enable by default.

Task 6.21 keeps deployment implementation, production runtime enablement, secret values, auth provider configuration, sync provider configuration, package changes, route additions, source-of-truth switching, and real personal training data migration unimplemented.

The next recommended task is Task 6.22 Deployment Runtime Strategy & Staging Plan V1, docs/static tests only. Task 6.22 must not implement production deployment, hosted production runtime, secret provisioning, routes, dependencies, or source-of-truth switching.

## Task 6.22 Deployment Runtime Strategy Alignment

Task 6.22 Deployment Runtime Strategy & Staging Plan V1 adds `docs/DEPLOYMENT_RUNTIME_STRATEGY_STAGING_PLAN.md` as deployment runtime strategy and staging planning documentation.

Task 6.22 documents staging vs production, rollback, preview deployments optional for Codex PRs, IronPath Validation as required, and no production deployment implementation.

Task 6.22 keeps production deployment, hosted production runtime, deployment config, secret values, auth provider configuration, sync provider configuration, package changes, route additions, source-of-truth switching, and real personal training data migration unimplemented.

The next recommended task is Task 6.23 Secrets & Environment Validation Skeleton V1. Task 6.23 may add a safe environment validation skeleton only if no dependency is needed and must not add secret values, production deployment, auth provider, sync provider, package changes, routes, or source-of-truth switching.

## Task 6.23 Secrets Environment Validation Alignment

Task 6.23 Secrets & Environment Validation Skeleton V1 adds `src/config/environmentValidation.ts` as a safe environment validation skeleton.

Task 6.23 validates environment names, runtime source boundaries, secret reference placeholders, and production runtime disabled status. It accepts no secret values and performs no network, storage, provider, or deployment behavior.

Task 6.23 keeps secret values, production deployment, auth provider configuration, sync provider configuration, package changes, route additions, source-of-truth switching, and real personal training data migration unimplemented.

The next recommended task is Task 6.24 Observability / Logging Privacy Skeleton V1. Task 6.24 may add a privacy-safe redaction utility only if safe and must not add an external logging service, dependency, raw AppData logging, localStorage dumps, token/secret logging, routes, or source-of-truth switching.

## Task 6.24 Observability Logging Privacy Alignment

Task 6.24 Observability / Logging Privacy Skeleton V1 adds `src/observability/redaction.ts` as a privacy-safe redaction utility.

Task 6.24 redacts sensitive keys, long strings, and bearer-like credentials from synthetic log payloads. It performs no network, storage, provider, deployment, or logging service behavior.

Task 6.24 keeps external logging service integration, dependencies, raw AppData logging, localStorage dump, token/secret logging, production monitoring runtime, package changes, route additions, source-of-truth switching, and real personal training data migration unimplemented.

The next recommended task is Task 6.25 Production Readiness Security Hardening V1, docs/static tests and tiny redaction/env validation fixes only. Task 6.25 must not add auth runtime, deployment runtime, sync runtime, routes, dependencies, or source-of-truth switching.

## Task 6.25 Production Readiness Security Hardening Alignment

Task 6.25 Production Readiness Security Hardening V1 adds `docs/PRODUCTION_READINESS_SECURITY_HARDENING.md` as production readiness security hardening documentation.

Task 6.25 locks secret leakage controls, sensitive data logging controls, route boundaries, privacy controls, and continued no-auth/no-deployment runtime status.

Task 6.25 keeps auth runtime, deployment runtime, sync runtime, production backend activation, production monitoring service, secret values, package changes, route additions, source-of-truth switching, and real personal training data migration unimplemented.

The next recommended task is Task 6.26 Production Manual Acceptance Runbook V1, docs/static tests only. Task 6.26 must not add production runtime, auth runtime, sync runtime, deployment runtime, package changes, routes, or source-of-truth switching.

## Task 6.26 Production Manual Acceptance Alignment

Task 6.26 Production Manual Acceptance Runbook V1 adds `docs/PRODUCTION_MANUAL_ACCEPTANCE_RUNBOOK.md` as production-readiness manual acceptance documentation.

Task 6.26 requires dedicated test environment, dedicated browser profile, dedicated dev DB where applicable, synthetic data, source-of-truth checks, auth/account if implemented, sync if implemented, backup/export/delete/recovery, deployment if implemented, rollback checks, and pass/fail template.

Task 6.26 keeps production runtime, auth runtime, sync runtime, deployment runtime, production backend activation, secret values, package changes, route additions, source-of-truth switching, and real personal training data migration unimplemented.

The next recommended task is Task 6.27 Production Rollback & Incident Runbook V1, docs/static tests only. Task 6.27 must not add runtime incident handling, production deployment, auth runtime, sync runtime, package changes, routes, or source-of-truth switching.
