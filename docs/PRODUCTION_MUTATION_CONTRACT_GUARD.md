# Production Mutation Contract Guard

## Task Identity

Task 8.9 Production Mutation Contract Guard V1 locks the production mutation contract before write shadow mode.

This task is docs/static tests only. It does not add mutation endpoints, route handlers, backend source-of-truth writes, browser clients, or runtime integration.

## Accepted Browser Mutation Route Allowlist

Accepted browser mutation routes remain exactly seven:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

No eighth browser mutation route is authorized.

## Blocked Routes And Capabilities

The following remain blocked:

- `POST /data-health/repair/apply`
- backup/import/export over HTTP
- reset/recovery over HTTP
- eighth browser mutation route
- backend source-of-truth writes
- fake mutation success
- localStorage overwrite from production mutation results
- AppData overwrite from production mutation results
- auth-gated write runtime
- cloud sync write runtime

## Production Write Boundary

Production write path is not source-of-truth.

Mutation failures must not overwrite localStorage.

Mutation results must not silently replace AppData.

Future write shadow mode may validate shape and result state only. It must not add routes or become source-of-truth.

## Preserved Boundaries

`localStorage` remains default runtime source, fallback, migration source, and emergency backup.

`api-primary-dev` remains explicit dev/local only and not production-ready.

Production source-of-truth switch remains blocked.

No real personal training data may be used in tests, docs examples, fixtures, or acceptance evidence.

## Decision

Task 8.9 result: production mutation contract guard only.

Recommended next task: Task 8.10 Production Write Shadow Mode V1.

Task 8.10 may begin only after Task 8.9 is fully merged.
