# Phase 8 Production Runtime Implementation Entry Gate

## Task Identity

Task 8.1 Production Runtime Implementation Entry Gate V1 opens Phase 8.

This is an implementation entry gate, not production runtime implementation. Task 8.1 is docs/static tests only.

## Phase 7 Completion Evidence

Phase 7 is complete.

- Final Phase 7 task: Task 7.10 Phase 7 Completion Archive V1
- Pull request: #162
- Merge commit: `934b79c47029943c3c34a53d8c044e34a10c3aa3`
- Final validation: `npm run api:dev:build` passed
- Final validation: `npm run typecheck` passed
- Final validation: `npm test` passed with 926 files and 3591 tests
- Final validation: `npm run build` passed
- Final validation: dist token scan clean

Phase 7 stayed within authorization, planning, guard, readiness, and archive scope. It did not implement production backend, auth, user accounts, cloud sync, deployment runtime, monitoring runtime, production source-of-truth switch, normalized tables, destructive migration, new routes, package changes, or real personal training data use.

## Phase 8 Authorization

Phase 8 may begin the smallest safe implementation path toward frontend/backend separation.

Authorized Phase 8 categories are narrow:

- Node-only production runtime skeleton boundary
- production runtime config guard
- health/capability route-like handling
- production persistence adapter interface
- minimal read contract implementation
- disabled-by-default frontend production API client
- diagnostic-only dual-read comparison
- production mutation contract guard
- write shadow mode that is not source-of-truth
- deployment boundary documentation
- manual acceptance documentation
- boundary regression tests
- Phase 8 completion archive

Authorization is limited to explicit Task 8.x scopes. A later Phase 8 task may implement only the narrow capability named by that task.

## Blocked Capabilities

The following remain blocked in Task 8.1 and across Phase 8 unless a specific Task 8.x section explicitly allows a narrow boundary:

- full production backend
- auth runtime
- user accounts runtime
- cloud sync runtime
- deployment runtime
- monitoring runtime
- production source-of-truth switch
- localStorage replacement
- api-primary-dev production promotion
- devApiRunner production deployment
- node:sqlite snapshot repository as production multi-user database
- normalized tables
- destructive migrations
- real personal training data in docs, tests, fixtures, or examples
- package dependency, package script, or lockfile changes
- backup/import/export over HTTP
- reset/recovery over HTTP
- `POST /data-health/repair/apply`
- eighth browser mutation route

## Runtime Boundary

`localStorage` remains the default runtime source.

`localStorage` remains fallback, migration source, and emergency backup.

`api-primary-dev` remains explicit dev/local only and not production-ready.

Production source-of-truth switch remains blocked.

Production runtime skeleton work must not pollute the browser production bundle.

## Route Boundary

Accepted browser mutation routes remain exactly seven:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

No eighth browser mutation route is authorized by Task 8.1.

## Validation Gate

Every Phase 8 task must pass:

- `npm run api:dev:build`
- `npm run typecheck`
- `npm test`
- `npm run build`
- dist token scan for `node:http`, `node:sqlite`, `devLauncher`, `httpRuntimeAdapter`, `serverAdapter`, `sqliteRepository`, `devApiRunner`, and `devDbRecovery`

Required PR check remains GitHub Actions `IronPath Validation`.

## Decision

Task 8.1 result: Phase 8 implementation entry gate only.

Recommended next task: Task 8.2 Production Runtime Skeleton Boundary V1.

Task 8.2 is not part of Task 8.1. Auto-continue mode may begin Task 8.2 only after Task 8.1 is fully merged.
