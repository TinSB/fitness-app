# Backend-Primary Runtime Host Boundary

## Task Identity

Task 9.2 Backend-Primary Runtime Host Boundary V1 adds a Node-only backend-primary runtime host boundary.

This is candidate infrastructure only. It is not a live backend, not a deployment runtime, and not a source-of-truth switch.

## Host Boundary

The host boundary exposes:

- `createBackendPrimaryRuntimeHost(...)`
- `getBackendPrimaryRuntimeHostCapabilities(...)`
- `handleBackendPrimaryRuntimeRequest(...)`
- stable statuses: `disabled`, `candidate`, `unsupported`, and `not_source_of_truth`

The default host status is `disabled`. When enabled for tests or future candidate work, the host still reports `sourceOfTruth: false`.

## Capability Contract

The host capabilities state:

- Node-only boundary
- no auto-listen
- no HTTP server startup
- no source-of-truth behavior
- no auth runtime
- no cloud sync runtime
- no deployment runtime
- no monitoring runtime
- localStorage remains default, fallback, migration source, and emergency backup
- api-primary-dev is not promoted
- devApiRunner is not hosted as production backend
- node:sqlite snapshot repository is not promoted as production multi-user database

## Browser Isolation

The backend-primary runtime host is not exported from browser-facing API indexes and is not imported by App runtime.

Future tasks may use it only as a Node-only candidate boundary.

## Blocked Scope

Task 9.2 does not add:

- live HTTP listener
- backend deployment config
- auth or user accounts
- cloud sync
- monitoring runtime
- source-of-truth switch
- browser imports
- package dependency, package script, or lockfile changes
- real personal data artifacts

## Decision

Task 9.2 result: Node-only backend-primary runtime host boundary only.

Recommended next task: Task 9.3 Backend AppData Repository Candidate V1.

Task 9.3 is not part of Task 9.2. Auto-continue mode may begin Task 9.3 only after Task 9.2 is fully merged.
