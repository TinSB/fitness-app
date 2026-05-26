import type { RecommendationFactor, RecommendationTrace } from './recommendationTraceEngine';

export interface SelectedReason {
  id: string;
  label: string;
  reason: string;
  source: RecommendationFactor['source'];
  effect: RecommendationFactor['effect'];
  magnitudeRank: number;
  scope: 'global' | 'volume' | 'loadFeedback' | 'exercise';
  exerciseId?: string;
}

export interface ReasonSelectorOptions {
  limit?: number;
  exerciseId?: string;
}

const MAGNITUDE_RANK: Record<RecommendationFactor['magnitude'], number> = {
  large: 3,
  moderate: 2,
  small: 1,
};

const EFFECT_PRIORITY: Record<RecommendationFactor['effect'], number> = {
  block: 5,
  decrease: 4,
  increase: 3,
  maintain: 2,
  informational: 1,
};

const isMeaningful = (factor: RecommendationFactor) =>
  factor.effect !== 'informational' || (factor.source !== 'template' && factor.source !== 'defaultPolicy');

const toSelected = (factor: RecommendationFactor, scope: SelectedReason['scope'], exerciseId?: string): SelectedReason => ({
  id: `${scope}:${factor.id}`,
  label: factor.label,
  reason: factor.reason,
  source: factor.source,
  effect: factor.effect,
  magnitudeRank: MAGNITUDE_RANK[factor.magnitude] ?? 1,
  scope,
  exerciseId,
});

const score = (entry: SelectedReason): number => {
  const effectScore = EFFECT_PRIORITY[entry.effect] ?? 0;
  const scopeScore = entry.scope === 'exercise' ? 4 : entry.scope === 'loadFeedback' ? 3 : entry.scope === 'volume' ? 2 : 1;
  return effectScore * 10 + entry.magnitudeRank * 4 + scopeScore;
};

export const selectRecommendationReasons = (
  trace: RecommendationTrace | null | undefined,
  options: ReasonSelectorOptions = {},
): SelectedReason[] => {
  if (!trace) return [];
  const limit = options.limit ?? 3;
  const exerciseId = options.exerciseId;

  const pool: SelectedReason[] = [];
  for (const factor of trace.globalFactors || []) {
    if (!isMeaningful(factor)) continue;
    pool.push(toSelected(factor, 'global'));
  }
  for (const factor of trace.volumeFactors || []) {
    if (!isMeaningful(factor)) continue;
    pool.push(toSelected(factor, 'volume'));
  }
  for (const factor of trace.loadFeedbackFactors || []) {
    pool.push(toSelected(factor, 'loadFeedback'));
  }
  const exerciseFactors = trace.exerciseFactors || {};
  Object.entries(exerciseFactors).forEach(([id, factors]) => {
    if (exerciseId && id !== exerciseId) return;
    for (const factor of factors) {
      if (!isMeaningful(factor)) continue;
      pool.push(toSelected(factor, 'exercise', id));
    }
  });

  const seenReasons = new Set<string>();
  const ranked = pool
    .sort((left, right) => score(right) - score(left))
    .filter((entry) => {
      if (seenReasons.has(entry.reason)) return false;
      seenReasons.add(entry.reason);
      return true;
    });

  return ranked.slice(0, limit);
};
