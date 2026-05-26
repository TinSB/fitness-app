import type { TrainingSession } from '../models/training-model';
import { buildTrainingLapseSignal, type LapseStage, type TrainingLapseSignal } from './trainingLapseEngine';

export type LapseBannerTone = 'info' | 'soft' | 'warning';

export interface LapseBanner {
  visible: boolean;
  stage: LapseStage;
  tone: LapseBannerTone;
  title: string;
  body: string;
  actionLabel?: string;
  daysSinceLastSession: number;
  hasHistory: boolean;
  signal: TrainingLapseSignal;
}

const toneForStage = (stage: LapseStage): LapseBannerTone => {
  if (stage === 'fresh' || stage === 'normal') return 'info';
  if (stage === 'lapsed') return 'soft';
  return 'warning';
};

const titleForStage = (stage: LapseStage, days: number): string => {
  switch (stage) {
    case 'fresh':
      return '训练节奏正常';
    case 'normal':
      return `已 ${days} 天，节奏可控`;
    case 'lapsed':
      return `已 ${days} 天未训练`;
    case 'long_lapsed':
      return `已 ${days} 天未训练，回到新基线`;
    case 'dormant':
      return `已 ${days} 天未训练，按重新开始处理`;
    default:
      return '';
  }
};

const actionForStage = (stage: LapseStage): string | undefined => {
  if (stage === 'long_lapsed' || stage === 'dormant') return '查看今天的推 A';
  if (stage === 'lapsed') return '查看今天推荐';
  return undefined;
};

const NO_HISTORY: LapseBanner = {
  visible: false,
  stage: 'fresh',
  tone: 'info',
  title: '',
  body: '',
  daysSinceLastSession: 0,
  hasHistory: false,
  signal: {
    stage: 'fresh',
    daysSinceLastSession: 0,
    hasHistory: false,
    decayMultiplier: 1,
    resetFatigue: false,
    resetRotation: false,
    resetCalibrationBias: false,
    reasons: [],
    advice: '',
    personalGapDays: 2.33,
    personalizedThresholds: { fresh: 4, normal: 10, lapsed: 21, long_lapsed: 45 },
    smoothDecay: 1,
    strengthRetention: 1,
    aerobicRetention: 1,
    suggestedStartingLoadFactor: 0.85,
    perMuscleRetention: [],
    rotationHint: 'unchanged',
    plannedDeload: false,
    preBreakOutcomeProfile: 'no_data',
    confidence: 'low',
    reasonsByCategory: { strength: [], aerobic: [], calibration: [], rotation: [], mesocycle: [] },
  },
};

export const buildLapseBanner = (history: TrainingSession[] = [], nowIso?: string): LapseBanner => {
  const signal = buildTrainingLapseSignal(history, nowIso);
  if (!signal.hasHistory) return NO_HISTORY;

  const visible = signal.stage !== 'fresh' && signal.stage !== 'normal';
  const tone = toneForStage(signal.stage);
  const title = titleForStage(signal.stage, signal.daysSinceLastSession);
  const body = signal.advice;
  const actionLabel = actionForStage(signal.stage);

  return {
    visible,
    stage: signal.stage,
    tone,
    title,
    body,
    actionLabel,
    daysSinceLastSession: signal.daysSinceLastSession,
    hasHistory: true,
    signal,
  };
};
