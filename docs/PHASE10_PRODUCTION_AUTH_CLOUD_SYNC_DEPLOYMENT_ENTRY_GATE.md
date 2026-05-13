# Phase 10 Production Auth / Cloud Sync / Deployment Entry Gate

## Task Identity

Task 10.1 Production Auth / Cloud Sync / Deployment Entry Gate V1 opens Phase 10.

This task is docs/static tests only. It authorizes guarded contract, strategy, skeleton, and boundary work for later Phase 10 tasks, but it does not implement real auth, user accounts, cloud sync, deployment runtime, monitoring runtime, or SaaS/multi-user runtime.

## Phase 9 Completion Evidence

Phase 9 is complete.

- Final Phase 9 task: Task 9.12 Phase 9 Completion Archive V1
- Pull request: #188
- Merge commit: `af71c0c41e9034907ac5a32e2b7fb36de4feb492`
- Final validation: `npm run api:dev:build` passed
- Final validation: `npm run typecheck` passed
- Final validation: `npm test` passed with 961 files and 3726 tests
- Final validation: `npm run build` passed
- Final validation: dist token scan clean

Phase 9 added a cutover entry gate, backend-primary host boundary, AppData repository candidate, migration dry run, read candidate, mutation candidate, runtime switch guard, fallback/rollback/emergency restore, confirmation safety copy, manual acceptance, regression lock, and completion archive.

Phase 9 did not implement auth, user accounts, cloud sync, deployment runtime, monitoring runtime, SaaS/multi-user runtime, normalized tables, destructive migration, route expansion, package changes, or real personal training data artifacts.

Backend-primary candidate remains explicit opt-in and reversible.

## Phase 10 Authorization

Phase 10 may begin cloud-production entry work only as contracts, decisions, disabled skeletons, guards, manual acceptance, regression locks, and archive evidence.

Authorized Phase 10 categories are narrow:

- user identity/data ownership contract
- auth provider strategy decision
- disabled auth runtime skeleton
- account-scoped AppData boundary
- cloud sync strategy/conflict policy
- disabled cloud sync skeleton
- secrets/environment guard
- deployment target architecture decision
- disabled deployment runtime skeleton
- monitoring/audit event boundary
- privacy/data safety manual acceptance
- cloud production regression lock
- Phase 10 completion archive

Authorization is limited to explicit Task 10.x scopes. Auth, cloud sync, deployment, and monitoring behavior must remain disabled, non-provider, non-networked, non-deployed, and non-uploading unless a later explicit phase authorizes real implementation.

## Blocked Capabilities

The following remain blocked in Task 10.1 and across Phase 10 unless a specific later task explicitly authorizes a narrow disabled boundary:

- real auth provider integration
- real login/signup UI or runtime
- real user accounts runtime
- real cloud sync runtime
- real multi-device sync
- production deployment runtime
- external monitoring or analytics upload
- SaaS/multi-user runtime
- backend-primary as automatic default source
- localStorage fallback removal
- localStorage migration source removal
- localStorage emergency backup removal
- api-primary-dev production promotion
- devApiRunner production deployment
- node:sqlite snapshot repository as production multi-user database
- normalized tables
- destructive migration
- real personal training data in docs, tests, fixtures, examples, or acceptance evidence
- package dependency, package script, or lockfile changes
- provider SDK dependency
- secrets in the browser bundle
- backup/import/export over HTTP
- reset/recovery over HTTP
- `POST /data-health/repair/apply`
- eighth browser mutation route

## Runtime Boundary

`localStorage` remains the default runtime source unless explicit backend-primary candidate mode is manually enabled by a guarded runtime switch.

`localStorage` remains fallback, migration source, and emergency backup.

Backend-primary candidate remains explicit opt-in.

Backend-primary candidate remains reversible.

Fallback, rollback, and emergency restore remain available.

`api-primary-dev` remains explicit dev/local only and not production-ready.

Auth skeletons must be disabled by default.

Cloud sync skeletons must be disabled by default.

Deployment runtime skeletons must be disabled by default.

Monitoring/audit boundaries must not upload externally.

## Route Boundary

Accepted browser mutation routes remain exactly seven:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

No eighth browser mutation route is authorized by Task 10.1.

## Validation Gate

Every Phase 10 task must pass:

- `npm run api:dev:build`
- `npm run typecheck`
- `npm test`
- `npm run build`
- dist token scan for `node:http`, `node:sqlite`, `devLauncher`, `httpRuntimeAdapter`, `serverAdapter`, `sqliteRepository`, `devApiRunner`, and `devDbRecovery`

Required PR check remains GitHub Actions `IronPath Validation`.

## Decision

Task 10.1 result: Phase 10 auth/cloud-sync/deployment entry gate only.

Recommended next task: Task 10.2 User Identity & Data Ownership Contract V1.

Task 10.2 is not part of Task 10.1. Auto-continue mode may begin Task 10.2 only after Task 10.1 is fully merged.
