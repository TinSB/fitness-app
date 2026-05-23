import type { EffectiveVolumeSummary, PainPattern } from '../models/training-model';
import { formatExerciseName, formatMuscleName } from '../i18n/formatters';
import {
  buildGuardedRecommendationContract,
  type GuardedRecommendationActionType,
  type GuardedRecommendationContract,
  type GuardedRecommendationRiskLevel,
  type GuardedRecommendationScope,
} from './guardedRecommendationContractEngine';
import type { LoadFeedbackSummary } from './loadFeedbackEngine';
import type { PlateauDetectionResult, PlateauStatus } from './plateauDetectionEngine';
import type { RecommendationConfidenceResult } from './recommendationConfidenceEngine';
import type { SessionQualityResult } from './sessionQualityEngine';
import type { TrainingIntelligenceSummary } from './trainingIntelligenceSummaryEngine';
import type { MuscleVolumeAdaptation, VolumeAdaptationReport } from './volumeAdaptationEngine';

export type WeeklyProgressionRecommendationKind =
  | 'maintain'
  | 'progress'
  | 'conservative_progress'
  | 'deload'
  | 'review_volume'
  | 'review_exercise'
  | 'technique_focus'
  | 'pain_review'
  | 'insufficient_data';

export type WeeklyProgressionRecommendationScope = 'week';

export type WeeklyProgressionRecommendationConfidence = 'low' | 'medium' | 'high';

export type WeeklyProgressionRecommendationRiskLevel = 'low' | 'medium' | 'high';

export type WeeklyProgressionActionType =
  | 'keep_plan'
  | 'increase_volume'
  | 'reduce_volume'
  | 'review_volume'
  | 'review_exercise'
  | 'review_technique'
  | 'review_pain'
  | 'generate_plan_candidate'
  | 'keep_observing'
  | 'insufficient_data';

export type WeeklyProgressionInput = {
  trainingIntelligenceSummary?: TrainingIntelligenceSummary;
  volumeAdaptation?: VolumeAdaptationReport;
  plateauResults?: PlateauDetectionResult[];
  recommendationConfidence?: RecommendationConfidenceResult[];
  sessionQuality?: SessionQualityResult;
  effectiveSetSummary?: Partial<EffectiveVolumeSummary> | null;
  painPatterns?: PainPattern[];
  loadFeedbackSummary?: LoadFeedbackSummary[] | Record<string, LoadFeedbackSummary> | null;
  weekId?: string;
  nowIso?: string;
};

export type WeeklyProgressionItem = {
  id: string;
  targetType: 'muscle' | 'exercise' | 'session' | 'week';
  targetId?: string;
  targetLabel: string;
  recommendationKind: WeeklyProgressionRecommendationKind;
  actionType: WeeklyProgressionActionType;
  title: string;
  summary: string;
  userMessage: string;
  confidence: WeeklyProgressionRecommendationConfidence;
  riskLevel: WeeklyProgressionRecommendationRiskLevel;
  reasonCodes: string[];
  riskFlags: string[];
  blockedReasons: string[];
  suggestedActions: string[];
  setsDelta?: number;
  sourceIds: string[];
  createdAt: string;
  guardedRecommendation?: GuardedRecommendationContract;
};

export type WeeklyProgressionRecommendation = {
  id: string;
  scope: 'week';
  weekId: string;
  title: string;
  summary: string;
  items: WeeklyProgressionItem[];
  confidence: WeeklyProgressionRecommendationConfidence;
  riskLevel: WeeklyProgressionRecommendationRiskLevel;
  blockedReasons: string[];
  sourceEngineIds: string[];
  createdAt: string;
  guardedRecommendations: GuardedRecommendationContract[];
};

type ItemDraft = Omit<WeeklyProgressionItem, 'id' | 'createdAt' | 'guardedRecommendation'>;

const SOURCE_ENGINE_ID = 'weekly-progression-recommendation-v1';
const FALLBACK_CREATED_AT = '1970-01-01T00:00:00.000Z';

const unique = (items: readonly string[]) => [...new Set(items.filter(Boolean))];

const clean = (value: unknown) => String(value ?? '').trim();

const number = (value: unknown) => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeKey = (value: unknown) => clean(value).toLowerCase();

const hasEffectiveSetSignal = (summary?: Partial<EffectiveVolumeSummary> | null) =>
  Boolean(
    summary &&
      (number(summary.completedSets) > 0 ||
        number(summary.effectiveSets) > 0 ||
        number(summary.highConfidenceEffectiveSets) > 0 ||
        Object.keys(summary.byMuscle || {}).length > 0),
  );

const volumeHasMeaningfulSignals = (report?: VolumeAdaptationReport) =>
  Boolean(report?.muscles?.some((item) => item.decision && item.decision !== 'insufficient_data'));

const plateauHasMeaningfulSignals = (results: PlateauDetectionResult[] = []) =>
  results.some((item) => item.status !== 'none' && item.status !== 'insufficient_data');

const confidenceHasMeaningfulSignals = (results: RecommendationConfidenceResult[] = []) =>
  results.some((item) => item.level === 'low' || item.level === 'medium' || item.level === 'high');

const sessionQualityHasMeaningfulSignals = (result?: SessionQualityResult) =>
  Boolean(result && result.level !== 'insufficient_data');

const loadFeedbackItems = (input: WeeklyProgressionInput['loadFeedbackSummary']) => {
  if (!input) return [];
  if (Array.isArray(input)) return input;
  return Object.values(input).filter((item): item is LoadFeedbackSummary => Boolean(item));
};

const loadFeedbackHasRisk = (input: WeeklyProgressionInput['loadFeedbackSummary']) =>
  loadFeedbackItems(input).some(
    (item) =>
      item.adjustment?.direction === 'conservative' ||
      item.dominantFeedback === 'too_heavy' ||
      number(item.counts?.too_heavy) >= 2,
  );

const painIsRecurringOrSevere = (pattern: PainPattern) =>
  pattern.suggestedAction === 'substitute' ||
  pattern.suggestedAction === 'deload' ||
  pattern.suggestedAction === 'seek_professional' ||
  number(pattern.frequency) >= 2 ||
  number(pattern.severityAvg) >= 3.5;

const painIsSevere = (pattern: PainPattern) =>
  pattern.suggestedAction === 'deload' ||
  pattern.suggestedAction === 'seek_professional' ||
  number(pattern.severityAvg) >= 4.5;

const muscleLabel = (muscleId: string) => formatMuscleName(muscleId);

const exerciseLabel = (result: PlateauDetectionResult) => {
  const fromTitle = result.title.split('：')[0]?.trim();
  if (fromTitle && fromTitle !== result.title) return fromTitle;
  return formatExerciseName(result.exerciseId);
};

const confidenceExerciseId = (result: RecommendationConfidenceResult) =>
  clean((result as RecommendationConfidenceResult & { exerciseId?: string }).exerciseId);

const hasLowConfidence = (results: RecommendationConfidenceResult[] = [], targetId?: string) =>
  results.some((item) => item.level === 'low' && (!targetId || !confidenceExerciseId(item) || confidenceExerciseId(item) === targetId));

const confidenceForTarget = (results: RecommendationConfidenceResult[] = [], targetId?: string) =>
  hasLowConfidence(results, targetId) ? 'low' : undefined;

const painMatchesMuscle = (pattern: PainPattern, muscleId: string) => {
  const area = normalizeKey(pattern.area);
  const id = normalizeKey(muscleId);
  const label = normalizeKey(muscleLabel(muscleId));
  return area === id || area === label || area.includes(id) || area.includes(label) || id.includes(area) || label.includes(area);
};

const painMatchesExercise = (pattern: PainPattern, exerciseId: string) =>
  Boolean(pattern.exerciseId && pattern.exerciseId === exerciseId);

const hasPainForMuscle = (patterns: PainPattern[] = [], muscleId: string) =>
  patterns.some((pattern) => painIsRecurringOrSevere(pattern) && painMatchesMuscle(pattern, muscleId));

const hasPainForExercise = (patterns: PainPattern[] = [], exerciseId: string) =>
  patterns.some((pattern) => painIsRecurringOrSevere(pattern) && painMatchesExercise(pattern, exerciseId));

const riskLevelForPain = (pattern: PainPattern): WeeklyProgressionRecommendationRiskLevel =>
  painIsSevere(pattern) ? 'high' : 'medium';

const overallRisk = (items: WeeklyProgressionItem[]): WeeklyProgressionRecommendationRiskLevel => {
  if (items.some((item) => item.riskLevel === 'high')) return 'high';
  if (items.some((item) => item.riskLevel === 'medium')) return 'medium';
  return 'low';
};

const overallConfidence = (
  items: WeeklyProgressionItem[],
  hasGlobalLowConfidenceSignal: boolean,
): WeeklyProgressionRecommendationConfidence => {
  if (!items.length || hasGlobalLowConfidenceSignal || items.some((item) => item.confidence === 'low')) return 'low';
  if (items.some((item) => item.confidence === 'medium')) return 'medium';
  return 'high';
};

const itemRank: Record<WeeklyProgressionRecommendationKind, number> = {
  pain_review: 90,
  technique_focus: 80,
  deload: 70,
  conservative_progress: 60,
  review_volume: 55,
  review_exercise: 50,
  progress: 40,
  maintain: 30,
  insufficient_data: 10,
};

const targetKey = (item: Pick<WeeklyProgressionItem, 'targetType' | 'targetId' | 'targetLabel'>) =>
  `${item.targetType}:${item.targetId || item.targetLabel}`;

const dedupeItems = (items: WeeklyProgressionItem[]) => {
  const byTarget = new Map<string, WeeklyProgressionItem>();
  const order: string[] = [];

  items.forEach((item) => {
    const key = targetKey(item);
    const existing = byTarget.get(key);
    if (!existing) {
      byTarget.set(key, item);
      order.push(key);
      return;
    }

    if (itemRank[item.recommendationKind] > itemRank[existing.recommendationKind]) {
      byTarget.set(key, item);
    }
  });

  return order.map((key) => byTarget.get(key)).filter((item): item is WeeklyProgressionItem => Boolean(item));
};

const makeItem = (draft: ItemDraft, weekId: string, createdAt: string): WeeklyProgressionItem => ({
  ...draft,
  id: `weekly-progression:${weekId}:${draft.targetType}:${draft.targetId || draft.targetLabel}:${draft.recommendationKind}:${draft.actionType}`,
  createdAt,
});

const planCandidateAllowed = (options: {
  targetId?: string;
  confidenceResults: RecommendationConfidenceResult[];
  sessionQuality?: SessionQualityResult;
  painPatterns: PainPattern[];
  loadFeedbackRisk: boolean;
}) =>
  !hasLowConfidence(options.confidenceResults, options.targetId) &&
  options.sessionQuality?.level !== 'low' &&
  !options.loadFeedbackRisk &&
  (!options.targetId || !hasPainForMuscle(options.painPatterns, options.targetId));

const volumeItem = (
  item: MuscleVolumeAdaptation,
  context: {
    confidenceResults: RecommendationConfidenceResult[];
    sessionQuality?: SessionQualityResult;
    painPatterns: PainPattern[];
    loadFeedbackRisk: boolean;
  },
): ItemDraft | null => {
  if (item.decision === 'insufficient_data') return null;

  const label = muscleLabel(item.muscleId);
  const lowConfidence = hasLowConfidence(context.confidenceResults);
  const blockedReasons = unique([
    ...(lowConfidence ? ['low_confidence'] : []),
    ...(context.sessionQuality?.level === 'low' ? ['low_session_quality'] : []),
    ...(context.loadFeedbackRisk ? ['load_feedback_risk'] : []),
    ...(hasPainForMuscle(context.painPatterns, item.muscleId) ? ['pain_risk'] : []),
  ]);
  const confidence = confidenceForTarget(context.confidenceResults) || item.confidence;
  const sourceIds = ['volume-adaptation-v1', `volume:${item.muscleId}`];

  if (item.decision === 'increase') {
    const canQueueCandidate = planCandidateAllowed({
      targetId: item.muscleId,
      confidenceResults: context.confidenceResults,
      sessionQuality: context.sessionQuality,
      painPatterns: context.painPatterns,
      loadFeedbackRisk: context.loadFeedbackRisk,
    });

    if (!canQueueCandidate) {
      return {
        targetType: 'muscle',
        targetId: item.muscleId,
        targetLabel: label,
        recommendationKind: 'conservative_progress',
        actionType: 'keep_observing',
        title: `${label} 暂缓调整`,
        summary: `${label} 先继续观察。`,
        userMessage: `${label} 暂缓调整。`,
        confidence: confidence === 'high' ? 'medium' : confidence,
        riskLevel: blockedReasons.includes('pain_risk') ? 'high' : 'medium',
        reasonCodes: unique(['volume_increase_blocked', ...blockedReasons]),
        riskFlags: unique([
          ...(blockedReasons.includes('pain_risk') ? ['pain'] : []),
          ...(blockedReasons.includes('low_session_quality') ? ['technique'] : []),
          ...(blockedReasons.includes('load_feedback_risk') ? ['load_too_aggressive'] : []),
        ]),
        blockedReasons,
        suggestedActions: ['查看后再决定'],
        setsDelta: item.setsDelta,
        sourceIds,
      };
    }

    return {
      targetType: 'muscle',
      targetId: item.muscleId,
      targetLabel: label,
      recommendationKind: 'progress',
      actionType: 'generate_plan_candidate',
      title: `${label} 小幅加量`,
      summary: `${label} 下周可小幅加量。`,
      userMessage: `${label} 下周可小幅加量。`,
      confidence,
      riskLevel: 'low',
      reasonCodes: ['volume_increase'],
      riskFlags: [],
      blockedReasons: [],
      suggestedActions: ['只生成候选，不改变计划', '查看后再决定'],
      setsDelta: item.setsDelta,
      sourceIds,
    };
  }

  if (item.decision === 'decrease') {
    const riskFlags = unique([
      'fatigue',
      ...(blockedReasons.includes('pain_risk') ? ['pain'] : []),
      ...(blockedReasons.includes('load_feedback_risk') ? ['load_too_aggressive'] : []),
    ]);

    return {
      targetType: 'muscle',
      targetId: item.muscleId,
      targetLabel: label,
      recommendationKind: blockedReasons.includes('pain_risk') || Math.abs(number(item.setsDelta)) >= 2 ? 'deload' : 'conservative_progress',
      actionType: 'reduce_volume',
      title: `${label} 减少训练量`,
      summary: `${label} 下周先减少训练量。`,
      userMessage: `${label} 下周先减少训练量。`,
      confidence,
      riskLevel: riskFlags.includes('pain') ? 'high' : 'medium',
      reasonCodes: unique(['volume_decrease', ...blockedReasons]),
      riskFlags,
      blockedReasons,
      suggestedActions: ['查看后再决定'],
      setsDelta: item.setsDelta,
      sourceIds,
    };
  }

  if (item.decision === 'maintain') {
    return {
      targetType: 'muscle',
      targetId: item.muscleId,
      targetLabel: label,
      recommendationKind: 'maintain',
      actionType: 'keep_plan',
      title: `${label} 维持训练量`,
      summary: `${label} 下周维持。`,
      userMessage: `${label} 下周维持。`,
      confidence,
      riskLevel: 'low',
      reasonCodes: ['volume_maintain'],
      riskFlags: [],
      blockedReasons: [],
      suggestedActions: ['下周维持当前节奏'],
      setsDelta: item.setsDelta,
      sourceIds,
    };
  }

  if (item.decision === 'hold') {
    return {
      targetType: 'muscle',
      targetId: item.muscleId,
      targetLabel: label,
      recommendationKind: 'conservative_progress',
      actionType: 'keep_observing',
      title: `${label} 暂缓调整`,
      summary: `${label} 先继续观察。`,
      userMessage: `${label} 暂缓调整。`,
      confidence: 'low',
      riskLevel: 'medium',
      reasonCodes: ['volume_hold'],
      riskFlags: [],
      blockedReasons: [],
      suggestedActions: ['继续记录后再判断'],
      setsDelta: item.setsDelta,
      sourceIds,
    };
  }

  return null;
};

const plateauUserMessage = (status: PlateauStatus, label: string) => {
  if (status === 'plateau') return `${label} 近期停滞，先复查。`;
  if (status === 'possible_plateau') return `${label} 进展放缓，继续观察。`;
  if (status === 'load_too_aggressive') return `${label} 不急于加重。`;
  if (status === 'technique_limited') return `${label} 先稳住动作。`;
  if (status === 'fatigue_limited') return `${label} 先控制疲劳。`;
  if (status === 'volume_limited') return `${label} 先复查训练量。`;
  return `${label} 继续观察。`;
};

const plateauItem = (
  result: PlateauDetectionResult,
  context: { confidenceResults: RecommendationConfidenceResult[]; painPatterns: PainPattern[] },
): ItemDraft | null => {
  if (result.status === 'none' || result.status === 'insufficient_data') return null;

  const label = exerciseLabel(result);
  const base = {
    targetType: 'exercise' as const,
    targetId: result.exerciseId,
    targetLabel: label,
    title: `${label} 复查进展`,
    summary: plateauUserMessage(result.status, label),
    userMessage: plateauUserMessage(result.status, label),
    confidence: confidenceForTarget(context.confidenceResults, result.exerciseId) || result.confidence,
    sourceIds: ['plateau-detection-v1', `plateau:${result.exerciseId}`],
    blockedReasons: hasLowConfidence(context.confidenceResults, result.exerciseId) ? ['low_confidence'] : [],
  };

  if (hasPainForExercise(context.painPatterns, result.exerciseId)) {
    return {
      ...base,
      recommendationKind: 'pain_review',
      actionType: 'review_pain',
      title: `${label} 先复查`,
      summary: '有不适，先复查。',
      userMessage: '有不适，先复查。',
      riskLevel: 'high',
      reasonCodes: unique(['pain_risk', result.status]),
      riskFlags: ['pain'],
      suggestedActions: ['查看后再决定'],
    };
  }

  if (result.status === 'load_too_aggressive') {
    return {
      ...base,
      recommendationKind: 'conservative_progress',
      actionType: 'review_exercise',
      riskLevel: 'medium',
      reasonCodes: ['load_too_aggressive'],
      riskFlags: ['load_too_aggressive'],
      suggestedActions: ['不急于加重', '查看后再决定'],
    };
  }

  if (result.status === 'technique_limited') {
    return {
      ...base,
      recommendationKind: 'technique_focus',
      actionType: 'review_technique',
      title: `${label} 先稳住动作`,
      riskLevel: 'medium',
      reasonCodes: ['technique_limited'],
      riskFlags: ['technique'],
      suggestedActions: ['先稳住动作'],
    };
  }

  if (result.status === 'fatigue_limited') {
    return {
      ...base,
      recommendationKind: 'conservative_progress',
      actionType: 'review_exercise',
      title: `${label} 先控制疲劳`,
      riskLevel: 'medium',
      reasonCodes: ['fatigue_limited'],
      riskFlags: ['fatigue'],
      suggestedActions: ['先控制疲劳'],
    };
  }

  if (result.status === 'volume_limited') {
    return {
      ...base,
      recommendationKind: 'review_volume',
      actionType: 'review_volume',
      title: `${label} 复查训练量`,
      riskLevel: 'medium',
      reasonCodes: ['volume_limited'],
      riskFlags: [],
      suggestedActions: ['先复查训练量'],
    };
  }

  return {
    ...base,
    recommendationKind: 'review_exercise',
    actionType: 'review_exercise',
    riskLevel: result.status === 'plateau' ? 'medium' : 'low',
    reasonCodes: [result.status],
    riskFlags: [],
    suggestedActions: [result.status === 'plateau' ? '先复查' : '继续观察'],
  };
};

const painItem = (pattern: PainPattern): ItemDraft | null => {
  if (!painIsRecurringOrSevere(pattern)) return null;

  const targetType = pattern.exerciseId ? 'exercise' : 'muscle';
  const targetId = pattern.exerciseId || pattern.area;
  const targetLabel = pattern.exerciseId ? formatExerciseName(pattern.exerciseId) : muscleLabel(pattern.area);
  const severe = painIsSevere(pattern);

  return {
    targetType,
    targetId,
    targetLabel,
    recommendationKind: 'pain_review',
    actionType: 'review_pain',
    title: `${targetLabel} 先复查`,
    summary: '有不适，先复查。',
    userMessage: '有不适，先复查。',
    confidence: severe ? 'high' : 'medium',
    riskLevel: riskLevelForPain(pattern),
    reasonCodes: ['pain_pattern'],
    riskFlags: unique(['pain', ...(pattern.suggestedAction === 'seek_professional' ? ['medical_risk'] : [])]),
    blockedReasons: ['pain_risk'],
    suggestedActions: ['查看后再决定'],
    sourceIds: ['pain-pattern-v1', `pain:${targetId}`],
  };
};

const sessionQualityItem = (result?: SessionQualityResult): ItemDraft | null => {
  if (!result || result.level !== 'low') return null;
  return {
    targetType: 'session',
    targetLabel: '本周训练',
    recommendationKind: 'technique_focus',
    actionType: 'review_technique',
    title: '先保证训练质量',
    summary: '先保证训练质量。',
    userMessage: '先保证训练质量。',
    confidence: result.confidence,
    riskLevel: 'medium',
    reasonCodes: ['low_session_quality'],
    riskFlags: ['technique'],
    blockedReasons: ['low_session_quality'],
    suggestedActions: ['先稳住动作'],
    sourceIds: ['session-quality-v1'],
  };
};

const lowConfidenceItem = (results: RecommendationConfidenceResult[]): ItemDraft | null => {
  if (!hasLowConfidence(results)) return null;
  const result = results.find((item) => item.level === 'low');
  const exerciseId = result ? confidenceExerciseId(result) : '';
  const targetType = exerciseId ? 'exercise' : 'week';
  const targetLabel = exerciseId ? formatExerciseName(exerciseId) : '本周训练';

  return {
    targetType,
    targetId: exerciseId || undefined,
    targetLabel,
    recommendationKind: 'conservative_progress',
    actionType: exerciseId ? 'review_exercise' : 'keep_observing',
    title: exerciseId ? `${targetLabel} 先复查` : '继续观察',
    summary: '继续记录后再判断。',
    userMessage: exerciseId ? `${targetLabel} 先复查。` : '继续记录后再判断。',
    confidence: 'low',
    riskLevel: 'medium',
    reasonCodes: ['low_confidence'],
    riskFlags: [],
    blockedReasons: ['low_confidence'],
    suggestedActions: ['继续记录后再判断'],
    sourceIds: ['recommendation-confidence-v1'],
  };
};

const loadFeedbackRiskItems = (input: WeeklyProgressionInput['loadFeedbackSummary']): ItemDraft[] =>
  loadFeedbackItems(input)
    .filter(
      (item) =>
        item.exerciseId &&
        (item.adjustment?.direction === 'conservative' ||
          item.dominantFeedback === 'too_heavy' ||
          number(item.counts?.too_heavy) >= 2),
    )
    .map((item) => {
      const label = formatExerciseName(item.exerciseId);
      return {
        targetType: 'exercise' as const,
        targetId: item.exerciseId,
        targetLabel: label,
        recommendationKind: 'conservative_progress' as const,
        actionType: 'review_exercise' as const,
        title: `${label} 不急于加重`,
        summary: `${label} 不急于加重。`,
        userMessage: `${label} 不急于加重。`,
        confidence: 'medium' as const,
        riskLevel: 'medium' as const,
        reasonCodes: ['load_feedback_risk'],
        riskFlags: ['load_too_aggressive'],
        blockedReasons: ['load_feedback_risk'],
        suggestedActions: ['不急于加重'],
        sourceIds: ['load-feedback-v1', `load-feedback:${item.exerciseId}`],
      };
    });

const effectiveSummaryFallbackItem = (summary?: Partial<EffectiveVolumeSummary> | null): ItemDraft | null => {
  if (!hasEffectiveSetSignal(summary)) return null;
  return {
    targetType: 'week',
    targetLabel: '本周训练',
    recommendationKind: 'maintain',
    actionType: 'keep_plan',
    title: '下周维持当前节奏',
    summary: '下周维持当前节奏。',
    userMessage: '下周维持当前节奏。',
    confidence: 'medium',
    riskLevel: 'low',
    reasonCodes: ['effective_set_summary'],
    riskFlags: [],
    blockedReasons: [],
    suggestedActions: ['下周维持当前节奏'],
    sourceIds: ['effective-set-v1'],
  };
};

const insufficientDataItem = (): ItemDraft => ({
  targetType: 'week',
  targetLabel: '本周训练',
  recommendationKind: 'insufficient_data',
  actionType: 'keep_observing',
  title: '继续记录',
  summary: '继续记录训练后再判断。',
  userMessage: '继续记录后再判断。',
  confidence: 'low',
  riskLevel: 'low',
  reasonCodes: ['insufficient_data'],
  riskFlags: [],
  blockedReasons: ['insufficient_data'],
  suggestedActions: ['继续记录后再判断'],
  sourceIds: [SOURCE_ENGINE_ID],
});

const weeklySummary = (items: WeeklyProgressionItem[]) => {
  if (items.some((item) => item.recommendationKind === 'insufficient_data')) return '继续记录后再判断。';
  if (items.some((item) => item.riskLevel === 'high')) return '本周先控制风险。';
  if (items.some((item) => item.recommendationKind === 'progress')) return '下周可小幅推进。';
  if (items.length && items.every((item) => item.recommendationKind === 'maintain')) return '下周维持当前节奏。';
  if (items.some((item) => item.recommendationKind === 'conservative_progress' || item.recommendationKind === 'deload')) {
    return '本周先控制风险。';
  }
  return '下周维持当前节奏。';
};

const titleFromSummary = (summary: string) => summary.replace(/。$/, '');

const hasMeaningfulSignals = (input: {
  volumeAdaptation?: VolumeAdaptationReport;
  plateauResults: PlateauDetectionResult[];
  recommendationConfidence: RecommendationConfidenceResult[];
  sessionQuality?: SessionQualityResult;
  effectiveSetSummary?: Partial<EffectiveVolumeSummary> | null;
  painPatterns: PainPattern[];
  loadFeedbackSummary: WeeklyProgressionInput['loadFeedbackSummary'];
}) =>
  volumeHasMeaningfulSignals(input.volumeAdaptation) ||
  plateauHasMeaningfulSignals(input.plateauResults) ||
  confidenceHasMeaningfulSignals(input.recommendationConfidence) ||
  sessionQualityHasMeaningfulSignals(input.sessionQuality) ||
  hasEffectiveSetSignal(input.effectiveSetSummary) ||
  input.painPatterns.some(painIsRecurringOrSevere) ||
  loadFeedbackHasRisk(input.loadFeedbackSummary);

export const normalizeWeeklyProgressionItemToGuardedRecommendation = (
  item: WeeklyProgressionItem,
): GuardedRecommendationContract => {
  const isPlanCandidate = item.actionType === 'generate_plan_candidate';
  const guardedActionType: GuardedRecommendationActionType = isPlanCandidate
    ? 'queue_plan_adjustment'
    : item.actionType === 'review_exercise' ||
        item.actionType === 'review_technique' ||
        item.actionType === 'review_pain' ||
        item.actionType === 'review_volume' ||
        item.actionType === 'reduce_volume'
      ? 'open_review'
      : 'display_only';
  const scope: GuardedRecommendationScope = isPlanCandidate ? 'plan' : 'week';
  const riskLevel: GuardedRecommendationRiskLevel = item.riskLevel;

  return buildGuardedRecommendationContract({
    source: 'weekly_progression',
    scope,
    level: isPlanCandidate ? 4 : 1,
    actionType: guardedActionType,
    status: isPlanCandidate ? 'pending_review' : 'candidate',
    title: item.title,
    summary: item.summary,
    userMessage: item.userMessage,
    target: {
      muscleId: item.targetType === 'muscle' ? item.targetId : undefined,
      exerciseId: item.targetType === 'exercise' ? item.targetId : undefined,
      sourceRecommendationId: item.id,
    },
    confidence: item.confidence,
    riskLevel,
    reasonCodes: item.reasonCodes,
    riskFlags: item.riskFlags,
    blockedReasons: item.blockedReasons,
    requiresConfirmation: isPlanCandidate || guardedActionType === 'open_review' || item.riskLevel === 'high',
    confirmationLevel: isPlanCandidate || guardedActionType === 'open_review' || item.riskLevel === 'high' ? 'review_required' : 'none',
    sourceEngineIds: unique([SOURCE_ENGINE_ID, ...item.sourceIds]),
    createdAt: item.createdAt,
    preview: {
      title: item.title,
      summary: isPlanCandidate ? '查看后再决定' : '不改变计划',
      after: isPlanCandidate ? '只生成候选，不改变计划' : item.userMessage,
      affectedAreas: [item.targetLabel],
      reversible: true,
      durableEffect: isPlanCandidate,
    },
  });
};

export const normalizeWeeklyProgressionRecommendationToGuardedRecommendations = (
  recommendation: WeeklyProgressionRecommendation,
): GuardedRecommendationContract[] =>
  recommendation.items.map((item) => item.guardedRecommendation || normalizeWeeklyProgressionItemToGuardedRecommendation(item));

export const buildWeeklyProgressionRecommendation = (input: WeeklyProgressionInput): WeeklyProgressionRecommendation => {
  const createdAt = input.nowIso || FALLBACK_CREATED_AT;
  const weekId = input.weekId || createdAt.slice(0, 10);
  const volumeAdaptation = input.volumeAdaptation || input.trainingIntelligenceSummary?.volumeAdaptation;
  const plateauResults = input.plateauResults || input.trainingIntelligenceSummary?.plateauResults || [];
  const recommendationConfidence =
    input.recommendationConfidence || input.trainingIntelligenceSummary?.recommendationConfidence || [];
  const sessionQuality = input.sessionQuality || input.trainingIntelligenceSummary?.sessionQuality;
  const painPatterns = input.painPatterns || [];
  const loadFeedbackRisk = loadFeedbackHasRisk(input.loadFeedbackSummary);

  const drafts: ItemDraft[] = [];

  painPatterns.map(painItem).forEach((item) => {
    if (item) drafts.push(item);
  });

  const qualityItem = sessionQualityItem(sessionQuality);
  if (qualityItem) drafts.push(qualityItem);

  const confidenceItem = lowConfidenceItem(recommendationConfidence);
  if (confidenceItem) drafts.push(confidenceItem);

  loadFeedbackRiskItems(input.loadFeedbackSummary).forEach((item) => drafts.push(item));

  (volumeAdaptation?.muscles || [])
    .map((item) =>
      volumeItem(item, {
        confidenceResults: recommendationConfidence,
        sessionQuality,
        painPatterns,
        loadFeedbackRisk,
      }),
    )
    .forEach((item) => {
      if (item) drafts.push(item);
    });

  plateauResults
    .map((item) => plateauItem(item, { confidenceResults: recommendationConfidence, painPatterns }))
    .forEach((item) => {
      if (item) drafts.push(item);
    });

  if (!drafts.length && hasEffectiveSetSignal(input.effectiveSetSummary)) {
    const fallback = effectiveSummaryFallbackItem(input.effectiveSetSummary);
    if (fallback) drafts.push(fallback);
  }

  if (
    !drafts.length &&
    !hasMeaningfulSignals({
      volumeAdaptation,
      plateauResults,
      recommendationConfidence,
      sessionQuality,
      effectiveSetSummary: input.effectiveSetSummary,
      painPatterns,
      loadFeedbackSummary: input.loadFeedbackSummary,
    })
  ) {
    drafts.push(insufficientDataItem());
  }

  const withIds = drafts.map((draft) => makeItem(draft, weekId, createdAt));
  const dedupedItems = dedupeItems(withIds);
  const items = dedupedItems.map((item) => ({
    ...item,
    guardedRecommendation: normalizeWeeklyProgressionItemToGuardedRecommendation(item),
  }));
  const summary = weeklySummary(items);
  const blockedReasons = unique(items.flatMap((item) => item.blockedReasons));
  const hasGlobalLowConfidenceSignal = hasLowConfidence(recommendationConfidence);
  const sourceEngineIds = unique([SOURCE_ENGINE_ID, ...items.flatMap((item) => item.sourceIds)]);

  return {
    id: `weekly-progression:${weekId}`,
    scope: 'week',
    weekId,
    title: titleFromSummary(summary),
    summary,
    items,
    confidence: overallConfidence(items, hasGlobalLowConfidenceSignal),
    riskLevel: overallRisk(items),
    blockedReasons,
    sourceEngineIds,
    createdAt,
    guardedRecommendations: items.map((item) => item.guardedRecommendation).filter((item): item is GuardedRecommendationContract => Boolean(item)),
  };
};
