# Migration Regression Lock

## Scope / Non-goals

Task 5.36 regression-locks the Phase 5 migration dry-run, apply, acceptance, rollback, and recovery state from Tasks 5.32 through 5.35.

This task does not add runtime behavior, does not modify App.tsx, does not add an HTTP migration endpoint, does not delete localStorage, does not write localStorage, does not silently overwrite AppData, does not auto-switch source of truth, does not add production backend, auth, sync, cloud, deployment, monitoring, package dependency, package script, normalized table, DataHealth repair, backup/import/export over HTTP, reset/recovery over HTTP, or an eighth browser mutation route.

## Locked Migration State

The accepted migration surface is:

- dry-run helper: `src/storage/localStorageToSqliteMigrationDryRun.ts`
- apply helper: `src/storage/localStorageToSqliteMigrationApply.ts`
- rollback/recovery helper: `src/storage/migrationRollbackRecovery.ts`
- manual acceptance runbook: `docs/MIGRATION_ACCEPTANCE_MANUAL.md`
- rollback and recovery hardening notes: `docs/MIGRATION_ROLLBACK_RECOVERY_HARDENING.md`

Migration remains dev/local only and not production-ready.

## Dry-run Lock

Dry-run remains warning-only and no-write:

- validates localStorage AppData.
- summarizes schema, history, templates, active session, and settings.
- reports API snapshot mismatch as warnings.
- never writes SQLite.
- never writes localStorage.
- never switches runtime source.
- never repairs data automatically.

## Apply Lock

Migration apply remains:

- development-only.
- gated by `VITE_IRONPATH_MIGRATION_APPLY="localstorage-to-sqlite-apply"`.
- explicit-confirmation only.
- backup-first.
- blocked when dry-run fails.
- SQLite snapshot writer injected only.
- blocked on malformed SQLite snapshot metadata.
- unable to delete localStorage.
- unable to auto-switch source of truth.

## Rollback Lock

Rollback/recovery remains:

- development-only.
- gated by `VITE_IRONPATH_MIGRATION_ROLLBACK="localstorage-to-sqlite-rollback"`.
- explicit-confirmation only.
- backup metadata required.
- localStorage restore callback injected only.
- dev DB restore callback injected only.
- corrupt snapshot failures visible.
- schema mismatch failures visible.
- no HTTP reset route.
- no HTTP recovery route.

## No Destructive Import Lock

Migration must not:

- delete localStorage.
- clear localStorage.
- silently overwrite localStorage.
- silently overwrite AppData.
- auto-switch source after apply.
- import over HTTP.
- restore over HTTP.
- reset over HTTP.
- perform production migration.

## Accepted Browser Mutation Routes

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

No migration browser mutation route is added.

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
- training algorithm, template, scheduler, PR, e1RM, effectiveSet, or backup import/export safety changes

## Source-of-truth Lock

Default runtime source remains `localStorage`.

API/SQLite may be source of truth only under explicit dev/local `api-primary-dev`. localStorage remains fallback, migration source, and emergency backup. Migration apply and rollback must not silently overwrite localStorage or AppData.

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

## Coverage Inventory

Regression coverage includes:

- `tests/localStorageToSqliteMigrationDryRun.test.ts`
- `tests/localStorageToSqliteMigrationDryRunBoundary.test.ts`
- `tests/localStorageToSqliteMigrationDryRunDocs.test.ts`
- `tests/localStorageToSqliteMigrationApply.test.ts`
- `tests/localStorageToSqliteMigrationApplyBoundary.test.ts`
- `tests/localStorageToSqliteMigrationApplySafety.test.ts`
- `tests/migrationAcceptance.test.ts`
- `tests/migrationAcceptanceBoundary.test.ts`
- `tests/migrationManualAcceptanceDocs.test.ts`
- `tests/migrationRollbackRecoveryHardening.test.ts`
- `tests/migrationRollbackRecoveryHardeningBoundary.test.ts`
- `tests/migrationRollbackRecoveryHardeningDocs.test.ts`
- `tests/migrationRegressionLock.test.ts`
- `tests/migrationRegressionBoundaryLock.test.ts`
- `tests/migrationRegressionCoverageInventory.test.ts`
- `tests/migrationRegressionDocsParity.test.ts`

## Manual Inventory

Manual coverage includes:

- `docs/MIGRATION_ACCEPTANCE_MANUAL.md`
- dedicated test browser profile
- dedicated dev DB
- no real personal training data
- backup-first apply
- SQLite snapshot metadata read
- localStorage preservation
- rollback restore
- source not auto-switched
- cleanup/env reset

## Future Work Gate

The next task may start the Phase 5 final source-of-truth audit only if this migration regression lock remains green.

Future work must not:

- delete localStorage.
- silently overwrite localStorage.
- silently overwrite AppData.
- auto-switch source of truth.
- add DataHealth repair.
- add backup/import/export over HTTP.
- add reset/recovery over HTTP.
- add an eighth browser mutation route.
- start production backend/auth/sync/cloud/deployment/monitoring.
- start Phase 6 implementation.

## Decision

Task 5.36 locks migration dry-run, apply, manual acceptance, rollback, and recovery as dev/local, backup-first, non-destructive, source-safe, and not production-ready.

Next recommended task: `Task 5.37 Phase 5 Final Source-of-truth Audit V1`.

## Final Recommendation

Task 5.36 result: migration regression lock only.
No browser mutation route is added.
No production backend, auth, sync, cloud, deployment, monitoring, package dependency, package script, normalized table, DataHealth repair, backup/import/export HTTP, reset/recovery HTTP, or eighth route is added.
localStorage remains default, fallback, migration source, and emergency backup.
API primary remains explicit dev/local `api-primary-dev`.
Next task should be Task 5.37 Phase 5 Final Source-of-truth Audit V1.
