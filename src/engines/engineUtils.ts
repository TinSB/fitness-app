import {
  DEFAULT_TECHNIQUE_STANDARD,
  EXERCISE_EQUIVALENCE_CHAINS,
  EXERCISE_KNOWLEDGE_OVERRIDES,
  INITIAL_TEMPLATES,
  PRESCRIPTION_SOURCES,
  SORENESS_OPTIONS,
  TRAINING_MODE_META,
} from '../data/trainingData';
import type {
  ExerciseMetadata,
  ExercisePrescription,
  ExerciseTemplate,
  TodayStatus,
  TrainingMode,
  TrainingSession,
  TrainingSetLog,
  TrainingTemplate,
} from '../models/training-model';

type ExerciseLike = Pick<ExerciseTemplate, 'id' | 'muscle' | 'kind' | 'repMin' | 'repMax' | 'rest' | 'startWeight'> &
  Partial<ExerciseMetadata> & {
    techniqueStandard?: ExerciseMetadata['techniqueStandard'];
  };

type SessionLike = Pick<TrainingSession, 'exercises'> | null | undefined;

export const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

export const todayKey = () => {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

export const monthKey = () => todayKey().slice(0, 7);

export const number = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export const safeNumber = (value: unknown, fallback = 0, min = 0, max = Number.POSITIVE_INFINITY) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return clamp(parsed, min, max);
};

export const formatDate = (date?: string) => {
  if (!date) return '';
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;
  return `${parsed.getMonth() + 1}/${parsed.getDate()}`;
};

export const formatTimer = (seconds: number) => {
  const safe = Math.max(0, seconds);
  const minutes = Math.floor(safe / 60);
  const rest = String(safe % 60).padStart(2, '0');
  return `${minutes}:${rest}`;
};

export const classNames = (...items: Array<string | false | null | undefined>) => items.filter(Boolean).join(' ');

const isTrainingSetLog = (value: unknown): value is TrainingSetLog =>
  typeof value === 'object' && value !== null && ('weight' in value || 'actualWeightKg' in value) && 'reps' in value;

export const setWeightKg = (set: Pick<TrainingSetLog, 'weight'> & Partial<Pick<TrainingSetLog, 'actualWeightKg'>>) =>
  number(set.actualWeightKg ?? set.weight);

export const completedSets = (exercise: Pick<ExercisePrescription, 'sets'> | { sets?: TrainingSetLog[] | number }): TrainingSetLog[] => {
  if (!Array.isArray(exercise?.sets)) return [];
  return exercise.sets.filter(
    (set): set is TrainingSetLog =>
      isTrainingSetLog(set) && set.done !== false && setWeightKg(set) > 0 && number(set.reps) > 0,
  );
};

export const setVolume = (set: Pick<TrainingSetLog, 'weight' | 'reps'> & Partial<Pick<TrainingSetLog, 'actualWeightKg'>>) =>
  setWeightKg(set) * number(set.reps);

export const exerciseVolume = (exercise: Pick<ExercisePrescription, 'sets'> | { sets?: TrainingSetLog[] | number }) =>
  completedSets(exercise).reduce((sum, set) => sum + setVolume(set), 0);

export const sessionVolume = (session: SessionLike) => (session?.exercises || []).reduce((sum, exercise) => sum + exerciseVolume(exercise), 0);

export const sessionCompletedSets = (session: SessionLike) =>
  (session?.exercises || []).reduce((sum, exercise) => sum + completedSets(exercise).length, 0);

export const repsText = (sets: Pick<TrainingSetLog, 'reps'>[]) => sets.map((set) => number(set.reps)).join('/');
export const weightText = (weight: unknown) => `${number(weight)}kg`;

export const canonicalTrainingMode = (mode: TrainingMode | string | unknown): TrainingMode => {
  const text = String(mode || '').trim();
  const normalized = text.toLowerCase().replace(/[\s-]+/g, '_');
  if (text === '增肌' || text === '肌肥大' || normalized === 'hypertrophy' || normalized === 'muscle_gain' || normalized === 'musclegrowth' || normalized === 'muscle_growth') return 'hypertrophy';
  if (text === '力量' || normalized === 'strength') return 'strength';
  if (text === '综合' || normalized === 'hybrid') return 'hybrid';
  return 'hybrid';
};

export const resolveMode = (mode: TrainingMode | string) =>
  TRAINING_MODE_META[canonicalTrainingMode(mode)] || TRAINING_MODE_META.hybrid;

export const findTemplate = (templates: TrainingTemplate[] = [], id: string) => templates.find((template) => template.id === id) || templates[0];

export function buildExerciseMetadata(exercise: ExerciseLike): ExerciseMetadata {
  const override = EXERCISE_KNOWLEDGE_OVERRIDES[exercise.id] || {};
  const equivalence = EXERCISE_EQUIVALENCE_CHAINS[exercise.id];
  const bigMuscle = ['胸', '背', '腿'].includes(exercise.muscle);
  const compound = exercise.kind === 'compound' || exercise.kind === 'machine';
  const fatigueCost = (override.fatigueCost as ExerciseMetadata['fatigueCost']) || (compound ? 'medium' : 'low');
  const parsedProgressionUnit = Number(String((override.progressionUnit || exercise.progressionUnit || '') as string).replace(/[^0-9.]/g, ''));
  const progressionUnitKg =
    number(override.progressionUnitKg) ||
    number(exercise.progressionUnitKg) ||
    (Number.isFinite(parsedProgressionUnit) && parsedProgressionUnit > 0 ? parsedProgressionUnit : 0) ||
    (exercise.startWeight >= 40 || bigMuscle ? 2.5 : 1);
  const progressionPercent: [number, number] = bigMuscle ? [5, 10] : [2, 5];
  const defaultLoadRange = compound ? '约 65%-85% 1RM' : '约 50%-75% 1RM';

  return {
    movementPattern: (override.movementPattern as string | undefined) || exercise.muscle,
    primaryMuscles: (override.primaryMuscles as string[] | undefined) || [exercise.muscle],
    secondaryMuscles: (override.secondaryMuscles as string[] | undefined) || [],
    muscleContribution: (override.muscleContribution as Record<string, number> | undefined) || undefined,
    goalBias: (override.goalBias as string[] | undefined) || (compound ? ['力量', '肌肥大'] : ['肌肥大']),
    recommendedLoadRange: (override.recommendedLoadRange as string | undefined) || defaultLoadRange,
    recommendedRepRange: (override.recommendedRepRange as [number, number] | undefined) || [exercise.repMin, exercise.repMax],
    recommendedRestSec: (override.recommendedRestSec as [number, number] | undefined) || [Math.max(45, exercise.rest - 30), exercise.rest],
    orderPriority: (override.orderPriority as number | undefined) || (compound ? 3 : 6),
    fatigueCost,
    skillDemand: (override.skillDemand as ExerciseMetadata['skillDemand']) || (compound ? 'medium' : 'low'),
    romPriority: (override.romPriority as string | undefined) || 'high',
    highFrequencyOk: (override.highFrequencyOk as boolean | undefined) ?? fatigueCost !== 'high',
    progressionUnit: `${progressionUnitKg}kg`,
    progressionUnitKg,
    progressionPercent,
    targetRir: (override.targetRir as [number, number] | undefined) || (compound ? [1, 3] : [1, 2]),
    evidenceTags: PRESCRIPTION_SOURCES,
    equivalenceChainId: (override.equivalenceChainId as string | undefined) || equivalence?.id || exercise.id,
    canonicalExerciseId: (override.canonicalExerciseId as string | undefined) || exercise.id,
    equivalence:
      equivalence || {
        label: (override.movementPattern as string | undefined) || exercise.muscle,
        primaryMuscle: exercise.muscle,
        pattern: (override.movementPattern as string | undefined) || exercise.muscle,
        members: [exercise.id],
    },
    alternativeIds: (override.alternativeIds as string[] | undefined) || exercise.alternativeIds || [],
    alternativePriorities:
      (override.alternativePriorities as Record<string, string> | undefined) ||
      exercise.alternativePriorities ||
      {},
    regressionIds: (override.regressionIds as string[] | undefined) || [],
    progressionIds: (override.progressionIds as string[] | undefined) || [],
    contraindications: (override.contraindications as string[] | undefined) || [],
    techniqueStandard: {
      ...DEFAULT_TECHNIQUE_STANDARD,
      rom: compound || (override.romPriority as string | undefined) === 'high' ? '完整可控幅度' : '受控完整幅度',
      stopRule: compound ? '动作明显变形、速度明显下降或出现不适时停止该组' : '目标肌群失控或出现不适时停止该组',
      ...(exercise.techniqueStandard || {}),
    },
  };
}

export const enrichExercise = <T extends ExerciseTemplate>(exercise: T): T =>
  ({
    ...exercise,
    ...buildExerciseMetadata(exercise),
  }) as T;

export const hydrateTemplates = (templates?: TrainingTemplate[]) =>
  (templates?.length ? templates : INITIAL_TEMPLATES).map((template) => ({
    ...template,
    exercises: template.exercises.map((exercise) => enrichExercise(exercise)),
  }));

export const getPrimaryMuscles = (exercise: Pick<ExerciseTemplate, 'muscle'> & Partial<Pick<ExerciseTemplate, 'primaryMuscles'>>) =>
  exercise.primaryMuscles?.length ? exercise.primaryMuscles : [exercise.muscle].filter(Boolean);

export const getSecondaryMuscles = (exercise: Partial<Pick<ExerciseTemplate, 'secondaryMuscles'>>) => exercise.secondaryMuscles || [];

export const trainingModeOptions = Object.values(TRAINING_MODE_META);
export const sorenessOptions = [...SORENESS_OPTIONS] as TodayStatus['soreness'];
