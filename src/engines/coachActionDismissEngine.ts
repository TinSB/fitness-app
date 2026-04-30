import { buildCoachActionSourceFingerprint, type CoachAction } from './coachActionEngine';
import type { ProgramAdjustmentDraft, ProgramAdjustmentHistoryItem } from '../models/training-model';

export type DismissedCoachAction = {
  actionId: string;
  dismissedAt: string;
  scope: 'today';
};

const dateKey = (value: string) => {
  const directMatch = value.match(/^\d{4}-\d{2}-\d{2}/);
  if (directMatch) return directMatch[0];
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
};

export function dismissCoachActionToday(actionId: string, now: string): DismissedCoachAction {
  return {
    actionId,
    dismissedAt: now,
    scope: 'today',
  };
}

export function filterDismissedCoachActions(
  actions: CoachAction[],
  dismissedActions: DismissedCoachAction[],
  currentDate: string,
): CoachAction[] {
  const today = dateKey(currentDate);
  const dismissedToday = new Set(
    dismissedActions
      .filter((item) => item.scope === 'today' && dateKey(item.dismissedAt) === today)
      .map((item) => item.actionId),
  );

  return actions.filter((action) => action.status === 'pending' && !dismissedToday.has(action.id));
}

const activeDraftStatuses = new Set(['draft_created', 'ready_to_apply', 'draft', 'previewed']);
const ignoredDraftStatuses = new Set(['dismissed', 'expired', 'stale']);

const coachRecommendationId = (action: CoachAction) => `coach-action-${action.id}`;

const draftChangeMatchesAction = (action: CoachAction, draft: ProgramAdjustmentDraft) => {
  if (!action.targetId || !action.targetType) return false;
  return (draft.changes || []).some((change) => {
    if (action.targetType === 'muscle') return change.muscleId === action.targetId;
    if (action.targetType === 'exercise') return change.exerciseId === action.targetId || change.replacementExerciseId === action.targetId;
    if (action.targetType === 'template') return change.dayTemplateId === action.targetId || draft.sourceProgramTemplateId === action.targetId;
    return false;
  });
};

const historyChangeMatchesAction = (action: CoachAction, historyItem: ProgramAdjustmentHistoryItem) => {
  if (!action.targetId || !action.targetType) return false;
  return (historyItem.changes || []).some((change) => {
    if (action.targetType === 'muscle') return change.muscleId === action.targetId;
    if (action.targetType === 'exercise') return change.exerciseId === action.targetId || change.replacementExerciseId === action.targetId;
    if (action.targetType === 'template') return change.dayTemplateId === action.targetId || historyItem.sourceProgramTemplateId === action.targetId;
    return false;
  });
};

export const draftMatchesCoachAction = (
  action: CoachAction,
  draft: ProgramAdjustmentDraft,
  sourceFingerprint = buildCoachActionSourceFingerprint(action, { sourceTemplateId: draft.sourceProgramTemplateId }),
) => {
  if (ignoredDraftStatuses.has(String(draft.status))) return false;
  const recommendationId = coachRecommendationId(action);
  return (
    draft.sourceCoachActionId === action.id ||
    Boolean(draft.sourceFingerprint && draft.sourceFingerprint === sourceFingerprint) ||
    draft.sourceRecommendationId === action.id ||
    draft.sourceRecommendationId === recommendationId ||
    (draft.selectedRecommendationIds || []).includes(action.id) ||
    (draft.selectedRecommendationIds || []).includes(recommendationId) ||
    (action.actionType === 'create_plan_adjustment_preview' && draftChangeMatchesAction(action, draft))
  );
};

export const historyMatchesCoachAction = (
  action: CoachAction,
  historyItem: ProgramAdjustmentHistoryItem,
  sourceFingerprint = buildCoachActionSourceFingerprint(action, { sourceTemplateId: historyItem.sourceProgramTemplateId }),
) => {
  const recommendationId = coachRecommendationId(action);
  return (
    historyItem.sourceCoachActionId === action.id ||
    Boolean(historyItem.sourceFingerprint && historyItem.sourceFingerprint === sourceFingerprint) ||
    (historyItem.selectedRecommendationIds || []).includes(action.id) ||
    (historyItem.selectedRecommendationIds || []).includes(recommendationId) ||
    (action.actionType === 'create_plan_adjustment_preview' && historyChangeMatchesAction(action, historyItem))
  );
};

export function findExistingAdjustmentForCoachAction(
  action: CoachAction,
  drafts: ProgramAdjustmentDraft[] = [],
  adjustmentHistory: ProgramAdjustmentHistoryItem[] = [],
  sourceFingerprint?: string,
): { draft?: ProgramAdjustmentDraft; historyItem?: ProgramAdjustmentHistoryItem; state?: 'draft_ready' | 'applied' | 'rolled_back' } | null {
  const matchingDraft = drafts.find((draft) => draftMatchesCoachAction(action, draft, sourceFingerprint));
  if (matchingDraft) {
    if (activeDraftStatuses.has(String(matchingDraft.status))) return { draft: matchingDraft, state: 'draft_ready' };
    if (matchingDraft.status === 'applied') return { draft: matchingDraft, state: 'applied' };
    if (matchingDraft.status === 'rolled_back') return { draft: matchingDraft, state: 'rolled_back' };
  }

  const matchingHistory = adjustmentHistory.find((item) => historyMatchesCoachAction(action, item, sourceFingerprint));
  if (matchingHistory) {
    return {
      historyItem: matchingHistory,
      state: matchingHistory.status === 'rolled_back' || matchingHistory.rolledBackAt ? 'rolled_back' : 'applied',
    };
  }

  return null;
}

export function filterVisibleCoachActions(
  actions: CoachAction[],
  drafts: ProgramAdjustmentDraft[] = [],
  adjustmentHistory: ProgramAdjustmentHistoryItem[] = [],
  dismissedActions: DismissedCoachAction[] = [],
  currentDate: string,
): CoachAction[] {
  return filterDismissedCoachActions(actions, dismissedActions, currentDate).filter(
    (action) => !findExistingAdjustmentForCoachAction(action, drafts, adjustmentHistory),
  );
}
