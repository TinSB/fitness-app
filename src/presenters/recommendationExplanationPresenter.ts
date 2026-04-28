import { formatTrainingMode } from '../i18n/formatters';
import type { TrainingSession } from '../models/training-model';
import type { RecommendationFactor, RecommendationTrace } from '../engines/recommendationTraceEngine';

export type RecommendationFactorView = {
  id: string;
  label: string;
  effectLabel: string;
  effectTone: 'positive' | 'negative' | 'neutral' | 'warning';
  reason: string;
  priority: number;
};

export type RecommendationWarningView = {
  id: string;
  title: string;
  message: string;
};

export type RecommendationExplanationViewModel = {
  title: string;
  summary: string;
  primaryFactors: RecommendationFactorView[];
  secondaryFactors: RecommendationFactorView[];
  warnings: RecommendationWarningView[];
};

type BuildOptions = {
  title?: string;
  warnings?: string[];
};

const DEFAULT_SUMMARY = '当前主要依据起始模板和默认处方，系统仍在积累你的训练数据。';

const sourceLabels: Record<RecommendationFactor['source'], string> = {
  primaryGoal: '主目标',
  trainingMode: '训练侧重',
  trainingLevel: '训练基线',
  readiness: '准备度',
  history: '近期记录',
  muscleVolume: '肌群训练量',
  loadFeedback: '重量反馈',
  techniqueQuality: '动作质量',
  painPattern: '不适信号',
  healthData: '健康数据',
  template: '计划模板',
  defaultPolicy: '默认规则',
};

const effectLabels: Record<RecommendationFactor['effect'], string> = {
  increase: '提高建议',
  decrease: '保守建议',
  maintain: '维持建议',
  block: '暂不启用',
  informational: '信息参考',
};

const effectTones: Record<RecommendationFactor['effect'], RecommendationFactorView['effectTone']> = {
  increase: 'positive',
  decrease: 'warning',
  maintain: 'neutral',
  block: 'negative',
  informational: 'neutral',
};

const magnitudeScore: Record<RecommendationFactor['magnitude'], number> = {
  large: 300,
  moderate: 200,
  small: 100,
};

const effectScore: Record<RecommendationFactor['effect'], number> = {
  block: 95,
  decrease: 85,
  increase: 75,
  maintain: 35,
  informational: 0,
};

const sourceScore: Record<RecommendationFactor['source'], number> = {
  painPattern: 95,
  techniqueQuality: 90,
  readiness: 85,
  loadFeedback: 80,
  muscleVolume: 65,
  primaryGoal: 55,
  trainingMode: 55,
  trainingLevel: 50,
  history: 45,
  healthData: 35,
  template: 15,
  defaultPolicy: 10,
};

const rawTokenPattern = /\b(increase|decrease|maintain|block|informational|primaryGoal|trainingMode|trainingLevel|readiness|loadFeedback|techniqueQuality|painPattern|muscleVolume|healthData|template|defaultPolicy|high|medium|low|undefined|null)\b/gi;

const cleanText = (value: unknown, fallback: string) => {
  const text = String(value ?? '').replace(rawTokenPattern, '').replace(/\s+/g, ' ').trim();
  return text || fallback;
};

const factorPriority = (factor: RecommendationFactor) =>
  magnitudeScore[factor.magnitude] + effectScore[factor.effect] + sourceScore[factor.source];

const toFactorView = (factor: RecommendationFactor): RecommendationFactorView => ({
  id: factor.id || `${factor.source}-${factor.effect}`,
  label: sourceLabels[factor.source],
  effectLabel: effectLabels[factor.effect],
  effectTone: effectTones[factor.effect],
  reason: cleanText(factor.reason, DEFAULT_SUMMARY),
  priority: factorPriority(factor),
});

const collectFactors = (trace: RecommendationTrace) => {
  const factors = [
    ...trace.globalFactors,
    ...trace.volumeFactors,
    ...trace.loadFeedbackFactors,
    ...Object.values(trace.exerciseFactors).flat(),
  ];
  const seen = new Set<string>();
  return factors.filter((factor) => {
    const key = `${factor.source}:${factor.effect}:${factor.reason}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return Boolean(cleanText(factor.reason, ''));
  });
};

const isPrimaryFactor = (factor: RecommendationFactor) =>
  factor.effect !== 'informational' && factor.source !== 'template';

const normalDifferenceMessage = (factors: RecommendationFactorView[]) => {
  if (factors.some((factor) => factor.label === '训练侧重')) {
    return '这是正常差异：训练侧重不同，系统会调整次数范围、休息和保守程度。';
  }
  if (factors.some((factor) => factor.label === '主目标')) {
    return '这是正常差异：主目标不同，系统会用不同的长期训练取向。';
  }
  if (factors.some((factor) => factor.label === '重量反馈')) {
    return '这是正常差异：近期重量反馈不同，本次推荐会相应调整。';
  }
  return '';
};

const toWarningView = (warning: string, index: number): RecommendationWarningView => {
  const normalized = cleanText(warning, '');
  const message =
    /相同|不一致|非确定/.test(normalized)
      ? '关键条件相同但推荐差异较大，建议检查历史记录、训练模式和测试数据标记。'
      : /无关|肌群/.test(normalized)
        ? '推荐差异较大，建议确认近期记录是否属于当前训练相关肌群。'
        : '推荐差异较大，建议确认历史记录或训练设置。';
  return {
    id: `recommendation-warning-${index}`,
    title: '可能需要检查',
    message,
  };
};

export const buildRecommendationExplanationViewModel = (
  trace: RecommendationTrace | null | undefined,
  options: BuildOptions = {},
): RecommendationExplanationViewModel => {
  if (!trace) {
    return {
      title: options.title || '为什么这样推荐？',
      summary: DEFAULT_SUMMARY,
      primaryFactors: [],
      secondaryFactors: [],
      warnings: (options.warnings || []).map(toWarningView),
    };
  }

  const sorted = collectFactors(trace)
    .map((factor) => ({ factor, view: toFactorView(factor) }))
    .sort((left, right) => right.view.priority - left.view.priority);

  const primaryFactors = sorted.filter(({ factor }) => isPrimaryFactor(factor)).map(({ view }) => view);
  const secondaryFactors = sorted.filter(({ factor }) => !isPrimaryFactor(factor)).map(({ view }) => view);
  const summary = cleanText(trace.finalSummary, DEFAULT_SUMMARY);
  const normalMessage = normalDifferenceMessage(primaryFactors);

  return {
    title: options.title || '为什么这样推荐？',
    summary: normalMessage || summary || DEFAULT_SUMMARY,
    primaryFactors,
    secondaryFactors,
    warnings: (options.warnings || []).map(toWarningView),
  };
};

export const buildSessionRecommendationTrace = (session: Pick<TrainingSession, 'templateId' | 'trainingMode' | 'explanations'>): RecommendationTrace => {
  const reasons = (session.explanations || []).filter(Boolean);
  const factors: RecommendationFactor[] = reasons.length
    ? reasons.map((reason, index) => ({
        id: `session-explanation-${index}`,
        label: '本次建议',
        effect: 'informational',
        magnitude: 'small',
        source: 'defaultPolicy',
        reason,
      }))
    : [
        {
          id: 'session-default-explanation',
          label: '默认规则',
          effect: 'maintain',
          magnitude: 'small',
          source: 'defaultPolicy',
          reason: DEFAULT_SUMMARY,
        },
      ];

  return {
    sessionTemplateId: session.templateId || 'current-session',
    primaryGoal: '当前目标',
    trainingMode: formatTrainingMode(session.trainingMode || 'hybrid'),
    trainingLevel: '训练基线',
    globalFactors: factors,
    exerciseFactors: {},
    volumeFactors: [],
    loadFeedbackFactors: [],
    finalSummary: reasons[0] || DEFAULT_SUMMARY,
  };
};
