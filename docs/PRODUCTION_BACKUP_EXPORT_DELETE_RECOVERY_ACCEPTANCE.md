# Production Backup Export Delete Recovery Acceptance

## Scope / Non-goals

Task 6.33 is production backup, export, delete, and recovery acceptance documentation.

This is docs/static tests only. This is not backup runtime implementation. This is not export runtime implementation. This is not delete runtime implementation. This is not recovery runtime implementation. This is not destructive migration implementation. This is not production source-of-truth migration implementation.

This task adds no dependencies, package scripts, lockfile changes, browser routes, server routes, auth provider, deployment provider, sync provider, secret values, production data migration, normalized tables, or real personal training data.

## Phase 6 Baseline

Tasks 6.0 through 6.32 are complete. Backup/restore, export/delete, rollback/incident, manual acceptance, and security/privacy hardening are documented. Production backup/export/delete/recovery runtime remains unimplemented unless a future approved task explicitly adds it.

`localStorage` remains default runtime source, fallback, migration source, and emergency backup. `api-primary-dev` remains explicit dev/local only and not production-ready.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

## Export Policy Acceptance

Future production export must define included data classes, excluded data classes, owner, identity binding, format, redaction rules, backup interaction, audit record, user-visible status, and failure behavior.

Task 6.33 adds no export runtime and no backup/export HTTP route.

## Delete Policy Acceptance

Future production delete must define deleted data classes, retained data classes, retention windows, identity verification, account deletion implications if accounts exist, irreversible deletion approval, recovery window, and user-visible failure state.

Task 6.33 adds no delete runtime and performs no destructive operation.

## Account Deletion Implications

If account runtime exists in a future approved task, account deletion must cover local data linking, production data ownership, backup retention, audit retention, sync metadata, privacy incident records, and user-visible confirmation.

If account runtime is not implemented, record `not implemented` and do not attempt account deletion.

## Backup-first Rule

Any future destructive migration, delete, restore, or recovery operation must be backup-first. The backup must be created before the write, validated for readability, tied to a source snapshot, and documented with restore instructions.

No backup/import/export over HTTP is added by Task 6.33.

## Restore Verification

Future restore must verify backup readability, schema/version compatibility, source snapshot identity, expected record counts or snapshot keys, source-of-truth consistency, localStorage fallback, and user-visible recovery state.

Restore verification must fail visibly. No fake success is allowed.

## Rollback Drill

Future rollback drills must use a dedicated test environment, dedicated browser profile, dedicated dev DB when applicable, and synthetic data only. They must document rollback owner, rollback trigger, validation checklist, privacy response, communication path, and post-rollback acceptance.

Task 6.33 performs no rollback runtime operation.

## No Destructive Automated Real-data Operation

Automated tasks must use no real personal training data. Automated tasks must not delete localStorage, overwrite production data, write production SQLite, clear accounts, upload cloud data, or perform destructive restore.

Any future destructive operation requires explicit separate approval, backup verification, rollback plan, manual acceptance, and visible failure behavior.

## No Silent Overwrite

API results must not silently overwrite AppData or localStorage. Future backup/export/delete/recovery work must show visible success and visible failure states, preserve localStorage fallback unless explicitly approved otherwise, and avoid fake success.

## Route Boundary

No new browser mutation route is added. DataHealth repair remains blocked. Backup/import/export over HTTP remains blocked. Reset/recovery over HTTP remains blocked. Auth/sync/cloud routes remain blocked unless a future approved task explicitly adds them.

## Decision

Task 6.33 result: backup/export/delete/recovery acceptance documentation and static tests only.

Decision: keep backup/export/delete/recovery at policy, acceptance, and runbook level; keep destructive automation, HTTP backup/export/delete/recovery routes, and production source-of-truth switching blocked.

Recommended next task: `Task 6.34 Production Sync / Conflict Final Audit V1`.

Task 6.34 must be docs/static tests only. It must not add sync runtime, network writes, cloud writes, background sync workers, remote write queues, package changes, source-of-truth switching, or real-data migration.

## Decision Record

- Date: 2026-05-12
- Branch / commit: `codex/task6.33-production-backup-export-delete-recovery-acceptance` / pending until merge
- Decision: accept documented backup/export/delete/recovery safety boundaries without implementation.
- Baseline: `localStorage` remains default runtime source and `api-primary-dev` remains dev/local only.
- Accepted routes: `POST /data-health/issues/:issueId/dismiss`; `POST /history/:id/data-flag`; `POST /history/:id/edit`; `POST /sessions/start`; `POST /sessions/active/patches`; `POST /sessions/active/complete`; `POST /sessions/active/discard`
- Still blocked: backup/import/export over HTTP, reset/recovery over HTTP, destructive restore, destructive delete, production migration, source-of-truth switch, and real-data automation.
- Required future gates: sync conflict final audit, deployment environment final audit, monitoring/logging privacy lock, release candidate regression lock, Phase 6 exit lock.
- Next task: `Task 6.34 Production Sync / Conflict Final Audit V1`
- Rollback requirement: revert the Task 6.33 commit; no runtime state is involved.

## Final Recommendation

Task 6.33 is complete after this task.

Do not add backup/export/delete/recovery runtime yet. Next task should be Task 6.34 Production Sync / Conflict Final Audit V1.
