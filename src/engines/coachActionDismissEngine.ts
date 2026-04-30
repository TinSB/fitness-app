import type { CoachAction } from './coachActionEngine';
import type { ProgramAdjustmentDraft, ProgramAdjustmentHistoryItem } from '../models/training-model';
import {
  buildCoachActionFingerprint,
} from './coachActionIdentityEngine';
import {
  buildPlanAdjustmentFingerprintFromDraft,
  buildPlanAdjustmentFingerprintFromHistory,
} from './planAdjustmentIdentityEngine';

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
const resolvedDraftStatuses = new Set(['applied', 'dismissed', 'expired', 'stale']);

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
  sourceFingerprint = action.sourceFingerprint || buildCoachActionFingerprint(action, { sourceTemplateId: draft.sourceProgramTemplateId }),
) => {
  if (draft.status === 'recommendation') return false;
  const recommendationId = coachRecommendationId(action);
  const draftFingerprint = buildPlanAdjustmentFingerprintFromDraft(draft);
  return (
    draft.sourceCoachActionId === action.id ||
    Boolean(draftFingerprint && draftFingerprint === sourceFingerprint) ||
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
  sourceFingerprint = action.sourceFingerprint || buildCoachActionFingerprint(action, { sourceTemplateId: historyItem.sourceProgramTemplateId }),
) => {
  const recommendationId = coachRecommendationId(action);
  const historyFingerprint = buildPlanAdjustmentFingerprintFromHistory(historyItem);
  return (
    historyItem.sourceCoachActionId === action.id ||
    Boolean(historyFingerprint && historyFingerprint === sourceFingerprint) ||
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
): { draft?: ProgramAdjustmentDraft; historyItem?: ProgramAdjustmentHistoryItem; state?: 'draft_ready' | 'applied' | 'rolled_back' | 'dismissed' | 'expired' } | null {
  const matchingDrafts = drafts.filter((draft) => draftMatchesCoachAction(action, draft, sourceFingerprint));
  const activeDraft = matchingDrafts.find((draft) => activeDraftStatuses.has(String(draft.status)));
  if (activeDraft) return { draft: activeDraft, state: 'draft_ready' };
  const appliedDraft = matchingDrafts.find((draft) => draft.status === 'applied');
  if (appliedDraft) return { draft: appliedDraft, state: 'applied' };
  const dismissedDraft = matchingDrafts.find((draft) => draft.status === 'dismissed');
  if (dismissedDraft) return { draft: dismissedDraft, state: 'dismissed' };
  const expiredDraft = matchingDrafts.find((draft) => draft.status === 'expired' || draft.status === 'stale');
  if (expiredDraft) return { draft: expiredDraft, state: 'expired' };
  const rolledBackDraft = matchingDrafts.find((draft) => draft.status === 'rolled_back');
  if (rolledBackDraft) {
    const hasBlockingDraft = matchingDrafts.some((draft) => resolvedDraftStatuses.has(String(draft.status)) || activeDraftStatuses.has(String(draft.status)));
    if (!hasBlockingDraft) return { draft: rolledBackDraft, state: 'rolled_back' };
  }

  const matchingHistories = adjustmentHistory.filter((item) => historyMatchesCoachAction(action, item, sourceFingerprint));
  const matchingHistory = matchingHistories.find((item) => item.status !== 'rolled_back' && !item.rolledBackAt);
  if (matchingHistory) {
    return {
      historyItem: matchingHistory,
      state: 'applied',
    };
  }
  const rolledBackHistory = matchingHistories.find((item) => item.status === 'rolled_back' || item.rolledBackAt);
  if (rolledBackHistory) return { historyItem: rolledBackHistory, state: 'rolled_back' };

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
    (action) => {
      const existing = findExistingAdjustmentForCoachAction(action, drafts, adjustmentHistory);
      return !existing || existing.state === 'rolled_back';
    },
  );
}

export const filterResolvedCoachActions = filterVisibleCoachActions;
export const filterResolvedPlanActions = filterVisibleCoachActions;
