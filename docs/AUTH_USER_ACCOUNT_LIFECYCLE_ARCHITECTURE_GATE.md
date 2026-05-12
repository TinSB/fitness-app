# Auth User Account Lifecycle Architecture Gate

## Scope / Non-goals

Task 6.3 is an auth and user account lifecycle architecture gate.

This is docs/static tests only. This is not auth implementation. This is not login/signup implementation. This is not OAuth implementation. This is not token/session handling implementation. This is not user account runtime implementation. This is not a production backend implementation. This is not cloud sync implementation. This is not deployment implementation. This is not production source-of-truth migration implementation.

This does not add a user table. This does not add routes. This does not add dependencies, package scripts, or lockfile changes. This does not change App runtime behavior, storage runtime behavior, `src/devApi`, or browser mutation routes. This does not use real personal training data.

## Phase 6 Baseline

Phase 5 completed. Task 6.0 preflight completed. Task 6.1 production architecture gate completed. Task 6.2 production data ownership, privacy, and security matrix completed.

`localStorage` remains default runtime source, fallback, migration source, and emergency backup. `api-primary-dev` remains explicit dev/local only and not production-ready.

Production backend/auth/sync/deployment/monitoring remain unimplemented. Production source-of-truth migration remains unimplemented.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

Blocked routes and capabilities remain: `POST /data-health/repair/apply`, backup/import/export over HTTP, reset/recovery over HTTP, eighth browser mutation route, unapproved production-only routes, unapproved auth/sync/cloud routes, destructive real-data migration, production source-of-truth switch, normalized tables, dependency changes, package scripts, and lockfile changes.

## Lifecycle Actors And States

| Actor / state | Description | Required future gate |
| --- | --- | --- |
| anonymous local user | Current local-first user with AppData owned by browser `localStorage`. | Local-to-account linking gate. |
| future account identity | Future production identity, not implemented in Task 6.3. | Auth provider architecture gate. |
| linked account user | Future state after explicit local data to account linking. | Account linking confirmation gate. |
| deleted account user | Future state after account deletion and export/delete policy. | Account deletion lifecycle gate. |
| auth failure state | Future state for unavailable auth, invalid identity, expired session, or identity mismatch. | Auth failure behavior gate. |

## Anonymous Local User Boundary

Anonymous local mode remains valid. `localStorage` remains the default runtime source and must remain available as localStorage fallback, migration source, and emergency backup. Anonymous local data must not be attached to an account automatically.

## Future Account Identity Boundary

Future account identity may include a stable account id, provider subject id, account email or alias, account status, and consent/confirmation metadata only after future approval.

No account identity is implemented in Task 6.3. No login/signup is implemented in Task 6.3. No token/session/OAuth handling is implemented in Task 6.3. No user table is added in Task 6.3.

## Local Data To Account Linking

Local data to account linking must be explicit, confirmation-gated, reversible before final commit, and backed by export/backup. Linking must detect identity mismatch, already-linked data, stale local data, missing account identity, and failed write/rollback.

API or account results must not silently overwrite AppData or `localStorage`. No localStorage replacement occurs in Task 6.3.

## Account Creation Lifecycle

Future account creation must define preconditions, consent, local data handling, confirmation, failure states, rollback, and post-creation export/delete responsibilities before implementation.

Task 6.3 does not create accounts, does not store credentials, does not store tokens, and does not add auth routes.

## Account Deletion Lifecycle

Future account deletion must define export-before-delete, backup retention, audit receipt, local fallback behavior, account closure, linked-device cleanup, and recovery boundaries.

Task 6.3 does not delete accounts, does not delete localStorage, and does not perform destructive migration.

## Export / Delete Responsibilities

Future auth/account work must define which data classes are exportable, which are deletable, which require audit receipts, and which require retention exceptions before production implementation.

Export/delete responsibility must cover training history, active session, program templates, settings, screening profile, DataHealth state, backup metadata, readMirror summaries, derived analytics, migration state, account identity metadata, auth/session metadata, sync metadata, audit/security logs, support/diagnostic data, and deletion/export records.

## Auth Failure Behavior

Future auth failure behavior must be visible and non-destructive. Auth unavailable, expired session, invalid provider response, identity mismatch, account deletion in progress, and account linking failure must not fake success and must not silently overwrite AppData or `localStorage`.

The App must remain usable in local mode when auth is unavailable unless a future production gate explicitly changes that behavior.

## Identity Mismatch Risk Register

| Risk | Severity | Mitigation | Required future gate |
| --- | --- | --- | --- |
| anonymous local user linked to wrong account | Critical | Require explicit confirmation, account preview, and rollback before linking. | Account linking confirmation gate. |
| account identity mismatch | Critical | Compare stable account identity, local owner metadata, and link intent before write. | Identity mismatch gate. |
| stale local data overwrites account data | High | Require source snapshot, backup-first, and conflict review before linking. | Local-to-account migration gate. |
| account deletion removes local fallback | Critical | Ban automatic localStorage deletion and require export/backup before deletion. | Account deletion lifecycle gate. |
| token/session leakage | Critical | Require token/session handling design, secret redaction, and no raw logs. | Auth/session security gate. |
| auth failure fake success | High | Require visible failure and no success unless future auth operation is confirmed. | Auth failure behavior gate. |
| export/delete responsibility gap | High | Map export/delete by data domain before implementation. | Export/delete policy gate. |
| support diagnostics leak identity data | High | Require redaction and explicit support bundle policy. | Support diagnostics privacy gate. |

## Required Gates Before Auth Implementation

Before auth implementation:

- auth provider architecture decision
- account identity model
- local data to account linking policy
- account creation lifecycle policy
- account deletion lifecycle policy
- export/delete responsibility matrix
- token/session/OAuth security design
- auth failure behavior plan
- identity mismatch prevention plan
- privacy/security review
- manual acceptance runbook
- explicit user approval for implementation

## Decision

Task 6.3 result: auth and user account lifecycle architecture gate only.

Recommended next task: `Task 6.4 Production Backend & Database Architecture Decision V1`.

Task 6.4 must be planning/docs/static tests only. Task 6.4 must not implement production backend, normalized schema, auth, sync, deployment, migration, or source-of-truth switching.

## Decision Record

- Date: 2026-05-12
- Branch / commit: `codex/task6.3-auth-user-account-lifecycle-architecture-gate` / pending until merge
- Decision: define auth and user account lifecycle boundaries before any auth implementation.
- Baseline: Phase 6 preflight, production architecture gate, and production data ownership/privacy/security matrix are complete.
- Accepted routes: `POST /data-health/issues/:issueId/dismiss`; `POST /history/:id/data-flag`; `POST /history/:id/edit`; `POST /sessions/start`; `POST /sessions/active/patches`; `POST /sessions/active/complete`; `POST /sessions/active/discard`
- Rejected immediate implementations: login/signup, user table, token/session/OAuth handling, auth provider, account linking runtime, account deletion runtime, production backend, cloud sync, deployment, source-of-truth migration.
- Required gates: account identity, account lifecycle, export/delete, auth failure, identity mismatch, token/session security, and manual acceptance.
- Next task: `Task 6.4 Production Backend & Database Architecture Decision V1`
- Rollback requirement: because this task adds docs/static tests only, rollback is reverting the Task 6.3 commit.

## Final Recommendation

Task 6.3 is complete after this task.

Do not start auth implementation yet. Next task should be Task 6.4 Production Backend & Database Architecture Decision V1. Do not auto-start unapproved work outside the Phase 6 chain.

## Task 6.4 Follow-up

Task 6.4 Production Backend & Database Architecture Decision V1 adds `docs/PRODUCTION_BACKEND_DATABASE_ARCHITECTURE_DECISION.md` as a planning-level backend and database architecture decision.

Task 6.4 remains planning/docs/static tests only. It does not implement production backend, Fastify/Express/Koa/Hono server, production database, normalized schema, migration, auth, sync, deployment, source-of-truth migration, package changes, browser routes, or real personal training data migration.

The next recommended task after Task 6.4 is Task 6.5 Cloud Sync & Conflict Resolution Architecture Gate V1, docs/static tests only.
