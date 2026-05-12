# Auth Boundary Account Model Plan

## Scope / Non-goals

Task 6.12 is an auth boundary and account model plan before any auth skeleton work.

This is docs/static tests only. This is not auth runtime implementation. This is not login/signup implementation. This is not token/session handling implementation. This is not OAuth implementation. This is not user table implementation. This is not account linking runtime. This is not production backend activation. This is not production source-of-truth migration implementation.

This does not add routes, dependencies, package scripts, lockfile changes, browser runtime changes, storage runtime changes, deployment config, normalized tables, or real personal training data.

## Phase 6 Baseline

Task 6.0 through Task 6.11 are complete. The production backend adapter skeleton is accepted as inert Node-only scaffolding and production runtime remains blocked.

`localStorage` remains default runtime source, fallback, migration source, and emergency backup. `api-primary-dev` remains explicit dev/local only and not production-ready.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

## Account Identity

Future account identity must distinguish local anonymous identity, account id, provider subject id, display identity, and data ownership id.

Account identity must never be inferred silently from localStorage. Any account binding requires explicit user-visible confirmation and mismatch handling.

## Local User to Account Mapping

Future local user to account mapping must preserve localStorage as migration source and emergency backup. Mapping must include source snapshot id, local profile metadata, account id, mapping status, confirmation status, and rollback instructions.

No local data is linked to an account in Task 6.12.

## Account Creation

Future account creation must define preconditions, identity provider boundary, duplicate account handling, local data ownership choice, failure behavior, and cancellation behavior before implementation.

Task 6.12 does not implement login, signup, provider redirects, password handling, token/session handling, or account persistence.

## Account Deletion

Future account deletion must define training data deletion, backup retention, audit retention, localStorage fallback, export-before-delete option, rollback window, and visible irreversible effects.

Task 6.12 does not implement account deletion runtime.

## Export / Delete Responsibilities

Future auth/account work must assign responsibility for export, delete, account deletion, backup retention, deletion records, and support diagnostics.

Export/delete over HTTP remains blocked until a future approved task explicitly implements it with acceptance coverage.

## Token / Session Requirements

Future token/session design must define storage boundary, expiry, refresh, revocation, CSRF/replay risk, log redaction, least privilege, and failure behavior.

Task 6.12 stores no tokens, creates no sessions, adds no OAuth flow, and adds no auth provider dependency.

## Auth Failure Behavior

Future auth failure must be visible and must not silently switch source of truth, overwrite localStorage, lose active session data, or fake success.

Local-only mode and localStorage fallback remain required when auth is unavailable or not implemented.

## Decision

Task 6.12 result: auth boundary and account model plan only.

Decision: do not implement auth runtime yet. Allow Task 6.13 to attempt type/interface-only auth provider adapter skeleton if it remains pure, dependency-free, and has no real provider or token storage.

Recommended next task: `Task 6.13 Auth Provider Adapter Skeleton V1`.

Task 6.13 may add type/interface-only auth boundary files if safe. It must not implement real auth, login UI, token storage, OAuth, provider integration, dependencies, routes, production backend activation, or source-of-truth switching.

## Decision Record

- Date: 2026-05-12
- Branch / commit: `codex/task6.12-auth-boundary-account-model-plan` / pending until merge
- Decision: plan auth/account boundaries and reject auth runtime implementation.
- Baseline: `localStorage` remains default runtime source and `api-primary-dev` remains dev/local only.
- Accepted routes: `POST /data-health/issues/:issueId/dismiss`; `POST /history/:id/data-flag`; `POST /history/:id/edit`; `POST /sessions/start`; `POST /sessions/active/patches`; `POST /sessions/active/complete`; `POST /sessions/active/discard`
- Still blocked: login/signup, token/session runtime, OAuth, user table, account linking runtime, auth routes, production backend activation, source-of-truth switch.
- Required future gates: auth provider adapter skeleton, auth account lifecycle acceptance, privacy/security review, export/delete plan, and manual acceptance.
- Next task: `Task 6.13 Auth Provider Adapter Skeleton V1`
- Rollback requirement: because this task adds docs/static tests only, rollback is reverting the Task 6.12 commit.

## Final Recommendation

Task 6.12 is complete after this task.

Do not start auth implementation yet. Next task should be Task 6.13 Auth Provider Adapter Skeleton V1, limited to type/interface-only scaffolding if safe.
