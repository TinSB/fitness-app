# Production Backend Architecture Decision

## Task Identity

Task 7.6 makes the production backend architecture decision at planning/authorization level.

This task is docs/static tests only. It does not implement backend, add server, add deployment config, add database, add ORM, add normalized tables, add dependencies, add package scripts, or modify lockfiles.

## Architecture Decision

Do not promote `devApiRunner`, `api-primary-dev`, or the Node-only SQLite snapshot runtime into production.

Preferred direction: keep the frontend independently deployable as a static/Vercel web app, and design a separate production backend with its own security, deployment, monitoring, failure, auth, and data ownership model before implementation.

## Rejected Option: Promote Dev API To Production

The dev API is rejected as production backend architecture.

Rejected:

- deploying `devApiRunner` as production backend
- treating `api-primary-dev` as production-ready
- using local `node:sqlite` snapshot repository as production multi-user database
- switching source-of-truth in this task

## Recommended Production Backend Direction

Future production backend should be separate from dev/local API runtime. It must define production contracts, auth/user identity, ownership, data storage, deployment, monitoring, rollback, and incident behavior before live implementation.

## Database Strategy Boundary

The current SQLite snapshot repository remains dev/local and Node-only. It is not approved as a production multi-user database.

No normalized production tables are created or authorized by Task 7.6.

## Auth Dependency

Auth/user identity is required before cloud source-of-truth or user-owned backend writes can be authorized.

## Sync Dependency

Cloud sync depends on auth/user identity, device identity, conflict policy, idempotency, rollback, and privacy review. Task 7.6 authorizes no sync runtime.

## Deployment Dependency

Production backend must have a separate deployment/environment/secrets strategy before implementation. Task 7.6 adds no deployment runtime or config.

## Monitoring Dependency

Production backend must define privacy-safe diagnostics, redaction, retention, incident handling, and failure visibility before release. Task 7.6 adds no monitoring runtime.

## Source-of-truth Dependency

localStorage remains default runtime source, fallback, migration source, and emergency backup until a later explicit source-of-truth switch is authorized.

`api-primary-dev` remains explicit dev/local only and not production-ready.

## Blocked Implementation Scope

- production backend runtime
- dev API promotion
- auth runtime
- sync runtime
- deployment runtime
- monitoring runtime
- production source-of-truth switch
- database/ORM/normalized tables
- package/dependency/script/lockfile changes
- route additions

## Decision

Task 7.6 result: production backend architecture decision only.

Recommended next task: `Task 7.7 Production Runtime Skeleton Authorization V1`.

Task 7.7 is not started by Task 7.6.
