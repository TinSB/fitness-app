# LocalStorage to SQLite Migration Dry-run

## Scope / Non-goals

Task 5.32 implements a dry-run helper for localStorage to SQLite migration readiness.

This is a dry-run only. It does not write SQLite, does not write localStorage, does not delete localStorage, does not switch source of truth, does not auto-apply migration, does not add production backend, auth, sync, cloud, deployment, monitoring, package dependency, package script, normalized table, DataHealth repair, backup/import/export over HTTP, reset/recovery over HTTP, or an eighth browser mutation route.

## Dry-run Inputs

The dry-run accepts:

- injected localStorage-like reader
- optional API snapshot summary reader
- current AppData schema validation
- current AppData sanitizer

It does not require real personal training data and must be run only against dedicated test profiles/dev data during manual testing.

## Validation Behavior

The dry-run validates:

- localStorage can be read.
- localStorage AppData exists.
- raw localStorage schema can be checked.
- sanitized AppData validates against the current schema.
- schema version can be summarized.
- history count can be summarized.
- template count can be summarized.
- active session presence can be summarized.
- settings presence can be summarized.

## Warning-only Behavior

Warnings are allowed for:

- missing localStorage AppData.
- raw schema mismatch before sanitization.
- API snapshot unavailable.
- API snapshot schema mismatch.
- API snapshot count mismatch.

Warnings do not write SQLite, write localStorage, switch source, repair data, or apply migration.

## No-write Lock

The dry-run result must always report:

- `shouldWriteSqlite: false`
- `shouldWriteLocalStorage: false`
- `shouldSwitchSource: false`
- `productionReady: false`

## Accepted Browser Mutation Routes

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

No migration browser mutation route is added.

## Still Blocked

Still blocked:

- migration apply without backup-first
- localStorage deletion
- source-of-truth switch
- DataHealth repair
- backup/import/export over HTTP
- reset/recovery over HTTP
- production backend/auth/sync/cloud/deployment
- broad mutation client
- normalized tables
- eighth browser mutation route

## Decision

Task 5.32 adds dry-run-only migration readiness behavior.

Next recommended task: `Task 5.33 LocalStorage to SQLite Migration Apply Prototype V1`.

## Final Recommendation

Task 5.32 result: migration dry-run only.
No SQLite write, localStorage write, localStorage deletion, source switch, production backend, auth, sync, cloud, deployment, package change, normalized table, DataHealth repair, backup/import/export HTTP, reset/recovery HTTP, or eighth browser mutation route is added.
localStorage remains default and fallback/migration source.
Next task should be Task 5.33 LocalStorage to SQLite Migration Apply Prototype V1.
