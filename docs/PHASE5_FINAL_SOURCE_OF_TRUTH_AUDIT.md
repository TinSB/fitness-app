# Phase 5 Final Source-of-truth Audit

## Scope / Non-goals

Task 5.37 is the final Phase 5 source-of-truth audit before final manual acceptance.

This task does not add runtime behavior, does not modify App.tsx, does not add a browser mutation route, does not delete localStorage, does not silently overwrite localStorage, does not silently overwrite AppData, does not switch the default runtime source, does not add production backend, auth, sync, cloud, deployment, monitoring, package dependency, package script, normalized table, DataHealth repair, backup/import/export over HTTP, reset/recovery over HTTP, or an eighth browser mutation route.

## Phase 5 Runtime Source Status

Accepted runtime source modes are:

- `localStorage`
- `api-readonly`
- `api-primary-dev`

`localStorage` remains the default runtime source. `api-primary-dev` remains explicit dev/local opt-in only, localhost-only, visible-failure-first, and not production-ready.

## API Primary Dev Mode Status

API primary dev mode exists as a narrow Phase 5 prototype:

- runtime source selector is default-localStorage.
- API storage adapter is route-specific.
- boot from API snapshot requires explicit `api-primary-dev`.
- write-through runtime uses accepted route methods only.
- API failures remain visible.
- no production runtime mode exists.
- no auth, sync, cloud, deployment, or monitoring is implemented.

## LocalStorage Fallback Status

localStorage remains:

- default runtime source.
- fallback source.
- migration source.
- emergency backup.
- rollback source for localStorage backup restore.

API primary must not silently delete, replace, or overwrite localStorage.

## Migration Status

Migration work in Phase 5 is dev/local only:

- dry-run is warning-only and no-write.
- apply is backup-first and explicit-confirmation only.
- apply writes SQLite snapshot only through an injected writer.
- apply does not delete localStorage.
- apply does not auto-switch runtime source.
- rollback/recovery requires backup metadata and explicit confirmation.
- rollback uses injected localStorage/dev DB restore callbacks only.
- no HTTP migration, reset, or recovery route exists.

## Accepted Browser Mutation Routes

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

No eighth browser mutation route is accepted.

## Blocked Routes And Capabilities

Still blocked:

- `POST /data-health/repair/apply`
- backup/import/export over HTTP
- reset/recovery over HTTP
- any eighth browser mutation route
- broad frontend mutation client
- production backend/auth/sync/cloud/deployment/monitoring
- normalized tables
- package dependency or package script changes
- destructive real user data migration
- training algorithm, template, scheduler, PR, e1RM, effectiveSet, or backup import/export safety changes

## Source-of-truth Risk Register

| Risk | Severity | Current mitigation | Required gate |
| --- | --- | --- | --- |
| API primary accidentally becomes default | High | Runtime selector defaults to localStorage and requires explicit dev/local flag. | Runtime source selector tests remain green. |
| localStorage silent overwrite | High | API boot, write-through, apply, and rollback helpers report no silent localStorage writes. | LocalStorage integrity tests remain green. |
| AppData silent overwrite | High | API results require explicit runtime mode and visible failure on errors. | API primary acceptance and hardening remain green. |
| Migration apply data loss | High | Apply is backup-first, confirmation-gated, and no-delete. | Migration regression lock remains green. |
| Rollback failure | High | Rollback requires backup metadata and injected restore callbacks. | Rollback hardening tests remain green. |
| Production exposure | High | No production backend/auth/sync/deployment exists. | Boundary tests and PR checks pass. |
| Browser Node-only pollution | High | Browser build token scan remains required. | Dist scan passes. |

## Manual Acceptance Inputs

Task 5.38 must manually confirm:

- dedicated test browser profile.
- dedicated dev DB.
- no real personal training data.
- localStorage default boot.
- `api-readonly` diagnostics.
- `api-primary-dev` boot and failure behavior.
- accepted write routes only.
- migration dry-run, apply, and rollback.
- localStorage preservation.
- API unavailable fallback.
- cleanup/env reset.

## Browser Build Isolation

Browser build must remain clean of:

- `node:http`
- `node:sqlite`
- `devLauncher`
- `httpRuntimeAdapter`
- `serverAdapter`
- `sqliteRepository`
- `devApiRunner`
- `devDbRecovery`

## Decision

Phase 5 source-of-truth state is acceptable for dev/local prototypes only.

Default runtime remains `localStorage`. API/SQLite may act as App runtime source of truth only under explicit dev/local `api-primary-dev`. Migration remains backup-first, reversible, and non-production.

Next recommended task: `Task 5.38 Phase 5 Final Manual Acceptance V1`.

## Decision Record

- Date: 2026-05-12
- Branch / commit: `codex/task5.37-phase5-final-source-of-truth-audit` / pending until merge
- Decision: record final Phase 5 source-of-truth state before final manual acceptance.
- Runtime modes: `localStorage`, `api-readonly`, `api-primary-dev`
- Default source: `localStorage`
- API primary status: explicit dev/local only, not production-ready
- Migration status: dry-run/apply/rollback dev/local only, backup-first, no localStorage deletion
- Rejected next steps: production backend/auth/sync/cloud/deployment, eighth browser mutation route, DataHealth repair, backup/import/export over HTTP, reset/recovery over HTTP, destructive migration, source switch by default.
- Recommended next task: `Task 5.38 Phase 5 Final Manual Acceptance V1`
- Rollback requirement: because this audit adds docs/static tests only, rollback is reverting the audit commit.

## Final Recommendation

Task 5.37 result: final source-of-truth audit only.
`localStorage` remains the default runtime source and fallback/migration source.
`api-primary-dev` remains explicit dev/local only and not production-ready.
Migration rollback status is documented and remains backup-first/callback-only.
No production backend, auth, sync, cloud, deployment, monitoring, package change, normalized table, DataHealth repair, backup/import/export HTTP, reset/recovery HTTP, or eighth browser mutation route is added.
Next task should be Task 5.38 Phase 5 Final Manual Acceptance V1.
