import type { ActualSetDraft, ExercisePrescription, FocusStepType, SupportSkipReason, TrainingSession, TrainingSetLog } from '../models/training-model';
import { clone, number, sessionCompletedSets, sessionVolume } from './engineUtils';
import { createRestTimerState } from './restTimerEngine';
import { decideWarmupPolicy, getWarmupMovementPattern, type WarmupPolicyDecision } from './warmupPolicyEngine';

export type { ActualSetDraft, FocusStepType };

export type FocusNoticeTone = 'warning' | 'success' | 'info';
export type FocusBlockType = 'correction' | 'main' | 'functional';

export interface FocusNotice {
  id: string;
  type: string;
  tone: FocusNoticeTone;
  message: string;
}

export interface FocusTrainingStep {
  id: string;
  exerciseId: string;
  exerciseIndex: number;
  blockType: FocusBlockType;
  stepType: FocusStepType;
  moduleId?: string;
  moduleName?: string;
  exerciseName?: string;
  setIndex: number;
  totalSetsForStepType: number;
  label: string;
  plannedWeight?: number;
  plannedReps?: number;
  plannedRir?: number;
  plannedRestSec?: number;
  source: 'warmup' | 'working-set' | 'support-log';
  warmupPolicy?: WarmupPolicyDecision;
}

export interface FocusNavigationState {
  currentExerciseIndex: number;
  currentExercise: ExercisePrescription | null;
  currentSetIndex: number;
  currentSet: TrainingSetLog | null;
  currentStep: FocusTrainingStep;
  actualDraft: ActualSetDraft | null;
  sessionComplete: boolean;
  completedSets: number;
  totalSets: number;
  totalVolume: number;
}

const COMPLETED_STEP: FocusTrainingStep = {
  id: 'completed',
  exerciseId: '',
  exerciseIndex: -1,
  blockType: 'main',
  stepType: 'completed',
  setIndex: -1,
  totalSetsForStepType: 0,
  label: '训练完成',
  source: 'working-set',
};

const getSets = (exercise: ExercisePrescription | undefined): TrainingSetLog[] => (Array.isArray(exercise?.sets) ? exercise.sets : []);
const getWarmupSets = (exercise: ExercisePrescription | undefined) => (Array.isArray(exercise?.warmupSets) ? exercise.warmupSets : []);
const stepId = (exerciseId: string, stepType: FocusStepType, setIndex: number, suffix = '') => `main:${exerciseId}:${stepType}:${setIndex}${suffix}`;
const supportStepId = (blockType: 'correction' | 'functional', moduleId: string, exerciseId: string, setIndex: number) =>
  `${blockType}:${moduleId}:${exerciseId}:${setIndex}`;
const exerciseCompletedStepId = (exerciseId: string) => stepId(exerciseId, 'completed', 0);
const isSupportFocusStep = (step: FocusTrainingStep) => step.stepType === 'correction' || step.stepType === 'functional' || step.stepType === 'support';
const findSupportLog = (session: TrainingSession, step: FocusTrainingStep) => {
  const [legacyModuleId, legacyExerciseId] = step.exerciseId.split('::');
  const moduleId = step.moduleId || legacyModuleId;
  const exerciseId = step.moduleId ? step.exerciseId : legacyExerciseId;
  return (session.supportExerciseLogs || []).find((item) => item.moduleId === moduleId && item.exerciseId === exerciseId);
};

const isStepCompleted = (session: TrainingSession, step: FocusTrainingStep): boolean => {
  if (step.stepType === 'completed') return true;
  if (step.stepType === 'warmup') return Boolean(session.focusCompletedStepIds?.includes(step.id));
  if (step.stepType === 'working') return Boolean(getSets(session.exercises[step.exerciseIndex])?.[step.setIndex]?.done);
  if (isSupportFocusStep(step)) {
    const log = findSupportLog(session, step);
    return Boolean(log?.skippedReason) || number(log?.completedSets) > step.setIndex;
  }
  return false;
};

const buildSupportSteps = (session: TrainingSession, blockType: 'correction' | 'functional'): FocusTrainingStep[] => {
  const blocks = blockType === 'correction' ? session.correctionBlock || [] : session.functionalBlock || [];
  const steps: FocusTrainingStep[] = [];

  blocks.forEach((block) => {
    block.exercises.forEach((exercise) => {
      const log = (session.supportExerciseLogs || []).find((item) => item.moduleId === block.id && item.exerciseId === exercise.exerciseId);
      const total = Math.max(0, number(log?.plannedSets ?? exercise.sets));
      const timeSec = 'timeSec' in exercise ? exercise.timeSec : undefined;
      const distanceM = 'distanceM' in exercise ? exercise.distanceM : undefined;
      for (let setIndex = 0; setIndex < total; setIndex += 1) {
        steps.push({
          id: supportStepId(blockType, block.id, exercise.exerciseId, setIndex),
          exerciseId: exercise.exerciseId,
          exerciseIndex: -1,
          blockType,
          stepType: blockType,
          moduleId: block.id,
          moduleName: block.name,
          exerciseName: exercise.name || log?.exerciseName || exercise.exerciseId,
          setIndex,
          totalSetsForStepType: total,
          label: `${blockType === 'correction' ? '纠偏模块' : '功能补丁'} ${setIndex + 1} / ${total}`,
          plannedReps: number(exercise.repMax ?? exercise.repMin ?? exercise.holdSec ?? timeSec ?? distanceM),
          plannedRestSec: number(exercise.restSec) || 45,
          source: 'support-log',
        });
      }
    });
  });

  return steps;
};

export const buildFocusStepQueue = (session: TrainingSession | null | undefined): FocusTrainingStep[] => {
  if (!session) return [COMPLETED_STEP];
  const steps: FocusTrainingStep[] = [...buildSupportSteps(session, 'correction')];
  const previousExercises: ExercisePrescription[] = [];

  (session.exercises || []).forEach((exercise, exerciseIndex) => {
    const warmups = getWarmupSets(exercise);
    const sets = getSets(exercise);
    const warmupPolicy = decideWarmupPolicy({
      exercise,
      exerciseIndex,
      previousExercises,
      completedWarmupPatterns: session.focusCompletedWarmupPatterns || [],
      plannedWeight: number(sets[0]?.weight ?? exercise.startWeight),
    });
    if (warmupPolicy.shouldShowWarmupSets) {
    warmups.forEach((warmup, setIndex) => {
      steps.push({
        id: stepId(exercise.id, 'warmup', setIndex),
        exerciseId: exercise.id,
        exerciseIndex,
        blockType: 'main',
        stepType: 'warmup',
        setIndex,
        totalSetsForStepType: warmups.length,
        label: `热身组 ${setIndex + 1} / ${warmups.length}`,
        plannedWeight: number(warmup.weight),
        plannedReps: number(warmup.reps),
        plannedRestSec: Math.min(60, number(exercise.rest) || 60),
        source: 'warmup',
        warmupPolicy,
      });
    });
    }

    sets.forEach((set, setIndex) => {
      const isTop = set.type === 'top';
      steps.push({
        id: stepId(exercise.id, 'working', setIndex),
        exerciseId: exercise.id,
        exerciseIndex,
        blockType: 'main',
        stepType: 'working',
        setIndex,
        totalSetsForStepType: sets.length,
        label: `正式组 ${setIndex + 1} / ${sets.length}`,
        plannedWeight: number(set.weight),
        plannedReps: number(set.reps),
        plannedRir: typeof set.rir === 'number' ? set.rir : number(set.rir || exercise.targetRir?.[1] || 2),
        plannedRestSec: number(exercise.rest) || 90,
        source: isTop ? 'working-set' : 'working-set',
        warmupPolicy,
      });
    });
    previousExercises.push(exercise);
  });

  steps.push(...buildSupportSteps(session, 'functional'));

  return steps.length ? steps : [COMPLETED_STEP];
};

export const isFocusSessionComplete = (session: TrainingSession | null | undefined): boolean => {
  if (!session) return true;
  const queue = buildFocusStepQueue(session).filter((step) => step.stepType !== 'completed');
  if (!queue.length) return true;
  return queue.every((step) => isStepCompleted(session, step));
};

export const getCurrentFocusStep = (session: TrainingSession | null | undefined): FocusTrainingStep => {
  if (!session) return COMPLETED_STEP;
  const queue = buildFocusStepQueue(session);
  if (isFocusSessionComplete(session)) return COMPLETED_STEP;

  if (session.currentFocusStepId?.endsWith(':completed:0')) {
    const exerciseIndex = (session.exercises || []).findIndex((exercise) => exerciseCompletedStepId(exercise.id) === session.currentFocusStepId);
    const exercise = session.exercises[exerciseIndex];
    if (exercise) {
      const exerciseSteps = queue.filter((step) => step.exerciseIndex === exerciseIndex && step.stepType !== 'completed');
      if (exerciseSteps.length && exerciseSteps.every((step) => isStepCompleted(session, step))) {
        return {
          id: exerciseCompletedStepId(exercise.id),
          exerciseId: exercise.id,
          exerciseIndex,
          blockType: 'main',
          stepType: 'completed',
          setIndex: -1,
          totalSetsForStepType: 0,
          label: '该动作已完成',
          source: 'working-set',
        };
      }
    }
  }

  const savedIndex = queue.findIndex((step) => step.id === session.currentFocusStepId);
  const saved = savedIndex >= 0 ? queue[savedIndex] : undefined;
  const firstIncompleteIndex = queue.findIndex((step) => step.stepType !== 'completed' && !isStepCompleted(session, step));
  if (session.focusManualStepOverride && saved && !isStepCompleted(session, saved)) return saved;
  if (saved && !isStepCompleted(session, saved) && (firstIncompleteIndex < 0 || savedIndex <= firstIncompleteIndex)) return saved;

  return firstIncompleteIndex >= 0 ? queue[firstIncompleteIndex] : COMPLETED_STEP;
};

export const getNextFocusStep = (session: TrainingSession | null | undefined): FocusTrainingStep | null => {
  if (!session) return null;
  const queue = buildFocusStepQueue(session);
  const current = getCurrentFocusStep(session);
  const currentIndex = queue.findIndex((step) => step.id === current.id);
  for (let index = Math.max(0, currentIndex + 1); index < queue.length; index += 1) {
    const step = queue[index];
    if (step.stepType !== 'completed' && !isStepCompleted(session, step)) return step;
  }
  return null;
};

const getDrafts = (session: TrainingSession): ActualSetDraft[] => (Array.isArray(session.focusActualSetDrafts) ? session.focusActualSetDrafts : []);

export const getActualSetDraft = (session: TrainingSession, step: FocusTrainingStep): ActualSetDraft | null => {
  if (step.stepType === 'completed') return null;
  return getDrafts(session).find((draft) => draft.stepId === step.id) || null;
};

const upsertDraft = (session: TrainingSession, step: FocusTrainingStep, updates: Partial<ActualSetDraft>): ActualSetDraft => {
  if (step.stepType === 'completed') throw new Error('Cannot create draft for completed step');
  session.focusActualSetDrafts = Array.isArray(session.focusActualSetDrafts) ? session.focusActualSetDrafts : [];
  const existing = session.focusActualSetDrafts.find((draft) => draft.stepId === step.id);
  if (existing) {
    Object.assign(existing, updates);
    return existing;
  }
  const draft: ActualSetDraft = {
    exerciseId: step.exerciseId,
    stepId: step.id,
    stepType: step.stepType,
    setIndex: step.setIndex,
    ...updates,
  };
  session.focusActualSetDrafts.push(draft);
  return draft;
};

const setCurrentStep = (session: TrainingSession, step: FocusTrainingStep) => {
  session.currentFocusStepId = step.id;
  session.currentFocusStepType = step.stepType;
  session.currentExerciseId = step.exerciseId;
  session.currentSetIndex = step.setIndex;
  session.focusSessionComplete = step.stepType === 'completed' && step.exerciseIndex < 0;
  session.focusManualStepOverride = false;
};

const getNextIncompleteStepAfter = (session: TrainingSession, completedStepId: string): FocusTrainingStep | null => {
  const queue = buildFocusStepQueue(session);
  const completedIndex = queue.findIndex((step) => step.id === completedStepId);
  const startIndex = completedIndex >= 0 ? completedIndex + 1 : 0;
  for (let index = startIndex; index < queue.length; index += 1) {
    const step = queue[index];
    if (step.stepType !== 'completed' && !isStepCompleted(session, step)) return step;
  }
  return null;
};

const findStepForExercise = (session: TrainingSession, exerciseIndex: number): FocusTrainingStep => {
  const current = getCurrentFocusStep(session);
  if (current.exerciseIndex === exerciseIndex || current.stepType === 'support') return current;
  return (
    buildFocusStepQueue(session).find((step) => step.exerciseIndex === exerciseIndex && step.stepType !== 'completed' && !isStepCompleted(session, step)) ||
    current
  );
};

export const getNextIncompleteSetInExercise = (exercise: ExercisePrescription | undefined): number =>
  getSets(exercise).findIndex((set) => !set.done);

export const isSessionComplete = isFocusSessionComplete;

export const getNextIncompleteExercise = (session: TrainingSession, fromIndex = 0): number => {
  const steps = buildFocusStepQueue(session);
  for (const step of steps) {
    if (step.exerciseIndex >= Math.max(0, fromIndex) && step.exerciseIndex >= 0 && !isStepCompleted(session, step)) return step.exerciseIndex;
  }
  return -1;
};

const findExerciseIndexById = (session: TrainingSession, exerciseId?: string) => {
  if (!exerciseId) return -1;
  return session.exercises.findIndex((exercise) => exercise.id === exerciseId || exercise.baseId === exerciseId || exercise.canonicalExerciseId === exerciseId);
};

export const getCurrentExercise = (session: TrainingSession, preferredIndex?: number): { exercise: ExercisePrescription; index: number } | null => {
  const exercises = session.exercises || [];
  if (!exercises.length) return null;

  const step = getCurrentFocusStep(session);
  if (isSupportFocusStep(step)) return null;
  if (step.stepType === 'completed') {
    if (step.exerciseIndex >= 0 && exercises[step.exerciseIndex]) return { exercise: exercises[step.exerciseIndex], index: step.exerciseIndex };
    return null;
  }
  if (step.exerciseIndex >= 0 && exercises[step.exerciseIndex]) return { exercise: exercises[step.exerciseIndex], index: step.exerciseIndex };

  const savedIndex = findExerciseIndexById(session, session.currentExerciseId);
  if (savedIndex >= 0) return { exercise: exercises[savedIndex], index: savedIndex };

  if (typeof preferredIndex === 'number' && exercises[preferredIndex]) return { exercise: exercises[preferredIndex], index: preferredIndex };
  return { exercise: exercises[exercises.length - 1], index: exercises.length - 1 };
};

export const getCurrentSetIndex = (session: TrainingSession, exerciseIndex: number): number => {
  const step = findStepForExercise(session, exerciseIndex);
  return step.stepType === 'completed' ? -1 : step.setIndex;
};

export const getFocusNavigationState = (session: TrainingSession | null | undefined, preferredIndex?: number): FocusNavigationState => {
  if (!session) {
    return {
      currentExerciseIndex: -1,
      currentExercise: null,
      currentSetIndex: -1,
      currentSet: null,
      currentStep: COMPLETED_STEP,
      actualDraft: null,
      sessionComplete: true,
      completedSets: 0,
      totalSets: 0,
      totalVolume: 0,
    };
  }

  const step = getCurrentFocusStep(session);
  const current = isSupportFocusStep(step) || (step.stepType === 'completed' && step.exerciseIndex < 0) ? null : getCurrentExercise(session, preferredIndex);
  const sets = current ? getSets(current.exercise) : [];
  const currentSet = step.stepType === 'working' && step.setIndex >= 0 ? sets[step.setIndex] || null : null;
  const totalSets = buildFocusStepQueue(session).filter((item) => item.stepType !== 'completed').length;

  return {
    currentExerciseIndex: current?.index ?? -1,
    currentExercise: current?.exercise ?? null,
    currentSetIndex: step.stepType === 'completed' ? -1 : step.setIndex,
    currentSet,
    currentStep: step,
    actualDraft: getActualSetDraft(session, step),
    sessionComplete: isFocusSessionComplete(session),
    completedSets: sessionCompletedSets(session) + (session.focusCompletedStepIds?.length || 0),
    totalSets,
    totalVolume: sessionVolume(session),
  };
};

export const switchFocusExercise = (session: TrainingSession, exerciseIndex: number): TrainingSession => {
  const nextSession = clone(session) as TrainingSession;
  const queue = buildFocusStepQueue(nextSession);
  const step = queue.find(
    (item) => item.exerciseIndex === exerciseIndex && item.stepType !== 'completed' && !isStepCompleted(nextSession, item)
  );
  const fallback = queue.find((item) => item.exerciseIndex === exerciseIndex && item.stepType !== 'completed');
  const exercise = nextSession.exercises[exerciseIndex];
  const completedTarget: FocusTrainingStep | null =
    exercise && fallback
      ? {
          id: exerciseCompletedStepId(exercise.id),
          exerciseId: exercise.id,
          exerciseIndex,
          blockType: 'main',
          stepType: 'completed',
          setIndex: -1,
          totalSetsForStepType: 0,
          label: '该动作已完成',
          source: 'working-set',
        }
      : null;
  const target = step || completedTarget || fallback;
  if (!target) return session;
  setCurrentStep(nextSession, target);
  nextSession.focusManualStepOverride = true;
  return nextSession;
};

export const updateFocusActualDraft = (
  session: TrainingSession,
  exerciseIndex: number,
  updates: Partial<Pick<ActualSetDraft, 'actualWeightKg' | 'actualReps' | 'actualRir' | 'techniqueQuality' | 'painFlag'>>
): TrainingSession => {
  const nextSession = clone(session) as TrainingSession;
  const step = findStepForExercise(nextSession, exerciseIndex);
  if (step.stepType === 'completed') return session;
  upsertDraft(nextSession, step, updates);
  setCurrentStep(nextSession, step);
  return nextSession;
};

export const adjustFocusSetValue = (
  session: TrainingSession,
  exerciseIndex: number,
  field: 'weight' | 'reps',
  delta: number
): TrainingSession => {
  const nextSession = clone(session) as TrainingSession;
  const step = findStepForExercise(nextSession, exerciseIndex);
  if (step.stepType === 'completed') return session;
  const draft = getActualSetDraft(nextSession, step);
  if (field === 'weight') {
    upsertDraft(nextSession, step, { actualWeightKg: Math.max(0, number(draft?.actualWeightKg) + delta) });
  } else {
    upsertDraft(nextSession, step, { actualReps: Math.max(0, number(draft?.actualReps) + delta) });
  }
  setCurrentStep(nextSession, step);
  return nextSession;
};

export const applySuggestedFocusStep = (session: TrainingSession, exerciseIndex: number): TrainingSession => {
  const nextSession = clone(session) as TrainingSession;
  const step = findStepForExercise(nextSession, exerciseIndex);
  if (step.stepType === 'completed') return session;
  upsertDraft(nextSession, step, {
    ...(typeof step.plannedWeight === 'number' ? { actualWeightKg: step.plannedWeight } : {}),
    ...(typeof step.plannedReps === 'number' ? { actualReps: step.plannedReps } : {}),
    ...(typeof step.plannedRir === 'number' ? { actualRir: step.plannedRir } : {}),
  });
  setCurrentStep(nextSession, step);
  return nextSession;
};

export const copyPreviousFocusActualDraft = (session: TrainingSession, exerciseIndex: number): TrainingSession => {
  const nextSession = clone(session) as TrainingSession;
  const step = findStepForExercise(nextSession, exerciseIndex);
  if (step.stepType === 'completed' || step.setIndex <= 0) return session;
  const previousStep = buildFocusStepQueue(nextSession).find(
    (item) => item.exerciseId === step.exerciseId && item.stepType === step.stepType && item.setIndex === step.setIndex - 1
  );
  if (!previousStep) return session;
  const previousDraft = getActualSetDraft(nextSession, previousStep);
  const previousWorkingSet =
    previousStep.stepType === 'working' ? getSets(nextSession.exercises[previousStep.exerciseIndex])[previousStep.setIndex] : undefined;
  const previousWarmupSet = previousStep.stepType === 'warmup' ? nextSession.focusWarmupSetLogs?.find((set) => set.id === previousStep.id) : undefined;
  const source = previousDraft || previousWorkingSet || previousWarmupSet;
  if (!source) return session;
  const isDraft = 'actualWeightKg' in source || 'actualReps' in source || 'actualRir' in source;

  upsertDraft(nextSession, step, {
    actualWeightKg: isDraft ? (source as ActualSetDraft).actualWeightKg : (source as TrainingSetLog).weight,
    actualReps: isDraft ? (source as ActualSetDraft).actualReps : (source as TrainingSetLog).reps,
    actualRir: isDraft ? (source as ActualSetDraft).actualRir : number((source as TrainingSetLog).rir),
    painFlag: Boolean(source.painFlag),
    techniqueQuality: source.techniqueQuality || 'acceptable',
  });
  setCurrentStep(nextSession, step);
  return nextSession;
};

export interface CompleteFocusSetResult {
  session: TrainingSession;
  completedExerciseIndex: number;
  completedSetIndex: number;
  completedStep: FocusTrainingStep;
  nextStep: FocusTrainingStep | null;
  nextExerciseIndex: number;
  nextSetIndex: number;
  sessionComplete: boolean;
}

export const completeFocusSet = (
  session: TrainingSession,
  exerciseIndex: number,
  completedAt = new Date().toISOString(),
  nowMs = Date.now(),
  expectedStepId?: string
): CompleteFocusSetResult | null => {
  const nextSession = clone(session) as TrainingSession;
  const step = findStepForExercise(nextSession, exerciseIndex);
  if (expectedStepId && step.id !== expectedStepId) return null;
  if (step.stepType === 'completed' || isStepCompleted(nextSession, step)) return null;

  const draft = getActualSetDraft(nextSession, step);
  const actualWeight = number(draft?.actualWeightKg ?? (step.stepType === 'working' ? getSets(nextSession.exercises[step.exerciseIndex])[step.setIndex]?.weight : 0));
  const actualReps = number(draft?.actualReps ?? (step.stepType === 'working' ? getSets(nextSession.exercises[step.exerciseIndex])[step.setIndex]?.reps : 0));

  if (step.stepType === 'warmup') {
    nextSession.focusCompletedStepIds = Array.from(new Set([...(nextSession.focusCompletedStepIds || []), step.id]));
    nextSession.focusWarmupSetLogs = Array.isArray(nextSession.focusWarmupSetLogs) ? nextSession.focusWarmupSetLogs : [];
    nextSession.focusWarmupSetLogs = [
      ...nextSession.focusWarmupSetLogs.filter((set) => set.id !== step.id),
      {
        id: step.id,
        type: 'warmup',
        weight: actualWeight,
        reps: actualReps,
        rir: draft?.actualRir ?? '',
        rpe: '',
        done: true,
        painFlag: Boolean(draft?.painFlag),
        techniqueQuality: draft?.techniqueQuality || 'acceptable',
        completedAt,
      },
    ];
    const exercise = nextSession.exercises[step.exerciseIndex];
    const warmupSteps = buildFocusStepQueue(nextSession).filter((item) => item.exerciseId === step.exerciseId && item.stepType === 'warmup');
    if (exercise && warmupSteps.length && warmupSteps.every((item) => isStepCompleted(nextSession, item))) {
      nextSession.focusCompletedWarmupPatterns = Array.from(
        new Set([...(nextSession.focusCompletedWarmupPatterns || []), getWarmupMovementPattern(exercise)])
      );
    }
  }

  if (step.stepType === 'working') {
    const exercise = nextSession.exercises[step.exerciseIndex];
    const sets = getSets(exercise);
    const targetSet = sets[step.setIndex];
    if (!targetSet) return null;
    sets[step.setIndex] = {
      ...targetSet,
      weight: actualWeight,
      reps: actualReps,
      rir: draft?.actualRir ?? targetSet.rir,
      techniqueQuality: draft?.techniqueQuality || targetSet.techniqueQuality || 'acceptable',
      painFlag: Boolean(draft?.painFlag),
      done: true,
      completedAt,
    };
  }

  if (isSupportFocusStep(step)) {
    const log = findSupportLog(nextSession, step);
    if (!log) return null;
    log.completedSets = Math.max(number(log.completedSets), step.setIndex + 1);
    if (log.completedSets >= log.plannedSets) log.skippedReason = undefined;
  }

  nextSession.restTimerState = createRestTimerState(step.exerciseId, step.setIndex, step.plannedRestSec || 60, nowMs, step.label);
  const nextStep = getNextIncompleteStepAfter(nextSession, step.id);
  setCurrentStep(nextSession, nextStep || COMPLETED_STEP);

  return {
    session: nextSession,
    completedExerciseIndex: step.exerciseIndex,
    completedSetIndex: step.setIndex,
    completedStep: step,
    nextStep,
    nextExerciseIndex: nextStep?.exerciseIndex ?? -1,
    nextSetIndex: nextStep?.setIndex ?? -1,
    sessionComplete: !nextStep,
  };
};

export const completeFocusSupportStep = (
  session: TrainingSession,
  completedAt = new Date().toISOString(),
  nowMs = Date.now(),
  expectedStepId?: string
): CompleteFocusSetResult | null => {
  const nextSession = clone(session) as TrainingSession;
  const step = getCurrentFocusStep(nextSession);
  if (!isSupportFocusStep(step)) return null;
  if (expectedStepId && step.id !== expectedStepId) return null;
  if (isStepCompleted(nextSession, step)) return null;

  const log = findSupportLog(nextSession, step);
  if (!log) return null;
  log.completedSets = Math.max(number(log.completedSets), step.setIndex + 1);
  if (log.completedSets >= log.plannedSets) log.skippedReason = undefined;

  nextSession.restTimerState = createRestTimerState(step.exerciseId, step.setIndex, step.plannedRestSec || 45, nowMs, step.label);
  const nextStep = getNextIncompleteStepAfter(nextSession, step.id);
  setCurrentStep(nextSession, nextStep || COMPLETED_STEP);

  return {
    session: nextSession,
    completedExerciseIndex: -1,
    completedSetIndex: step.setIndex,
    completedStep: step,
    nextStep,
    nextExerciseIndex: nextStep?.exerciseIndex ?? -1,
    nextSetIndex: nextStep?.setIndex ?? -1,
    sessionComplete: !nextStep,
  };
};

export const skipFocusSupportStep = (
  session: TrainingSession,
  reason: SupportSkipReason = 'time',
  expectedStepId?: string
): TrainingSession => {
  const nextSession = clone(session) as TrainingSession;
  const step = getCurrentFocusStep(nextSession);
  if (!isSupportFocusStep(step)) return session;
  if (expectedStepId && step.id !== expectedStepId) return session;

  const log = findSupportLog(nextSession, step);
  if (!log) return session;
  log.skippedReason = reason;
  const nextStep = getNextIncompleteStepAfter(nextSession, step.id);
  setCurrentStep(nextSession, nextStep || COMPLETED_STEP);
  return nextSession;
};

export const skipFocusSupportBlock = (
  session: TrainingSession,
  blockType: 'correction' | 'functional',
  reason: SupportSkipReason = 'time'
): TrainingSession => {
  const nextSession = clone(session) as TrainingSession;
  nextSession.supportExerciseLogs = (nextSession.supportExerciseLogs || []).map((log) =>
    log.blockType === blockType && number(log.completedSets) < number(log.plannedSets)
      ? { ...log, skippedReason: reason }
      : log
  );
  const nextStep = buildFocusStepQueue(nextSession).find((step) => step.stepType !== 'completed' && !isStepCompleted(nextSession, step));
  setCurrentStep(nextSession, nextStep || COMPLETED_STEP);
  return nextSession;
};

export const dedupeFocusNotices = (notices: FocusNotice[], maxVisible = 3): FocusNotice[] => {
  const seenIds = new Set<string>();
  const seenTypes = new Set<string>();
  const seenMessages = new Set<string>();
  const result: FocusNotice[] = [];

  for (const notice of notices) {
    const message = String(notice.message || '').trim();
    if (!message) continue;
    const id = notice.id || `${notice.type}:${message}`;
    if (seenIds.has(id) || seenTypes.has(notice.type) || seenMessages.has(message)) continue;
    seenIds.add(id);
    seenTypes.add(notice.type);
    seenMessages.add(message);
    result.push({ ...notice, id, message });
    if (result.length >= maxVisible) break;
  }

  return result;
};
