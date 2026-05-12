# Sync Conflict Acceptance

## Scope / Non-goals

Task 6.20 is acceptance documentation and static tests for the Task 6.19 sync metadata conflict detector.

This is docs/static tests only. This is not sync runtime implementation. This is not remote write implementation. This is not automatic merge implementation. This is not network implementation. This is not cloud provider implementation. This is not auth runtime implementation. This is not route implementation. This is not production source-of-truth migration implementation.

This task adds no dependencies, package scripts, lockfile changes, App runtime changes, storage runtime changes, browser route changes, cloud configuration, or real personal training data.

## Phase 6 Baseline

Task 6.0 through Task 6.19 are complete. The Task 6.19 detector is a pure local metadata classifier only.

`localStorage` remains default runtime source, fallback, migration source, and emergency backup. `api-primary-dev` remains explicit dev/local only and not production-ready.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

## Accepted Conflict Cases

Acceptance coverage must preserve these detector classifications:

- `no_conflict`: metadata aligns, but `canAutoApply` remains false.
- `stale_client`: local client revision is behind server revision.
- `stale_server`: local metadata references a newer server revision than remote metadata.
- `divergent_edits`: matching revisions point to different snapshots.
- `deletion_conflict`: one side marks the snapshot deleted.
- `duplicate_operation`: operation id has already been applied and must not be duplicated.
- `account_mismatch`: account identity differs and must block.
- `invalid_metadata`: required identity or revision fields are missing or invalid.

## No Auto-merge

Automatic merge remains blocked. The detector may classify metadata, but it must not apply changes, reconcile snapshots, delete records, upload data, or mark a conflict resolved.

Any future merge behavior requires a separate user-visible conflict policy, manual acceptance, rollback plan, and explicit approval.

## No Remote Writes

Task 6.20 adds no remote writes, no cloud writes, no network calls, no remote write queue, no background sync worker, and no provider configuration.

Duplicate operation handling is acceptance of metadata idempotency only. It is not a remote acknowledgement.

## User-visible Conflict Policy

Future conflict UI must show conflict type, affected synthetic snapshot metadata, blocking reason, available safe actions, and rollback/recovery path before any production sync runtime.

No user-visible conflict UI is implemented in Task 6.20.

## Route and Source-of-truth Boundary

No browser mutation route is added. No production-only route is added. No auth/sync/cloud route is added.

`localStorage` remains the default runtime source. API/SQLite production primary remains unapproved. The detector result must never silently overwrite AppData or localStorage.

## Decision

Task 6.20 result: sync conflict acceptance only.

Decision: accept the Task 6.19 detector as pure metadata classification while keeping sync runtime, remote writes, automatic merge, and source-of-truth switching blocked.

Recommended next task: `Task 6.21 Production Environment Config Boundary V1`.

Task 6.21 must be docs/static tests only. It must not enable production runtime by default, deploy production, add secret values, add routes, add dependencies, or switch source of truth.

## Decision Record

- Date: 2026-05-12
- Branch / commit: `codex/task6.20-sync-conflict-acceptance` / pending until merge
- Decision: accept conflict detector semantics and keep sync runtime blocked.
- Baseline: `localStorage` remains default runtime source and `api-primary-dev` remains dev/local only.
- Accepted routes: `POST /data-health/issues/:issueId/dismiss`; `POST /history/:id/data-flag`; `POST /history/:id/edit`; `POST /sessions/start`; `POST /sessions/active/patches`; `POST /sessions/active/complete`; `POST /sessions/active/discard`
- Still blocked: sync runtime, remote writes, cloud writes, network calls, remote queue, background sync worker, automatic merge, auth runtime, source-of-truth switch.
- Required future gates: environment config boundary, deployment strategy, secrets validation skeleton, sync final audit, and manual acceptance.
- Next task: `Task 6.21 Production Environment Config Boundary V1`
- Rollback requirement: revert the Task 6.20 commit; no data migration or runtime activation is involved.

## Final Recommendation

Task 6.20 is complete after this task.

Do not start sync runtime yet. Next task should be Task 6.21 Production Environment Config Boundary V1.

## Task 6.21 Follow-up

Task 6.21 Production Environment Config Boundary V1 follows this sync conflict acceptance work with docs/static tests only.

Task 6.21 must document `local`, `development`, `staging`, and `production` names, secrets separation, no secret values, no production deploy, and no runtime production enable by default. It must not enable production runtime, deploy production, add secret values, add routes, add dependencies, or switch source of truth.

The next recommended task after Task 6.21 is `Task 6.22 Deployment Runtime Strategy & Staging Plan V1`, docs/static tests only.
