# Phase 6 Preflight Production Boundary Lock

## Scope / Non-goals

Task 6.0 is Phase 6 preflight.

This is not production backend implementation. This is not auth implementation. This is not cloud sync implementation. This is not deployment implementation. This is not monitoring implementation. This is not source-of-truth migration implementation. This is not normalized database schema implementation.

This task does not change App runtime behavior, does not change storage runtime behavior, does not add routes, does not add dependencies or scripts, does not change lockfiles, and does not use real personal training data.

## Phase 5 Final Baseline

Phase 5 completed with `docs/PHASE5_COMPLETION_ARCHIVE.md`.

At Phase 6 preflight:

- `localStorage` remains default runtime source.
- `localStorage` remains fallback, migration source, and emergency backup.
- `api-primary-dev` is explicit dev/local only.
- `api-primary-dev` is not production-ready.
- production backend, auth, sync, deployment, and monitoring remain Phase 6+ work.

Accepted browser mutation routes are exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

## Phase 6 Boundary

Phase 6 is production architecture and safety planning before implementation.

Phase 6 areas are:

- production backend architecture
- auth / user accounts
- cloud sync
- deployment
- monitoring / observability
- privacy / security
- production data migration
- production rollback
- production backup/recovery

None of these are implemented in Task 6.0.

## Production Backend Boundary

Task 6.0 adds:

- no Fastify server.
- no Express server.
- no Koa server.
- no Hono server.
- no production database schema.
- no normalized tables.
- no hosted backend.
- no deployment config.
- no production API exposure.

## Auth / User Account Boundary

Task 6.0 adds:

- no login/signup.
- no user table.
- no password handling.
- no session token handling.
- no OAuth.
- no account linking.
- no user data sync.

## Cloud Sync Boundary

Task 6.0 adds:

- no cloud sync.
- no multi-device sync.
- no conflict merge engine.
- no remote write queue.
- no background sync worker.

## Deployment Boundary

Task 6.0 adds:

- no production deployment.
- no Vercel production dependency for acceptance.
- no "Require deployments to succeed" assumption.

GitHub Actions IronPath Validation remains the required check. Vercel preview/deployment may remain optional.

## CI / Ruleset Boundary

Required PR check is GitHub Actions `IronPath Validation`.

Codex should use:

`gh pr checks <PR_NUMBER> --required --watch`

Optional Vercel checks must not block merge if GitHub allows normal squash merge.

Never use `--admin`. Never bypass branch protection. IronPath Validation failure blocks merge.

## Real Data Safety Boundary

Task 6.0 and future automated tasks require:

- no real personal training data in automated tasks.
- dedicated test browser profile.
- dedicated dev DB.
- backup-first for any future real migration.
- no destructive migration without explicit separate approval.
- no automatic deletion of localStorage.
- no silent production data overwrite.

## Source-of-truth Boundary

At Phase 6 preflight:

- `localStorage` remains default runtime source.
- `api-primary-dev` remains explicit dev/local only.
- production source-of-truth switch is not approved.
- API/SQLite production primary is not approved.
- localStorage fallback/emergency backup remains required.
- source-of-truth migration requires a future architecture gate.

## Route Boundary

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

Blocked routes and capabilities remain:

- `POST /data-health/repair/apply`
- backup/import/export over HTTP
- reset/recovery over HTTP
- eighth browser mutation route
- production-only routes
- auth/sync/cloud routes

## Phase 6 Risk Register

| Risk | Severity | Mitigation | Required future gate |
| --- | --- | --- | --- |
| production data loss | High | Keep production migration blocked until backup/export/delete/rollback policy is approved. | Production migration architecture gate. |
| auth leakage | High | Keep auth unimplemented until identity, token, and access-control design is approved. | Auth architecture gate. |
| user identity mismatch | High | Define account linking and local-to-account migration before user accounts. | User account lifecycle gate. |
| sync conflict corruption | High | Define conflict model and offline ordering before cloud sync. | Cloud sync conflict gate. |
| cloud write duplication | High | Define idempotency and device ordering before remote writes. | Cloud write idempotency gate. |
| migration rollback failure | High | Require backup-first, rollback drills, and restore verification. | Migration rollback gate. |
| localStorage/API divergence | High | Keep localStorage fallback and explicit source selection until migration is approved. | Source-of-truth architecture gate. |
| deployment misconfiguration | High | Define environments, secrets, rollout, and rollback before deployment. | Deployment architecture gate. |
| secret leakage | High | Define secret storage, rotation, and access controls before production. | Security architecture gate. |
| privacy exposure | High | Classify personal training data and define retention/export/delete policy. | Privacy review gate. |
| monitoring/logging sensitive data leakage | High | Define privacy-safe logging and redaction before monitoring. | Observability privacy gate. |
| branch protection bypass risk | High | Require IronPath Validation and normal squash merge only. | CI/ruleset gate. |

## Required Gates Before Task 6.1

Before Task 6.1:

- Phase 6 preflight complete.
- Phase 5 completion archive present.
- CI/ruleset policy documented.
- production non-goals documented.
- real data safety documented.
- auth/sync/deployment boundaries documented.
- source-of-truth boundary documented.
- no runtime change in Task 6.0.
- no new dependency/script/lockfile in Task 6.0.
- browser build isolation remains clean.

## Decision

Task 6.0 result: preflight and production boundary lock only.

Recommended next task: `Task 6.1 Production Backend, Auth, Sync & Deployment Architecture Gate V1`.

Task 6.1 must be architecture gate only. Task 6.1 must not implement production backend/auth/sync/deployment.

## Decision Record

- Date: 2026-05-12
- Branch / commit: `codex/task6.0-phase6-preflight-production-boundary-lock` / pending until merge
- Decision: lock Phase 6 preflight boundaries before any Phase 6 architecture or implementation work.
- Phase 5 baseline: Phase 5 complete; `localStorage` default/fallback/migration/emergency backup; `api-primary-dev` explicit dev/local only and not production-ready.
- Accepted routes: `POST /data-health/issues/:issueId/dismiss`; `POST /history/:id/data-flag`; `POST /history/:id/edit`; `POST /sessions/start`; `POST /sessions/active/patches`; `POST /sessions/active/complete`; `POST /sessions/active/discard`
- Blocked routes: `POST /data-health/repair/apply`; backup/import/export over HTTP; reset/recovery over HTTP; eighth browser mutation route; production-only routes; auth/sync/cloud routes.
- Phase 6 non-goals: production backend, auth, user accounts, cloud sync, deployment, monitoring, source-of-truth migration, normalized tables, production data migration.
- Recommended next task: `Task 6.1 Production Backend, Auth, Sync & Deployment Architecture Gate V1`
- Rollback requirement: because this preflight adds docs/static tests only, rollback is reverting the preflight commit.

## Final Recommendation

Phase 6 preflight is complete after this task.

Do not start production implementation yet. Next task should be Task 6.1 architecture gate only. Do not auto-start Task 6.1.

## Task 6.1 Follow-up

Task 6.1 Production Backend, Auth, Sync & Deployment Architecture Gate V1 adds a Phase 6 architecture gate and decision record after this preflight.

Task 6.1 remains architecture gate only. It does not implement production backend, auth, user accounts, cloud sync, deployment, monitoring, production source-of-truth migration, normalized tables, package changes, or browser routes.

The Task 6.1 follow-up keeps `localStorage` as default runtime source, fallback, migration source, and emergency backup. `api-primary-dev` remains explicit dev/local only and not production-ready.

The next recommended task after Task 6.1 is Task 6.2 Production Data Ownership, Privacy & Security Matrix V1, docs/static tests only. Task 6.2 must not auto-start.
