import type { EffectiveVolumeSummary } from '../models/training-model';

export type ProgressInsightState =
  | 'improving'
  | 'stable'
  | 'fatigue_risk'
  | 'recovery_recommended'
  | 'data_insufficient'
  | 'mixed';

export type ProgressTrendDirection = 'improving' | 'stable' | 'declining' | 'mixed' | 'unknown';
export type ProgressRecoveryPressure = 'normal' | 'high' | 'recovery' | 'unknown';
export type ProgressDataCoverageStatus = 'sufficient' | 'limited' | 'insufficient';

export type ProgressStrengthTrendItem = {
  id: string;
  label: string;
  currentLabel: string;
  bestLabel?: string;
  trend: ProgressTrendDirection;
  explanation: string;
};

export type ProgressVolumeSummary = {
  thisMonthSessions?: number;
  recentFourWeekAverage?: number;
  completedSets?: number;
  painSessionCount?: number;
  monthVolumeLabel?: string;
};

export type ProgressClaritySummaryInput = {
  strengthTrend?: ProgressTrendDirection;
  recoveryPressure?: ProgressRecoveryPressure;
  dataCoverageStatus?: ProgressDataCoverageStatus;
  effectiveSetSummary?: Pick<
    EffectiveVolumeSummary,
    'completedSets' | 'effectiveSets' | 'highConfidenceEffectiveSets' | 'mediumConfidenceEffectiveSets' | 'lowConfidenceEffectiveSets'
  >;
  volumeSummary?: ProgressVolumeSummary;
  strengthTrendItems?: ProgressStrengthTrendItem[];
};

export type ProgressClaritySummaryResult = {
  insightState: ProgressInsightState;
  heroTitle: string;
  heroExplanation: string;
  primaryRecommendation: string;
  readinessLabel: string;
  recoveryPressureLabel: string;
  strengthTrendItems: ProgressStrengthTrendItem[];
  effectiveSetExplanation: string;
  volumeExplanation: string;
  dataCoverageHint: string;
  caution?: string;
  sourceOfTruthChanged: false;
  trainingAlgorithmChanged: false;
  calculationChanged: false;
};

const roundOne = (value: number) => Math.round(value * 10) / 10;

const inferTrend = (input: ProgressClaritySummaryInput): ProgressTrendDirection => {
  if (input.strengthTrend) return input.strengthTrend;
  const items = input.strengthTrendItems || [];
  if (!items.length) return 'unknown';
  if (items.some((item) => item.trend === 'improving')) return 'improving';
  if (items.some((item) => item.trend === 'declining')) return 'declining';
  if (items.every((item) => item.trend === 'stable' || item.trend === 'unknown')) return 'stable';
  return 'mixed';
};

const inferRecoveryPressure = (input: ProgressClaritySummaryInput): ProgressRecoveryPressure => {
  if (input.recoveryPressure) return input.recoveryPressure;
  const effectiveSets = input.effectiveSetSummary?.effectiveSets || 0;
  const completedSets = input.effectiveSetSummary?.completedSets || input.volumeSummary?.completedSets || 0;
  const painSessions = input.volumeSummary?.painSessionCount || 0;
  if (painSessions > 0 || effectiveSets >= 24 || completedSets >= 32) return 'high';
  if (effectiveSets <= 0 && completedSets <= 0) return 'unknown';
  return 'normal';
};

const hasEnoughData = (input: ProgressClaritySummaryInput) => {
  if (input.dataCoverageStatus === 'insufficient') return false;
  const hasStrengthData = (input.strengthTrendItems || []).some((item) => item.trend !== 'unknown' || !/暂无|不足/.test(item.currentLabel));
  const hasSetData = (input.effectiveSetSummary?.completedSets || 0) > 0 || (input.volumeSummary?.completedSets || 0) > 0;
  return input.dataCoverageStatus === 'sufficient' || hasStrengthData || hasSetData;
};

const buildEffectiveSetExplanation = (input: ProgressClaritySummaryInput, pressure: ProgressRecoveryPressure) => {
  const summary = input.effectiveSetSummary;
  if (!summary || summary.completedSets <= 0) return '有效组数据不足。完成几次正式训练后，这里会解释训练刺激和恢复压力。';
  const confidenceCopy = summary.highConfidenceEffectiveSets > 0
    ? `${summary.highConfidenceEffectiveSets} 组为高置信有效组`
    : '高置信有效组还不多';
  if (pressure === 'high') {
    return `本期有效组 ${summary.effectiveSets} / 完成组 ${summary.completedSets}，${confidenceCopy}。训练刺激偏高时，恢复压力可能增加。`;
  }
  return `本期有效组 ${summary.effectiveSets} / 完成组 ${summary.completedSets}，${confidenceCopy}。这些数字用于解释趋势，不会改变训练计划。`;
};

const buildVolumeExplanation = (input: ProgressClaritySummaryInput, pressure: ProgressRecoveryPressure) => {
  const volume = input.volumeSummary || {};
  const frequency = Number.isFinite(volume.recentFourWeekAverage) ? `近 4 周平均 ${roundOne(volume.recentFourWeekAverage || 0)} 次/周` : '近 4 周频率数据不足';
  const month = Number.isFinite(volume.thisMonthSessions) ? `本月 ${volume.thisMonthSessions} 次训练` : '本月训练次数不足';
  const pain = (volume.painSessionCount || 0) > 0 ? `，有 ${volume.painSessionCount} 次训练带不适标记` : '';
  if (pressure === 'high') return `${month}，${frequency}${pain}。建议先保持重量或减少一组，观察恢复。`;
  if (pressure === 'recovery') return `${month}，${frequency}${pain}。当前更适合恢复优先，避免把趋势解释成必须加量。`;
  return `${month}，${frequency}${pain}。训练量解释只用于阅读状态，不会自动调整处方。`;
};

const stateCopy = (
  trend: ProgressTrendDirection,
  pressure: ProgressRecoveryPressure,
  dataSufficient: boolean,
): Pick<ProgressClaritySummaryResult, 'insightState' | 'heroTitle' | 'heroExplanation' | 'primaryRecommendation' | 'readinessLabel' | 'recoveryPressureLabel' | 'caution'> => {
  if (!dataSufficient) {
    return {
      insightState: 'data_insufficient',
      heroTitle: '数据不足，先继续记录',
      heroExplanation: '目前还不能可靠判断力量趋势或恢复压力。完成几次正常训练后，Progress 会给出更明确的解释。',
      primaryRecommendation: '继续观察',
      readinessLabel: '数据不足',
      recoveryPressureLabel: '压力未知',
      caution: '不要用少量记录推断长期趋势。',
    };
  }

  if (pressure === 'recovery') {
    return {
      insightState: 'recovery_recommended',
      heroTitle: '恢复优先，训练保持保守',
      heroExplanation: '当前记录显示恢复压力需要优先处理。Progress 只给出解释，不会改变计划或训练规则。',
      primaryRecommendation: '优先恢复',
      readinessLabel: '建议恢复',
      recoveryPressureLabel: '压力偏高',
      caution: '下次训练先降低强度或减少一组。',
    };
  }

  if (trend === 'improving' && pressure === 'high') {
    return {
      insightState: 'fatigue_risk',
      heroTitle: '力量有进步，但恢复压力偏高',
      heroExplanation: 'PR / e1RM 趋势仍在推进，不过有效组、训练量或不适信号提示恢复成本上升。',
      primaryRecommendation: '保持重量',
      readinessLabel: '建议保守',
      recoveryPressureLabel: '压力偏高',
      caution: '先稳住动作质量，再决定是否加重。',
    };
  }

  if (trend === 'improving') {
    return {
      insightState: 'improving',
      heroTitle: '力量趋势正在上升',
      heroExplanation: '现有 PR / e1RM 记录显示主要动作有推进，恢复压力目前没有明显升高。',
      primaryRecommendation: '保守加重',
      readinessLabel: '状态正常',
      recoveryPressureLabel: '压力正常',
    };
  }

  if (trend === 'stable') {
    return {
      insightState: 'stable',
      heroTitle: '表现稳定，继续观察',
      heroExplanation: '主要动作暂时没有明显上升或下降。稳定不是失败，先保持训练质量和记录完整性。',
      primaryRecommendation: '继续观察',
      readinessLabel: pressure === 'high' ? '建议保守' : '状态正常',
      recoveryPressureLabel: pressure === 'high' ? '压力偏高' : '压力正常',
    };
  }

  return {
    insightState: 'mixed',
    heroTitle: '趋势混合，需要结合恢复看',
    heroExplanation: '不同指标给出的信号不完全一致。先看主要动作，再看有效组、训练量和不适记录。',
    primaryRecommendation: pressure === 'high' ? '减少一组' : '保持重量',
    readinessLabel: pressure === 'high' ? '建议保守' : '状态正常',
    recoveryPressureLabel: pressure === 'high' ? '压力偏高' : '压力正常',
  };
};

export const buildProgressClaritySummary = (input: ProgressClaritySummaryInput = {}): ProgressClaritySummaryResult => {
  const trend = inferTrend(input);
  const pressure = inferRecoveryPressure(input);
  const dataSufficient = hasEnoughData(input);
  const copy = stateCopy(trend, pressure, dataSufficient);

  return {
    ...copy,
    strengthTrendItems: input.strengthTrendItems || [],
    effectiveSetExplanation: buildEffectiveSetExplanation(input, pressure),
    volumeExplanation: buildVolumeExplanation(input, pressure),
    dataCoverageHint: dataSufficient
      ? '使用现有正常训练记录生成解释；PR、e1RM、有效组和训练量计算保持不变。'
      : '数据不足时只显示保守解释，不做趋势过度判断。',
    sourceOfTruthChanged: false,
    trainingAlgorithmChanged: false,
    calculationChanged: false,
  };
};
