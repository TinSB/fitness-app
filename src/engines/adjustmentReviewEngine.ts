import type { AdjustmentEffectReview, ProgramAdjustmentHistoryItem, TrainingSession } from '../models/training-model';
import { buildAdherenceReport } from './analytics';
import { buildEffectiveVolumeSummary } from './effectiveSetEngine';
import { number } from './engineUtils';
import { buildPainPatterns } from './painPatternEngine';

export interface AdjustmentReviewContext {
  targetMuscleIds?: string[];
  minBeforeSessions?: number;
  minAfterSessions?: number;
  maxBeforeSessions?: number;
  maxAfterSessions?: number;
}

type RelatedSession = {
  session: TrainingSession;
  matchedBy: 'programTemplateId' | 'templateId' | 'templateName';
};

const roundOne = (value: number) => Math.round(value * 10) / 10;

const toTimestamp = (value?: string) => {
  const parsed = value ? new Date(value).getTime() : Number.NaN;
  return Number.isFinite(parsed) ? parsed : 0;
};

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

const matchSessionToTemplate = (
  session: TrainingSession,
  templateId: string,
  templateName?: string,
): RelatedSession | null => {
  if (session.programTemplateId && session.programTemplateId === templateId) {
    return { session, matchedBy: 'programTemplateId' };
  }
  if (session.templateId && session.templateId === templateId) {
    return { session, matchedBy: 'templateId' };
  }
  if (templateName && (session.programTemplateName === templateName || session.templateName === templateName)) {
    return { session, matchedBy: 'templateName' };
  }
  return null;
};

const collectRelatedSessions = (
  history: TrainingSession[],
  templateId: string,
  templateName: string | undefined,
  predicate: (session: TrainingSession) => boolean,
  limit: number,
) =>
  history
    .filter(predicate)
    .map((session) => matchSessionToTemplate(session, templateId, templateName))
    .filter((item): item is RelatedSession => Boolean(item))
    .sort((left, right) => toTimestamp(right.session.date) - toTimestamp(left.session.date))
    .slice(0, limit);

const confidenceFromMatches = (
  beforeMatches: RelatedSession[],
  afterMatches: RelatedSession[],
  beforeCount: number,
  afterCount: number,
): AdjustmentEffectReview['confidence'] => {
  const exactProgramMatches = [...beforeMatches, ...afterMatches].filter((item) => item.matchedBy === 'programTemplateId').length;
  const fallbackMatches = [...beforeMatches, ...afterMatches].filter((item) => item.matchedBy !== 'programTemplateId').length;
  if (beforeCount >= 2 && afterCount >= 2 && exactProgramMatches >= beforeCount + afterCount - 1) return 'high';
  if (beforeCount >= 1 && afterCount >= 1 && exactProgramMatches + fallbackMatches >= beforeCount + afterCount) return 'medium';
  return 'low';
};

export const reviewAdjustmentEffect = (
  historyItem: ProgramAdjustmentHistoryItem,
  history: TrainingSession[],
  context: AdjustmentReviewContext = {},
): AdjustmentEffectReview => {
  const minBeforeSessions = context.minBeforeSessions ?? 2;
  const minAfterSessions = context.minAfterSessions ?? 2;
  const maxBeforeSessions = context.maxBeforeSessions ?? 4;
  const maxAfterSessions = context.maxAfterSessions ?? 4;
  const appliedAtMs = toTimestamp(historyItem.appliedAt);
  const sourceTemplateName = historyItem.sourceProgramTemplateName;
  const experimentalTemplateName = historyItem.experimentalProgramTemplateName;
  const beforeMatches = collectRelatedSessions(
    history,
    historyItem.sourceProgramTemplateId,
    sourceTemplateName,
    (session) => toTimestamp(session.date) < appliedAtMs,
    maxBeforeSessions,
  );
  const afterMatches = collectRelatedSessions(
    history,
    historyItem.experimentalProgramTemplateId,
    experimentalTemplateName,
    (session) => toTimestamp(session.date) >= appliedAtMs,
    maxAfterSessions,
  );
  const beforeHistory = beforeMatches.map((item) => item.session);
  const afterHistory = afterMatches.map((item) => item.session);
  const confidence = confidenceFromMatches(beforeMatches, afterMatches, beforeHistory.length, afterHistory.length);

  if (!afterHistory.length) {
    return {
      historyItemId: historyItem.id,
      status: 'too_early',
      confidence: 'low',
      summary: '实验模板刚启用，还没有与它对应的训练记录，先继续收集 1-2 次训练数据。',
      metrics: {
        beforeSessionCount: beforeHistory.length,
        afterSessionCount: 0,
      },
      recommendation: 'collect_more_data',
    };
  }

  if (afterHistory.length < minAfterSessions) {
    return {
      historyItemId: historyItem.id,
      status: 'too_early',
      confidence,
      summary: '实验模板的训练次数还太少，现在下结论容易失真，先继续观察一到两次。',
      metrics: {
        beforeSessionCount: beforeHistory.length,
        afterSessionCount: afterHistory.length,
      },
      recommendation: 'collect_more_data',
    };
  }

  if (beforeHistory.length < minBeforeSessions) {
    return {
      historyItemId: historyItem.id,
      status: 'insufficient_data',
      confidence,
      summary: '原模板可对照的数据还不够，暂时不做强判断，建议继续观察。',
      metrics: {
        beforeSessionCount: beforeHistory.length,
        afterSessionCount: afterHistory.length,
      },
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
  const metrics = {
    targetMuscleChange,
    adherenceChange,
    painSignalChange,
    effectiveVolumeChange,
    beforeSessionCount: beforeHistory.length,
    afterSessionCount: afterHistory.length,
  };

  if (painSignalChange >= 3) {
    return {
      historyItemId: historyItem.id,
      status: 'worse',
      confidence,
      summary: '实验模板后不适信号明显上升，先不要硬顶，建议优先人工复核，必要时回滚。',
      metrics,
      recommendation: painSignalChange >= 4 ? 'rollback' : 'review_manually',
    };
  }

  if (adherenceChange <= -15 || effectiveVolumeChange <= -2) {
    return {
      historyItemId: historyItem.id,
      status: 'worse',
      confidence,
      summary: '实验模板后完成度或有效训练量明显下滑，说明这次调整可能过于激进，需要人工复核。',
      metrics,
      recommendation: adherenceChange <= -20 ? 'rollback' : 'review_manually',
    };
  }

  if (targetMuscleChange > 0.5 && adherenceChange >= -5 && painSignalChange <= 1 && effectiveVolumeChange >= 0) {
    return {
      historyItemId: historyItem.id,
      status: 'improved',
      confidence,
      summary: '目标肌群的加权有效组提高了，完成度也稳住了，这次实验调整可以继续观察并保留。',
      metrics,
      recommendation: 'keep',
    };
  }

  return {
    historyItemId: historyItem.id,
    status: 'neutral',
    confidence,
    summary: '实验模板目前没有明显变好或变差，建议继续观察，必要时做小幅人工微调。',
    metrics,
    recommendation: 'review_manually',
  };
};
