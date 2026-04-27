import { DEFINITIONS } from '../../content/definitions';
import { sanitizeCopy } from '../../content/professionalCopy';
import type {
  AdherenceAdjustment,
  AdherenceReport,
  ExplanationItem,
  PainPattern,
  TrainingSession,
  WeeklyActionRecommendation,
  WeeklyPrescription,
} from '../../models/training-model';
import { completedSets, number } from '../engineUtils';
import { buildEffectiveVolumeSummary } from '../effectiveSetEngine';
import { formatMaybeDecimal, makeExplanationItem } from './shared';

interface WeeklyCoachReviewInput {
  history: TrainingSession[];
  weeklyPrescription: WeeklyPrescription;
  adherenceReport: AdherenceReport;
  adherenceAdjustment: AdherenceAdjustment;
  painPatterns?: PainPattern[];
  weeklyActions?: WeeklyActionRecommendation[];
  plannedSessionsPerWeek?: number;
}

export const buildWeeklyActionExplanation = (recommendation: WeeklyActionRecommendation): ExplanationItem =>
  makeExplanationItem(
    '下周行动建议',
    recommendation.recommendation,
    recommendation.reason || recommendation.issue,
    recommendation.suggestedChange
      ? '这只是计划微调预览，不会自动修改模板；确认后再手动应用。'
      : '先按当前训练记录继续观察，等数据更稳定后再提高调整置信度。',
    recommendation.evidenceRuleIds || ['weekly_volume_distribution'],
    recommendation.confidence === 'high' ? 'high' : recommendation.confidence === 'medium' ? 'moderate' : 'low'
  );

export const explainMuscleVolumeAction = (recommendation: WeeklyActionRecommendation) => {
  const delta = number(recommendation.suggestedChange?.setsDelta);
  if (delta > 0) {
    return `建议补量：${recommendation.reason || recommendation.issue}`;
  }
  if (delta < 0) {
    return `建议减少训练量：${recommendation.reason || recommendation.issue}`;
  }
  return `建议维持：${recommendation.reason || recommendation.issue}`;
};

export const buildWeeklyCoachReview = ({
  history,
  weeklyPrescription,
  adherenceReport,
  adherenceAdjustment,
  painPatterns,
  weeklyActions,
  plannedSessionsPerWeek = 4,
}: WeeklyCoachReviewInput) => {
  const recentSessions = history.slice(0, 7);
  const lines: string[] = [];
  const effectiveSummary = buildEffectiveVolumeSummary(recentSessions);

  lines.push(`本周完成 ${recentSessions.length} / ${plannedSessionsPerWeek} 次训练，主训练完成率 ${adherenceReport.mainlineRate}%。`);
  lines.push(`本周主训练完成 ${effectiveSummary.completedSets} 组，其中有效组 ${effectiveSummary.effectiveSets} 组，高置信有效组 ${effectiveSummary.highConfidenceEffectiveSets} 组。`);

  if (typeof adherenceReport.correctionRate === 'number' || typeof adherenceReport.functionalRate === 'number') {
    lines.push(
      `纠偏模块完成率 ${typeof adherenceReport.correctionRate === 'number' ? `${adherenceReport.correctionRate}%` : '数据不足'}，功能补丁完成率 ${
        typeof adherenceReport.functionalRate === 'number' ? `${adherenceReport.functionalRate}%` : '数据不足'
      }。`
    );
  }

  const biggestGap = [...weeklyPrescription.muscles]
    .filter((item) => number(item.remaining) > 0)
    .sort((left, right) => number(right.remaining) - number(left.remaining))
    .slice(0, 2);
  if (biggestGap.length) {
    lines.push(`周剂量还需要关注：${biggestGap.map((item) => `${item.muscle} 还差 ${formatMaybeDecimal(item.remaining)} 组`).join('；')}。`);
  } else {
    lines.push('本周主要肌群剂量基本达标，下周重点放在动作质量和恢复稳定性。');
  }

  const poorTechniqueExercises = recentSessions
    .flatMap((session) =>
      session.exercises
        .filter((exercise) => completedSets(exercise).some((set) => set.techniqueQuality === 'poor'))
        .map((exercise) => exercise.alias || exercise.name)
    )
    .slice(0, 2);
  if (poorTechniqueExercises.length) {
    lines.push(`${poorTechniqueExercises.join('、')} 最近更像是动作质量问题，不建议只靠加重量解决。`);
  }

  const dominantPainPattern = painPatterns?.[0];
  if (dominantPainPattern) {
    lines.push(`${dominantPainPattern.area} 最近出现重复不适信号，建议下周优先使用更稳定的替代动作，并提高保守等级。${DEFINITIONS.medicalBoundary.body}`);
  }

  if (adherenceAdjustment.reasons.length) {
    lines.push(`下周自动调整：${adherenceAdjustment.reasons[0]}。`);
  } else if (adherenceReport.overallRate >= 85) {
    lines.push('最近执行度稳定，下周可以继续按当前结构推进，不需要额外收缩内容。');
  }

  const topActions = (weeklyActions || []).filter((item) => item.priority !== 'low').slice(0, 3);
  if (topActions.length) {
    lines.push(`下周优先动作：${topActions.map((item) => item.recommendation).join('；')}`);
  } else if (!recentSessions.length) {
    lines.push('需要更多训练记录后，系统才能给出高置信的下周行动建议。');
  }

  return lines.map(sanitizeCopy).slice(0, 6);
};
