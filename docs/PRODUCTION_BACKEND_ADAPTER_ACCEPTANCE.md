# Production Backend Adapter Acceptance

## Scope / Non-goals

Task 6.11 is acceptance and boundary coverage for the Task 6.10 production backend adapter skeleton.

This is docs/static tests only. This is not production backend runtime activation. This is not an auto-listening server. This is not deployment implementation. This is not auth implementation. This is not database migration implementation. This is not production data usage. This is not browser runtime integration. This is not production source-of-truth migration implementation.

This does not add routes, dependencies, package scripts, lockfile changes, normalized tables, deployment config, or real personal training data.

## Accepted Skeleton Behavior

The accepted skeleton is `apps/api/src/node/productionBackendAdapter.ts`.

It is Node-only, inert by default, dependency-free, and not exported from browser-facing API index files. It exposes typed request/response shapes, the existing seven-route browser mutation allowlist, and safe error envelopes.

Accepted routes return `ok: false`, `status: 503`, and `production_backend_not_activated`. Unapproved routes return `ok: false`, `status: 404`, and `route_not_allowed`.

## Node-only Isolation

The adapter skeleton must stay under `apps/api/src/node`. Browser-facing modules must not import it. Browser builds must remain clean of Node/dev-only tokens.

The skeleton must not import Fastify, Express, Koa, Hono, `node:http`, `node:sqlite`, SQLite repository code, deployment providers, auth providers, or sync providers.

## No Auto-listen

The adapter skeleton must not call `listen`, create a server, bind a port, start background workers, or perform side effects at import time.

Task 6.11 adds no production server entrypoint and no package script.

## No Auth Runtime

The adapter skeleton must not implement login, signup, OAuth, password handling, token/session handling, user tables, account linking, or auth provider integration.

Auth remains planned for later boundary work.

## No Deployment Runtime

The adapter skeleton must not add deployment config, hosted production configuration, environment provisioning, Vercel production dependency, or monitoring runtime.

GitHub Actions `IronPath Validation` remains the required check. Optional Vercel checks remain non-blocking when GitHub allows normal squash merge.

## Safe Error Shape

All skeleton responses must be safe error envelopes. Responses must not include raw AppData, localStorage dumps, tokens, secrets, request body echoes, or personally identifying training data.

The skeleton must not return fake success because no production write is implemented.

## No Production Data

The adapter skeleton must not read, write, migrate, export, delete, or upload production data. Automated tests must use synthetic request shapes only and no real personal training data.

## Route and Source-of-truth Boundary

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

`localStorage` remains default runtime source, fallback, migration source, and emergency backup. `api-primary-dev` remains explicit dev/local only and not production-ready.

## Decision

Task 6.11 result: production backend adapter skeleton acceptance and boundary lock only.

Decision: accept the Task 6.10 skeleton as inert Node-only scaffolding. Do not activate production backend runtime yet.

Recommended next task: `Task 6.12 Auth Boundary & Account Model Plan V1`.

Task 6.12 must be docs/static tests only. Task 6.12 must not implement auth runtime, login/signup, token/session handling, OAuth, user table, production backend activation, routes, package changes, or source-of-truth switching.

## Decision Record

- Date: 2026-05-12
- Branch / commit: `codex/task6.11-production-backend-adapter-acceptance` / pending until merge
- Decision: accept the inert Node-only adapter skeleton and keep production runtime blocked.
- Baseline: `localStorage` remains default runtime source and `api-primary-dev` remains dev/local only.
- Accepted routes: `POST /data-health/issues/:issueId/dismiss`; `POST /history/:id/data-flag`; `POST /history/:id/edit`; `POST /sessions/start`; `POST /sessions/active/patches`; `POST /sessions/active/complete`; `POST /sessions/active/discard`
- Still blocked: auto-listen, production server framework, auth runtime, deployment runtime, database migration, production data use, browser runtime integration, route expansion, source-of-truth switch.
- Required future gates: auth boundary/account model plan, auth adapter skeleton, storage schema strategy, environment config, observability/privacy, and production manual acceptance.
- Next task: `Task 6.12 Auth Boundary & Account Model Plan V1`
- Rollback requirement: because this task adds docs/static tests only, rollback is reverting the Task 6.11 commit.

## Final Recommendation

Task 6.11 is complete after this task.

Do not start auth or production backend activation yet. Next task should be Task 6.12 Auth Boundary & Account Model Plan V1.
