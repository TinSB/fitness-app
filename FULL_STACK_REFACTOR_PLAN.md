# Full-Stack Refactor Plan

## Current Architecture Issues

IronPath is still a pure frontend PWA. `App.tsx` owns most runtime mutation, `src/storage/persistence.ts` owns localStorage, schema validation, migration, sanitize, and backup boundaries, and `src/models/training-model.ts` is the source of truth for app-wide data types.

This makes the app easy to run locally, but it also means future backend work can break Today recommendations, Focus session writes, Record summaries, backup import/export, and DataHealth repairs if contracts are not established first.

## Target Architecture

The intended long-term structure is:

```text
apps/
  web/          React + Vite frontend
  api/          Node.js + Fastify backend
packages/
  contracts/    shared TypeScript types and schema references
  core/         pure training engines and shared business logic
  db/           SQLite schema, migrations, and repository layer
```

## Core Parity & Contracts Baseline

This baseline adds the first shared package entrypoints without changing runtime behavior.

`packages/contracts/src/index.ts` re-exports shared contracts from the existing source of truth:

- `AppData`
- `TrainingSession`
- `TrainingExercise`
- `TrainingSet`
- `ProgramTemplate`
- `SessionEditHistoryEntry`
- `ProgramAdjustmentDraft`
- `PendingSessionPatch`
- `DataHealthIssue`
- `DataHealthReport`
- `FocusActionResult`
- `FocusActionReasonCode`
- `SessionMutationRequest`
- `SessionMutationResult`
- `SessionMutationResponse`
- `SessionMutationReasonCode`
- `APP_DATA_SCHEMA_VERSION`
- `appDataJsonSchema`

`packages/core/src/index.ts` re-exports stable pure engine functions from `src/engines`:

- e1RM and effective-set helpers
- session summary and effective-set explanation helpers
- unit conversion
- replacement engines
- PPL cycle and next-workout schedulers
- session history and calendar helpers
- session edit helpers
- rest timer helpers
- current exercise selector
- set anomaly detection
- pure analytics builders, excluding browser-only download behavior

## Persistence Boundary Split

Task 4.2 split the original `src/storage/persistence.ts` responsibilities while keeping it as the only compatibility facade for existing callers.

Original `persistence.ts` responsibilities were:

- AppData localStorage split-key and legacy monolith read/write
- default AppData creation
- schema version migration
- AppData sanitize and legacy compatibility
- schema validation
- support library validation
- health integration settings sanitize
- repair log sanitize
- backup import/export safety dependencies

The storage boundary is now organized as:

- `src/storage/appDataStorageUtils.ts`: pure low-level data helpers and normalization helpers.
- `src/storage/appDataValidation.ts`: Ajv setup and existing JSON schema validators.
- `src/storage/appDataMigration.ts`: pure schemaVersion and legacy raw-data migration.
- `src/storage/appDataSanitize.ts`: pure AppData sanitize/default/support-library validation boundary.
- `src/storage/localStorageAdapter.ts`: AppData localStorage read/write adapter and the only direct AppData storage I/O layer.
- `src/storage/persistence.ts`: compatibility facade that preserves existing `loadData`, `saveData`, `sanitizeData`, validators, and migration exports.

The split does not change runtime ownership:

- `App.tsx` still calls the same persistence facade.
- `saveData` still sanitizes before writing split storage keys.
- `loadData` still reads split keys first and falls back to legacy monolith storage.
- `backup.ts` still rejects unsafe imports before sanitizing.
- `packages/contracts` still re-exports the existing schema reference instead of creating a second schema.

Pure migration, sanitize, and validation boundaries are now candidates for future `packages/core` or API reuse. The localStorage adapter remains web/runtime-specific and should not move to backend code.

## API Skeleton Read Mirror

Task 4.3 adds `apps/api/src/readMirror.ts` as a read-only API skeleton for future backend extraction. It is a pure handler layer that accepts an `AppData` object, derives responses through existing contracts/core/storage helpers, and returns mirror data. It does not start a server, connect to SQLite, read localStorage, write AppData, or change the frontend runtime path.

Current read-only routes are:

- `GET /health`: service name, read-only mode, schema version, and route registry.
- `GET /app-data/summary`: AppData counts, selected template/program ids, unit settings, pending patch count, dismissed issue counts, and repair log count.
- `GET /sessions/summary`: active session mirror, history counts, analytics-included count, dataFlag counts, and latest session summary.
- `GET /history`: Record history list mirror using `getSessionCalendarDate` and `buildSessionDetailSummary`.
- `GET /history/:id`: one history session plus calendar date and detail summary.
- `GET /data-health/summary`: DataHealth report status, summary, issue count, and existing issue payload.

Boundary guarantees:

- Only `GET` routes are declared.
- Non-`GET` requests return `405` and do not mutate input data.
- Responses are derived from sanitized `AppData`, `packages/contracts`, and `packages/core` parity exports.
- Backup import/export behavior remains owned by the existing storage layer and is unchanged.
- `App.tsx`, `saveData`, `loadData`, Focus Mode, scheduler, PR/e1RM, effective-set, and template behavior are unchanged.

## Session Mutation API Baseline

Task 4.4 adds `apps/api/src/sessionMutation.ts` as the first pure write-boundary baseline. It accepts `AppData + SessionMutationRequest` and returns `SessionMutationResponse`, but it does not save data, start a server, connect to SQLite, or change frontend runtime ownership.

Current session mutation routes are:

- `POST /sessions/start`: starts an active session from the requested or selected template and consumes a matching pending session patch only after successful start.
- `POST /sessions/active/patches`: applies session-level patches to the current active session.
- `POST /sessions/active/complete`: completes the active session into history after the same incomplete-main-work confirmation boundary used by the app.
- `POST /sessions/active/discard`: discards the unsaved active session after confirmation and never writes history.

Boundary guarantees:

- Input `AppData` is deep-cloned before mutation logic runs.
- `nextData` is returned only when `result.ok === true && result.changed === true`.
- Invalid, no-op, conflict, confirmation-required, and unsupported routes never return `nextData`.
- The handler composes existing session engines instead of changing training algorithms.
- `App.tsx`, localStorage, backup import/export, Focus step mutation, record edit, DataHealth repair, scheduler, PR/e1RM, effective-set, and templates are unchanged.

## Not Done In This Baseline

This baseline intentionally does not:

- add an API runtime or server
- add Fastify
- add SQLite
- change `App.tsx` mutation logic
- change `persistence.ts` facade behavior or localStorage semantics
- move source engine files
- change `AppData` schema semantics
- change training templates
- change e1RM, PR, effective-set, readiness, progression, or warmup policy logic
- change UI behavior

## Follow-Up Tasks

### Task 4.2: Persistence Boundary Split V1

Completed: `src/storage/persistence.ts` was split into clearer layers while preserving behavior:

- schema references and validation
- migration and sanitize
- localStorage adapter
- backup import/export boundary

The split is protected by persistence boundary, facade compatibility, localStorage adapter, backup import boundary, and AppData sanitize parity tests.

### Task 4.3: API Skeleton Read Mirror V1

Completed: `apps/api/src/readMirror.ts` provides pure read-only handlers and `apps/api/src/index.ts` exports them for tests and future API wiring.

Implemented read mirror endpoints:

- `GET /health`
- `GET /app-data/summary`
- `GET /sessions/summary`
- `GET /history`
- `GET /history/:id`
- `GET /data-health/summary`

The frontend does not switch runtime data flow in this step. The skeleton proves parity against current fixtures and source engines without adding backend writes.

Task 4.3 prerequisites:

- keep `persistence.ts` as the web facade until API read mirror parity is proven
- use `appDataSanitize` / `appDataMigration` / `appDataValidation` as backend-reusable candidates
- do not import `localStorageAdapter` from backend code
- prove read endpoint outputs match current `enginePipeline`, Record, Plan, and DataHealth fixtures before changing frontend runtime data flow

### Task 4.4: Session Mutation API V1

Completed as a pure parity baseline, not a runtime migration:

- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

This task preserves frontend runtime behavior by leaving `App.tsx` and UI handlers untouched. Focus step-level backend mutation, replacement mutation, record edit, DataHealth repair, backup import/export mutation, auth, cloud sync, and SQLite remain out of scope.

## High-Risk Files

Do not start the refactor by rewriting these files:

- `src/App.tsx`
- `src/storage/persistence.ts`
- `src/models/training-model.ts`
- `src/engines/enginePipeline.ts`
- `src/engines/trainingDecisionContext.ts`
- `src/features/focus/TrainingFocusView.tsx`
- `src/features/record/RecordView.tsx`

They should only be touched after parity tests and contracts are stable.

## Required Test Gates

Every full-stack refactor stage must keep these categories green:

- typecheck
- full test suite
- production build
- real data fixture regression
- backup import/export round-trip
- schema migration compatibility
- Focus ActionResult and session mutation regressions
- Record Summary / Calendar / DataHealth trust regressions
- Today scheduler and PPL cycle boundary regressions

## Prohibited During Early Refactor

- Do not introduce a backend without endpoint contracts and parity tests.
- Do not move `AppData` ownership before backup and migration are protected.
- Do not duplicate model definitions across `src` and `packages/contracts`.
- Do not use cached summaries as source of truth.
- Do not let API work change training algorithms.
- Do not replace local backup/export before a tested recovery path exists.
