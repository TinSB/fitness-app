# Coach Automation V1 Plan

Last updated: 2026-04-28

This document defines Coach Automation V1 for IronPath. It is a planning document only. V1 must stay local-first, explainable, dismissible, and reversible where it touches user decisions.

## Goals

Coach Automation V1 should make IronPath feel more like a practical training coach without taking control away from the user.

V1 goals:
- Detect suspicious training and health-import data before it distorts decisions.
- Explain why the next workout recommendation differs from a previous expectation.
- Detect likely set-entry mistakes such as unit mismatch, impossible jumps, or missing reps/weight.
- Interpret existing readiness, health data, pain pattern, technique quality, load feedback, and training level into a conservative/normal daily coaching note.
- Rank better replacement choices when the user needs to substitute an exercise.
- Generate suggestions that can be ignored, dismissed, or explicitly confirmed.

Non-goals:
- No diet module.
- No backend, login, cloud sync, or server-side jobs.
- No automatic plan overwrite.
- No automatic data deletion.
- No changes to e1RM, effectiveSet, readiness, progression, or warmupPolicy core calculation principles.

## Shared Suggestion Contract

All engines should produce suggestions instead of mutations.

Suggested shape:

```ts
type CoachSuggestion = {
  id: string;
  type:
    | 'data_health'
    | 'set_anomaly'
    | 'next_workout'
    | 'daily_adjustment'
    | 'replacement'
    | 'program_review';
  severity: 'info' | 'watch' | 'important';
  title: string;
  reason: string;
  impact: string;
  recommendedAction?: string;
  sourceEngine: string;
  relatedSessionId?: string;
  relatedExerciseId?: string;
  requiresConfirmation: boolean;
  dismissible: boolean;
};
```

Rules:
- `reason`, `impact`, and `recommendedAction` must be user-facing Chinese.
- No raw enum, internal id, `undefined`, or `null` may appear in visible text.
- Suggestions are not mutations.
- A suggestion may open an existing edit, replacement, or confirmation flow.

## Engines

### 1. dataHealthEngine

Purpose:
Detect data quality problems that could make coaching, statistics, or recommendations misleading.

Inputs:
- `AppData.history`
- `AppData.activeSession`
- `healthMetricSamples`
- `importedWorkoutSamples`
- `healthImportBatches`
- `unitSettings`
- template and exercise metadata for display names

Outputs:
- `DataHealthReport`
- `CoachSuggestion[]` with type `data_health`
- Findings such as duplicate imported samples, excluded/test sessions, missing set type, impossible dates, empty completed sessions, raw id display risk, or unusually large imported batches.

Boundaries:
- Does not delete data.
- Does not change `dataFlag`.
- Does not rewrite session logs.
- Does not recalculate PR/e1RM/effectiveSet.
- Only recommends review, edit, mark as test/excluded, or restore normal.

Can auto-generate:
- "这条记录可能是测试数据，建议确认是否排除统计。"
- "这次训练完成组为空，建议检查是否误保存。"
- "导入数据较大，建议只保留需要的时间范围。"

Requires confirmation:
- Mark session as test/excluded.
- Restore a session to normal.
- Edit any historical set.
- Delete any record.

### 2. nextWorkoutScheduler

Purpose:
Choose the next suggested workout from existing plan structure and current state.

Inputs:
- Today state
- selected/current template
- program template day order
- active session
- recent normal history
- weekly prescription
- readiness summary
- training mode and primary goal

Outputs:
- `NextWorkoutRecommendation`
- Candidate list with reasons and confidence
- `CoachSuggestion[]` with type `next_workout`

Boundaries:
- Does not change `selectedTemplateId`.
- Does not change `activeProgramTemplateId`.
- Does not start a session automatically.
- Does not rewrite template order.
- Uses existing display formatters for template names.

Can auto-generate:
- "下次建议：拉 A，因为推 A 已完成且背部本周仍有训练空间。"
- "今天不建议重复同一高疲劳模板，除非你主动选择。"

Requires confirmation:
- Start suggested workout.
- Switch planned template.
- Apply any program adjustment.

### 3. setAnomalyEngine

Purpose:
Detect likely input mistakes in set logs before they contaminate downstream interpretation.

Inputs:
- Active session set drafts
- Historical session set logs
- unit settings
- exercise metadata
- previous performance snapshots
- data flag status

Outputs:
- `SetAnomalyReport`
- Per-set findings: unit mismatch, impossible jump, missing reps, zero weight on loaded exercise, extreme RIR/RPE mismatch, duplicated set, warmup recorded as working, working set missing type.
- `CoachSuggestion[]` with type `set_anomaly`

Boundaries:
- Does not edit a set.
- Does not exclude PR/e1RM by itself.
- Does not change warmup/working/support classification automatically.
- Does not block workout completion unless the existing UI already requires required fields.

Can auto-generate:
- "这组重量比上次高出很多，可能是 kg/lb 输入错误。"
- "这组没有次数，建议补充后再保存。"
- "这组像热身组，但被记录为正式组，建议检查。"

Requires confirmation:
- Apply corrected weight/reps/RIR.
- Change set type.
- Mark data as test/excluded.

### 4. dailyTrainingAdjustmentEngine

Purpose:
Turn existing readiness and training signals into a daily coaching recommendation.

Inputs:
- Today status
- readiness result
- health summary
- pain patterns
- technique quality signals
- load feedback
- training level
- recent normal history

Outputs:
- `DailyTrainingAdjustment`
- Suggested stance: normal, conservative, recovery-focused, or review-needed.
- Short reasons suitable for Today and Focus Mode.
- `CoachSuggestion[]` with type `daily_adjustment`

Boundaries:
- Does not change readiness calculation.
- Does not change progression rules.
- Does not remove exercises from the template.
- Does not automatically skip training.

Can auto-generate:
- "今天建议保守一些：准备度偏低，且近期有不适记录。"
- "今天可以按计划推进，但仍按动作质量控制强度。"

Requires confirmation:
- Start a reduced session.
- Skip a workout.
- Switch to a recovery template if such a flow exists later.

### 5. smartReplacementEngine

Purpose:
Rank replacement options with coach-style reasons while reusing the existing replacement system.

Inputs:
- Current exercise
- `replacementEngine` candidates
- pain pattern
- load feedback
- equipment availability if available
- movement pattern and muscle metadata
- current session context

Outputs:
- Ranked replacement list
- Reason and impact for each option
- `CoachSuggestion[]` with type `replacement`

Boundaries:
- Does not create synthetic exercise ids.
- Does not replace the exercise automatically.
- Does not merge PR/e1RM records between original and replacement.
- Keeps originalExerciseId / actualExerciseId relationship intact.

Can auto-generate:
- "优先选择腿举：同样训练腿部，技术复杂度更低。"
- "不建议选择同样引发不适的动作。"

Requires confirmation:
- Apply replacement.
- Save actualExerciseId into active session.

### 6. coachAutomationEngine

Purpose:
Orchestrate all automation engines and produce one deduplicated, prioritized recommendation feed.

Inputs:
- Full `AppData`
- Current route/surface context: Today, Training, Focus, Record, Plan, My
- Current session if present
- Existing recommendation trace/diff reports

Outputs:
- `CoachAutomationReport`
- Deduplicated `CoachSuggestion[]`
- Surface-specific slices:
  - Today: next workout and daily adjustment
  - Focus Mode: current action/replacement/set warnings only
  - Record: data health and edit suggestions
  - Plan: program review suggestions

Boundaries:
- Does not mutate `AppData`.
- Does not persist dismissed suggestions in V1 unless a later task explicitly adds local dismissal state.
- Does not override existing program adjustment workflow.
- Does not duplicate detailed analytics calculations.

Can auto-generate:
- Ordered, dismissible suggestions with reasons and impacts.
- A "possible issue" notice when recommendations diverge unexpectedly.

Requires confirmation:
- Any write to session history, active session, template, dataFlag, unit settings, or imported health data.

## Automatically Generated Suggestions

Allowed in V1:
- Data health warnings.
- Set-entry anomaly warnings.
- Next workout recommendation.
- Daily conservative/normal training note.
- Replacement ranking and reason.
- Suggestion to review or edit a session.
- Suggestion to mark a record as test/excluded.

Not allowed in V1:
- Automatic deletion.
- Automatic template overwrite.
- Automatic historical edit.
- Automatic PR/e1RM/effectiveSet suppression beyond existing rules.
- Automatic health data cleanup.
- Automatic cloud sync or account behavior.

## Confirmation Required

The user must confirm:
- Editing historical session records.
- Marking sessions as test/excluded or restoring normal.
- Applying a replacement.
- Starting a workout from a next-workout suggestion.
- Applying plan adjustments.
- Rolling back an experimental template.
- Deleting any record or imported data.
- Changing unit settings.

## Protected Data

Coach Automation must not directly modify:
- `history[*].exercises[*].sets`
- `activeSession`
- `templates`
- `activeProgramTemplateId`
- `programAdjustmentDrafts`
- `programAdjustmentHistory`
- `dataFlag`
- imported health samples/workouts
- body weight entries
- unit settings
- PR/e1RM/effectiveSet derived outputs

## Recommended Implementation Order

P0 order:
1. Define shared `CoachSuggestion` and report types.
2. Implement `dataHealthEngine`.
3. Implement `setAnomalyEngine`.
4. Implement a read-only `coachAutomationEngine` aggregator.
5. Add minimal Record/Today surfacing for P0 warnings.
6. Implement `dailyTrainingAdjustmentEngine` as an interpreter of existing readiness and related signals.
7. Implement `nextWorkoutScheduler` using existing plan/history/readiness boundaries.

P1 order:
1. Implement `smartReplacementEngine`.
2. Add Focus Mode replacement ranking copy.
3. Add optional local dismissal state for suggestions.
4. Add richer Plan integration with existing program adjustment workflow.

## Testing Strategy

Engine tests:
- Same input produces same suggestions.
- Test/excluded data does not drive recommendations unless the engine is explicitly reporting data health.
- Suggestions contain Chinese `title`, `reason`, and `impact`.
- No visible text contains raw enum, internal ids, `undefined`, or `null`.
- No engine mutates input data.

Fixture tests:
- Realistic user with clean history.
- User with a kg/lb-looking set entry mistake.
- User with test/excluded records.
- User with health import but no strength session.
- User with pain pattern and replacement candidates.

Integration tests:
- Today shows daily and next-workout suggestions without auto-starting.
- Focus Mode only shows current-set or replacement-relevant suggestions.
- Record shows data health issues without deleting or excluding data.
- Plan suggestions still use preview/confirm/apply-by-copy/rollback.

Regression tests:
- No change to e1RM/effectiveSet/readiness/progression/warmupPolicy outputs.
- No automatic writes to protected AppData fields.
- Existing navigation and mobile Focus Mode tests remain stable.
