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
