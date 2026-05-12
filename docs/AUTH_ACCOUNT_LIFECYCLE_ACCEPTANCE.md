# Auth Account Lifecycle Acceptance

## Scope / Non-goals

Task 6.14 is acceptance documentation and static tests for the auth/account lifecycle boundary.

This is docs/static tests only. This is not login/signup runtime implementation. This is not token/session runtime implementation. This is not OAuth implementation. This is not auth provider integration. This is not user table implementation. This is not account lifecycle runtime implementation. This is not production backend activation. This is not production source-of-truth migration implementation.

This does not add routes, dependencies, package scripts, lockfile changes, browser runtime changes, storage runtime changes, deployment config, normalized tables, or real personal training data.

## Accepted Auth Skeleton Baseline

Task 6.13 added type/interface-only auth boundary files:

- `src/auth/authProviderTypes.ts`
- `src/auth/authBoundary.ts`

The skeleton remains pure, unavailable by design, and returns `auth_runtime_not_implemented`. It stores no credentials, starts no provider flow, performs no network request, and writes no browser storage.

## No Login / Signup Runtime

Login and signup remain blocked. No UI, routes, redirects, provider callbacks, password handling, account creation runtime, or account persistence is approved by Task 6.14.

## No Token / Session Runtime

Token/session runtime remains blocked. No access token storage, refresh handling, cookie/session creation, revocation, OAuth exchange, CSRF handling, or credential persistence is approved by Task 6.14.

## Account Lifecycle Gates

Future account lifecycle implementation requires separate gates for account creation, local data linking, account deletion, export-before-delete, backup retention, audit retention, rollback, and support diagnostics.

Each lifecycle step must have visible failure, cancellation behavior, no fake success, and no silent localStorage overwrite.

## Deletion / Export Policy

Future account deletion must define export-before-delete, training data deletion, backup retention, audit record retention, deletion record retention, localStorage fallback, and irreversible-effect confirmation.

Export/delete runtime and HTTP routes remain blocked by Task 6.14.

## Identity Mismatch Prevention

Future auth work must treat identity mismatch as a hard stop.

Future account linking must compare local identity, account identity, provider subject, source snapshot id, and ownership metadata before linking data.

Identity mismatch must stop the flow visibly. The app must not silently attach local training data to the wrong account, overwrite localStorage, or switch source of truth.

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

Task 6.14 result: auth account lifecycle acceptance and boundary lock only.

Decision: accept the Task 6.13 type/interface-only auth skeleton while keeping login/signup runtime, token/session runtime, account lifecycle runtime, and auth provider integration blocked.

Recommended next task: `Task 6.15 Production Storage Schema Strategy V1`.

Task 6.15 must be docs/static tests only. Task 6.15 must not create normalized tables, implement schema migration, perform database writes, use real personal training data, add routes, add dependencies, or switch source of truth.

## Decision Record

- Date: 2026-05-12
- Branch / commit: `codex/task6.14-auth-account-lifecycle-acceptance` / pending until merge
- Decision: accept auth/account lifecycle boundaries and keep auth runtime blocked.
- Baseline: `localStorage` remains default runtime source and `api-primary-dev` remains dev/local only.
- Accepted routes: `POST /data-health/issues/:issueId/dismiss`; `POST /history/:id/data-flag`; `POST /history/:id/edit`; `POST /sessions/start`; `POST /sessions/active/patches`; `POST /sessions/active/complete`; `POST /sessions/active/discard`
- Still blocked: login/signup runtime, token/session runtime, OAuth, auth provider integration, user table, account lifecycle runtime, export/delete runtime, auth routes, source-of-truth switch.
- Required future gates: storage schema strategy, auth lifecycle implementation approval, export/delete plan, privacy/security hardening, and manual acceptance.
- Next task: `Task 6.15 Production Storage Schema Strategy V1`
- Rollback requirement: because this task adds docs/static tests only, rollback is reverting the Task 6.14 commit.

## Final Recommendation

Task 6.14 is complete after this task.

Do not start auth implementation yet. Next task should be Task 6.15 Production Storage Schema Strategy V1.
