# Deployment Target Architecture Decision

## Task Identity

Task 10.9 Deployment Target Architecture Decision V1 decides future deployment target architecture without implementing deployment.

This task is docs/static tests only. It does not add Vercel functions, Docker files, hosting config, CI/CD scripts, package scripts, dependencies, deployment runtime, backend deployment, monitoring runtime, or source-of-truth changes.

## Decision

Frontend may remain a Vercel/static web app.

Backend should be a separate production API service unless a later explicit task decides otherwise.

Production database should be managed and production-ready later. The local node:sqlite snapshot repository must not be used as a production multi-user database.

Auth provider integration should remain adapter-based until Phase 11 explicitly authorizes a provider.

Cloud sync and monitoring require separate authorization before live runtime.

## Rejected Options

Do not deploy devApiRunner as production backend.

Do not promote api-primary-dev into production.

Do not treat Vercel preview as production backend readiness.

Do not use the local node:sqlite snapshot repository as production multi-user database.

Do not treat backend-primary candidate mode as SaaS/multi-user production runtime.

## Deployment Options

### Separate Node API Service

A separate Node API service is the current recommended direction because it keeps frontend static deployment, backend runtime, auth boundaries, secrets, monitoring, and database connectivity explicit.

This option still requires later authorization for real hosting config, deployment runtime, production database, secrets, monitoring, and operational readiness.

### Vercel Serverless/API Route Option

Vercel serverless or API routes remain a possible future option, but this task does not implement Vercel functions or route handlers.

This option would require explicit evaluation of runtime limits, secrets, account identity, cloud persistence, monitoring, and failure modes.

### Managed Backend Platform

A managed backend platform may be evaluated later if it fits the auth, database, privacy, export/delete, and monitoring requirements.

This task does not select or configure a managed backend platform.

### Self-Hosted Option

Self-hosting may be evaluated later if operational ownership, security updates, monitoring, backup, restore, and incident response are explicitly accepted.

This task does not add self-hosting config.

## Current Recommendation

Recommended future direction: keep the frontend deployable as a Vercel/static web app and plan a separate production API service behind explicit auth, secrets, deployment, monitoring, and data ownership gates.

The recommendation is architectural only. It does not authorize deployment implementation.

## Runtime Boundary

`localStorage` remains default, fallback, migration source, and emergency backup.

Backend-primary candidate remains explicit opt-in and reversible.

Auth skeleton remains disabled by default.

Cloud sync skeleton remains disabled by default.

Deployment runtime remains unimplemented.

Monitoring external upload remains unimplemented.

`api-primary-dev` remains explicit dev/local only and not production-ready.

## Blocked Implementation

Task 10.9 does not authorize:

- Vercel functions
- Docker files
- hosting config
- CI/CD scripts
- package scripts
- deployment runtime
- backend deployment
- production database
- auth provider integration
- real cloud sync
- monitoring external upload
- package dependency, package script, or lockfile changes
- source-of-truth switch
- normalized tables
- destructive migration
- real personal training data in tests, docs examples, fixtures, or acceptance evidence

## Recommendation

Recommended next task: Task 10.10 Deployment Runtime Skeleton Boundary V1.

Task 10.10 may add a disabled deployment runtime skeleton only. Task 10.10 must not deploy anything, add hosting config, add CI/CD scripts, add Docker, or add Vercel functions.

Task 10.10 is not part of Task 10.9. Auto-continue mode may begin Task 10.10 only after Task 10.9 is fully merged.
