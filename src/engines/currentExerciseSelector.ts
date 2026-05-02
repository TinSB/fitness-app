import type { ExercisePrescription, TrainingSession } from '../models/training-model';
import { hasInvalidExerciseIdentity } from './replacementEngine';

export type ExerciseStepLike = {
  exerciseId?: string;
  exerciseIndex?: number;
};

export type CurrentExerciseIdentity = {
  originalExerciseId: string;
  actualExerciseId: string;
  displayExerciseId: string;
  recordExerciseId: string;
  isReplacement: boolean;
};

const text = (value: unknown) => String(value || '').trim();

const findExerciseForStep = (step: ExerciseStepLike | null | undefined, session: TrainingSession) => {
  const exercises = session.exercises || [];
  if (typeof step?.exerciseIndex === 'number' && step.exerciseIndex >= 0 && exercises[step.exerciseIndex]) {
    return exercises[step.exerciseIndex];
  }
  const stepExerciseId = text(step?.exerciseId);
  if (!stepExerciseId) return null;
  return (
    exercises.find(
      (exercise) =>
        exercise.id === stepExerciseId ||
        exercise.baseId === stepExerciseId ||
        exercise.canonicalExerciseId === stepExerciseId ||
        exercise.originalExerciseId === stepExerciseId ||
        exercise.actualExerciseId === stepExerciseId ||
        exercise.replacementExerciseId === stepExerciseId ||
        exercise.replacedFromId === stepExerciseId,
    ) || null
  );
};

export const getExerciseIdentityFromExercise = (
  exercise: Partial<ExercisePrescription> | null | undefined,
  plannedExerciseId?: string,
): CurrentExerciseIdentity => {
  const plannedId = text(plannedExerciseId);
  const identityInvalid = hasInvalidExerciseIdentity(exercise);
  const originalExerciseId =
    text(exercise?.originalExerciseId) ||
    text(exercise?.replacedFromId) ||
    text(exercise?.baseId) ||
    text(exercise?.canonicalExerciseId) ||
    text(exercise?.id) ||
    plannedId;
  const actualExerciseId = identityInvalid
    ? ''
    : text(exercise?.actualExerciseId) ||
      text(exercise?.replacementExerciseId) ||
      text(exercise?.canonicalExerciseId) ||
      text(exercise?.id) ||
      originalExerciseId ||
      plannedId;
  const displayExerciseId =
    (identityInvalid ? '' : text(exercise?.actualExerciseId) || text(exercise?.replacementExerciseId)) ||
    originalExerciseId ||
    plannedId ||
    actualExerciseId;
  const recordExerciseId = identityInvalid
    ? ''
    : text(exercise?.actualExerciseId) ||
      text(exercise?.replacementExerciseId) ||
      originalExerciseId ||
      plannedId ||
      actualExerciseId;
  const replacementId = text(exercise?.replacementExerciseId);
  const explicitActualId = text(exercise?.actualExerciseId);
  const isReplacement = Boolean(
    replacementId ||
      (explicitActualId && originalExerciseId && explicitActualId !== originalExerciseId) ||
      text(exercise?.replacedFromId) ||
      exercise?.sameTemplateSlot ||
      exercise?.prIndependent,
  );

  return {
    originalExerciseId: originalExerciseId || recordExerciseId || displayExerciseId,
    actualExerciseId: identityInvalid ? '' : actualExerciseId || recordExerciseId || displayExerciseId,
    displayExerciseId: displayExerciseId || actualExerciseId || originalExerciseId,
    recordExerciseId: identityInvalid ? '' : recordExerciseId || actualExerciseId || originalExerciseId,
    isReplacement,
  };
};

export const getCurrentExerciseIdentity = (
  step: ExerciseStepLike | null | undefined,
  session: TrainingSession,
): CurrentExerciseIdentity => {
  const exercise = findExerciseForStep(step, session);
  return getExerciseIdentityFromExercise(exercise, step?.exerciseId);
};
