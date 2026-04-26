import type { AdherenceAdjustment, AdherenceReport, AdaptiveState, ProgramTemplate } from '../models/training-model';

const hasSuggestionReason = (report: AdherenceReport, keyword: string) =>
  report.skippedSupportExercises.some((item) => item.mostCommonReason === keyword) ||
  report.skippedExercises.some((item) => item.mostCommonReason === keyword);

export const buildAdherenceAdjustment = (
  adherenceReport: AdherenceReport,
  currentProgramTemplate: Pick<ProgramTemplate, 'correctionStrategy' | 'functionalStrategy' | 'daysPerWeek'>,
  adaptiveState?: AdaptiveState
): AdherenceAdjustment => {
  const reasons: string[] = [];
  let complexityLevel: AdherenceAdjustment['complexityLevel'] = 'normal';
  let correctionDoseAdjustment: AdherenceAdjustment['correctionDoseAdjustment'] = 'keep';
  let functionalDoseAdjustment: AdherenceAdjustment['functionalDoseAdjustment'] = 'keep';
  let weeklyVolumeMultiplier = 1;
  let sessionDurationHint: number | undefined;

  if (adherenceReport.overallRate < 70) {
    complexityLevel = 'reduced';
    reasons.push('最近整体完成率偏低，下周先把计划做得更容易执行。');
  }

  if (adherenceReport.mainlineRate < 75) {
    weeklyVolumeMultiplier = 0.85;
    reasons.push('主训练完成率下降，周训练量先下修 10%–20%。');
  }

  if ((adherenceReport.correctionRate ?? 100) < 60) {
    correctionDoseAdjustment = 'minimal';
    reasons.push('纠偏完成率偏低，先退到 minimum effective dose。');
  } else if ((adherenceReport.correctionRate ?? 100) < 75) {
    correctionDoseAdjustment = 'reduce';
  }

  if ((adherenceReport.functionalRate ?? 100) < 60) {
    functionalDoseAdjustment = 'remove_optional';
    reasons.push('功能补丁完成率偏低，先只保留最关键的 1 个。');
  } else if ((adherenceReport.functionalRate ?? 100) < 75) {
    functionalDoseAdjustment = 'reduce';
  }

  if (hasSuggestionReason(adherenceReport, 'time')) {
    complexityLevel = adherenceReport.overallRate < 55 ? 'minimal' : complexityLevel;
    sessionDurationHint = 30;
    reasons.push('最近主要是时间不够，优先缩短训练，而不是只靠压重量。');
  }

  if (hasSuggestionReason(adherenceReport, 'too_tired')) {
    weeklyVolumeMultiplier = Math.min(weeklyVolumeMultiplier, 0.9);
    reasons.push('疲劳是主要掉队原因，下周减少一点总负荷。');
  }

  if (hasSuggestionReason(adherenceReport, 'pain') || (adaptiveState?.performanceDrops || []).length >= 2) {
    weeklyVolumeMultiplier = Math.min(weeklyVolumeMultiplier, 0.9);
    correctionDoseAdjustment = correctionDoseAdjustment === 'keep' ? 'reduce' : correctionDoseAdjustment;
    reasons.push('近期有疼痛或动作掉速信号，先走更保守的计划。');
  }

  if (adherenceReport.overallRate >= 85 && adherenceReport.mainlineRate >= 85 && (adherenceReport.confidence === 'high' || adherenceReport.confidence === 'medium')) {
    weeklyVolumeMultiplier = Math.max(weeklyVolumeMultiplier, 1);
    reasons.push('最近完成率稳定，可以继续按正常复杂度推进。');
  }

  if (complexityLevel === 'reduced' && adherenceReport.overallRate < 55) complexityLevel = 'minimal';
  if (!reasons.length) reasons.push('最近执行度稳定，继续保持当前复杂度。');

  return {
    complexityLevel,
    correctionDoseAdjustment,
    functionalDoseAdjustment,
    weeklyVolumeMultiplier,
    sessionDurationHint,
    reasons,
  };
};
