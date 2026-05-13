# Production Read Contract Implementation

## Task Identity

Task 8.6 Production Read Contract Implementation V1 adds minimal Node-only production read contract route-like handling.

This is not an App runtime switch and not a production source-of-truth change.

## Supported Read Contract Routes

Allowed read route-like handlers:

- `GET /app-data/summary`
- `GET /sessions/summary`
- `GET /history`
- `GET /history/:id`
- `GET /data-health/summary`

Handlers are plain functions using the production persistence adapter boundary. They do not auto-start a server, register HTTP routes, import browser App runtime, or read localStorage as backend persistence.

## Response Boundary

Every response includes `sourceOfTruth: false`.

Supported results return status 200 from the persistence adapter.

Missing history detail returns a stable not-found result.

Unsupported adapter behavior returns a stable unsupported result.

Non-GET methods return method-not-allowed.

## Preserved Boundaries

`localStorage` remains frontend default source, fallback, migration source, and emergency backup.

Backend read contract is not source-of-truth.

`api-primary-dev` remains explicit dev/local only and not production-ready.

Accepted browser mutation routes remain exactly seven. No write route or eighth browser mutation route is authorized.

## Blocked Scope

- no write routes
- no mutation routes
- no source-of-truth switch
- no real production database
- no browser App runtime import
- no auth runtime
- no cloud sync
- no deployment runtime
- no monitoring runtime
- no package changes
- no real personal training data

## Decision

Task 8.6 result: minimal Node-only production read contract implementation using adapter boundary and synthetic tests only.

Recommended next task: Task 8.7 Frontend Production API Client Skeleton V1.

Task 8.7 may begin only after Task 8.6 is fully merged.
