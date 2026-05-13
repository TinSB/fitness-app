# Backend-Primary Regression Lock

## Task Identity

Task 9.11 Backend-Primary Regression Lock V1 locks Phase 9 backend-primary candidate boundaries.

This task adds static/regression tests and docs only. It does not add runtime features or routes.

## Locked Boundaries

- localStorage default mode still exists
- localStorage fallback still exists
- localStorage migration role still exists
- localStorage emergency backup still exists
- backend-primary candidate requires explicit opt-in
- backend-primary candidate is not enabled by default
- runtime switch guard state machine exists
- fallback/rollback/emergency restore boundaries exist
- accepted browser mutation routes remain exactly seven
- no eighth browser mutation route
- `POST /data-health/repair/apply` remains blocked
- backup/import/export over HTTP remains blocked
- reset/recovery over HTTP remains blocked
- no auth/user accounts/cloud sync/deployment/monitoring runtime
- no SaaS/multi-user runtime
- no normalized tables
- no destructive migration
- browser bundle must remain free of forbidden Node/dev API tokens
- no real personal data fixtures
- no package dependency/script/lockfile drift
- api-primary-dev remains dev/local only and not production-ready
- devApiRunner is not production backend

## Decision

Task 9.11 result: backend-primary regression lock only.

Recommended next task: Task 9.12 Phase 9 Completion Archive V1.

Task 9.12 is not part of Task 9.11. Auto-continue mode may begin Task 9.12 only after Task 9.11 is fully merged.
