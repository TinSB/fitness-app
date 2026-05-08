# IronPath API Contract

Last updated: 2026-05-08

## Current Contract Status

There is no deployed backend API, auth service, remote sync, SQLite repository, or server persistence in the current IronPath frontend.

A read-only API skeleton exists under `apps/api/src/readMirror.ts` for parity testing and future backend extraction. A pure session mutation skeleton exists under `apps/api/src/sessionMutation.ts` for pre-backend write-boundary parity. Neither skeleton is wired into `App.tsx`, the UI, localStorage, or any runtime server.

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
