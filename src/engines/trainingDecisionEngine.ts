// trainingDecisionEngine — sole final-decision owner for training recommendations.
// See docs/TRAINING_RECOMMENDATION_SOURCE_OF_TRUTH_REWRITE_PLAN_V1.md.
//
// This file is the ONLY place allowed to import the legacy "final-decision" engines
// listed in §4.4 of the plan. Other layers (presenters, features, uiOs) must consume
// TrainingDecision instead.

import type { DeloadDecision, ExercisePrescription } from '../models/training-model';
import { buildAdaptiveDeloadDecision } from './adaptiveFeedbackEngine';
import { buildTodayReadiness, mapTodayStatusToReadinessInput } from './readinessEngine';
import { collectPainAreasFromHistory } from './readinessEngine';
import { buildTrainingLapseSignal } from './trainingLapseEngine';
import {
  getEffectiveTrainingPhase,
  type EffectiveTrainingPhase,
} from './effectiveTrainingPhaseEngine';
import { applyStatusRules } from './exercisePrescriptionEngine';
import type {
  ExerciseRole,
  HiddenDebugSignals,
  RiskLevel,
  TrainingDecision,
  TrainingDecisionInput,
  UserFacingPerSurface,
  VolumeMode,
  WorkingSetTarget,
} from './trainingDecisionTypes';

// --- Constants (productive-dose floors per role; reentry-aware) ---

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

// --- Helpers ---

const roleOf = (kind: string | undefined, name?: string): ExerciseRole => {
  const k = (kind || '').toLowerCase();
  const n = (name || '').toLowerCase();
  if (k === 'compound') {
    // Heuristic: bench / squat / deadlift / press / row = main compound;
    // others fall back to secondary-compound to preserve productive dose.
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
  return 1; // base/build/overload/deload use their persisted multiplier
};

const clampMultiplier = (
  effectivePhase: EffectiveTrainingPhase,
  deload: DeloadDecision,
  severeFlag: boolean,
): { multiplier: number; clampReasons: string[] } => {
  const reasons: string[] = [];
  // Start from effectiveWeek multiplier (already reentry-aware)
  let multiplier = effectivePhase.effectiveWeek.volumeMultiplier;

  if (severeFlag) {
    multiplier = Math.min(multiplier, SEVERE_VOLUME_FLOOR);
    reasons.push('AR-1-severe-cut');
    return { multiplier, clampReasons: reasons };
  }

  // AR-2: when reentry/restart, do NOT multiply deload trim on top — clamp the deload multiplier
  // to >= phase floor instead.
  const phaseFloor = phaseToVolumeFloor(effectivePhase.activePhase);
  if (deload.triggered && deload.volumeMultiplier < phaseFloor && effectivePhase.activePhase !== 'deload') {
    if (effectivePhase.activePhase === 'reentry' || effectivePhase.activePhase === 'restart') {
      // Clamp instead of stack
      reasons.push(
        `AR-2-reentry-clamp-deload(${deload.volumeMultiplier.toFixed(2)}->${phaseFloor.toFixed(2)})`,
      );
      multiplier = Math.max(multiplier, phaseFloor);
    } else {
      // Outside reentry, the deload trim may still apply but only the minimum of the two,
      // never the product.
      multiplier = Math.min(multiplier, deload.volumeMultiplier);
      reasons.push('AR-2-min-not-product');
    }
  } else if (deload.triggered) {
    // Both engines agree on deload — pick the more aggressive of the two (min), not product.
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
): TrainingDecision['sessionIntent'] => {
  if (severeFlag) return 'severe-rest';
  if (effectivePhase.activePhase === 'reentry' || effectivePhase.activePhase === 'restart') {
    return 'reentry-productive';
  }
  if (explicitDeload || effectivePhase.activePhase === 'deload') return 'deload-week';
  if (e1rmTrendUp && recoveryHigh) return 'controlled-reload';
  return 'normal-session';
};

const volumeModeFor = (
  intent: TrainingDecision['sessionIntent'],
  multiplier: number,
): VolumeMode => {
  if (intent === 'severe-rest') return 'severe-cut';
  if (intent === 'reentry-productive') return 'reentry-floor';
  if (intent === 'deload-week') return 'trim';
  if (multiplier > 1.05) return 'expand';
  if (multiplier < 0.95) return 'trim';
  return 'hold';
};

const intensityModeFor = (
  intent: TrainingDecision['sessionIntent'],
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
  intent: TrainingDecision['sessionIntent'],
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

const intentLabel = (intent: TrainingDecision['sessionIntent']): string => {
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

const buildUserFacing = (
  intent: TrainingDecision['sessionIntent'],
  phase: EffectiveTrainingPhase,
  weeklyDirection: 'increase' | 'hold' | 'decrease',
  weeklyBlocked: boolean,
  riskLevel: RiskLevel,
): Partial<Record<UserFacingPerSurface['surfaceId'], UserFacingPerSurface>> => {
  const sameHeadline = intentLabel(intent);
  const compactPhase = phaseLabel(phase.activePhase);
  const advice =
    intent === 'reentry-productive'
      ? '主动作至少 2 组，先把状态拉回来。'
      : intent === 'controlled-reload'
        ? '维持负荷，重点休息，下一周再加。'
        : intent === 'severe-rest'
          ? '先处理身体信号，下次再训。'
          : intent === 'deload-week'
            ? '主动收量，把睡眠和精力补满。'
            : '按计划推进，记录数据即可。';

  const weeklyDirectionLabel =
    weeklyDirection === 'increase'
      ? '下周可小幅推进'
      : weeklyDirection === 'decrease'
        ? '下周需要降量'
        : weeklyBlocked
          ? '维持当前节奏'
          : '下周维持当前节奏';

  const riskBadge =
    riskLevel === 'severe' || riskLevel === 'high'
      ? { level: riskLevel, label: '需注意', rationaleCode: `risk:${riskLevel}` }
      : undefined;

  return {
    today: {
      surfaceId: 'today',
      headline: `${compactPhase} · ${sameHeadline}`,
      oneLineAdvice: advice,
      riskBadge,
      primaryActionLabel: intent === 'severe-rest' ? '查看建议' : '开始训练',
      micro: { phaseLabel: compactPhase },
    },
    plan: {
      surfaceId: 'plan',
      headline: weeklyDirectionLabel,
      oneLineAdvice: advice,
      micro: { phaseLabel: compactPhase },
    },
    training: {
      surfaceId: 'training',
      headline: sameHeadline,
      micro: { phaseLabel: compactPhase },
    },
    focus: {
      surfaceId: 'focus',
      headline: sameHeadline,
      oneLineAdvice: advice,
    },
    progress: {
      surfaceId: 'progress',
      headline: sameHeadline,
      oneLineAdvice: advice,
      micro: { weeklyDirectionLabel },
    },
    record: {
      surfaceId: 'record',
      headline:
        intent === 'reentry-productive'
          ? '下次建议：保守加重'
          : intent === 'controlled-reload'
            ? '下次建议：保持重量'
            : intent === 'severe-rest'
              ? '下次建议：先恢复'
              : '下次建议：按计划',
    },
    explanation: {
      surfaceId: 'explanation',
      headline: '推荐说明',
      oneLineAdvice: `阶段：${compactPhase}；方向：${sameHeadline}。`,
    },
  };
};

const isE1rmTrendUp = (history: TrainingDecisionInput['history']): boolean => {
  // Light heuristic: if there are at least 4 analytics sessions and the latest top-set weight
  // is >= the rolling average of older sessions for the same exercise, treat as up.
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

// --- Main entry ---

export const buildTrainingDecision = (input: TrainingDecisionInput): TrainingDecision => {
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
  const readinessInput = mapTodayStatusToReadinessInput(input.todayStatus, input.template, painAreas);
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

  // Floors per role (AR-3) — TrainingDecision-internal role taxonomy
  const exerciseRoleFloors: Record<ExerciseRole, number> =
    intent === 'reentry-productive' ? { ...ROLE_FLOORS_REENTRY } : { ...ROLE_FLOORS_NORMAL };
  if (intent === 'reentry-productive') arbitrationTrace.push('AR-3-productive-floor');

  // Floors translated to ExerciseKind taxonomy for the prescription assembler.
  // Both compound (main + secondary) lift to the secondary-compound floor (always ≥ both).
  const kindFloors: Partial<Record<'compound' | 'machine' | 'isolation', number>> = {
    compound: Math.max(exerciseRoleFloors['main-compound'], exerciseRoleFloors['secondary-compound']),
    machine: exerciseRoleFloors.accessory,
    isolation: exerciseRoleFloors.isolation,
  };

  // Build prescriptions via the (modified) exercisePrescriptionEngine.applyStatusRules
  // with externally supplied multiplier + floors so it does NOT double-trim internally.
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

  // Working-set targets (one per prescribed exercise)
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

  // Weekly direction (AR-4): can only further reduce if a severe flag exists.
  // (The WeeklyProgressionSignal in this MVP is derived from the deload trigger; full
  // weeklyProgressionRecommendationEngine signal narrowing is a follow-up.)
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

  // AR-6: cap at one risk badge per surface — handled inside buildUserFacing.
  // AR-7: headline length cap — assertions in tests.

  const progressClarityTripletSuppressed = intent !== 'normal-session';
  if (progressClarityTripletSuppressed) arbitrationTrace.push('AR-5-progress-clarity-suppressed');

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
    muscleGroupVolumeTargets: [], // populated in a follow-up; not required by current tests
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
    userFacing: buildUserFacing(
      intent,
      effectivePhase,
      weeklyDirection,
      weeklyBlockReasons.length > 0,
      riskLevel,
    ),
    hiddenDebugSignals: hidden,
    computedAtIso: nowIso,
    decisionVersion: 'v2',
  };
};
