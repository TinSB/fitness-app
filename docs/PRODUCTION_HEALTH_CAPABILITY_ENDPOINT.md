# Production Health & Capability Endpoint

## Task Identity

Task 8.4 Production Health & Capability Endpoint V1 adds Node-only production runtime route-like handling for `GET /health` and `GET /capabilities`.

These are plain function handlers, not registered HTTP routes. They do not start a server, listen on a port, add deployment config, connect to real user data, perform writes, or expose browser mutation routes.

## Route-like Handlers

Supported route-like handlers:

- `GET /health`
- `GET /capabilities`

Unsupported paths return a stable not-found result.

Unsupported methods return a stable method-not-allowed result.

## Capability Payload

The capability response separates runtime status from source-of-truth and feature status:

- `runtimeAvailable: false`
- `sourceOfTruth: false`
- `auth: false`
- `cloudSync: false`
- `deploymentReady: false`
- `monitoringReady: false`
- `readContract: unsupported`
- `writeContract: false`
- `localStorageRole: default_fallback_migration_emergency`

## Preserved Boundaries

`localStorage` remains default runtime source, fallback, migration source, and emergency backup.

`api-primary-dev` remains explicit dev/local only and not production-ready.

Production source-of-truth switch remains blocked.

Accepted browser mutation routes remain exactly seven. No eighth browser mutation route is authorized.

## Blocked Scope

- no browser mutation route
- no real production server listener
- no auth runtime
- no cloud sync
- no deployment runtime
- no monitoring runtime
- no production source-of-truth
- no package changes
- no real personal training data

## Decision

Task 8.4 result: Node-only health/capability route-like handling only.

Recommended next task: Task 8.5 Production Persistence Strategy Adapter V1.

Task 8.5 may begin only after Task 8.4 is fully merged.
