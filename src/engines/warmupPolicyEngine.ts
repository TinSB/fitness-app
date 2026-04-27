import type { ExercisePrescription } from '../models/training-model';
import { number } from './engineUtils';

export type WarmupPolicy = 'required' | 'optional' | 'skipped_by_policy' | 'none';

export type WarmupPolicyDecision = {
  exerciseId: string;
  movementPattern?: string;
  policy: WarmupPolicy;
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
  };
};

const horizontalPushTerms = ['bench', 'press', 'push', 'chest', 'incline', '卧推', '推胸', '上斜', '胸推'];

const normalizePatternText = (value?: string) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');

export const getWarmupMovementPattern = (exercise: ExercisePrescription): string => {
  const explicit = normalizePatternText(exercise.movementPattern || exercise.equivalence?.pattern);
  if (explicit) return explicit;

  const text = `${exercise.id} ${exercise.baseId || ''} ${exercise.canonicalExerciseId || ''} ${exercise.name || ''} ${
    exercise.alias || ''
  } ${exercise.muscle || ''}`.toLowerCase();
  if (horizontalPushTerms.some((term) => text.includes(term.toLowerCase()))) return 'horizontal_push';
  if (text.includes('row') || text.includes('划船')) return 'horizontal_pull';
  if (text.includes('pull') || text.includes('下拉')) return 'vertical_pull';
  if (text.includes('squat') || text.includes('leg_press') || text.includes('深蹲') || text.includes('腿举')) return 'squat';
  if (text.includes('deadlift') || text.includes('rdl') || text.includes('硬拉')) return 'hinge';
  return normalizePatternText(exercise.muscle) || exercise.id;
};

const hasWarmupSets = (exercise: ExercisePrescription) => Array.isArray(exercise.warmupSets) && exercise.warmupSets.length > 0;
const isMainExercise = (exercise: ExercisePrescription) => exercise.kind === 'compound' || number(exercise.orderPriority) <= 2;
const isHighSkill = (exercise: ExercisePrescription) => exercise.skillDemand === 'high';

export const decideWarmupPolicy = ({
  exercise,
  exerciseIndex,
  previousExercises = [],
  completedWarmupPatterns = [],
  plannedWeight,
  sessionContext,
}: WarmupPolicyInput): WarmupPolicyDecision => {
  const movementPattern = getWarmupMovementPattern(exercise);
  const completedPatterns = new Set(completedWarmupPatterns.map(normalizePatternText));
  const previousPatternSeen = previousExercises.some((item) => getWarmupMovementPattern(item) === movementPattern);
  const highLoadThresholdKg = sessionContext?.highLoadThresholdKg ?? 80;
  const highLoad = number(plannedWeight ?? exercise.startWeight) >= highLoadThresholdKg;

  if (!hasWarmupSets(exercise)) {
    return {
      exerciseId: exercise.id,
      movementPattern,
      policy: 'none',
      reason: '当前动作没有预设热身组。',
      shouldShowWarmupSets: false,
    };
  }

  if (exerciseIndex === 0 && isMainExercise(exercise)) {
    return {
      exerciseId: exercise.id,
      movementPattern,
      policy: 'required',
      reason: '本次训练第一个主动作需要先完成热身。',
      shouldShowWarmupSets: true,
    };
  }

  if (highLoad || isHighSkill(exercise)) {
    return {
      exerciseId: exercise.id,
      movementPattern,
      policy: 'required',
      reason: highLoad ? '本动作推荐负荷较高，保留热身组。' : '本动作技术要求较高，保留热身组。',
      shouldShowWarmupSets: true,
    };
  }

  if (completedPatterns.has(movementPattern)) {
    return {
      exerciseId: exercise.id,
      movementPattern,
      policy: 'skipped_by_policy',
      reason: '已完成同模式热身，直接进入正式组。',
      shouldShowWarmupSets: false,
    };
  }

  if (!previousPatternSeen && isMainExercise(exercise)) {
    return {
      exerciseId: exercise.id,
      movementPattern,
      policy: 'required',
      reason: '该动作模式本次训练第一次出现，需要热身。',
      shouldShowWarmupSets: true,
    };
  }

  return {
    exerciseId: exercise.id,
    movementPattern,
    policy: 'optional',
    reason: '同模式动作已出现，可按状态保留热身组。',
    shouldShowWarmupSets: true,
  };
};
