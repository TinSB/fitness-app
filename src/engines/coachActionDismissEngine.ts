import type { CoachAction } from './coachActionEngine';

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
