import type { AdaptiveCalibrationState, TrainingSession } from '../models/training-model';

export type LapseStage = 'fresh' | 'normal' | 'lapsed' | 'long_lapsed' | 'dormant';

export interface TrainingLapseSignal {
  stage: LapseStage;
  daysSinceLastSession: number;
  lastSessionDate?: string;
  hasHistory: boolean;
  decayMultiplier: number;
  resetFatigue: boolean;
  resetRotation: boolean;
  resetCalibrationBias: boolean;
  reasons: string[];
  advice: string;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const THRESHOLDS = {
  fresh: 4,
  normal: 10,
  lapsed: 21,
  long_lapsed: 45,
} as const;

const safeDate = (value?: string) => {
  if (!value) return null;
  const direct = value.match(/^\d{4}-\d{2}-\d{2}/);
  const iso = direct ? `${direct[0]}T12:00:00.000Z` : value;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
};

const sessionTimestamp = (session: TrainingSession) =>
  safeDate(session.finishedAt) ?? safeDate(session.startedAt) ?? safeDate(session.date);

const isAnalyticsSession = (session: TrainingSession) => session.completed !== false && session.dataFlag !== 'test' && session.dataFlag !== 'excluded';

const latestAnalyticsSession = (history: TrainingSession[] = []): TrainingSession | null => {
  let candidate: { session: TrainingSession; timestamp: number } | null = null;
  for (const session of history) {
    if (!isAnalyticsSession(session)) continue;
    const ts = sessionTimestamp(session);
    if (ts === null) continue;
    if (!candidate || ts > candidate.timestamp) candidate = { session, timestamp: ts };
  }
  return candidate?.session ?? null;
};

const classifyStage = (days: number): LapseStage => {
  if (days < THRESHOLDS.fresh) return 'fresh';
  if (days < THRESHOLDS.normal) return 'normal';
  if (days < THRESHOLDS.lapsed) return 'lapsed';
  if (days < THRESHOLDS.long_lapsed) return 'long_lapsed';
  return 'dormant';
};

const decayForStage = (stage: LapseStage): number => {
  switch (stage) {
    case 'fresh':
      return 1;
    case 'normal':
      return 1;
    case 'lapsed':
      return 0.6;
    case 'long_lapsed':
      return 0.25;
    case 'dormant':
      return 0;
    default:
      return 1;
  }
};

const adviceForStage = (stage: LapseStage, days: number): string => {
  switch (stage) {
    case 'fresh':
      return '训练节奏稳定，按当前推荐推进即可。';
    case 'normal':
      return '距离上次训练在正常范围内，按当前推荐推进。';
    case 'lapsed':
      return `距离上次训练已 ${days} 天，建议本次稍微保守，疲劳记录会部分衰减。`;
    case 'long_lapsed':
      return `距离上次训练已 ${days} 天，建议从推日重新起步，疲劳和动作不适记录会重置。`;
    case 'dormant':
      return `距离上次训练超过 ${days} 天，本次按新基线起步：清空疲劳积分、训练循环回到推日、推荐回到中性。`;
    default:
      return '';
  }
};

export const buildTrainingLapseSignal = (
  history: TrainingSession[] = [],
  nowIso = new Date().toISOString(),
): TrainingLapseSignal => {
  const latest = latestAnalyticsSession(history);
  const now = safeDate(nowIso) ?? Date.now();

  if (!latest) {
    return {
      stage: 'fresh',
      daysSinceLastSession: 0,
      hasHistory: false,
      decayMultiplier: 1,
      resetFatigue: false,
      resetRotation: false,
      resetCalibrationBias: false,
      reasons: [],
      advice: '尚无训练记录，按新用户处理。',
    };
  }

  const latestTs = sessionTimestamp(latest) ?? now;
  const days = Math.max(0, Math.round((now - latestTs) / MS_PER_DAY));
  const stage = classifyStage(days);
  const reasons: string[] = [];
  if (stage === 'lapsed') reasons.push(`距离上次训练 ${days} 天，进入轻度间隔。`);
  if (stage === 'long_lapsed') reasons.push(`距离上次训练 ${days} 天，进入长间隔，重置训练循环和疲劳。`);
  if (stage === 'dormant') reasons.push(`距离上次训练 ${days} 天，进入休眠期，全部按新基线起步。`);

  return {
    stage,
    daysSinceLastSession: days,
    lastSessionDate: latest.date,
    hasHistory: true,
    decayMultiplier: decayForStage(stage),
    resetFatigue: stage === 'long_lapsed' || stage === 'dormant',
    resetRotation: stage === 'long_lapsed' || stage === 'dormant',
    resetCalibrationBias: stage === 'dormant',
    reasons,
    advice: adviceForStage(stage, days),
  };
};

const decayCountMap = (input: Record<string, number> | undefined, multiplier: number): Record<string, number> => {
  if (!input) return {};
  const result: Record<string, number> = {};
  Object.entries(input).forEach(([key, value]) => {
    const next = Math.max(0, Math.round((Number(value) || 0) * multiplier));
    if (next > 0) result[key] = next;
  });
  return result;
};

export interface AdaptiveStateLike {
  issueScores?: Record<string, number>;
  painByExercise?: Record<string, number>;
  performanceDrops?: string[];
  improvingIssues?: string[];
  moduleDose?: Record<string, 'taper' | 'baseline' | 'boost'>;
  lastUpdated?: string;
}

export const decayAdaptiveStateForLapse = <T extends AdaptiveStateLike>(state: T, lapse: TrainingLapseSignal): T => {
  if (lapse.stage === 'fresh' || lapse.stage === 'normal') return state;
  const multiplier = lapse.decayMultiplier;
  return {
    ...state,
    issueScores: decayCountMap(state.issueScores, multiplier),
    painByExercise: decayCountMap(state.painByExercise, multiplier),
    performanceDrops: lapse.resetFatigue ? [] : state.performanceDrops || [],
    improvingIssues: lapse.resetFatigue ? [] : state.improvingIssues || [],
    moduleDose: lapse.resetFatigue ? {} : state.moduleDose || {},
  };
};

export const decayCalibrationStateForLapse = (
  state: AdaptiveCalibrationState | undefined | null,
  lapse: TrainingLapseSignal,
): AdaptiveCalibrationState | undefined => {
  if (!state) return state ?? undefined;
  if (lapse.stage === 'fresh' || lapse.stage === 'normal') return state;
  const multiplier = lapse.resetCalibrationBias ? 0 : Math.min(1, Math.max(0, lapse.decayMultiplier));
  const entries = state.entries.map((entry) => {
    const decayed = entry.loadBias + (1 - entry.loadBias) * (1 - multiplier);
    return {
      ...entry,
      loadBias: lapse.resetCalibrationBias ? 1 : decayed,
      frozenUntil: lapse.resetCalibrationBias ? undefined : entry.frozenUntil,
    };
  });
  return {
    ...state,
    entries,
    lastUpdated: state.lastUpdated,
  };
};

export const isRotationReset = (lapse: TrainingLapseSignal) => lapse.resetRotation;
