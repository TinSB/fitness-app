# IronPath API Contract

Last updated: 2026-04-28

## Current Contract Status

There is no backend API, auth service, remote sync, or server persistence in the current IronPath frontend.

All product data is stored in the user's current browser through `localStorage`, with import/export handled as local JSON files. Future agents must not assume any backend endpoint or remote field exists unless this file is updated first.

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

