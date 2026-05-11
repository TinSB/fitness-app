# Migration Backup & Rollback Strategy

## Scope / Non-goals

Task 5.5 plans migration backup and rollback behavior.

- This is documentation and static-test coverage only.
- This does not implement migration dry-run.
- This does not implement migration apply.
- This does not write SQLite snapshots.
- This does not delete localStorage.
- This does not add localStorage replacement.
- This does not implement API-backed runtime.
- This does not switch source of truth.
- This does not modify `App.tsx`.
- This does not add production backend, auth, sync, cloud, deployment, or monitoring.
- This does not add a browser mutation route.
- This does not add package dependencies, package scripts, lockfile changes, normalized tables, schemas, storage adapters, or training algorithm changes.

## Current Baseline

At Task 5.5 entry, localStorage remains source of truth and default runtime source.

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`

API results never overwrite AppData or localStorage. No migration dry-run or apply tool is implemented by this task.

## Backup-first Rule

Every future migration apply must be backup-first.

- localStorage backup must be created before any SQLite write.
- SQLite snapshot backup must be created before replacing or superseding any dev DB snapshot.
- Backup validation must run before apply.
- Failed backup validation must block apply.
- Backup artifacts must not be committed.
- Real personal training data must not be used in manual acceptance.

## localStorage Backup Strategy

Future migration apply must preserve a localStorage backup that includes:

- full raw localStorage AppData payload.
- schema/version marker if available.
- timestamp.
- source browser profile label.
- checksum or hash.
- validation result.

The backup must be restorable before migration apply is accepted.

## SQLite Snapshot Backup Strategy

Before a future migration apply writes a new SQLite snapshot:

- the current latest dev DB snapshot metadata must be recorded.
- any previous migration-created snapshot must be identifiable.
- rollback must be able to identify the pre-apply snapshot.
- backup metadata must not expose raw AppData or personal training data in UI.

## Dry-run Strategy

Future dry-run must be read-only.

- Validate localStorage AppData.
- Validate schema compatibility.
- Compare target SQLite snapshot expectations.
- Produce warnings and blocking errors.
- Produce no writes.
- Do not switch runtime source.
- Do not change localStorage.

## Apply Strategy

Future apply must be dev-only and explicit-confirmation only.

- Require successful dry-run.
- Require localStorage backup.
- Require SQLite snapshot backup when a dev DB snapshot exists.
- Write a SQLite snapshot only after backups pass.
- Do not delete localStorage.
- Do not auto-switch runtime source.
- Do not imply production migration.

## Rollback to localStorage Strategy

Rollback must restore App usability from localStorage.

- Restore from the validated localStorage backup when needed.
- Keep rollback explicit and user-confirmed.
- Show visible success or failure.
- Do not silently overwrite AppData.
- Do not delete SQLite snapshots during rollback unless a later task explicitly approves a dev-only cleanup path.

## Corrupt Snapshot Handling

If a localStorage backup or SQLite snapshot is corrupt:

- show visible failure.
- do not apply migration.
- do not switch runtime source.
- do not delete localStorage.
- do not show success.
- provide manual recovery instructions.

## Schema Mismatch Handling

If schema validation or repository schema checks fail:

- block migration apply.
- show a safe failure code.
- do not write a SQLite snapshot.
- do not switch runtime source.
- do not alter localStorage.
- require a later compatibility fix before retry.

## Decision

Require backup-first migration design before any dry-run or apply prototype.

Next task: `Task 5.6 Offline / PWA Conflict Strategy V1`.

Task 5.6 must be docs/static tests only. It must not implement offline mutation queue, source-of-truth migration, API-backed runtime, localStorage replacement, production backend/auth/sync/deployment, or a new browser mutation route.

## Decision Record

- Date: 2026-05-11
- Branch / commit: `codex/task5.5-migration-backup-rollback-strategy` / pending until merge
- Decision: require backup-first dry-run/apply/rollback planning before offline/PWA conflict strategy.
- Current accepted routes: `POST /data-health/issues/:issueId/dismiss`; `POST /history/:id/data-flag`; `POST /history/:id/edit`; `POST /sessions/start`
- Rejected next steps: migration apply implementation, destructive localStorage migration, automatic runtime source switch, production migration, production backend/auth/sync/deployment, unapproved route expansion.
- Recommended next task: `Task 5.6 Offline / PWA Conflict Strategy V1`
- Rollback requirement: because this strategy adds docs/static tests only, rollback is reverting the strategy commit.

## Final Recommendation

Task 5.5 result: migration backup and rollback strategy only.
localStorage remains source of truth.
API results never overwrite AppData or localStorage.
No migration dry-run is implemented.
No migration apply is implemented.
No API-backed runtime is implemented.
No production backend, auth, sync, cloud, deployment, or monitoring is added.
Next task should be Task 5.6 Offline / PWA Conflict Strategy V1.

## Task 5.6 Offline / PWA Conflict Follow-up

Task 5.6 adds `docs/OFFLINE_PWA_CONFLICT_STRATEGY.md` as a strategy document only.

- It covers API unavailable behavior, offline training, active session persistence, visible failure, and conflict diagnostics.
- It keeps full offline mutation queue implementation blocked.
- It keeps localStorage as source of truth.
- It does not implement API-backed runtime.
- It recommends Task 5.7 API-backed Read Runtime Plan V1 as docs/static tests only.
