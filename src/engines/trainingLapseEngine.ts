import type {
  AdaptiveCalibrationState,
  ExercisePrescription,
  MesocyclePlan,
  RecommendationRecord,
  TrainingLevel,
  TrainingSession,
  TrainingSetLog,
  UserProfile,
} from '../models/training-model';
import { getCurrentMesocycleWeek } from './mesocycleEngine';
import type { HealthSummary } from './healthSummaryEngine';

export type LapseStage = 'fresh' | 'normal' | 'lapsed' | 'long_lapsed' | 'dormant';
export type LapseConfidence = 'low' | 'medium' | 'high';
export type LapseRotationHint = 'continue_rotation' | 'restart_push' | 'recovery_first' | 'unchanged';

export interface LapseThresholds {
  fresh: number;
  normal: number;
  lapsed: number;
  long_lapsed: number;
}

export interface PerMuscleRetention {
  muscle: string;
  retention: number;
  halfLifeDays: number;
}

export interface LapseReasonsByCategory {
  strength: string[];
  aerobic: string[];
  calibration: string[];
  rotation: string[];
  mesocycle: string[];
}

export interface TrainingLapseSignal {
  // ── 保持向后兼容的字段 ─────────────────────────────
  stage: LapseStage;
  daysSinceLastSession: number;
  lastSessionDate?: string;
  hasHistory: boolean;
  decayMultiplier: number;
  resetFatigue: boolean;
  resetRotation: boolean;
  resetCalibrationBias: boolean;
  reasons: string[];
  advice: string;

  // ── 精细化新增字段 ───────────────────────────────────
  personalGapDays: number;
  personalizedThresholds: LapseThresholds;
  smoothDecay: number;
  strengthRetention: number;
  aerobicRetention: number;
  suggestedStartingLoadFactor: number;
  perMuscleRetention: PerMuscleRetention[];
  rotationHint: LapseRotationHint;
  lastTemplateId?: string;
  lastMuscleEmphasis?: string;
  plannedDeload: boolean;
  preBreakOutcomeProfile: 'mostly_on_target' | 'mixed' | 'mostly_struggling' | 'no_data';
  confidence: LapseConfidence;
  reasonsByCategory: LapseReasonsByCategory;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const BASELINE_THRESHOLDS: LapseThresholds = {
  fresh: 4,
  normal: 10,
  lapsed: 21,
  long_lapsed: 45,
};

const STRENGTH_HALF_LIFE_DAYS_BY_LEVEL: Record<TrainingLevel, number> = {
  beginner: 14,
  intermediate: 28,
  advanced: 42,
};

const MUSCLE_HALF_LIFE_DAYS: Record<string, number> = {
  腿: 35,
  背: 32,
  胸: 28,
  肩: 22,
  手臂: 21,
  核心: 18,
};

const DEFAULT_MUSCLE_HALF_LIFE = 24;

const safeDate = (value?: string) => {
  if (!value) return null;
  const direct = value.match(/^\d{4}-\d{2}-\d{2}/);
  const iso = direct ? `${direct[0]}T12:00:00.000Z` : value;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
};

const sessionTimestamp = (session: TrainingSession) =>
  safeDate(session.finishedAt) ?? safeDate(session.startedAt) ?? safeDate(session.date);

const isAnalyticsSession = (session: TrainingSession) =>
  session.completed !== false && session.dataFlag !== 'test' && session.dataFlag !== 'excluded';

const latestAnalyticsSession = (history: TrainingSession[] = []): TrainingSession | null => {
  let candidate: { session: TrainingSession; timestamp: number } | null = null;
  for (const session of history) {
    if (!isAnalyticsSession(session)) continue;
    const ts = sessionTimestamp(session);
    if (ts === null) continue;
    if (!candidate || ts > candidate.timestamp) candidate = { session, timestamp: ts };
  }
  return candidate?.session ?? null;
};

const computeBaselineFrequencyPerWeek = (
  history: TrainingSession[],
  nowMs: number,
  fallback: number,
): { frequency: number; weeksObserved: number } => {
  const lookbackDays = 56; // ~ 8 周
  const cutoff = nowMs - lookbackDays * MS_PER_DAY;
  const weekKeys = new Map<string, number>();
  for (const session of history) {
    if (!isAnalyticsSession(session)) continue;
    const ts = sessionTimestamp(session);
    if (ts === null || ts < cutoff || ts > nowMs) continue;
    const date = new Date(ts);
    const dayMs = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
    // ISO week start Monday
    const dow = new Date(dayMs).getUTCDay();
    const mondayOffset = (dow - 1 + 7) % 7;
    const weekStart = dayMs - mondayOffset * MS_PER_DAY;
    const key = String(weekStart);
    weekKeys.set(key, (weekKeys.get(key) || 0) + 1);
  }
  if (weekKeys.size === 0) {
    return { frequency: Math.max(1, fallback), weeksObserved: 0 };
  }
  const observedWeeks = weekKeys.size;
  const totalSessions = Array.from(weekKeys.values()).reduce((sum, n) => sum + n, 0);
  // Normalize against the full lookback span so brief active streaks don't
  // overstate cadence.
  const fullWindow = Math.min(8, lookbackDays / 7);
  const frequency = totalSessions / fullWindow;
  return { frequency: Math.max(1, frequency), weeksObserved: observedWeeks };
};

const buildPersonalizedThresholds = (
  personalGapDays: number,
  trainingLevel: TrainingLevel | undefined,
): LapseThresholds => {
  // baseline thresholds reflect a user training ~3x / week (gap ~2.3 d).
  const referenceGapDays = 7 / 3;
  let scale = personalGapDays / referenceGapDays;
  // dampen the scale so a 6x/week user does not immediately hit lapsed at
  // 4 days, and so a 1x/week user does not delay dormant for half a year.
  scale = Math.pow(scale, 0.6);
  // advanced trainees tolerate slightly longer gaps without losing strength.
  if (trainingLevel === 'advanced') scale *= 1.15;
  if (trainingLevel === 'beginner') scale *= 0.9;
  scale = Math.min(2, Math.max(0.6, scale));
  return {
    fresh: Math.max(2, Math.round(BASELINE_THRESHOLDS.fresh * scale)),
    normal: Math.max(5, Math.round(BASELINE_THRESHOLDS.normal * scale)),
    lapsed: Math.max(12, Math.round(BASELINE_THRESHOLDS.lapsed * scale)),
    long_lapsed: Math.max(25, Math.round(BASELINE_THRESHOLDS.long_lapsed * scale)),
  };
};

const classifyStage = (days: number, thresholds: LapseThresholds): LapseStage => {
  if (days < thresholds.fresh) return 'fresh';
  if (days < thresholds.normal) return 'normal';
  if (days < thresholds.lapsed) return 'lapsed';
  if (days < thresholds.long_lapsed) return 'long_lapsed';
  return 'dormant';
};

const computeSmoothDecay = (days: number, thresholds: LapseThresholds): number => {
  if (days <= thresholds.normal) return 1;
  if (days >= thresholds.long_lapsed) return 0;
  const span = thresholds.long_lapsed - thresholds.normal;
  const t = Math.min(1, Math.max(0, (days - thresholds.normal) / span));
  return Number((0.5 * (1 + Math.cos(Math.PI * t))).toFixed(3));
};

const computeStrengthRetention = (days: number, level: TrainingLevel | undefined): number => {
  const halfLife = STRENGTH_HALF_LIFE_DAYS_BY_LEVEL[(level || 'intermediate') as TrainingLevel] ?? 28;
  if (days <= 0) return 1;
  const retention = Math.pow(0.5, days / halfLife);
  return Number(retention.toFixed(3));
};

const computeAerobicRetention = (days: number, health: HealthSummary | undefined): number => {
  if (days <= 0) return 1;
  // Aerobic decays faster than strength; baseline half-life ~14 days.
  let halfLife = 14;
  if (health) {
    if ((health.recentHighActivityDays ?? 0) >= 3) halfLife = 38;
    else if ((health.recentWorkoutCount ?? 0) >= 2) halfLife = 28;
    else if ((health.recentWorkoutCount ?? 0) >= 1) halfLife = 21;
  }
  return Number(Math.pow(0.5, days / halfLife).toFixed(3));
};

const computeStartingLoadFactor = (
  strengthRetention: number,
  smoothDecay: number,
  preBreakOutcome: TrainingLapseSignal['preBreakOutcomeProfile'],
  level: TrainingLevel | undefined,
): number => {
  // Even after long gaps, neuromuscular relearn is fast; load factor stays
  // above retention floor. We blend retention with smoothDecay so the user
  // never gets a brutal cut for short breaks.
  let factor = 0.5 * strengthRetention + 0.5 * smoothDecay;
  if (preBreakOutcome === 'mostly_struggling') factor *= 0.93;
  if (preBreakOutcome === 'mostly_on_target') factor *= 1.0;
  if (level === 'beginner') factor *= 0.9;
  factor = Math.min(1, Math.max(0.55, factor));
  return Number(factor.toFixed(3));
};

const exerciseMusclesWithWeights = (
  exercise: ExercisePrescription | { muscle?: string; primaryMuscles?: string[]; muscleContribution?: Record<string, number> },
): Array<[string, number]> => {
  const contribution = (exercise as { muscleContribution?: Record<string, number> }).muscleContribution;
  if (contribution && Object.keys(contribution).length) {
    const allocations: Array<[string, number]> = [];
    Object.entries(contribution).forEach(([muscle, weight]) => {
      if (muscle && Number(weight) > 0) allocations.push([muscle, Number(weight)]);
    });
    if (allocations.length) return allocations;
  }
  const primary = (exercise as { primaryMuscles?: string[] }).primaryMuscles || [];
  const main = (exercise as { muscle?: string }).muscle;
  const seen = new Set<string>();
  const allocations: Array<[string, number]> = [];
  if (main) {
    seen.add(main);
    allocations.push([main, 1]);
  }
  primary.forEach((muscle) => {
    if (!muscle || seen.has(muscle)) return;
    seen.add(muscle);
    allocations.push([muscle, 0.5]);
  });
  return allocations;
};

const isSetCompleted = (set: TrainingSetLog | undefined): boolean => Boolean(set && (set.done === true || set.completionStatus === 'completed' || set.completionStatus === 'legacy_completed'));

const computeLastMuscleEmphasis = (session: TrainingSession | null): { templateId?: string; muscle?: string } => {
  if (!session) return {};
  const muscleSets = new Map<string, number>();
  for (const exercise of session.exercises || []) {
    const sets = Array.isArray(exercise.sets) ? exercise.sets : [];
    const completed = sets.filter(isSetCompleted).length;
    if (!completed) continue;
    for (const [muscle, weight] of exerciseMusclesWithWeights(exercise)) {
      muscleSets.set(muscle, (muscleSets.get(muscle) || 0) + completed * weight);
    }
  }
  if (!muscleSets.size) return { templateId: session.templateId };
  const sorted = Array.from(muscleSets.entries()).sort((a, b) => b[1] - a[1]);
  return { templateId: session.templateId, muscle: sorted[0][0] };
};

const computePerMuscleRetention = (
  days: number,
  strengthRetention: number,
  history: TrainingSession[],
): PerMuscleRetention[] => {
  const candidateMuscles = new Set<string>([...Object.keys(MUSCLE_HALF_LIFE_DAYS)]);
  for (const session of history.slice(0, 12)) {
    if (!isAnalyticsSession(session)) continue;
    for (const exercise of session.exercises || []) {
      for (const [muscle] of exerciseMusclesWithWeights(exercise)) {
        if (muscle) candidateMuscles.add(muscle);
      }
    }
  }
  const result: PerMuscleRetention[] = [];
  for (const muscle of candidateMuscles) {
    const halfLife = MUSCLE_HALF_LIFE_DAYS[muscle] ?? DEFAULT_MUSCLE_HALF_LIFE;
    // Blend with global strength retention so high-level engines that bypass
    // per-muscle still see consistent decay direction.
    const raw = Math.pow(0.5, days / halfLife);
    const blended = 0.7 * raw + 0.3 * strengthRetention;
    result.push({
      muscle,
      retention: Number(blended.toFixed(3)),
      halfLifeDays: halfLife,
    });
  }
  result.sort((left, right) => right.retention - left.retention);
  return result;
};

const classifyPreBreakOutcome = (
  calibration: AdaptiveCalibrationState | null | undefined,
  lastSessionTimestamp: number,
): TrainingLapseSignal['preBreakOutcomeProfile'] => {
  const log = calibration?.recommendationLog;
  if (!log || log.length === 0) return 'no_data';
  const windowMs = 14 * MS_PER_DAY;
  const start = lastSessionTimestamp - windowMs;
  const recent: RecommendationRecord[] = [];
  for (const record of log) {
    const ts = safeDate(record.date);
    if (ts === null) continue;
    if (ts <= lastSessionTimestamp && ts >= start) recent.push(record);
  }
  if (recent.length < 3) return 'no_data';
  let struggling = 0;
  let onTarget = 0;
  for (const record of recent) {
    if (record.outcome === 'pain' || record.outcome === 'failed' || record.outcome === 'too_heavy' || record.outcome === 'technique_breakdown') struggling += 1;
    else if (record.outcome === 'on_target') onTarget += 1;
  }
  const total = recent.length;
  if (struggling / total >= 0.4) return 'mostly_struggling';
  if (onTarget / total >= 0.6) return 'mostly_on_target';
  return 'mixed';
};

const computeRotationHint = (
  lastMuscle: string | undefined,
  templateId: string | undefined,
  stage: LapseStage,
  preBreakOutcome: TrainingLapseSignal['preBreakOutcomeProfile'],
): LapseRotationHint => {
  if (stage === 'fresh' || stage === 'normal') return 'unchanged';
  if (preBreakOutcome === 'mostly_struggling') return 'recovery_first';
  if (stage === 'dormant') return 'restart_push';
  if (stage === 'long_lapsed') {
    // 腿后回归更难，先推；上半身后回归可以延续
    if (lastMuscle === '腿' || templateId === 'legs-a') return 'recovery_first';
    return 'restart_push';
  }
  // lapsed: keep rotation
  return 'continue_rotation';
};

const computeConfidence = (
  history: TrainingSession[],
  days: number,
  hasHealth: boolean,
  hasCalibration: boolean,
): LapseConfidence => {
  const analyticsCount = history.filter(isAnalyticsSession).length;
  if (analyticsCount < 3) return 'low';
  if (days > 21 && !hasHealth && !hasCalibration) return 'medium';
  if (analyticsCount >= 6 && (hasHealth || hasCalibration)) return 'high';
  return 'medium';
};

const isDeloadPhase = (mesocyclePlan: MesocyclePlan | null | undefined, nowIso: string): boolean => {
  if (!mesocyclePlan) return false;
  const referenceDate = nowIso.slice(0, 10);
  const week = getCurrentMesocycleWeek(mesocyclePlan, referenceDate);
  return week.phase === 'deload';
};

const buildAdviceForSignal = (
  stage: LapseStage,
  days: number,
  startingLoadFactor: number,
  plannedDeload: boolean,
  rotationHint: LapseRotationHint,
  preBreakOutcome: TrainingLapseSignal['preBreakOutcomeProfile'],
): string => {
  if (plannedDeload && stage !== 'dormant') {
    return '当前处于计划内减量周，距离上次训练在合理范围内，不视作中断。';
  }
  const loadHint = startingLoadFactor < 1
    ? ` 建议首次训练把重量先压到约 ${(startingLoadFactor * 100).toFixed(0)}%。`
    : '';
  const rotationCopy = rotationHint === 'recovery_first'
    ? ' 建议从恢复优先的模板（上半身/低疲劳）起步。'
    : rotationHint === 'restart_push'
      ? ' 建议从推 A 重新起步。'
      : rotationHint === 'continue_rotation'
        ? ' 训练循环可以延续上次推进的方向。'
        : '';
  const struggleCopy = preBreakOutcome === 'mostly_struggling'
    ? ' 上次中断前有疼痛或失败信号，本次复训请优先稳定动作质量。'
    : '';
  switch (stage) {
    case 'fresh':
      return '训练节奏稳定，按当前推荐推进即可。';
    case 'normal':
      return '距离上次训练在正常范围内，按当前推荐推进。';
    case 'lapsed':
      return `距离上次训练已 ${days} 天，建议本次稍微保守，疲劳记录会部分衰减。${rotationCopy}${loadHint}${struggleCopy}`.trim();
    case 'long_lapsed':
      return `距离上次训练已 ${days} 天，进入长间隔，疲劳和动作不适记录会重置。${rotationCopy}${loadHint}${struggleCopy}`.trim();
    case 'dormant':
      return `距离上次训练超过 ${days} 天，按重新开始处理：清空疲劳积分、训练循环回到推日、推荐回到中性。${loadHint}${struggleCopy}`.trim();
    default:
      return '';
  }
};

export interface LapseContext {
  userProfile?: UserProfile | null;
  healthSummary?: HealthSummary | null;
  mesocyclePlan?: MesocyclePlan | null;
  calibrationState?: AdaptiveCalibrationState | null;
}

const EMPTY_REASONS: LapseReasonsByCategory = {
  strength: [],
  aerobic: [],
  calibration: [],
  rotation: [],
  mesocycle: [],
};

export const buildTrainingLapseSignal = (
  history: TrainingSession[] = [],
  nowIso = new Date().toISOString(),
  context: LapseContext = {},
): TrainingLapseSignal => {
  const latest = latestAnalyticsSession(history);
  const now = safeDate(nowIso) ?? Date.now();

  if (!latest) {
    const personalGapDays = 7 / Math.max(1, Number(context.userProfile?.weeklyTrainingDays) || 3);
    const personalizedThresholds = buildPersonalizedThresholds(personalGapDays, context.userProfile?.trainingLevel);
    return {
      stage: 'fresh',
      daysSinceLastSession: 0,
      hasHistory: false,
      decayMultiplier: 1,
      resetFatigue: false,
      resetRotation: false,
      resetCalibrationBias: false,
      reasons: [],
      advice: '尚无训练记录，按新用户处理。',
      personalGapDays: Number(personalGapDays.toFixed(2)),
      personalizedThresholds,
      smoothDecay: 1,
      strengthRetention: 1,
      aerobicRetention: 1,
      suggestedStartingLoadFactor: 0.85,
      perMuscleRetention: [],
      rotationHint: 'unchanged',
      plannedDeload: false,
      preBreakOutcomeProfile: 'no_data',
      confidence: 'low',
      reasonsByCategory: { ...EMPTY_REASONS },
    };
  }

  const latestTs = sessionTimestamp(latest) ?? now;
  const days = Math.max(0, Math.round((now - latestTs) / MS_PER_DAY));
  const profile = context.userProfile;
  const baseline = computeBaselineFrequencyPerWeek(history, now, Number(profile?.weeklyTrainingDays) || 3);
  const useBaselineThresholds = baseline.weeksObserved < 2 && !profile?.weeklyTrainingDays;
  const personalGapDays = 7 / baseline.frequency;
  const personalizedThresholds = useBaselineThresholds
    ? { ...BASELINE_THRESHOLDS }
    : buildPersonalizedThresholds(personalGapDays, profile?.trainingLevel);
  const stage = classifyStage(days, personalizedThresholds);
  const smoothDecay = computeSmoothDecay(days, personalizedThresholds);
  const strengthRetention = computeStrengthRetention(days, profile?.trainingLevel);
  const aerobicRetention = computeAerobicRetention(days, context.healthSummary ?? undefined);
  const plannedDeload = isDeloadPhase(context.mesocyclePlan, nowIso);
  const preBreakOutcome = classifyPreBreakOutcome(context.calibrationState, latestTs);
  const startingLoadFactor = computeStartingLoadFactor(strengthRetention, smoothDecay, preBreakOutcome, profile?.trainingLevel);
  const lastEmphasis = computeLastMuscleEmphasis(latest);
  const rotationHint = computeRotationHint(lastEmphasis.muscle, lastEmphasis.templateId, stage, preBreakOutcome);
  const perMuscleRetention = computePerMuscleRetention(days, strengthRetention, history);
  const confidence = computeConfidence(history, days, Boolean(context.healthSummary), Boolean(context.calibrationState));

  // ── Reasons by category ────────────────────────────────
  const reasonsByCategory: LapseReasonsByCategory = {
    strength: [],
    aerobic: [],
    calibration: [],
    rotation: [],
    mesocycle: [],
  };

  if (stage === 'lapsed' || stage === 'long_lapsed' || stage === 'dormant') {
    reasonsByCategory.strength.push(`距离上次训练 ${days} 天，力量保留估计约 ${(strengthRetention * 100).toFixed(0)}%（基于训练等级半衰期）。`);
  }
  if (stage !== 'fresh' && stage !== 'normal') {
    if (context.healthSummary && (context.healthSummary.recentWorkoutCount > 0 || (context.healthSummary.recentHighActivityDays ?? 0) > 0)) {
      reasonsByCategory.aerobic.push(`期间有外部活动记录（${context.healthSummary.recentWorkoutCount} 次 workout / ${context.healthSummary.recentHighActivityDays} 个高活动日），有氧基础保留 ${(aerobicRetention * 100).toFixed(0)}%。`);
    } else if (stage === 'long_lapsed' || stage === 'dormant') {
      reasonsByCategory.aerobic.push(`期间无外部活动记录，有氧基础按自然衰减估算 ${(aerobicRetention * 100).toFixed(0)}%。`);
    }
  }
  if (preBreakOutcome === 'mostly_struggling') {
    reasonsByCategory.calibration.push('上次中断前最近 14 天的训练记录里出现疼痛 / 失败 / 动作质量偏弱信号，本次复训会更保守。');
  } else if (preBreakOutcome === 'mostly_on_target') {
    reasonsByCategory.calibration.push('上次中断前训练完成度稳定，本次复训可以延续之前的推进方向。');
  }
  if (plannedDeload && stage !== 'dormant') {
    reasonsByCategory.mesocycle.push('当前周期阶段为减量周，间隔为计划内行为。');
  }
  if (rotationHint === 'recovery_first') reasonsByCategory.rotation.push(`上次训练侧重 ${lastEmphasis.muscle ?? '未知'}，本次建议从恢复优先模板起步。`);
  if (rotationHint === 'restart_push') reasonsByCategory.rotation.push('训练循环回到推 A，避免长间隔后直接进入高负荷腿训练。');
  if (rotationHint === 'continue_rotation') reasonsByCategory.rotation.push('训练循环可以延续上次推进的方向。');

  // ── 兼容字段（保留旧行为含义但用更精细判断） ───────────
  const decayMultiplier = smoothDecay;
  const resetFatigue = !plannedDeload && (stage === 'long_lapsed' || stage === 'dormant');
  const resetRotation = !plannedDeload && (stage === 'long_lapsed' || stage === 'dormant');
  const resetCalibrationBias = !plannedDeload && stage === 'dormant';

  const reasons: string[] = [];
  if (stage === 'lapsed') reasons.push(`距离上次训练 ${days} 天，进入轻度间隔。`);
  if (stage === 'long_lapsed') reasons.push(`距离上次训练 ${days} 天，进入长间隔，重置训练循环和疲劳。`);
  if (stage === 'dormant') reasons.push(`距离上次训练 ${days} 天，进入休眠期，全部按新基线起步。`);
  if (plannedDeload && stage !== 'dormant') reasons.push('当前是计划内减量周。');

  const advice = buildAdviceForSignal(stage, days, startingLoadFactor, plannedDeload, rotationHint, preBreakOutcome);

  return {
    stage,
    daysSinceLastSession: days,
    lastSessionDate: latest.date,
    hasHistory: true,
    decayMultiplier,
    resetFatigue,
    resetRotation,
    resetCalibrationBias,
    reasons,
    advice,

    personalGapDays: Number(personalGapDays.toFixed(2)),
    personalizedThresholds,
    smoothDecay,
    strengthRetention,
    aerobicRetention,
    suggestedStartingLoadFactor: startingLoadFactor,
    perMuscleRetention,
    rotationHint,
    lastTemplateId: lastEmphasis.templateId,
    lastMuscleEmphasis: lastEmphasis.muscle,
    plannedDeload,
    preBreakOutcomeProfile: preBreakOutcome,
    confidence,
    reasonsByCategory,
  };
};

// ── 既有衰减辅助保留并升级 ─────────────────────────────────

const decayCountMap = (input: Record<string, number> | undefined, multiplier: number): Record<string, number> => {
  if (!input) return {};
  const result: Record<string, number> = {};
  Object.entries(input).forEach(([key, value]) => {
    const next = Math.max(0, Math.round((Number(value) || 0) * multiplier));
    if (next > 0) result[key] = next;
  });
  return result;
};

export interface AdaptiveStateLike {
  issueScores?: Record<string, number>;
  painByExercise?: Record<string, number>;
  performanceDrops?: string[];
  improvingIssues?: string[];
  moduleDose?: Record<string, 'taper' | 'baseline' | 'boost'>;
  lastUpdated?: string;
}

export const decayAdaptiveStateForLapse = <T extends AdaptiveStateLike>(state: T, lapse: TrainingLapseSignal): T => {
  if (lapse.stage === 'fresh' || lapse.stage === 'normal') return state;
  if (lapse.plannedDeload && lapse.stage !== 'dormant') return state;
  const multiplier = lapse.smoothDecay;
  return {
    ...state,
    issueScores: decayCountMap(state.issueScores, multiplier),
    painByExercise: decayCountMap(state.painByExercise, multiplier),
    performanceDrops: lapse.resetFatigue ? [] : state.performanceDrops || [],
    improvingIssues: lapse.resetFatigue ? [] : state.improvingIssues || [],
    moduleDose: lapse.resetFatigue ? {} : state.moduleDose || {},
  };
};

export const decayCalibrationStateForLapse = (
  state: AdaptiveCalibrationState | undefined | null,
  lapse: TrainingLapseSignal,
): AdaptiveCalibrationState | undefined => {
  if (!state) return state ?? undefined;
  if (lapse.stage === 'fresh' || lapse.stage === 'normal') return state;
  if (lapse.plannedDeload && lapse.stage !== 'dormant') return state;
  const muscleRetentionMap = new Map(lapse.perMuscleRetention.map((entry) => [entry.muscle, entry.retention]));
  const globalMultiplier = lapse.resetCalibrationBias ? 0 : Math.min(1, Math.max(0, lapse.smoothDecay));
  const entries = state.entries.map((entry) => {
    // Pick per-muscle retention if exerciseId encodes muscle hint via reasonHints; default to global.
    const inferredMultiplier = (() => {
      const reasonMuscle = entry.reasonHints?.find((hint) => muscleRetentionMap.has(hint));
      if (reasonMuscle) return muscleRetentionMap.get(reasonMuscle)!;
      return globalMultiplier;
    })();
    const multiplier = lapse.resetCalibrationBias ? 0 : inferredMultiplier;
    const decayed = entry.loadBias + (1 - entry.loadBias) * (1 - multiplier);
    return {
      ...entry,
      loadBias: lapse.resetCalibrationBias ? 1 : decayed,
      frozenUntil: lapse.resetCalibrationBias ? undefined : entry.frozenUntil,
    };
  });
  return {
    ...state,
    entries,
    lastUpdated: state.lastUpdated,
  };
};

export const isRotationReset = (lapse: TrainingLapseSignal) => lapse.resetRotation;
