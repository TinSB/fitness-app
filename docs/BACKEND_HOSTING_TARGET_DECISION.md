# Backend Hosting Target Decision V1

Task 13.4 makes the backend hosting target decision without deploying anything.

## Decision

- Frontend: Vercel/static web app candidate.
- Backend: separate production API service candidate.
- Cloud DB: Supabase Postgres candidate.
- `api-primary-dev` and `devApiRunner`: not production backend.
- `node:sqlite` snapshot repository: not cloud production DB.
- Vercel preview: not production backend readiness.

## Options Compared

- Vercel serverless/API route option: deferred because it would require hosting/runtime configuration and explicit route boundaries later.
- Railway/Render/Fly.io-style Node service: compatible with a separate production API service candidate.
- Self-hosted Node API: possible later, but higher operational burden.
- Managed backend platform: possible later, but must preserve adapter and source-of-truth boundaries.

## Recommendation

The backend should remain a separate production API service candidate. This keeps frontend static delivery separate from future backend runtime, protects rollback and environment separation, and avoids promoting dev-only API tooling.

## Rejections

- Do not deploy `devApiRunner` as production backend.
- Do not promote `api-primary-dev` to production.
- Do not use `node:sqlite` snapshot repository as production multi-user DB.
- Do not treat Vercel preview as production backend readiness.
- Do not add hosting config, Docker, Vercel functions, deployment scripts, or dependencies.

Recommended next task: Task 13.5 Production Runtime Deployment Config Guard V1.
