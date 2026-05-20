import type { ExercisePrescription, TrainingSession, TrainingSetLog, UnitSettings } from '../models/training-model';
import { getExerciseIdentityFromExercise } from './currentExerciseSelector';
import { isCompletedSet, isIncompleteSet, number, setWeightKg } from './engineUtils';
import { resolveActionableLoadContract } from './actionableLoadContract';
import { DEFAULT_UNIT_SETTINGS, convertLbToKg, sanitizeUnitSettings } from './unitConversionEngine';

export type PostWorkoutNextTimeRecommendationKind =
  | 'no_change'
  | 'increase_load'
  | 'decrease_load'
  | 'keep_load'
  | 'reduce_reps'
  | 'increase_reps'
  | 'add_set'
  | 'reduce_set'
  | 'deload'
  | 'repeat_next_time'
  | 'technique_review'
  | 'pain_review'
  | 'insufficient_data';

export type PostWorkoutNextTimeRecommendationConfidence = 'low' | 'medium' | 'high';

export type PostWorkoutNextTimeRecommendationScope = 'exercise' | 'session';

export interface PostWorkoutNextTimeRecommendationInput {
  session: TrainingSession;
  history?: TrainingSession[];
  unitSettings?: Partial<UnitSettings>;
  nowIso?: string;
}

export interface PostWorkoutExerciseRecommendation {
  id: string;
  scope: 'exercise';
  exerciseId: string;
  exerciseName: string;
  recommendationKind: PostWorkoutNextTimeRecommendationKind;
  actionableLoadKg?: number;
  plannedReps?: number;
  setDelta?: number;
  confidence: PostWorkoutNextTimeRecommendationConfidence;
  reasonCodes: string[];
  riskFlags: string[];
  blockedReasons: string[];
  userMessage: string;
  sourceSessionId: string;
  createdAt: string;
}

export interface PostWorkoutNextTimeRecommendation {
  id: string;
  scope: 'session';
  sourceSessionId: string;
  recommendations: PostWorkoutExerciseRecommendation[];
  summary: string;
  confidence: PostWorkoutNextTimeRecommendationConfidence;
  blockedReasons: string[];
  sourceEngineIds: string[];
  createdAt: string;
}

type ExerciseAnalysis = {
  exercise: ExercisePrescription;
  exerciseId: string;
  exerciseName: string;
  workingSets: TrainingSetLog[];
  completedWorkingSets: TrainingSetLog[];
  incompleteWorkingSets: TrainingSetLog[];
  plannedWorkingSetCount: number;
  plannedReps: number;
  baselineSet?: TrainingSetLog;
  baselineLoadKg?: number;
};

type RecommendationDraft = Omit<PostWorkoutExerciseRecommendation, 'id' | 'scope' | 'sourceSessionId' | 'createdAt'>;

const ENGINE_ID = 'post-workout-next-time-recommendation-v1';
const FALLBACK_CREATED_AT = '1970-01-01T00:00:00.000Z';
const EXCLUDED_SESSION_FLAGS = new Set(['test', 'excluded']);
const NON_MAIN_SET_TYPES = new Set(['warmup', 'corrective', 'correction', 'functional', 'support']);

const text = (value: unknown) => String(value || '').trim();

const setTypeText = (set: TrainingSetLog) =>
  String((set as TrainingSetLog & { setType?: unknown; stepType?: unknown }).setType || (set as TrainingSetLog & { stepType?: unknown }).stepType || set.type || '')
    .trim()
    .toLowerCase();

const isMainWorkingSet = (set: TrainingSetLog) => !NON_MAIN_SET_TYPES.has(setTypeText(set));

const exerciseSets = (exercise: ExercisePrescription): TrainingSetLog[] => (Array.isArray(exercise.sets) ? exercise.sets : []);

const isUsableCompletedWorkingSet = (set: TrainingSetLog) => isMainWorkingSet(set) && isCompletedSet(set) && setWeightKg(set) > 0 && number(set.reps) > 0;

const parseRir = (value: unknown): number | undefined => {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const plannedRepsForExercise = (exercise: ExercisePrescription, completedWorkingSets: TrainingSetLog[]) =>
  number(exercise.repMax) || number(exercise.repMin) || number(completedWorkingSets[0]?.reps);

const configuredIncrementKg = (unitSettings: Partial<UnitSettings> | undefined): number => {
  const settings = sanitizeUnitSettings(unitSettings);
  if (settings.weightUnit === 'lb') return convertLbToKg(settings.defaultIncrementLb || DEFAULT_UNIT_SETTINGS.defaultIncrementLb);
  return settings.defaultIncrementKg || DEFAULT_UNIT_SETTINGS.defaultIncrementKg;
};

const displayNameForExercise = (exercise: ExercisePrescription, exerciseId: string) =>
  text(exercise.name) || text(exercise.alias) || text(exercise.actualExerciseId) || exerciseId;

const topCompletedSet = (sets: TrainingSetLog[]) =>
  [...sets].sort((left, right) => {
    const weightDiff = setWeightKg(right) - setWeightKg(left);
    if (weightDiff) return weightDiff;
    return number(right.reps) - number(left.reps);
  })[0];

const resolveActionableLoadKg = (
  analysis: ExerciseAnalysis,
  rawLoadKg: number | undefined,
  unitSettings: Partial<UnitSettings> | undefined,
): number | undefined => {
  if (!rawLoadKg || rawLoadKg <= 0) return undefined;
  const result = resolveActionableLoadContract({
    exerciseName: analysis.exerciseName || analysis.exerciseId,
    rawTheoreticalLoadKg: rawLoadKg,
    plannedReps: analysis.plannedReps,
    setPurpose: 'working',
    unitSettings,
    showTheoreticalDetail: true,
  });
  return result.actionableLoadKg;
};

const confidenceForRecommendations = (recommendations: PostWorkoutExerciseRecommendation[]): PostWorkoutNextTimeRecommendationConfidence => {
  if (!recommendations.length) return 'low';
  if (recommendations.some((item) => item.confidence === 'low')) return 'low';
  if (recommendations.some((item) => item.confidence === 'medium')) return 'medium';
  return 'high';
};

const buildSessionSummary = (recommendations: PostWorkoutExerciseRecommendation[]) => {
  if (!recommendations.length) return '暂无足够记录。';
  if (recommendations.some((item) => item.recommendationKind === 'pain_review')) return '下次建议：先复查。';
  if (recommendations.some((item) => item.recommendationKind === 'technique_review')) return '下次建议：先稳住。';
  if (recommendations.some((item) => item.recommendationKind === 'increase_load')) return '下次建议：小幅推进。';
  return '下次建议已生成。';
};

const analyzeExercise = (session: TrainingSession, exercise: ExercisePrescription): ExerciseAnalysis | null => {
  const identity = getExerciseIdentityFromExercise(exercise, exercise.id);
  const exerciseId = identity.recordExerciseId;
  if (!exerciseId) return null;

  const sets = exerciseSets(exercise);
  const workingSets = sets.filter(isMainWorkingSet);
  const completedWorkingSets = workingSets.filter(isUsableCompletedWorkingSet);
  if (!completedWorkingSets.length) return null;

  const incompleteWorkingSets = workingSets.filter((set) => isMainWorkingSet(set) && isIncompleteSet(set));
  const plannedWorkingSetCount = Math.max(
    typeof exercise.sets === 'number' ? number(exercise.sets) : 0,
    workingSets.length,
    completedWorkingSets.length,
  );
  const baselineSet = topCompletedSet(completedWorkingSets);
  const baselineLoadKg = baselineSet ? setWeightKg(baselineSet) : undefined;

  return {
    exercise,
    exerciseId,
    exerciseName: displayNameForExercise(exercise, exerciseId),
    workingSets,
    completedWorkingSets,
    incompleteWorkingSets,
    plannedWorkingSetCount,
    plannedReps: plannedRepsForExercise(exercise, completedWorkingSets),
    baselineSet,
    baselineLoadKg,
  };
};

const buildExerciseRecommendation = (
  session: TrainingSession,
  analysis: ExerciseAnalysis,
  input: PostWorkoutNextTimeRecommendationInput,
): PostWorkoutExerciseRecommendation => {
  const { completedWorkingSets, plannedReps } = analysis;
  const createdAt = input.nowIso ?? FALLBACK_CREATED_AT;
  const incrementKg = configuredIncrementKg(input.unitSettings);
  const reps = completedWorkingSets.map((set) => number(set.reps));
  const averageReps = reps.reduce((sum, item) => sum + item, 0) / Math.max(1, reps.length);
  const beatPlanByTwoCount = reps.filter((item) => plannedReps > 0 && item >= plannedReps + 2).length;
  const smallMiss = reps.some((item) => plannedReps > 0 && item === plannedReps - 1);
  const clearMiss = reps.some((item) => plannedReps > 0 && item <= plannedReps - 2) || (plannedReps > 0 && averageReps <= plannedReps - 1.5);
  const matchedPlan = reps.every((item) => plannedReps > 0 && Math.abs(item - plannedReps) <= 1);
  const allPlannedCompleted = analysis.plannedWorkingSetCount > 0 && completedWorkingSets.length >= analysis.plannedWorkingSetCount;
  const mostSetsBeatPlan = beatPlanByTwoCount >= Math.ceil(completedWorkingSets.length / 2);
  const hasPain = completedWorkingSets.some((set) => Boolean(set.painFlag));
  const hasPoorTechnique = completedWorkingSets.some((set) => set.techniqueQuality === 'poor');
  const nearFailureCount = completedWorkingSets.filter((set) => {
    const rir = parseRir(set.rir);
    return rir !== undefined && rir <= 0;
  }).length;
  const incompleteMainWork = Boolean(
    session.earlyEndReason === 'incomplete_main_work' ||
      analysis.incompleteWorkingSets.length ||
      analysis.exercise.completionStatus === 'partial' ||
      analysis.exercise.incompleteReason === 'ended_early',
  );

  const build = (draft: RecommendationDraft): PostWorkoutExerciseRecommendation => ({
    ...draft,
    id: `post-workout-next-time:${session.id}:${analysis.exerciseId}`,
    scope: 'exercise',
    sourceSessionId: session.id,
    createdAt,
  });

  if (hasPain) {
    return build({
      exerciseId: analysis.exerciseId,
      exerciseName: analysis.exerciseName,
      recommendationKind: 'pain_review',
      confidence: 'high',
      reasonCodes: ['pain_flag'],
      riskFlags: ['pain'],
      blockedReasons: [],
      userMessage: '有不适，先复查。',
    });
  }

  if (hasPoorTechnique) {
    return build({
      exerciseId: analysis.exerciseId,
      exerciseName: analysis.exerciseName,
      recommendationKind: 'technique_review',
      confidence: 'medium',
      reasonCodes: ['poor_technique'],
      riskFlags: ['technique_breakdown'],
      blockedReasons: [],
      userMessage: '动作质量不足，先稳住。',
    });
  }

  if (nearFailureCount >= 2) {
    return build({
      exerciseId: analysis.exerciseId,
      exerciseName: analysis.exerciseName,
      recommendationKind: 'repeat_next_time',
      actionableLoadKg: resolveActionableLoadKg(analysis, analysis.baselineLoadKg, input.unitSettings),
      plannedReps,
      confidence: 'medium',
      reasonCodes: ['near_failure'],
      riskFlags: ['near_failure'],
      blockedReasons: [],
      userMessage: '接近力竭，下次不加重。',
    });
  }

  if (incompleteMainWork) {
    return build({
      exerciseId: analysis.exerciseId,
      exerciseName: analysis.exerciseName,
      recommendationKind: 'repeat_next_time',
      actionableLoadKg: resolveActionableLoadKg(analysis, analysis.baselineLoadKg, input.unitSettings),
      plannedReps,
      confidence: 'medium',
      reasonCodes: ['ended_early', 'incomplete_main_work'],
      riskFlags: [],
      blockedReasons: [],
      userMessage: '本次未完成，下次先补齐。',
    });
  }

  if (allPlannedCompleted && mostSetsBeatPlan) {
    return build({
      exerciseId: analysis.exerciseId,
      exerciseName: analysis.exerciseName,
      recommendationKind: 'increase_load',
      actionableLoadKg: resolveActionableLoadKg(analysis, (analysis.baselineLoadKg || 0) + incrementKg, input.unitSettings),
      plannedReps,
      confidence: 'high',
      reasonCodes: ['strong_completion'],
      riskFlags: [],
      blockedReasons: [],
      userMessage: '完成稳定，下次小幅加重。',
    });
  }

  if (clearMiss) {
    const rawLoadKg = analysis.baselineLoadKg !== undefined ? Math.max(0, analysis.baselineLoadKg - incrementKg) : undefined;
    return build({
      exerciseId: analysis.exerciseId,
      exerciseName: analysis.exerciseName,
      recommendationKind: rawLoadKg ? 'decrease_load' : 'reduce_reps',
      actionableLoadKg: resolveActionableLoadKg(analysis, rawLoadKg, input.unitSettings),
      plannedReps: rawLoadKg ? plannedReps : Math.max(1, plannedReps - 1),
      confidence: 'medium',
      reasonCodes: ['clear_underperformance'],
      riskFlags: [],
      blockedReasons: rawLoadKg ? [] : ['missing_load_baseline'],
      userMessage: '完成不足，下次保守。',
    });
  }

  if (smallMiss) {
    return build({
      exerciseId: analysis.exerciseId,
      exerciseName: analysis.exerciseName,
      recommendationKind: 'repeat_next_time',
      actionableLoadKg: resolveActionableLoadKg(analysis, analysis.baselineLoadKg, input.unitSettings),
      plannedReps,
      confidence: 'medium',
      reasonCodes: ['small_underperformance'],
      riskFlags: [],
      blockedReasons: [],
      userMessage: '完成不足，下次保守。',
    });
  }

  if (matchedPlan) {
    return build({
      exerciseId: analysis.exerciseId,
      exerciseName: analysis.exerciseName,
      recommendationKind: 'keep_load',
      actionableLoadKg: resolveActionableLoadKg(analysis, analysis.baselineLoadKg, input.unitSettings),
      plannedReps,
      confidence: 'high',
      reasonCodes: ['matched_plan'],
      riskFlags: [],
      blockedReasons: [],
      userMessage: '完成稳定，下次保持。',
    });
  }

  return build({
    exerciseId: analysis.exerciseId,
    exerciseName: analysis.exerciseName,
    recommendationKind: 'no_change',
    actionableLoadKg: resolveActionableLoadKg(analysis, analysis.baselineLoadKg, input.unitSettings),
    plannedReps,
    confidence: 'low',
    reasonCodes: ['insufficient_pattern'],
    riskFlags: [],
    blockedReasons: ['insufficient_pattern'],
    userMessage: '暂无足够记录。',
  });
};

export const buildPostWorkoutNextTimeRecommendation = (input: PostWorkoutNextTimeRecommendationInput): PostWorkoutNextTimeRecommendation => {
  const createdAt = input.nowIso ?? FALLBACK_CREATED_AT;
  const session = input.session;
  const recommendations =
    EXCLUDED_SESSION_FLAGS.has(String(session.dataFlag || 'normal'))
      ? []
      : (session.exercises || [])
          .map((exercise) => analyzeExercise(session, exercise))
          .filter((analysis): analysis is ExerciseAnalysis => Boolean(analysis))
          .map((analysis) => buildExerciseRecommendation(session, analysis, input));
  const blockedReasons = recommendations.length ? [] : ['insufficient_completed_working_sets'];

  return {
    id: `post-workout-next-time:${session.id}`,
    scope: 'session',
    sourceSessionId: session.id,
    recommendations,
    summary: buildSessionSummary(recommendations),
    confidence: confidenceForRecommendations(recommendations),
    blockedReasons,
    sourceEngineIds: [ENGINE_ID],
    createdAt,
  };
};
