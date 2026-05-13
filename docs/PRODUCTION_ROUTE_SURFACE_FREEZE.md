# Production Route Surface Freeze

## Task Identity

Task 7.3 freezes production route surface candidates and blocked routes before any production runtime implementation.

This task is docs/static tests only. It does not add routes, route handlers, server adapters, frontend API clients, production backend runtime, auth runtime, sync runtime, deployment runtime, monitoring runtime, or source-of-truth switching.

## Accepted Browser Mutation Routes

Accepted browser mutation routes remain exactly seven:

1. `POST /data-health/issues/:issueId/dismiss`
2. `POST /history/:id/data-flag`
3. `POST /history/:id/edit`
4. `POST /sessions/start`
5. `POST /sessions/active/patches`
6. `POST /sessions/active/complete`
7. `POST /sessions/active/discard`

No eighth browser mutation route is authorized.

## Read Route Candidates

These are read route candidates only:

- `GET /health`
- `GET /app-data/summary`
- `GET /sessions/summary`
- `GET /history`
- `GET /history/:id`
- `GET /data-health/summary`

Candidate does not mean implemented. Candidate does not mean authorized for production source-of-truth.

## Mutation Route Candidates

The only currently accepted mutation candidates are the seven accepted browser mutation routes listed above.

No production-only mutation route expansion is authorized by Task 7.3.

## Blocked Routes and Capabilities

These remain blocked:

- `POST /data-health/repair/apply`
- backup/import/export over HTTP
- reset/recovery over HTTP
- eighth browser mutation route
- production-only route expansion
- auth/sync/cloud route expansion
- api-primary-dev production promotion

## Dev/local API Boundary

Dev/local routes are not automatically production routes. Dev-only prototype acceptance does not imply production route acceptance.

Any future production route requires separate authorization, source-of-truth review, auth/user-data review, failure/rollback requirements, and manual acceptance.

## Source-of-truth Boundary

`localStorage` remains default runtime source, fallback, migration source, and emergency backup.

`api-primary-dev` remains explicit dev/local only and not production-ready. No production source-of-truth switch is authorized.

## Decision

Task 7.3 result: production route surface freeze only.

Recommended next task: `Task 7.4 Production Source-of-Truth Migration Preconditions V1`.

Task 7.4 is not started by Task 7.3.
