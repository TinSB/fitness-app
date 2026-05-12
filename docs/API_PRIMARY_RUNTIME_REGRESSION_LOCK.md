# API Primary Runtime Regression Lock

## Scope / Non-goals

Task 5.31 regression-locks the Phase 5 API primary dev runtime state after Tasks 5.24 through 5.30.

This task does not add runtime behavior, does not modify App.tsx, does not make API primary the default, does not replace or delete localStorage, does not add a browser mutation route, does not add DataHealth repair, does not add backup/import/export over HTTP, does not add reset/recovery over HTTP, does not add production backend, auth, sync, cloud, deployment, monitoring, package dependency, package script, normalized table, or an eighth browser mutation route.

## Locked Runtime Modes

Accepted runtime source modes remain exactly:

- `localStorage`
- `api-readonly`
- `api-primary-dev`

`localStorage` remains the default runtime source. `api-primary-dev` is explicit dev/local opt-in only, requires localhost-only Dev API base URL, and is not production-ready.

## Source Selector Lock

The runtime source selector must keep:

- missing runtime source -> `localStorage`
- invalid runtime source -> `localStorage`
- non-dev API mode -> `localStorage`
- non-localhost API base URL -> `localStorage`
- `api-readonly` reads allowed and writes kept on localStorage
- `api-primary-dev` reads and writes allowed only in dev/local mode
- no production runtime mode

## Boot Lock

API snapshot boot remains guarded:

- explicit `api-primary-dev` required
- AppData-shaped payload required
- schema validation required
- snapshot metadata required
- unavailable/malformed/missing metadata/schema-invalid returns visible localStorage fallback
- no localStorage write
- no App.tsx wiring in this lock

## Read Lock

API primary reads remain route-specific and safe:

- `GET /app-data/summary` stays diagnostics/read facade behavior.
- unavailable, timeout, malformed response, and server errors remain visible failures.
- snapshot metadata is safe metadata only.
- read results do not silently overwrite AppData.
- read results do not silently overwrite localStorage.

## Write Lock

API primary writes remain route-specific through the accepted API storage adapter methods.

Write success requires:

- HTTP 2xx
- `ok=true`
- `changed=true`
- `status="success"`
- snapshot metadata

Missing snapshot metadata, malformed response, unavailable API, timeout, `changed=false`, or server non-success remains a visible failure.

## Accepted Browser Mutation Routes

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

No other browser mutation route is accepted.

## Blocked Routes And Capabilities

Still blocked:

- `POST /data-health/repair/apply`
- backup/import/export over HTTP
- reset/recovery over HTTP
- any eighth browser mutation route
- broad frontend mutation client
- production backend/auth/sync/cloud/deployment
- normalized tables
- training algorithm, template, scheduler, PR, e1RM, effectiveSet, or backup safety changes

## LocalStorage Fallback Lock

localStorage remains:

- default runtime source
- fallback source
- migration source
- emergency backup

API primary must not silently write localStorage, delete localStorage, replace localStorage, or silently overwrite AppData from API errors.

## Browser Build Isolation

Browser build must remain clean of:

- `node:http`
- `node:sqlite`
- `devLauncher`
- `httpRuntimeAdapter`
- `serverAdapter`
- `sqliteRepository`
- `devApiRunner`
- `devDbRecovery`

## Coverage Inventory

Regression coverage includes:

- `tests/runtimeSourceSelector.test.ts`
- `tests/runtimeSourceSelectorBoundary.test.ts`
- `tests/apiStorageAdapter.test.ts`
- `tests/apiStorageAdapterBoundary.test.ts`
- `tests/apiStorageAdapterErrorHandling.test.ts`
- `tests/bootFromApiSnapshotPrototype.test.ts`
- `tests/bootFromApiSnapshotBoundary.test.ts`
- `tests/bootFromApiSnapshotFailureModes.test.ts`
- `tests/apiWriteThroughRuntimePrototype.test.ts`
- `tests/apiWriteThroughRuntimeBoundary.test.ts`
- `tests/apiWriteThroughRuntimeFailureModes.test.ts`
- `tests/apiWriteThroughRuntimeLocalStorageIntegrity.test.ts`
- `tests/apiPrimaryRuntimeAcceptance.test.ts`
- `tests/apiPrimaryRuntimeAcceptanceBoundary.test.ts`
- `tests/apiPrimaryRuntimeAcceptanceDocs.test.ts`
- `tests/apiPrimaryRuntimeManualAcceptanceDocs.test.ts`
- `tests/apiPrimaryRuntimeManualAcceptanceBoundary.test.ts`
- `tests/apiPrimaryRuntimeManualAcceptanceDocsParity.test.ts`
- `tests/apiPrimaryRuntimeHardening.test.ts`
- `tests/apiPrimaryRuntimeHardeningBoundary.test.ts`
- `tests/apiPrimaryRuntimeHardeningDocs.test.ts`

## Manual Inventory

Manual coverage includes:

- `docs/API_PRIMARY_RUNTIME_MANUAL_ACCEPTANCE.md`
- dedicated test browser profile
- dedicated dev DB
- no real personal training data
- API primary boot
- API primary read
- all seven accepted write routes
- API unavailable fallback
- localStorage integrity
- forbidden route and UI checks
- cleanup/env reset

## Future Work Gate

The next task may start migration dry-run work only if this regression lock remains green.

Future work must not:

- make API primary production default
- delete localStorage
- silently overwrite localStorage
- add DataHealth repair
- add backup/import/export over HTTP
- add reset/recovery over HTTP
- add an eighth browser mutation route
- start Phase 6 production backend/auth/sync/cloud/deployment

## Decision

Task 5.31 locks API primary dev runtime as explicit dev/local, route-specific, localStorage-fallback-safe, and not production-ready.

Next recommended task: `Task 5.32 LocalStorage to SQLite Migration Dry-run V1`.

## Final Recommendation

Task 5.31 result: API primary runtime regression lock only.
No browser mutation route is added.
No production backend, auth, sync, cloud, deployment, dependency, package script, normalized table, DataHealth repair, backup/import/export HTTP, reset/recovery HTTP, or eighth route is added.
`localStorage` remains default and fallback/migration source.
API primary remains explicit dev/local `api-primary-dev`.
Next task should be Task 5.32 LocalStorage to SQLite Migration Dry-run V1.
