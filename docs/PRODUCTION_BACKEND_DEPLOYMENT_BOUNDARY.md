# Production Backend Deployment Boundary

## Task Identity

Task 8.11 Production Backend Deployment Boundary V1 defines deployment boundaries for future production backend and frontend separation.

This task is docs/static tests only. It does not deploy anything.

## Deployment Boundary

Vercel frontend deployment does not equal backend production readiness.

`api-primary-dev` and devApiRunner must not be deployed as production backend.

Preferred future direction:

- frontend may remain a Vercel/static web app
- production backend should be a separate production service unless separately authorized otherwise
- backend deployment needs its own security, environment, rollback, monitoring, and failure model

## Environment Rules

Preview and production environments must remain distinct.

Production environment variables must not silently enable production runtime.

Secret values must not be committed, logged, or placed in browser bundles.

Localhost and dev API base URLs are not production backend URLs.

## CI And Vercel Rules

GitHub Actions `IronPath Validation` remains the required check for Codex PR merge safety.

Codex must use `gh pr checks <PR_NUMBER> --required --watch`.

Optional Vercel preview checks do not block merge if GitHub allows normal squash merge.

Never use `--admin`.

Never bypass branch protection.

## Explicit Non-Implementation

Task 8.11 implements:

- no production deployment
- no Vercel serverless backend
- no backend hosting provider is selected or configured
- no backend hosting provider selection
- no backend hosting provider configuration
- no monitoring runtime
- no production source-of-truth switch
- no deployment config
- no CI script
- no package script
- no dependency
- no lockfile change

## Preserved Boundaries

`localStorage` remains default runtime source, fallback, migration source, and emergency backup.

`api-primary-dev` remains explicit dev/local only and not production-ready.

Accepted browser mutation routes remain exactly seven. No eighth browser mutation route is authorized.

## Decision

Task 8.11 result: production backend deployment boundary documentation and static tests only.

Recommended next task: Task 8.12 Production Runtime Manual Acceptance V1.

Task 8.12 may begin only after Task 8.11 is fully merged.
