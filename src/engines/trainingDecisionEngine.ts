// trainingDecisionEngine — sole final-decision owner for training recommendations.
// See docs/TRAINING_RECOMMENDATION_HARD_REWRITE_PLAN_V2.md.
//
// Phase 2 of the hard rewrite: every per-surface user-facing payload (progress,
// plan, record, today, explanation, training, focus) is produced HERE. The
// legacy modules (progressClaritySummary, weeklyProgressionRecommendationEngine,
// postWorkoutNextTimeRecommendationEngine, todayDecisionSurface,
// recommendationTraceEngine, recommendationExplanationPresenter) are deleted.
// Their copy logic is inlined as private helpers below.

import type {
  DeloadDecision,
  EffectiveVolumeSummary,
  ExercisePrescription,
  PainPattern,
  TrainingSession,
  TrainingSetLog,
  UnitSettings,
} from '../models/training-model';
import { buildAdaptiveDeloadDecision } from './adaptiveFeedbackEngine';
import { buildTodayReadiness, mapTodayStatusToReadinessInput } from './readinessEngine';
import { collectPainAreasFromHistory } from './readinessEngine';
import { buildTrainingLapseSignal } from './trainingLapseEngine';
import {
  getEffectiveTrainingPhase,
  type EffectiveTrainingPhase,
} from './effectiveTrainingPhaseEngine';
import { applyStatusRules } from './exercisePrescriptionEngine';
import { isCompletedSet, isIncompleteSet, number as numberish, setWeightKg } from './engineUtils';
import { getExerciseIdentityFromExercise } from './currentExerciseSelector';
import { resolveActionableLoadContract } from './actionableLoadContract';
import { DEFAULT_UNIT_SETTINGS, convertLbToKg, sanitizeUnitSettings } from './unitConversionEngine';
import { formatExerciseName, formatMuscleName } from '../i18n/formatters';
import type { LoadFeedbackSummary } from './loadFeedbackEngine';
import type { PlateauDetectionResult, PlateauStatus } from './plateauDetectionEngine';
import type { RecommendationConfidenceResult } from './recommendationConfidenceEngine';
import type { SessionQualityResult } from './sessionQualityEngine';
import type { TrainingIntelligenceSummary } from './trainingIntelligenceSummaryEngine';
import type { MuscleVolumeAdaptation, VolumeAdaptationReport } from './volumeAdaptationEngine';
import type {
  ExerciseRole,
  ExplanationUserFacing,
  FocusUserFacing,
  HiddenDebugSignals,
  PlanUserFacing,
  PostWorkoutItemView,
  PostWorkoutRecommendationKind,
  ProgressInsightState,
  ProgressRecoveryPressure,
  ProgressStrengthTrendItem,
  ProgressTrendDirection,
  ProgressUserFacing,
  RecommendationFactorEffect,
  RecommendationFactorSource,
  RecommendationFactorTone,
  RecommendationFactorView,
  RecommendationWarningView,
  RecordUserFacing,
  RiskBadge,
  RiskLevel,
  SessionIntent,
  TodayDecisionState,
  TodaySevereNotice,
  TodayUserFacing,
  TrainingDecision,
  TrainingDecisionInput,
  TrainingUserFacing,
  UserFacingMap,
  VolumeMode,
  WeeklyProgressionActionType,
  WeeklyProgressionConfidence,
  WeeklyProgressionItemView,
  WeeklyProgressionRecommendationKind,
  WeeklyProgressionRiskLevel,
  WorkingSetTarget,
} from './trainingDecisionTypes';

// =============================================================================
//   Section 0 — Constants and primitive helpers
// =============================================================================

const ROLE_FLOORS_NORMAL: Record<ExerciseRole, number> = {
  'main-compound': 1,
  'secondary-compound': 1,
  accessory: 1,
  isolation: 1,
};

const ROLE_FLOORS_REENTRY: Record<ExerciseRole, number> = {
  'main-compound': 2,
  'secondary-compound': 2,
  accessory: 1,
  isolation: 1,
};

const REENTRY_VOLUME_FLOOR = 0.65;
const RESTART_VOLUME_FLOOR = 0.55;
const SEVERE_VOLUME_FLOOR = 0.3;

const unique = (items: readonly string[]) => [...new Set(items.filter(Boolean))];
const clean = (value: unknown) => String(value ?? '').trim();
const cleanWS = (value: unknown) => String(value ?? '').replace(/\s+/g, ' ').trim();
const num = (value: unknown) => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};
const roundOne = (value: number) => Math.round(value * 10) / 10;

const roleOf = (kind: string | undefined, name?: string): ExerciseRole => {
  const k = (kind || '').toLowerCase();
  const n = (name || '').toLowerCase();
  if (k === 'compound') {
    if (/(bench|squat|deadlift|press|row|pull|chin|dip)/.test(n)) return 'main-compound';
    return 'secondary-compound';
  }
  if (k === 'machine') return 'accessory';
  if (k === 'isolation') return 'isolation';
  return 'accessory';
};

const phaseToVolumeFloor = (phase: EffectiveTrainingPhase['activePhase']): number => {
  if (phase === 'restart') return RESTART_VOLUME_FLOOR;
  if (phase === 'reentry') return REENTRY_VOLUME_FLOOR;
  return 1;
};

const phaseLabel = (phase: EffectiveTrainingPhase['activePhase']): string => {
  switch (phase) {
    case 'base':
      return '基础周';
    case 'build':
      return '构建周';
    case 'overload':
      return '过载周';
    case 'deload':
      return '减量周';
    case 'reentry':
      return '回归周';
    case 'restart':
      return '重新开始';
  }
};

const intentLabel = (intent: SessionIntent): string => {
  switch (intent) {
    case 'severe-rest':
      return '今天先休息';
    case 'reentry-productive':
      return '回归周，保守但有效';
    case 'controlled-reload':
      return '本周收一档恢复，下次再冲';
    case 'deload-week':
      return '减量周，把恢复做满';
    case 'normal-session':
      return '按计划训练';
  }
};

// =============================================================================
//   Section 1 — Arbitration primitives (volume, intent, modes, risk)
// =============================================================================

const clampMultiplier = (
  effectivePhase: EffectiveTrainingPhase,
  deload: DeloadDecision,
  severeFlag: boolean,
): { multiplier: number; clampReasons: string[] } => {
  const reasons: string[] = [];
  let multiplier = effectivePhase.effectiveWeek.volumeMultiplier;

  if (severeFlag) {
    multiplier = Math.min(multiplier, SEVERE_VOLUME_FLOOR);
    reasons.push('AR-1-severe-cut');
    return { multiplier, clampReasons: reasons };
  }

  const phaseFloor = phaseToVolumeFloor(effectivePhase.activePhase);
  if (deload.triggered && deload.volumeMultiplier < phaseFloor && effectivePhase.activePhase !== 'deload') {
    if (effectivePhase.activePhase === 'reentry' || effectivePhase.activePhase === 'restart') {
      reasons.push(
        `AR-2-reentry-clamp-deload(${deload.volumeMultiplier.toFixed(2)}->${phaseFloor.toFixed(2)})`,
      );
      multiplier = Math.max(multiplier, phaseFloor);
    } else {
      multiplier = Math.min(multiplier, deload.volumeMultiplier);
      reasons.push('AR-2-min-not-product');
    }
  } else if (deload.triggered) {
    multiplier = Math.min(multiplier, deload.volumeMultiplier);
    reasons.push('AR-2-min-not-product');
  }

  return { multiplier, clampReasons: reasons };
};

const sessionIntentFor = (
  effectivePhase: EffectiveTrainingPhase,
  severeFlag: boolean,
  explicitDeload: boolean,
  e1rmTrendUp: boolean,
  recoveryHigh: boolean,
): SessionIntent => {
  if (severeFlag) return 'severe-rest';
  if (effectivePhase.activePhase === 'reentry' || effectivePhase.activePhase === 'restart') {
    return 'reentry-productive';
  }
  if (explicitDeload || effectivePhase.activePhase === 'deload') return 'deload-week';
  if (e1rmTrendUp && recoveryHigh) return 'controlled-reload';
  return 'normal-session';
};

const volumeModeFor = (intent: SessionIntent, multiplier: number): VolumeMode => {
  if (intent === 'severe-rest') return 'severe-cut';
  if (intent === 'reentry-productive') return 'reentry-floor';
  if (intent === 'deload-week') return 'trim';
  if (multiplier > 1.05) return 'expand';
  if (multiplier < 0.95) return 'trim';
  return 'hold';
};

const intensityModeFor = (
  intent: SessionIntent,
  trainingAdjustment: 'push' | 'normal' | 'conservative' | 'recovery',
): TrainingDecision['intensityMode'] => {
  if (intent === 'severe-rest') return 'cut';
  if (intent === 'reentry-productive') return 'cap';
  if (intent === 'controlled-reload') return 'cap';
  if (intent === 'deload-week') return 'cap';
  if (trainingAdjustment === 'push') return 'expand';
  if (trainingAdjustment === 'conservative' || trainingAdjustment === 'recovery') return 'cap';
  return 'hold';
};

const progressionModeFor = (
  intent: SessionIntent,
  e1rmTrendUp: boolean,
): TrainingDecision['progressionMode'] => {
  if (intent === 'severe-rest') return 'pull-back';
  if (intent === 'controlled-reload') return 'reload';
  if (intent === 'reentry-productive') return 'hold';
  if (intent === 'deload-week') return 'hold';
  if (e1rmTrendUp) return 'progress';
  return 'hold';
};

const riskLevelFor = (
  severeFlag: boolean,
  readinessLevel: 'high' | 'medium' | 'low',
  painCount: number,
): RiskLevel => {
  if (severeFlag) return 'severe';
  if (painCount > 0 && readinessLevel === 'low') return 'high';
  if (readinessLevel === 'low') return 'moderate';
  if (painCount > 0) return 'low';
  return 'none';
};

const isE1rmTrendUp = (history: TrainingDecisionInput['history']): boolean => {
  if (!history || history.length < 4) return false;
  const tops: number[] = [];
  for (const s of history) {
    if (s.completed === false) continue;
    for (const ex of s.exercises || []) {
      const sets = Array.isArray(ex.sets) ? ex.sets : [];
      const top = sets
        .map((set) => Number(set.weight) || 0)
        .reduce((a, b) => Math.max(a, b), 0);
      if (top > 0) tops.push(top);
    }
  }
  if (tops.length < 4) return false;
  const recent = tops.slice(-3).reduce((a, b) => a + b, 0) / 3;
  const older = tops.slice(0, -3).reduce((a, b) => a + b, 0) / Math.max(1, tops.length - 3);
  return recent > older;
};

// =============================================================================
//   Section 2 — Progress surface (inlined progressClaritySummary)
// =============================================================================

type ProgressCopySource = {
  effectiveSetSummary?: Pick<
    EffectiveVolumeSummary,
    | 'completedSets'
    | 'effectiveSets'
    | 'highConfidenceEffectiveSets'
    | 'mediumConfidenceEffectiveSets'
    | 'lowConfidenceEffectiveSets'
  >;
  volumeSummary?: {
    thisMonthSessions?: number;
    recentFourWeekAverage?: number;
    completedSets?: number;
    painSessionCount?: number;
    monthVolumeLabel?: string;
  };
  strengthTrendItems?: ProgressStrengthTrendItem[];
  strengthTrend?: ProgressTrendDirection;
  recoveryPressure?: ProgressRecoveryPressure;
  dataCoverageStatus?: 'sufficient' | 'limited' | 'insufficient';
};

const inferTrend = (input: ProgressCopySource): ProgressTrendDirection => {
  if (input.strengthTrend) return input.strengthTrend;
  const items = input.strengthTrendItems || [];
  if (!items.length) return 'unknown';
  if (items.some((item) => item.trend === 'improving')) return 'improving';
  if (items.some((item) => item.trend === 'declining')) return 'declining';
  if (items.every((item) => item.trend === 'stable' || item.trend === 'unknown')) return 'stable';
  return 'mixed';
};

const inferRecoveryPressure = (input: ProgressCopySource): ProgressRecoveryPressure => {
  if (input.recoveryPressure) return input.recoveryPressure;
  const effectiveSets = input.effectiveSetSummary?.effectiveSets || 0;
  const completedSets = input.effectiveSetSummary?.completedSets || input.volumeSummary?.completedSets || 0;
  const painSessions = input.volumeSummary?.painSessionCount || 0;
  if (painSessions > 0 || effectiveSets >= 24 || completedSets >= 32) return 'high';
  if (effectiveSets <= 0 && completedSets <= 0) return 'unknown';
  return 'normal';
};

const hasEnoughData = (input: ProgressCopySource) => {
  if (input.dataCoverageStatus === 'insufficient') return false;
  const hasStrengthData = (input.strengthTrendItems || []).some(
    (item) => item.trend !== 'unknown' || !/暂无|不足/.test(item.currentLabel),
  );
  const hasSetData =
    (input.effectiveSetSummary?.completedSets || 0) > 0 ||
    (input.volumeSummary?.completedSets || 0) > 0;
  return input.dataCoverageStatus === 'sufficient' || hasStrengthData || hasSetData;
};

const buildEffectiveSetExplanation = (input: ProgressCopySource, pressure: ProgressRecoveryPressure) => {
  const summary = input.effectiveSetSummary;
  if (!summary || summary.completedSets <= 0)
    return '有效组数据不足。完成几次正式训练后，这里会解释训练刺激和恢复压力。';
  const confidenceCopy =
    summary.highConfidenceEffectiveSets > 0
      ? `${summary.highConfidenceEffectiveSets} 组为高置信有效组`
      : '高置信有效组还不多';
  if (pressure === 'high') {
    return `本期有效组 ${summary.effectiveSets} / 完成组 ${summary.completedSets}，${confidenceCopy}。训练刺激偏高时，恢复压力可能增加。`;
  }
  return `本期有效组 ${summary.effectiveSets} / 完成组 ${summary.completedSets}，${confidenceCopy}。这些数字用于解释趋势，不会改变训练计划。`;
};

const buildVolumeExplanation = (input: ProgressCopySource, pressure: ProgressRecoveryPressure) => {
  const volume = input.volumeSummary || {};
  const frequency = Number.isFinite(volume.recentFourWeekAverage)
    ? `近 4 周平均 ${roundOne(volume.recentFourWeekAverage || 0)} 次/周`
    : '近 4 周频率数据不足';
  const month = Number.isFinite(volume.thisMonthSessions)
    ? `本月 ${volume.thisMonthSessions} 次训练`
    : '本月训练次数不足';
  const pain = (volume.painSessionCount || 0) > 0 ? `，有 ${volume.painSessionCount} 次训练带不适标记` : '';
  if (pressure === 'high') return `${month}，${frequency}${pain}。建议先保持重量或减少一组，观察恢复。`;
  if (pressure === 'recovery') return `${month}，${frequency}${pain}。当前更适合恢复优先，避免把趋势解释成必须加量。`;
  return `${month}，${frequency}${pain}。训练量解释只用于阅读状态，不会自动调整处方。`;
};

interface ProgressStateCopy {
  insightState: ProgressInsightState;
  heroTitle: string;
  heroExplanation: string;
  primaryRecommendation: string;
  readinessLabel: string;
  recoveryPressureLabel: string;
  caution?: string;
}

const progressStateCopy = (
  trend: ProgressTrendDirection,
  pressure: ProgressRecoveryPressure,
  dataSufficient: boolean,
  intent: SessionIntent,
): ProgressStateCopy => {
  if (!dataSufficient) {
    return {
      insightState: 'data_insufficient',
      heroTitle: '数据不足，先继续记录',
      heroExplanation:
        '目前还不能可靠判断力量趋势或恢复压力。完成几次正常训练后，Progress 会给出更明确的解释。',
      primaryRecommendation: '继续观察',
      readinessLabel: '数据不足',
      recoveryPressureLabel: '压力未知',
      caution: '不要用少量记录推断长期趋势。',
    };
  }

  // AR-5: suppress the legacy triplet when TrainingDecision picks a non-normal intent
  if (intent === 'reentry-productive') {
    return {
      insightState: 'stable',
      heroTitle: '回归周，先稳住质量',
      heroExplanation: '已在回归阶段，趋势解释仅作参考。',
      primaryRecommendation: '维持负荷',
      readinessLabel: '回归周',
      recoveryPressureLabel: '回归节奏',
    };
  }
  if (intent === 'deload-week') {
    return {
      insightState: 'recovery_recommended',
      heroTitle: '减量周，先把恢复做满',
      heroExplanation: '减量周内趋势波动属正常。',
      primaryRecommendation: '维持节奏',
      readinessLabel: '减量周',
      recoveryPressureLabel: '主动恢复',
    };
  }
  if (intent === 'controlled-reload') {
    return {
      insightState: 'stable',
      heroTitle: '本周收一档恢复',
      heroExplanation: '保持重量，控制疲劳，下一周再冲。',
      primaryRecommendation: '维持重量',
      readinessLabel: '建议保守',
      recoveryPressureLabel: '主动调整',
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

const buildProgressUserFacing = (
  intent: SessionIntent,
  phase: EffectiveTrainingPhase,
  riskBadge: RiskBadge | undefined,
  oneLineAdvice: string,
  source: ProgressCopySource,
): ProgressUserFacing => {
  const trend = inferTrend(source);
  const pressure = inferRecoveryPressure(source);
  const dataSufficient = hasEnoughData(source);
  const copy = progressStateCopy(trend, pressure, dataSufficient, intent);
  return {
    surfaceId: 'progress',
    headline: copy.heroTitle.length <= 60 ? copy.heroTitle : intentLabel(intent),
    oneLineAdvice,
    riskBadge,
    micro: { phaseLabel: phaseLabel(phase.activePhase) },
    insightState: copy.insightState,
    heroTitle: copy.heroTitle,
    heroExplanation: copy.heroExplanation,
    primaryRecommendation: copy.primaryRecommendation,
    readinessLabel: copy.readinessLabel,
    recoveryPressureLabel: copy.recoveryPressureLabel,
    caution: copy.caution,
    effectiveSetExplanation: buildEffectiveSetExplanation(source, pressure),
    volumeExplanation: buildVolumeExplanation(source, pressure),
    dataCoverageHint: dataSufficient
      ? '使用现有正常训练记录生成解释；PR、e1RM、有效组和训练量计算保持不变。'
      : '数据不足时只显示保守解释，不做趋势过度判断。',
    strengthTrendItems: source.strengthTrendItems || [],
  };
};

// =============================================================================
//   Section 3 — Plan surface (inlined weeklyProgressionRecommendationEngine)
// =============================================================================

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

const muscleLabelFor = (id: string) => formatMuscleName(id);
const exerciseLabelFor = (id: string) => formatExerciseName(id);

const painIsRecurringOrSevere = (pattern: PainPattern) =>
  pattern.suggestedAction === 'substitute' ||
  pattern.suggestedAction === 'deload' ||
  pattern.suggestedAction === 'seek_professional' ||
  num(pattern.frequency) >= 2 ||
  num(pattern.severityAvg) >= 3.5;

const painIsSevere = (pattern: PainPattern) =>
  pattern.suggestedAction === 'deload' ||
  pattern.suggestedAction === 'seek_professional' ||
  num(pattern.severityAvg) >= 4.5;

const normalizeKey = (value: unknown) => clean(value).toLowerCase();

const painMatchesMuscle = (pattern: PainPattern, muscleId: string) => {
  const area = normalizeKey(pattern.area);
  const id = normalizeKey(muscleId);
  const label = normalizeKey(muscleLabelFor(muscleId));
  return area === id || area === label || area.includes(id) || area.includes(label) || id.includes(area) || label.includes(area);
};

const hasPainForMuscle = (patterns: PainPattern[] = [], muscleId: string) =>
  patterns.some((p) => painIsRecurringOrSevere(p) && painMatchesMuscle(p, muscleId));

const hasPainForExercise = (patterns: PainPattern[] = [], exerciseId: string) =>
  patterns.some((p) => painIsRecurringOrSevere(p) && Boolean(p.exerciseId) && p.exerciseId === exerciseId);

const loadFeedbackItems = (input: WeeklyProgressionSource['loadFeedbackSummary']) => {
  if (!input) return [];
  if (Array.isArray(input)) return input;
  return Object.values(input).filter((item): item is LoadFeedbackSummary => Boolean(item));
};

const loadFeedbackHasRisk = (input: WeeklyProgressionSource['loadFeedbackSummary']) =>
  loadFeedbackItems(input).some(
    (item) =>
      item.adjustment?.direction === 'conservative' ||
      item.dominantFeedback === 'too_heavy' ||
      num(item.counts?.too_heavy) >= 2,
  );

const confidenceExerciseId = (result: RecommendationConfidenceResult) =>
  clean((result as RecommendationConfidenceResult & { exerciseId?: string }).exerciseId);

const hasLowConfidence = (results: RecommendationConfidenceResult[] = [], targetId?: string) =>
  results.some((item) => item.level === 'low' && (!targetId || !confidenceExerciseId(item) || confidenceExerciseId(item) === targetId));

const confidenceForTarget = (results: RecommendationConfidenceResult[] = [], targetId?: string) =>
  hasLowConfidence(results, targetId) ? 'low' : undefined;

const plateauUserMessage = (status: PlateauStatus, label: string) => {
  if (status === 'plateau') return `${label} 近期停滞，先复查。`;
  if (status === 'possible_plateau') return `${label} 进展放缓，继续观察。`;
  if (status === 'load_too_aggressive') return `${label} 不急于加重。`;
  if (status === 'technique_limited') return `${label} 先稳住动作。`;
  if (status === 'fatigue_limited') return `${label} 先控制疲劳。`;
  if (status === 'volume_limited') return `${label} 先复查训练量。`;
  return `${label} 继续观察。`;
};

interface WeeklyProgressionSource {
  trainingIntelligenceSummary?: TrainingIntelligenceSummary;
  volumeAdaptation?: VolumeAdaptationReport;
  plateauResults?: PlateauDetectionResult[];
  recommendationConfidence?: RecommendationConfidenceResult[];
  sessionQuality?: SessionQualityResult;
  effectiveSetSummary?: Partial<EffectiveVolumeSummary> | null;
  painPatterns?: PainPattern[];
  loadFeedbackSummary?: LoadFeedbackSummary[] | Record<string, LoadFeedbackSummary> | null;
}

type WeeklyDraft = Omit<WeeklyProgressionItemView,
  'id' | 'actionLabel' | 'previewSummary' | 'reason' | 'risk' | 'nextStep' | 'confidenceLabel' | 'riskLevelLabel'>;

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

const volumeDraft = (
  item: MuscleVolumeAdaptation,
  context: {
    confidenceResults: RecommendationConfidenceResult[];
    sessionQuality?: SessionQualityResult;
    painPatterns: PainPattern[];
    loadFeedbackRisk: boolean;
  },
): WeeklyDraft | null => {
  if (item.decision === 'insufficient_data') return null;

  const label = muscleLabelFor(item.muscleId);
  const lowConfidence = hasLowConfidence(context.confidenceResults);
  const blockedReasons = unique([
    ...(lowConfidence ? ['low_confidence'] : []),
    ...(context.sessionQuality?.level === 'low' ? ['low_session_quality'] : []),
    ...(context.loadFeedbackRisk ? ['load_feedback_risk'] : []),
    ...(hasPainForMuscle(context.painPatterns, item.muscleId) ? ['pain_risk'] : []),
  ]);
  const confidence = (confidenceForTarget(context.confidenceResults) || item.confidence) as WeeklyProgressionConfidence;

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
        confidence: (confidence === 'high' ? 'medium' : confidence) as WeeklyProgressionConfidence,
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
      recommendationKind:
        blockedReasons.includes('pain_risk') || Math.abs(num(item.setsDelta)) >= 2 ? 'deload' : 'conservative_progress',
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
    };
  }

  return null;
};

const exerciseDisplayFromPlateau = (result: PlateauDetectionResult) => {
  const fromTitle = result.title.split('：')[0]?.trim();
  if (fromTitle && fromTitle !== result.title) return fromTitle;
  return exerciseLabelFor(result.exerciseId);
};

const plateauDraft = (
  result: PlateauDetectionResult,
  context: { confidenceResults: RecommendationConfidenceResult[]; painPatterns: PainPattern[] },
): WeeklyDraft | null => {
  if (result.status === 'none' || result.status === 'insufficient_data') return null;
  const label = exerciseDisplayFromPlateau(result);
  const base = {
    targetType: 'exercise' as const,
    targetId: result.exerciseId,
    targetLabel: label,
    title: `${label} 复查进展`,
    summary: plateauUserMessage(result.status, label),
    userMessage: plateauUserMessage(result.status, label),
    confidence: (confidenceForTarget(context.confidenceResults, result.exerciseId) || result.confidence) as WeeklyProgressionConfidence,
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

  const mapKindAction = (
    kind: WeeklyProgressionRecommendationKind,
    action: WeeklyProgressionActionType,
    riskLevel: WeeklyProgressionRiskLevel,
    reasonCodes: string[],
    riskFlags: string[],
    suggested: string[],
  ): WeeklyDraft => ({
    ...base,
    recommendationKind: kind,
    actionType: action,
    title: kind === 'technique_focus' ? `${label} 先稳住动作` : kind === 'pain_review' ? `${label} 先复查` : base.title,
    riskLevel,
    reasonCodes,
    riskFlags,
    suggestedActions: suggested,
  });

  if (result.status === 'load_too_aggressive')
    return mapKindAction('conservative_progress', 'review_exercise', 'medium', ['load_too_aggressive'], ['load_too_aggressive'], ['不急于加重', '查看后再决定']);
  if (result.status === 'technique_limited')
    return mapKindAction('technique_focus', 'review_technique', 'medium', ['technique_limited'], ['technique'], ['先稳住动作']);
  if (result.status === 'fatigue_limited')
    return mapKindAction('conservative_progress', 'review_exercise', 'medium', ['fatigue_limited'], ['fatigue'], ['先控制疲劳']);
  if (result.status === 'volume_limited')
    return mapKindAction('review_volume', 'review_volume', 'medium', ['volume_limited'], [], ['先复查训练量']);

  return mapKindAction(
    'review_exercise',
    'review_exercise',
    result.status === 'plateau' ? 'medium' : 'low',
    [result.status],
    [],
    [result.status === 'plateau' ? '先复查' : '继续观察'],
  );
};

const painDraft = (pattern: PainPattern): WeeklyDraft | null => {
  if (!painIsRecurringOrSevere(pattern)) return null;
  const targetType = pattern.exerciseId ? 'exercise' : 'muscle';
  const targetId = pattern.exerciseId || pattern.area;
  const targetLabel = pattern.exerciseId ? exerciseLabelFor(pattern.exerciseId) : muscleLabelFor(pattern.area);
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
    riskLevel: severe ? 'high' : 'medium',
    reasonCodes: ['pain_pattern'],
    riskFlags: unique(['pain', ...(pattern.suggestedAction === 'seek_professional' ? ['medical_risk'] : [])]),
    blockedReasons: ['pain_risk'],
    suggestedActions: ['查看后再决定'],
  };
};

const sessionQualityDraft = (result?: SessionQualityResult): WeeklyDraft | null => {
  if (!result || result.level !== 'low') return null;
  return {
    targetType: 'session',
    targetLabel: '本周训练',
    recommendationKind: 'technique_focus',
    actionType: 'review_technique',
    title: '先保证训练质量',
    summary: '先保证训练质量。',
    userMessage: '先保证训练质量。',
    confidence: result.confidence as WeeklyProgressionConfidence,
    riskLevel: 'medium',
    reasonCodes: ['low_session_quality'],
    riskFlags: ['technique'],
    blockedReasons: ['low_session_quality'],
    suggestedActions: ['先稳住动作'],
  };
};

const lowConfidenceDraft = (results: RecommendationConfidenceResult[]): WeeklyDraft | null => {
  if (!hasLowConfidence(results)) return null;
  const result = results.find((item) => item.level === 'low');
  const exerciseId = result ? confidenceExerciseId(result) : '';
  const targetType = exerciseId ? 'exercise' : 'week';
  const targetLabel = exerciseId ? exerciseLabelFor(exerciseId) : '本周训练';
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
  };
};

const loadFeedbackRiskDrafts = (input: WeeklyProgressionSource['loadFeedbackSummary']): WeeklyDraft[] =>
  loadFeedbackItems(input)
    .filter(
      (item) =>
        item.exerciseId &&
        (item.adjustment?.direction === 'conservative' ||
          item.dominantFeedback === 'too_heavy' ||
          num(item.counts?.too_heavy) >= 2),
    )
    .map((item) => {
      const exerciseId = item.exerciseId || '';
      const label = exerciseLabelFor(exerciseId);
      return {
        targetType: 'exercise' as const,
        targetId: exerciseId,
        targetLabel: label,
        recommendationKind: 'conservative_progress' as WeeklyProgressionRecommendationKind,
        actionType: 'review_exercise' as WeeklyProgressionActionType,
        title: `${label} 不急于加重`,
        summary: `${label} 不急于加重。`,
        userMessage: `${label} 不急于加重。`,
        confidence: 'medium' as WeeklyProgressionConfidence,
        riskLevel: 'medium' as WeeklyProgressionRiskLevel,
        reasonCodes: ['load_feedback_risk'],
        riskFlags: ['load_too_aggressive'],
        blockedReasons: ['load_feedback_risk'],
        suggestedActions: ['不急于加重'],
      };
    });

const hasEffectiveSetSignal = (summary?: Partial<EffectiveVolumeSummary> | null) =>
  Boolean(
    summary &&
      (num(summary.completedSets) > 0 ||
        num(summary.effectiveSets) > 0 ||
        num(summary.highConfidenceEffectiveSets) > 0 ||
        Object.keys(summary.byMuscle || {}).length > 0),
  );

const effectiveSetSummaryDraft = (summary?: Partial<EffectiveVolumeSummary> | null): WeeklyDraft | null => {
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
  };
};

const insufficientDataDraft = (): WeeklyDraft => ({
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
});

const volumeHasMeaningfulSignals = (report?: VolumeAdaptationReport) =>
  Boolean(report?.muscles?.some((item) => item.decision && item.decision !== 'insufficient_data'));

const plateauHasMeaningfulSignals = (results: PlateauDetectionResult[] = []) =>
  results.some((item) => item.status !== 'none' && item.status !== 'insufficient_data');

const confidenceHasMeaningfulSignals = (results: RecommendationConfidenceResult[] = []) =>
  results.some((item) => item.level === 'low' || item.level === 'medium' || item.level === 'high');

const sessionQualityHasMeaningfulSignals = (result?: SessionQualityResult) =>
  Boolean(result && result.level !== 'insufficient_data');

const targetKey = (draft: WeeklyDraft) => `${draft.targetType}:${draft.targetId || draft.targetLabel}`;

const dedupeWeeklyDrafts = (drafts: WeeklyDraft[]) => {
  const byTarget = new Map<string, WeeklyDraft>();
  const order: string[] = [];
  drafts.forEach((draft) => {
    const key = targetKey(draft);
    const existing = byTarget.get(key);
    if (!existing) {
      byTarget.set(key, draft);
      order.push(key);
      return;
    }
    if (itemRank[draft.recommendationKind] > itemRank[existing.recommendationKind]) {
      byTarget.set(key, draft);
    }
  });
  return order.map((key) => byTarget.get(key)!).filter(Boolean);
};

const actionLabelFor = (draft: WeeklyDraft): string => {
  if (draft.recommendationKind === 'progress') return '小幅推进';
  if (draft.recommendationKind === 'maintain') return '维持';
  if (draft.recommendationKind === 'deload' || draft.actionType === 'reduce_volume') return '减少';
  if (
    draft.recommendationKind === 'review_exercise' ||
    draft.recommendationKind === 'review_volume' ||
    draft.recommendationKind === 'technique_focus' ||
    draft.recommendationKind === 'pain_review'
  ) {
    return '复查动作';
  }
  if (draft.recommendationKind === 'insufficient_data') return '继续记录';
  return '暂缓';
};

const hasAnySignal = (draft: WeeklyDraft, signals: readonly string[]) => {
  const values = [...draft.reasonCodes, ...draft.riskFlags, ...draft.blockedReasons];
  return signals.some((s) => values.includes(s));
};

const formatWeeklyReason = (draft: WeeklyDraft) => {
  if (hasAnySignal(draft, ['pain_pattern', 'pain_risk'])) return '有不适记录，先复查。';
  if (hasAnySignal(draft, ['low_confidence'])) return '可用记录还不够稳定。';
  if (hasAnySignal(draft, ['volume_decrease'])) return '近期压力偏高，先控制训练量。';
  if (hasAnySignal(draft, ['volume_increase'])) return '近期完成度支持小幅推进。';
  if (hasAnySignal(draft, ['volume_maintain', 'effective_set_summary'])) return '当前训练量接近目标。';
  if (hasAnySignal(draft, ['volume_hold'])) return '当前信号不够一致，先继续观察。';
  if (hasAnySignal(draft, ['plateau'])) return '近期进展停滞，先复查动作历史。';
  if (hasAnySignal(draft, ['possible_plateau'])) return '近期进展放缓，继续观察。';
  if (hasAnySignal(draft, ['load_too_aggressive', 'load_feedback_risk'])) return '重量推进偏快，先稳住。';
  if (hasAnySignal(draft, ['technique_limited', 'low_session_quality'])) return '动作质量限制推进。';
  if (hasAnySignal(draft, ['fatigue_limited'])) return '疲劳信号较明显。';
  if (hasAnySignal(draft, ['volume_limited'])) return '有效训练量可能不足。';
  if (hasAnySignal(draft, ['volume_increase_blocked'])) return '当前信号不够一致，先继续观察。';
  if (hasAnySignal(draft, ['insufficient_data'])) return '继续记录后再判断。';
  return '依据来自近期训练记录。';
};

const formatWeeklyRisk = (draft: WeeklyDraft) => {
  if (hasAnySignal(draft, ['medical_risk'])) return '如不适持续，请先停止相关动作。';
  if (hasAnySignal(draft, ['pain', 'pain_risk'])) return '有不适记录，暂不建议直接推进。';
  if (hasAnySignal(draft, ['technique', 'technique_limited', 'low_session_quality'])) return '动作质量需要优先稳定。';
  if (hasAnySignal(draft, ['fatigue', 'fatigue_limited'])) return '疲劳较高，先保守处理。';
  if (hasAnySignal(draft, ['load_too_aggressive', 'load_feedback_risk'])) return '重量推进不要过快。';
  if (draft.riskLevel === 'high') return '风险较高，先复查。';
  if (draft.riskLevel === 'medium') return '风险中等，查看后再决定。';
  return '风险较低，仍需观察反馈。';
};

const formatWeeklyConfidence = (draft: WeeklyDraft) => {
  if (draft.confidence === 'high') return '置信度高';
  if (draft.confidence === 'medium') return '置信度中等';
  return '置信度偏低';
};

const formatWeeklyRiskLevel = (draft: WeeklyDraft) => {
  if (draft.riskLevel === 'high') return '风险较高';
  if (draft.riskLevel === 'medium') return '风险中等';
  return '风险较低';
};

const nextStepFallback = (draft: WeeklyDraft) => {
  if (draft.recommendationKind === 'progress') return '查看后再决定。';
  if (draft.recommendationKind === 'maintain') return '维持当前节奏。';
  if (draft.recommendationKind === 'deload') return '先控制训练压力。';
  if (draft.recommendationKind === 'review_exercise') return '先复查动作历史。';
  if (draft.recommendationKind === 'technique_focus') return '先稳住动作。';
  if (draft.recommendationKind === 'pain_review') return '有不适，先复查。';
  if (draft.recommendationKind === 'insufficient_data') return '继续记录训练。';
  return '继续记录后再判断。';
};

const passiveNextStepCopy = new Set([
  '查看后再决定',
  '只生成候选，不改变计划',
  '不改变计划',
  '继续记录后再判断',
  '下周维持当前节奏',
  '维持当前节奏',
  '先复查',
  '继续观察',
  '不急于加重',
  '先稳住动作',
  '先控制疲劳',
  '先复查训练量',
  '继续记录训练',
  '先控制训练压力',
  '先复查动作历史',
  '有不适，先复查',
]);

const trimSentenceEnd = (value: string) => value.replace(/[。！？]+$/u, '').trim();
const completeSentence = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return '';
  return /[。！？]$/u.test(trimmed) ? trimmed : `${trimmed}。`;
};
const cleanPassiveNextStep = (value: unknown) => {
  const normalized = trimSentenceEnd(String(value ?? ''));
  if (!passiveNextStepCopy.has(normalized)) return '';
  return completeSentence(normalized);
};

const formatWeeklyNextStep = (draft: WeeklyDraft) => {
  const actions = unique(draft.suggestedActions.map(cleanPassiveNextStep)).slice(0, 2);
  if (actions.length) return actions.join(' ');
  return nextStepFallback(draft);
};

const previewSummaryFor = (draft: WeeklyDraft) =>
  draft.actionType === 'generate_plan_candidate' ? '查看后再决定' : '不改变计划';

const weeklySummary = (drafts: WeeklyDraft[], intent: SessionIntent): string => {
  // AR-5: suppress 「本周先控制风险。」 under reentry / controlled-reload / deload-week
  if (intent === 'reentry-productive') return '已在回归周，先维持当前节奏。';
  if (intent === 'controlled-reload') return '本周收一档恢复，下次再冲。';
  if (intent === 'deload-week') return '减量周，把恢复做满。';
  if (intent === 'severe-rest') return '今天先休息，处理身体信号。';
  if (drafts.some((d) => d.recommendationKind === 'insufficient_data')) return '继续记录后再判断。';
  if (drafts.some((d) => d.recommendationKind === 'progress')) return '下周可小幅推进。';
  if (drafts.length && drafts.every((d) => d.recommendationKind === 'maintain')) return '下周维持当前节奏。';
  return '下周维持当前节奏。';
};

const titleFromSummary = (summary: string) => summary.replace(/。$/, '');

const draftToView = (draft: WeeklyDraft, weekId: string): WeeklyProgressionItemView => ({
  ...draft,
  id: `weekly-progression:${weekId}:${draft.targetType}:${draft.targetId || draft.targetLabel}:${draft.recommendationKind}:${draft.actionType}`,
  actionLabel: actionLabelFor(draft),
  previewSummary: previewSummaryFor(draft),
  reason: formatWeeklyReason(draft),
  risk: formatWeeklyRisk(draft),
  nextStep: formatWeeklyNextStep(draft),
  confidenceLabel: formatWeeklyConfidence(draft),
  riskLevelLabel: formatWeeklyRiskLevel(draft),
});

const buildWeeklyProgressionItemViews = (
  source: WeeklyProgressionSource,
  intent: SessionIntent,
  weekId: string,
): { title: string; summary: string; items: WeeklyProgressionItemView[] } => {
  const volumeAdaptation = source.volumeAdaptation || source.trainingIntelligenceSummary?.volumeAdaptation;
  const plateauResults = source.plateauResults || source.trainingIntelligenceSummary?.plateauResults || [];
  const recommendationConfidence =
    source.recommendationConfidence || source.trainingIntelligenceSummary?.recommendationConfidence || [];
  const sessionQuality = source.sessionQuality || source.trainingIntelligenceSummary?.sessionQuality;
  const painPatterns = source.painPatterns || [];
  const loadFeedbackRisk = loadFeedbackHasRisk(source.loadFeedbackSummary);

  const drafts: WeeklyDraft[] = [];
  painPatterns.map(painDraft).forEach((d) => d && drafts.push(d));
  const q = sessionQualityDraft(sessionQuality);
  if (q) drafts.push(q);
  const conf = lowConfidenceDraft(recommendationConfidence);
  if (conf) drafts.push(conf);
  loadFeedbackRiskDrafts(source.loadFeedbackSummary).forEach((d) => drafts.push(d));
  (volumeAdaptation?.muscles || [])
    .map((item) =>
      volumeDraft(item, {
        confidenceResults: recommendationConfidence,
        sessionQuality,
        painPatterns,
        loadFeedbackRisk,
      }),
    )
    .forEach((d) => d && drafts.push(d));
  plateauResults
    .map((r) => plateauDraft(r, { confidenceResults: recommendationConfidence, painPatterns }))
    .forEach((d) => d && drafts.push(d));

  if (!drafts.length && hasEffectiveSetSignal(source.effectiveSetSummary)) {
    const fb = effectiveSetSummaryDraft(source.effectiveSetSummary);
    if (fb) drafts.push(fb);
  }

  const hasMeaningful =
    volumeHasMeaningfulSignals(volumeAdaptation) ||
    plateauHasMeaningfulSignals(plateauResults) ||
    confidenceHasMeaningfulSignals(recommendationConfidence) ||
    sessionQualityHasMeaningfulSignals(sessionQuality) ||
    hasEffectiveSetSignal(source.effectiveSetSummary) ||
    painPatterns.some(painIsRecurringOrSevere) ||
    loadFeedbackHasRisk(source.loadFeedbackSummary);
  if (!drafts.length && !hasMeaningful) drafts.push(insufficientDataDraft());

  const deduped = dedupeWeeklyDrafts(drafts);
  const items = deduped.map((d) => draftToView(d, weekId));
  const summary = weeklySummary(deduped, intent);
  const title = titleFromSummary(summary);
  return { title, summary, items };
};

const buildPlanUserFacing = (
  intent: SessionIntent,
  phase: EffectiveTrainingPhase,
  riskBadge: RiskBadge | undefined,
  oneLineAdvice: string,
  source: WeeklyProgressionSource,
  weekId: string,
  weeklyDirection: 'increase' | 'hold' | 'decrease',
  weeklyBlocked: boolean,
): PlanUserFacing => {
  const { title, summary, items } = buildWeeklyProgressionItemViews(source, intent, weekId);
  const direction =
    weeklyDirection === 'increase'
      ? '下周可小幅推进'
      : weeklyDirection === 'decrease'
        ? '下周需要降量'
        : weeklyBlocked
          ? '维持当前节奏'
          : '下周维持当前节奏';
  return {
    surfaceId: 'plan',
    headline: title.length <= 60 ? title : intentLabel(intent),
    oneLineAdvice,
    riskBadge,
    micro: { phaseLabel: phaseLabel(phase.activePhase) },
    title,
    summary,
    weeklyDirection: direction,
    weeklyItems: items,
  };
};

// =============================================================================
//   Section 4 — Record surface (inlined postWorkoutNextTimeRecommendationEngine)
// =============================================================================

const NON_MAIN_SET_TYPES = new Set(['warmup', 'corrective', 'correction', 'functional', 'support']);
const EXCLUDED_SESSION_FLAGS = new Set(['test', 'excluded']);

const setTypeText = (set: TrainingSetLog) =>
  String((set as TrainingSetLog & { setType?: unknown; stepType?: unknown }).setType || (set as TrainingSetLog & { stepType?: unknown }).stepType || set.type || '')
    .trim()
    .toLowerCase();

const isMainWorkingSet = (set: TrainingSetLog) => !NON_MAIN_SET_TYPES.has(setTypeText(set));

const isUsableCompletedWorkingSet = (set: TrainingSetLog) =>
  isMainWorkingSet(set) && isCompletedSet(set) && setWeightKg(set) > 0 && numberish(set.reps) > 0;

const parseRir = (value: unknown): number | undefined => {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = numberish(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const configuredIncrementKg = (unitSettings: Partial<UnitSettings> | undefined): number => {
  const settings = sanitizeUnitSettings(unitSettings);
  if (settings.weightUnit === 'lb') return convertLbToKg(settings.defaultIncrementLb || DEFAULT_UNIT_SETTINGS.defaultIncrementLb);
  return settings.defaultIncrementKg || DEFAULT_UNIT_SETTINGS.defaultIncrementKg;
};

const exerciseDisplayName = (exercise: ExercisePrescription, exerciseId: string) =>
  clean(exercise.name) || clean(exercise.alias) || clean(exercise.actualExerciseId) || exerciseId;

const topCompletedSet = (sets: TrainingSetLog[]) =>
  [...sets].sort((a, b) => {
    const weightDiff = setWeightKg(b) - setWeightKg(a);
    if (weightDiff) return weightDiff;
    return numberish(b.reps) - numberish(a.reps);
  })[0];

interface PostWorkoutAnalysis {
  exercise: ExercisePrescription;
  exerciseId: string;
  exerciseName: string;
  workingSets: TrainingSetLog[];
  completedWorkingSets: TrainingSetLog[];
  incompleteWorkingSets: TrainingSetLog[];
  plannedWorkingSetCount: number;
  plannedReps: number;
  baselineSet?: TrainingSetLog;
  baselineLoadKg?: number;
}

const analyzeExerciseForRecord = (
  session: TrainingSession,
  exercise: ExercisePrescription,
): PostWorkoutAnalysis | null => {
  const identity = getExerciseIdentityFromExercise(exercise, exercise.id);
  const exerciseId = identity.recordExerciseId;
  if (!exerciseId) return null;
  const sets = Array.isArray(exercise.sets) ? exercise.sets : [];
  const workingSets = sets.filter(isMainWorkingSet);
  const completedWorkingSets = workingSets.filter(isUsableCompletedWorkingSet);
  if (!completedWorkingSets.length) return null;
  const incompleteWorkingSets = workingSets.filter((set) => isMainWorkingSet(set) && isIncompleteSet(set));
  const plannedWorkingSetCount = Math.max(
    typeof exercise.sets === 'number' ? numberish(exercise.sets) : 0,
    workingSets.length,
    completedWorkingSets.length,
  );
  const baselineSet = topCompletedSet(completedWorkingSets);
  const baselineLoadKg = baselineSet ? setWeightKg(baselineSet) : undefined;
  const plannedReps = numberish(exercise.repMax) || numberish(exercise.repMin) || numberish(completedWorkingSets[0]?.reps);
  return {
    exercise,
    exerciseId,
    exerciseName: exerciseDisplayName(exercise, exerciseId),
    workingSets,
    completedWorkingSets,
    incompleteWorkingSets,
    plannedWorkingSetCount,
    plannedReps,
    baselineSet,
    baselineLoadKg,
  };
};

const resolveActionableLoadKg = (
  analysis: PostWorkoutAnalysis,
  rawLoadKg: number | undefined,
  unitSettings: Partial<UnitSettings> | undefined,
): number | undefined => {
  if (!rawLoadKg || rawLoadKg <= 0) return undefined;
  const result = resolveActionableLoadContract({
    exerciseName: analysis.exerciseName || analysis.exerciseId,
    rawTheoreticalLoadKg: rawLoadKg,
    plannedReps: analysis.plannedReps,
    setPurpose: 'working',
    unitSettings,
    showTheoreticalDetail: true,
  });
  return result.actionableLoadKg;
};

const buildPostWorkoutItemView = (
  session: TrainingSession,
  analysis: PostWorkoutAnalysis,
  unitSettings: Partial<UnitSettings> | undefined,
): PostWorkoutItemView => {
  const { completedWorkingSets, plannedReps } = analysis;
  const incrementKg = configuredIncrementKg(unitSettings);
  const reps = completedWorkingSets.map((s) => numberish(s.reps));
  const averageReps = reps.reduce((sum, r) => sum + r, 0) / Math.max(1, reps.length);
  const beatPlanByTwoCount = reps.filter((r) => plannedReps > 0 && r >= plannedReps + 2).length;
  const smallMiss = reps.some((r) => plannedReps > 0 && r === plannedReps - 1);
  const clearMiss = reps.some((r) => plannedReps > 0 && r <= plannedReps - 2) || (plannedReps > 0 && averageReps <= plannedReps - 1.5);
  const matchedPlan = reps.every((r) => plannedReps > 0 && Math.abs(r - plannedReps) <= 1);
  const allPlannedCompleted = analysis.plannedWorkingSetCount > 0 && completedWorkingSets.length >= analysis.plannedWorkingSetCount;
  const mostSetsBeatPlan = beatPlanByTwoCount >= Math.ceil(completedWorkingSets.length / 2);
  const hasPain = completedWorkingSets.some((s) => Boolean(s.painFlag));
  const hasPoorTechnique = completedWorkingSets.some((s) => s.techniqueQuality === 'poor');
  const nearFailureCount = completedWorkingSets.filter((s) => {
    const rir = parseRir(s.rir);
    return rir !== undefined && rir <= 0;
  }).length;
  const incompleteMainWork = Boolean(
    session.earlyEndReason === 'incomplete_main_work' ||
      analysis.incompleteWorkingSets.length ||
      analysis.exercise.completionStatus === 'partial' ||
      analysis.exercise.incompleteReason === 'ended_early',
  );

  const id = `post-workout-next-time:${session.id}:${analysis.exerciseId}`;
  const base = { id, exerciseId: analysis.exerciseId, exerciseName: analysis.exerciseName };

  if (hasPain)
    return {
      ...base,
      recommendationKind: 'pain_review',
      confidence: 'high',
      reasonCodes: ['pain_flag'],
      riskFlags: ['pain'],
      blockedReasons: [],
      userMessage: '有不适，先复查。',
    };

  if (hasPoorTechnique)
    return {
      ...base,
      recommendationKind: 'technique_review',
      confidence: 'medium',
      reasonCodes: ['poor_technique'],
      riskFlags: ['technique_breakdown'],
      blockedReasons: [],
      userMessage: '动作质量不足，先稳住。',
    };

  if (nearFailureCount >= 2)
    return {
      ...base,
      recommendationKind: 'repeat_next_time',
      actionableLoadKg: resolveActionableLoadKg(analysis, analysis.baselineLoadKg, unitSettings),
      plannedReps,
      confidence: 'medium',
      reasonCodes: ['near_failure'],
      riskFlags: ['near_failure'],
      blockedReasons: [],
      userMessage: '接近力竭，下次不加重。',
    };

  if (incompleteMainWork)
    return {
      ...base,
      recommendationKind: 'repeat_next_time',
      actionableLoadKg: resolveActionableLoadKg(analysis, analysis.baselineLoadKg, unitSettings),
      plannedReps,
      confidence: 'medium',
      reasonCodes: ['ended_early', 'incomplete_main_work'],
      riskFlags: [],
      blockedReasons: [],
      userMessage: '本次未完成，下次先补齐。',
    };

  if (allPlannedCompleted && mostSetsBeatPlan)
    return {
      ...base,
      recommendationKind: 'increase_load',
      actionableLoadKg: resolveActionableLoadKg(analysis, (analysis.baselineLoadKg || 0) + incrementKg, unitSettings),
      plannedReps,
      confidence: 'high',
      reasonCodes: ['strong_completion'],
      riskFlags: [],
      blockedReasons: [],
      userMessage: '完成稳定，下次小幅加重。',
    };

  if (clearMiss) {
    const rawLoadKg = analysis.baselineLoadKg !== undefined ? Math.max(0, analysis.baselineLoadKg - incrementKg) : undefined;
    return {
      ...base,
      recommendationKind: rawLoadKg ? 'decrease_load' : 'reduce_reps',
      actionableLoadKg: resolveActionableLoadKg(analysis, rawLoadKg, unitSettings),
      plannedReps: rawLoadKg ? plannedReps : Math.max(1, plannedReps - 1),
      confidence: 'medium',
      reasonCodes: ['clear_underperformance'],
      riskFlags: [],
      blockedReasons: rawLoadKg ? [] : ['missing_load_baseline'],
      userMessage: '完成不足，下次保守。',
    };
  }

  if (smallMiss)
    return {
      ...base,
      recommendationKind: 'repeat_next_time',
      actionableLoadKg: resolveActionableLoadKg(analysis, analysis.baselineLoadKg, unitSettings),
      plannedReps,
      confidence: 'medium',
      reasonCodes: ['small_underperformance'],
      riskFlags: [],
      blockedReasons: [],
      userMessage: '完成不足，下次保守。',
    };

  if (matchedPlan)
    return {
      ...base,
      recommendationKind: 'keep_load',
      actionableLoadKg: resolveActionableLoadKg(analysis, analysis.baselineLoadKg, unitSettings),
      plannedReps,
      confidence: 'high',
      reasonCodes: ['matched_plan'],
      riskFlags: [],
      blockedReasons: [],
      userMessage: '完成稳定，下次保持。',
    };

  return {
    ...base,
    recommendationKind: 'no_change',
    actionableLoadKg: resolveActionableLoadKg(analysis, analysis.baselineLoadKg, unitSettings),
    plannedReps,
    confidence: 'low',
    reasonCodes: ['insufficient_pattern'],
    riskFlags: [],
    blockedReasons: ['insufficient_pattern'],
    userMessage: '暂无足够记录。',
  };
};

const summaryForRecord = (items: PostWorkoutItemView[], intent: SessionIntent): string => {
  if (intent === 'reentry-productive') return '下次建议：保守加重';
  if (intent === 'controlled-reload') return '下次建议：保持重量';
  if (intent === 'severe-rest') return '下次建议：先恢复';
  if (!items.length) return '暂无足够记录。';
  if (items.some((i) => i.recommendationKind === 'pain_review')) return '下次建议：先复查。';
  if (items.some((i) => i.recommendationKind === 'technique_review')) return '下次建议：先稳住。';
  if (items.some((i) => i.recommendationKind === 'increase_load')) return '下次建议：小幅推进。';
  return '下次建议已生成。';
};

const buildRecordUserFacing = (
  intent: SessionIntent,
  riskBadge: RiskBadge | undefined,
  oneLineAdvice: string,
  session: TrainingSession | undefined,
  unitSettings: Partial<UnitSettings> | undefined,
): RecordUserFacing => {
  let perExercise: PostWorkoutItemView[] = [];
  if (session && !EXCLUDED_SESSION_FLAGS.has(String(session.dataFlag || 'normal'))) {
    perExercise = (session.exercises || [])
      .map((ex) => analyzeExerciseForRecord(session, ex))
      .filter((a): a is PostWorkoutAnalysis => Boolean(a))
      .map((a) => buildPostWorkoutItemView(session, a, unitSettings));
  }
  const summary = summaryForRecord(perExercise, intent);
  return {
    surfaceId: 'record',
    headline: summary.length <= 60 ? summary : intentLabel(intent),
    oneLineAdvice,
    riskBadge,
    nextTimeHint: summary,
    perExercise,
  };
};

// =============================================================================
//   Section 5 — Today surface (inlined todayDecisionSurface)
// =============================================================================

interface TodaySource {
  recommendedFocus?: string;
  selectedFocusOverride?: string;
  activeSessionState?: 'none' | 'active' | 'unfinished' | 'completed';
  hasUnfinishedSession?: boolean;
  hasCompletedSession?: boolean;
  readinessState?: string;
  fatigueState?: string;
  severeDataHealthBlocker?: boolean | { title?: string; message?: string };
  sourceOfTruthClear?: boolean;
  canStartTraining?: boolean;
  canContinueTraining?: boolean;
  canRecoverTraining?: boolean;
  noPlanAvailable?: boolean;
  existingPrimaryActionLabel?: string;
}

const severeNoticeFrom = (notice?: boolean | { title?: string; message?: string }): TodaySevereNotice | undefined => {
  if (!notice) return undefined;
  if (typeof notice === 'boolean') {
    return {
      title: '发现严重数据风险',
      message: '先查看严重问题，再决定是否继续训练。',
    };
  }
  return {
    title: cleanWS(notice.title) || '发现严重数据风险',
    message: cleanWS(notice.message) || '先查看严重问题，再决定是否继续训练。',
  };
};

const conservativeReadiness = (readinessState?: string, fatigueState?: string) =>
  readinessState === 'conservative' ||
  readinessState === 'low' ||
  readinessState === 'red' ||
  readinessState === 'yellow' ||
  fatigueState === 'elevated' ||
  fatigueState === 'high';

const recoveryReadiness = (readinessState?: string) =>
  readinessState === 'recovery' ||
  readinessState === 'rest' ||
  readinessState === 'active_recovery' ||
  readinessState === 'mobility_only';

const decisionStateLabelFor = (state: TodayDecisionState): string => {
  switch (state) {
    case 'train_recommended':
      return '今天建议训练';
    case 'train_conservative':
      return '今天保守训练';
    case 'recovery_recommended':
      return '今天建议恢复';
    case 'continue_unfinished':
      return '继续未完成训练';
    case 'blocked_by_severe_risk':
      return '需先处理风险';
    case 'source_unclear':
      return '数据来源待确认';
    case 'no_plan_available':
      return '缺少训练安排';
  }
};

const buildTodayUserFacing = (
  intent: SessionIntent,
  phase: EffectiveTrainingPhase,
  riskBadge: RiskBadge | undefined,
  oneLineAdvice: string,
  source: TodaySource,
): TodayUserFacing => {
  const focusLabel = cleanWS(source.recommendedFocus) || '暂无训练安排';
  const safetyLabel = source.sourceOfTruthClear === false ? '数据来源待确认' : '当前使用本地数据';
  const compactPhase = phaseLabel(phase.activePhase);

  const make = (
    decisionState: TodayDecisionState,
    fields: Partial<TodayUserFacing>,
  ): TodayUserFacing => ({
    surfaceId: 'today',
    headline: fields.heroTitle && fields.heroTitle.length <= 60 ? fields.heroTitle : intentLabel(intent),
    oneLineAdvice,
    riskBadge,
    micro: { phaseLabel: compactPhase },
    decisionState,
    heroLabel: '今日结论',
    heroTitle: fields.heroTitle ?? '',
    heroExplanation: fields.heroExplanation ?? '',
    decisionStateLabel: decisionStateLabelFor(decisionState),
    readinessLabel: fields.readinessLabel ?? '状态正常',
    focusLabel,
    safetyLabel,
    primaryActionLabel: fields.primaryActionLabel,
    secondaryActionLabel: fields.secondaryActionLabel,
    severeNotice: fields.severeNotice,
    showFocusOverride: fields.showFocusOverride ?? false,
    showDataHealthSummary: fields.showDataHealthSummary ?? false,
  });

  if (source.sourceOfTruthClear === false) {
    return make('source_unclear', {
      heroTitle: '先确认本地数据来源',
      heroExplanation: '先回到清晰的本地数据状态。',
      primaryActionLabel: '回到本地模式',
      readinessLabel: '数据来源待确认',
    });
  }

  const severeNotice = severeNoticeFrom(source.severeDataHealthBlocker);
  if (severeNotice) {
    return make('blocked_by_severe_risk', {
      heroTitle: '先处理严重风险',
      heroExplanation: '先查看严重问题，再决定是否训练。',
      primaryActionLabel: '查看严重问题',
      secondaryActionLabel: source.canContinueTraining ? '继续训练' : undefined,
      readinessLabel: '存在严重风险',
      severeNotice,
      showDataHealthSummary: true,
    });
  }

  if (source.hasUnfinishedSession || source.activeSessionState === 'active' || source.activeSessionState === 'unfinished') {
    return make('continue_unfinished', {
      heroTitle: `继续 ${focusLabel}`,
      heroExplanation: '当前有未完成训练，先继续记录。',
      primaryActionLabel: '继续训练',
      secondaryActionLabel: source.canStartTraining ? '查看今日建议' : undefined,
      readinessLabel: '训练进行中',
    });
  }

  if (source.noPlanAvailable || !cleanWS(source.recommendedFocus)) {
    return make('no_plan_available', {
      heroTitle: '暂无可执行训练安排',
      heroExplanation: '先检查训练计划，再开始训练。',
      primaryActionLabel: '查看计划',
      readinessLabel: '缺少训练安排',
    });
  }

  if (source.hasCompletedSession || source.activeSessionState === 'completed') {
    return make('recovery_recommended', {
      heroTitle: '今日训练已完成',
      heroExplanation: '今天已完成训练，下次建议仅供参考。',
      primaryActionLabel: source.existingPrimaryActionLabel || '查看本次训练',
      secondaryActionLabel: '再练一场',
      readinessLabel: '建议恢复',
    });
  }

  if (recoveryReadiness(source.readinessState)) {
    return make('recovery_recommended', {
      heroTitle: `今天建议 ${focusLabel}`,
      heroExplanation: '恢复优先，不强制训练。',
      primaryActionLabel: source.existingPrimaryActionLabel || (source.canRecoverTraining ? '开始恢复训练' : '查看恢复建议'),
      secondaryActionLabel: source.canStartTraining ? '仍要训练' : undefined,
      readinessLabel: '建议恢复',
      showFocusOverride: true,
    });
  }

  if (conservativeReadiness(source.readinessState, source.fatigueState)) {
    return make('train_conservative', {
      heroTitle: `保守训练：${focusLabel}`,
      heroExplanation: '建议保守训练，保持重量。',
      primaryActionLabel: source.existingPrimaryActionLabel || '开始训练',
      secondaryActionLabel: '查看动作安排',
      readinessLabel: '建议保守',
      showFocusOverride: true,
    });
  }

  return make('train_recommended', {
    heroTitle: `今天建议：${focusLabel}`,
    heroExplanation: '',
    primaryActionLabel:
      source.existingPrimaryActionLabel === '开始训练' ? '开始今天训练' : source.existingPrimaryActionLabel || '开始今天训练',
    secondaryActionLabel: '查看动作安排',
    readinessLabel: '状态正常',
    showFocusOverride: true,
  });
};

// =============================================================================
//   Section 6 — Explanation / training / focus surfaces
//     (inlined recommendationTraceEngine + recommendationExplanationPresenter)
// =============================================================================

const sourceLabels: Record<RecommendationFactorSource, string> = {
  primaryGoal: '主目标',
  trainingMode: '训练侧重',
  trainingLevel: '训练基线',
  readiness: '准备度',
  history: '近期记录',
  muscleVolume: '肌群训练量',
  loadFeedback: '重量反馈',
  techniqueQuality: '动作质量',
  soreness: '酸痛状态',
  recoveryConflict: '恢复提醒',
  painPattern: '不适记录',
  screeningRestriction: '限制提醒',
  healthData: '健康数据',
  template: '计划模板',
  defaultPolicy: '默认规则',
};

const effectLabels: Record<RecommendationFactorEffect, string> = {
  increase: '提高建议',
  decrease: '保守建议',
  maintain: '维持建议',
  block: '暂不启用',
  informational: '信息参考',
};

const effectTones: Record<RecommendationFactorEffect, RecommendationFactorTone> = {
  increase: 'positive',
  decrease: 'warning',
  maintain: 'neutral',
  block: 'negative',
  informational: 'neutral',
};

const buildExplanationUserFacing = (
  intent: SessionIntent,
  phase: EffectiveTrainingPhase,
  riskBadge: RiskBadge | undefined,
  oneLineAdvice: string,
  arbitrationTrace: string[],
  weeklyBlockReasons: string[],
): ExplanationUserFacing => {
  const primary: RecommendationFactorView[] = [];
  const secondary: RecommendationFactorView[] = [];
  const warnings: RecommendationWarningView[] = [];
  const compactPhase = phaseLabel(phase.activePhase);

  const phaseFactor: RecommendationFactorView = {
    id: 'training-phase',
    label: '训练阶段',
    effectLabel: effectLabels[intent === 'normal-session' ? 'maintain' : 'decrease'],
    effectTone: effectTones[intent === 'normal-session' ? 'maintain' : 'decrease'],
    reason: `${compactPhase} · ${intentLabel(intent)}。`,
    priority: 500,
    source: 'defaultPolicy',
    effect: intent === 'normal-session' ? 'maintain' : 'decrease',
  };
  primary.push(phaseFactor);

  if (riskBadge) {
    primary.push({
      id: 'risk-badge',
      label: '风险等级',
      effectLabel: effectLabels.decrease,
      effectTone: 'warning',
      reason: `当前风险 ${riskBadge.label}：${riskBadge.rationaleCode}。`,
      priority: 400,
      source: 'readiness',
      effect: 'decrease',
    });
  }

  arbitrationTrace.forEach((trace, index) => {
    secondary.push({
      id: `arbitration-${index}-${trace}`,
      label: '推荐推理',
      effectLabel: effectLabels.informational,
      effectTone: 'neutral',
      reason: trace,
      priority: 100 - index,
      source: 'defaultPolicy',
      effect: 'informational',
    });
  });

  weeklyBlockReasons.forEach((reason, index) => {
    warnings.push({
      id: `weekly-block-${index}`,
      title: '本周节奏受限',
      message: reason,
    });
  });

  const summary =
    intent === 'normal-session'
      ? `${compactPhase}，按计划推进，记录数据即可。`
      : `${compactPhase}，${intentLabel(intent)}。`;

  return {
    surfaceId: 'explanation',
    headline: '推荐说明',
    oneLineAdvice: `阶段：${compactPhase}；方向：${intentLabel(intent)}。`,
    riskBadge,
    title: '为什么这样推荐？',
    summary,
    primaryFactors: primary,
    secondaryFactors: secondary,
    warnings,
  };
};

const buildTrainingUserFacing = (
  intent: SessionIntent,
  phase: EffectiveTrainingPhase,
  riskBadge: RiskBadge | undefined,
  oneLineAdvice: string,
  explanation: ExplanationUserFacing,
): TrainingUserFacing => ({
  surfaceId: 'training',
  headline: intentLabel(intent),
  oneLineAdvice,
  riskBadge,
  micro: { phaseLabel: phaseLabel(phase.activePhase) },
  explanationTitle: explanation.title,
  explanationSummary: explanation.summary,
  explanationFactors: explanation.primaryFactors,
});

const buildFocusUserFacing = (
  intent: SessionIntent,
  phase: EffectiveTrainingPhase,
  riskBadge: RiskBadge | undefined,
  oneLineAdvice: string,
  explanation: ExplanationUserFacing,
): FocusUserFacing => ({
  surfaceId: 'focus',
  headline: intentLabel(intent),
  oneLineAdvice,
  riskBadge,
  micro: { phaseLabel: phaseLabel(phase.activePhase) },
  explanationTitle: explanation.title,
  explanationSummary: explanation.summary,
  explanationFactors: explanation.primaryFactors,
});

// =============================================================================
//   Section 7 — Optional input adapters for each surface payload
// =============================================================================

export interface TrainingDecisionSurfaceInputs {
  progress?: ProgressCopySource;
  plan?: WeeklyProgressionSource & { weekId?: string };
  record?: { session?: TrainingSession; unitSettings?: Partial<UnitSettings> };
  today?: TodaySource;
}

// =============================================================================
//   Section 8 — Main entry: buildTrainingDecision
// =============================================================================

export const buildTrainingDecision = (
  input: TrainingDecisionInput,
  surfaces: TrainingDecisionSurfaceInputs = {},
): TrainingDecision => {
  const history = input.history || [];
  const nowIso = input.nowIso || new Date().toISOString();
  const trainingMode = input.trainingMode || 'hybrid';

  const effectivePhase = getEffectiveTrainingPhase({
    mesocyclePlan: input.mesocyclePlan,
    history,
    referenceDate: nowIso.slice(0, 10),
  });

  const lapse = history.length > 0 ? buildTrainingLapseSignal(history, nowIso) : null;

  const painAreas = collectPainAreasFromHistory(history);
  // Build the readiness via top-level helper; we still use the input shape below for clarity.
  void mapTodayStatusToReadinessInput(input.todayStatus, input.template, painAreas);
  const readiness = buildTodayReadiness(
    { todayStatus: input.todayStatus, history },
    input.template,
    {
      healthSummary: input.healthSummary,
      useHealthDataForReadiness: input.useHealthDataForReadiness,
    },
  );

  const deload = buildAdaptiveDeloadDecision(
    {
      history,
      todayStatus: input.todayStatus,
      screeningProfile: input.screening,
      templates: [input.template],
      selectedTemplateId: input.template.id,
      trainingMode: typeof trainingMode === 'string' ? (trainingMode as never) : trainingMode,
    },
    { nowIso },
  );

  const arbitrationTrace: string[] = [];

  const severeFlag = Boolean(input.acutePainReported || input.injuryFlag || input.illnessFlag);
  if (severeFlag) arbitrationTrace.push('AR-1-severe-override');

  const e1rmTrendUp = isE1rmTrendUp(history);
  const recoveryHigh = readiness.level === 'low';

  const intent = sessionIntentFor(
    effectivePhase,
    severeFlag,
    Boolean(input.explicitDeloadAssigned),
    e1rmTrendUp,
    recoveryHigh,
  );
  if (intent === 'reentry-productive') arbitrationTrace.push('AR-2-reentry-override');
  if (intent === 'controlled-reload') arbitrationTrace.push('AR-5-controlled-reload');

  const { multiplier: finalVolumeMultiplier, clampReasons } = clampMultiplier(
    effectivePhase,
    deload,
    severeFlag,
  );
  arbitrationTrace.push(...clampReasons);

  const exerciseRoleFloors: Record<ExerciseRole, number> =
    intent === 'reentry-productive' ? { ...ROLE_FLOORS_REENTRY } : { ...ROLE_FLOORS_NORMAL };
  if (intent === 'reentry-productive') arbitrationTrace.push('AR-3-productive-floor');

  const kindFloors: Partial<Record<'compound' | 'machine' | 'isolation', number>> = {
    compound: Math.max(exerciseRoleFloors['main-compound'], exerciseRoleFloors['secondary-compound']),
    machine: exerciseRoleFloors.accessory,
    isolation: exerciseRoleFloors.isolation,
  };

  const adjusted = applyStatusRules(
    input.template,
    input.todayStatus,
    typeof trainingMode === 'string' ? trainingMode : 'hybrid',
    null,
    history,
    input.screening,
    input.mesocyclePlan ?? undefined,
    {
      healthSummary: input.healthSummary,
      useHealthDataForReadiness: input.useHealthDataForReadiness,
      adaptiveCalibration: input.adaptiveCalibration,
      nowIso,
      externalVolumeMultiplier: finalVolumeMultiplier,
      externalExerciseRoleFloors: kindFloors,
      suppressInternalDeloadStrategy: true,
    },
  );

  const exercisePrescriptions: ExercisePrescription[] = adjusted.exercises;

  const workingSetTargets: WorkingSetTarget[] = exercisePrescriptions.map((ex) => {
    const role = roleOf(ex.kind, ex.name);
    const sets = typeof ex.sets === 'number' ? ex.sets : (ex.sets || []).length || 0;
    const repMin = Number(ex.repMin) || 8;
    const repMax = Number(ex.repMax) || repMin + 4;
    return {
      exerciseId: ex.id,
      role,
      targetSets: Math.max(sets, exerciseRoleFloors[role]),
      targetReps: [repMin, repMax],
      rationaleCode:
        intent === 'reentry-productive'
          ? `reentry-floor:${role}:${exerciseRoleFloors[role]}`
          : `phase:${effectivePhase.activePhase}:${role}`,
    };
  });

  const weeklyBlockReasons: string[] = [];
  let weeklyDirection: 'increase' | 'hold' | 'decrease' = 'hold';
  if (severeFlag || input.explicitDeloadAssigned) {
    weeklyDirection = 'decrease';
  } else if (intent === 'reentry-productive' || intent === 'controlled-reload' || intent === 'deload-week') {
    weeklyDirection = 'hold';
    weeklyBlockReasons.push('reentry-or-reload-no-additional-cut');
    arbitrationTrace.push('AR-4-weekly-blocked-by-phase');
  } else if (e1rmTrendUp) {
    weeklyDirection = 'increase';
  }

  const volumeMode = volumeModeFor(intent, finalVolumeMultiplier);
  const intensityMode = intensityModeFor(intent, readiness.trainingAdjustment);
  const progressionMode = progressionModeFor(intent, e1rmTrendUp);
  const riskLevel = riskLevelFor(severeFlag, readiness.level, painAreas.length);

  const riskBadge: RiskBadge | undefined =
    riskLevel === 'severe' || riskLevel === 'high'
      ? { level: riskLevel, label: '需注意', rationaleCode: `risk:${riskLevel}` }
      : undefined;

  const progressClarityTripletSuppressed = intent !== 'normal-session';
  if (progressClarityTripletSuppressed) arbitrationTrace.push('AR-5-progress-clarity-suppressed');

  // Build advice string used across surfaces
  const oneLineAdvice =
    intent === 'reentry-productive'
      ? '主动作至少 2 组，先把状态拉回来。'
      : intent === 'controlled-reload'
        ? '维持负荷，重点休息，下一周再加。'
        : intent === 'severe-rest'
          ? '先处理身体信号，下次再训。'
          : intent === 'deload-week'
            ? '主动收量，把睡眠和精力补满。'
            : '按计划推进，记录数据即可。';

  const explanation = buildExplanationUserFacing(
    intent,
    effectivePhase,
    riskBadge,
    oneLineAdvice,
    arbitrationTrace,
    weeklyBlockReasons,
  );

  const userFacing: UserFacingMap = {
    today: buildTodayUserFacing(intent, effectivePhase, riskBadge, oneLineAdvice, surfaces.today ?? {}),
    plan: buildPlanUserFacing(
      intent,
      effectivePhase,
      riskBadge,
      oneLineAdvice,
      surfaces.plan ?? {},
      surfaces.plan?.weekId || nowIso.slice(0, 10),
      weeklyDirection,
      weeklyBlockReasons.length > 0,
    ),
    training: buildTrainingUserFacing(intent, effectivePhase, riskBadge, oneLineAdvice, explanation),
    focus: buildFocusUserFacing(intent, effectivePhase, riskBadge, oneLineAdvice, explanation),
    progress: buildProgressUserFacing(intent, effectivePhase, riskBadge, oneLineAdvice, surfaces.progress ?? {}),
    record: buildRecordUserFacing(
      intent,
      riskBadge,
      oneLineAdvice,
      surfaces.record?.session,
      surfaces.record?.unitSettings,
    ),
    explanation,
  };

  const hidden: HiddenDebugSignals = {
    effectivePhase,
    lapse,
    readiness,
    deloadDecision: deload,
    arbitrationTrace,
    finalVolumeMultiplier,
    exerciseRoleFloors,
    weeklyBlockReasons,
    progressClarityTripletSuppressed,
  };

  return {
    activePhase: effectivePhase.activePhase,
    trainingMode,
    sessionIntent: intent,
    riskLevel,
    progressionMode,
    volumeMode,
    intensityMode,
    exercisePrescriptions,
    workingSetTargets,
    muscleGroupVolumeTargets: [],
    weeklyAdjustment: {
      direction: weeklyDirection,
      magnitudePct: weeklyDirection === 'hold' ? 0 : 5,
      appliesFromIsoDate: nowIso.slice(0, 10),
      blockedBy:
        weeklyBlockReasons.length > 0
          ? (intent === 'reentry-productive' ? 'reentry-floor' : 'severe-signal-required')
          : null,
    },
    nextSetPolicy: {
      enabled: intent !== 'severe-rest',
      stopCriteria: 'rir-0',
    },
    userFacing,
    hiddenDebugSignals: hidden,
    computedAtIso: nowIso,
    decisionVersion: 'v2',
  };
};
