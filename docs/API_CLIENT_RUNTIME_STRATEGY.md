# API Client Runtime Strategy

## Scope / Non-goals

Task 5.3 plans the browser API client runtime strategy.

- This is documentation and static-test coverage only.
- This does not implement API clients.
- This does not implement API-backed runtime.
- This does not switch source of truth.
- This does not add localStorage replacement.
- This does not modify `App.tsx`.
- This does not add a broad frontend mutation client.
- This does not add production backend, auth, sync, cloud, deployment, or monitoring.
- This does not add a browser mutation route.
- This does not add package dependencies, package scripts, lockfile changes, normalized tables, schemas, storage adapters, or training algorithm changes.

## Current Baseline

At Task 5.3 entry, localStorage remains source of truth. API results never overwrite AppData or localStorage.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`

API-backed runtime is not implemented. Runtime source selection is not implemented.

## Typed Route Client Strategy

Future browser API clients must be typed and route-specific:

- read clients expose named GET functions.
- mutation clients expose one named function per accepted route.
- each function owns its request payload, response validation, timeout, abort, and safe error mapping.
- no generic browser `request(method, path)` mutation helper is approved.
- no UI code should construct arbitrary API paths.

## Read Client Strategy

Read clients must remain GET-only unless a later task explicitly implements a route-specific mutation client.

Allowed future read routes for API-backed read runtime planning:

- `GET /health`
- `GET /app-data/summary`
- `GET /sessions/summary`
- `GET /history`
- `GET /history/:id`
- `GET /data-health/summary`

Read results may power diagnostics or explicit dev/local read mode only after later acceptance. Read results must not silently overwrite AppData or localStorage.

## Mutation Client Boundaries

Mutation clients must stay route-specific. At Task 5.3, accepted browser mutation routes remain the four Phase 4 routes only.

Future Phase 5 active-session routes may be planned or implemented only by their approved tasks:

- Task 5.14 may add only `POST /sessions/active/patches`.
- Task 5.17 may add only `POST /sessions/active/complete`.
- Task 5.20 may add only `POST /sessions/active/discard`.

Still blocked:

- `POST /data-health/repair/apply`
- backup/import/export over HTTP
- reset/recovery over HTTP
- any eighth browser mutation route
- production-only routes
- auth/sync/cloud routes

## Error Shape

Client-facing errors should use a safe normalized shape:

- `code`: stable short failure code.
- `message`: short safe message.
- `httpStatus`: optional HTTP status.
- `retryable`: boolean.
- `snapshotPresent`: boolean when relevant.
- `safeDetails`: optional redacted details.

Raw stack traces, raw API responses, AppData dumps, localStorage dumps, SQLite internals, environment variables, and personal training data dumps must not be exposed.

## Timeout / Abort / Retry Policy

- Every client request must support timeout.
- Every UI-owned request must support abort on unmount or cancellation.
- Timeout and abort must not show success.
- No automatic write retry is approved.
- Read retry may be planned later only when it cannot mutate AppData/localStorage.
- Retry after failed mutation must require explicit user action and route-specific confirmation.

## Request Fingerprint Strategy

Mutation clients must carry request identity metadata when the route requires it:

- `mutationId`
- `idempotencyKey`
- `requestFingerprint`
- target identity
- source snapshot identity

The request fingerprint must bind the intended route, target, source snapshot, and payload shape. A missing or mismatched fingerprint must be failure, not success.

## Snapshot Metadata Handling

- Mutation success must require snapshot metadata when the route writes.
- Missing snapshot metadata must be failure for write clients.
- Read clients may display snapshot metadata for diagnostics.
- Snapshot metadata must not be stored in localStorage by a client.
- Snapshot metadata must not replace AppData by itself.

## Source Snapshot Strategy

Mutation clients must carry source snapshot metadata when required:

- `sourceSnapshotHash`
- `sourceSnapshotVersion`
- source timestamp or safe version marker if available

Source snapshot mismatch must be visible failure. No auto-merge is approved at the client layer.

## Decision

Use typed route clients and route-specific mutation clients. Reject broad browser mutation clients.

Next task: `Task 5.4 Runtime Source Switch Feature Flag Plan V1`.

Task 5.4 must be docs/static tests only. It must not implement runtime source selection, API-backed runtime, localStorage replacement, source-of-truth migration, production backend/auth/sync/deployment, or a new browser mutation route.

## Decision Record

- Date: 2026-05-11
- Branch / commit: `codex/task5.3-api-client-runtime-strategy` / pending until merge
- Decision: plan typed route clients and route-specific mutation client boundaries before runtime source flags.
- Current accepted routes: `POST /data-health/issues/:issueId/dismiss`; `POST /history/:id/data-flag`; `POST /history/:id/edit`; `POST /sessions/start`
- Rejected next steps: broad mutation client, arbitrary browser POST helper, API-backed runtime implementation, localStorage replacement, source-of-truth switch, production backend/auth/sync/deployment, unapproved route expansion.
- Recommended next task: `Task 5.4 Runtime Source Switch Feature Flag Plan V1`
- Rollback requirement: because this strategy adds docs/static tests only, rollback is reverting the strategy commit.

## Final Recommendation

Task 5.3 result: API client runtime strategy only.
localStorage remains source of truth.
API results never overwrite AppData or localStorage.
No API client implementation is added.
No broad mutation client is added.
No API-backed runtime is implemented.
No production backend, auth, sync, cloud, deployment, or monitoring is added.
Next task should be Task 5.4 Runtime Source Switch Feature Flag Plan V1.
