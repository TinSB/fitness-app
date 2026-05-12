# Production Backend Auth Sync Deployment Architecture Gate

## Scope / Non-goals

Task 6.1 is a Phase 6 architecture gate.

This is not production backend implementation. This is not auth implementation. This is not user account implementation. This is not cloud sync implementation. This is not deployment implementation. This is not monitoring implementation. This is not production source-of-truth migration implementation. This is not normalized schema implementation.

This does not change App runtime behavior. This does not change storage runtime behavior. This does not add routes. This does not add dependencies or scripts. This does not use real personal training data.

## Phase 5 / 6.0 Baseline

Phase 5 completed. Task 6.0 preflight completed.

`localStorage` remains default runtime source. `localStorage` remains fallback, migration source, and emergency backup. `api-primary-dev` remains explicit dev/local only. `api-primary-dev` is not production-ready.

production backend/auth/sync/deployment/monitoring remain unimplemented.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

## Architecture Decision Categories

Phase 6 decisions are grouped into these categories:

- production backend architecture
- production database architecture
- auth / user identity
- user account lifecycle
- cloud sync / multi-device sync
- deployment / environments
- monitoring / observability
- privacy / security
- production migration / rollback
- backup / recovery

## Production Backend Architecture Options

| Option | Benefits | Risks | Blocker | Required future gate |
| --- | --- | --- | --- | --- |
| Option A: no production backend yet, keep local/dev API only | Preserves local-first safety, avoids premature hosting and auth decisions, keeps Phase 6 planning reversible. | Does not provide accounts, sync, hosted backup, or production availability. | Product must still choose production ownership and security model. | Production architecture selection gate. |
| Option B: single Node backend with existing API adapter model | Reuses current route semantics and can centralize read/write contracts. | Could accidentally promote dev-only assumptions into production and widen server responsibility too early. | Requires auth, data ownership, schema, deployment, and rollback decisions first. | Node backend contract and security gate. |
| Option C: serverless API routes | Can scale by route and align with preview/staging environments. | Cold starts, distributed writes, secret handling, and transaction boundaries need explicit design. | Requires deployment, DB, idempotency, and observability plan. | Serverless runtime architecture gate. |
| Option D: hosted backend/database service | Can offload database operations and managed availability. | Vendor lock-in, privacy constraints, migration complexity, and cost model uncertainty. | Requires provider review, privacy/security review, and backup/export policy. | Hosted service selection gate. |
| Option E: desktop/local-first backend only | Preserves local ownership and may reduce cloud privacy exposure. | Limits multi-device sync and production web availability. | Requires packaging, local backup, and support model decisions. | Local-first production strategy gate. |

Recommendation: Phase 6 should start with production architecture planning, not implementation. Do not select production backend implementation yet.

## Production Database / Storage Architecture

The current SQLite snapshot repository model is useful for dev/local API-backed runtime and migration prototypes, but it is not a production database architecture decision.

Production database/storage planning must evaluate normalized table migration risk, backup-first requirements, schema migration risk, local-first versus cloud-first storage, and production source-of-truth risk.

No normalized tables in Task 6.1. No production DB migration in Task 6.1. No real user data migration in Task 6.1.

## Auth / User Identity Architecture

Future auth planning must evaluate no-auth local mode, email/password, OAuth, passkey/future option, user account lifecycle, and identity migration from localStorage/app data to account data.

No auth implementation in Task 6.1. No login/signup in Task 6.1. No user table in Task 6.1. No token/session handling in Task 6.1.

## Cloud Sync / Multi-device Architecture

Future sync planning must evaluate no sync, manual backup/restore sync, single-device cloud backup, multi-device bidirectional sync, conflict resolution, and offline-first queue.

No cloud sync in Task 6.1. No background sync worker in Task 6.1. No remote write queue in Task 6.1.

## Deployment / Environment Architecture

Future deployment planning must evaluate local-only, preview/staging, production, environment variables, secrets, rollback, and branch protection / required checks.

No production deployment in Task 6.1. No deployment config change in Task 6.1. Vercel deployment is optional for Codex PRs. IronPath Validation remains the required check.

## Privacy / Security Architecture

Future privacy/security planning must cover personal training data classification, retention policy, export/delete policy, log redaction, secrets handling, least privilege, user data isolation, backup encryption/future requirement, and audit logging/future requirement.

No privacy/security runtime is implemented in Task 6.1.

## Production Migration / Rollback Architecture

Future production migration and rollback planning must cover backup-first, dry-run, apply, rollback, localStorage fallback, SQLite/dev data versus production data, destructive migration approval, and recovery drill.

No migration is implemented in Task 6.1.

## CI / Ruleset Architecture

Required PR check is GitHub Actions `IronPath Validation`.

Codex must use:

`gh pr checks <PR_NUMBER> --required --watch`

Optional Vercel checks must not block merge if GitHub allows normal squash merge.

Never use `--admin`. Never bypass branch protection. IronPath Validation failure blocks merge.

## Risk Matrix

| Risk | Severity | Mitigation | Required future gate |
| --- | --- | --- | --- |
| production data loss | Critical | Require backup-first migration, dry-run reports, restore verification, and explicit approval before production writes. | Production migration safety gate. |
| auth leakage | Critical | Require auth design review, token/session handling policy, least privilege, and secret handling before implementation. | Auth security gate. |
| account identity mismatch | High | Define account lifecycle, identity linking, and local data ownership before account migration. | Identity migration gate. |
| sync conflict corruption | Critical | Define conflict model, write ordering, recovery policy, and conflict diagnostics before multi-device sync. | Sync conflict architecture gate. |
| cloud write duplication | High | Require idempotency, device identity, request fingerprints, and duplicate-write handling before remote writes. | Cloud write idempotency gate. |
| offline queue corruption | High | Define queue ordering, replay safety, cancellation, and conflict resolution before offline queue work. | Offline queue gate. |
| migration rollback failure | Critical | Require backup-first, rollback drills, restore verification, and no automatic deletion of localStorage. | Rollback recovery gate. |
| localStorage/API divergence | High | Keep localStorage fallback and explicit runtime source selection until production migration is approved. | Source-of-truth migration gate. |
| production DB schema mistake | Critical | Require schema review, migration plan, rollback plan, and fixture-based validation before production DB changes. | Production schema gate. |
| deployment misconfiguration | High | Define environments, secrets, branch protection, rollout, and rollback before deployment. | Deployment environment gate. |
| secret leakage | Critical | Require secret storage, redaction, rotation, and access-control plan before production services. | Secrets management gate. |
| privacy exposure | Critical | Classify personal training data and define retention, export, delete, and access policies before production. | Privacy/security gate. |
| monitoring/logging sensitive data leakage | High | Require log redaction, sampling policy, no raw AppData/localStorage logging, and audit review. | Observability privacy gate. |
| branch protection bypass | High | Require IronPath Validation and normal squash merge only; never use admin bypass. | CI/ruleset gate. |
| real user data misuse | Critical | Ban real personal training data in automated tasks and require explicit separate migration approval. | Real data safety gate. |

## Required Gates Before Any Production Implementation

Before any production implementation:

- production backend architecture decision
- auth architecture decision
- privacy/security review
- data ownership mapping for production
- migration/rollback plan
- backup/recovery plan
- deployment/environment plan
- CI/ruleset policy
- manual acceptance plan
- no real data automation
- explicit user approval for implementation

## Decision

Task 6.1 result: architecture gate only.

Recommended next task: `Task 6.2 Production Data Ownership, Privacy & Security Matrix V1`.

Task 6.2 must be docs/static tests only. Task 6.2 must not implement auth, production backend, sync, deployment, or migration.

## Decision Record

- Date: 2026-05-12
- Branch / commit: `codex/task6.1-production-architecture-gate` / pending until merge
- Decision: define the Phase 6 production architecture gate without implementing production runtime.
- Phase 5 baseline: Phase 5 complete; `localStorage` default/fallback/migration/emergency backup; `api-primary-dev` explicit dev/local only and not production-ready.
- Task 6.0 baseline: preflight boundary complete; production backend/auth/sync/deployment, source-of-truth migration, normalized tables, package changes, and route changes remain blocked.
- Recommended architecture direction: continue with production data ownership, privacy, and security matrix before selecting implementation.
- Rejected immediate implementations: production backend, auth, user accounts, cloud sync, deployment, monitoring, production source-of-truth migration, normalized schema, and real user data migration.
- Required gates: production backend, auth, privacy/security, data ownership, migration/rollback, backup/recovery, deployment/environment, CI/ruleset, and manual acceptance.
- Next task: `Task 6.2 Production Data Ownership, Privacy & Security Matrix V1`
- Rollback requirement: because this task adds docs/static tests only, rollback is reverting the Task 6.1 commit.

## Final Recommendation

Task 6.1 is complete after this task.

Do not start production implementation yet. Next task should be Task 6.2 Production Data Ownership, Privacy & Security Matrix V1. Do not auto-start Task 6.2.
