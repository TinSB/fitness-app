import type { ExerciseMetadata, ExerciseTemplate } from '../models/training-model';

// Feature #5: Bucket exercises into compound vs isolation/machine and emit
// a recommended RIR window per bucket. Compound lifts tolerate more
// aggressive intent because moving load is the goal; isolation/machine
// lifts get a conservative window so the user isn't grinding small
// muscles to redline on every set.
//
// The buckets are also used as gates by progressionRulesEngine to decide
// whether to accept a fine-tuned weight bump from setWeightFineTuneEngine.

export type ExerciseBucket = 'compound' | 'isolation' | 'machine';

export type ExerciseTypeBucketInput = Pick<ExerciseTemplate, 'kind' | 'muscle' | 'id'> &
  Pick<ExerciseMetadata, 'movementPattern' | 'fatigueCost' | 'skillDemand'> & {
    baseId?: string;
  };

export type ExerciseTypeBucketResult = {
  bucket: ExerciseBucket;
  recommendedRirMin: number;
  recommendedRirMax: number;
  rationale:
    | 'compound_high_skill'
    | 'compound_default'
    | 'isolation_default'
    | 'machine_default'
    | 'isolation_high_fatigue';
};

const COMPOUND_PATTERNS: ReadonlySet<string> = new Set([
  '水平推',
  '垂直推',
  '水平拉',
  '垂直拉',
  '深蹲',
  '硬拉',
  '弓步',
  '臀推',
]);

export const buildExerciseTypeBucket = (
  exercise: ExerciseTypeBucketInput,
): ExerciseTypeBucketResult => {
  const movementPattern = exercise.movementPattern;
  const isCompoundByPattern = movementPattern ? COMPOUND_PATTERNS.has(movementPattern) : false;

  if (exercise.kind === 'compound' || isCompoundByPattern) {
    if (exercise.skillDemand === 'high') {
      return {
        bucket: 'compound',
        recommendedRirMin: 2,
        recommendedRirMax: 3,
        rationale: 'compound_high_skill',
      };
    }
    return {
      bucket: 'compound',
      recommendedRirMin: 1,
      recommendedRirMax: 3,
      rationale: 'compound_default',
    };
  }

  if (exercise.kind === 'machine') {
    return {
      bucket: 'machine',
      recommendedRirMin: 1,
      recommendedRirMax: 2,
      rationale: 'machine_default',
    };
  }

  if (exercise.fatigueCost === 'high') {
    return {
      bucket: 'isolation',
      recommendedRirMin: 2,
      recommendedRirMax: 3,
      rationale: 'isolation_high_fatigue',
    };
  }

  return {
    bucket: 'isolation',
    recommendedRirMin: 0,
    recommendedRirMax: 2,
    rationale: 'isolation_default',
  };
};
