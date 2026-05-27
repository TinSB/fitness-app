import { DEFAULT_SCREENING_PROFILE, DEFAULT_TECHNIQUE_STANDARD, PRESCRIPTION_SOURCES } from '../data/trainingData';
import { TRAINING_STANDARDS } from '../content/evidenceRules';
import type {
  AdaptiveCalibrationState,
  DeloadDecision,
  ExercisePrescription,
  ExerciseTemplate,
  MesocyclePlan,
  ReadinessSignal,
  ReadinessResult,
  ScreeningProfile,
  TodayStatus,
  TrainingMode,
  TrainingSession,
  TrainingTemplate,
  WeeklyPrescription,
} from '../models/training-model';
import { applyAdaptiveExerciseRules, buildAdaptiveConservativeDecision, buildAdaptiveDeloadDecision } from './adaptiveFeedbackEngine';
import { getDayState, getLoadBias, getRepBand } from './adaptiveRecommendationEngine';
import { buildTrainingLapseSignal, decayCalibrationStateForLapse } from './trainingLapseEngine';
import { buildAdherenceReport } from './analytics';
import { actionableSorenessAreas, clamp, clone, enrichExercise, getPrimaryMuscles, number, resolveMode, safeNumber } from './engineUtils';
import { getLoadFeedbackAdjustment } from './loadFeedbackEngine';
import { getEffectiveTrainingPhase } from './effectiveTrainingPhaseEngine';
import { buildSetWeightFineTune } from './setWeightFineTuneEngine';
import { buildPainPatterns, getExercisePainPattern } from './painPatternEngine';
import { buildTodayReadiness } from './readinessEngine';
import { filterAnalyticsHistory } from './sessionHistoryEngine';
import type { HealthSummary } from './healthSummaryEngine';
import { getMuscleBudget, getMuscleRemaining } from './supportPlanEngine';

const NONE_SORENESS: TodayStatus['soreness'][number] = '无';
const POOR_SLEEP: TodayStatus['sleep'] = '差';
const LOW_ENERGY: TodayStatus['energy'] = '低';

const statusHitsMuscle = (status: TodayStatus, muscle: string) => actionableSorenessAreas(status.soreness).includes(muscle);
const hasPoorSleep = (status: TodayStatus) => status.sleep === POOR_SLEEP;
const hasLowEnergy = (status: TodayStatus) => status.energy === LOW_ENERGY;

const mapReadinessToSignal = (result: ReadinessResult, poorSleepDays: number): ReadinessSignal => {
  const level: ReadinessSignal['level'] = result.level === 'high' ? 'green' : result.level === 'medium' ? 'yellow' : 'red';
  const title =
    result.trainingAdjustment === 'recovery'
      ? '恢复优先'
      : result.trainingAdjustment === 'conservative'
        ? '保守训练'
        : result.trainingAdjustment === 'push'
          ? '状态良好'
          : '正常推进';
  const advice =
    result.trainingAdjustment === 'recovery'
      ? '今天优先把训练做得更短、更稳，避免继续堆疲劳。'
      : result.trainingAdjustment === 'conservative'
        ? '今天可以训练，但顶组、回退组和非必要辅助量先收一点。'
        : result.trainingAdjustment === 'push'
          ? '恢复信号较好，可以正常推进，但不需要强行冲重量。'
          : '当前状态允许按计划推进，仍以动作质量和 RIR 控制强度。';

  return {
    level,
    label: `${result.score} / 100`,
    title,
    advice,
    reasons: result.reasons,
    poorSleepDays,
  };
};

const recentPoorSleepDays = (status: TodayStatus, history: TrainingSession[] = []) => {
  let count = hasPoorSleep(status) ? 1 : 0;
  for (const session of history) {
    if (session.status?.sleep === POOR_SLEEP) count += 1;
    else break;
  }
  return count;
};

const prioritizeAlternatives = (
  exercise: ExercisePrescription,
  screening: ScreeningProfile,
  readinessLevel: ReadinessSignal['level'] = 'green',
  deloadLevel: DeloadDecision['level'] = 'none',
  painPreference: 'watch' | 'substitute' | 'deload' | 'seek_professional' = 'watch'
) => {
  const alternatives = Array.isArray(exercise.alternatives) ? [...exercise.alternatives] : [];
  if (!alternatives.length) return alternatives;

  const adaptiveDecision = buildAdaptiveConservativeDecision(exercise, screening, readinessLevel, deloadLevel);
  const suggestedName = String(exercise.replacementSuggested || '').toLowerCase();

  const scoreAlternative = (name: string) => {
    const normalized = String(name || '').toLowerCase();
    let score = 0;

    if (adaptiveDecision.preferStableAlternatives) {
      if (/(machine|smith|cable|landmine|器械|史密斯|绳索|地雷管|胸推机)/i.test(normalized)) score += 5;
      if (/(dumbbell|db|哑铃)/i.test(normalized)) score += 2;
      if (/(barbell|杠铃)/i.test(normalized)) score -= 2;
    }

    if (adaptiveDecision.preferRegression && /(machine|cable|landmine|bodyweight|器械|绳索|自重|杯式|哈克)/i.test(normalized)) {
      score += 3;
    }

    if (adaptiveDecision.linkedIssues.includes('overhead_press_restriction') && /(press|push|推|举|过顶)/i.test(normalized)) {
      if (/(landmine|machine|器械|地雷管)/i.test(normalized)) score += 2;
      else score -= 2;
    }

    if (
      (adaptiveDecision.linkedIssues.includes('upper_crossed') || adaptiveDecision.linkedIssues.includes('scapular_control')) &&
      /(cable|machine|smith|绳索|器械|史密斯)/i.test(normalized)
    ) {
      score += 1;
    }

    if (painPreference === 'substitute') {
      if (/(machine|smith|cable|landmine|bodyweight|器械|史密斯|绳索|自重)/i.test(normalized)) score += 3;
      if (/(barbell|杠铃)/i.test(normalized)) score -= 2;
    }

    if (suggestedName && normalized.includes(suggestedName)) score += 4;
    return score;
  };

  return alternatives.sort((left, right) => scoreAlternative(right) - scoreAlternative(left));
};

const prescribeExercise = (
  exercise: ExerciseTemplate,
  trainingMode: TrainingMode | string,
  weeklyPrescription: WeeklyPrescription | null
): ExercisePrescription => {
  const mode = resolveMode(trainingMode);
  const mainCompound = exercise.kind === 'compound' && number(exercise.orderPriority) <= 1;
  const secondaryCompound = exercise.kind === 'compound' || exercise.kind === 'machine';
  const isolation = exercise.kind === 'isolation';

  let sets = number(exercise.sets);
  let repMin = number(exercise.repMin);
  let repMax = number(exercise.repMax);
  let rest = number(exercise.rest);
  let targetRir: [number, number] = exercise.targetRir || [1, 3];
  let loadRange = exercise.recommendedLoadRange || '约 60%-80% 1RM';
  let rule = '按当前模板执行，优先保持动作质量和可重复性。';

  if (mode.id === 'strength') {
    if (mainCompound) {
      sets = clamp(sets, 3, 5);
      repMin = TRAINING_STANDARDS.strengthRepRange.min;
      repMax = TRAINING_STANDARDS.strengthRepRange.max;
      rest = clamp(rest, 180, 300);
      targetRir = [1, 3];
      loadRange = '约 80% 1RM 以上';
      rule = '力量优先：主复合动作使用较低次数、较长休息和更严格技术标准。';
    } else if (secondaryCompound) {
      sets = clamp(sets, 2, 4);
      repMin = 5;
      repMax = 8;
      rest = clamp(rest, 150, 240);
      targetRir = [1, 3];
      loadRange = '约 75%-85% 1RM';
      rule = '次级复合动作保留力量转移，但控制疲劳成本。';
    } else {
      sets = clamp(sets, 2, 3);
      repMin = 8;
      repMax = 12;
      rest = clamp(rest, 60, 120);
      targetRir = [1, 2];
      loadRange = '约 55%-75% 1RM';
      rule = '孤立动作只补必要训练量，不影响主动作恢复。';
    }
  } else if (mode.id === 'hypertrophy') {
    if (isolation) {
      sets = clamp(sets, 2, 4);
      repMin = TRAINING_STANDARDS.isolationRepRange.min;
      repMax = TRAINING_STANDARDS.isolationRepRange.max;
      rest = clamp(rest, 60, 120);
      targetRir = [1, 2];
      loadRange = '约 50%-75% 1RM';
      rule = '肌肥大优先：孤立动作使用中高次数积累有效刺激。';
    } else {
      sets = clamp(sets, 2, 4);
      repMin = TRAINING_STANDARDS.hypertrophyRepRange.min;
      repMax = 10;
      rest = clamp(rest, 120, 180);
      targetRir = [1, 3];
      loadRange = '约 60%-80% 1RM';
      rule = '肌肥大优先：复合动作使用中等偏重负荷，配合每周有效组数推进。';
    }
  } else if (mainCompound) {
    sets = clamp(sets, 3, 4);
    repMin = 3;
    repMax = 6;
    rest = clamp(rest, 180, 240);
    targetRir = [1, 3];
    loadRange = '约 75%-85% 1RM';
    rule = '综合模式：主动作偏力量，辅助动作服务总训练量。';
  } else if (isolation) {
    sets = clamp(sets, 2, 4);
    repMin = 8;
    repMax = 15;
    rest = clamp(rest, 60, 120);
    targetRir = [1, 2];
    loadRange = '约 50%-75% 1RM';
    rule = '综合模式：孤立动作偏肌肥大和低疲劳补量。';
  } else {
    sets = clamp(sets, 2, 4);
    repMin = 6;
    repMax = 10;
    rest = clamp(rest, 120, 180);
    targetRir = [1, 3];
    loadRange = '约 65%-80% 1RM';
    rule = '综合模式：次级复合动作兼顾张力和可持续推进。';
  }

  const primary = getPrimaryMuscles(exercise)[0];
  const remaining = getMuscleRemaining(weeklyPrescription, primary);
  const budget = getMuscleBudget(weeklyPrescription, primary);
  let weeklyAdjustment = '';

  if (budget && budget.remainingCapacity !== undefined && budget.remainingCapacity <= 0) {
    sets = Math.max(1, Math.min(sets, secondaryCompound ? 2 : 1));
    weeklyAdjustment = `${primary} 的恢复额度已经用完，今天只保留必要训练量。`;
  } else if (budget && Number.isFinite(budget.todayBudget) && number(budget.todayBudget) > 0 && number(budget.todayBudget) < sets) {
    sets = Math.max(1, Math.ceil(number(budget.todayBudget)));
    weeklyAdjustment = `${primary} 今天建议补量约 ${budget.todayBudget} 组，本动作按周预算下修。`;
  } else if (Number.isFinite(remaining) && remaining <= 0 && isolation) {
    sets = Math.max(1, sets - 1);
    weeklyAdjustment = `${primary} 本周目标基本完成，孤立动作默认减少一组。`;
  } else if (budget?.adjustmentReasons?.length) {
    weeklyAdjustment = budget.adjustmentReasons[0];
  }

  return {
    ...exercise,
    sets,
    repMin,
    repMax,
    rest,
    targetRir,
    targetRirText: `${targetRir[0]}-${targetRir[1]} RIR`,
    recommendedLoadRange: loadRange,
    recommendedRepRange: [repMin, repMax],
    recommendedRestSec: [Math.max(45, rest - 30), rest],
    prescription: {
      mode: mode.id,
      modeLabel: mode.label,
      loadRange,
      repRange: [repMin, repMax],
      sets,
      restSec: rest,
      targetRir,
      rule,
      weeklyAdjustment,
      sources: [...PRESCRIPTION_SOURCES],
    },
    adjustment: weeklyAdjustment || exercise.adjustment,
  };
};

export const buildReadinessSignal = (status: TodayStatus, history: TrainingSession[] = []): ReadinessSignal => {
  const recommendationHistory = filterAnalyticsHistory(history);
  const poorSleepDays = recentPoorSleepDays(status, recommendationHistory);
  const readiness = buildTodayReadiness({ todayStatus: status, history: recommendationHistory }, undefined, {
    adherenceHigh: buildAdherenceReport(recommendationHistory).overallRate >= 85,
  });

  return mapReadinessToSignal(readiness, poorSleepDays);
};

const applyDeloadStrategy = (exercise: ExercisePrescription, deloadDecision: DeloadDecision): ExercisePrescription => {
  if (deloadDecision.level === 'none') return exercise;

  if (deloadDecision.strategy === 'reduce_accessories' && exercise.kind === 'isolation') {
    return {
      ...exercise,
      sets: Math.max(1, number(exercise.sets) - 1),
      progressLocked: true,
      conservativeTopSet: true,
      adjustment: [exercise.adjustment, '减量观察：先减少部分辅助动作，降低疲劳成本。'].filter(Boolean).join(' / '),
    };
  }

  if (deloadDecision.strategy === 'reduce_volume' || deloadDecision.strategy === 'recovery_template') {
    const setMultiplier = exercise.kind === 'isolation' ? deloadDecision.volumeMultiplier - 0.05 : deloadDecision.volumeMultiplier;
    return {
      ...exercise,
      sets: Math.max(1, Math.ceil(number(exercise.sets) * Math.max(0.4, setMultiplier))),
      progressLocked: true,
      conservativeTopSet: true,
      adjustment: [exercise.adjustment, `减量周：训练量下修到约 ${Math.round(deloadDecision.volumeMultiplier * 100)}%，优先恢复。`]
        .filter(Boolean)
        .join(' / '),
    };
  }

  return exercise;
};

export const applyStatusRules = (
  template: TrainingTemplate,
  status: TodayStatus,
  trainingMode: TrainingMode | string = 'hybrid',
  weeklyPrescription: WeeklyPrescription | null = null,
  history: TrainingSession[] = [],
  screening: ScreeningProfile = DEFAULT_SCREENING_PROFILE,
  mesocyclePlan?: MesocyclePlan | null,
  context: {
    healthSummary?: HealthSummary;
    useHealthDataForReadiness?: boolean;
    adaptiveCalibration?: AdaptiveCalibrationState;
    nowIso?: string;
    /**
     * When supplied by trainingDecisionEngine, this overrides the volume multiplier
     * derived from mesocycleWeek. The supplied value is already arbitrated (no further
     * Math.max(0.6, ...) clamp). See AR-2 in TRAINING_RECOMMENDATION_SOURCE_OF_TRUTH_REWRITE_PLAN_V1.md.
     */
    externalVolumeMultiplier?: number;
    /**
     * Productive-dose floor per ExerciseKind. When supplied, sets are clamped to at
     * least this floor (replacing the hardcoded Math.max(1, ...)). See AR-3.
     */
    externalExerciseRoleFloors?: Partial<Record<'compound' | 'machine' | 'isolation', number>>;
    /**
     * When true, skip applyDeloadStrategy() so the per-exercise deload trim is NOT applied
     * on top of an already-final externalVolumeMultiplier. See AR-2 (no double penalty).
     */
    suppressInternalDeloadStrategy?: boolean;
  } = {}
) => {
  const recommendationHistory = filterAnalyticsHistory(history);
  const adherenceReport = buildAdherenceReport(recommendationHistory);
  const readinessResult = buildTodayReadiness({ todayStatus: status, history: recommendationHistory }, template, {
    adherenceHigh: adherenceReport.overallRate >= 85,
    healthSummary: context.healthSummary,
    useHealthDataForReadiness: context.useHealthDataForReadiness,
  });
  const readiness = mapReadinessToSignal(readinessResult, recentPoorSleepDays(status, recommendationHistory));
  const deloadDecision = buildAdaptiveDeloadDecision(
    {
      history: recommendationHistory,
      todayStatus: status,
      screeningProfile: screening,
      templates: [template],
      selectedTemplateId: template.id,
      trainingMode: trainingMode as TrainingMode,
    },
    { nowIso: context.nowIso },
  );
  const effectivePhase = getEffectiveTrainingPhase({
    mesocyclePlan,
    history: recommendationHistory,
    referenceDate: context.nowIso?.slice(0, 10),
  });
  const mesocycleWeek = effectivePhase.effectiveWeek;
  const painPatterns = buildPainPatterns(recommendationHistory);

  let exercises: ExercisePrescription[] = clone(template.exercises || []).map((exercise: ExerciseTemplate) =>
    prescribeExercise(enrichExercise(exercise), trainingMode, weeklyPrescription)
  );
  const timeLimit = Number(status.time);
  // External multiplier (from trainingDecisionEngine, AR-2 clamped) overrides the legacy
  // per-engine computation that previously stacked with applyDeloadStrategy.
  const volumeMultiplier =
    context.externalVolumeMultiplier !== undefined
      ? context.externalVolumeMultiplier
      : mesocycleWeek.phase === 'deload'
        ? Math.min(mesocycleWeek.volumeMultiplier, 0.8)
        : mesocycleWeek.volumeMultiplier;
  // Productive-dose floor (AR-3): when activePhase is reentry or restart, ALWAYS enforce
  // the floor — even if the caller did not explicitly supply externalExerciseRoleFloors.
  // This guarantees every consumer of applyStatusRules (TodayView preview, training page
  // prescriptions, etc.) shows the same productive prescription as TrainingDecision.
  const phaseImpliesFloor =
    effectivePhase.activePhase === 'reentry' || effectivePhase.activePhase === 'restart';
  const defaultFloors: Partial<Record<'compound' | 'machine' | 'isolation', number>> = phaseImpliesFloor
    ? { compound: 2, machine: 2, isolation: 1 }
    : {};
  const setFloorForKind = (kind: string | undefined): number => {
    const floors = context.externalExerciseRoleFloors ?? defaultFloors;
    if (!floors) return 1;
    if (kind === 'compound' && floors.compound !== undefined) return floors.compound;
    if (kind === 'machine' && floors.machine !== undefined) return floors.machine;
    if (kind === 'isolation' && floors.isolation !== undefined) return floors.isolation;
    return 1;
  };
  // When the external multiplier is supplied, do NOT apply the 0.6 floor — the caller
  // has already enforced its own floor (per role) so the multiplier is final.
  const effectiveSetMultiplier =
    context.externalVolumeMultiplier !== undefined ? volumeMultiplier : Math.max(0.6, volumeMultiplier);

  const reentryCopy =
    effectivePhase.activePhase === 'reentry'
      ? `回归周：训练量收到约 ${Math.round(volumeMultiplier * 100)}%。`
      : effectivePhase.activePhase === 'restart'
        ? `重新开始：训练量收到约 ${Math.round(volumeMultiplier * 100)}%。`
        : '';

  exercises = exercises.map((exercise) => ({
    ...exercise,
    sets: Math.max(
      setFloorForKind(exercise.kind),
      Math.ceil(number(exercise.sets) * effectiveSetMultiplier),
    ),
    mesocyclePhase: mesocycleWeek.phase,
    mesocycleIntensityBias: mesocycleWeek.intensityBias,
    adjustment:
      reentryCopy
        ? [exercise.adjustment, reentryCopy].filter(Boolean).join(' / ')
        : mesocycleWeek.phase === 'deload'
          ? [exercise.adjustment, `当前处于减量周，整体训练量先收回到约 ${Math.round(volumeMultiplier * 100)}%。`].filter(Boolean).join(' / ')
          : exercise.adjustment,
  }));

  if (timeLimit <= 30) {
    exercises = exercises.slice(0, 4).map((exercise) => ({
      ...exercise,
      sets: Math.min(2, number(exercise.sets)),
      rest: Math.min(number(exercise.rest), 120),
      adjustment: [exercise.adjustment, '时间较短：切到今天的最低有效训练版本。'].filter(Boolean).join(' / '),
    }));
  }

  if (readinessResult.trainingAdjustment === 'conservative' || status.energy === LOW_ENERGY) {
    exercises = exercises.map((exercise) => ({
      ...exercise,
      sets: exercise.kind === 'compound' ? number(exercise.sets) : Math.max(1, number(exercise.sets) - 1),
      adjustment:
        exercise.kind === 'compound'
          ? exercise.adjustment
          : [exercise.adjustment, '精力偏低：孤立动作减少一组。'].filter(Boolean).join(' / '),
    }));
  }

  if (hasPoorSleep(status) && hasLowEnergy(status)) {
    exercises = exercises.map((exercise) => ({
      ...exercise,
      sets: exercise.kind === 'isolation' ? Math.max(1, number(exercise.sets) - 1) : number(exercise.sets),
      progressLocked: exercise.kind !== 'isolation',
      conservativeTopSet: exercise.kind !== 'isolation',
      adjustment:
        exercise.kind === 'isolation'
          ? [exercise.adjustment, '睡眠差 + 精力低：孤立动作下修剂量。'].filter(Boolean).join(' / ')
          : [exercise.adjustment, '睡眠差 + 精力低：复合动作不加重。'].filter(Boolean).join(' / '),
    }));
  }

  if (hasPoorSleep(status) && timeLimit <= 30) {
    exercises = exercises.slice(0, 4).map((exercise) => ({
      ...exercise,
      sets: Math.max(1, Math.min(number(exercise.sets), exercise.kind === 'isolation' ? 1 : 2)),
      progressLocked: true,
      conservativeTopSet: true,
      adjustment: [exercise.adjustment, '睡眠差 + 时间短：执行保底训练版本。'].filter(Boolean).join(' / '),
    }));
  }

  if (readiness.poorSleepDays >= 2) {
    exercises = exercises.slice(0, 4).map((exercise) => ({
      ...exercise,
      sets: Math.max(1, Math.min(number(exercise.sets), exercise.kind === 'isolation' ? 1 : 2)),
      progressLocked: true,
      conservativeTopSet: true,
      adjustment: [exercise.adjustment, '连续两天睡眠差：今天走轻量维持版本。'].filter(Boolean).join(' / '),
    }));
  }

  if (readinessResult.trainingAdjustment === 'recovery') {
    exercises = exercises.slice(0, 3).map((exercise) => ({
      ...exercise,
      sets: Math.max(1, Math.min(number(exercise.sets), exercise.kind === 'isolation' ? 1 : 2)),
      progressLocked: true,
      conservativeTopSet: true,
      adjustment: [exercise.adjustment, '准备度评分偏低：今天优先恢复和保底完成。'].filter(Boolean).join(' / '),
    }));
  }

  exercises = exercises.map((exercise) => {
    let next = applyAdaptiveExerciseRules(exercise, screening, {
      readinessLevel: readiness.level,
      deloadLevel: deloadDecision.level,
    });

    if (mesocycleWeek.intensityBias === 'conservative') {
      next = {
        ...next,
        progressLocked: true,
        conservativeTopSet: true,
        adaptiveTopSetFactor: Math.min(number(next.adaptiveTopSetFactor) || 1, 0.96),
        adaptiveBackoffFactor: Math.min(number(next.adaptiveBackoffFactor) || 0.92, 0.88),
      };
    } else if (mesocycleWeek.intensityBias === 'aggressive' && readinessResult.score >= 75 && !next.progressLocked) {
      next = {
        ...next,
        adaptiveTopSetFactor: Math.max(number(next.adaptiveTopSetFactor) || 1, 1),
        adaptiveBackoffFactor: Math.max(number(next.adaptiveBackoffFactor) || 0.92, 0.92),
      };
    }

    if (!context.suppressInternalDeloadStrategy) {
      // AR-2: trainingDecisionEngine has already arbitrated the deload trim into
      // externalVolumeMultiplier (clamped, never multiplied) — do not apply it again.
      next = applyDeloadStrategy(next, deloadDecision);
    }

    const painPattern = getExercisePainPattern(painPatterns, next.baseId || next.id);
    if (painPattern?.suggestedAction === 'substitute') {
      const message = `该动作近期在 ${painPattern.area} 反复出现不适，今天优先使用替代动作。`;
      next = {
        ...next,
        progressLocked: true,
        conservativeTopSet: true,
        warning: [next.warning, message].filter(Boolean).join(' / '),
        warningSource: 'painPattern',
        warningType: 'pain_history',
        warningSignals: [...(next.warningSignals || []), { message, source: 'painPattern', type: 'pain_history' }],
      };
    } else if (painPattern?.suggestedAction === 'deload' || painPattern?.suggestedAction === 'seek_professional') {
      const message = `近期 ${painPattern.area} 不适频率偏高，今天先按保守版本执行。`;
      next = {
        ...next,
        sets: Math.max(1, number(next.sets) - 1),
        progressLocked: true,
        conservativeTopSet: true,
        warning: [next.warning, message].filter(Boolean).join(' / '),
        warningSource: 'painPattern',
        warningType: 'pain_history',
        warningSignals: [...(next.warningSignals || []), { message, source: 'painPattern', type: 'pain_history' }],
      };
    }

    const feedbackAdjustment = getLoadFeedbackAdjustment(recommendationHistory, next.canonicalExerciseId || next.baseId || next.id);
    if (feedbackAdjustment.direction === 'conservative') {
      next = {
        ...next,
        progressLocked: true,
        conservativeTopSet: true,
        adaptiveTopSetFactor: Math.min(number(next.adaptiveTopSetFactor) || 1, 0.97),
        adaptiveBackoffFactor: Math.min(number(next.adaptiveBackoffFactor) || 0.92, 0.88),
        adjustment: [next.adjustment, feedbackAdjustment.reasons[0]].filter(Boolean).join(' / '),
      };
    } else if (feedbackAdjustment.direction === 'slightly_aggressive' && !next.progressLocked) {
      next = {
        ...next,
        adaptiveTopSetFactor: Math.max(number(next.adaptiveTopSetFactor) || 1, 1.01),
        adjustment: [next.adjustment, feedbackAdjustment.reasons[0]].filter(Boolean).join(' / '),
      };
    }

    const alternatives = prioritizeAlternatives(next, screening, readiness.level, deloadDecision.level, painPattern?.suggestedAction || 'watch');
    if (alternatives.length) {
      next = {
        ...next,
        alternatives,
        replacementSuggested:
          next.replacementSuggested ||
          (next.conservativeTopSet || next.progressLocked || readiness.level === 'red' || deloadDecision.level === 'red' ? alternatives[0] : ''),
      };
    }

    if (statusHitsMuscle(status, next.muscle)) {
      next = {
        ...next,
        sets: Math.max(1, number(next.sets) - 1),
        conservativeTopSet: next.kind !== 'isolation' || next.conservativeTopSet,
        warning: [next.warning, `${next.muscle} 今天酸痛，默认减少一组并放慢推进。`].filter(Boolean).join(' / '),
      };
    }

    if (context.adaptiveCalibration) {
      const lapse = buildTrainingLapseSignal(recommendationHistory, context.nowIso);
      const lapsedCalibration = decayCalibrationStateForLapse(context.adaptiveCalibration, lapse) || context.adaptiveCalibration;
      const exerciseKey = next.canonicalExerciseId || next.baseId || next.id;
      const repBand = getRepBand(number(next.repMin), number(next.repMax));
      const dayState = getDayState(readiness, status);
      const biasResult = getLoadBias(lapsedCalibration, exerciseKey, repBand, dayState);
      if (biasResult.applied) {
        const currentTop = number(next.adaptiveTopSetFactor) || 1;
        const currentBackoff = number(next.adaptiveBackoffFactor) || 0.92;
        const adjustedTop = currentTop * biasResult.bias;
        const adjustedBackoff = currentBackoff * biasResult.bias;
        const direction = biasResult.bias > 1 ? '上调' : biasResult.bias < 1 ? '下调' : '维持';
        const pct = Math.abs(Math.round((biasResult.bias - 1) * 100));
        const reason =
          biasResult.frozen
            ? '动作有近期不适或动作质量记录，自动加重已冻结。'
            : biasResult.bias === 1
              ? ''
              : `根据近期实际表现与推荐的误差，本动作在该次数区间和当前状态下自动${direction} ${pct}% 重量。`;
        next = {
          ...next,
          adaptiveTopSetFactor: adjustedTop,
          adaptiveBackoffFactor: adjustedBackoff,
          adaptiveReasons: [...(next.adaptiveReasons || []), ...(reason ? [reason] : [])],
          adjustment: reason ? [next.adjustment, reason].filter(Boolean).join(' / ') : next.adjustment,
        };
      }
    }

    return next;
  });

  // Feature: precision fineTune trust override.
  //
  // The brake stack above (mesocycle base-week conservatism, "first-week"
  // readiness defaults, generic feedback-adjustment, etc.) is the right
  // floor for a user with NO history. But once the same user has 8+
  // weeks of stable working-set evidence on a movement and a flat-or-up
  // weekly e1RM slope, those soft brakes are over-conservative — they
  // pin the recommended weight at startWeight × 0.96 even when the
  // user has been comfortably training 20% above that. The "及时跟随
  // 用户" requirement (see docs/PRECISION_RECOMMENDATION_PLAN.md) needs
  // the recommender to honour that lived evidence.
  //
  // This override lifts the soft brakes ONLY when:
  //   (a) the per-exercise fineTune engine has enough samples and a
  //       non-negative weekly e1RM slope (i.e. the user is genuinely
  //       progressing or holding),
  //   (b) no SAFETY signal is in play (deload week, recovery readiness,
  //       pain pattern, warningSource on the prescription),
  //   (c) we are not currently in a hard-conservative mesocycle phase
  //       (deload week / hard recovery readiness adjust).
  //
  // We deliberately keep the brake when a safety signal is real — pain,
  // explicit deload, two-day poor-sleep streak, etc. — because those
  // reflect the user's body, not the recommender's caution.
  const safetyOverride =
    deloadDecision.triggered ||
    deloadDecision.level === 'red' ||
    readinessResult.trainingAdjustment === 'recovery' ||
    readiness.poorSleepDays >= 2 ||
    (hasPoorSleep(status) && hasLowEnergy(status));
  if (!safetyOverride) {
    exercises = exercises.map((exercise) => {
      // Decide whether the existing warning is a HARD safety signal (pain
      // pattern, data-health issue, repeated injury flag — those reflect
      // the user's body and stay) or a SOFT default like
      // 'screeningRestriction', which the default screening profile
      // stamps on every push/pull/leg exercise until the user fills in
      // their assessment. Treating screeningRestriction as a hard brake
      // would mean the trust override never fires for new accounts even
      // when the user has months of clean training data on the same
      // movement — the exact "及时跟随" failure mode we are fixing.
      const hardSafetyWarningSources = new Set(['painPattern', 'painHistory', 'dataHealth']);
      const hasHardSafetyWarning =
        Boolean(exercise.warningSource) && hardSafetyWarningSources.has(exercise.warningSource as string);
      if (hasHardSafetyWarning) return exercise;
      const exerciseKey = exercise.baseId || exercise.id;
      const fineTune = buildSetWeightFineTune({
        history: recommendationHistory,
        exerciseId: exerciseKey,
        baseExerciseId: exercise.baseId,
        targetReps: number(exercise.repMin) || 6,
        repMin: number(exercise.repMin) || 6,
        repMax: number(exercise.repMax) || 8,
      });
      const userMature =
        !fineTune.basis.fallbackReason &&
        fineTune.basis.samplesUsed >= 8 &&
        fineTune.basis.weeklySlopeKg >= 0;
      if (!userMature) return exercise;
      // Release the soft brake. We do NOT touch `sets` (those came from
      // mesocycle volume scaling which is a separate concern), only the
      // load brakes. The downstream buildSetPrescription will then emit
      // a fineTune-respecting weight, and the recommender note inside
      // progressionRulesEngine will reflect the actual progression.
      const reason = `连续 ${fineTune.basis.samplesUsed} 组稳定推进，今天解除保守锁定，按实际进度走。`;
      return {
        ...exercise,
        progressLocked: false,
        conservativeTopSet: false,
        adaptiveTopSetFactor: Math.max(number(exercise.adaptiveTopSetFactor) || 1, 1),
        adaptiveBackoffFactor: Math.max(number(exercise.adaptiveBackoffFactor) || 0.92, 0.92),
        adjustment: [exercise.adjustment, reason].filter(Boolean).join(' / '),
        adaptiveReasons: [...(exercise.adaptiveReasons || []), reason],
      };
    });
  }

  // AR-3: re-enforce the productive-dose floor as a FINAL pass. Use either the explicitly
  // supplied externalExerciseRoleFloors (when TrainingDecision called us with arbitrated
  // floors) OR the phase-implied defaults (when any caller invokes us during reentry/restart
  // — guarantees TodayView preview and any other call site shows the same productive
  // prescription as TrainingDecision). Downstream stacks (applyAdaptiveExerciseRules
  // conservativeLevel cut, pain-pattern -1, statusHitsMuscle -1) can reduce sets below the
  // floor; the floor is the contract every consumer relies on for reentry productivity.
  const finalFloors = context.externalExerciseRoleFloors ?? defaultFloors;
  if (finalFloors.compound !== undefined || finalFloors.machine !== undefined || finalFloors.isolation !== undefined) {
    const floors = finalFloors;
    const floorOf = (kind: string | undefined): number => {
      if (kind === 'compound' && floors.compound !== undefined) return floors.compound;
      if (kind === 'machine' && floors.machine !== undefined) return floors.machine;
      if (kind === 'isolation' && floors.isolation !== undefined) return floors.isolation;
      return 1;
    };
    exercises = exercises.map((exercise) => ({
      ...exercise,
      sets: Math.max(floorOf(exercise.kind), number(exercise.sets)),
    }));
  }

  return {
    ...template,
    exercises,
    duration:
      deloadDecision.level === 'red'
        ? Math.min(timeLimit || template.duration, 35)
        : readinessResult.trainingAdjustment === 'recovery'
          ? Math.min(30, timeLimit || template.duration)
          : timeLimit <= 30 || readiness.poorSleepDays >= 2
            ? 30
            : template.duration,
    readiness,
    readinessResult,
    mesocycleWeek,
    deloadDecision,
  };
};

export const normalizeTemplateExerciseInput = (
  exercise: ExerciseTemplate,
  field: keyof ExerciseTemplate | 'rom' | 'tempo' | 'stopRule' | string,
  value: unknown
) => {
  const next: ExerciseTemplate = { ...exercise };

  if (field === 'sets') next.sets = Math.round(safeNumber(value, number(exercise.sets), 1, 8));
  else if (field === 'repMin') next.repMin = Math.round(safeNumber(value, exercise.repMin, 1, 50));
  else if (field === 'repMax') next.repMax = Math.round(safeNumber(value, exercise.repMax, 1, 80));
  else if (field === 'rest') next.rest = Math.round(safeNumber(value, exercise.rest, 15, 600));
  else if (field === 'startWeight') next.startWeight = safeNumber(value, exercise.startWeight, 0, 500);
  else if (field === 'rom' || field === 'tempo' || field === 'stopRule') {
    next.techniqueStandard = {
      ...(exercise.techniqueStandard || DEFAULT_TECHNIQUE_STANDARD),
      [field]: String(value || ''),
    };
  } else {
    (next as unknown as Record<string, unknown>)[field] = value;
  }

  if (next.repMin > next.repMax) {
    if (field === 'repMin') next.repMax = next.repMin;
    else next.repMin = next.repMax;
  }

  return next;
};
