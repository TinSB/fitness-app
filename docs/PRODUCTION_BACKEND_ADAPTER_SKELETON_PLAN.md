# Production Backend Adapter Skeleton Plan

## Scope / Non-goals

Task 6.9 is a production backend adapter skeleton plan before any skeleton implementation.

This is docs/static tests only. This is not production backend runtime implementation. This is not a Fastify/Express/Koa/Hono server implementation. This is not an auto-listening server. This is not hosted deployment. This is not auth implementation. This is not database migration implementation. This is not production runtime activation. This is not production source-of-truth migration implementation.

This does not add routes, dependencies, package scripts, lockfile changes, browser runtime changes, storage runtime changes, normalized tables, deployment config, or real personal training data.

## Phase 6 Baseline

Task 6.0 through Task 6.8 are complete. The architecture checkpoint allows planning for a narrow backend adapter skeleton only.

`localStorage` remains default runtime source, fallback, migration source, and emergency backup. `api-primary-dev` remains explicit dev/local only and not production-ready.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

## Backend Adapter Boundary

The backend adapter boundary is Node-only, inert by default, and isolated from browser-facing modules.

The future adapter skeleton may be Node-only and must not be exported from browser-facing modules. It may define typed request handling, safe response envelopes, route allowlist metadata, and explicit non-starting lifecycle helpers.

The adapter must not auto-listen, bind ports, deploy, create databases, migrate schema, authenticate users, read real production data, or mutate browser runtime state.

## Request / Response Shape

Future skeleton requests should use explicit method, path, headers metadata, body, request id, environment label, and source snapshot metadata.

Future skeleton responses should use an envelope with `ok`, `status`, `requestId`, optional `data`, optional `error`, and safe diagnostics. Error responses must avoid raw AppData, localStorage dumps, tokens, secrets, and personally identifying training data.

## Environment Boundary

The adapter skeleton must be inert by default. It must require explicit Node-only construction in tests or future server integration. Browser builds must remain clean of Node-only tokens.

No production environment activation, hosted deployment, staging deployment, Vercel production dependency, secret values, or package script is approved by Task 6.9.

## Route Boundary

Task 6.9 does not approve new browser mutation routes or production-only routes. It preserves the seven accepted browser mutation routes and keeps blocked routes blocked.

Blocked routes/capabilities include `POST /data-health/repair/apply`, backup/import/export over HTTP, reset/recovery over HTTP, an eighth browser mutation route, auth routes, cloud sync routes, and production-only routes.

## Data and Source-of-truth Boundary

The adapter skeleton plan does not change AppData, `localStorage`, SQLite, or source-of-truth behavior. API/SQLite production primary remains not approved.

The future skeleton must not silently overwrite AppData or `localStorage`, must not migrate data, and must not use real personal training data.

## Acceptance Expectations for Task 6.10

Task 6.10 may add a minimal Node-only adapter skeleton only if it can remain isolated, inert, dependency-free, and unexported from browser-facing modules.

Task 6.10 must stop if safe implementation requires a production framework/server/deployment/auth/database rewrite, package dependency, package script, normalized schema, browser runtime integration, or source-of-truth switch.

## Decision

Task 6.9 result: production backend adapter skeleton plan only.

Decision: allow Task 6.10 to attempt a narrow Node-only backend adapter skeleton, but do not implement the skeleton in Task 6.9.

Recommended next task: `Task 6.10 Production Backend Adapter Skeleton V1`.

Task 6.10 may add a Node-only adapter skeleton only if safe. It must not add auto-listen behavior, deployment, auth, normalized tables, production data use, browser runtime integration, package dependencies, routes, or source-of-truth switching.

## Decision Record

- Date: 2026-05-12
- Branch / commit: `codex/task6.9-production-backend-adapter-skeleton-plan` / pending until merge
- Decision: plan a narrow Node-only backend adapter skeleton and reject runtime activation.
- Baseline: `localStorage` remains default runtime source and `api-primary-dev` remains dev/local only.
- Accepted routes: `POST /data-health/issues/:issueId/dismiss`; `POST /history/:id/data-flag`; `POST /history/:id/edit`; `POST /sessions/start`; `POST /sessions/active/patches`; `POST /sessions/active/complete`; `POST /sessions/active/discard`
- Rejected immediate implementations: production server, auto-listen, hosted deployment, auth runtime, database migration, normalized schema, production runtime activation, source-of-truth switch.
- Required future gates: backend adapter skeleton, backend adapter acceptance, auth boundary, storage strategy, deployment strategy, observability/privacy, and manual acceptance.
- Next task: `Task 6.10 Production Backend Adapter Skeleton V1`
- Rollback requirement: because this task adds docs/static tests only, rollback is reverting the Task 6.9 commit.

## Final Recommendation

Task 6.9 is complete after this task.

Do not start production backend runtime activation yet. Next task should be Task 6.10 Production Backend Adapter Skeleton V1, limited to an inert Node-only skeleton if safe.

## Task 6.10 Follow-up

Task 6.10 Production Backend Adapter Skeleton V1 adds `apps/api/src/node/productionBackendAdapter.ts` as an inert Node-only adapter skeleton.

The skeleton must remain dependency-free, not exported from browser-facing API index files, without auto-listen behavior, hosted deployment, auth runtime, database migration, normalized tables, production data use, browser runtime integration, package changes, route additions, or source-of-truth switching.
