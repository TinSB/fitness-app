# Migration Rollback & Recovery Hardening

## Scope / Non-goals

Task 5.35 hardens migration rollback and recovery for the Task 5.32 dry-run and Task 5.33 apply prototype.

This task does not add an HTTP reset or recovery route, does not modify App.tsx, does not delete localStorage, does not auto-switch source of truth, does not add production backend, auth, sync, cloud, deployment, monitoring, package dependency, package script, normalized table, DataHealth repair, backup/import/export over HTTP, reset/recovery over HTTP, or an eighth browser mutation route.

## Restore LocalStorage Backup

LocalStorage backup restore requires:

- development mode
- `VITE_IRONPATH_MIGRATION_ROLLBACK="localstorage-to-sqlite-rollback"`
- explicit confirmation
- backup id
- backup timestamp
- AppData payload
- schema validation after sanitization
- injected localStorage restore function

The helper does not directly write browser localStorage; restore is delegated to the explicit injected callback.

## Restore Dev DB Backup

Dev DB backup restore requires:

- development mode
- explicit confirmation
- backup id
- backup timestamp
- SQLite snapshot metadata
- injected dev DB restore function
- valid restored snapshot metadata

The helper does not import Node-only SQLite modules and does not add an HTTP recovery route.

## Corrupt Snapshot Handling

Corrupt backup inputs remain blocked:

- missing backup id
- missing timestamp
- missing AppData payload
- unsanitizable AppData
- missing SQLite snapshot metadata
- malformed restored snapshot metadata

## Schema Mismatch Handling

Schema mismatch remains visible:

- backup AppData is sanitized first.
- sanitized AppData must validate against the current schema.
- schema-invalid backup data blocks restore.
- schema mismatch does not trigger automatic repair.
- schema mismatch does not delete localStorage.

## Clear Failure State

Successful restore returns a clear success state:

- `failureStateCleared: true`
- `shouldDeleteLocalStorage: false`
- `shouldSwitchSource: false`
- `productionReady: false`

Failed restore returns:

- `failureStateCleared: false`
- stable error code
- no source switch
- no localStorage deletion
- no production readiness

## Accepted Browser Mutation Routes

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

No rollback or recovery browser mutation route is added.

## Still Blocked

Still blocked:

- HTTP reset route
- HTTP recovery route
- localStorage deletion
- automatic source switch
- production migration
- DataHealth repair
- backup/import/export over HTTP
- reset/recovery over HTTP
- broad mutation client
- normalized tables
- production backend/auth/sync/cloud/deployment
- eighth browser mutation route

## Decision

Task 5.35 adds dev-only rollback/recovery helper coverage with injected restore callbacks and no HTTP recovery surface.

Next recommended task: `Task 5.36 Migration Regression Lock V1`.

## Final Recommendation

Task 5.35 result: migration rollback and recovery hardening only.
No HTTP reset/recovery route, localStorage deletion, automatic source switch, production backend, auth, sync, cloud, deployment, package change, normalized table, DataHealth repair, backup/import/export HTTP, reset/recovery HTTP, or eighth browser mutation route is added.
localStorage remains available as fallback and migration source.
Next task should be Task 5.36 Migration Regression Lock V1.
