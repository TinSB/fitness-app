import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { CoachAction } from '../src/engines/coachActionEngine';
import { dismissCoachActionToday, filterDismissedCoachActions } from '../src/engines/coachActionDismissEngine';
import { buildWeeklyPrescription } from '../src/engines/supportPlanEngine';
import { PlanView } from '../src/features/PlanView';
import { makeAppData } from './fixtures';

const noop = (..._args: unknown[]) => undefined;

const visibleText = (node: React.ReactElement) =>
  renderToStaticMarkup(node)
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const makeAction = (id = 'plan-action'): CoachAction => ({
  id,
  title: '训练量建议',
  description: '背部训练量低于目标，可查看下周调整建议。',
  source: 'volumeAdaptation',
  actionType: 'review_volume',
  priority: 'medium',
  status: 'pending',
  requiresConfirmation: false,
  reversible: false,
  createdAt: '2026-04-30T09:00:00.000Z',
  targetId: 'back',
  targetType: 'muscle',
  reason: '背部近期有效组偏少。',
});

const renderPlan = (coachActions: CoachAction[]) => {
  const data = makeAppData();
  return visibleText(
    React.createElement(PlanView, {
      data,
      weeklyPrescription: buildWeeklyPrescription(data),
      coachActions,
      selectedTemplateId: data.selectedTemplateId,
      onSelectTemplate: noop,
      onStartTemplate: noop,
      onUpdateExercise: noop,
      onResetTemplates: noop,
      onCoachAction: noop,
      onDismissCoachAction: noop,
    }),
  );
};

describe('plan coach action dismiss', () => {
  it('wires Plan CoachAction dismiss through the same handler prop', () => {
    const planSource = readFileSync('src/features/PlanView.tsx', 'utf8');
    const appSource = readFileSync('src/App.tsx', 'utf8');

    expect(planSource).toContain('onDismissCoachAction?.(action.action)');
    expect(appSource).toContain('const dismissCoachAction = (action: CoachAction)');
    expect(appSource).toContain('handleDismissCoachAction(action.id)');
  });

  it('hides the dismissed action from Plan and shows the empty advice state', () => {
    const action = makeAction();
    const visibleActions = filterDismissedCoachActions(
      [action],
      [dismissCoachActionToday(action.id, '2026-04-30')],
      '2026-04-30',
    );

    const text = renderPlan(visibleActions);

    expect(text).toContain('暂无待处理建议');
    expect(text).not.toContain('背部训练量低于目标');
  });

  it('lets the Plan action appear again on the next day', () => {
    const action = makeAction();
    const visibleActions = filterDismissedCoachActions(
      [action],
      [dismissCoachActionToday(action.id, '2026-04-30')],
      '2026-05-01',
    );

    const text = renderPlan(visibleActions);

    expect(text).toContain('训练量建议');
    expect(text).toContain('暂不处理');
  });

  it('keeps Plan visible text free of raw enum, undefined, or null after filtering', () => {
    const text = renderPlan([]);

    expect(text).not.toMatch(/\b(undefined|null|volumeAdaptation|review_volume|pending|high|medium|low)\b/);
  });
});
