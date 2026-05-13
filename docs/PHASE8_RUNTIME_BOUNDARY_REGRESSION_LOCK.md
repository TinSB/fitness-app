# Phase 8 Runtime Boundary Regression Lock

## Task Identity

Task 8.13 Phase 8 Runtime Boundary Regression Lock V1 locks the Phase 8 production runtime boundaries.

This task adds static/regression tests and documentation only. It does not add runtime features or routes.

## Locked Runtime Boundaries

- production runtime Node-only modules are not exported from browser-facing API index
- browser production bundle must remain free of forbidden Node/dev API tokens
- localStorage remains default runtime source
- localStorage remains fallback, migration source, and emergency backup
- api-primary-dev remains explicit dev/local only and not production-ready
- production runtime skeleton does not become source-of-truth
- frontend production API client is disabled by default
- dual-read comparison is diagnostic only
- write shadow mode does not mutate localStorage
- mutation route inventory remains exactly seven
- no eighth browser mutation route
- repair/reset/import/export routes remain blocked
- no auth/user accounts/cloud sync/deployment/monitoring runtime
- no normalized tables
- no destructive migration
- no package dependency/script/lockfile drift
- no real personal data fixtures

## Phase 8 Accepted Runtime Skeleton Capabilities

Phase 8 accepts only:

- inert Node-only production runtime skeleton
- fail-closed production runtime config guard
- Node-only health/capability route-like handling
- production persistence adapter boundary with synthetic in-memory test adapter
- Node-only read contract route-like handling
- disabled-by-default frontend production API client skeleton
- diagnostic-only dual-read comparison
- production mutation contract guard
- disabled-by-default write shadow mode
- deployment boundary documentation
- manual acceptance documentation

## Still Blocked

- full production backend
- auth/user accounts runtime
- cloud sync runtime
- deployment runtime
- monitoring runtime
- production source-of-truth switch
- `POST /data-health/repair/apply`
- backup/import/export over HTTP
- reset/recovery over HTTP
- eighth browser mutation route
- normalized tables
- destructive migration
- real personal training data

## Decision

Task 8.13 result: Phase 8 runtime boundary regression lock only.

Recommended next task: Task 8.14 Phase 8 Completion Archive V1.

Task 8.14 may begin only after Task 8.13 is fully merged.
