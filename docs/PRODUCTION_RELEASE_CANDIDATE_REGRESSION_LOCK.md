# Production Release Candidate Regression Lock

## Scope / Non-goals

Task 6.37 regression-locks the Phase 6 production release candidate state.

This is docs/static tests only. This is not production runtime implementation. This is not auth runtime implementation. This is not sync runtime implementation. This is not deployment runtime implementation. This is not monitoring runtime implementation. This is not production source-of-truth migration implementation.

This task adds no dependencies, package scripts, lockfile changes, browser routes, server routes, secret values, production data migration, normalized tables, or real personal training data.

## Phase 6 Baseline

Tasks 6.0 through 6.36 are complete. Phase 6 accepted architecture gates, safety matrices, narrow pure/skeleton utilities, manual runbooks, readiness checkpoints, and final audits.

`localStorage` remains default runtime source, fallback, migration source, and emergency backup. `api-primary-dev` remains explicit dev/local only and not production-ready.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

## Accepted Production Capabilities

- Production architecture and safety planning documentation.
- Production data ownership, privacy, and security matrix.
- Node-only production backend adapter skeleton with no auto-listen and no browser export.
- Auth provider adapter types and pure boundary only.
- Production storage migration dry-run only with no write.
- Pure local sync metadata/conflict detector only.
- Environment validation skeleton with no secret values.
- Privacy-safe redaction utility with no external logging service.
- Manual acceptance, rollback, export/delete, security/privacy, deployment/environment, sync/conflict, and monitoring/logging runbooks/audits.

## Blocked Capabilities

- Production backend activation.
- Auth runtime, login/signup, token/session handling, OAuth, and user table.
- Cloud sync runtime, network writes, background sync workers, and remote write queues.
- Production deployment and hosted backend exposure.
- Production monitoring/telemetry runtime.
- Production source-of-truth switch.
- Normalized production schema migration.
- Destructive real-data migration.
- Backup/import/export over HTTP.
- Reset/recovery over HTTP.
- `POST /data-health/repair/apply`.
- Any unapproved browser mutation route.

## Source-of-truth Rules

localStorage remains the default runtime source, fallback, migration source, and emergency backup.

API/SQLite production primary remains unapproved. `api-primary-dev` remains explicit dev/local only and not production-ready. API results must not silently overwrite AppData or localStorage.

## Auth / Sync / Deployment Status

Auth runtime is not implemented. Sync runtime is not implemented. Production deployment is not implemented. Production monitoring runtime is not implemented.

The accepted artifacts in these areas are plans, boundaries, runbooks, audits, or narrow inert/pure skeletons only.

## Migration / Rollback Status

Production storage migration remains dry-run only. Backup-first, restore verification, rollback drills, and incident handling are documented. No destructive real-data migration is approved.

## CI / Ruleset Status

Required PR check remains GitHub Actions `IronPath Validation`.

Codex must use `gh pr checks <PR_NUMBER> --required --watch`.

Optional Vercel checks must not block merge if GitHub allows normal squash merge. Never use `--admin`. Never bypass branch protection. IronPath Validation failure blocks merge.

## Browser Build Isolation

Browser build must remain clean of Node-only and dev API tokens: `node:http`, `node:sqlite`, `devLauncher`, `httpRuntimeAdapter`, `serverAdapter`, `sqliteRepository`, `devApiRunner`, and `devDbRecovery`.

## No Unapproved Routes

No new browser mutation route is added. DataHealth repair remains blocked. Backup/import/export over HTTP remains blocked. Reset/recovery over HTTP remains blocked. Auth/sync/cloud routes remain blocked unless a future approved task explicitly adds them.

## Coverage Inventory

- Production backend adapter skeleton: `docs/PRODUCTION_BACKEND_ADAPTER_ACCEPTANCE.md`
- Auth/account lifecycle: `docs/AUTH_ACCOUNT_LIFECYCLE_ACCEPTANCE.md`
- Storage migration dry-run: `docs/PRODUCTION_STORAGE_MIGRATION_DRY_RUN.md`
- Backup/restore and export/delete: `docs/PRODUCTION_BACKUP_EXPORT_DELETE_RECOVERY_ACCEPTANCE.md`
- Sync/conflict: `docs/PRODUCTION_SYNC_CONFLICT_FINAL_AUDIT.md`
- Deployment/environment: `docs/PRODUCTION_DEPLOYMENT_ENVIRONMENT_FINAL_AUDIT.md`
- Monitoring/logging privacy: `docs/PRODUCTION_MONITORING_LOGGING_PRIVACY_LOCK.md`
- Manual acceptance: `docs/PRODUCTION_MANUAL_ACCEPTANCE_RUNBOOK.md`
- Rollback/incident: `docs/PRODUCTION_ROLLBACK_INCIDENT_RUNBOOK.md`

## Decision

Task 6.37 result: production release candidate regression lock documentation and static tests only.

Decision: lock the release candidate state as planned/skeleton-only production readiness work with no production runtime activation, no source-of-truth switch, and no unapproved routes.

Recommended next task: `Task 6.38 Phase 6 Final Manual Acceptance V1`.

Task 6.38 must be docs/static tests only. It must not add production runtime, auth runtime, sync runtime, deployment runtime, package changes, routes, source-of-truth switching, or real-data migration.

## Decision Record

- Date: 2026-05-12
- Branch / commit: `codex/task6.37-production-release-candidate-regression-lock` / pending until merge
- Decision: lock release candidate regression state without implementation.
- Baseline: `localStorage` remains default runtime source and `api-primary-dev` remains dev/local only.
- Accepted routes: `POST /data-health/issues/:issueId/dismiss`; `POST /history/:id/data-flag`; `POST /history/:id/edit`; `POST /sessions/start`; `POST /sessions/active/patches`; `POST /sessions/active/complete`; `POST /sessions/active/discard`
- Still blocked: production backend activation, auth runtime, sync runtime, production deployment, monitoring runtime, route additions, source-of-truth switch, destructive real-data migration.
- Required future gates: Phase 6 final manual acceptance, Phase 6 exit regression lock, Phase 6 completion archive.
- Next task: `Task 6.38 Phase 6 Final Manual Acceptance V1`
- Rollback requirement: revert the Task 6.37 commit; no runtime state is involved.

## Final Recommendation

Task 6.37 is complete after this task.

Do not start production runtime work. Next task should be Task 6.38 Phase 6 Final Manual Acceptance V1.
