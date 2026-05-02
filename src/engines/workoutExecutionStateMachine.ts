import type { ActualSetDraft, LoadFeedbackValue, SupportSkipReason, TrainingSession, TrainingSetLog, WeightUnit } from '../models/training-model';
import {
  adjustFocusSetValue,
  applySuggestedFocusStep,
  completeFocusSet,
  copyPreviousFocusActualDraft,
  endFocusRest,
  getCurrentFocusStep,
  getFocusNavigationState,
  skipFocusSupportBlock,
  skipFocusSupportStep,
  switchFocusExercise,
  updateFocusActualDraft,
} from './focusModeStateEngine';
import { applyExerciseReplacement } from './replacementEngine';
import { createRestTimerState } from './restTimerEngine';
import { upsertLoadFeedback } from './loadFeedbackEngine';

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

export type WorkoutExecutionResult = {
  nextState: WorkoutExecutionState;
  updatedSession: TrainingSession;
  feedback?: string;
  warnings: string[];
};

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

  switch (event.type) {
    case 'START_SESSION':
      feedback = '训练已开始';
      break;
    case 'COMPLETE_STEP': {
      const before = getCurrentFocusStep(session);
      const result = completeFocusSet(session, event.exerciseIndex, event.completedAt, event.nowMs, event.expectedStepId, event.displayUnit || 'kg');
      if (!result) {
        warnings.push('当前步骤已经完成或已变化，未重复提交。');
        feedback = '当前组未重复记录';
      } else {
        updatedSession = result.session;
        feedback = result.sessionComplete ? '训练已完成' : before.stepType === 'warmup' ? '已完成热身组' : '已完成正式组';
      }
      break;
    }
    case 'APPLY_PRESCRIPTION':
      updatedSession = applySuggestedFocusStep(session, event.exerciseIndex);
      feedback = '已套用建议重量和次数';
      break;
    case 'ADJUST_WEIGHT':
      updatedSession = adjustFocusSetValue(session, event.exerciseIndex, 'weight', event.delta);
      feedback = '已调整重量';
      forcedState = 'editing_actual_set';
      break;
    case 'ADJUST_REPS':
      updatedSession = adjustFocusSetValue(session, event.exerciseIndex, 'reps', event.delta);
      feedback = '已调整次数';
      forcedState = 'editing_actual_set';
      break;
    case 'COPY_PREVIOUS_SET': {
      updatedSession = copyPreviousFocusActualDraft(session, event.exerciseIndex);
      if (updatedSession === session) {
        warnings.push('暂无上一组可复制。');
        feedback = '暂无上一组可复制';
      } else {
        feedback = '已复制上一组';
      }
      forcedState = 'editing_actual_set';
      break;
    }
    case 'MARK_PAIN':
      updatedSession = updateFocusActualDraft(session, event.exerciseIndex, { painFlag: event.painFlag });
      feedback = event.painFlag ? '已标记不适' : '已取消不适标记';
      forcedState = 'editing_actual_set';
      break;
    case 'SET_TECHNIQUE_QUALITY':
      updatedSession = updateFocusActualDraft(session, event.exerciseIndex, { techniqueQuality: event.techniqueQuality });
      feedback = '已更新动作质量';
      forcedState = 'editing_actual_set';
      break;
    case 'OPEN_REPLACEMENT':
      feedback = '请选择替代动作';
      forcedState = 'choosing_replacement';
      break;
    case 'APPLY_REPLACEMENT':
      updatedSession = switchFocusExercise(applyExerciseReplacement(session, event.exerciseIndex, event.replacementId), event.exerciseIndex);
      if (updatedSession === session) {
        warnings.push('该替代动作未在动作库中，暂不能应用。');
        feedback = '替代动作未应用';
      } else {
        feedback = '已替换动作';
      }
      break;
    case 'SKIP_STEP':
      updatedSession = skipFocusSupportStep(session, event.reason || 'time', event.expectedStepId);
      feedback = updatedSession === session ? '当前步骤不能跳过' : '已跳过当前步骤';
      break;
    case 'SKIP_BLOCK':
      updatedSession = skipFocusSupportBlock(session, event.blockType, event.reason || 'time');
      feedback = event.blockType === 'correction' ? '已跳过纠偏模块' : '已跳过功能补丁';
      break;
    case 'START_REST':
      updatedSession = {
        ...session,
        restTimerState: createRestTimerState(event.exerciseId, event.setIndex, event.durationSec, event.nowMs, event.label),
      };
      feedback = '休息计时已开始';
      forcedState = 'resting';
      break;
    case 'END_REST':
      {
        const result = endFocusRest(session);
        updatedSession = result.session;
        feedback = result.feedback;
      }
      break;
    case 'FINISH_SESSION':
      forcedState = 'completed';
      feedback = '训练已完成';
      break;
    case 'ABANDON_SESSION':
      forcedState = 'abandoned_confirm';
      feedback = '请确认是否放弃训练';
      break;
    default:
      event satisfies never;
  }

  return {
    nextState: forcedState || stateForSession(updatedSession),
    updatedSession,
    feedback,
    warnings,
  };
};

export const buildActualDraftUpdate = (updates: Partial<ActualSetDraft>) => updates;
