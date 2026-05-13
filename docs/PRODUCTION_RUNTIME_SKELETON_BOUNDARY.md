# Production Runtime Skeleton Boundary

## Task Identity

Task 8.2 Production Runtime Skeleton Boundary V1 adds a minimal Node-only production runtime skeleton boundary.

This is a skeleton boundary only. It does not implement a live production backend, HTTP listener, auth, user accounts, cloud sync, deployment runtime, monitoring runtime, production persistence, source-of-truth switch, or browser integration.

## Boundary Shape

The skeleton lives under the Node-only API area as `apps/api/src/node/productionRuntimeSkeleton.ts`.

The skeleton may expose:

- `createProductionRuntimeSkeleton`
- `createProductionRuntimeCapabilities`
- stable disabled/scaffold-only status
- capability flags that explicitly report unsupported runtime behavior

The skeleton must not be exported from `apps/api/src/index.ts`, imported by `src/App.tsx`, imported by browser runtime source, or used to start a server.

## Capability Result

The capability object reports:

- `runtimeAvailable: false`
- `autoListen: false`
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

The skeleton does not use the dev API runner, does not use the node:sqlite snapshot repository as production persistence, does not read or write real user data, and does not promote any backend to source-of-truth.

Accepted browser mutation routes remain exactly seven, and no eighth browser mutation route is authorized.

## Blocked Capabilities

- live production backend
- HTTP listener or auto-listen server
- auth or user accounts
- cloud sync
- deployment runtime
- monitoring runtime
- source-of-truth switch
- normalized tables
- destructive migrations
- real personal training data
- package dependency, script, or lockfile changes

## Decision

Task 8.2 result: inert Node-only production runtime skeleton boundary only.

Recommended next task: Task 8.3 Production Runtime Config Guard V1.

Task 8.3 may begin only after Task 8.2 is fully merged.
