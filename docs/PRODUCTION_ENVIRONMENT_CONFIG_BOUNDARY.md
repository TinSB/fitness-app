# Production Environment Config Boundary

## Scope / Non-goals

Task 6.21 defines the production, staging, local, and development environment configuration boundary.

This is docs/static tests only. This is not deployment implementation. This is not production runtime implementation. This is not secret provisioning. This is not auth provider configuration. This is not sync provider configuration. This is not source-of-truth migration implementation.

This task adds no dependencies, package scripts, lockfile changes, App runtime behavior, storage runtime behavior, routes, deployment config, secret values, or real personal training data.

## Phase 6 Baseline

Task 6.0 through Task 6.20 are complete. Production backend activation, auth runtime, cloud sync runtime, deployment runtime, production source-of-truth migration, and normalized schema remain unimplemented unless a prior narrow skeleton explicitly says otherwise.

`localStorage` remains default runtime source, fallback, migration source, and emergency backup. `api-primary-dev` remains explicit dev/local only and not production-ready.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

## Environment Names

Approved names for future planning are:

- `local`: browser localStorage default, synthetic/dev data only.
- `development`: local dev API and dev DB surfaces only when explicitly opted in.
- `staging`: future production-like test environment, not implemented in Task 6.21.
- `production`: future user-facing environment, not implemented in Task 6.21.

No environment is enabled by default in Task 6.21 beyond existing local behavior.

## Secrets Separation

Future secrets must be separated by environment and never committed to source control.

Task 6.21 documents placeholder names only. It adds no secret values, no `.env` files, no hosted secret configuration, no auth provider secret, no sync provider secret, and no deployment token.

## Runtime Enablement Boundary

Production runtime must not become active by default. Any future production mode requires explicit architecture approval, environment validation, secrets validation, branch protection, rollback plan, and manual acceptance.

Task 6.21 does not enable production backend, auth, sync, deployment, monitoring, API primary source of truth, or normalized schema.

## Required Checks Boundary

GitHub Actions `IronPath Validation` remains the required PR check for Codex PRs.

Codex must use `gh pr checks <PR_NUMBER> --required --watch`.

Optional Vercel checks must not block merge if GitHub allows normal squash merge. Never use `--admin`. Never bypass branch protection. IronPath Validation failure blocks merge.

## Route and Source-of-truth Boundary

No browser mutation route is added. No production-only route is added. No auth/sync/cloud route is added.

`localStorage` remains the default runtime source. API/SQLite production primary remains unapproved. Environment configuration must not silently overwrite AppData or localStorage.

## Decision

Task 6.21 result: production environment config boundary only.

Decision: document environment names, secrets separation, no secret values, no production deploy, and no runtime production enable by default.

Recommended next task: `Task 6.22 Deployment Runtime Strategy & Staging Plan V1`.

Task 6.22 must be docs/static tests only. It must not implement production deployment, hosted production runtime, secret provisioning, routes, dependencies, or source-of-truth switching.

## Decision Record

- Date: 2026-05-12
- Branch / commit: `codex/task6.21-production-environment-config-boundary` / pending until merge
- Decision: lock environment configuration boundaries before deployment strategy planning.
- Baseline: `localStorage` remains default runtime source and `api-primary-dev` remains dev/local only.
- Accepted routes: `POST /data-health/issues/:issueId/dismiss`; `POST /history/:id/data-flag`; `POST /history/:id/edit`; `POST /sessions/start`; `POST /sessions/active/patches`; `POST /sessions/active/complete`; `POST /sessions/active/discard`
- Still blocked: production deploy, production runtime default, secret values, auth provider configuration, sync provider configuration, source-of-truth switch.
- Required future gates: deployment runtime strategy, secrets validation skeleton, production deployment final audit, manual acceptance, and rollback runbook.
- Next task: `Task 6.22 Deployment Runtime Strategy & Staging Plan V1`
- Rollback requirement: revert the Task 6.21 commit; no runtime configuration or secret state is involved.

## Final Recommendation

Task 6.21 is complete after this task.

Do not enable production runtime yet. Next task should be Task 6.22 Deployment Runtime Strategy & Staging Plan V1.
