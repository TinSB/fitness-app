import type { AppData, ExercisePrescription, TrainingSession, TrainingSetLog } from '../models/training-model';
import { isCompletedSet, isIncompleteSet, isLegacyCompletedSet, number } from './engineUtils';
import { reconcileScreeningProfile } from './adaptiveFeedbackEngine';
import { getExerciseIdentityFromExercise } from './currentExerciseSelector';
import { buildFocusStepQueue } from './focusModeStateEngine';
import { toLocalDateKey } from './trainingCalendarEngine';

export type IncompleteMainExerciseStatus = 'partial' | 'not_started';

export type IncompleteMainExercise = {
  exerciseIndex: number;
  exerciseId: string;
  exerciseName: string;
  status: IncompleteMainExerciseStatus;
  completedSetCount: number;
  incompleteSetCount: number;
};

export type IncompleteMainWorkGuard = {
  hasIncompleteMainWork: boolean;
  allMainWorkNotStarted: boolean;
  incompleteSetCount: number;
  incompleteExercises: IncompleteMainExercise[];
  summary: string;
};

export type FinalizeTrainingSessionOptions = {
  endedEarly?: boolean;
};

const NON_MAIN_SET_TYPES = new Set(['warmup', 'corrective', 'correction', 'functional', 'support']);

const setTypeText = (set: TrainingSetLog) =>
  String((set as TrainingSetLog & { setType?: unknown; stepType?: unknown }).setType || (set as TrainingSetLog & { stepType?: unknown }).stepType || set.type || '')
    .trim()
    .toLowerCase();

const isMainWorkingSet = (set: TrainingSetLog) => !NON_MAIN_SET_TYPES.has(setTypeText(set));

const exerciseSets = (exercise: ExercisePrescription): TrainingSetLog[] => (Array.isArray(exercise.sets) ? exercise.sets : []);

const exerciseDisplayName = (exercise: ExercisePrescription) => exercise.name || exercise.alias || exercise.actualExerciseId || exercise.id || '未命名动作';

const normalizeSetForFinalize = (set: TrainingSetLog, endedEarly?: boolean): TrainingSetLog => {
  if (isCompletedSet(set)) {
    return {
      ...set,
      done: true,
      completionStatus: isLegacyCompletedSet(set) ? 'legacy_completed' : 'completed',
    };
  }

  if (isIncompleteSet(set)) {
    const { completedAt: _completedAt, ...rest } = set;
    return {
      ...rest,
      done: false,
      completionStatus: set.done === false ? 'incomplete' : 'draft',
      incompleteReason: endedEarly ? 'ended_early' : set.incompleteReason,
    };
  }

  return set;
};

const annotateExerciseCompletion = (exercise: ExercisePrescription, endedEarly?: boolean): ExercisePrescription => {
  const sets = exerciseSets(exercise);
  const normalizedSets = sets.map((set) => normalizeSetForFinalize(set, endedEarly));
  const workingSets = normalizedSets.filter(isMainWorkingSet);
  const completedWorkingSets = workingSets.filter(isCompletedSet);
  const incompleteWorkingSets = workingSets.filter(isIncompleteSet);
  const completionStatus: ExercisePrescription['completionStatus'] | undefined = workingSets.length
    ? completedWorkingSets.length <= 0
      ? 'not_started'
      : incompleteWorkingSets.length
        ? 'partial'
        : 'completed'
    : exercise.completionStatus;

  return {
    ...exercise,
    sets: Array.isArray(exercise.sets) ? normalizedSets : exercise.sets,
    completionStatus,
    incompleteReason: endedEarly && completionStatus && completionStatus !== 'completed' ? 'ended_early' : exercise.incompleteReason,
  };
};

export const buildIncompleteMainWorkGuard = (session: TrainingSession | null | undefined): IncompleteMainWorkGuard => {
  if (!session) {
    return {
      hasIncompleteMainWork: false,
      allMainWorkNotStarted: false,
      incompleteSetCount: 0,
      incompleteExercises: [],
      summary: '',
    };
  }

  const queueIncompleteIds = new Set(
    buildFocusStepQueue(session)
      .filter((step) => step.blockType === 'main' && step.stepType === 'working')
      .filter((step) => {
        const exercise = session.exercises[step.exerciseIndex];
        const set = exerciseSets(exercise)?.[step.setIndex];
        return !set || isIncompleteSet(set);
      })
      .map((step) => `${step.exerciseIndex}:${step.setIndex}`),
  );

  const incompleteExercises = (session.exercises || []).flatMap<IncompleteMainExercise>((exercise, exerciseIndex) => {
    const workingSets = exerciseSets(exercise).filter(isMainWorkingSet);
    if (!workingSets.length) return [];
    const completedSetCount = workingSets.filter(isCompletedSet).length;
    const incompleteSetCount = workingSets.filter(isIncompleteSet).length;
    const queueIncompleteCount = [...queueIncompleteIds].filter((id) => id.startsWith(`${exerciseIndex}:`)).length;
    const totalIncomplete = Math.max(incompleteSetCount, queueIncompleteCount);
    if (completedSetCount > 0 && totalIncomplete <= 0) return [];
    const identity = getExerciseIdentityFromExercise(exercise, exercise.id);
    return [
      {
        exerciseIndex,
        exerciseId: identity.recordExerciseId || exercise.id,
        exerciseName: exerciseDisplayName(exercise),
        status: completedSetCount > 0 ? 'partial' : 'not_started',
        completedSetCount,
        incompleteSetCount: totalIncomplete,
      },
    ];
  });

  const mainExerciseCount = (session.exercises || []).filter((exercise) => exerciseSets(exercise).some(isMainWorkingSet)).length;
  const allMainWorkNotStarted = mainExerciseCount > 0 && incompleteExercises.length === mainExerciseCount && incompleteExercises.every((item) => item.completedSetCount <= 0);
  const incompleteSetCount = incompleteExercises.reduce((sum, item) => sum + item.incompleteSetCount, 0);

  return {
    hasIncompleteMainWork: incompleteExercises.length > 0,
    allMainWorkNotStarted,
    incompleteSetCount,
    incompleteExercises,
    summary: allMainWorkNotStarted
      ? '训练提前结束，主训练未完成。'
      : incompleteExercises.length
        ? '本次有效组较少，因为部分动作未完成。未完成动作不会计入有效组、总量、PR 或 e1RM。'
        : '',
  };
};

export const finalizeTrainingSession = (
  session: TrainingSession,
  finishedAt = new Date().toISOString(),
  options: FinalizeTrainingSessionOptions = {},
): TrainingSession => {
  const startedAt = session.startedAt || finishedAt;
  const exercises = (session.exercises || []).map((exercise) => {
    const identity = getExerciseIdentityFromExercise(exercise, exercise.id);
    const annotatedExercise = annotateExerciseCompletion(exercise, options.endedEarly);
    if (!identity.isReplacement) return annotatedExercise;
    return {
      ...annotatedExercise,
      ...exercise,
      sets: annotatedExercise.sets,
      completionStatus: annotatedExercise.completionStatus,
      incompleteReason: annotatedExercise.incompleteReason,
      id: identity.recordExerciseId,
      canonicalExerciseId: identity.recordExerciseId,
      originalExerciseId: identity.originalExerciseId,
      actualExerciseId: identity.recordExerciseId,
      replacementExerciseId: identity.recordExerciseId,
      sameTemplateSlot: true,
      prIndependent: true,
    };
  });
  const focusWarmupSetLogs: TrainingSetLog[] = (Array.isArray(session.focusWarmupSetLogs) ? session.focusWarmupSetLogs : []).map((set) => {
    const completed = isCompletedSet(set);
    const completionStatus: TrainingSetLog['completionStatus'] = completed ? 'completed' : 'incomplete';
    return {
      ...set,
      type: 'warmup',
      weight: Math.max(0, number(set.actualWeightKg ?? set.weight)),
      actualWeightKg: Math.max(0, number(set.actualWeightKg ?? set.weight)),
      reps: Math.max(0, number(set.reps)),
      done: completed,
      completionStatus,
      incompleteReason: isIncompleteSet(set) && options.endedEarly ? 'ended_early' : set.incompleteReason,
    };
  });
  const incompleteGuard = buildIncompleteMainWorkGuard({ ...session, exercises });

  return {
    ...session,
    date: toLocalDateKey(session.date || startedAt || finishedAt),
    startedAt,
    finishedAt,
    completed: true,
    dataFlag: session.dataFlag || 'normal',
    exercises,
    durationMin: Math.max(1, Math.round((new Date(finishedAt).getTime() - new Date(startedAt).getTime()) / 60000)),
    programTemplateId: session.programTemplateId || session.templateId,
    programTemplateName: session.programTemplateName || session.templateName,
    isExperimentalTemplate: Boolean(session.isExperimentalTemplate),
    sourceProgramTemplateId: session.sourceProgramTemplateId,
    sourceProgramTemplateName: session.sourceProgramTemplateName,
    supportExerciseLogs: Array.isArray(session.supportExerciseLogs) ? session.supportExerciseLogs : [],
    focusWarmupSetLogs,
    earlyEndReason: options.endedEarly && incompleteGuard.hasIncompleteMainWork ? 'incomplete_main_work' : session.earlyEndReason,
    earlyEndSummary: options.endedEarly && incompleteGuard.summary ? incompleteGuard.summary : session.earlyEndSummary,
  };
};

export const completeTrainingSessionIntoHistory = (
  data: AppData,
  finishedAt = new Date().toISOString(),
  options: FinalizeTrainingSessionOptions = {},
): { data: AppData; session: TrainingSession | null } => {
  if (!data.activeSession) return { data, session: null };

  const finishedBase = finalizeTrainingSession(data.activeSession, finishedAt, options);
  const provisionalHistory = [finishedBase, ...(data.history || [])].slice(0, 500);
  const nextScreening = reconcileScreeningProfile(data.screeningProfile, provisionalHistory);
  const finished: TrainingSession = {
    ...finishedBase,
    feedbackSummary: {
      painExercises: Object.entries(nextScreening.adaptiveState?.painByExercise || {})
        .filter(([, count]) => count >= 2)
        .map(([exerciseId]) => exerciseId),
      performanceDrops: nextScreening.adaptiveState?.performanceDrops || [],
      improvingIssues: (nextScreening.adaptiveState?.improvingIssues || []) as NonNullable<TrainingSession['feedbackSummary']>['improvingIssues'],
    },
  };

  return {
    session: finished,
    data: {
      ...data,
      activeSession: null,
      history: [finished, ...(data.history || [])].slice(0, 500),
      screeningProfile: nextScreening,
    },
  };
};
