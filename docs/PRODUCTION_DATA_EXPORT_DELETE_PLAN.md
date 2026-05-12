# Production Data Export Delete Plan

## Scope / Non-goals

Task 6.28 plans production data export and delete responsibilities.

This is docs/static tests only. This is not export runtime implementation. This is not delete runtime implementation. This is not account deletion runtime implementation. This is not backup retention runtime implementation. This is not audit retention runtime implementation. This is not source-of-truth migration implementation.

Task 6.28 has no implementation.

This task adds no dependencies, package scripts, lockfile changes, routes, auth provider, deployment provider, sync provider, secret values, production data migration, or real personal training data.

## Phase 6 Baseline

Task 6.0 through Task 6.27 are complete. Production backend activation, auth runtime, cloud sync runtime, deployment runtime, production source-of-truth migration, export/delete runtime, and normalized schema remain unimplemented except for narrow inert/pure skeletons already documented.

`localStorage` remains default runtime source, fallback, migration source, and emergency backup. localStorage remains default runtime source. `api-primary-dev` remains explicit dev/local only and not production-ready. api-primary-dev remains explicit dev/local only.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

## Export Responsibilities

Future production export must define data classes included, owner, format, identity binding, privacy redaction requirements, backup interaction, audit record, and user-visible completion/failure state.

Task 6.28 adds no export runtime and no backup/export HTTP route.

## Delete Responsibilities

Future production delete must define data classes deleted, data classes retained, backup retention, audit retention, recovery window, identity verification, and irreversible deletion approval.

Task 6.28 adds no delete runtime and no destructive operation.

## Account Deletion

If accounts are implemented in a future approved task, account deletion must cover local data linking, server data ownership, backup retention, audit retention, sync metadata, and user-visible confirmation.

No account deletion runtime is implemented in Task 6.28.

## Backup Retention

Future backup retention must define retention period, deletion eligibility, restore eligibility, encryption requirement, and owner. Backup-first remains required before any destructive migration or delete action.

No backup retention runtime is implemented in Task 6.28.

## Audit Record Retention

Future audit records must minimize personal data, avoid raw AppData, avoid localStorage dumps, avoid token/secret values, document retention, and support privacy incident review.

No audit logging runtime is implemented in Task 6.28.

## Decision

Task 6.28 result: production data export/delete plan only.

Decision: plan export, delete, account deletion, backup retention, and audit record retention responsibilities without implementation.

Recommended next task: `Task 6.29 Production Phase Implementation Boundary Lock V1`.

Task 6.29 must be docs/static tests only. It must not add production runtime, auth runtime, sync runtime, deployment runtime, package changes, routes, or source-of-truth switching.

## Final Recommendation

Task 6.28 is complete after this task.

Do not add export/delete runtime yet. Next task should be Task 6.29 Production Phase Implementation Boundary Lock V1.
