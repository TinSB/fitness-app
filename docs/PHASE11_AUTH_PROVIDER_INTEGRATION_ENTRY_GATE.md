# Phase 11 Auth Provider Integration Entry Gate

## Task Identity

Task 11.1 Auth Provider Integration Entry Gate V1 opens Phase 11.

This task is docs/static tests only. It authorizes guarded auth-provider candidate work for later Phase 11 tasks, but it does not integrate a real provider, add a provider dependency, add login UI, add cloud sync, add deployment, add monitoring, add routes, or change package/lockfiles.

## Phase 10 Completion Evidence

Phase 10 is complete.

- Final Phase 10 task: Task 10.14 Phase 10 Completion Archive V1
- Pull request: #202
- Merge commit: `2643473aa794729ecd0457bf46f7b82af586213b`
- Final validation: `npm run api:dev:build` passed
- Final validation: `npm run typecheck` passed
- Final validation: `npm test` passed with 979 files and 3812 tests
- Final validation: `npm run build` passed
- Final validation: dist token scan clean

Phase 10 added the auth/cloud/deployment entry gate, identity ownership contract, adapter-first auth strategy, disabled auth skeleton, account-scoped AppData boundary, cloud sync policy and disabled skeleton, secrets/environment guard, deployment decision and disabled skeleton, monitoring/audit boundary, privacy manual acceptance, regression locks, and completion archive.

Phase 10 did not implement a real auth provider, real login/user accounts runtime, real cloud sync, production deployment runtime, external monitoring upload, SaaS/multi-user runtime, normalized tables, destructive migration, route expansion, package changes, or real personal training data artifacts.

## Phase 11 Authorization

Phase 11 may begin auth-provider candidate work only under explicit guards.

Authorized Phase 11 categories are narrow:

- auth provider final decision
- auth environment/callback guard
- auth adapter provider candidate
- auth session boundary
- login/logout candidate UI
- local account linking dry run
- account-scoped backend-primary auth candidate
- auth failure/logout/emergency local mode
- auth provider manual acceptance
- Phase 11 archive

The preferred provider candidate direction is Supabase Auth. Clerk remains the backup candidate. Auth.js and custom auth are not preferred now.

Authorization is limited to explicit Task 11.x scopes. Provider behavior must remain candidate, fake, guarded, or disabled unless a later explicit task authorizes real provider integration.

## Blocked Capabilities

The following remain blocked in Task 11.1 and across Phase 11 unless a specific later task explicitly authorizes a narrow candidate boundary:

- real provider SDK dependency
- package dependency, package script, or lockfile changes
- real cloud sync
- real multi-device sync
- production deployment runtime
- external monitoring upload
- SaaS/multi-user runtime
- billing/payment/subscription runtime
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
- backup/import/export over HTTP
- reset/recovery over HTTP
- `POST /data-health/repair/apply`
- eighth browser mutation route

## Runtime Boundary

`localStorage` remains the default runtime source unless explicit backend-primary candidate mode is manually enabled by a guarded runtime switch.

`localStorage` remains fallback, migration source, and emergency backup.

Backend-primary candidate remains explicit opt-in and reversible.

Fallback, rollback, and emergency restore remain available.

`api-primary-dev` remains explicit dev/local only and not production-ready.

Auth provider candidate must not imply cloud sync.

Login candidate must not automatically upload local training data.

Logout candidate must not delete local emergency backup.

Session failure must not block local app usage.

## Route Boundary

Accepted browser mutation routes remain exactly seven:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

No eighth browser mutation route is authorized by Task 11.1.

## Validation Gate

Every Phase 11 task must pass:

- `npm run api:dev:build`
- `npm run typecheck`
- `npm test`
- `npm run build`
- dist token scan for `node:http`, `node:sqlite`, `devLauncher`, `httpRuntimeAdapter`, `serverAdapter`, `sqliteRepository`, `devApiRunner`, and `devDbRecovery`

Required PR check remains GitHub Actions `IronPath Validation`.

## Decision

Task 11.1 result: Phase 11 auth provider integration entry gate only.

Recommended next task: Task 11.2 Auth Provider Final Decision V1.

Task 11.2 is not part of Task 11.1. Auto-continue mode may begin Task 11.2 only after Task 11.1 is fully merged.
