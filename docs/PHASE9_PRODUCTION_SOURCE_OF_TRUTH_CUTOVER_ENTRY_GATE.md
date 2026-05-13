# Phase 9 Production Source-of-Truth Cutover Entry Gate

## Task Identity

Task 9.1 Production Source-of-Truth Cutover Entry Gate V1 opens Phase 9.

This task is docs/static tests only. It authorizes guarded backend-primary candidate work for later Phase 9 tasks, but it does not implement cutover or backend-primary behavior.

## Phase 8 Completion Evidence

Phase 8 is complete.

- Final Phase 8 task: Task 8.14 Phase 8 Completion Archive V1
- Pull request: #176
- Merge commit: `445ba77e323363b2fb55bb216104981a70ca6f78`
- Final validation: `npm run api:dev:build` passed
- Final validation: `npm run typecheck` passed
- Final validation: `npm test` passed with 945 files and 3657 tests
- Final validation: `npm run build` passed
- Final validation: dist token scan clean

Phase 8 added a Node-only runtime skeleton boundary, config guard, health/capability handlers, persistence adapter boundary, read contract, disabled frontend API client skeleton, diagnostic dual-read comparison, mutation guard, write shadow mode, deployment boundary, manual acceptance, regression lock, and completion archive.

Phase 8 did not implement production source-of-truth switch, auth, user accounts, cloud sync, deployment runtime, monitoring runtime, SaaS/multi-user runtime, normalized tables, destructive migration, route expansion, package changes, or real personal training data artifacts.

## Phase 9 Authorization

Phase 9 may begin backend-primary candidate cutover infrastructure under explicit guards.

Authorized Phase 9 categories are narrow:

- backend-primary runtime host boundary
- backend AppData repository candidate
- cutover data migration dry run
- backend-primary read candidate
- backend-primary mutation candidate
- frontend source-of-truth runtime switch guard
- fallback / rollback / emergency restore
- cutover confirmation UX / safety copy
- source-of-truth cutover manual acceptance
- backend-primary regression lock
- Phase 9 completion archive

Authorization is limited to explicit Task 9.x scopes. Backend-primary candidate mode must remain explicit opt-in, reversible, and disabled by default.

## Blocked Capabilities

The following remain blocked in Task 9.1 and across Phase 9 unless a specific Task 9.x section explicitly allows a narrow candidate boundary:

- auth runtime
- user accounts runtime
- cloud sync runtime
- deployment runtime
- monitoring runtime
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
- backup/import/export over HTTP
- reset/recovery over HTTP
- `POST /data-health/repair/apply`
- eighth browser mutation route

## Runtime Boundary

`localStorage` remains the default runtime source unless explicit backend-primary candidate mode is manually enabled by a later guarded task.

`localStorage` remains fallback, migration source, and emergency backup.

`api-primary-dev` remains explicit dev/local only and not production-ready.

Backend-primary candidate mode must not promote api-primary-dev, must not deploy devApiRunner, and must not use node:sqlite snapshot repository as a production multi-user database.

## Route Boundary

Accepted browser mutation routes remain exactly seven:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

No eighth browser mutation route is authorized by Task 9.1.

## Validation Gate

Every Phase 9 task must pass:

- `npm run api:dev:build`
- `npm run typecheck`
- `npm test`
- `npm run build`
- dist token scan for `node:http`, `node:sqlite`, `devLauncher`, `httpRuntimeAdapter`, `serverAdapter`, `sqliteRepository`, `devApiRunner`, and `devDbRecovery`

Required PR check remains GitHub Actions `IronPath Validation`.

## Decision

Task 9.1 result: Phase 9 source-of-truth cutover entry gate only.

Recommended next task: Task 9.2 Backend-Primary Runtime Host Boundary V1.

Task 9.2 is not part of Task 9.1. Auto-continue mode may begin Task 9.2 only after Task 9.1 is fully merged.
