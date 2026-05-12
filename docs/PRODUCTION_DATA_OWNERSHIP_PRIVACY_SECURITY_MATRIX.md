# Production Data Ownership Privacy Security Matrix

## Scope / Non-goals

Task 6.2 is a production data ownership, privacy, and security matrix.

This is docs/static tests only. This is not production backend implementation. This is not auth implementation. This is not user account implementation. This is not cloud sync implementation. This is not deployment implementation. This is not monitoring implementation. This is not production source-of-truth migration implementation. This is not normalized schema implementation.

This does not change App runtime behavior. This does not change storage runtime behavior. This does not add routes. This does not add dependencies or scripts. This does not use real personal training data.

## Phase 5 / 6.0 / 6.1 Baseline

Phase 5 completed. Task 6.0 preflight completed. Task 6.1 architecture gate completed.

`localStorage` remains default runtime source. `localStorage` remains fallback, migration source, and emergency backup. `api-primary-dev` remains explicit dev/local only. `api-primary-dev` is not production-ready.

production backend/auth/sync/deployment/monitoring remain unimplemented. Production source-of-truth migration remains unimplemented.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

Blocked routes and capabilities remain:

- `POST /data-health/repair/apply`
- backup/import/export over HTTP
- reset/recovery over HTTP
- eighth browser mutation route
- production-only routes
- auth/sync/cloud routes
- production source-of-truth switch
- normalized tables
- destructive real-data migration

## Data Ownership Matrix

| Data domain | Current owner | Future production owner candidate | Privacy classification | Sensitivity | Retention expectation | Export/delete expectation | Backup/restore expectation | Logging allowance | Sync eligibility | Migration risk | Required future gate |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| training history | localStorage AppData | user-owned production account data, pending approval | personal training data | high | user-controlled retention until policy is approved | export required, delete required after account policy gate | backup-first and restore-verifiable | aggregate identifiers only, no raw sets/reps payloads | eligible only after sync conflict gate | high | production data ownership gate |
| active session | localStorage AppData with dev API prototypes | user-owned active workout state, pending approval | personal training data | high | short-lived with recovery policy | export with AppData, delete with account data | backup before migration or source switch | status only, no raw activeSession payload | eligible only after offline/sync conflict gate | high | active session production write gate |
| program templates | localStorage AppData | user-owned plan library or shared template catalog, pending approval | personal training data when user-modified | medium | retained while account exists unless deleted | export/delete required for user templates | backup-first with template restore check | template ids only | eligible after ownership split gate | medium | template ownership gate |
| settings | localStorage AppData | user-owned account/device preferences, pending approval | preference data | medium | retained while account/device profile exists | export/delete required for account settings | backup-first with settings restore check | non-sensitive feature flags only | eligible after device preference gate | medium | settings ownership gate |
| screening profile | localStorage AppData | user-owned health/screening profile, pending approval | sensitive personal data | critical | explicit retention policy required | export/delete required and separately reviewed | encrypted backup future requirement | never log raw screening fields | eligible only after privacy/security gate | critical | screening privacy gate |
| DataHealth state | localStorage AppData plus dev diagnostics | user-owned diagnostics state, pending approval | data quality metadata | medium | retained only as needed for repair/audit policy | export/delete with AppData | backup-first before repair policy | issue ids and counts only | eligible after repair policy gate | medium | DataHealth production policy gate |
| backup metadata | local backup/export artifacts | user-controlled backup registry, pending approval | operational metadata | medium | retain per backup policy | export/delete backup records required | backup chain must be restorable | backup ids and timestamps only | eligible after backup policy gate | high | backup/recovery gate |
| readMirror summaries | derived from AppData/API snapshot | derived production read model, pending approval | derived personal training data | medium | rebuildable, not source of truth | export optional if rebuildable, delete with source | restore by rebuilding from source | aggregate counts only | eligible after read model gate | medium | read model ownership gate |
| derived analytics | derived from training history | derived production analytics, pending approval | derived personal training data | medium | rebuildable, retention tied to source | export optional summary, delete with source | restore by recalculation | aggregate only | eligible after analytics privacy gate | medium | analytics privacy gate |
| migration state | dev/local migration prototypes | migration audit state, pending approval | operational personal data metadata | high | retain only for migration/rollback window | export/delete policy required | backup-first and rollback-verifiable | migration status only | not sync eligible until migration gate | critical | production migration gate |
| account identity metadata | not implemented | auth/account provider profile, pending approval | identity data | critical | account lifecycle policy required | export/delete/account closure required | account recovery backup policy required | stable user id only, no secrets | eligible after auth architecture gate | critical | account identity gate |
| auth/session metadata | not implemented | auth/session provider, pending approval | authentication data | critical | minimal retention and expiration required | delete on logout/account closure policy | secret/session recovery policy required | never log tokens/secrets | not app sync data | critical | auth/session security gate |
| sync metadata | not implemented | sync service metadata, pending approval | operational sync metadata | high | retain only for sync recovery window | export/delete policy required | restore with device ordering policy | device ids and conflict codes only | eligible after cloud sync gate | critical | sync conflict gate |
| audit/security logs | not implemented | privacy-safe audit log, pending approval | security event metadata | high | minimal retention with security review | export/delete per legal/security policy | tamper-aware backup future requirement | redacted events only | not user data sync | high | audit logging privacy gate |
| support/diagnostic data | local/manual diagnostics | explicit support bundle, pending approval | support diagnostic data | high | user-approved limited retention | export/delete required for support bundles | user-controlled support bundle backup | redacted summaries only | not sync eligible by default | high | support diagnostics gate |
| deletion/export records | not implemented | compliance/audit records, pending approval | compliance metadata | high | retain only as required by policy | export/delete receipt policy required | durable receipt backup future requirement | receipt ids and timestamps only | not sync eligible by default | high | export/delete policy gate |

## Privacy Classification Matrix

PII and personal training data are classified before any production account, sync, or migration work.

| Classification | Data examples | Production handling requirement | Required future gate |
| --- | --- | --- | --- |
| sensitive personal data | screening profile, injury limitations, health-related notes | strongest minimization, encryption review, no raw logs | privacy/security gate |
| personal training data | training history, active session, templates, analytics | user export/delete, backup-first migration, redacted logs | production data ownership gate |
| identity data | account identity metadata | account lifecycle, identity linking, least privilege | account identity gate |
| authentication data | auth/session metadata | secret/token handling, expiration, no raw logging | auth/session security gate |
| operational metadata | DataHealth state, sync metadata, migration state, backup metadata | limited retention, redacted diagnostics, rollback policy | operations privacy gate |
| compliance metadata | deletion/export records, audit/security logs | policy-driven retention and privacy-safe access | compliance policy gate |

## Security Controls Matrix

| Control area | Requirement | Applies to | Required future gate |
| --- | --- | --- | --- |
| log redaction | no raw AppData, localStorage, tokens, screening fields, SQLite internals, or support bundles in logs | all production/runtime diagnostics | observability privacy gate |
| secrets handling | no secrets in source, logs, browser bundles, or support exports | auth/session metadata and deployment environments | secrets management gate |
| least privilege | route, database, sync, support, and admin access must be scoped to the minimum required capability | production backend, auth, support, sync | access-control gate |
| user data isolation | one user's data must not be readable or writable through another user/account/device context | account data, sync data, backups | user isolation gate |
| account-linking boundaries | local AppData must not attach to account identity without explicit confirmation and rollback plan | identity migration | account linking gate |
| retention/export/delete policy | retention windows, export scope, delete semantics, and receipts must be defined before production | all user-owned data | retention policy gate |
| backup encryption future requirement | production backup design must define encryption, key ownership, restore checks, and failure handling | backups and migration state | backup security gate |
| audit logging future requirement | audit logs must be privacy-safe, scoped, retained minimally, and reviewed before monitoring | security events and destructive operations | audit logging gate |
| real-data safety | automated tasks must not use real personal training data; destructive migration requires explicit approval | all production migration work | real data safety gate |

## Retention / Export / Delete Policy Matrix

Retention, export, and deletion policies are not implemented in Task 6.2.

Future production work must define user-facing export, delete, account closure, backup retention, recovery receipt, and audit retention behavior before any production data migration or auth/account launch.

## Logging / Diagnostics Boundary

Production logging is not implemented in Task 6.2.

Future logs may include privacy-safe status, counts, route names, error categories, request ids, and redacted diagnostic summaries. Future logs must include no raw AppData, no raw localStorage, no raw SQLite rows, no training payloads, no screening fields, no auth tokens, no secrets, no support bundle contents, no backup payloads, and no sync queue payloads.

## Sync / Migration Eligibility Matrix

Sync and migration are not implemented in Task 6.2.

No data domain is production sync eligible until a future cloud sync conflict gate approves ownership, identity, device ordering, idempotency, rollback, and privacy controls. No data domain is production migration eligible until backup-first, dry-run, apply, rollback, export/delete, and recovery drill gates are approved.

## Real Data Safety Boundary

No real personal training data may be used in automated tasks. Manual acceptance must require a dedicated test browser profile and dedicated dev DB. Any future real-data migration requires backup-first, explicit separate approval, dry-run evidence, rollback evidence, and no automatic deletion of localStorage.

## Required Gates Before Production Data Implementation

Before production data implementation:

- production data ownership gate
- privacy/security gate
- auth/account identity gate
- retention/export/delete policy gate
- backup/recovery gate
- production migration/rollback gate
- sync conflict gate
- observability privacy gate
- support diagnostics gate
- real data safety gate
- explicit user approval for implementation

## Decision

Task 6.2 result: production data ownership, privacy, and security matrix only.

Recommended next task: `Task 6.3 Auth & User Account Lifecycle Architecture Gate V1`.

Task 6.3 must be docs/static tests only. Task 6.3 must not implement auth, production backend, sync, deployment, migration, or source-of-truth switching.

## Decision Record

- Date: 2026-05-12
- Branch / commit: `codex/task6.2-production-data-ownership-privacy-security-matrix` / pending until merge
- Decision: classify production data ownership, privacy, and security boundaries before any production implementation.
- Phase 5 baseline: Phase 5 complete; `localStorage` default/fallback/migration/emergency backup; `api-primary-dev` explicit dev/local only and not production-ready.
- Task 6.0 baseline: preflight boundary complete; production backend/auth/sync/deployment and source-of-truth migration remain blocked.
- Task 6.1 baseline: architecture gate complete; production implementation remains unselected and unimplemented.
- Rejected immediate implementations: production backend, auth, user accounts, cloud sync, deployment, monitoring, production source-of-truth migration, normalized schema, and real user data migration.
- Required gates: data ownership, privacy/security, auth/account, retention/export/delete, backup/recovery, migration/rollback, sync conflict, observability privacy, support diagnostics, and real data safety.
- Next task: `Task 6.3 Auth & User Account Lifecycle Architecture Gate V1`
- Rollback requirement: because this task adds docs/static tests only, rollback is reverting the Task 6.2 commit.

## Final Recommendation

Task 6.2 is complete after this task.

Do not start production implementation yet. Next task should be Task 6.3 Auth & User Account Lifecycle Architecture Gate V1. Do not auto-start Task 6.3.
