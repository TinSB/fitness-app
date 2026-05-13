# Production Runtime Contract Scaffold Authorization

## Task Identity

Task 7.2 defines production runtime contract scaffold authorization.

This task is docs/static tests only. It does not implement a live backend, add routes, add auth, add sync, add deployment, add monitoring, modify App runtime, modify storage runtime, or change package scripts/dependencies/lockfiles.

## Phase 7 Context

Task 7.1 opened Phase 7 as an authorization gate. Phase 7 authorizes planning, boundaries, guardrails, and readiness evidence before any production implementation.

`localStorage` remains default runtime source, fallback, migration source, and emergency backup. `api-primary-dev` remains explicit dev/local only and not production-ready.

## Contract Scaffold Purpose

A future production runtime contract scaffold would describe typed frontend/backend expectations before implementation. It is a planning artifact and possible compile-time scaffold, not a live production backend.

The scaffold must make future implementation safer by defining boundary expectations, failure behavior, ownership, and forbidden surfaces before any route or source-of-truth work.

## Candidate Production Contract Areas

- read contract
- mutation contract
- auth/user identity requirement
- data ownership
- source-of-truth migration conditions
- failure/rollback behavior
- observability requirements
- environment separation
- route surface control

## Explicitly Blocked Production Runtime Areas

- production backend runtime
- auth/user accounts runtime
- cloud sync runtime
- deployment runtime
- monitoring runtime
- production source-of-truth switch
- normalized tables/schema migration
- destructive real-data migration
- additional browser mutation routes
- backup/import/export over HTTP
- reset/recovery over HTTP
- api-primary-dev production promotion

## Source-of-truth Boundary

The contract scaffold does not authorize source-of-truth switching. API results must not silently overwrite AppData or localStorage.

Any future source-of-truth switch requires separate authorization, migration preconditions, rollback evidence, auth/user identity, backup/export safety, and manual acceptance.

## Dev/local API Boundary

Dev/local API routes and `api-primary-dev` behavior are not production routes. Dev/local route acceptance does not imply production route acceptance.

Node-only dev API artifacts must remain isolated from the production browser bundle.

## Contract vs Implementation Distinction

Contract scaffold means planned shapes, constraints, and acceptance criteria. It does not mean server implementation, route handlers, database writes, auth provider setup, network calls, deployment, or runtime source selection.

## Acceptance Criteria

- Contract areas and blocked areas are documented.
- `localStorage` remains default/fallback/migration/emergency source.
- `api-primary-dev` remains explicit dev/local only and not production-ready.
- No production backend/auth/sync/deployment/monitoring/source-of-truth switch is authorized.
- No routes, package changes, normalized tables, destructive migrations, or real personal training data are added.

## Decision

Task 7.2 result: production runtime contract scaffold authorization only.

Recommended next task: `Task 7.3 Production Route Surface Freeze V1`.

Task 7.3 is not started by Task 7.2.
