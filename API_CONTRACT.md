# IronPath API Contract

Last updated: 2026-05-08

## Current Contract Status

There is no deployed backend API, auth service, remote sync, SQLite repository, or server persistence in the current IronPath frontend.

A read-only API skeleton exists under `apps/api/src/readMirror.ts` for parity testing and future backend extraction. Pure session and Record/DataHealth mutation skeletons exist under `apps/api/src/sessionMutation.ts` and `apps/api/src/recordDataHealthMutation.ts` for pre-backend write-boundary parity. A Node-only SQLite snapshot repository exists under `apps/api/src/sqliteRepository.ts` for repository parity tests. These skeletons are not wired into `App.tsx`, the UI, localStorage, or any runtime server.

All product data is stored in the user's current browser through `localStorage`, with import/export handled as local JSON files. Future agents must not assume any backend endpoint or remote field exists unless this file is updated first.

## Read Mirror API Skeleton

Owner files:

- `apps/api/src/readMirror.ts`
- `apps/api/src/index.ts`

Boundary:

- The skeleton is read-only.
- Only `GET` routes are declared.
- Non-`GET` requests return `405`.
- Handlers do not read or write localStorage.
- Handlers do not mutate `AppData`.
- Handlers do not import SQLite, Fastify, or backend runtime code.
- `App.tsx`, `loadData`, `saveData`, backup import/export, and Focus Mode mutation behavior remain unchanged.

Current routes:

- `GET /health`: service name, read-only mode, schema version, and route registry.
- `GET /app-data/summary`: counts and selected AppData state, including template/history counts, selected template ids, unit settings, pending patch count, dismissed counts, and repair log count.
- `GET /sessions/summary`: active session summary, history counts, analytics-included count, dataFlag counts, and latest session.
- `GET /history`: history list mirror using existing Record date and summary helpers.
- `GET /history/:id`: one history session with `getSessionCalendarDate` and `buildSessionDetailSummary`.
- `GET /data-health/summary`: DataHealth status, summary, issue count, and existing issue payload.

This skeleton is not a write API. It must not be extended with session mutation, record edit, data repair, backup import, SQLite, auth, or sync behavior without a separate migration task and parity tests.

## Session Mutation API Skeleton

Owner files:

- `apps/api/src/sessionMutation.ts`
- `apps/api/src/index.ts`
- `packages/contracts/src/index.ts`

Boundary:

- The skeleton is a pure function boundary, not a server runtime.
- Handlers accept `AppData + SessionMutationRequest` and return `SessionMutationResponse`.
- Handlers do not read or write localStorage.
- Handlers do not save returned data.
- Handlers do not mutate the input `AppData` object.
- Handlers do not import SQLite, Fastify, Express, auth, or cloud sync code.
- `App.tsx`, UI handlers, Focus Mode runtime, `loadData`, `saveData`, and backup import/export behavior remain unchanged.
- `nextData` may only be present when `result.ok === true && result.changed === true`.
- Invalid, no-op, conflict, requires-confirmation, and unsupported route paths must not return `nextData`.

Current routes:

- `POST /sessions/start`: creates an active session from `body.templateId || activeProgramTemplateId || selectedTemplateId`, and consumes a matching pending session patch only after successful start.
- `POST /sessions/active/patches`: applies explicit `SessionPatch[]` or a referenced pending patch to the active session.
- `POST /sessions/active/complete`: completes the active session into history; incomplete main work returns a confirmation-required result until confirmed.
- `POST /sessions/active/discard`: discards the unsaved active session after confirmation and does not write history.

This skeleton must not be extended with record edit, Focus step-level mutation, exercise replacement mutation, DataHealth repair, backup import/export mutation, SQLite repository, auth, or cloud sync behavior without a separate task and parity tests.

## Record & DataHealth Mutation API Skeleton

Owner files:

- `apps/api/src/recordDataHealthMutation.ts`
- `apps/api/src/index.ts`
- `packages/contracts/src/index.ts`

Boundary:

- The skeleton is a pure function boundary, not a server runtime.
- Handlers accept `AppData + RecordDataHealthMutationRequest` and return `RecordDataHealthMutationResponse`.
- Handlers do not read or write localStorage.
- Handlers do not save returned data.
- Handlers do not mutate the input `AppData` object.
- Handlers do not import SQLite, Fastify, Express, auth, or cloud sync code.
- `App.tsx`, UI handlers, `loadData`, `saveData`, backup import/export behavior, training algorithms, PR/e1RM, and effective-set rules remain unchanged.
- `nextData` may only be present when `result.ok === true && result.changed === true`.
- Invalid, no-op, not-found, requires-confirmation, unsafe, and unsupported route paths must not return `nextData`.

Current routes:

- `POST /history/:id/edit`: applies existing record set-edit helpers to one history session and preserves editHistory.
- `POST /history/:id/data-flag`: updates an existing session `dataFlag` to `normal`, `test`, or `excluded` through the current audit trail; test/excluded records remain visible but excluded from default statistics.
- `POST /data-health/issues/:issueId/dismiss`: dismisses an existing DataHealth issue for today without changing training records.
- `POST /data-health/repair/apply`: applies only the whitelisted `legacy_display_weight` repair after confirmation. It uses `repairLegacyDisplayWeights`, keeps `actualWeightKg` unchanged, and stores summary-only repair logs.

This skeleton does not implement backup import/export mutation, arbitrary record patching, Focus step mutation, replacement mutation, scheduler mutation, SQLite repository, auth, or cloud sync. Import-like unsafe payloads are defensively rejected by the repair boundary and are never sanitized into AppData.

## SQLite Repository Parity Layer

Owner files:

- `apps/api/src/sqliteRepository.ts`
- `apps/api/src/node/index.ts`

Boundary:

- The repository is Node-only and used only for parity tests.
- It uses Node built-in `node:sqlite` / `DatabaseSync`.
- It is not a runtime API and does not start a server.
- It does not read or write localStorage.
- It does not replace `loadData`, `saveData`, or the browser persistence facade.
- It is not statically re-exported from the shared `apps/api/src/index.ts`, so Vite browser builds do not parse or bundle `node:sqlite`.
- readMirror, sessionMutation, and recordDataHealthMutation still accept and return `AppData`; they do not depend on SQLite.

Snapshot schema:

- `app_meta(key TEXT PRIMARY KEY, value TEXT NOT NULL)`
- `app_data_snapshots(row_id INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT UNIQUE NOT NULL, schema_version INTEGER NOT NULL, app_data_json TEXT NOT NULL, created_at TEXT NOT NULL, label TEXT)`

Repository behavior:

- `writeSnapshot(appData)` sanitizes and validates AppData, then writes one JSON snapshot in a SQLite transaction.
- `readSnapshot(snapshotId?)` reads a specific snapshot or the latest snapshot using `ORDER BY row_id DESC LIMIT 1`, then validates, sanitizes, and validates again.
- `exportBackupFromSnapshot(snapshotId?)` delegates to existing `exportAppData`.
- `importBackupToSnapshot(payload)` parses and analyzes import data before writing; unsafe data is rejected, needs-review data requires explicit confirmation, and safe/cleaned data reuses existing backup import behavior.
- The repository stores AppData snapshots only. It does not create normalized sessions, sets, exercises, analytics, or DataHealth tables.
- `app_meta.latest_snapshot_id` is non-authoritative metadata. Latest snapshot selection must not read it.

Failure-mode contract:

- Repository errors use `SqliteRepositoryError.code`, not raw SQLite errors, for the stable surface.
- Stable codes are `node_sqlite_unavailable`, `snapshot_not_found`, `snapshot_json_invalid`, `snapshot_validation_failed`, `repository_schema_mismatch`, `write_failed`, `import_rejected`, `transaction_failed`, and `database_closed`.
- Missing snapshots fail with `snapshot_not_found`.
- Corrupt snapshot JSON fails with `snapshot_json_invalid`.
- Parsed JSON that is not valid AppData fails with `snapshot_validation_failed`; the repository must not silently return `emptyData`.
- A stored `repository_schema_version` mismatch fails with `repository_schema_mismatch`.
- Failed writes/imports must not leave partial snapshots or point `latest_snapshot_id` at missing/failed data.
- `close()` is idempotent; repository operations after close fail with `database_closed`.

This layer must not be used by the frontend runtime until a separate server/repository migration task defines that data flow and its recovery path.

## Local Persistence

Owner files:

- `src/storage/persistence.ts`
- `src/storage/backup.ts`
- `src/models/training-model.ts`
- `src/models/training-data.schema.json`
- `src/models/training-program.schema.json`
- `src/data/appConfig.ts`

Primary runtime model:

- `AppData`

Primary persisted fields:

- `schemaVersion`
- `templates`
- `history`
- `bodyWeights`
- `activeSession`
- `selectedTemplateId`
- `trainingMode`
- `unitSettings`
- `todayStatus`
- `userProfile`
- `screeningProfile`
- `programTemplate`
- `mesocyclePlan`
- `programAdjustmentDrafts`
- `programAdjustmentHistory`
- `activeProgramTemplateId`
- `healthMetricSamples`
- `importedWorkoutSamples`
- `healthImportBatches`
- `settings`

Persistence behavior:

- `loadData()` reads split localStorage keys when present.
- Legacy monolithic storage is migrated and sanitized.
- `saveData(data)` sanitizes before writing.
- App data is validated with `training-data.schema.json`.
- Program template data is validated with `training-program.schema.json`.

## Backup Import/Export Contract

Owner file:

- `src/storage/backup.ts`

Export:

- Function: `exportAppData(data: AppData)`
- Output: JSON string of sanitized `AppData`.
- Filename helper: `ironpath-backup-YYYY-MM-DD.json`.

Import:

- Function: `importAppData(jsonText: string)`
- Input: JSON text chosen by the user.
- Output:
  - `{ ok: true, data: AppData }`
  - `{ ok: false, error: string }`
- Import must sanitize and validate before replacing current data.
- Restore must be gated by confirmation in UI because it overwrites current local data.

## Health Data Import Contract

Owner files:

- `src/features/HealthDataPanel.tsx`
- `src/engines/healthImportEngine.ts`
- `src/engines/appleHealthXmlImportEngine.ts`
- `src/engines/healthSummaryEngine.ts`
- `src/storage/persistence.ts`

Current input sources:

- Manual `.csv`
- Manual `.json`
- Manual Apple Health `export.xml`

Supported sample types:

- `sleep_duration`
- `resting_heart_rate`
- `hrv`
- `heart_rate`
- `steps`
- `active_energy`
- `exercise_minutes`
- `body_weight`
- `body_fat`
- `vo2max`
- `workout`

Boundary:

- Web/PWA cannot read HealthKit directly.
- Imported Apple Watch workouts remain external activities.
- External workouts do not become IronPath strength `TrainingSession` records.
- Health data supports readiness, recovery context, activity load explanation, and calendar background only.
- Health data is not a medical diagnostic source.

## Program Adjustment Contract

Owner files:

- `src/engines/programAdjustmentEngine.ts`
- `src/engines/adjustmentReviewEngine.ts`
- `src/engines/weeklyCoachActionEngine.ts`
- `src/engines/explainability/adjustmentExplainability.ts`
- `src/models/training-model.ts`

Key fields:

- `ProgramAdjustmentDraft.id`
- `createdAt`
- `status`
- `sourceProgramTemplateId`
- `experimentalProgramTemplateId`
- `sourceTemplateSnapshotHash`
- `sourceTemplateUpdatedAt`
- `title`
- `summary`
- `selectedRecommendationIds`
- `changes`
- `confidence`
- `notes`
- `ProgramAdjustmentHistoryItem.rollbackAvailable`
- `rolledBackAt`
- `sourceProgramSnapshot`
- `effectReview`

Workflow contract:

1. Generate recommendations and explain reason/impact.
2. Create a draft.
3. Preview before/after diff.
4. Confirm.
5. Apply by copying into an experimental template.
6. Preserve the source template.
7. Allow rollback by switching the active template back.
8. Do not delete completed workout history during rollback.

## Future Backend Rules

If a backend is introduced later:

- Add endpoint names, methods, request fields, response fields, error states, auth requirements, and migration plan here before implementation.
- Keep local-first fallback behavior explicit.
- Do not replace backup/export until cloud sync has a tested recovery path.
- Do not add secrets to `.env.example`; document variable names only.
