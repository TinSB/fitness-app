import { describe, expect, it } from 'vitest';
import type { CoachAction } from '../src/engines/coachActionEngine';
import {
  dismissCoachActionToday,
  filterDismissedCoachActions,
  type DismissedCoachAction,
} from '../src/engines/coachActionDismissEngine';

const makeAction = (id: string, status: CoachAction['status'] = 'pending'): CoachAction => ({
  id,
  title: '教练建议',
  description: '查看建议详情后再决定是否处理。',
  source: 'volumeAdaptation',
  actionType: 'review_volume',
  priority: 'medium',
  status,
  requiresConfirmation: false,
  reversible: false,
  createdAt: '2026-04-30T09:00:00.000Z',
  reason: '训练记录提示需要复查。',
});

describe('coachActionDismissEngine', () => {
  it('filters a dismissed action for the same day', () => {
    const actions = [makeAction('action-a'), makeAction('action-b')];
    const dismissed = [dismissCoachActionToday('action-a', '2026-04-30T10:00:00.000Z')];

    const visible = filterDismissedCoachActions(actions, dismissed, '2026-04-30');

    expect(visible.map((action) => action.id)).toEqual(['action-b']);
  });

  it('shows the same action again on the next day', () => {
    const actions = [makeAction('action-a')];
    const dismissed = [dismissCoachActionToday('action-a', '2026-04-30T10:00:00.000Z')];

    const visible = filterDismissedCoachActions(actions, dismissed, '2026-05-01');

    expect(visible.map((action) => action.id)).toEqual(['action-a']);
  });

  it('does not delete or mutate the original action list', () => {
    const actions = [makeAction('action-a'), makeAction('action-b')];
    const before = JSON.stringify(actions);
    const dismissed = [dismissCoachActionToday('action-a', '2026-04-30T10:00:00.000Z')];

    filterDismissedCoachActions(actions, dismissed, '2026-04-30');

    expect(JSON.stringify(actions)).toBe(before);
    expect(actions).toHaveLength(2);
  });

  it('only filters the dismissed action when multiple actions exist', () => {
    const actions = [makeAction('action-a'), makeAction('action-b'), makeAction('action-c')];
    const dismissed = [dismissCoachActionToday('action-b', '2026-04-30T10:00:00.000Z')];

    const visible = filterDismissedCoachActions(actions, dismissed, '2026-04-30T18:00:00.000Z');

    expect(visible.map((action) => action.id)).toEqual(['action-a', 'action-c']);
  });

  it('keeps the list unchanged when there are no dismissed actions', () => {
    const actions = [makeAction('action-a'), makeAction('action-b')];

    const visible = filterDismissedCoachActions(actions, [], '2026-04-30');

    expect(visible).toEqual(actions);
  });

  it('keeps non-pending actions out of the visible pending list', () => {
    const actions = [
      makeAction('pending-action', 'pending'),
      makeAction('applied-action', 'applied'),
      makeAction('dismissed-action', 'dismissed'),
      makeAction('expired-action', 'expired'),
      makeAction('failed-action', 'failed'),
    ];

    const visible = filterDismissedCoachActions(actions, [], '2026-04-30');

    expect(visible.map((action) => action.id)).toEqual(['pending-action']);
  });

  it('returns a scoped dismiss record without raw display text fields', () => {
    const dismissed: DismissedCoachAction = dismissCoachActionToday('action-a', '2026-04-30T10:00:00.000Z');

    expect(dismissed).toEqual({
      actionId: 'action-a',
      dismissedAt: '2026-04-30T10:00:00.000Z',
      scope: 'today',
    });
    expect(JSON.stringify(dismissed)).not.toMatch(/undefined|null/);
  });
});
