# Engine Pipeline Stabilization V1

This document describes the current IronPath engine execution order and data boundaries. It does not add training features or change training algorithms.

## Goals

1. Build one `TrainingDecisionContext` before recommendation, automation, and presentation code.
2. Separate `normalHistory` from `testExcludedHistory` at the context layer.
3. Route CoachAction, ProgramAdjustmentDraft, SessionPatch, and other executable suggestions through stable identity and visible filtering.
4. Keep Today and Plan from rebuilding stale engine inputs locally.

## Execution Order

1. `sanitize / migration`
   - Input: persisted local data.
   - Output: schema-compatible `AppData`.
   - Boundary: data cleanup only, no recommendation logic.
2. `buildTrainingDecisionContext`
   - Input: `AppData` and local date.
   - Output: active session, normal history, test/excluded history, active template, unit settings, health summary, readiness, pain patterns, load feedback, and training level.
   - Boundary: aggregates inputs, does not mutate `AppData`.
3. `todayState`
   - Input: context active session/history/date/template.
   - Output: `not_started`, `in_progress`, or `completed`.
   - Boundary: completed state cannot be overridden by selected template UI state.
4. `workoutCycle / nextWorkout`
   - Input: context, today state, and program template order.
   - Output: planned next workout plus explained recovery override when applicable.
   - Boundary: recovery logic may override only with a reason.
5. `dailyTrainingAdjustment`
   - Input: readiness, health summary, normal recent history, pain patterns, load feedback, training level, and active template.
   - Output: temporary daily adjustment advice.
   - Boundary: advice only, no automatic plan overwrite.
6. `coachAction generation`
   - Input: DataHealth, DailyAdjustment, NextWorkout, Training Intelligence, and recovery advice.
   - Output: `CoachAction[]`.
   - Boundary: no direct app-data mutation.
7. `coachAction filtering`
   - Input: CoachActions, dismissed actions, adjustment drafts, and adjustment history.
   - Output: visible CoachActions.
   - Boundary: dismissed only hides for the day; draft/applied states prevent duplicate pending advice; rolled back does not permanently suppress still-valid advice.
8. `presenter view model`
   - Input: pipeline output.
   - Output: Today/Plan/Record/My view models.
   - Boundary: no raw enum, `undefined`, `null`, or internal ids in user text.

## Adoption Status

- `TodayView` consumes `buildEnginePipeline` for context, today state, next workout, data health, daily adjustment, and visible CoachActions. It no longer uses `CoachAutomationSummary.nextWorkout` as a fallback that can override scheduler output.
- `PlanView` consumes pipeline-filtered CoachActions and passes only those actions to `planPresenter` / `planAdviceAggregator`. It does not map raw CoachActions or raw volume adaptations directly.
- `startSession` builds its session context from the explicit template being started, so an active experimental template or selected recommendation is written into `programTemplateId` / `isExperimentalTemplate` by `sessionBuilder` without using stale selected-template state.
- `RecordView` and `ProfileView` remain display/data-management surfaces. They may build local summaries for their own panels, but they do not regenerate Today/Plan coaching recommendations.

## Derived Invalidation

`derivedStateInvalidationEngine` defines which derived surfaces need a refresh after mutations:

- Completing a session invalidates Today, Record, Analytics, and CoachActions.
- Editing, deleting, or changing the data flag of history invalidates Record, Analytics, and CoachActions.
- Applying or rolling back an experimental template invalidates Today, Plan, and CoachActions.
- Dismissing a CoachAction invalidates Today, Plan, and CoachActions.
- Importing health data invalidates readiness, Today, and CoachActions.
- Changing units invalidates display-oriented surfaces while internal kg values remain unchanged.
- Applying a replacement invalidates session records, analytics, and related CoachActions.
- Restoring/importing backup data invalidates all major derived surfaces.

## Non-Goals

- Do not change e1RM, effectiveSet, readiness, progression, or warmupPolicy core principles.
- Do not automatically overwrite training plans.
- Do not delete history or old drafts.
- Do not add pages, backend, cloud sync, or nutrition modules.
