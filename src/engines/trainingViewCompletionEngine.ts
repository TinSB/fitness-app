import type { TrainingSession, TrainingSetLog, WeightUnit } from '../models/training-model';
import { clone, isCompletedSet, isIncompleteSet, number } from './engineUtils';
import { buildFocusStepQueue, getCurrentFocusStep, setCurrentStep } from './focusModeStateEngine';
import { createRestTimerState } from './restTimerEngine';
import { convertKgToDisplayWeight } from './unitConversionEngine';
import type { FocusActionResult } from './workoutExecutionStateMachine';

export type CompleteTrainingViewSetInput = {
  exerciseIndex: number;
  setIndex: number;
  completedAt?: string;
  nowMs?: number;
  displayUnit?: WeightUnit;
};

export type CompleteTrainingViewSetResult = {
  session: TrainingSession;
  actionResult: FocusActionResult;
  completedExerciseIndex: number;
  completedSetIndex: number;
  nextExerciseIndex: number;
  nextSetIndex: number;
};

const successResult = (message: string, reasonCode?: FocusActionResult['reasonCode']): FocusActionResult => ({
  ok: true,
  changed: true,
  tone: 'success',
  message,
  reasonCode,
});

const infoResult = (message: string, reasonCode: NonNullable<FocusActionResult['reasonCode']>): FocusActionResult => ({
  ok: true,
  changed: false,
  tone: 'info',
  message,
  reasonCode,
});

const warningResult = (message: string, reasonCode: NonNullable<FocusActionResult['reasonCode']>): FocusActionResult => ({
  ok: false,
  changed: false,
  tone: 'warning',
  message,
  reasonCode,
});

const getSets = (session: TrainingSession, exerciseIndex: number): TrainingSetLog[] => {
  const exercise = session.exercises?.[exerciseIndex];
  return Array.isArray(exercise?.sets) ? exercise.sets : [];
};

const findNextIncompleteSetIndex = (session: TrainingSession, exerciseIndex: number) =>
  getSets(session, exerciseIndex).findIndex((set) => isIncompleteSet(set));

const findWorkingStep = (session: TrainingSession, exerciseIndex: number, setIndex: number) =>
  buildFocusStepQueue(session).find((step) => step.stepType === 'working' && step.exerciseIndex === exerciseIndex && step.setIndex === setIndex);

export const completeTrainingViewSet = (
  session: TrainingSession,
  input: CompleteTrainingViewSetInput,
): CompleteTrainingViewSetResult => {
  const { exerciseIndex, setIndex, completedAt = new Date().toISOString(), nowMs = Date.now(), displayUnit = 'kg' } = input;
  const nextSession = clone(session) as TrainingSession;
  const exercise = nextSession.exercises?.[exerciseIndex];
  const sets = getSets(nextSession, exerciseIndex);
  const targetSet = sets[setIndex];

  if (!exercise || !targetSet) {
    return {
      session,
      actionResult: warningResult('当前训练位置已更新，请重新确认后保存。', 'stale_step'),
      completedExerciseIndex: exerciseIndex,
      completedSetIndex: setIndex,
      nextExerciseIndex: -1,
      nextSetIndex: -1,
    };
  }

  if (isCompletedSet(targetSet)) {
    const nextStep = getCurrentFocusStep(nextSession);
    return {
      session,
      actionResult: infoResult('当前组未重复记录。', 'duplicate_submit'),
      completedExerciseIndex: exerciseIndex,
      completedSetIndex: setIndex,
      nextExerciseIndex: nextStep.exerciseIndex,
      nextSetIndex: nextStep.setIndex,
    };
  }

  const actualWeightKg = number(targetSet.actualWeightKg ?? targetSet.weight);
  const actualReps = number(targetSet.reps);
  if (actualWeightKg <= 0 || actualReps <= 0) {
    return {
      session,
      actionResult: warningResult('请先填写重量和次数。', 'missing_draft'),
      completedExerciseIndex: exerciseIndex,
      completedSetIndex: setIndex,
      nextExerciseIndex: exerciseIndex,
      nextSetIndex: setIndex,
    };
  }

  const completedStep = findWorkingStep(nextSession, exerciseIndex, setIndex);
  sets[setIndex] = {
    ...targetSet,
    weight: actualWeightKg,
    actualWeightKg,
    displayWeight: convertKgToDisplayWeight(actualWeightKg, displayUnit),
    displayUnit,
    reps: actualReps,
    done: true,
    completedAt,
  };

  nextSession.restTimerState = createRestTimerState(
    completedStep?.exerciseId || exercise.id,
    setIndex,
    completedStep?.plannedRestSec || number(exercise.rest) || 60,
    nowMs,
    completedStep?.label || `正式组 ${setIndex + 1}`,
  );

  const nextStep = getCurrentFocusStep(nextSession);
  setCurrentStep(nextSession, nextStep, { clearManualOverride: nextStep.exerciseIndex !== exerciseIndex });
  const nextSetIndex = nextStep.exerciseIndex >= 0 ? findNextIncompleteSetIndex(nextSession, nextStep.exerciseIndex) : -1;

  return {
    session: nextSession,
    actionResult: successResult('已完成本组。', 'completed'),
    completedExerciseIndex: exerciseIndex,
    completedSetIndex: setIndex,
    nextExerciseIndex: nextStep.exerciseIndex,
    nextSetIndex,
  };
};
