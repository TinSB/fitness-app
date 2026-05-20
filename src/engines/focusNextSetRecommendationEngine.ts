import type { FocusTrainingStep } from './focusModeStateEngine';
import { resolveActionableLoadContract } from './actionableLoadContract';
import { number } from './engineUtils';
import { DEFAULT_UNIT_SETTINGS, convertLbToKg, sanitizeUnitSettings } from './unitConversionEngine';
import type { TechniqueQuality, TrainingSession, UnitSettings } from '../models/training-model';

export type FocusNextSetRecommendationKind =
  | 'no_recommendation'
  | 'hold'
  | 'increase_load'
  | 'decrease_load'
  | 'reduce_reps'
  | 'stop_exercise'
  | 'skip_remaining_warmup'
  | 'extend_rest'
  | 'avoid_pr_attempt';

export type FocusNextSetRecommendationConfidence = 'low' | 'medium' | 'high';

export interface FocusNextSetRecommendationInput {
  session: TrainingSession;
  completedStep: FocusTrainingStep;
  nextStep: FocusTrainingStep | null;
  completedActualWeightKg?: number;
  completedActualReps?: number;
  completedActualRir?: number;
  painFlag?: boolean;
  techniqueQuality?: TechniqueQuality;
  unitSettings?: Partial<UnitSettings>;
  nowIso?: string;
}

export interface FocusNextSetRecommendation {
  id: string;
  scope: 'set';
  level: 1 | 2;
  recommendationKind: FocusNextSetRecommendationKind;
  targetExerciseId?: string;
  targetSetId?: string;
  actionableLoadKg?: number;
  plannedReps?: number;
  confidence: FocusNextSetRecommendationConfidence;
  reasonCodes: string[];
  userMessage: string;
  riskFlags: string[];
  requiresConfirmation: boolean;
  blockedReasons: string[];
  sourceEngineIds: string[];
  createdAt: string;
}

type RecommendationDraft = Omit<FocusNextSetRecommendation, 'id' | 'scope' | 'sourceEngineIds' | 'createdAt'>;

const ENGINE_ID = 'focus-next-set-recommendation-v1';
const FALLBACK_CREATED_AT = '1970-01-01T00:00:00.000Z';

const isSupportStep = (step: FocusTrainingStep | null | undefined): boolean =>
  Boolean(
    step &&
      (step.stepType === 'support' ||
        step.stepType === 'correction' ||
        step.stepType === 'functional' ||
        step.blockType === 'correction' ||
        step.blockType === 'functional'),
  );

const positiveNumber = (value: unknown): number | undefined => {
  const parsed = number(value);
  return parsed > 0 ? parsed : undefined;
};

const configuredIncrementKg = (unitSettings: Partial<UnitSettings> | undefined): number => {
  const settings = sanitizeUnitSettings(unitSettings);
  if (settings.weightUnit === 'lb') {
    return convertLbToKg(settings.defaultIncrementLb || DEFAULT_UNIT_SETTINGS.defaultIncrementLb);
  }
  return settings.defaultIncrementKg || DEFAULT_UNIT_SETTINGS.defaultIncrementKg;
};

const plannedRepsFor = (step: FocusTrainingStep | null | undefined): number | undefined => positiveNumber(step?.plannedReps);

const loadForStep = (step: FocusTrainingStep | null | undefined): number | undefined => positiveNumber(step?.plannedWeight);

const stepSetPurpose = (step: FocusTrainingStep) => (step.stepType === 'warmup' ? 'warmup' : 'working');

const resolveActionableLoadKg = (
  step: FocusTrainingStep,
  rawLoadKg: number | undefined,
  unitSettings: Partial<UnitSettings> | undefined,
): number | undefined => {
  if (!rawLoadKg || rawLoadKg <= 0) return undefined;
  const result = resolveActionableLoadContract({
    exerciseName: step.exerciseName || step.exerciseId,
    rawTheoreticalLoadKg: rawLoadKg,
    plannedReps: step.plannedReps,
    plannedRir: step.plannedRir,
    setPurpose: stepSetPurpose(step),
    unitSettings,
    showTheoreticalDetail: true,
  });
  return result.actionableLoadKg;
};

const recommendationLevel = (draft: Pick<RecommendationDraft, 'actionableLoadKg' | 'plannedReps' | 'requiresConfirmation' | 'riskFlags'>): 1 | 2 => {
  if (draft.requiresConfirmation || draft.riskFlags.length) return 1;
  return draft.actionableLoadKg || draft.plannedReps ? 2 : 1;
};

const finalizeRecommendation = (
  input: FocusNextSetRecommendationInput,
  draft: RecommendationDraft,
): FocusNextSetRecommendation => ({
  ...draft,
  id: `focus-next-set:${input.completedStep.id}->${input.nextStep?.id ?? 'none'}:${draft.recommendationKind}`,
  scope: 'set',
  sourceEngineIds: [ENGINE_ID],
  createdAt: input.nowIso ?? FALLBACK_CREATED_AT,
});

const buildDraft = (
  input: FocusNextSetRecommendationInput,
  draft: Omit<RecommendationDraft, 'level'> & { level?: 1 | 2 },
): FocusNextSetRecommendation => {
  const resolvedDraft: RecommendationDraft = {
    ...draft,
    level: draft.level ?? recommendationLevel(draft),
  };
  return finalizeRecommendation(input, resolvedDraft);
};

const targetFields = (step: FocusTrainingStep | null | undefined): Pick<RecommendationDraft, 'targetExerciseId' | 'targetSetId'> =>
  step
    ? {
        targetExerciseId: step.exerciseId,
        targetSetId: step.id,
      }
    : {};

const nextStepPrescription = (
  nextStep: FocusTrainingStep,
  input: FocusNextSetRecommendationInput,
  rawLoadKg = loadForStep(nextStep),
) => ({
  actionableLoadKg: resolveActionableLoadKg(nextStep, rawLoadKg, input.unitSettings),
  plannedReps: plannedRepsFor(nextStep),
});

const isNearFailure = (rir: number | undefined): boolean => rir !== undefined && rir <= 0;

const isPoorTechnique = (quality: TechniqueQuality | undefined): boolean => quality === 'poor';

const hasWarmupSkipWindow = (nextStep: FocusTrainingStep): boolean => nextStep.stepType === 'warmup' && nextStep.setIndex < nextStep.totalSetsForStepType - 1;

const buildNoRecommendation = (
  input: FocusNextSetRecommendationInput,
  reasonCode: string,
  userMessage: string,
  blockedReasons: string[],
) =>
  buildDraft(input, {
    ...targetFields(input.nextStep),
    recommendationKind: 'no_recommendation',
    confidence: 'low',
    reasonCodes: [reasonCode],
    userMessage,
    riskFlags: [],
    requiresConfirmation: false,
    blockedReasons,
    level: 1,
  });

const buildWarmupRecommendation = (input: FocusNextSetRecommendationInput, nextStep: FocusTrainingStep): FocusNextSetRecommendation => {
  const actualReps = positiveNumber(input.completedActualReps);
  const plannedReps = plannedRepsFor(input.completedStep);
  const actualRir = input.completedActualRir === undefined ? undefined : number(input.completedActualRir);
  const canSkip =
    input.completedStep.stepType === 'warmup' &&
    actualReps !== undefined &&
    plannedReps !== undefined &&
    actualReps >= plannedReps + 3 &&
    !input.painFlag &&
    !isPoorTechnique(input.techniqueQuality) &&
    !isNearFailure(actualRir) &&
    hasWarmupSkipWindow(nextStep);

  if (canSkip) {
    return buildDraft(input, {
      ...targetFields(nextStep),
      recommendationKind: 'skip_remaining_warmup',
      confidence: 'medium',
      reasonCodes: ['warmup_reps_above_plan', 'remaining_warmup_available'],
      userMessage: '热身完成度充足，可跳过剩余热身。',
      riskFlags: [],
      requiresConfirmation: true,
      blockedReasons: [],
      level: 1,
    });
  }

  return buildDraft(input, {
    ...targetFields(nextStep),
    ...nextStepPrescription(nextStep, input),
    recommendationKind: 'hold',
    confidence: 'medium',
    reasonCodes: ['warmup_hold'],
    userMessage: '保持下一组热身处方。',
    riskFlags: [],
    requiresConfirmation: false,
    blockedReasons: [],
  });
};

const buildWorkingRecommendation = (input: FocusNextSetRecommendationInput, nextStep: FocusTrainingStep): FocusNextSetRecommendation => {
  const settings = sanitizeUnitSettings(input.unitSettings);
  const incrementKg = configuredIncrementKg(settings);
  const actualWeightKg = positiveNumber(input.completedActualWeightKg);
  const actualReps = positiveNumber(input.completedActualReps);
  const actualRir = input.completedActualRir === undefined ? undefined : number(input.completedActualRir);
  const completedPlannedReps = plannedRepsFor(input.completedStep);
  const nextPlannedReps = plannedRepsFor(nextStep);
  const plannedRir = number(input.completedStep.plannedRir);
  const nextPlannedLoadKg = loadForStep(nextStep);
  const baseLoadKg = nextPlannedLoadKg || actualWeightKg || loadForStep(input.completedStep);

  if (input.painFlag) {
    return buildDraft(input, {
      ...targetFields(nextStep),
      recommendationKind: 'stop_exercise',
      confidence: 'high',
      reasonCodes: ['pain_flag'],
      userMessage: '已标记不适，建议停止当前动作并确认。',
      riskFlags: ['pain'],
      requiresConfirmation: true,
      blockedReasons: [],
      level: 1,
    });
  }

  if (isPoorTechnique(input.techniqueQuality)) {
    const rawLoadKg = baseLoadKg !== undefined ? Math.max(0, baseLoadKg - incrementKg) : undefined;
    return buildDraft(input, {
      ...targetFields(nextStep),
      actionableLoadKg: resolveActionableLoadKg(nextStep, rawLoadKg, input.unitSettings),
      plannedReps: nextPlannedReps,
      recommendationKind: 'decrease_load',
      confidence: 'medium',
      reasonCodes: ['poor_technique'],
      userMessage: '动作质量不足，下一组先降重。',
      riskFlags: ['technique_breakdown'],
      requiresConfirmation: false,
      blockedReasons: [],
      level: 1,
    });
  }

  if (actualWeightKg === undefined || actualReps === undefined || completedPlannedReps === undefined) {
    return buildDraft(input, {
      ...targetFields(nextStep),
      plannedReps: nextPlannedReps,
      recommendationKind: 'hold',
      confidence: 'low',
      reasonCodes: ['insufficient_actual_data'],
      userMessage: '实际记录不足，保持下一组处方。',
      riskFlags: [],
      requiresConfirmation: false,
      blockedReasons: ['missing_actual_weight_or_reps'],
      level: 1,
    });
  }

  if (isNearFailure(actualRir)) {
    if (nextPlannedLoadKg !== undefined && nextPlannedLoadKg > actualWeightKg) {
      return buildDraft(input, {
        ...targetFields(nextStep),
        recommendationKind: 'avoid_pr_attempt',
        confidence: 'medium',
        reasonCodes: ['near_failure'],
        userMessage: '接近力竭，避免继续冲击 PR。',
        riskFlags: ['near_failure'],
        requiresConfirmation: true,
        blockedReasons: [],
        level: 1,
      });
    }
    return buildDraft(input, {
      ...targetFields(nextStep),
      recommendationKind: 'extend_rest',
      confidence: 'medium',
      reasonCodes: ['near_failure'],
      userMessage: '接近力竭，先延长休息。',
      riskFlags: ['near_failure'],
      requiresConfirmation: false,
      blockedReasons: [],
      level: 1,
    });
  }

  if (actualReps <= completedPlannedReps - 2) {
    if (baseLoadKg !== undefined) {
      const rawLoadKg = Math.max(0, baseLoadKg - incrementKg);
      return buildDraft(input, {
        ...targetFields(nextStep),
        actionableLoadKg: resolveActionableLoadKg(nextStep, rawLoadKg, input.unitSettings),
        plannedReps: nextPlannedReps,
        recommendationKind: 'decrease_load',
        confidence: 'medium',
        reasonCodes: ['reps_below_plan'],
        userMessage: '上一组低于计划，下一组小幅降重。',
        riskFlags: [],
        requiresConfirmation: false,
        blockedReasons: [],
      });
    }
    return buildDraft(input, {
      ...targetFields(nextStep),
      plannedReps: nextPlannedReps !== undefined ? Math.max(1, nextPlannedReps - 1) : undefined,
      recommendationKind: 'reduce_reps',
      confidence: 'medium',
      reasonCodes: ['reps_below_plan'],
      userMessage: '上一组低于计划，下一组降低次数目标。',
      riskFlags: [],
      requiresConfirmation: false,
      blockedReasons: ['missing_load_baseline'],
    });
  }

  if (actualReps >= completedPlannedReps + 2) {
    const rawLoadKg = baseLoadKg !== undefined ? baseLoadKg + incrementKg : undefined;
    return buildDraft(input, {
      ...targetFields(nextStep),
      actionableLoadKg: resolveActionableLoadKg(nextStep, rawLoadKg, input.unitSettings),
      plannedReps: nextPlannedReps,
      recommendationKind: 'increase_load',
      confidence: 'high',
      reasonCodes: ['reps_above_plan'],
      userMessage: '上一组完成余量充足，下一组小幅加重。',
      riskFlags: [],
      requiresConfirmation: false,
      blockedReasons: [],
    });
  }

  const highRirThreshold = Math.max(4, plannedRir + 2);
  if (actualRir !== undefined && actualRir >= highRirThreshold) {
    if (actualReps >= completedPlannedReps && baseLoadKg !== undefined) {
      return buildDraft(input, {
        ...targetFields(nextStep),
        actionableLoadKg: resolveActionableLoadKg(nextStep, baseLoadKg + incrementKg, input.unitSettings),
        plannedReps: nextPlannedReps,
        recommendationKind: 'increase_load',
        confidence: 'medium',
        reasonCodes: ['rir_too_high'],
        userMessage: '上一组余量偏多，下一组小幅加重。',
        riskFlags: [],
        requiresConfirmation: false,
        blockedReasons: [],
      });
    }

    return buildDraft(input, {
      ...targetFields(nextStep),
      ...nextStepPrescription(nextStep, input),
      recommendationKind: 'hold',
      confidence: 'medium',
      reasonCodes: ['rir_too_high'],
      userMessage: '余量偏多但完成度不足，先保持处方。',
      riskFlags: [],
      requiresConfirmation: false,
      blockedReasons: [],
    });
  }

  return buildDraft(input, {
    ...targetFields(nextStep),
    ...nextStepPrescription(nextStep, input),
    recommendationKind: 'hold',
    confidence: 'high',
    reasonCodes: ['matched_plan'],
    userMessage: '保持下一组处方。',
    riskFlags: [],
    requiresConfirmation: false,
    blockedReasons: [],
  });
};

export const buildFocusNextSetRecommendation = (input: FocusNextSetRecommendationInput): FocusNextSetRecommendation => {
  if (!input.nextStep) {
    return buildNoRecommendation(input, 'session_or_exercise_complete', '当前训练位置已结束，暂无下一组建议。', ['no_next_step']);
  }

  if (isSupportStep(input.completedStep) || isSupportStep(input.nextStep)) {
    return buildNoRecommendation(input, 'support_step_not_supported', '辅助步骤不生成负重建议。', ['support_step']);
  }

  if (input.nextStep.stepType === 'warmup') {
    return buildWarmupRecommendation(input, input.nextStep);
  }

  if (input.nextStep.stepType !== 'working') {
    return buildNoRecommendation(input, 'unsupported_step_type', '当前步骤不生成下一组负重建议。', ['unsupported_step_type']);
  }

  return buildWorkingRecommendation(input, input.nextStep);
};
