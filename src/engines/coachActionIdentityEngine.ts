import type { CoachAction } from './coachActionEngine';
import type { ProgramAdjustmentDraft, ProgramAdjustmentHistoryItem, WeeklyActionRecommendation } from '../models/training-model';

type FingerprintAction = Pick<
  CoachAction,
  'source' | 'actionType' | 'targetType' | 'targetId' | 'title' | 'description' | 'reason'
>;

export type CoachActionFingerprintContext = {
  sourceTemplateId?: string;
  suggestedChange?: WeeklyActionRecommendation['suggestedChange'];
  suggestedChangeType?: string;
  muscleId?: string;
  exerciseId?: string;
  templateId?: string;
  weekId?: string;
  cycleId?: string;
};

const normalizePart = (value: unknown) =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9._:-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'none';

const normalizeText = (value: unknown) =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

const stableHash = (value: string) => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
};

const suggestedChangeType = (change?: WeeklyActionRecommendation['suggestedChange'], fallback?: string) => {
  if (fallback) return fallback;
  if (!change) return 'none';
  const setsDelta = Number(change.setsDelta || 0);
  if (setsDelta > 0) return 'add_sets';
  if (setsDelta < 0) return 'remove_sets';
  if (change.removeExerciseIds?.length) return 'swap_exercise';
  if (change.supportDoseAdjustment) return `support_${change.supportDoseAdjustment}`;
  return 'keep';
};

const targetTypeFromContext = (action: FingerprintAction, context: CoachActionFingerprintContext) => {
  if (context.muscleId) return 'muscle';
  if (context.exerciseId) return 'exercise';
  if (context.templateId) return 'template';
  return action.targetType || 'none';
};

const targetIdFromContext = (action: FingerprintAction, context: CoachActionFingerprintContext) =>
  context.muscleId ||
  context.exerciseId ||
  context.templateId ||
  action.targetId ||
  context.suggestedChange?.muscleId ||
  context.suggestedChange?.exerciseIds?.[0] ||
  'target-none';

export function buildCoachActionFingerprint(
  action: FingerprintAction,
  context: CoachActionFingerprintContext = {},
): string {
  const textSummary = normalizeText(action.reason || action.description || action.title);
  const textDigest = stableHash(textSummary).slice(0, 10);
  const change = context.suggestedChange;
  return [
    'coach-action',
    action.source,
    action.actionType,
    targetTypeFromContext(action, context),
    targetIdFromContext(action, context),
    context.sourceTemplateId || 'template-unknown',
    suggestedChangeType(change, context.suggestedChangeType),
    change?.muscleId || context.muscleId || 'muscle-none',
    change?.exerciseIds?.join(',') || context.exerciseId || 'exercise-none',
    context.weekId || context.cycleId || 'current-cycle',
    textDigest,
  ].map(normalizePart).join('|');
}

const firstChange = (draft: Pick<ProgramAdjustmentDraft, 'changes'> | Pick<ProgramAdjustmentHistoryItem, 'changes'>) =>
  (draft.changes || [])[0];

const sourceFromRecommendationId = (value?: string) => {
  const normalized = normalizeText(value);
  if (normalized.includes('volume')) return 'volumeAdaptation' as const;
  if (normalized.includes('plateau')) return 'plateau' as const;
  if (normalized.includes('recovery')) return 'recovery' as const;
  return 'volumeAdaptation' as const;
};

const targetFromChange = (change?: ReturnType<typeof firstChange>) => {
  if (change?.muscleId) return { targetType: 'muscle' as const, targetId: change.muscleId };
  if (change?.exerciseId) return { targetType: 'exercise' as const, targetId: change.exerciseId };
  if (change?.dayTemplateId) return { targetType: 'template' as const, targetId: change.dayTemplateId };
  return { targetType: 'plan' as const, targetId: 'plan' };
};

export function buildProgramAdjustmentDraftFingerprint(draft: ProgramAdjustmentDraft): string {
  if (draft.sourceFingerprint) return draft.sourceFingerprint;
  const change = firstChange(draft);
  const target = targetFromChange(change);
  return buildCoachActionFingerprint(
    {
      source: sourceFromRecommendationId(draft.sourceRecommendationId || draft.selectedRecommendationIds?.[0]),
      actionType: 'create_plan_adjustment_preview',
      targetType: target.targetType,
      targetId: target.targetId,
      title: draft.title,
      description: draft.summary,
      reason: draft.explanation || change?.reason || draft.summary,
    },
    {
      sourceTemplateId: draft.sourceTemplateId || draft.sourceProgramTemplateId,
      suggestedChangeType: change?.type,
      muscleId: change?.muscleId,
      exerciseId: change?.exerciseId,
      templateId: change?.dayTemplateId,
    },
  );
}

export function buildProgramAdjustmentHistoryFingerprint(item: ProgramAdjustmentHistoryItem): string {
  if (item.sourceFingerprint) return item.sourceFingerprint;
  const change = firstChange(item);
  const target = targetFromChange(change);
  return buildCoachActionFingerprint(
    {
      source: sourceFromRecommendationId(item.selectedRecommendationIds?.[0]),
      actionType: 'create_plan_adjustment_preview',
      targetType: target.targetType,
      targetId: target.targetId,
      title: item.mainChangeSummary || item.experimentalProgramTemplateName || '计划调整',
      description: item.explanation || item.mainChangeSummary || '计划调整',
      reason: item.explanation || change?.reason || item.mainChangeSummary || '计划调整',
    },
    {
      sourceTemplateId: item.sourceProgramTemplateId,
      suggestedChangeType: change?.type,
      muscleId: change?.muscleId,
      exerciseId: change?.exerciseId,
      templateId: change?.dayTemplateId,
    },
  );
}

const draftStatusRank = (draft: ProgramAdjustmentDraft) => {
  if (draft.status === 'applied') return 50;
  if (draft.status === 'ready_to_apply' || draft.status === 'previewed' || draft.status === 'draft_created' || draft.status === 'draft') return 40;
  if (draft.status === 'rolled_back') return 30;
  if (draft.status === 'dismissed') return 20;
  if (draft.status === 'expired' || draft.status === 'stale') return 10;
  return 0;
};

const draftTime = (draft: ProgramAdjustmentDraft) => draft.appliedAt || draft.createdAt || '';

export function dedupeProgramAdjustmentDraftsByFingerprint(drafts: ProgramAdjustmentDraft[]): ProgramAdjustmentDraft[] {
  const byFingerprint = new Map<string, ProgramAdjustmentDraft>();
  drafts.forEach((draft) => {
    if (draft.status === 'recommendation') return;
    const fingerprint = buildProgramAdjustmentDraftFingerprint(draft);
    const existing = byFingerprint.get(fingerprint);
    if (!existing) {
      byFingerprint.set(fingerprint, draft);
      return;
    }
    const rankDiff = draftStatusRank(draft) - draftStatusRank(existing);
    if (rankDiff > 0 || (rankDiff === 0 && draftTime(draft).localeCompare(draftTime(existing)) > 0)) {
      byFingerprint.set(fingerprint, draft);
    }
  });
  return [...byFingerprint.values()].sort((left, right) => draftTime(right).localeCompare(draftTime(left)));
}
