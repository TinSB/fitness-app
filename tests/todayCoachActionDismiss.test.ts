import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { CoachAction } from '../src/engines/coachActionEngine';
import { dismissCoachActionToday, filterDismissedCoachActions } from '../src/engines/coachActionDismissEngine';
import { buildWeeklyPrescription } from '../src/engines/supportPlanEngine';
import { TodayView } from '../src/features/TodayView';
import { getTemplate, makeAppData } from './fixtures';

const noop = (..._args: unknown[]) => undefined;

const visibleText = (node: React.ReactElement) =>
  renderToStaticMarkup(node)
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const makeAction = (id = 'today-action'): CoachAction => ({
  id,
  title: '查看今日教练建议',
  description: '这条建议用于确认今天是否需要调整训练安排。',
  source: 'dailyAdjustment',
  actionType: 'apply_temporary_session_adjustment',
  priority: 'medium',
  status: 'pending',
  requiresConfirmation: true,
  reversible: true,
  createdAt: '2026-04-30T09:00:00.000Z',
  reason: '今天的状态提示训练可以更保守。',
});

const renderToday = (coachActions: CoachAction[]) => {
  const data = makeAppData();
  return visibleText(
    React.createElement(TodayView, {
      data,
      selectedTemplate: getTemplate('push-a'),
      suggestedTemplate: getTemplate('pull-a'),
      weeklyPrescription: buildWeeklyPrescription(data),
      coachActions,
      trainingMode: 'hybrid',
      onModeChange: noop,
      onStatusChange: noop,
      onSorenessToggle: noop,
      onTemplateSelect: noop,
      onUseSuggestion: noop,
      onStart: noop,
      onResume: noop,
      onCoachAction: noop,
      onDismissCoachAction: noop,
    }),
  );
};

describe('today coach action dismiss', () => {
  it('wires Today CoachAction dismiss through the shared App handler', () => {
    const todaySource = readFileSync('src/features/TodayView.tsx', 'utf8');
    const appSource = readFileSync('src/App.tsx', 'utf8');

    expect(todaySource).toContain('onDismiss={onDismissCoachAction}');
    expect(appSource).toContain('const handleDismissCoachAction = (actionId: string)');
    expect(appSource).toContain('handleDismissCoachAction(action.id)');
    expect(appSource).toContain('已暂不处理，今天不再提醒。');
  });

  it('hides the dismissed action from Today and shows an empty pending state', () => {
    const action = makeAction();
    const visibleActions = filterDismissedCoachActions(
      [action],
      [dismissCoachActionToday(action.id, '2026-04-30')],
      '2026-04-30',
    );

    const text = renderToday(visibleActions);

    expect(text).toContain('暂无待处理建议');
    expect(text).not.toContain('查看今日教练建议');
  });

  it('lets the action appear again on the next day', () => {
    const action = makeAction();
    const visibleActions = filterDismissedCoachActions(
      [action],
      [dismissCoachActionToday(action.id, '2026-04-30')],
      '2026-05-01',
    );

    const text = renderToday(visibleActions);

    expect(text).toContain('查看今日教练建议');
    expect(text).toContain('暂不处理');
  });

  it('does not render raw enum, undefined, or null in the Today dismiss state', () => {
    const text = renderToday([]);

    expect(text).not.toMatch(/\b(undefined|null|dailyAdjustment|apply_temporary_session_adjustment|pending|high|medium|low)\b/);
  });
});
