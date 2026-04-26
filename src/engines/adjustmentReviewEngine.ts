import type { AdjustmentEffectReview, ProgramAdjustmentHistoryItem, TrainingSession } from '../models/training-model';
import { buildAdherenceReport } from './analytics';
import { buildEffectiveVolumeSummary } from './effectiveSetEngine';
import { number } from './engineUtils';
import { buildPainPatterns } from './painPatternEngine';

export interface AdjustmentReviewContext {
  targetMuscleIds?: string[];
  minSessionsForReview?: number;
}

const roundOne = (value: number) => Math.round(value * 10) / 10;

const targetMusclesFromHistoryItem = (historyItem: ProgramAdjustmentHistoryItem, context?: AdjustmentReviewContext) => {
  const muscles = new Set(context?.targetMuscleIds || []);
  historyItem.changes.forEach((change) => {
    if (change.muscleId) muscles.add(change.muscleId);
  });
  return [...muscles];
};

const weightedSetsForMuscles = (history: TrainingSession[], muscleIds: string[]) => {
  const summary = buildEffectiveVolumeSummary(history);
  if (!muscleIds.length) return summary.effectiveScore;
  return muscleIds.reduce((sum, muscleId) => sum + number(summary.byMuscle[muscleId]?.weightedEffectiveSets), 0);
};

const painSignal = (history: TrainingSession[]) =>
  buildPainPatterns(history).reduce((sum, pattern) => sum + pattern.frequency * Math.max(1, pattern.severityAvg), 0);

export const reviewAdjustmentEffect = (
  historyItem: ProgramAdjustmentHistoryItem,
  beforeHistory: TrainingSession[],
  afterHistory: TrainingSession[],
  context: AdjustmentReviewContext = {},
): AdjustmentEffectReview => {
  const minSessions = context.minSessionsForReview ?? 2;
  if (!afterHistory.length) {
    return {
      historyItemId: historyItem.id,
      status: 'too_early',
      summary: '实验模板刚启用，还没有训练记录，先继续收集数据。',
      metrics: {},
      recommendation: 'collect_more_data',
    };
  }

  if (afterHistory.length < minSessions) {
    return {
      historyItemId: historyItem.id,
      status: 'insufficient_data',
      summary: '实验模板记录还不够，暂时不判断好坏。',
      metrics: {},
      recommendation: 'collect_more_data',
    };
  }

  const targetMuscles = targetMusclesFromHistoryItem(historyItem, context);
  const beforeAdherence = buildAdherenceReport(beforeHistory);
  const afterAdherence = buildAdherenceReport(afterHistory);
  const targetMuscleChange = roundOne(weightedSetsForMuscles(afterHistory, targetMuscles) - weightedSetsForMuscles(beforeHistory, targetMuscles));
  const adherenceChange = roundOne(afterAdherence.overallRate - beforeAdherence.overallRate);
  const painSignalChange = roundOne(painSignal(afterHistory) - painSignal(beforeHistory));
  const beforeEffective = buildEffectiveVolumeSummary(beforeHistory);
  const afterEffective = buildEffectiveVolumeSummary(afterHistory);
  const effectiveVolumeChange = roundOne(afterEffective.effectiveScore - beforeEffective.effectiveScore);
  const metrics = { targetMuscleChange, adherenceChange, painSignalChange, effectiveVolumeChange };

  if (painSignalChange > 2) {
    return {
      historyItemId: historyItem.id,
      status: 'worse',
      summary: '实验模板后不适信号上升，建议先人工复核，必要时回滚到原模板。',
      metrics,
      recommendation: 'review_manually',
    };
  }

  if (adherenceChange <= -15) {
    return {
      historyItemId: historyItem.id,
      status: 'worse',
      summary: '实验模板后完成度明显下降，说明调整可能让计划变得更难执行。',
      metrics,
      recommendation: 'review_manually',
    };
  }

  if (targetMuscleChange > 0 && adherenceChange >= -5) {
    return {
      historyItemId: historyItem.id,
      status: 'improved',
      summary: '目标肌群加权有效组有所提高，且完成度没有明显下降，可以继续观察这个实验模板。',
      metrics,
      recommendation: 'keep',
    };
  }

  return {
    historyItemId: historyItem.id,
    status: 'neutral',
    summary: '实验模板目前没有明显变好或变差，建议继续观察一周或手动微调。',
    metrics,
    recommendation: 'review_manually',
  };
};
