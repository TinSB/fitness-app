import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { CoachAction } from '../src/engines/coachActionEngine';
import { filterVisibleCoachActions } from '../src/engines/coachActionDismissEngine';
import { buildWeeklyPrescription } from '../src/engines/supportPlanEngine';
import { TodayView } from '../src/features/TodayView';
import type { ProgramAdjustmentDraft } from '../src/models/training-model';
import { getTemplate, makeAppData } from './fixtures';

const noop = (..._args: unknown[]) => undefined;

const action: CoachAction = {
  id: 'volume-preview-back-increase',
  title: '生成训练量调整草案',
  description: '背部训练量偏低，可以生成下周调整草案。',
  source: 'volumeAdaptation',
  actionType: 'create_plan_adjustment_preview',
  priority: 'medium',
  status: 'pending',
  requiresConfirmation: true,
  reversible: true,
  createdAt: '2026-04-30T12:00:00.000Z',
  targetId: 'back',
  targetType: 'muscle',
  reason: '背部有效组低于目标。',
};

const appliedDraft: ProgramAdjustmentDraft = {
  id: 'draft-applied',
  createdAt: '2026-04-30T12:10:00.000Z',
  status: 'applied',
  sourceProgramTemplateId: 'pull-a',
  sourceCoachActionId: action.id,
  sourceRecommendationId: `coach-action-${action.id}`,
  sourceFingerprint: 'coach-action|create-plan-adjustment-preview|volume-adaptation|muscle|back|pull-a',
  experimentalProgramTemplateId: 'pull-a-experiment-1',
  appliedAt: '2026-04-30T12:20:00.000Z',
  title: '拉 A 下周实验调整',
  summary: '背部训练量调整草案。',
  selectedRecommendationIds: [`coach-action-${action.id}`, action.id],
  changes: [
    {
      id: 'change-back',
      type: 'add_sets',
      dayTemplateId: 'pull-a',
      exerciseId: 'lat-pulldown',
      muscleId: 'back',
      setsDelta: 1,
      reason: '背部有效组低于目标。',
    },
  ],
  confidence: 'medium',
  riskLevel: 'low',
  notes: [],
};

const visibleText = (node: React.ReactElement) =>
  renderToStaticMarkup(node)
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

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

describe('Today applied CoachAction filtering', () => {
  it('does not show an already applied plan adjustment action on Today', () => {
    const visible = filterVisibleCoachActions([action], [appliedDraft], [], [], '2026-04-30');
    const text = renderToday(visible);

    expect(visible).toEqual([]);
    expect(text).not.toContain('生成训练量调整草案');
    expect(text).not.toContain('生成调整草案');
  });

  it('keeps the pending action visible before a matching draft exists', () => {
    const visible = filterVisibleCoachActions([action], [], [], [], '2026-04-30');
    const text = renderToday(visible);

    expect(visible.map((item) => item.id)).toEqual([action.id]);
    expect(text).toContain('生成训练量调整草案');
  });

  it('does not output raw enum, undefined, or null after filtering', () => {
    const text = renderToday(filterVisibleCoachActions([action], [appliedDraft], [], [], '2026-04-30'));

    expect(text).not.toMatch(/\b(undefined|null|create_plan_adjustment_preview|volumeAdaptation|pending|applied|high|medium|low)\b/);
  });
});
