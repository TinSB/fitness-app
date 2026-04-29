# Coach Action Workflow V1

Last updated: 2026-04-29

This document defines Coach Action Workflow V1 for IronPath. It is a planning and boundary document only. V1 upgrades existing coach analysis into executable, explainable, user-confirmed actions without adding backend services or changing training algorithms.

## 1. Goals

Coach Action Workflow V1 should turn existing engine outputs into a controlled action flow:

1. System generates a coach action from existing analysis.
2. User reviews reason, impact, and risk.
3. User confirms, dismisses, or opens a preview.
4. Low-risk actions may navigate to an existing page.
5. Temporary actions may affect only the current active session.
6. Plan-level actions may generate a Program Adjustment Preview or draft.
7. Applied actions can be undone when they affect local session state or experimental plan selection.
8. Later summaries can track whether the action helped.

V1 must preserve user control. IronPath can recommend, prepare, and explain actions, but it must not silently overwrite plans, delete history, or apply high-risk training changes.

Non-goals:
- No diet module.
- No backend, login, cloud sync, or server-side jobs.
- No automatic plan overwrite.
- No automatic deletion or modification of user history.
- No automatic application of high-risk adjustments.
- No changes to e1RM, effectiveSet, readiness, progression, or warmupPolicy principles.

## 2. CoachAction Data Structure

Suggested shared contract:

```ts
type CoachActionStatus = 'pending' | 'applied' | 'dismissed' | 'expired' | 'failed';

type CoachActionRisk = 'low' | 'medium' | 'high';

type CoachActionSource =
  | 'dataHealth'
  | 'dailyTrainingAdjustment'
  | 'nextWorkoutScheduler'
  | 'setAnomaly'
  | 'smartReplacement'
  | 'sessionQuality'
  | 'plateauDetection'
  | 'volumeAdaptation'
  | 'trainingIntelligence'
  | 'recommendationTrace'
  | 'programAdjustment'
  | 'manual';

type CoachActionType =
  | 'navigate'
  | 'review_data_health'
  | 'review_session'
  | 'review_exercise'
  | 'start_next_workout'
  | 'apply_temporary_session_adjustment'
  | 'apply_recovery_override'
  | 'apply_replacement'
  | 'confirm_set_anomaly'
  | 'edit_history'
  | 'mark_data_status'
  | 'create_plan_adjustment_preview'
  | 'review_plan_adjustment_preview'
  | 'rollback_experimental_template'
  | 'dismiss'
  | 'keep_observing';

type CoachAction = {
  id: string;
  type: CoachActionType;
  status: CoachActionStatus;
  source: CoachActionSource;
  title: string;
  summary: string;
  reason: string;
  impact: string;
  risk: CoachActionRisk;
  requiresConfirmation: boolean;
  confirmationTitle?: string;
  confirmationDescription?: string;
  confirmText?: string;
  cancelText?: string;
  dismissible: boolean;
  undoable: boolean;
  expiresAt?: string;
  target:
    | { kind: 'route'; page: 'today' | 'training' | 'record' | 'plan' | 'profile'; section?: string; targetId?: string }
    | { kind: 'activeSession'; sessionId: string; exerciseId?: string; stepId?: string }
    | { kind: 'historySession'; sessionId: string; exerciseId?: string; setId?: string }
    | { kind: 'programAdjustment'; draftId?: string; sourceTemplateId?: string }
    | { kind: 'none' };
  payload?: Record<string, unknown>;
  tracking?: {
    expectedOutcome: string;
    reviewAfterSessions?: number;
    reviewAfterDate?: string;
    metrics?: Array<'completion' | 'pain' | 'loadFeedback' | 'sessionQuality' | 'volume' | 'plateau' | 'dataHealth'>;
  };
};
```

Visible fields must use Chinese text through presenters. Raw enum values, internal ids, `undefined`, and `null` must never be shown to the user.

## 3. Action Type List

Navigation and review:
- `navigate`
- `review_data_health`
- `review_session`
- `review_exercise`
- `review_plan_adjustment_preview`
- `keep_observing`

Training execution:
- `start_next_workout`
- `apply_temporary_session_adjustment`
- `apply_recovery_override`
- `apply_replacement`
- `confirm_set_anomaly`

History and data:
- `edit_history`
- `mark_data_status`

Plan workflow:
- `create_plan_adjustment_preview`
- `rollback_experimental_template`

Low-noise controls:
- `dismiss`

## 4. Action Status Flow

Core states:
- `pending`: generated and visible, no mutation has happened.
- `applied`: user confirmed and the action completed.
- `dismissed`: user ignored or dismissed it; no mutation happened.
- `expired`: action is no longer relevant because time, session, template, or target changed.
- `failed`: user confirmed but the action could not complete.

Expected transitions:
- `pending -> applied`: user confirms and executor succeeds.
- `pending -> dismissed`: user dismisses or chooses "暂不采用".
- `pending -> expired`: target session/template/date is stale.
- `pending -> failed`: target missing, validation fails, or executor rejects.
- `applied -> pending`: only through a supported undo flow that creates a new reviewable action.

No action may skip `pending` when it changes training content, history, data status, or plan state.

## 5. Actions That Only Navigate

These actions are low risk and may execute immediately, while still showing clear feedback if the target cannot be found:

- `review_data_health`: open My / 数据健康 or Record / 数据.
- `review_session`: open Record / 历史详情.
- `review_exercise`: open relevant exercise detail, session detail, or Plan template detail.
- `review_plan_adjustment_preview`: open existing Plan adjustment preview.
- `navigate`: route to a known page/section.
- `keep_observing`: show an informational note and no mutation.

Navigation actions should not require confirmation unless they reveal a destructive operation next. They must not edit data by themselves.

## 6. Actions That Can Temporarily Apply To ActiveSession

Allowed temporary session actions:
- `apply_temporary_session_adjustment`
  - reduce support/accessory emphasis for this session only.
  - mark this session as recovery-modified.
  - attach adjustment reasons to active session context.
- `apply_recovery_override`
  - record that user intentionally continued despite a recovery conflict.
  - keep original template unchanged.
- `apply_replacement`
  - use existing replacement flow.
  - preserve `originalExerciseId` and write `actualExerciseId`.
- `confirm_set_anomaly`
  - allow saving an unusual set after explicit confirmation.

Boundaries:
- Temporary actions must not modify original templates.
- Temporary actions must not alter programTemplate or mesocycle.
- Temporary actions must not add main-training volume automatically.
- Temporary actions must be traceable in the active session summary.

## 7. Actions That Can Generate Plan Adjustment Preview

Allowed preview-producing actions:
- `create_plan_adjustment_preview` from volume adaptation.
- `create_plan_adjustment_preview` from plateau findings with enough confidence.
- `create_plan_adjustment_preview` from repeated session quality issues.
- `create_plan_adjustment_preview` from repeated recovery conflict or load feedback patterns.

Rules:
- The action only creates or opens a preview/draft.
- The preview must show before/after, reason, expected impact, affected templates, and confidence.
- Applying the preview must use the existing preview / confirm / apply-by-copy / rollback workflow.
- Original templates must remain preserved.

## 8. Actions That Require Confirmation

Always require confirmation:
- Starting a suggested workout when it differs from the current plan.
- Continuing training after recovery conflict.
- Applying a temporary session adjustment.
- Applying a replacement action.
- Saving a critical set anomaly.
- Editing history.
- Marking data as test/excluded or restoring normal.
- Creating or applying a Plan Adjustment Preview.
- Rolling back an experimental template.
- Deleting any session or imported data if such action is surfaced later.

Suggested confirmation copy must include:
- what will change,
- what will not change,
- whether history/statistics are affected,
- whether the action can be undone.

## 9. Actions That Can Be Undone

Undoable in V1:
- Temporary active-session adjustment before session completion.
- Replacement before completing the affected session, through "恢复原计划" if supported.
- Dismissal, if local dismissal state is later added.
- Switching to an experimental template, through existing rollback.

Not directly undoable:
- Confirmed history edits. These should use edit history and an explicit new edit if correction is needed.
- Data status changes. Restore-normal must be a separate confirmed action.
- Confirmed set anomaly save. User can edit history later.

Undo copy must be explicit: undoing an action does not delete completed workout records unless a destructive delete flow is separately confirmed.

## 10. Actions That Need Follow-Up Tracking

Track outcome after user-confirmed actions:
- `apply_temporary_session_adjustment`
  - review session completion, pain flags, load feedback, and session quality.
- `apply_replacement`
  - review actualExerciseId history, pain feedback, load feedback, and confidence.
- `create_plan_adjustment_preview`
  - after apply, review adherence, session quality, pain signals, volume, and plateau status.
- `confirm_set_anomaly`
  - watch data health and PR/e1RM confidence for that exercise.
- `mark_data_status`
  - verify excluded/test data no longer participates in analytics.

Follow-up must be informational first. It may recommend review or rollback, but must not auto-rollback or auto-edit.

## 11. Recommended Implementation Order

P0 order:
1. Define `CoachAction`, status, target, and presenter view model contracts.
2. Add `coachActionWorkflowEngine` as a pure coordinator that converts existing engine outputs into actions.
3. Add `coachActionPresenter` to produce Chinese, surface-aware action cards.
4. Add action routing for navigation-only actions.
5. Add confirmation executor for recovery override, set anomaly confirmation, and replacement handoff.
6. Add temporary active-session adjustment executor with explicit session-only scope.
7. Add Plan Adjustment Preview handoff using the existing program adjustment workflow.

P1 order:
1. Add local action dismissal state if noise becomes a problem.
2. Add undo affordances for temporary session actions.
3. Add follow-up outcome review after applied actions.
4. Add richer Plan action grouping and comparison.
5. Add broader real-world regression fixtures.

## 12. Testing Strategy

Contract tests:
- Every action has id, type, status, source, title, reason, impact, risk, target, and confirmation flag.
- Visible text is Chinese and contains no raw enum/internal id/`undefined`/`null`.
- High-risk actions always require confirmation.
- Navigation-only actions never mutate data.

Engine tests:
- Same input produces stable action ids and ordering.
- Expired targets become `expired`, not hidden failure.
- Failed execution returns `failed` with Chinese message.
- Input `AppData` is not mutated by action generation.

Executor tests:
- Confirmed temporary session action affects only activeSession.
- Cancelled action changes nothing.
- Replacement uses real exercise ids and preserves original/actual exercise relationship.
- Set anomaly confirmation uses existing set save flow after confirmation.
- Plan preview generation does not apply the plan.

UI tests:
- Today shows only top 1-2 actions.
- Focus Mode does not interrupt logging with non-current actions.
- Record actions open existing history/data views.
- Plan actions open preview/draft, not apply.
- My/Data actions open data health or backup/settings sections.

Regression tests:
- No action changes e1RM, effectiveSet, readiness, progression, or warmupPolicy outputs.
- No action auto-deletes data.
- No action silently overwrites original templates.
- Existing Program Adjustment preview/confirm/apply-by-copy/rollback behavior remains intact.

## 13. Protected Core Algorithms

Coach Action Workflow V1 must not modify:
- e1RM calculation principles.
- effectiveSet calculation principles.
- readiness calculation principles.
- progression rules.
- warmupPolicy.
- replacementEngine save semantics.
- training template generation.
- training plan rotation logic.
- history edit validation rules.
- health import parsing logic.

The workflow may consume existing outputs from these systems and route users to existing flows, but it must not redefine their calculations.

## P0 / P1 Scope

P0:
- Shared CoachAction contract.
- Action status flow and validation.
- Surface-aware presenter.
- Navigation actions.
- Confirmation-gated active-session actions.
- Program Adjustment Preview handoff.
- No mutation during action generation.

P1:
- Persistent dismissal.
- Undo UI for temporary session adjustments.
- Follow-up outcome tracking.
- Richer action history.
- More fixture-based action regression coverage.
