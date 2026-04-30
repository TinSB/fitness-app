import type { ExercisePrescription, ExerciseWarmupPreference } from '../models/training-model';
import { number } from './engineUtils';

export type WarmupPolicy = 'required' | 'optional' | 'skipped_by_policy' | 'none';
export type WarmupDecision = 'full_warmup' | 'feeder_set' | 'no_warmup';

export type WarmupPolicyDecision = {
  exerciseId: string;
  movementPattern?: string;
  policy: WarmupPolicy;
  warmupDecision: WarmupDecision;
  reason: string;
  shouldShowWarmupSets: boolean;
};

export type WarmupPolicyInput = {
  exercise: ExercisePrescription;
  exerciseIndex: number;
  previousExercises?: ExercisePrescription[];
  completedWarmupPatterns?: string[];
  plannedWeight?: number;
  sessionContext?: {
    highLoadThresholdKg?: number;
    allExercisesWarmup?: boolean;
  };
};

const horizontalPushTerms = ['bench', 'press', 'push', 'chest', 'incline', '卧推', '推胸', '上斜', '胸推', '水平推'];
const verticalPushTerms = ['overhead', 'shoulder_press', 'shoulder-press', '肩推', '垂直推'];
const horizontalPullTerms = ['row', '划船', '水平拉'];
const verticalPullTerms = ['pullup', 'pull-up', 'pulldown', 'pull_down', 'lat', '下拉', '引体', '垂直拉'];
const squatTerms = ['squat', 'leg_press', 'leg-press', 'hack', '深蹲', '腿举'];
const hingeTerms = ['deadlift', 'rdl', 'hinge', '硬拉', '髋铰链'];
const isolationTerms = [
  'triceps',
  'pushdown',
  'extension',
  'curl',
  'lateral_raise',
  'lateral-raise',
  'raise',
  'leg_extension',
  'leg-extension',
  'leg_curl',
  'leg-curl',
  'fly',
  'cable_fly',
  'cable-fly',
  'face_pull',
  'face-pull',
  '三头',
  '下压',
  '伸展',
  '二头',
  '弯举',
  '侧平举',
  '腿屈伸',
  '腿弯举',
  '夹胸',
  '飞鸟',
  '面拉',
];

const normalizePatternText = (value?: string) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');

const includesAny = (text: string, terms: string[]) => terms.some((term) => text.includes(term.toLowerCase()));

const canonicalMovementPattern = (value?: string) => {
  const normalized = normalizePatternText(value);
  if (!normalized) return '';
  const text = normalized.toLowerCase();
  if (includesAny(text, horizontalPushTerms)) return 'horizontal_push';
  if (includesAny(text, verticalPushTerms)) return 'vertical_push';
  if (includesAny(text, horizontalPullTerms)) return 'horizontal_pull';
  if (includesAny(text, verticalPullTerms)) return 'vertical_pull';
  if (includesAny(text, squatTerms)) return 'squat';
  if (includesAny(text, hingeTerms)) return 'hinge';
  return normalized;
};

export const getWarmupMovementPattern = (exercise: ExercisePrescription): string => {
  const explicit = canonicalMovementPattern(exercise.movementPattern || exercise.equivalence?.pattern);
  if (explicit) return explicit;

  const text = `${exercise.id} ${exercise.baseId || ''} ${exercise.canonicalExerciseId || ''} ${exercise.name || ''} ${
    exercise.alias || ''
  } ${exercise.muscle || ''}`.toLowerCase();
  if (includesAny(text, horizontalPushTerms)) return 'horizontal_push';
  if (includesAny(text, verticalPushTerms)) return 'vertical_push';
  if (includesAny(text, horizontalPullTerms)) return 'horizontal_pull';
  if (includesAny(text, verticalPullTerms)) return 'vertical_pull';
  if (includesAny(text, squatTerms)) return 'squat';
  if (includesAny(text, hingeTerms)) return 'hinge';
  return normalizePatternText(exercise.muscle) || exercise.id;
};

const hasWarmupSets = (exercise: ExercisePrescription) => Array.isArray(exercise.warmupSets) && exercise.warmupSets.length > 0;
const isMainExercise = (exercise: ExercisePrescription) =>
  exercise.kind === 'compound' || exercise.kind === 'machine' || (typeof exercise.orderPriority === 'number' && number(exercise.orderPriority) <= 2);
const isHighSkill = (exercise: ExercisePrescription) => exercise.skillDemand === 'high';
const isHighFatigue = (exercise: ExercisePrescription) => exercise.fatigueCost === 'high';
const isMachine = (exercise: ExercisePrescription) => exercise.kind === 'machine';
const warmupPreference = (exercise: ExercisePrescription): ExerciseWarmupPreference =>
  exercise.warmupPreference === 'always' || exercise.warmupPreference === 'optional' || exercise.warmupPreference === 'never'
    ? exercise.warmupPreference
    : 'auto';
const isIsolationExercise = (exercise: ExercisePrescription) => {
  const text = `${exercise.id} ${exercise.baseId || ''} ${exercise.canonicalExerciseId || ''} ${exercise.name || ''} ${
    exercise.alias || ''
  } ${exercise.kind || ''}`.toLowerCase();
  return exercise.kind === 'isolation' || includesAny(text, isolationTerms);
};

const primaryMuscles = (exercise: ExercisePrescription) =>
  (exercise.primaryMuscles?.length ? exercise.primaryMuscles : [exercise.muscle]).filter(Boolean).map((item) => String(item));

const hasPrimaryMuscleOverlap = (exercise: ExercisePrescription, previousExercises: ExercisePrescription[]) => {
  const current = new Set(primaryMuscles(exercise));
  return previousExercises.some((previous) => primaryMuscles(previous).some((muscle) => current.has(muscle)));
};

const decision = (
  exercise: ExercisePrescription,
  movementPattern: string,
  warmupDecision: WarmupDecision,
  policy: WarmupPolicy,
  reason: string,
): WarmupPolicyDecision => ({
  exerciseId: exercise.id,
  movementPattern,
  policy,
  warmupDecision,
  reason,
  shouldShowWarmupSets: warmupDecision !== 'no_warmup',
});

export const decideWarmupPolicy = ({
  exercise,
  exerciseIndex,
  previousExercises = [],
  completedWarmupPatterns = [],
  plannedWeight,
  sessionContext,
}: WarmupPolicyInput): WarmupPolicyDecision => {
  const movementPattern = getWarmupMovementPattern(exercise);
  const completedPatterns = new Set(completedWarmupPatterns.map(canonicalMovementPattern));
  const previousPatternSeen = previousExercises.some((item) => getWarmupMovementPattern(item) === movementPattern);
  const previousPrimaryMuscleSeen = hasPrimaryMuscleOverlap(exercise, previousExercises);
  const previousWarmupCoverage = completedPatterns.has(movementPattern) || previousPatternSeen || previousPrimaryMuscleSeen;
  const highLoadThresholdKg = sessionContext?.highLoadThresholdKg ?? 80;
  const highLoad = number(plannedWeight ?? exercise.startWeight) >= highLoadThresholdKg;
  const highDemand = isHighSkill(exercise) || isHighFatigue(exercise) || highLoad;
  const preference = warmupPreference(exercise);

  if (!hasWarmupSets(exercise)) {
    return decision(exercise, movementPattern, 'no_warmup', 'none', '当前动作没有预设热身组。');
  }

  if (preference === 'never') {
    return decision(exercise, movementPattern, 'no_warmup', 'none', '该动作已设置为不使用热身组。');
  }

  if (preference === 'always' || sessionContext?.allExercisesWarmup) {
    return decision(
      exercise,
      movementPattern,
      'full_warmup',
      'required',
      preference === 'always' ? '该动作已手动设置为完整热身。' : '已开启所有动作完整热身。',
    );
  }

  if (isIsolationExercise(exercise) && !highLoad && !isHighSkill(exercise)) {
    return decision(
      exercise,
      movementPattern,
      'no_warmup',
      preference === 'optional' ? 'optional' : 'skipped_by_policy',
      '孤立动作和小肌群动作默认不重复安排热身，直接进入正式组。',
    );
  }

  if (exerciseIndex === 0 && isMainExercise(exercise)) {
    return decision(exercise, movementPattern, 'full_warmup', 'required', '本次训练第一个主动作安排完整热身。');
  }

  if (previousWarmupCoverage) {
    if (highDemand && !isMachine(exercise)) {
      return decision(
        exercise,
        movementPattern,
        'feeder_set',
        'required',
        '前面已覆盖相关肌群，当前动作只保留 1 组适应组。',
      );
    }
    return decision(
      exercise,
      movementPattern,
      'no_warmup',
      preference === 'optional' ? 'optional' : 'skipped_by_policy',
      completedPatterns.has(movementPattern)
        ? '已完成同模式热身，直接进入正式组。'
        : '前面已覆盖相关肌群，不再重复完整热身。',
    );
  }

  if (isMainExercise(exercise)) {
    return decision(exercise, movementPattern, 'full_warmup', 'required', '该动作是本次训练首次出现的主训练模式，安排完整热身。');
  }

  if (highDemand) {
    return decision(exercise, movementPattern, 'feeder_set', 'required', '当前动作负荷或技术要求较高，保留 1 组适应组。');
  }

  return decision(exercise, movementPattern, 'no_warmup', 'optional', '当前动作热身可选，默认直接进入正式组。');
};
