# Sync Metadata Conflict Detector Prototype

## Scope / Non-goals

Task 6.19 adds a pure local sync metadata and conflict detector prototype.

This is not sync runtime implementation. This is not network implementation. This is not cloud write implementation. This is not background worker implementation. This is not auth runtime implementation. This is not route implementation. This is not production source-of-truth migration implementation.

This task adds no dependencies, package scripts, lockfile changes, browser route changes, App runtime changes, storage source changes, external provider configuration, or real personal training data.

## Phase 6 Baseline

Task 6.0 through Task 6.18 are complete. Production backend activation, auth runtime, cloud sync runtime, deployment runtime, production source-of-truth migration, and normalized schema remain unimplemented.

`localStorage` remains default runtime source, fallback, migration source, and emergency backup. `api-primary-dev` remains explicit dev/local only and not production-ready.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

## Prototype Surface

Task 6.19 adds `src/sync/syncConflictDetector.ts` as a pure TypeScript utility.

The prototype accepts synthetic metadata only: snapshot id, device id, optional account id, client revision, server revision, operation id, idempotency key, deletion marker, and previously applied operation ids.

The prototype returns deterministic status metadata. It performs no read from localStorage, no write to localStorage, no HTTP request, no cloud write, no background processing, and no remote queue mutation.

## Conflict Cases

The detector classifies:

- `no_conflict`
- `stale_client`
- `stale_server`
- `divergent_edits`
- `deletion_conflict`
- `duplicate_operation`
- `account_mismatch`
- `invalid_metadata`

Automatic merge remains blocked. Conflict statuses that could change user data require future user-visible resolution policy before any runtime sync work.

## Idempotency

The prototype surfaces operation id, idempotency key, and duplicate operation detection.

Duplicate operation detection is local metadata classification only. It does not acknowledge remote writes and does not mark any operation as applied.

## Safety Boundaries

No sync runtime is implemented. No network calls are implemented. No cloud writes are implemented. No background sync worker is implemented. No remote write queue is implemented. No auth/account runtime is implemented. No source-of-truth switch is implemented.

## Decision

Task 6.19 result: pure local sync metadata conflict detector prototype only.

Decision: keep sync behavior at metadata classification level and require acceptance before any runtime sync work.

Recommended next task: `Task 6.20 Sync Conflict Acceptance V1`.

Task 6.20 must be docs/static tests only. It must not add remote writes, sync runtime, automatic merge, network calls, cloud provider configuration, auth runtime, routes, dependencies, or source-of-truth switching.

## Decision Record

- Date: 2026-05-12
- Branch / commit: `codex/task6.19-sync-metadata-conflict-detector-prototype` / pending until merge
- Decision: add pure local conflict detector metadata classification only.
- Baseline: `localStorage` remains default runtime source and `api-primary-dev` remains dev/local only.
- Accepted routes: `POST /data-health/issues/:issueId/dismiss`; `POST /history/:id/data-flag`; `POST /history/:id/edit`; `POST /sessions/start`; `POST /sessions/active/patches`; `POST /sessions/active/complete`; `POST /sessions/active/discard`
- Still blocked: sync runtime, network writes, cloud writes, remote queue, background sync worker, automatic merge, auth runtime, source-of-truth switch.
- Required future gates: sync conflict acceptance, production sync final audit, privacy-safe logging lock, rollback/incident runbook, and manual acceptance.
- Next task: `Task 6.20 Sync Conflict Acceptance V1`
- Rollback requirement: revert the Task 6.19 commit; no data migration or runtime activation is involved.

## Final Recommendation

Task 6.19 is complete after this task.

Do not start sync runtime yet. Next task should be Task 6.20 Sync Conflict Acceptance V1.
