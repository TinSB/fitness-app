# Deployment Runtime Strategy Staging Plan

## Scope / Non-goals

Task 6.22 defines deployment runtime strategy and staging planning before any production deployment.

This is docs/static tests only. This is not production deployment implementation. This is not hosted production runtime implementation. This is not deployment config implementation. This is not secret provisioning. This is not auth provider configuration. This is not sync provider configuration. This is not source-of-truth migration implementation.

This task adds no dependencies, package scripts, lockfile changes, App runtime behavior, storage runtime behavior, routes, deployment config, secret values, or real personal training data.

## Phase 6 Baseline

Task 6.0 through Task 6.21 are complete. The Task 6.21 environment boundary defines `local`, `development`, `staging`, and `production` names without enabling production runtime.

`localStorage` remains default runtime source, fallback, migration source, and emergency backup. `api-primary-dev` remains explicit dev/local only and not production-ready.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

## Staging vs Production

Future staging must be production-like but isolated from real user data unless a future explicit approval defines controlled handling.

Future production must require architecture approval, secrets validation, data ownership review, privacy/security review, rollback plan, manual acceptance, and branch protection.

Task 6.22 does not create staging, production, preview, or hosted runtime.

## Preview Deployments

Preview deployments may remain optional for Codex PRs. They are not the required merge gate for this repository.

GitHub Actions `IronPath Validation` remains the required PR check for Codex PRs. Codex must use `gh pr checks <PR_NUMBER> --required --watch`.

Optional Vercel checks must not block merge if GitHub allows normal squash merge.

## Rollback Strategy

Future deployment rollback must define rollback trigger, responsible owner, artifact/version identity, database/source-of-truth safety, localStorage emergency fallback, communication path, and validation checklist.

Task 6.22 implements no rollback runtime and no deployment promotion.

## Deployment Boundaries

No production deployment is implemented. No hosted production runtime is implemented. No Vercel production dependency is required for acceptance. No deployment config is added. No secret values are added. No production source-of-truth switch is approved.

## Route and Source-of-truth Boundary

No browser mutation route is added. No production-only route is added. No auth/sync/cloud route is added.

`localStorage` remains the default runtime source. API/SQLite production primary remains unapproved. Deployment planning must not silently overwrite AppData or localStorage.

## Decision

Task 6.22 result: deployment runtime strategy and staging plan only.

Decision: keep deployment at planning level, keep preview checks optional for Codex PRs, and keep IronPath Validation as the required check.

Recommended next task: `Task 6.23 Secrets & Environment Validation Skeleton V1`.

Task 6.23 may add a safe environment validation skeleton only if no dependency is needed. It must not add secret values, production deployment, auth provider, sync provider, package changes, routes, or source-of-truth switching.

## Decision Record

- Date: 2026-05-12
- Branch / commit: `codex/task6.22-deployment-runtime-strategy-staging-plan` / pending until merge
- Decision: document staging/deployment strategy without implementation.
- Baseline: `localStorage` remains default runtime source and `api-primary-dev` remains dev/local only.
- Accepted routes: `POST /data-health/issues/:issueId/dismiss`; `POST /history/:id/data-flag`; `POST /history/:id/edit`; `POST /sessions/start`; `POST /sessions/active/patches`; `POST /sessions/active/complete`; `POST /sessions/active/discard`
- Still blocked: production deploy, hosted production runtime, deployment config, secret values, production source-of-truth switch.
- Required future gates: secrets/environment validation skeleton, deployment final audit, release readiness checkpoint, manual acceptance, and rollback runbook.
- Next task: `Task 6.23 Secrets & Environment Validation Skeleton V1`
- Rollback requirement: revert the Task 6.22 commit; no deployment state is involved.

## Final Recommendation

Task 6.22 is complete after this task.

Do not deploy production yet. Next task should be Task 6.23 Secrets & Environment Validation Skeleton V1.

## Task 6.23 Follow-up

Task 6.23 Secrets & Environment Validation Skeleton V1 follows this deployment strategy with a safe environment validation skeleton.

Task 6.23 may add `src/config/environmentValidation.ts` and tests only. It must not add secret values, production deployment, auth provider, sync provider, package changes, routes, or source-of-truth switching.

The next recommended task after Task 6.23 is `Task 6.24 Observability / Logging Privacy Skeleton V1`, privacy-safe redaction utility only if safe.
