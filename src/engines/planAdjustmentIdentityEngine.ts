import type { CoachAction, CoachActionSource, CoachActionType } from './coachActionEngine';
import {
  buildCoachActionFingerprint,
  buildProgramAdjustmentDraftFingerprint,
  buildProgramAdjustmentHistoryFingerprint,
  dedupeProgramAdjustmentDraftsByFingerprint,
  type CoachActionFingerprintContext,
} from './coachActionIdentityEngine';
import type {
  AdjustmentChange,
  ProgramAdjustmentDraft,
  ProgramAdjustmentHistoryItem,
  WeeklyActionRecommendation,
} from '../models/training-model';

export type PlanAdjustmentFingerprintInput = {
  sourceCoachActionId?: string;
  actionType?: CoachActionType | string;
  source?: CoachActionSource | string;
  sourceTemplateId?: string;
  sourceProgramTemplateId?: string;
  targetTemplateId?: string;
  targetDayTemplateId?: string;
  targetExerciseId?: string;
  targetMuscleId?: string;
  suggestedChangeType?: string;
  suggestedChange?: WeeklyActionRecommendation['suggestedChange'];
  weekId?: string;
  cycleId?: string;
  changeSummary?: string;
  reason?: string;
  title?: string;
  description?: string;
};

const targetFromInput = (input: PlanAdjustmentFingerprintInput) => {
  if (input.targetMuscleId || input.suggestedChange?.muscleId) {
    return { targetType: 'muscle' as const, targetId: input.targetMuscleId || input.suggestedChange?.muscleId };
  }
  if (input.targetExerciseId || input.suggestedChange?.exerciseIds?.[0]) {
    return { targetType: 'exercise' as const, targetId: input.targetExerciseId || input.suggestedChange?.exerciseIds?.[0] };
  }
  if (input.targetDayTemplateId || input.targetTemplateId) {
    return { targetType: 'template' as const, targetId: input.targetDayTemplateId || input.targetTemplateId };
  }
  return { targetType: 'plan' as const, targetId: input.sourceTemplateId || input.sourceProgramTemplateId || 'plan' };
};

const sourceFromInput = (input: PlanAdjustmentFingerprintInput): CoachActionSource => {
  if (input.source === 'plateau') return 'plateau';
  if (input.source === 'recovery') return 'recovery';
  if (input.source === 'dataHealth') return 'dataHealth';
  if (input.source === 'dailyAdjustment') return 'dailyAdjustment';
  return 'volumeAdaptation';
};

export function buildPlanAdjustmentFingerprint(input: PlanAdjustmentFingerprintInput): string {
  const target = targetFromInput(input);
  const action = {
    source: sourceFromInput(input),
    actionType: (input.actionType || 'create_plan_adjustment_preview') as CoachActionType,
    targetType: target.targetType,
    targetId: target.targetId,
    title: input.title || input.changeSummary || '计划调整',
    description: input.description || input.changeSummary || input.reason || '计划调整',
    reason: input.reason || input.changeSummary || input.description || '计划调整',
  };
  const context: CoachActionFingerprintContext = {
    sourceTemplateId: input.sourceTemplateId || input.sourceProgramTemplateId,
    suggestedChange: input.suggestedChange,
    suggestedChangeType: input.suggestedChangeType,
    muscleId: input.targetMuscleId,
    exerciseId: input.targetExerciseId,
    templateId: input.targetDayTemplateId || input.targetTemplateId,
    weekId: input.weekId,
    cycleId: input.cycleId,
  };
  return buildCoachActionFingerprint(action, context);
}

export const buildPlanAdjustmentFingerprintFromCoachAction = (
  action: CoachAction,
  context: CoachActionFingerprintContext = {},
) => action.sourceFingerprint || buildCoachActionFingerprint(action, context);

export const buildPlanAdjustmentFingerprintFromDraft = (draft: ProgramAdjustmentDraft) =>
  buildProgramAdjustmentDraftFingerprint(draft);

export const buildPlanAdjustmentFingerprintFromHistory = (item: ProgramAdjustmentHistoryItem) =>
  buildProgramAdjustmentHistoryFingerprint(item);

export const dedupePlanAdjustmentDraftsByFingerprint = dedupeProgramAdjustmentDraftsByFingerprint;

export const buildPlanAdjustmentFingerprintFromChange = (
  change: AdjustmentChange,
  input: Pick<PlanAdjustmentFingerprintInput, 'source' | 'sourceCoachActionId' | 'sourceTemplateId' | 'sourceProgramTemplateId' | 'weekId' | 'cycleId'> = {},
) =>
  buildPlanAdjustmentFingerprint({
    ...input,
    actionType: 'create_plan_adjustment_preview',
    targetMuscleId: change.muscleId,
    targetExerciseId: change.exerciseId,
    targetDayTemplateId: change.dayTemplateId,
    suggestedChangeType: change.type,
    changeSummary: change.reason || change.previewNote,
  });
