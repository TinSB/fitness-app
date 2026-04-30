import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { CoachAction } from '../src/engines/coachActionEngine';
import { buildWeeklyPrescription } from '../src/engines/supportPlanEngine';
import type { VolumeAdaptationReport } from '../src/engines/volumeAdaptationEngine';
import { PlanView } from '../src/features/PlanView';
import type { ProgramAdjustmentDraft } from '../src/models/training-model';
import { buildPlanViewModel } from '../src/presenters/planPresenter';
import { makeAppData } from './fixtures';

const noop = (..._args: unknown[]) => undefined;
const planViewSource = readFileSync('src/features/PlanView.tsx', 'utf8');

const makeAction = (overrides: Partial<CoachAction> = {}): CoachAction => ({
  id: overrides.id || 'coach-action',
  title: overrides.title || '查看计划建议',
  description: overrides.description || '查看计划建议，不会自动修改计划。',
  source: overrides.source || 'volumeAdaptation',
  actionType: overrides.actionType || 'review_volume',
  priority: overrides.priority || 'medium',
  status: overrides.status || 'pending',
  requiresConfirmation: overrides.requiresConfirmation ?? false,
  reversible: overrides.reversible ?? false,
  createdAt: overrides.createdAt || '2026-04-30T12:00:00.000Z',
  targetId: overrides.targetId,
  targetType: overrides.targetType,
  reason: overrides.reason || '根据近期训练记录生成。',
});

const volumeReport: VolumeAdaptationReport = {
  summary: '背、腿、胸建议小幅增加。',
  muscles: [
    {
      muscleId: 'back',
      decision: 'increase',
      setsDelta: 2,
      title: '背：增加训练量',
      reason: '背部有效组低于目标。',
      confidence: 'medium',
      suggestedActions: ['下周增加 2 组。'],
    },
    {
      muscleId: 'legs',
      decision: 'increase',
      setsDelta: 1,
      title: '腿：增加训练量',
      reason: '腿部有效组低于目标。',
      confidence: 'medium',
      suggestedActions: ['下周增加 1 组。'],
    },
    {
      muscleId: 'chest',
      decision: 'increase',
      setsDelta: 2,
      title: '胸：增加训练量',
      reason: '胸部有效组低于目标。',
      confidence: 'medium',
      suggestedActions: ['下周增加 2 组。'],
    },
  ],
};

const makeDraft = (): ProgramAdjustmentDraft => ({
  id: 'draft-back',
  createdAt: '2026-04-30T12:00:00.000Z',
  status: 'ready_to_apply',
  sourceProgramTemplateId: 'program-hypertrophy-support',
  sourceTemplateId: 'pull-a',
  sourceRecommendationId: 'volume-preview-back',
  experimentalTemplateName: '拉 A 实验版',
  title: '背部训练量调整草案',
  summary: '背部近期有效组不足，应用前需要确认。',
  selectedRecommendationIds: ['volume-preview-back'],
  changes: [
    {
      id: 'change-back',
      type: 'add_sets',
      dayTemplateId: 'pull-a',
      dayTemplateName: '拉 A',
      exerciseId: 'lat-pulldown',
      exerciseName: '高位下拉',
      muscleId: 'back',
      setsDelta: 1,
      reason: '背部近期有效组不足，且完成率良好。',
    },
  ],
  confidence: 'medium',
  riskLevel: 'low',
  explanation: '增加 1 组，建议观察一周。',
  notes: [],
});

const visibleText = (node: React.ReactElement) =>
  renderToStaticMarkup(node)
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const countText = (text: string, token: string) => text.split(token).length - 1;

const renderPlan = (coachActions: CoachAction[], volumeAdaptation: VolumeAdaptationReport | null = null) => {
  const data = makeAppData();
  return visibleText(
    React.createElement(PlanView, {
      data,
      weeklyPrescription: buildWeeklyPrescription(data),
      trainingIntelligenceSummary: volumeAdaptation
        ? { volumeAdaptation, keyInsights: [], recommendedActions: [] }
        : undefined,
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

describe('Plan advice rendering gate', () => {
  it('keeps PlanView on aggregated inbox items instead of raw suggestion lists', () => {
    expect(planViewSource).toContain('inbox.visibleItems.map');
    expect(planViewSource).toContain('inbox.hiddenItems.map');
    expect(planViewSource).not.toContain('coachActions.map');
    expect(planViewSource).not.toContain('volumeAdaptation.muscles.map');
    expect(planViewSource).not.toContain('weeklyRecommendations.map');
  });

  it('groups multiple muscle volume suggestions into one visible advice item', () => {
    const vm = buildPlanViewModel(makeAppData(), {
      volumeAdaptation: volumeReport,
      coachActions: [
        makeAction({
          id: 'volume-preview-back',
          actionType: 'create_plan_adjustment_preview',
          targetId: 'back',
          targetType: 'muscle',
          requiresConfirmation: true,
          reversible: true,
        }),
        makeAction({ id: 'volume-preview-legs', actionType: 'create_plan_adjustment_preview', targetId: 'legs', targetType: 'muscle' }),
        makeAction({ id: 'volume-preview-chest', actionType: 'create_plan_adjustment_preview', targetId: 'chest', targetType: 'muscle' }),
      ],
    });

    expect(vm.coachInbox.visibleItems).toHaveLength(1);
    expect(vm.coachInbox.visibleItems[0].title).toBe('训练量建议');
    expect(vm.coachInbox.visibleItems[0].detailItems?.map((item) => item.label)).toEqual(['背', '腿', '胸']);
  });

  it('hard-caps default visible advice at two and folds the rest', () => {
    const vm = buildPlanViewModel(makeAppData(), {
      volumeAdaptation: volumeReport,
      coachActions: [
        makeAction({ id: 'volume-preview-back', actionType: 'create_plan_adjustment_preview', targetId: 'back', targetType: 'muscle', requiresConfirmation: true }),
        makeAction({ id: 'plateau-bench', source: 'plateau', actionType: 'review_exercise', targetId: 'bench-press', targetType: 'exercise' }),
        makeAction({ id: 'recovery-upper', source: 'recovery', actionType: 'keep_observing', targetId: 'upper-a', targetType: 'template' }),
        makeAction({ id: 'template-upper', source: 'nextWorkout', actionType: 'open_next_workout', targetId: 'upper-a', targetType: 'template' }),
      ],
    });

    expect(vm.coachInbox.visibleItems).toHaveLength(2);
    expect(vm.coachInbox.visibleCount).toBe(2);
    expect(vm.coachInbox.hiddenItems.length).toBeGreaterThan(0);
    expect(vm.coachInbox.hiddenCount).toBe(vm.coachInbox.hiddenItems.length);
  });

  it('moves matching generated draft recommendations out of the inbox', () => {
    const vm = buildPlanViewModel(
      makeAppData({ programAdjustmentDrafts: [makeDraft()] }),
      {
        coachActions: [
          makeAction({
            id: 'volume-preview-back',
            actionType: 'create_plan_adjustment_preview',
            targetId: 'back',
            targetType: 'muscle',
            requiresConfirmation: true,
            reversible: true,
          }),
        ],
      },
    );

    expect(vm.coachInbox.visibleItems).toHaveLength(0);
    expect(vm.adjustmentDrafts.drafts).toHaveLength(1);
    expect(vm.adjustmentDrafts.drafts[0].title).toBe('背部训练量调整草案');
  });

  it('does not repeat primary advice phrases in the default Plan page', () => {
    const text = renderPlan(
      [
        makeAction({
          id: 'volume-preview-back',
          actionType: 'create_plan_adjustment_preview',
          targetId: 'back',
          targetType: 'muscle',
          requiresConfirmation: true,
          reversible: true,
        }),
        makeAction({ id: 'volume-preview-legs', actionType: 'create_plan_adjustment_preview', targetId: 'legs', targetType: 'muscle' }),
        makeAction({ id: 'volume-preview-chest', actionType: 'create_plan_adjustment_preview', targetId: 'chest', targetType: 'muscle' }),
      ],
      volumeReport,
    );

    expect(countText(text, '增加训练量')).toBeLessThanOrEqual(1);
    expect(countText(text, '生成调整草案')).toBeLessThanOrEqual(1);
    expect(countText(text, '查看训练量建议')).toBeLessThanOrEqual(1);
    expect(text).not.toMatch(/\b(undefined|null|volumeAdaptation|review_volume|create_plan_adjustment_preview|increase|pending|medium|low|high)\b/);
  });
});
