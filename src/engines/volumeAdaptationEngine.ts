import type {
  AdherenceReport,
  EffectiveVolumeSummary,
  LoadFeedback,
  LoadFeedbackValue,
  MuscleVolumeDashboardRow,
  PainPattern,
  WeeklyMuscleBudget,
} from '../models/training-model';
import { formatMuscleName } from '../i18n/formatters';
import type { LoadFeedbackSummary } from './loadFeedbackEngine';
import type { SessionQualityResult } from './sessionQualityEngine';
import type { AutoTrainingLevel } from './trainingLevelEngine';
import { number } from './engineUtils';

export type VolumeAdaptationDecision =
  | 'increase'
  | 'maintain'
  | 'decrease'
  | 'hold'
  | 'insufficient_data';

export type MuscleVolumeAdaptation = {
  muscleId: string;
  decision: VolumeAdaptationDecision;
  setsDelta?: number;
  title: string;
  reason: string;
  confidence: 'low' | 'medium' | 'high';
  suggestedActions: string[];
};

export type VolumeAdaptationReport = {
  muscles: MuscleVolumeAdaptation[];
  summary: string;
};

type WeeklyVolumeItem =
  Partial<MuscleVolumeDashboardRow & WeeklyMuscleBudget> & {
    muscleId?: string;
    muscleName?: string;
    muscle?: string;
  };

type WeeklyVolumeInput = WeeklyVolumeItem[] | { muscles?: WeeklyVolumeItem[] } | null | undefined;

type LoadFeedbackInput =
  | LoadFeedback[]
  | LoadFeedbackSummary
  | LoadFeedbackSummary[]
  | Record<string, LoadFeedbackSummary | LoadFeedbackValue | undefined>
  | null
  | undefined;

export type BuildVolumeAdaptationReportParams = {
  weeklyVolumeSummary?: WeeklyVolumeInput;
  effectiveSetSummary?: Partial<EffectiveVolumeSummary> | null;
  adherenceReport?: Partial<AdherenceReport> | null;
  painPatterns?: PainPattern[] | null;
  loadFeedback?: LoadFeedbackInput;
  sessionQualityResults?: SessionQualityResult[] | null;
  trainingLevel?: AutoTrainingLevel | string | null;
};

type NormalizedMuscleVolume = {
  muscleId: string;
  muscleName: string;
  targetSets: number;
  completedSets: number;
  effectiveSets: number;
  highConfidenceEffectiveSets: number;
  weightedEffectiveSets: number;
  remainingSets: number;
  status?: string;
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const roundOne = (value: number) => Math.round(value * 10) / 10;

const normalizeText = (value: unknown) => String(value || '').trim().toLowerCase();

const decisionLabel = (decision: VolumeAdaptationDecision) => {
  if (decision === 'increase') return '增加';
  if (decision === 'decrease') return '减少';
  if (decision === 'hold') return '暂缓';
  if (decision === 'insufficient_data') return '数据不足';
  return '维持';
};

const normalizeWeeklyRows = (
  weeklyVolumeSummary: WeeklyVolumeInput,
  effectiveSetSummary?: Partial<EffectiveVolumeSummary> | null,
): NormalizedMuscleVolume[] => {
  const rows = Array.isArray(weeklyVolumeSummary) ? weeklyVolumeSummary : weeklyVolumeSummary?.muscles || [];
  return rows
    .map<NormalizedMuscleVolume | null>((row) => {
      const muscleId = String(row.muscleId || row.muscle || '').trim();
      if (!muscleId) return null;
      const byMuscle = effectiveSetSummary?.byMuscle?.[muscleId];
      const targetSets = number(row.targetSets ?? row.target ?? row.baseTarget);
      const completedSets = number(byMuscle?.completedSets ?? row.completedSets ?? row.sets);
      const effectiveSets = number(byMuscle?.effectiveSets ?? row.effectiveSets ?? row.sets);
      const highConfidenceEffectiveSets = number(byMuscle?.highConfidenceEffectiveSets ?? row.highConfidenceEffectiveSets);
      const weightedEffectiveSets = number(byMuscle?.weightedEffectiveSets ?? row.weightedEffectiveSets ?? effectiveSets);
      const remainingSets = number(row.remainingSets ?? row.remaining ?? Math.max(0, targetSets - weightedEffectiveSets));

      const normalized: NormalizedMuscleVolume = {
        muscleId,
        muscleName: row.muscleName || formatMuscleName(muscleId),
        targetSets,
        completedSets,
        effectiveSets,
        highConfidenceEffectiveSets,
        weightedEffectiveSets,
        remainingSets,
        status: row.status ? String(row.status) : undefined,
      };
      return normalized;
    })
    .filter((row): row is NormalizedMuscleVolume => row !== null);
};

const isLoadFeedbackSummary = (value: unknown): value is LoadFeedbackSummary =>
  typeof value === 'object' && value !== null && 'counts' in value && 'adjustment' in value;

const normalizeLoadFeedback = (input: LoadFeedbackInput) => {
  const values: LoadFeedbackValue[] = [];
  const addValue = (value?: unknown, count = 1) => {
    if (value === 'too_heavy' || value === 'too_light' || value === 'good') {
      for (let index = 0; index < count; index += 1) values.push(value);
    }
  };
  const addSummary = (summary?: LoadFeedbackSummary) => {
    if (!summary) return;
    addValue('too_heavy', number(summary.counts?.too_heavy));
    addValue('too_light', number(summary.counts?.too_light));
    addValue('good', number(summary.counts?.good));
    addValue(summary.dominantFeedback);
    addValue(summary.adjustment?.dominantFeedback);
  };

  if (Array.isArray(input)) {
    input.forEach((item) => {
      if ('feedback' in item) addValue(item.feedback);
      else addSummary(item);
    });
  } else if (isLoadFeedbackSummary(input)) {
    addSummary(input);
  } else if (input && typeof input === 'object') {
    Object.values(input).forEach((item) => {
      if (typeof item === 'string') addValue(item);
      else addSummary(item);
    });
  }

  const total = values.length;
  const tooHeavy = values.filter((item) => item === 'too_heavy').length;
  const good = values.filter((item) => item === 'good').length;

  return {
    total,
    tooHeavy,
    good,
    tooHeavyRate: total ? tooHeavy / total : 0,
  };
};

const hasPainRisk = (row: NormalizedMuscleVolume, painPatterns: PainPattern[] = []) => {
  const muscleId = normalizeText(row.muscleId);
  const muscleName = normalizeText(row.muscleName);
  return painPatterns.some((pattern) => {
    const area = normalizeText(pattern.area);
    const actionRisk = pattern.suggestedAction === 'substitute' || pattern.suggestedAction === 'deload';
    const severityRisk = number(pattern.frequency) >= 2 || number(pattern.severityAvg) >= 3.5;
    return (area === muscleId || area === muscleName || muscleName.includes(area) || area.includes(muscleName)) && (actionRisk || severityRisk);
  });
};

const qualitySummary = (results: SessionQualityResult[] = []) => {
  const total = results.length;
  const low = results.filter((item) => item.level === 'low').length;
  const highOrMedium = results.filter((item) => item.level === 'high' || item.level === 'medium').length;
  const poorTechnique = results.some((item) =>
    [...(item.issues || []), ...(item.positives || [])].some((signal) => `${signal.label}${signal.reason}`.includes('动作质量') && signal.tone !== 'positive'),
  );
  return {
    total,
    hasLowQuality: total > 0 && low / total >= 0.34,
    stableEnough: total === 0 || highOrMedium / total >= 0.67,
    poorTechnique,
  };
};

const evidenceRatio = (row: NormalizedMuscleVolume) => {
  if (row.targetSets <= 0) return row.weightedEffectiveSets > 0 ? 2 : 0;
  return row.weightedEffectiveSets / row.targetSets;
};

const volumeIsLow = (row: NormalizedMuscleVolume) => row.status === 'low' || evidenceRatio(row) < 0.75;
const volumeIsNearTarget = (row: NormalizedMuscleVolume) =>
  row.status === 'near_target' || row.status === 'on_target' || (evidenceRatio(row) >= 0.75 && evidenceRatio(row) <= 1.15);
const volumeIsHigh = (row: NormalizedMuscleVolume) => row.status === 'high' || evidenceRatio(row) > 1.15;

const increaseDelta = (row: NormalizedMuscleVolume) => clamp(Math.ceil(Math.max(1, row.remainingSets) / 3), 1, 2);
const decreaseDelta = (row: NormalizedMuscleVolume, strongRisk: boolean) => -clamp(strongRisk || evidenceRatio(row) > 1.3 ? 2 : 1, 1, 2);

const confidenceFor = (
  decision: VolumeAdaptationDecision,
  row: NormalizedMuscleVolume,
  adherenceReport?: Partial<AdherenceReport> | null,
): MuscleVolumeAdaptation['confidence'] => {
  if (decision === 'insufficient_data') return 'low';
  if (decision === 'hold') return 'low';
  if (number(adherenceReport?.recentSessionCount) >= 4 && row.completedSets >= 4) return 'high';
  return 'medium';
};

const buildDecision = ({
  row,
  decision,
  setsDelta,
  reason,
  confidence,
}: {
  row: NormalizedMuscleVolume;
  decision: VolumeAdaptationDecision;
  setsDelta?: number;
  reason: string;
  confidence: MuscleVolumeAdaptation['confidence'];
}): MuscleVolumeAdaptation => {
  const label = decisionLabel(decision);
  const volumeText = row.targetSets > 0
    ? `当前约 ${roundOne(row.weightedEffectiveSets)}/${roundOne(row.targetSets)} 组。`
    : `当前约 ${roundOne(row.weightedEffectiveSets)} 组。`;
  const suggestedActionsByDecision: Record<VolumeAdaptationDecision, string[]> = {
    increase: [
      `下周只给${row.muscleName}增加 ${setsDelta} 组，先观察完成度和不适反馈。`,
      '优先把新增组放在动作质量稳定的训练日。',
    ],
    maintain: [
      `下周维持${row.muscleName}当前训练量。`,
      '继续记录余力（RIR）和动作质量，用于下次复核。',
    ],
    decrease: [
      `下周先给${row.muscleName}减少 ${Math.abs(setsDelta || 1)} 组。`,
      '优先保留关键主训练，减少额外辅助量。',
    ],
    hold: [
      `暂缓调整${row.muscleName}训练量，继续收集记录。`,
      '本周不要自动改计划，等数据更稳定后再进入计划调整预览。',
    ],
    insufficient_data: [
      `继续记录${row.muscleName}的完成组、有效组、余力（RIR）和动作质量。`,
    ],
  };

  return {
    muscleId: row.muscleId,
    decision,
    setsDelta,
    title: `${row.muscleName}：${label}训练量`,
    reason: `${reason}${volumeText}`,
    confidence,
    suggestedActions: suggestedActionsByDecision[decision],
  };
};

export const buildVolumeAdaptationReport = ({
  weeklyVolumeSummary,
  effectiveSetSummary,
  adherenceReport,
  painPatterns = [],
  loadFeedback,
  sessionQualityResults = [],
  trainingLevel,
}: BuildVolumeAdaptationReportParams): VolumeAdaptationReport => {
  const rows = normalizeWeeklyRows(weeklyVolumeSummary, effectiveSetSummary);
  const feedback = normalizeLoadFeedback(loadFeedback);
  const quality = qualitySummary(sessionQualityResults || []);
  const trainingLevelUnknown = !trainingLevel || trainingLevel === 'unknown';
  const recentSessionCount = number(adherenceReport?.recentSessionCount);
  const overallRate = number(adherenceReport?.overallRate);
  const mainlineRate = number(adherenceReport?.mainlineRate ?? adherenceReport?.overallRate);
  const adherenceGood = !adherenceReport || (overallRate >= 80 && mainlineRate >= 80);
  const adherencePoor = Boolean(adherenceReport) && (overallRate > 0 && overallRate < 65 || mainlineRate > 0 && mainlineRate < 65);
  const dataSparse = Boolean(adherenceReport) && recentSessionCount > 0 && recentSessionCount < 2;

  if (!rows.length) {
    return {
      muscles: [],
      summary: '训练量数据不足，暂时无法判断下周每个肌群应该增加、维持或减少。',
    };
  }

  const muscles = rows.map((row) => {
    const noVolumeEvidence = row.targetSets <= 0 && row.completedSets <= 0 && row.effectiveSets <= 0 && row.weightedEffectiveSets <= 0;
    const painRisk = hasPainRisk(row, painPatterns || []);
    const heavyFeedbackRisk = feedback.tooHeavy >= 2 && feedback.tooHeavyRate >= 0.4;
    const qualityRisk = quality.hasLowQuality || quality.poorTechnique;
    const strongRisk = painRisk || adherencePoor || heavyFeedbackRisk || qualityRisk;

    if (noVolumeEvidence || dataSparse) {
      return buildDecision({
        row,
        decision: 'insufficient_data',
        reason: '可用训练量和完成度记录还不够，暂时不建议调整。',
        confidence: 'low',
      });
    }

    if (trainingLevelUnknown) {
      return buildDecision({
        row,
        decision: 'hold',
        setsDelta: 0,
        reason: '系统仍在建立训练基线，暂时不建议直接增减训练量。',
        confidence: 'low',
      });
    }

    if (strongRisk || volumeIsHigh(row)) {
      const reasons = [
        volumeIsHigh(row) ? '训练量已经偏高' : '',
        painRisk ? '近期有相关不适信号' : '',
        adherencePoor ? '近期完成率下降' : '',
        heavyFeedbackRisk ? '重量反馈多次偏重' : '',
        qualityRisk ? '训练质量或动作质量不够稳定' : '',
      ].filter(Boolean);

      return buildDecision({
        row,
        decision: 'decrease',
        setsDelta: decreaseDelta(row, strongRisk),
        reason: `${reasons.join('，')}，下周先保守处理。`,
        confidence: confidenceFor('decrease', row, adherenceReport),
      });
    }

    if (volumeIsLow(row) && adherenceGood && quality.stableEnough) {
      return buildDecision({
        row,
        decision: 'increase',
        setsDelta: increaseDelta(row),
        reason: '该肌群低于目标，但近期完成度和训练质量可以支持小幅加量。',
        confidence: confidenceFor('increase', row, adherenceReport),
      });
    }

    if (volumeIsNearTarget(row)) {
      return buildDecision({
        row,
        decision: 'maintain',
        setsDelta: 0,
        reason: '该肌群有效组接近目标，当前更适合维持训练量。',
        confidence: confidenceFor('maintain', row, adherenceReport),
      });
    }

    return buildDecision({
      row,
      decision: 'hold',
      setsDelta: 0,
      reason: '当前信号不够一致，暂时不建议主动增减训练量。',
      confidence: confidenceFor('hold', row, adherenceReport),
    });
  });

  const count = (decision: VolumeAdaptationDecision) => muscles.filter((item) => item.decision === decision).length;
  const summaryParts = [
    count('increase') ? `增加 ${count('increase')} 个肌群` : '',
    count('maintain') ? `维持 ${count('maintain')} 个肌群` : '',
    count('decrease') ? `减少 ${count('decrease')} 个肌群` : '',
    count('hold') ? `暂缓 ${count('hold')} 个肌群` : '',
    count('insufficient_data') ? `数据不足 ${count('insufficient_data')} 个肌群` : '',
  ].filter(Boolean);

  return {
    muscles,
    summary: summaryParts.length
      ? `下周训练量建议：${summaryParts.join('，')}。所有调整都只作为建议，需要用户确认后才进入计划调整预览。`
      : '训练量数据不足，暂时无法判断下周每个肌群应该增加、维持或减少。',
  };
};
