import type { AdaptiveCalibrationEntry, AdaptiveCalibrationState } from '../models/training-model';

export type CalibrationBiasBucket = 'increased' | 'neutral' | 'decreased';

export interface CalibrationEntryHighlight {
  exerciseId: string;
  repBand: AdaptiveCalibrationEntry['repBand'];
  dayState: AdaptiveCalibrationEntry['dayState'];
  loadBias: number;
  observationCount: number;
  frozen: boolean;
  reasonHint?: string;
}

export interface CalibrationSummary {
  hasData: boolean;
  totalEntries: number;
  activeEntries: number;
  frozenEntries: number;
  averageBias: number;
  bucketCounts: Record<CalibrationBiasBucket, number>;
  largestIncrease?: CalibrationEntryHighlight;
  largestDecrease?: CalibrationEntryHighlight;
  recentlyFrozen?: CalibrationEntryHighlight;
  reasonHints: string[];
  headline: string;
}

const BIAS_NEUTRAL_EPSILON = 0.005;

const classify = (bias: number): CalibrationBiasBucket => {
  if (bias > 1 + BIAS_NEUTRAL_EPSILON) return 'increased';
  if (bias < 1 - BIAS_NEUTRAL_EPSILON) return 'decreased';
  return 'neutral';
};

const toHighlight = (entry: AdaptiveCalibrationEntry, isFrozen: boolean): CalibrationEntryHighlight => ({
  exerciseId: entry.exerciseId,
  repBand: entry.repBand,
  dayState: entry.dayState,
  loadBias: Number(entry.loadBias.toFixed(3)),
  observationCount: entry.observationCount,
  frozen: isFrozen,
  reasonHint: entry.reasonHints?.[0],
});

const isFrozen = (entry: AdaptiveCalibrationEntry, nowIso: string): boolean => {
  if (!entry.frozenUntil) return false;
  const frozenUntilMs = Date.parse(entry.frozenUntil);
  const nowMs = Date.parse(nowIso);
  if (!Number.isFinite(frozenUntilMs) || !Number.isFinite(nowMs)) return false;
  return frozenUntilMs > nowMs;
};

const buildHeadline = (
  total: number,
  buckets: Record<CalibrationBiasBucket, number>,
  frozen: number,
): string => {
  if (total === 0) return '尚无足够数据生成自动微调。';
  const parts: string[] = [];
  if (buckets.increased) parts.push(`${buckets.increased} 个动作自动小幅加重`);
  if (buckets.decreased) parts.push(`${buckets.decreased} 个动作自动小幅减重`);
  if (buckets.neutral) parts.push(`${buckets.neutral} 个动作保持中性`);
  if (frozen) parts.push(`${frozen} 个动作因近期不适或失败暂时冻结`);
  return parts.length ? parts.join('，') + '。' : '当前推荐基本贴合实际。';
};

const EMPTY_BUCKETS: Record<CalibrationBiasBucket, number> = {
  increased: 0,
  neutral: 0,
  decreased: 0,
};

export const buildCalibrationSummary = (
  state: AdaptiveCalibrationState | null | undefined,
  nowIso: string = new Date().toISOString(),
): CalibrationSummary => {
  if (!state || !Array.isArray(state.entries) || state.entries.length === 0) {
    return {
      hasData: false,
      totalEntries: 0,
      activeEntries: 0,
      frozenEntries: 0,
      averageBias: 1,
      bucketCounts: { ...EMPTY_BUCKETS },
      reasonHints: [],
      headline: '尚无足够数据生成自动微调。',
    };
  }

  const buckets: Record<CalibrationBiasBucket, number> = { ...EMPTY_BUCKETS };
  let totalBias = 0;
  let frozenCount = 0;
  let largestIncrease: CalibrationEntryHighlight | undefined;
  let largestDecrease: CalibrationEntryHighlight | undefined;
  let recentlyFrozen: CalibrationEntryHighlight | undefined;
  const reasonHints: string[] = [];

  state.entries.forEach((entry) => {
    const frozen = isFrozen(entry, nowIso);
    if (frozen) frozenCount += 1;
    const bucket = classify(entry.loadBias);
    buckets[bucket] += 1;
    totalBias += entry.loadBias;
    const highlight = toHighlight(entry, frozen);
    if (bucket === 'increased') {
      if (!largestIncrease || entry.loadBias > largestIncrease.loadBias) largestIncrease = highlight;
    } else if (bucket === 'decreased') {
      if (!largestDecrease || entry.loadBias < largestDecrease.loadBias) largestDecrease = highlight;
    }
    if (frozen && (!recentlyFrozen || entry.lastUpdated > recentlyFrozen.exerciseId)) {
      recentlyFrozen = highlight;
    }
    entry.reasonHints?.forEach((hint) => {
      if (hint && !reasonHints.includes(hint)) reasonHints.push(hint);
    });
  });

  const totalEntries = state.entries.length;
  const averageBias = Number((totalBias / totalEntries).toFixed(3));
  const headline = buildHeadline(totalEntries, buckets, frozenCount);

  return {
    hasData: true,
    totalEntries,
    activeEntries: totalEntries - frozenCount,
    frozenEntries: frozenCount,
    averageBias,
    bucketCounts: buckets,
    largestIncrease,
    largestDecrease,
    recentlyFrozen,
    reasonHints: reasonHints.slice(0, 5),
    headline,
  };
};
