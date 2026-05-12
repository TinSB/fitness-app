# Phase 6 Final Manual Acceptance

## Scope / Non-goals

Task 6.38 is the final manual acceptance runbook for Phase 6.

This is docs/static tests only. This is not production runtime implementation. This is not auth runtime implementation. This is not sync runtime implementation. This is not deployment runtime implementation. This is not monitoring runtime implementation. This is not production source-of-truth migration implementation.

This task adds no dependencies, package scripts, lockfile changes, routes, secret values, production data migration, normalized tables, or real personal training data.

## Phase 6 Baseline

Tasks 6.0 through 6.37 are complete. The release candidate regression lock is documented. Production runtime activation remains unimplemented unless a future approved task explicitly adds it.

`localStorage` remains default runtime source, fallback, migration source, and emergency backup. `api-primary-dev` remains explicit dev/local only and not production-ready.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

## Production Readiness Scenario Matrix

| Scenario | Expected Phase 6 status | Manual acceptance action |
| --- | --- | --- |
| Local/dev fallback | Required | Confirm localStorage default, fallback, migration source, and emergency backup remain available. |
| Production backend | Not activated unless future approved | Record current status and do not expose hosted production API. |
| Auth/account | Not implemented unless future approved | Record `not implemented`; do not attempt login/signup or account linking. |
| Sync | Not implemented unless future approved | Record `not implemented`; do not perform cloud writes or background sync. |
| Backup/export/delete/recovery | Policy/runbook accepted | Confirm backup-first, export/delete policy, restore verification, and no destructive real-data automation. |
| Deployment | Not implemented unless future approved | Record `not implemented`; do not deploy production. |
| Monitoring/logging | Privacy lock accepted | Confirm no raw AppData logging, localStorage dumps, token/secret logs, or real personal data logging. |
| Rollback | Runbooks accepted | Confirm rollback owner, trigger, validation, incident path, and recovery path are documented. |

## Source-of-truth Checks

- Confirm default runtime source is localStorage.
- Confirm `api-primary-dev` remains explicit dev/local only and not production-ready.
- Confirm API/SQLite production primary remains unapproved.
- Confirm API results do not silently overwrite AppData or localStorage.
- Confirm localStorage remains fallback, migration source, and emergency backup.

## Auth / Account If Implemented

If auth/account runtime is not implemented, record `not implemented` and do not attempt auth flows.

If a future approved task implements auth/account runtime, verify account creation, login, logout, account linking, account deletion, export/delete responsibility, identity mismatch handling, and visible failure behavior in a dedicated test environment.

## Sync If Implemented

If sync runtime is not implemented, record `not implemented` and do not attempt cloud writes.

If a future approved task implements sync runtime, verify device identity, account identity, idempotency, duplicate cloud write prevention, conflict detection, offline behavior, rollback, and user-visible conflict resolution.

## Backup / Export / Delete / Recovery

Confirm backup-first policy, export policy, delete policy, account deletion implications if accounts exist, restore verification, rollback drill, no destructive automated real-data operation, and no silent overwrite.

No backup/import/export/reset/recovery HTTP route is added by Task 6.38.

## Deployment If Implemented

If production deployment is not implemented, record `not implemented` and do not deploy production.

If a future approved task implements deployment, verify environment separation, secret references, required checks, rollback, preview vs production distinction, release artifact identity, and incident handling.

## Rollback

Confirm rollback owner, rollback trigger, source snapshot or backup identity, localStorage fallback state, validation checklist, privacy response, and post-rollback acceptance.

Task 6.38 performs no rollback runtime operation.

## Pass / Fail Template

- Environment:
- Browser profile:
- Dev DB:
- Synthetic data fixture:
- Source-of-truth result:
- Backend result:
- Auth/account result:
- Sync result:
- Backup/export/delete/recovery result:
- Deployment result:
- Monitoring/logging result:
- Rollback result:
- Privacy/security result:
- Final result: Pass / Fail
- Blockers:

## Route and CI Boundary

No new browser mutation route is added. DataHealth repair remains blocked. Backup/import/export over HTTP remains blocked. Reset/recovery over HTTP remains blocked. Auth/sync/cloud routes remain blocked unless a future approved task explicitly adds them.

Required PR check remains GitHub Actions `IronPath Validation`; Codex must use `gh pr checks <PR_NUMBER> --required --watch`.

## Decision

Task 6.38 result: Phase 6 final manual acceptance documentation and static tests only.

Decision: final manual acceptance remains a synthetic-data-only runbook that records implemented versus not-implemented capabilities without activating production backend, auth, sync, deployment, monitoring, or source-of-truth migration.

Recommended next task: `Task 6.39 Phase 6 Exit Regression Lock V1`.

Task 6.39 must be docs/static tests only. It must not add production runtime, auth runtime, sync runtime, deployment runtime, package changes, routes, source-of-truth switching, real-data migration, or Phase 7 work.

## Final Recommendation

Task 6.38 is complete after this task.

Do not start Phase 7. Next task should be Task 6.39 Phase 6 Exit Regression Lock V1.
