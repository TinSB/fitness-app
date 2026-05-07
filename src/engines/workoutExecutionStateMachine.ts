import type { ActualSetDraft, LoadFeedbackValue, SupportSkipReason, TrainingSession, TrainingSetLog, WeightUnit } from '../models/training-model';
import {
  adjustFocusSetValue,
  applySuggestedFocusStep,
  applySuggestedFocusStepWithResult,
  completeFocusSet,
  copyPreviousFocusActualDraft,
  copyPreviousFocusActualDraftWithResult,
  endFocusRest,
  getActualSetDraft,
  getCurrentFocusStep,
  getFocusNavigationState,
  skipFocusSupportBlock,
  skipFocusSupportStep,
  switchFocusExercise,
  updateFocusActualDraft,
  updateFocusPainFlagWithResult,
} from './focusModeStateEngine';
import { applyExerciseReplacement, validateReplacementExerciseId } from './replacementEngine';
import { createRestTimerState } from './restTimerEngine';
import { upsertLoadFeedback } from './loadFeedbackEngine';
import { getExerciseIdentityFromExercise } from './currentExerciseSelector';
import { formatExerciseName } from '../i18n/formatters';
import { number } from './engineUtils';

export type WorkoutExecutionState =
  | 'idle'
  | 'active_step'
  | 'editing_actual_set'
  | 'resting'
  | 'choosing_replacement'
  | 'support_step'
  | 'completed'
  | 'abandoned_confirm';

export type WorkoutExecutionEvent =
  | { type: 'START_SESSION' }
  | { type: 'COMPLETE_STEP'; exerciseIndex: number; completedAt?: string; nowMs?: number; expectedStepId?: string; displayUnit?: WeightUnit }
  | { type: 'APPLY_PRESCRIPTION'; exerciseIndex: number }
  | { type: 'ADJUST_WEIGHT'; exerciseIndex: number; delta: number }
  | { type: 'ADJUST_REPS'; exerciseIndex: number; delta: number }
  | { type: 'COPY_PREVIOUS_SET'; exerciseIndex: number }
  | { type: 'MARK_PAIN'; exerciseIndex: number; painFlag: boolean }
  | { type: 'SET_TECHNIQUE_QUALITY'; exerciseIndex: number; techniqueQuality: NonNullable<TrainingSetLog['techniqueQuality']> }
  | { type: 'OPEN_REPLACEMENT' }
  | { type: 'APPLY_REPLACEMENT'; exerciseIndex: number; replacementId: string }
  | { type: 'SKIP_STEP'; reason?: SupportSkipReason; expectedStepId?: string }
  | { type: 'SKIP_BLOCK'; blockType: 'correction' | 'functional'; reason?: SupportSkipReason }
  | { type: 'START_REST'; exerciseId: string; setIndex: number; durationSec: number; nowMs?: number; label?: string }
  | { type: 'END_REST' }
  | { type: 'FINISH_SESSION' }
  | { type: 'ABANDON_SESSION' };

export type FocusActionReasonCode =
  | 'completed'
  | 'duplicate_submit'
  | 'stale_step'
  | 'missing_draft'
  | 'no_previous_set'
  | 'no_change'
  | 'invalid_replacement'
  | 'anomaly_cancelled'
  | 'unsupported';

export type FocusActionResult = {
  ok: boolean;
  changed: boolean;
  tone: 'success' | 'info' | 'warning' | 'error';
  message: string;
  reasonCode?: FocusActionReasonCode;
};

export type WorkoutExecutionResult = {
  nextState: WorkoutExecutionState;
  updatedSession: TrainingSession;
  feedback?: string;
  warnings: string[];
  actionResult: FocusActionResult;
};

export const focusActionResult = (result: FocusActionResult): FocusActionResult => result;

export const focusSuccessResult = (message: string, reasonCode?: FocusActionReasonCode): FocusActionResult =>
  focusActionResult({ ok: true, changed: true, tone: 'success', message, reasonCode });

export const focusInfoResult = (message: string, reasonCode: FocusActionReasonCode): FocusActionResult =>
  focusActionResult({ ok: true, changed: false, tone: 'info', message, reasonCode });

export const focusWarningResult = (message: string, reasonCode: FocusActionReasonCode): FocusActionResult =>
  focusActionResult({ ok: false, changed: false, tone: 'warning', message, reasonCode });

const stateForSession = (session: TrainingSession): WorkoutExecutionState => {
  const navigation = getFocusNavigationState(session);
  if (navigation.sessionComplete || navigation.currentStep.stepType === 'completed') return 'completed';
  if (session.restTimerState?.isRunning) return 'resting';
  if (navigation.currentStep.blockType === 'correction' || navigation.currentStep.blockType === 'functional') return 'support_step';
  return 'active_step';
};

export const dispatchWorkoutExecutionEvent = (session: TrainingSession, event: WorkoutExecutionEvent): WorkoutExecutionResult => {
  let updatedSession = session;
  const warnings: string[] = [];
  let feedback = '';
  let forcedState: WorkoutExecutionState | null = null;
  let actionResult: FocusActionResult = focusInfoResult('没有需要更新的操作。', 'unsupported');

  switch (event.type) {
    case 'START_SESSION':
      feedback = '训练已开始';
      actionResult = focusSuccessResult('训练已开始。');
      break;
    case 'COMPLETE_STEP': {
      const before = getCurrentFocusStep(session);
      if (event.expectedStepId && before.id !== event.expectedStepId) {
        warnings.push('当前训练位置已更新，请重新确认后保存。');
        feedback = '当前训练位置已更新，请重新确认后保存。';
        actionResult = focusWarningResult('当前训练位置已更新，请重新确认后保存。', 'stale_step');
        break;
      }
      const draft = getActualSetDraft(session, before);
      if (before.stepType !== 'completed' && number(draft?.actualWeightKg) <= 0 && number(draft?.actualReps) <= 0) {
        warnings.push('请先记录重量/次数，或点套用建议。');
        feedback = '请先记录重量/次数，或点套用建议。';
        actionResult = focusWarningResult('请先记录重量/次数，或点套用建议。', 'missing_draft');
        break;
      }
      const result = completeFocusSet(session, event.exerciseIndex, event.completedAt, event.nowMs, event.expectedStepId, event.displayUnit || 'kg');
      if (!result) {
        warnings.push('当前步骤已经完成或已变化，未重复提交。');
        feedback = '当前组未重复记录。';
        actionResult = focusInfoResult('当前组未重复记录。', 'duplicate_submit');
      } else {
        updatedSession = result.session;
        feedback = result.sessionComplete ? '训练已完成' : before.stepType === 'warmup' ? '已完成热身组' : '已完成正式组';
        actionResult = focusSuccessResult('已完成本组。', 'completed');
      }
      break;
    }
    case 'APPLY_PRESCRIPTION': {
      const result = applySuggestedFocusStepWithResult(session, event.exerciseIndex);
      updatedSession = result.session;
      actionResult = result.actionResult;
      feedback = actionResult.message;
      break;
    }
    case 'ADJUST_WEIGHT':
      updatedSession = adjustFocusSetValue(session, event.exerciseIndex, 'weight', event.delta);
      feedback = '已调整重量';
      actionResult = updatedSession === session ? focusInfoResult('当前记录未变化。', 'no_change') : focusSuccessResult('已调整重量。');
      forcedState = 'editing_actual_set';
      break;
    case 'ADJUST_REPS':
      updatedSession = adjustFocusSetValue(session, event.exerciseIndex, 'reps', event.delta);
      feedback = '已调整次数';
      actionResult = updatedSession === session ? focusInfoResult('当前记录未变化。', 'no_change') : focusSuccessResult('已调整次数。');
      forcedState = 'editing_actual_set';
      break;
    case 'COPY_PREVIOUS_SET': {
      const result = copyPreviousFocusActualDraftWithResult(session, event.exerciseIndex);
      updatedSession = result.session;
      actionResult = result.actionResult;
      if (!actionResult.changed) warnings.push(actionResult.message);
      feedback = actionResult.message;
      forcedState = 'editing_actual_set';
      break;
    }
    case 'MARK_PAIN': {
      const result = updateFocusPainFlagWithResult(session, event.exerciseIndex, event.painFlag);
      updatedSession = result.session;
      actionResult = result.actionResult;
      feedback = actionResult.message;
      forcedState = 'editing_actual_set';
      break;
    }
    case 'SET_TECHNIQUE_QUALITY':
      updatedSession = updateFocusActualDraft(session, event.exerciseIndex, { techniqueQuality: event.techniqueQuality });
      feedback = '已更新动作质量';
      actionResult = updatedSession === session ? focusInfoResult('当前记录未变化。', 'no_change') : focusSuccessResult('已更新动作质量。');
      forcedState = 'editing_actual_set';
      break;
    case 'OPEN_REPLACEMENT':
      feedback = '请选择替代动作';
      actionResult = focusInfoResult('请选择替代动作。', 'unsupported');
      forcedState = 'choosing_replacement';
      break;
    case 'APPLY_REPLACEMENT': {
      const exercise = session.exercises[event.exerciseIndex];
      const identity = getExerciseIdentityFromExercise(exercise, exercise?.id);
      const replacementName = formatExerciseName({ id: event.replacementId });
      if (!validateReplacementExerciseId(event.replacementId)) {
        warnings.push('该替代动作暂不可用。');
        feedback = '该替代动作暂不可用。';
        actionResult = focusWarningResult('该替代动作暂不可用。', 'invalid_replacement');
        break;
      }
      if (identity.actualExerciseId === event.replacementId || identity.recordExerciseId === event.replacementId) {
        feedback = '当前已经是该动作。';
        actionResult = focusInfoResult('当前已经是该动作。', 'no_change');
        break;
      }
      updatedSession = switchFocusExercise(applyExerciseReplacement(session, event.exerciseIndex, event.replacementId), event.exerciseIndex);
      if (updatedSession === session) {
        warnings.push('该替代动作未在动作库中，暂不能应用。');
        feedback = '该替代动作暂不可用。';
        actionResult = focusWarningResult('该替代动作暂不可用。', 'invalid_replacement');
      } else {
        feedback = `已替换为：${replacementName}。`;
        actionResult = focusSuccessResult(`已替换为：${replacementName}。`);
      }
      break;
    }
    case 'SKIP_STEP':
      updatedSession = skipFocusSupportStep(session, event.reason || 'time', event.expectedStepId);
      feedback = updatedSession === session ? '当前步骤不能跳过' : '已跳过当前步骤';
      actionResult =
        updatedSession === session
          ? focusWarningResult('当前步骤不能跳过。', 'unsupported')
          : focusSuccessResult('已跳过当前步骤。');
      break;
    case 'SKIP_BLOCK':
      updatedSession = skipFocusSupportBlock(session, event.blockType, event.reason || 'time');
      feedback = event.blockType === 'correction' ? '已跳过纠偏模块' : '已跳过功能补丁';
      actionResult = focusSuccessResult(`${feedback}。`);
      break;
    case 'START_REST':
      updatedSession = {
        ...session,
        restTimerState: createRestTimerState(event.exerciseId, event.setIndex, event.durationSec, event.nowMs, event.label),
      };
      feedback = '休息计时已开始';
      actionResult = focusSuccessResult('休息计时已开始。');
      forcedState = 'resting';
      break;
    case 'END_REST':
      {
        const result = endFocusRest(session);
        updatedSession = result.session;
        feedback = result.feedback;
        actionResult = focusSuccessResult(result.feedback);
      }
      break;
    case 'FINISH_SESSION':
      forcedState = 'completed';
      feedback = '训练已完成';
      actionResult = focusSuccessResult('训练已完成。');
      break;
    case 'ABANDON_SESSION':
      forcedState = 'abandoned_confirm';
      feedback = '请确认是否放弃训练';
      actionResult = focusInfoResult('请确认是否放弃训练。', 'unsupported');
      break;
    default:
      event satisfies never;
  }

  return {
    nextState: forcedState || stateForSession(updatedSession),
    updatedSession,
    feedback,
    warnings,
    actionResult,
  };
};

export const buildActualDraftUpdate = (updates: Partial<ActualSetDraft>) => updates;
