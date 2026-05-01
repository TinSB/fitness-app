import type {
  EffectiveVolumeSummary,
  LoadFeedback,
  LoadFeedbackValue,
  PainPattern,
  TrainingSession,
  TrainingSetLog,
  UnitSettings,
} from '../models/training-model';
import type { LoadFeedbackSummary } from './loadFeedbackEngine';
import { completedSets, number, setWeightKg } from './engineUtils';
import { buildEffectiveVolumeSummary } from './effectiveSetEngine';
import { buildWorkingOnlySession, groupSessionSetsByType } from './sessionDetailSummaryEngine';

export type SessionQualityLevel = 'high' | 'medium' | 'low' | 'insufficient_data';

export type SessionQualitySignal = {
  id: string;
  label: string;
  tone: 'positive' | 'neutral' | 'warning' | 'negative';
  reason: string;
};

export type SessionQualityResult = {
  level: SessionQualityLevel;
  score: number;
  title: string;
  summary: string;
  positives: SessionQualitySignal[];
  issues: SessionQualitySignal[];
  nextSuggestions: string[];
  confidence: 'low' | 'medium' | 'high';
};

type LoadFeedbackInput =
  | LoadFeedback[]
  | LoadFeedbackSummary
  | LoadFeedbackSummary[]
  | Record<string, LoadFeedbackSummary | LoadFeedbackValue | undefined>
  | null
  | undefined;

export type BuildSessionQualityParams = {
  session: TrainingSession;
  effectiveSetSummary?: Partial<EffectiveVolumeSummary> | null;
  loadFeedback?: LoadFeedbackInput;
  painPatterns?: PainPattern[] | null;
  unitSettings?: UnitSettings;
};

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));
const roundScore = (value: number) => Math.round(clamp(value));

const isCompletedSet = (set: TrainingSetLog) => set.done !== false && setWeightKg(set) > 0 && number(set.reps) > 0;

const hasRecordedRir = (set: TrainingSetLog) => set.rir !== undefined && set.rir !== '';

const levelLabel = (level: SessionQualityLevel) => {
  if (level === 'high') return '高';
  if (level === 'medium') return '中等';
  if (level === 'low') return '偏低';
  return '数据不足';
};

const dataFlagLabel = (flag?: TrainingSession['dataFlag']) => {
  if (flag === 'test') return '测试数据';
  if (flag === 'excluded') return '排除数据';
  return '';
};

const isLoadFeedbackSummary = (value: unknown): value is LoadFeedbackSummary =>
  typeof value === 'object' && value !== null && 'counts' in value && 'adjustment' in value;

const normalizeLoadFeedback = (input: LoadFeedbackInput, session: TrainingSession) => {
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

  (session.loadFeedback || []).forEach((item) => addValue(item.feedback));
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

  return {
    tooHeavy: values.filter((item) => item === 'too_heavy').length,
    tooLight: values.filter((item) => item === 'too_light').length,
    good: values.filter((item) => item === 'good').length,
  };
};

const makeSignal = (
  id: string,
  label: string,
  tone: SessionQualitySignal['tone'],
  reason: string,
): SessionQualitySignal => ({ id, label, tone, reason });

const unique = (items: string[]) => [...new Set(items.filter(Boolean))];

export const buildSessionQualityResult = ({
  session,
  effectiveSetSummary,
  loadFeedback,
  painPatterns,
}: BuildSessionQualityParams): SessionQualityResult => {
  const grouped = groupSessionSetsByType(session);
  const completedWorkingSets = grouped.workingSets.filter((item) => isCompletedSet(item.set));
  const completedWarmupSets = grouped.warmupSets.filter((item) => isCompletedSet(item.set));
  const supportPlanned = grouped.supportSets.reduce((sum, item) => sum + Math.max(0, number(item.plannedSets)), 0);
  const supportCompleted = grouped.supportSets.reduce((sum, item) => sum + Math.max(0, number(item.completedSets)), 0);
  const plannedWorkingSets = grouped.exerciseGroups.reduce((sum, group) => {
    const prescribed = number(group.exercise.prescription?.sets);
    if (prescribed > 0) return sum + prescribed;
    if (typeof group.exercise.sets === 'number') return sum + Math.max(0, number(group.exercise.sets));
    return sum + Math.max(group.workingSets.length, completedSets(group.exercise).filter((set) => set.type !== 'warmup').length);
  }, 0);
  const skippedMainSets = grouped.workingSets.filter((item) => item.set.done === false).length;
  const supportSkipped = grouped.supportSets.filter((item) => number(item.completedSets) < number(item.plannedSets)).length;
  const totalCompletedSets = completedWorkingSets.length + supportCompleted;

  if (totalCompletedSets <= 0) {
    const flag = dataFlagLabel(session.dataFlag);
    return {
      level: 'insufficient_data',
      score: 0,
      title: '本次训练质量：数据不足',
      summary: flag
        ? `这次训练已标记为${flag}，且没有可评估的正式组或辅助完成记录。`
        : '没有可评估的正式组或辅助完成记录，暂时不能判断本次训练质量。',
      positives: completedWarmupSets.length
        ? [makeSignal('warmup-visible', '热身记录完整', 'neutral', `已记录 ${completedWarmupSets.length} 组热身，但热身组不作为高质量有效组。`)]
        : [],
      issues: [makeSignal('insufficient-data', '数据不足', 'warning', '缺少正式训练完成记录，无法稳定评价训练质量。')],
      nextSuggestions: ['下次优先完成并记录正式组的重量、次数、余力（RIR）和动作质量。'],
      confidence: 'low',
    };
  }

  const computedEffectiveSummary =
    effectiveSetSummary || buildEffectiveVolumeSummary([buildWorkingOnlySession(session)]);
  const effectiveSets = Math.max(0, number(computedEffectiveSummary.effectiveSets));
  const highConfidenceEffectiveSets = Math.max(0, number(computedEffectiveSummary.highConfidenceEffectiveSets));
  const effectiveCompletedSets = Math.max(completedWorkingSets.length, number(computedEffectiveSummary.completedSets));

  const mainCompletionRate = plannedWorkingSets > 0 ? completedWorkingSets.length / plannedWorkingSets : completedWorkingSets.length ? 1 : 0;
  const supportCompletionRate = supportPlanned > 0 ? supportCompleted / supportPlanned : 1;
  const completionScore = clamp((mainCompletionRate * 0.8 + supportCompletionRate * 0.2) * 100);

  const effectiveRate = effectiveCompletedSets > 0 ? effectiveSets / effectiveCompletedSets : 0;
  const highConfidenceRate = effectiveSets > 0 ? highConfidenceEffectiveSets / effectiveSets : 0;
  const effectiveQualityScore = clamp((effectiveRate * 0.65 + highConfidenceRate * 0.35) * 100);

  const poorTechniqueSets = completedWorkingSets.filter((item) => item.set.techniqueQuality === 'poor');
  const goodTechniqueSets = completedWorkingSets.filter((item) => item.set.techniqueQuality === 'good');
  const painSets = completedWorkingSets.filter((item) => item.set.painFlag);
  const missingRirSets = completedWorkingSets.filter((item) => !hasRecordedRir(item.set));
  const abnormalInputSets = completedWorkingSets.filter((item) => {
    const rir = item.set.rir === undefined || item.set.rir === '' ? undefined : number(item.set.rir);
    return number(item.set.reps) > 50 || (rir !== undefined && (rir < 0 || rir > 10));
  });
  const exerciseIds = new Set(
    grouped.exerciseGroups.flatMap((group) => [
      group.exercise.id,
      group.exercise.actualExerciseId,
      group.exercise.replacementExerciseId,
      group.exercise.originalExerciseId,
      group.exercise.baseId,
    ].filter(Boolean).map(String))
  );
  const matchedPainPatterns = (painPatterns || []).filter((pattern) =>
    (pattern.exerciseId && exerciseIds.has(pattern.exerciseId)) || number(pattern.severityAvg) >= 3.5
  );
  const feedback = normalizeLoadFeedback(loadFeedback, session);

  const painRate = painSets.length / Math.max(1, completedWorkingSets.length);
  const poorTechniqueRate = poorTechniqueSets.length / Math.max(1, completedWorkingSets.length);
  const safetyScore = clamp(
    100 -
      painRate * 45 -
      poorTechniqueRate * 35 -
      abnormalInputSets.length * 12 -
      Math.min(20, matchedPainPatterns.length * 8)
  );

  const firstMainGroup = grouped.exerciseGroups.find((group) => group.workingSets.length || number(group.exercise.prescription?.sets) > 0);
  const keyExerciseCompleted = firstMainGroup ? firstMainGroup.workingSets.some((item) => isCompletedSet(item.set)) : completedWorkingSets.length > 0;
  const skippedPenalty = Math.min(35, skippedMainSets * 10 + supportSkipped * 5);
  const feedbackPenalty = Math.min(15, feedback.tooHeavy * 6 + feedback.tooLight * 3);
  const stabilityScore = clamp((keyExerciseCompleted ? 100 : 50) - skippedPenalty - feedbackPenalty);

  let score = roundScore(completionScore * 0.35 + effectiveQualityScore * 0.3 + safetyScore * 0.2 + stabilityScore * 0.15);
  if (session.dataFlag === 'test' || session.dataFlag === 'excluded') score = Math.min(score, 82);
  if (painSets.length >= 2) score = Math.min(score, 72);
  if (poorTechniqueSets.length >= 2) score = Math.min(score, 70);
  if (mainCompletionRate < 0.5) score = Math.min(score, 55);

  const level: SessionQualityLevel = score >= 82 ? 'high' : score >= 58 ? 'medium' : 'low';
  const positives: SessionQualitySignal[] = [];
  const issues: SessionQualitySignal[] = [];

  if (mainCompletionRate >= 0.9) {
    positives.push(makeSignal('main-completion', '主训练完成度高', 'positive', `完成 ${completedWorkingSets.length}/${Math.max(1, plannedWorkingSets)} 组主训练。`));
  } else if (mainCompletionRate < 0.65) {
    issues.push(makeSignal('main-completion-low', '主训练完成不足', 'negative', `主训练完成 ${completedWorkingSets.length}/${Math.max(1, plannedWorkingSets)} 组，训练刺激不够稳定。`));
  }

  if (effectiveSets > 0 && highConfidenceEffectiveSets > 0) {
    positives.push(makeSignal('effective-quality', '有效训练质量稳定', 'positive', `正式组中有 ${highConfidenceEffectiveSets} 组高置信有效组。`));
  } else if (completedWorkingSets.length > 0) {
    issues.push(makeSignal('effective-quality-low', '高质量有效组不足', 'warning', '正式组完成了，但高置信有效组不足，建议结合动作质量和余力（RIR）复查。'));
  }

  if (goodTechniqueSets.length >= Math.max(1, completedWorkingSets.length - poorTechniqueSets.length) && !poorTechniqueSets.length) {
    positives.push(makeSignal('technique-good', '动作质量稳定', 'positive', '正式组动作质量记录整体稳定。'));
  }

  if (feedback.good > 0 && feedback.tooHeavy === 0) {
    positives.push(makeSignal('load-feedback-good', '重量反馈合适', 'positive', '本次推荐重量反馈整体合适。'));
  }

  if (completedWarmupSets.length) {
    positives.push(makeSignal('warmup-recorded', '热身记录可见', 'neutral', `已记录 ${completedWarmupSets.length} 组热身；热身组用于准备，不作为高质量有效组。`));
  }

  if (painSets.length) {
    issues.push(makeSignal('pain-flag', '出现不适标记', 'negative', `${painSets.length} 组正式组记录了不适，这些组不会作为高质量亮点。`));
  }
  if (matchedPainPatterns.length) {
    issues.push(makeSignal('pain-pattern', '近期不适需要关注', 'warning', '近期不适记录与本次训练相关，下次应优先确认动作选择和负荷。'));
  }
  if (poorTechniqueSets.length) {
    issues.push(makeSignal('poor-technique', '动作质量偏低', 'negative', `${poorTechniqueSets.length} 组动作质量较差，会降低本次训练质量评分。`));
  }
  if (missingRirSets.length) {
    issues.push(makeSignal('rir-missing', '余力（RIR）记录不完整', 'warning', `${missingRirSets.length} 组正式组缺少余力（RIR），本次判断置信度会下降。`));
  }
  if (feedback.tooHeavy > 0) {
    issues.push(makeSignal('load-too-heavy', '重量反馈偏重', 'warning', '本次有推荐重量偏重反馈，下次不宜直接加重。'));
  }
  if (feedback.tooLight > 0 && feedback.tooHeavy === 0) {
    issues.push(makeSignal('load-too-light', '重量反馈偏轻', 'neutral', '本次有重量偏轻反馈，如果动作质量稳定，下次可以小幅校准。'));
  }
  if (abnormalInputSets.length) {
    issues.push(makeSignal('abnormal-input', '记录可能异常', 'warning', '部分重量、次数或余力（RIR）记录超出常见范围，建议回看是否为输入错误。'));
  }
  if (supportSkipped) {
    issues.push(makeSignal('support-skipped', '辅助训练未完全完成', 'neutral', '部分辅助动作未完成，主要影响本次训练完整度。'));
  }
  const flag = dataFlagLabel(session.dataFlag);
  if (flag) {
    issues.push(makeSignal('data-flag', '不参与统计', 'warning', `这次训练已标记为${flag}，可以查看质量报告，但不会参与训练统计。`));
  }

  const missingRirRate = missingRirSets.length / Math.max(1, completedWorkingSets.length);
  let confidence: SessionQualityResult['confidence'] = 'high';
  if (completedWorkingSets.length < 2 || missingRirRate >= 0.7 || abnormalInputSets.length > 0) confidence = 'low';
  else if (missingRirRate >= 0.35 || flag || completedWorkingSets.length < 4) confidence = 'medium';

  const summaryParts: string[] = [];
  if (level === 'high') summaryParts.push('你完成了主要训练，动作质量和有效组表现较稳定。');
  if (level === 'medium') summaryParts.push('你完成了主要训练，但仍有影响质量或置信度的信号。');
  if (level === 'low') summaryParts.push('本次训练完成度或执行质量偏低，建议先复查关键记录。');
  if (feedback.tooHeavy > 0) summaryParts.push('重量反馈偏重。');
  if (painSets.length) summaryParts.push('部分正式组记录了不适。');
  if (poorTechniqueSets.length) summaryParts.push('动作质量记录存在偏低。');
  if (missingRirSets.length) summaryParts.push('余力（RIR）记录不完整。');
  if (flag) summaryParts.unshift(`这次训练为${flag}，不参与统计。`);

  const nextSuggestions = unique([
    painSets.length || matchedPainPatterns.length ? '下次优先处理不适动作，必要时降低负荷或使用替代动作。' : '',
    poorTechniqueSets.length ? '下次先维持重量，优先把动作质量做稳。' : '',
    feedback.tooHeavy > 0 ? '下次相关动作先维持或小幅下调重量，不急于加重。' : '',
    mainCompletionRate < 0.75 ? '下次先确保关键主训练完成，再考虑辅助动作。' : '',
    missingRirSets.length ? '下次补全余力（RIR）记录，让后续推荐更可信。' : '',
    level === 'high' && !painSets.length ? '保持当前训练节奏，继续记录动作质量和余力（RIR）。' : '',
  ]).slice(0, 3);

  return {
    level,
    score,
    title: `本次训练质量：${levelLabel(level)}`,
    summary: summaryParts.join(' ') || '本次训练记录已完成，可以作为后续建议参考。',
    positives: positives.slice(0, 4),
    issues: issues.slice(0, 6),
    nextSuggestions: nextSuggestions.length ? nextSuggestions : ['下次继续按计划训练，并保持重量、次数、余力（RIR）和动作质量记录完整。'],
    confidence,
  };
};
