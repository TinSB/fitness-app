# Production Security Privacy Final Hardening

## Scope / Non-goals

Task 6.32 is Phase 6 final security and privacy hardening.

This is docs/static tests only unless a narrow redaction or environment-validation defect is exposed by tests. This task does not add a production backend, auth runtime, login/signup, user account runtime, cloud sync runtime, deployment runtime, monitoring service, production source-of-truth migration, browser route, server route, package dependency, package script, lockfile change, normalized table, or real personal training data migration.

## Phase 6 Baseline

Tasks 6.0 through 6.31 are complete. Task 6.23 added a safe environment validation skeleton. Task 6.24 added a privacy-safe redaction utility. Task 6.25 documented production-readiness security hardening. Task 6.31 aligned the production manual acceptance runbook.

`localStorage` remains default runtime source, fallback, migration source, and emergency backup. `api-primary-dev` remains explicit dev/local only and not production-ready.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

## Secret Leakage Final Lock

Secret values must not be committed, embedded in browser code, included in fixtures, printed by diagnostics, copied into manual evidence, or accepted by browser-side environment validation.

Future auth, sync, deployment, and monitoring work must use secret references only until a separate production environment gate approves storage, rotation, access, and incident handling.

## Sensitive Data Logging Final Lock

Raw AppData logging is blocked. localStorage dump logging is blocked. Token and secret logging is blocked. Personal training payloads must be redacted before diagnostic output.

The redaction utility is the accepted narrow safeguard for synthetic diagnostics. It is not an external monitoring service and does not approve telemetry collection.

## Privacy Controls Final Lock

Automated tests must use synthetic data only. Manual checks must use a dedicated test environment, dedicated browser profile, and dedicated dev DB when applicable.

No real personal training data may be used unless a future explicit approval defines handling, backup, retention, deletion, redaction, and rollback requirements.

## Auth / Sync / Deployment Boundary

Task 6.32 adds no auth provider, no login/signup, no token/session handling, no OAuth, no user table, no cloud sync engine, no background sync worker, no remote write queue, no deployment config that changes production behavior, and no production monitoring runtime.

## Route Boundary

No new browser mutation route is added. DataHealth repair remains blocked. Backup/import/export over HTTP remains blocked. Reset/recovery over HTTP remains blocked. Auth/sync/cloud routes remain blocked unless a future approved task explicitly adds them.

## Source-of-truth Boundary

Production source-of-truth switching is not approved by Task 6.32. API/SQLite production primary is not approved. localStorage fallback and emergency backup remain required.

## Final Hardening Checklist

- Confirm no raw AppData logging.
- Confirm no localStorage dump logging.
- Confirm no token, secret, credential, cookie, or session logging.
- Confirm browser build isolation remains clean of Node-only and dev API tokens.
- Confirm route allowlist remains unchanged.
- Confirm no production backend/auth/sync/deployment runtime is added.
- Confirm no package dependency, package script, or lockfile change is added.
- Confirm no real personal training data is used.

## Decision

Task 6.32 result: final security/privacy hardening documentation and static tests only.

Decision: keep existing redaction and environment validation skeletons as narrow privacy safeguards, keep production auth/sync/deployment/monitoring unimplemented, and require future gates before any production data handling or telemetry collection.

Recommended next task: `Task 6.33 Production Backup, Export, Delete & Recovery Acceptance V1`.

Task 6.33 must be docs/static tests only. It must not add destructive automated real-data operations, backup/import/export HTTP routes, reset/recovery HTTP routes, package changes, source-of-truth switching, or real-data migration.

## Decision Record

- Date: 2026-05-12
- Branch / commit: `codex/task6.32-production-security-privacy-final-hardening` / pending until merge
- Decision: finalize Phase 6 security/privacy boundaries without adding runtime capability.
- Baseline: `localStorage` remains default runtime source and `api-primary-dev` remains dev/local only.
- Accepted routes: `POST /data-health/issues/:issueId/dismiss`; `POST /history/:id/data-flag`; `POST /history/:id/edit`; `POST /sessions/start`; `POST /sessions/active/patches`; `POST /sessions/active/complete`; `POST /sessions/active/discard`
- Still blocked: auth runtime, sync runtime, deployment runtime, production monitoring service, secret values, route additions, source-of-truth switch, and real-data migration.
- Required future gates: backup/export/delete/recovery acceptance, sync conflict final audit, deployment environment final audit, monitoring/logging privacy lock, release candidate regression lock, Phase 6 exit lock.
- Next task: `Task 6.33 Production Backup, Export, Delete & Recovery Acceptance V1`
- Rollback requirement: revert the Task 6.32 commit; no runtime state is involved.

## Final Recommendation

Task 6.32 is complete after this task.

Do not deploy production yet. Next task should be Task 6.33 Production Backup, Export, Delete & Recovery Acceptance V1.
