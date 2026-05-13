# Production Runtime Manual Acceptance

## Scope / Non-goals

Task 8.12 Production Runtime Manual Acceptance V1 defines a human-run acceptance runbook for Phase 8 production runtime skeleton and frontend/backend separation prototype.

This runbook does not imply production readiness and does not authorize deployment, source-of-truth switch, auth, sync, monitoring, normalized tables, destructive migration, or real personal training data use.

## Prerequisites

- [ ] Use a dedicated test browser profile.
- [ ] Use synthetic data only.
- [ ] Do not use real personal training data.
- [ ] Confirm latest `main` includes Tasks 8.1 through 8.11.
- [ ] Confirm `npm run api:dev:build`, `npm run typecheck`, `npm test`, `npm run build`, and dist token scan pass.

## Health / Capability Route-like Handling

- [ ] Confirm `GET /health` route-like handler returns runtime available false and source-of-truth false.
- [ ] Confirm `GET /capabilities` route-like handler reports auth false, cloud sync false, deploymentReady false, monitoringReady false, and writeContract false.
- [ ] Confirm no server auto-listens and no HTTP route registration is required.

## Production Config Guard

- [ ] Confirm production runtime config is disabled by default.
- [ ] Confirm `api-primary-dev` is rejected as production runtime.
- [ ] Confirm localhost and dev API URLs are rejected as production backend URLs.
- [ ] Confirm secret values are not accepted by config guard.

## Production Read Contract

- [ ] Confirm read contract supports only `GET /app-data/summary`, `GET /sessions/summary`, `GET /history`, `GET /history/:id`, and `GET /data-health/summary`.
- [ ] Confirm all read contract responses report source-of-truth false.
- [ ] Confirm not-found and unsupported responses are visible and stable.

## Frontend API Client Disabled By Default

- [ ] Confirm frontend production API client is disabled by default.
- [ ] Confirm explicit HTTPS non-local base URL is required before read calls.
- [ ] Confirm client exposes read/capability calls only and no mutation methods.
- [ ] Confirm client is not mounted in `App.tsx`.

## Dual-read Comparison

- [ ] Confirm dual-read comparison is disabled by default.
- [ ] Confirm match, mismatch, unavailable, and failed statuses are diagnostic only.
- [ ] Confirm API unavailable does not block App usage.
- [ ] Confirm mismatch does not repair, sync, overwrite, or mutate local data.

## Write Shadow Mode

- [ ] Confirm write shadow mode is disabled by default.
- [ ] Confirm only the seven accepted mutation route IDs are accepted as shadow candidates.
- [ ] Confirm shadow results use `disabled`, `unsupported`, `accepted_shadow`, `rejected`, and `failed`.
- [ ] Confirm shadow mode does not overwrite localStorage or AppData.

## Source-of-truth And Local Data Safety

- [ ] Confirm no source-of-truth switch.
- [ ] Confirm localStorage remains default runtime source.
- [ ] Confirm localStorage remains fallback, migration source, and emergency backup.
- [ ] Confirm no localStorage overwrite by production read, dual-read, or shadow-write paths.
- [ ] Confirm no real personal training data is used.

## Browser / Node Isolation

- [ ] Confirm browser production bundle is free of `node:http`, `node:sqlite`, `devLauncher`, `httpRuntimeAdapter`, `serverAdapter`, `sqliteRepository`, `devApiRunner`, and `devDbRecovery`.
- [ ] Confirm Node-only production runtime skeleton files are not exported from browser-facing API index.
- [ ] Confirm frontend production API code imports no Node-only modules.

## Route Surface Lock

- [ ] Confirm accepted browser mutation routes remain exactly seven.
- [ ] Confirm no eighth browser mutation route.
- [ ] Confirm `POST /data-health/repair/apply` remains blocked.
- [ ] Confirm backup/import/export over HTTP remains blocked.
- [ ] Confirm reset/recovery over HTTP remains blocked.

## Vercel / Frontend Deployment Boundary

- [ ] Confirm Vercel frontend deployment does not equal backend production readiness.
- [ ] Confirm no production backend deployment is implemented.
- [ ] Confirm optional Vercel preview checks do not replace required IronPath Validation.

## Failure / Fallback Behavior

- [ ] Confirm config guard fails closed on missing or unsafe config.
- [ ] Confirm production read contract failures are visible and do not mutate local state.
- [ ] Confirm production API client failures do not replace localStorage.
- [ ] Confirm write shadow failures do not claim source-of-truth success.

## Pass / Fail Template

- [ ] Pass: all checks above are complete with synthetic data only.
- [ ] Fail: any source-of-truth switch, localStorage overwrite, route expansion, Node token in browser dist, real personal data use, or deployment implication is observed.
- [ ] Record tester, date, commit, environment, validation commands, and any failure evidence.

## Decision

Task 8.12 result: production runtime manual acceptance runbook only.

Recommended next task: Task 8.13 Phase 8 Runtime Boundary Regression Lock V1.

Task 8.13 may begin only after Task 8.12 is fully merged.
