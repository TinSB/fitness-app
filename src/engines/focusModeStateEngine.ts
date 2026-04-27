import type { ExercisePrescription, TrainingSession, TrainingSetLog } from '../models/training-model';
import { clone, number, sessionCompletedSets, sessionVolume } from './engineUtils';
import { createRestTimerState } from './restTimerEngine';

export type FocusNoticeTone = 'warning' | 'success' | 'info';

export interface FocusNotice {
  id: string;
  type: string;
  tone: FocusNoticeTone;
  message: string;
}

export interface FocusNavigationState {
  currentExerciseIndex: number;
  currentExercise: ExercisePrescription | null;
  currentSetIndex: number;
  currentSet: TrainingSetLog | null;
  sessionComplete: boolean;
  completedSets: number;
  totalSets: number;
  totalVolume: number;
}

const getSets = (exercise: ExercisePrescription | undefined): TrainingSetLog[] => (Array.isArray(exercise?.sets) ? exercise.sets : []);

export const getNextIncompleteSetInExercise = (exercise: ExercisePrescription | undefined): number =>
  getSets(exercise).findIndex((set) => !set.done);

export const isSessionComplete = (session: TrainingSession | null | undefined): boolean => {
  if (!session?.exercises?.length) return true;
  return session.exercises.every((exercise) => getNextIncompleteSetInExercise(exercise) < 0);
};

export const getNextIncompleteExercise = (session: TrainingSession, fromIndex = 0): number => {
  const exercises = session.exercises || [];
  for (let index = Math.max(0, fromIndex); index < exercises.length; index += 1) {
    if (getNextIncompleteSetInExercise(exercises[index]) >= 0) return index;
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

  const savedIndex = findExerciseIndexById(session, session.currentExerciseId);
  if (savedIndex >= 0) return { exercise: exercises[savedIndex], index: savedIndex };

  if (typeof preferredIndex === 'number' && exercises[preferredIndex]) {
    return { exercise: exercises[preferredIndex], index: preferredIndex };
  }

  const nextIndex = getNextIncompleteExercise(session, 0);
  if (nextIndex >= 0) return { exercise: exercises[nextIndex], index: nextIndex };

  return { exercise: exercises[exercises.length - 1], index: exercises.length - 1 };
};

export const getCurrentSetIndex = (session: TrainingSession, exerciseIndex: number): number => {
  const exercise = session.exercises?.[exerciseIndex];
  const sets = getSets(exercise);
  if (!sets.length) return -1;

  const savedSetIndex =
    session.currentExerciseId &&
    (exercise?.id === session.currentExerciseId || exercise?.baseId === session.currentExerciseId || exercise?.canonicalExerciseId === session.currentExerciseId) &&
    typeof session.currentSetIndex === 'number'
      ? session.currentSetIndex
      : -1;

  if (savedSetIndex >= 0 && sets[savedSetIndex] && !sets[savedSetIndex].done) return savedSetIndex;
  return getNextIncompleteSetInExercise(exercise);
};

export const getFocusNavigationState = (session: TrainingSession | null | undefined, preferredIndex?: number): FocusNavigationState => {
  if (!session) {
    return {
      currentExerciseIndex: -1,
      currentExercise: null,
      currentSetIndex: -1,
      currentSet: null,
      sessionComplete: true,
      completedSets: 0,
      totalSets: 0,
      totalVolume: 0,
    };
  }

  const current = getCurrentExercise(session, preferredIndex);
  const currentSetIndex = current ? getCurrentSetIndex(session, current.index) : -1;
  const sets = current ? getSets(current.exercise) : [];
  const currentSet = currentSetIndex >= 0 ? sets[currentSetIndex] : sets[sets.length - 1] || null;
  const totalSets = session.exercises.reduce((sum, exercise) => sum + getSets(exercise).length, 0);

  return {
    currentExerciseIndex: current?.index ?? -1,
    currentExercise: current?.exercise ?? null,
    currentSetIndex,
    currentSet,
    sessionComplete: isSessionComplete(session),
    completedSets: sessionCompletedSets(session),
    totalSets,
    totalVolume: sessionVolume(session),
  };
};

export const switchFocusExercise = (session: TrainingSession, exerciseIndex: number): TrainingSession => {
  const nextSession = clone(session) as TrainingSession;
  const target = nextSession.exercises?.[exerciseIndex];
  if (!target) return session;
  nextSession.currentExerciseId = target.id;
  nextSession.currentSetIndex = getNextIncompleteSetInExercise(target);
  nextSession.focusSessionComplete = isSessionComplete(nextSession);
  return nextSession;
};

export const adjustFocusSetValue = (
  session: TrainingSession,
  exerciseIndex: number,
  field: 'weight' | 'reps',
  delta: number
): TrainingSession => {
  const nextSession = clone(session) as TrainingSession;
  const exercise = nextSession.exercises?.[exerciseIndex];
  const setIndex = getCurrentSetIndex(nextSession, exerciseIndex);
  const sets = getSets(exercise);
  const target = sets[setIndex];
  if (!exercise || !target) return session;

  const min = field === 'reps' ? 0 : 0;
  target[field] = Math.max(min, number(target[field]) + delta);
  nextSession.currentExerciseId = exercise.id;
  nextSession.currentSetIndex = setIndex;
  nextSession.focusSessionComplete = false;
  return nextSession;
};

export interface CompleteFocusSetResult {
  session: TrainingSession;
  completedExerciseIndex: number;
  completedSetIndex: number;
  nextExerciseIndex: number;
  nextSetIndex: number;
  sessionComplete: boolean;
}

export const completeFocusSet = (
  session: TrainingSession,
  exerciseIndex: number,
  completedAt = new Date().toISOString(),
  nowMs = Date.now()
): CompleteFocusSetResult | null => {
  const nextSession = clone(session) as TrainingSession;
  const exercise = nextSession.exercises?.[exerciseIndex];
  const setIndex = getCurrentSetIndex(nextSession, exerciseIndex);
  const sets = getSets(exercise);
  const targetSet = sets[setIndex];
  if (!exercise || !targetSet || targetSet.done) return null;

  sets[setIndex] = {
    ...targetSet,
    weight: number(targetSet.weight),
    reps: number(targetSet.reps),
    done: true,
    completedAt,
  };

  nextSession.restTimerState = createRestTimerState(exercise.id, setIndex, exercise.rest, nowMs, exercise.name);

  const nextSetIndexInSameExercise = getNextIncompleteSetInExercise(exercise);
  if (nextSetIndexInSameExercise >= 0) {
    const nextSet = sets[nextSetIndexInSameExercise];
    if (nextSet && !nextSet.done) {
      nextSet.weight = sets[setIndex].weight;
      nextSet.reps = sets[setIndex].reps;
      nextSet.rpe = '';
      nextSet.rir = Math.min(2, exercise.targetRir?.[1] ?? 2);
      nextSet.painFlag = false;
    }
    nextSession.currentExerciseId = exercise.id;
    nextSession.currentSetIndex = nextSetIndexInSameExercise;
    nextSession.focusSessionComplete = false;
    return {
      session: nextSession,
      completedExerciseIndex: exerciseIndex,
      completedSetIndex: setIndex,
      nextExerciseIndex: exerciseIndex,
      nextSetIndex: nextSetIndexInSameExercise,
      sessionComplete: false,
    };
  }

  const nextExerciseIndex = getNextIncompleteExercise(nextSession, exerciseIndex + 1);
  if (nextExerciseIndex >= 0) {
    const nextExercise = nextSession.exercises[nextExerciseIndex];
    const nextSetIndex = getNextIncompleteSetInExercise(nextExercise);
    nextSession.currentExerciseId = nextExercise.id;
    nextSession.currentSetIndex = nextSetIndex;
    nextSession.focusSessionComplete = false;
    return {
      session: nextSession,
      completedExerciseIndex: exerciseIndex,
      completedSetIndex: setIndex,
      nextExerciseIndex,
      nextSetIndex,
      sessionComplete: false,
    };
  }

  nextSession.currentExerciseId = exercise.id;
  nextSession.currentSetIndex = -1;
  nextSession.focusSessionComplete = true;
  return {
    session: nextSession,
    completedExerciseIndex: exerciseIndex,
    completedSetIndex: setIndex,
    nextExerciseIndex: -1,
    nextSetIndex: -1,
    sessionComplete: true,
  };
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
