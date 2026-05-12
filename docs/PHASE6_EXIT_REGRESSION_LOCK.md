# Phase 6 Exit Regression Lock

## Scope / Non-goals

Task 6.39 regression-locks the final Phase 6 exit state before the completion archive.

This is docs/static tests only. This is not Phase 7 work. This is not production runtime implementation. This is not auth runtime implementation. This is not sync runtime implementation. This is not deployment runtime implementation. This is not monitoring runtime implementation. This is not production source-of-truth migration implementation.

This task adds no dependencies, package scripts, lockfile changes, browser routes, server routes, secret values, production data migration, normalized tables, or real personal training data.

## Phase 6 Baseline

Tasks 6.0 through 6.38 are complete. Phase 6 final manual acceptance is documented. Phase 6 completion archive is the next and final task in this chain.

`localStorage` remains default runtime source, fallback, migration source, and emergency backup. `api-primary-dev` remains explicit dev/local only and not production-ready.

## Final Accepted Capabilities

- Production architecture gates and decision records.
- Production data ownership, privacy, and security matrix.
- Node-only production backend adapter skeleton with no auto-listen and no browser export.
- Auth provider adapter types and pure boundary only.
- Production storage migration dry-run only with no write.
- Pure local sync metadata/conflict detector only.
- Environment validation skeleton with no secret values.
- Privacy-safe redaction utility with no external logging service.
- Manual acceptance, rollback/incident, export/delete, security/privacy, deployment/environment, sync/conflict, monitoring/logging, release readiness, and release candidate locks.

## Final Blocked Capabilities

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
- Phase 7 auto-start.

## Final Source-of-truth Status

localStorage remains the default runtime source, fallback, migration source, and emergency backup.

API/SQLite production primary remains unapproved. `api-primary-dev` remains explicit dev/local only and not production-ready. API results must not silently overwrite AppData or localStorage.

## Final Auth / Sync / Deployment Status

Auth runtime is not implemented. Sync runtime is not implemented. Production deployment is not implemented. Production monitoring runtime is not implemented.

The accepted artifacts in these areas remain plans, boundaries, runbooks, audits, or narrow inert/pure skeletons only.

## Final Migration / Rollback Status

Production storage migration remains dry-run only. Backup-first, restore verification, rollback drills, incident response, export/delete policy, and recovery acceptance are documented. No destructive real-data migration is approved.

## Final Route Allowlist

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

No additional browser mutation route is accepted.

## Final CI / Ruleset Policy

Required PR check remains GitHub Actions `IronPath Validation`.

Codex must use `gh pr checks <PR_NUMBER> --required --watch`.

Optional Vercel checks must not block merge if GitHub allows normal squash merge. Never use `--admin`. Never bypass branch protection. IronPath Validation failure blocks merge.

## Browser Build Isolation

Browser build must remain clean of Node-only and dev API tokens: `node:http`, `node:sqlite`, `devLauncher`, `httpRuntimeAdapter`, `serverAdapter`, `sqliteRepository`, `devApiRunner`, and `devDbRecovery`.

## No Phase 7 Auto-start

Task 6.39 does not start Phase 7. Task 6.40 is the only remaining approved Phase 6 task. After Task 6.40, stop and report the recommended next task only.

## Coverage Inventory

- Phase 6 preflight: `docs/PHASE6_PREFLIGHT_PRODUCTION_BOUNDARY_LOCK.md`
- Production architecture: `docs/PRODUCTION_BACKEND_AUTH_SYNC_DEPLOYMENT_ARCHITECTURE_GATE.md`
- Data ownership/privacy/security: `docs/PRODUCTION_DATA_OWNERSHIP_PRIVACY_SECURITY_MATRIX.md`
- Release readiness: `docs/PRODUCTION_RELEASE_READINESS_CHECKPOINT.md`
- Release candidate: `docs/PRODUCTION_RELEASE_CANDIDATE_REGRESSION_LOCK.md`
- Final manual acceptance: `docs/PHASE6_FINAL_MANUAL_ACCEPTANCE.md`

## Decision

Task 6.39 result: Phase 6 exit regression lock documentation and static tests only.

Decision: lock Phase 6 exit state before the completion archive, keep production runtime activation and Phase 7 work blocked, and keep Task 6.40 as the only next task.

Recommended next task: `Task 6.40 Phase 6 Completion Archive V1`.

Task 6.40 must be docs/static tests only. It must not start Phase 7, Task 6.41, production runtime implementation, auth runtime, sync runtime, deployment runtime, source-of-truth switching, routes, package changes, or real-data migration.

## Decision Record

- Date: 2026-05-12
- Branch / commit: `codex/task6.39-phase6-exit-regression-lock` / pending until merge
- Decision: lock Phase 6 exit state without Phase 7 work.
- Baseline: `localStorage` remains default runtime source and `api-primary-dev` remains dev/local only.
- Accepted routes: `POST /data-health/issues/:issueId/dismiss`; `POST /history/:id/data-flag`; `POST /history/:id/edit`; `POST /sessions/start`; `POST /sessions/active/patches`; `POST /sessions/active/complete`; `POST /sessions/active/discard`
- Still blocked: production backend activation, auth runtime, sync runtime, production deployment, monitoring runtime, route additions, source-of-truth switch, destructive real-data migration, Phase 7 auto-start.
- Required future gate: Phase 6 completion archive.
- Next task: `Task 6.40 Phase 6 Completion Archive V1`
- Rollback requirement: revert the Task 6.39 commit; no runtime state is involved.

## Final Recommendation

Task 6.39 is complete after this task.

Do not start Phase 7. Next task should be Task 6.40 Phase 6 Completion Archive V1.
