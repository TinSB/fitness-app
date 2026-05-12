# LocalStorage to SQLite Migration Apply Prototype

## Scope / Non-goals

Task 5.33 implements a dev-only migration apply prototype helper.

This helper is not wired to App.tsx, does not add a browser route, does not add an HTTP migration endpoint, does not delete localStorage, does not write localStorage, does not auto-switch source of truth, does not add production backend, auth, sync, cloud, deployment, monitoring, package dependency, package script, normalized table, DataHealth repair, backup/import/export over HTTP, reset/recovery over HTTP, or an eighth browser mutation route.

## Dev-only Gate

Migration apply requires:

- development mode
- `VITE_IRONPATH_MIGRATION_APPLY="localstorage-to-sqlite-apply"`
- explicit confirmation
- backup-first localStorage snapshot metadata
- successful Task 5.32 dry-run
- injected SQLite snapshot writer

## Backup-first Requirement

Apply is blocked unless a backup object exists with:

- backup id
- created timestamp
- localStorage snapshot payload

The helper never creates a production backup service and never deletes localStorage after backup.

## Apply Behavior

Apply behavior is narrow:

- run Task 5.32 dry-run first.
- block if dry-run fails.
- block if no localStorage AppData is found.
- call only the injected SQLite snapshot writer.
- require valid SQLite snapshot metadata from the writer.
- return visible failure when the writer throws or returns malformed metadata.

## No Source Switch

Apply never:

- deletes localStorage.
- writes localStorage.
- switches runtime source.
- sets API primary as default.
- treats migration apply as production-ready.

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

Task 5.33 adds a dev-only, backup-first, confirmation-gated migration apply helper with an injected SQLite snapshot writer.

Next recommended task: `Task 5.34 Migration Acceptance / Manual Acceptance V1`.

## Final Recommendation

Task 5.33 result: migration apply prototype only.
SQLite snapshot writing is allowed only through the injected writer after backup-first and explicit confirmation gates.
No localStorage deletion, localStorage write, automatic source switch, production backend, auth, sync, cloud, deployment, package change, normalized table, DataHealth repair, backup/import/export HTTP, reset/recovery HTTP, or eighth browser mutation route is added.
localStorage remains available as fallback and migration source.
Next task should be Task 5.34 Migration Acceptance / Manual Acceptance V1.
