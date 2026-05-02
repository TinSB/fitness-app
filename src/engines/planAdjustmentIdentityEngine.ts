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

const reusableDraftStatuses = new Set(['draft_created', 'ready_to_apply', 'draft', 'previewed']);
const handledDraftStatuses = new Set(['dismissed', 'expired', 'stale']);

const draftTime = (draft: ProgramAdjustmentDraft) => draft.appliedAt || draft.rolledBackAt || draft.createdAt || '';

const newestDraft = (drafts: ProgramAdjustmentDraft[]) =>
  [...drafts].sort((left, right) => draftTime(right).localeCompare(draftTime(left)))[0];

const stableHash = (value: string) => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
};

const stableIdPart = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48) || stableHash(value);

export const buildPlanAdjustmentDraftInstanceId = (
  sourceFingerprint: string,
  revision = 1,
  parentDraftId?: string,
) => {
  const fingerprintPart = stableIdPart(sourceFingerprint);
  const parentPart = parentDraftId ? `-${stableIdPart(parentDraftId).slice(0, 24)}` : '';
  return `adjustment-draft-${fingerprintPart}${parentPart}-r${Math.max(1, Math.round(revision))}`;
};

export type PlanAdjustmentDraftUpsertOutcome =
  | 'created'
  | 'opened_existing'
  | 'already_applied'
  | 'previously_handled';

export type PlanAdjustmentDraftUpsertResult = {
  drafts: ProgramAdjustmentDraft[];
  sourceFingerprint: string;
  targetDraft?: ProgramAdjustmentDraft;
  historyItem?: ProgramAdjustmentHistoryItem;
  outcome: PlanAdjustmentDraftUpsertOutcome;
  createdDraft?: ProgramAdjustmentDraft;
};

const draftFingerprintEquals = (draft: ProgramAdjustmentDraft, sourceFingerprint: string) =>
  (draft.sourceFingerprint || buildPlanAdjustmentFingerprintFromDraft(draft)) === sourceFingerprint;

const historyFingerprintEquals = (item: ProgramAdjustmentHistoryItem, sourceFingerprint: string) =>
  (item.sourceFingerprint || buildPlanAdjustmentFingerprintFromHistory(item)) === sourceFingerprint;

const normalizeDraftForUpsert = (
  draft: ProgramAdjustmentDraft,
  sourceFingerprint: string,
  drafts: ProgramAdjustmentDraft[],
): ProgramAdjustmentDraft => {
  const sameSourceDrafts = drafts.filter((item) => draftFingerprintEquals(item, sourceFingerprint));
  const revision =
    draft.draftRevision ||
    Math.max(0, ...sameSourceDrafts.map((item) => item.draftRevision || 1)) + 1;
  return {
    ...draft,
    id: buildPlanAdjustmentDraftInstanceId(sourceFingerprint, revision, draft.parentDraftId),
    draftRevision: revision,
    sourceFingerprint,
  };
};

export function upsertPlanAdjustmentDraftByFingerprint(
  drafts: ProgramAdjustmentDraft[] = [],
  adjustmentHistory: ProgramAdjustmentHistoryItem[] = [],
  candidateDraft: ProgramAdjustmentDraft,
  sourceFingerprint = candidateDraft.sourceFingerprint || buildPlanAdjustmentFingerprintFromDraft(candidateDraft),
): PlanAdjustmentDraftUpsertResult {
  const matchingDrafts = drafts.filter((draft) => draftFingerprintEquals(draft, sourceFingerprint));

  if (candidateDraft.parentDraftId) {
    const existingChild = newestDraft(
      matchingDrafts.filter(
        (draft) =>
          draft.parentDraftId === candidateDraft.parentDraftId &&
          reusableDraftStatuses.has(String(draft.status)),
      ),
    );
    if (existingChild) {
      return {
        drafts: [...drafts],
        sourceFingerprint,
        targetDraft: existingChild,
        outcome: 'opened_existing',
      };
    }
  }

  const activeDraft = newestDraft(matchingDrafts.filter((draft) => reusableDraftStatuses.has(String(draft.status))));
  if (activeDraft) {
    return {
      drafts: [...drafts],
      sourceFingerprint,
      targetDraft: activeDraft,
      outcome: 'opened_existing',
    };
  }

  const appliedDraft = newestDraft(matchingDrafts.filter((draft) => draft.status === 'applied'));
  if (appliedDraft) {
    return {
      drafts: [...drafts],
      sourceFingerprint,
      targetDraft: appliedDraft,
      outcome: 'already_applied',
    };
  }

  const appliedHistory = adjustmentHistory.find(
    (item) => historyFingerprintEquals(item, sourceFingerprint) && item.status !== 'rolled_back' && !item.rolledBackAt,
  );
  if (appliedHistory) {
    return {
      drafts: [...drafts],
      sourceFingerprint,
      historyItem: appliedHistory,
      outcome: 'already_applied',
    };
  }

  const handledDraft = newestDraft(matchingDrafts.filter((draft) => handledDraftStatuses.has(String(draft.status))));
  if (handledDraft) {
    return {
      drafts: [...drafts],
      sourceFingerprint,
      targetDraft: handledDraft,
      outcome: 'previously_handled',
    };
  }

  if (!candidateDraft.parentDraftId) {
    const rolledBackDraft = newestDraft(matchingDrafts.filter((draft) => draft.status === 'rolled_back'));
    if (rolledBackDraft) {
      return {
        drafts: [...drafts],
        sourceFingerprint,
        targetDraft: rolledBackDraft,
        outcome: 'previously_handled',
      };
    }
  }

  const draft = normalizeDraftForUpsert(candidateDraft, sourceFingerprint, drafts);
  return {
    drafts: [draft, ...drafts.filter((item) => item.id !== draft.id)],
    sourceFingerprint,
    targetDraft: draft,
    outcome: 'created',
    createdDraft: draft,
  };
}

export const findReusablePlanAdjustmentDraft = (
  sourceDraft: ProgramAdjustmentDraft,
  drafts: ProgramAdjustmentDraft[] = [],
) => {
  const sourceFingerprint = sourceDraft.sourceFingerprint || buildPlanAdjustmentFingerprintFromDraft(sourceDraft);
  return newestDraft(drafts.filter((item) => {
    if (item.id === sourceDraft.id) return false;
    const itemFingerprint = item.sourceFingerprint || buildPlanAdjustmentFingerprintFromDraft(item);
    if (itemFingerprint !== sourceFingerprint || !reusableDraftStatuses.has(String(item.status))) return false;
    return sourceDraft.status !== 'rolled_back' || !sourceDraft.id || item.parentDraftId === sourceDraft.id;
  }));
};

export const buildRegeneratedPlanAdjustmentDraft = (
  sourceDraft: ProgramAdjustmentDraft,
  drafts: ProgramAdjustmentDraft[] = [],
  options: { now?: string; draftId?: string } = {},
): { sourceFingerprint: string; existingDraft?: ProgramAdjustmentDraft; draft?: ProgramAdjustmentDraft } => {
  const sourceFingerprint = sourceDraft.sourceFingerprint || buildPlanAdjustmentFingerprintFromDraft(sourceDraft);
  const existingDraft = findReusablePlanAdjustmentDraft(sourceDraft, drafts);
  if (existingDraft) {
    return { sourceFingerprint, existingDraft };
  }

  const sameSourceDrafts = drafts.filter(
    (item) => (item.sourceFingerprint || buildPlanAdjustmentFingerprintFromDraft(item)) === sourceFingerprint,
  );
  const nextRevision = Math.max(1, ...sameSourceDrafts.map((item) => item.draftRevision || 1)) + 1;
  const now = options.now || new Date().toISOString();
  const nextDraft: ProgramAdjustmentDraft = {
    ...sourceDraft,
    id: options.draftId || `adjustment-draft-${sourceDraft.id}-r${nextRevision}`,
    parentDraftId: sourceDraft.id,
    draftRevision: nextRevision,
    createdAt: now,
    status: 'ready_to_apply',
    sourceFingerprint,
    appliedAt: undefined,
    rolledBackAt: undefined,
    experimentalProgramTemplateId: undefined,
  };

  return { sourceFingerprint, draft: nextDraft };
};

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
