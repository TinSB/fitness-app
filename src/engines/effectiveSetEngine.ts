import type { EffectiveSetResult, EffectiveVolumeSummary, ExercisePrescription, TrainingSession, TrainingSetLog } from '../models/training-model';
import { completedSets, getPrimaryMuscles, getSecondaryMuscles, number } from './engineUtils';

const clampScore = (score: number) => Math.max(0, Math.min(1, score));

export const evaluateEffectiveSet = (
  set: TrainingSetLog,
  exercise?: Partial<Pick<ExercisePrescription, 'repMin' | 'repMax' | 'kind' | 'primaryMuscles' | 'muscle'>>,
  context?: { plannedReps?: [number, number] }
): EffectiveSetResult => {
  const flags: EffectiveSetResult['flags'] = [];
  const reasons: string[] = [];
  let score = 1;

  if (set.type === 'warmup') {
    return {
      isEffective: false,
      score: 0,
      confidence: 'low',
      flags: ['warmup'],
      reasons: ['热身组用于准备，不计入肌肥大有效组。'],
    };
  }

  if (!set.done || number(set.weight) <= 0 || number(set.reps) <= 0) {
    return {
      isEffective: false,
      score: 0,
      confidence: 'low',
      flags: ['incomplete'],
      reasons: ['该组未完整完成，不能计入有效组。'],
    };
  }

  if (set.techniqueQuality === 'poor') {
    flags.push('poor_technique');
    score *= 0.45;
    reasons.push('动作质量较差，有效刺激和数据可信度下调。');
  }

  if (set.painFlag) {
    flags.push('pain');
    score *= 0.5;
    reasons.push('该组出现不适，不作为高质量有效组。');
  }

  const rirValue = set.rir === '' || set.rir === undefined ? undefined : number(set.rir);
  if (rirValue === undefined) {
    flags.push('unknown_rir');
    score *= 0.82;
    reasons.push('未记录 RIR，按中等置信度计入。');
  } else if (rirValue >= 5) {
    flags.push('too_easy');
    score *= 0.45;
    reasons.push('RIR 过高，说明该组可能明显偏轻。');
  } else if (rirValue === 4) {
    flags.push('too_easy');
    score *= 0.65;
    reasons.push('RIR 偏高，有效性下调。');
  } else if (rirValue >= 1 && rirValue <= 3) {
    flags.push('valid_effort');
    reasons.push('努力程度落在 RIR 1-3 的有效区间。');
  } else {
    flags.push('valid_effort');
    score *= 0.9;
    reasons.push('接近力竭，但需要关注疲劳成本和动作质量。');
  }

  const repRange = context?.plannedReps || [number(exercise?.repMin), number(exercise?.repMax)];
  if (repRange[0] > 0 && number(set.reps) < repRange[0]) {
    score *= 0.75;
    reasons.push('实际次数低于处方下限，有效性下调。');
  }

  const finalScore = clampScore(score);
  const confidence: EffectiveSetResult['confidence'] =
    flags.includes('pain') || flags.includes('poor_technique') || flags.includes('too_easy')
      ? 'low'
      : flags.includes('unknown_rir')
        ? 'medium'
        : finalScore >= 0.75
          ? 'high'
          : 'low';
  return {
    isEffective: finalScore >= 0.75,
    score: finalScore,
    confidence,
    flags,
    reasons,
  };
};

export const countEffectiveSets = (session: TrainingSession, options?: { minScore?: number }) => {
  const minScore = options?.minScore ?? 0.75;
  return (session.exercises || []).reduce(
    (sum, exercise) =>
      sum +
      completedSets(exercise).filter((set) => evaluateEffectiveSet(set, exercise).score >= minScore && set.type !== 'corrective' && set.type !== 'functional').length,
    0
  );
};

export const getMuscleContribution = (
  exercise: Partial<Pick<ExercisePrescription, 'muscleContribution' | 'primaryMuscles' | 'secondaryMuscles' | 'muscle'>>
): Record<string, number> => {
  if (exercise.muscleContribution && Object.keys(exercise.muscleContribution).length) return exercise.muscleContribution;
  const contributions: Record<string, number> = {};
  getPrimaryMuscles(exercise as ExercisePrescription).forEach((muscle) => {
    contributions[muscle] = Math.max(contributions[muscle] || 0, 1);
  });
  getSecondaryMuscles(exercise).forEach((muscle) => {
    contributions[muscle] = Math.max(contributions[muscle] || 0, 0.5);
  });
  return contributions;
};

const emptyMuscleSummary = () => ({
  completedSets: 0,
  effectiveSets: 0,
  highConfidenceEffectiveSets: 0,
  mediumConfidenceEffectiveSets: 0,
  lowConfidenceEffectiveSets: 0,
  effectiveScore: 0,
  weightedEffectiveSets: 0,
  highConfidenceWeightedSets: 0,
});

export const buildEffectiveVolumeSummary = (history: TrainingSession[], dateRange?: { from?: string; to?: string }): EffectiveVolumeSummary => {
  const summary: EffectiveVolumeSummary = {
    completedSets: 0,
    effectiveSets: 0,
    highConfidenceEffectiveSets: 0,
    mediumConfidenceEffectiveSets: 0,
    lowConfidenceEffectiveSets: 0,
    effectiveScore: 0,
    byMuscle: {},
    reasons: [],
  };

  const sessions = history.filter((session) => {
    if (session.dataFlag === 'test' || session.dataFlag === 'excluded') return false;
    if (dateRange?.from && session.date < dateRange.from) return false;
    if (dateRange?.to && session.date > dateRange.to) return false;
    return true;
  });

  sessions.forEach((session) => {
    (session.exercises || []).forEach((exercise) => {
      const contributions = getMuscleContribution(exercise);
      completedSets(exercise).forEach((set) => {
        if (set.type === 'corrective' || set.type === 'functional') return;
        const result = evaluateEffectiveSet(set, exercise);
        summary.completedSets += 1;
        summary.effectiveScore += result.score;
        if (result.isEffective) {
          summary.effectiveSets += 1;
          if (result.confidence === 'high') summary.highConfidenceEffectiveSets += 1;
          else if (result.confidence === 'medium') summary.mediumConfidenceEffectiveSets += 1;
          else summary.lowConfidenceEffectiveSets += 1;
        }
        Object.entries(contributions).forEach(([muscle, contribution]) => {
          const item = summary.byMuscle[muscle] || emptyMuscleSummary();
          item.completedSets += 1;
          item.effectiveScore += result.score;
          if (result.isEffective) {
            item.effectiveSets += 1;
            item.weightedEffectiveSets += result.score * contribution;
            if (result.confidence === 'high') {
              item.highConfidenceEffectiveSets += 1;
              item.highConfidenceWeightedSets += contribution;
            } else if (result.confidence === 'medium') {
              item.mediumConfidenceEffectiveSets += 1;
            } else {
              item.lowConfidenceEffectiveSets += 1;
            }
          }
          summary.byMuscle[muscle] = item;
        });
        result.reasons.forEach((reason) => {
          if (!summary.reasons.includes(reason)) summary.reasons.push(reason);
        });
      });
    });
  });

  summary.effectiveScore = Math.round(summary.effectiveScore * 10) / 10;
  Object.values(summary.byMuscle).forEach((item) => {
    item.effectiveScore = Math.round(item.effectiveScore * 10) / 10;
    item.weightedEffectiveSets = Math.round(item.weightedEffectiveSets * 10) / 10;
    item.highConfidenceWeightedSets = Math.round(item.highConfidenceWeightedSets * 10) / 10;
  });

  return summary;
};
