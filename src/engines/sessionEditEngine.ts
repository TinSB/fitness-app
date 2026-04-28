import type { TechniqueQuality, TrainingSession, TrainingSetLog, WeightUnit } from '../models/training-model';
import { clone, number } from './engineUtils';

export type SessionSetEditPatch = {
  weightKg?: number;
  displayWeight?: number;
  displayUnit?: WeightUnit;
  reps?: number;
  rir?: number | string;
  techniqueQuality?: TechniqueQuality;
  painFlag?: boolean;
  note?: string;
};

export type SessionEditValidationResult = {
  valid: boolean;
  errors: string[];
};

const matchesExercise = (exercise: TrainingSession['exercises'][number], exerciseId: string) =>
  exercise.id === exerciseId ||
  exercise.actualExerciseId === exerciseId ||
  exercise.replacementExerciseId === exerciseId ||
  exercise.originalExerciseId === exerciseId ||
  exercise.baseId === exerciseId;

const matchesSet = (set: TrainingSetLog, setId: string, index: number) =>
  set.id === setId || String(index) === setId || String(index + 1) === setId;

const focusWarmupExerciseId = (set: TrainingSetLog) => {
  const explicit = String((set as TrainingSetLog & { exerciseId?: unknown }).exerciseId || '').trim();
  if (explicit) return explicit;
  const match = String(set.id || '').match(/^main:([^:]+):warmup:/);
  return match?.[1] || '';
};

const applySetPatch = (set: TrainingSetLog, patch: SessionSetEditPatch): TrainingSetLog => {
  const nextSet: TrainingSetLog = { ...set };
  if (patch.weightKg !== undefined) {
    const safeWeightKg = Math.max(0, number(patch.weightKg));
    nextSet.weight = safeWeightKg;
    nextSet.actualWeightKg = safeWeightKg;
  }
  if (patch.displayWeight !== undefined) nextSet.displayWeight = Math.max(0, number(patch.displayWeight));
  if (patch.displayUnit) nextSet.displayUnit = patch.displayUnit;
  if (patch.reps !== undefined) nextSet.reps = Math.max(0, Math.round(number(patch.reps)));
  if (patch.rir !== undefined) nextSet.rir = patch.rir;
  if (patch.techniqueQuality) nextSet.techniqueQuality = patch.techniqueQuality;
  if (patch.painFlag !== undefined) nextSet.painFlag = patch.painFlag;
  if (patch.note !== undefined) nextSet.note = patch.note;
  nextSet.done = true;
  return nextSet;
};

export const updateSessionSet = (
  session: TrainingSession,
  exerciseId: string,
  setId: string,
  patch: SessionSetEditPatch,
): TrainingSession => {
  const next = clone(session);
  next.exercises = (next.exercises || []).map((exercise) => {
    if (!matchesExercise(exercise, exerciseId) || !Array.isArray(exercise.sets)) return exercise;
    return {
      ...exercise,
      sets: exercise.sets.map((set, index) => {
        if (!matchesSet(set, setId, index)) return set;
        return applySetPatch(set, patch);
      }),
    };
  });
  next.focusWarmupSetLogs = (next.focusWarmupSetLogs || []).map((set, index) => {
    const warmupExerciseId = focusWarmupExerciseId(set);
    if (warmupExerciseId !== exerciseId || !matchesSet(set, setId, index)) return set;
    return { ...applySetPatch(set, patch), type: 'warmup' };
  });
  return next;
};

export const markSessionEdited = (session: TrainingSession, fields: string[], note?: string): TrainingSession => {
  const editedAt = new Date().toISOString();
  const uniqueFields = [...new Set(fields.filter(Boolean))];
  return {
    ...session,
    editedAt,
    editHistory: [
      ...(session.editHistory || []),
      {
        editedAt,
        fields: uniqueFields,
        note,
      },
    ],
  };
};

export const validateSessionEdit = (session: TrainingSession): SessionEditValidationResult => {
  const errors: string[] = [];
  (session.exercises || []).forEach((exercise) => {
    (Array.isArray(exercise.sets) ? exercise.sets : []).forEach((set) => {
      if (number(set.actualWeightKg ?? set.weight) < 0) errors.push('weight_negative');
      if (number(set.reps) < 0) errors.push('reps_negative');
      if (set.rir !== undefined && set.rir !== '' && number(set.rir) < 0) errors.push('rir_negative');
    });
  });
  return { valid: errors.length === 0, errors };
};
