# Production Deployment Environment Final Audit

## Scope / Non-goals

Task 6.35 is the final Phase 6 audit for deployment and environment readiness.

This is docs/static tests only. This is not production deployment implementation. This is not deployment config implementation that changes production behavior. This is not hosted backend implementation. This is not auth runtime implementation. This is not sync runtime implementation. This is not monitoring runtime implementation. This is not production source-of-truth migration implementation.

This task adds no dependencies, package scripts, lockfile changes, routes, secret values, deployment provider, production data migration, normalized tables, or real personal training data.

## Phase 6 Baseline

Tasks 6.0 through 6.34 are complete. Deployment/environment/secrets strategy, production environment config boundary, deployment runtime strategy/staging plan, environment validation skeleton, and release readiness checkpoint are documented.

Production deployment remains unimplemented unless a future approved task explicitly adds it.

`localStorage` remains default runtime source, fallback, migration source, and emergency backup. `api-primary-dev` remains explicit dev/local only and not production-ready.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

## Environments

Environment names remain planning boundaries: local, development, staging, and production.

Task 6.35 does not enable production runtime by default, does not deploy production, and does not bind production secrets.

## Secrets

Secret values must not be committed, logged, added to fixtures, exposed to browser validation, or copied into manual evidence.

Future deployment work must define secret ownership, storage, rotation, least privilege, incident response, and rollback before any production release.

## Branch Rules and Required Checks

Required PR check remains GitHub Actions `IronPath Validation`.

Codex must use `gh pr checks <PR_NUMBER> --required --watch`.

Optional Vercel checks must not block merge if GitHub allows normal squash merge. Never use `--admin`. Never bypass branch protection. IronPath Validation failure blocks merge.

## Rollback

Future deployment rollback must define release identity, rollback owner, rollback trigger, environment target, data safety impact, validation steps, and communication path.

Task 6.35 performs no deployment rollback runtime operation.

## Preview vs Production Distinction

Preview deployments, if present, are optional for Codex PR merge safety. Production deployment is not implied by preview success.

Do not assume "Require deployments to succeed" for Codex PR acceptance unless repository rules explicitly make that a required check.

## No Deployment If Not Implemented

If production deployment is not implemented, manual acceptance must record `not implemented` and must not deploy production.

Task 6.35 adds no deployment runtime, no production environment activation, no hosted backend, and no production API exposure.

## Route and Source-of-truth Boundary

No new browser mutation route is added. DataHealth repair remains blocked. Backup/import/export over HTTP remains blocked. Reset/recovery over HTTP remains blocked. Auth/sync/cloud routes remain blocked unless a future approved task explicitly adds them.

Production source-of-truth switching is not approved. API/SQLite production primary is not approved.

## Decision

Task 6.35 result: production deployment/environment final audit documentation and static tests only.

Decision: keep deployment and environment work at audit/runbook level, keep production deployment unimplemented, keep Vercel optional for Codex PRs unless it becomes a required check, and keep IronPath Validation as the required merge gate.

Recommended next task: `Task 6.36 Production Monitoring & Logging Privacy Lock V1`.

Task 6.36 must be docs/static tests only. It must not add external monitoring service, production telemetry runtime, package changes, routes, source-of-truth switching, or real-data logging.

## Decision Record

- Date: 2026-05-12
- Branch / commit: `codex/task6.35-production-deployment-environment-final-audit` / pending until merge
- Decision: audit deployment/environment readiness without production deployment.
- Baseline: `localStorage` remains default runtime source and `api-primary-dev` remains dev/local only.
- Accepted routes: `POST /data-health/issues/:issueId/dismiss`; `POST /history/:id/data-flag`; `POST /history/:id/edit`; `POST /sessions/start`; `POST /sessions/active/patches`; `POST /sessions/active/complete`; `POST /sessions/active/discard`
- Still blocked: production deployment, hosted backend activation, production secrets, deployment-required source switch, route additions, real-data migration.
- Required future gates: monitoring/logging privacy lock, release candidate regression lock, Phase 6 exit lock.
- Next task: `Task 6.36 Production Monitoring & Logging Privacy Lock V1`
- Rollback requirement: revert the Task 6.35 commit; no runtime state is involved.

## Final Recommendation

Task 6.35 is complete after this task.

Do not deploy production yet. Next task should be Task 6.36 Production Monitoring & Logging Privacy Lock V1.
