# Production Manual Acceptance Runbook

## Scope / Non-goals

Task 6.26 creates a production-readiness manual acceptance runbook.

This is docs/static tests only. This is not production runtime implementation. This is not auth runtime implementation. This is not sync runtime implementation. This is not deployment runtime implementation. This is not source-of-truth migration implementation.

This task adds no dependencies, package scripts, lockfile changes, routes, auth provider, deployment provider, sync provider, secret values, production data migration, or real personal training data.

## Dedicated Test Environment

Manual acceptance must use a dedicated test environment, dedicated browser profile, dedicated dev DB if the dev API is used, and synthetic data.

No real personal training data may be used unless a future explicit approval defines controlled handling, backup, retention, and deletion.

## Phase 6 Baseline

Task 6.0 through Task 6.25 are complete. Production backend activation, auth runtime, cloud sync runtime, deployment runtime, production source-of-truth migration, and normalized schema remain unimplemented except for narrow inert/pure skeletons already documented.

`localStorage` remains default runtime source, fallback, migration source, and emergency backup. localStorage remains default runtime source. `api-primary-dev` remains explicit dev/local only and not production-ready. api-primary-dev remains explicit dev/local only.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

## Source-of-truth Checks

- Confirm default runtime starts in localStorage mode.
- Confirm `api-primary-dev` remains explicit dev/local only.
- Confirm API/SQLite production primary is not approved.
- Confirm no manual step overwrites localStorage silently.
- Confirm localStorage remains emergency backup and fallback.

## Auth / Account Checks

If auth/account runtime is not implemented, record `not implemented` and do not attempt login/signup.

If a future approved task implements auth/account runtime, manually verify account creation, login, logout, account linking, account deletion, export/delete responsibilities, and identity mismatch behavior in a dedicated test environment.

## Sync Checks

If sync runtime is not implemented, record `not implemented` and do not attempt cloud writes.

If a future approved task implements sync runtime, manually verify device identity, idempotency, conflict detection, duplicate write prevention, offline behavior, rollback, and user-visible conflict resolution.

## Backup / Export / Delete / Recovery Checks

- Confirm backup-first policy is documented before any future destructive operation.
- Confirm export/delete responsibilities are documented.
- Confirm recovery and rollback steps are available before any future production data operation.
- Confirm no backup/import/export/reset/recovery HTTP route is exposed unless a future approved task explicitly adds it.

## Deployment Checks

If deployment runtime is not implemented, record `not implemented` and do not deploy production.

If a future approved task implements deployment, manually verify environment separation, secret references, required checks, rollback, preview vs production distinction, and release artifact identity.

## Rollback Checks

Manual acceptance must record rollback owner, rollback trigger, backup/recovery path, localStorage fallback state, and validation steps after rollback.

No destructive rollback or real-data restore is performed by Task 6.26.

## Pass / Fail Template

- Environment:
- Browser profile:
- Dev DB:
- Synthetic data fixture:
- Source-of-truth result:
- Auth/account result:
- Sync result:
- Backup/export/delete/recovery result:
- Deployment result:
- Rollback result:
- Privacy/security result:
- Final result: Pass / Fail
- Blockers:

## Decision

Task 6.26 result: production manual acceptance runbook only.

Decision: require dedicated test environment, synthetic data, source-of-truth checks, auth/sync/deployment status recording, backup/export/delete/recovery checks, rollback checks, and pass/fail template before final Phase 6 readiness.

Recommended next task: `Task 6.27 Production Rollback & Incident Runbook V1`.

Task 6.27 must be docs/static tests only. It must not add runtime incident handling, production deployment, auth runtime, sync runtime, package changes, routes, or source-of-truth switching.

## Final Recommendation

Task 6.26 is complete after this task.

Do not deploy production yet. Next task should be Task 6.27 Production Rollback & Incident Runbook V1.

## Task 6.31 Final Readiness Update

Task 6.31 extends this production manual acceptance runbook for final Phase 6 readiness review.

This update is docs/static tests only. It adds no production runtime, no auth runtime, no sync runtime, no deployment runtime, no package changes, no route changes, no production source-of-truth switch, and no real personal training data use.

Final manual acceptance must confirm the current Phase 6 implementation state before the security/privacy final hardening task:

- Source of truth: `localStorage` remains the default runtime source, fallback, migration source, and emergency backup.
- API runtime: `api-primary-dev` remains explicit dev/local only and not production-ready.
- Backend: production backend activation remains unimplemented unless a future approved task changes it.
- Auth/account: auth runtime, login/signup, token/session handling, and account runtime remain unimplemented unless a future approved task changes them.
- Sync: cloud sync runtime, background sync workers, remote write queues, and automatic conflict merge remain unimplemented unless a future approved task changes them.
- Backup/export/delete/recovery: policies and runbooks exist, but no destructive automated real-data operation is performed by this task.
- Deployment: production deployment runtime remains unimplemented unless a future approved task changes it.
- Rollback: rollback and incident runbooks must be available before any future production operation.
- Privacy/security: redaction and environment validation skeletons remain narrow safeguards, not production monitoring deployment.

## Task 6.31 Final Readiness Scenario Matrix

| Scenario | Expected status | Manual acceptance requirement |
| --- | --- | --- |
| Dedicated environment | Required | Use a dedicated test environment, dedicated browser profile, dedicated dev DB when applicable, and synthetic data only. |
| Source-of-truth default | Local-first | Confirm default startup uses `localStorage` and no API result silently overwrites AppData or localStorage. |
| Auth/account flow | Not implemented unless future approved | Record `not implemented`; do not attempt login/signup or account linking without a future approved auth task. |
| Sync flow | Not implemented unless future approved | Record `not implemented`; do not perform cloud writes, background sync, or automatic conflict merge. |
| Backup/export/delete/recovery | Policy and runbook only | Confirm backup-first, export/delete responsibility, restore verification, and rollback drill documentation. |
| Deployment | Not implemented unless future approved | Record `not implemented`; do not deploy production. |
| Rollback | Runbook required | Confirm rollback owner, trigger, validation, privacy response, and recovery path are documented. |
| Privacy/security | Safeguards only | Confirm no raw AppData, localStorage dumps, tokens, secrets, or real personal training data are logged or used. |

## Task 6.31 Decision

Task 6.31 result: final production manual acceptance runbook alignment only.

Decision: keep production manual acceptance as a documented, synthetic-data-only gate that records implemented versus not-implemented capabilities without activating production backend, auth, sync, deployment, or source-of-truth migration.

Recommended next task: `Task 6.32 Production Security & Privacy Final Hardening V1`.

Task 6.32 must not add a new auth provider, sync engine, production deployment surface, route, package dependency, package script, lockfile change, production source-of-truth switch, or real-data migration.

## Task 6.31 Final Recommendation

Task 6.31 is complete after this task.

Do not deploy production yet. Next task should be Task 6.32 Production Security & Privacy Final Hardening V1.
