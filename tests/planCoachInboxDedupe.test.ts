import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { CoachAction } from '../src/engines/coachActionEngine';
import { buildWeeklyPrescription } from '../src/engines/supportPlanEngine';
import type { VolumeAdaptationReport } from '../src/engines/volumeAdaptationEngine';
import { PlanView } from '../src/features/PlanView';
import { buildPlanViewModel } from '../src/presenters/planPresenter';
import { makeAppData } from './fixtures';

const noop = (..._args: unknown[]) => undefined;
const now = '2026-04-29T12:00:00.000Z';

const makeAction = (overrides: Partial<CoachAction> = {}): CoachAction => ({
  id: overrides.id || 'action',
  title: overrides.title || '查看建议',
  description: overrides.description || '查看计划建议，不会自动修改计划。',
  source: overrides.source || 'volumeAdaptation',
  actionType: overrides.actionType || 'review_volume',
  priority: overrides.priority || 'medium',
  status: overrides.status || 'pending',
  requiresConfirmation: overrides.requiresConfirmation ?? false,
  reversible: overrides.reversible ?? false,
  createdAt: overrides.createdAt || now,
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
      setsDelta: 1,
      title: '背：增加训练量',
      reason: '背部有效组低于目标。',
      confidence: 'medium',
      suggestedActions: ['下周增加 1 组。'],
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
      setsDelta: 1,
      title: '胸：增加训练量',
      reason: '胸部有效组低于目标。',
      confidence: 'medium',
      suggestedActions: ['下周增加 1 组。'],
    },
  ],
};

const visibleText = (node: React.ReactElement) =>
  renderToStaticMarkup(node)
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

describe('Plan coach inbox dedupe', () => {
  it('merges multiple muscle increase suggestions into one volume item', () => {
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
        makeAction({ id: 'volume-review-back', actionType: 'review_volume', targetId: 'back', targetType: 'muscle' }),
      ],
    });

    expect(vm.coachInbox.visibleActions[0].title).toBe('训练量建议：背、腿、胸低于目标');
    expect(vm.coachInbox.visibleActions[0].detailItems).toHaveLength(3);
    expect(vm.coachInbox.summary).toBe('系统发现 3 条计划相关建议，其中 1 条需要确认。');
  });

  it('shows at most two priority suggestions by default and folds the rest', () => {
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
        makeAction({ id: 'plateau-bench', source: 'plateau', actionType: 'review_exercise', title: '查看卧推进展', targetId: 'bench-press', targetType: 'exercise' }),
        makeAction({ id: 'plateau-row', source: 'plateau', actionType: 'review_exercise', title: '查看划船进展', targetId: 'barbell-row', targetType: 'exercise' }),
      ],
    });

    expect(vm.coachInbox.visibleActions).toHaveLength(2);
    expect(vm.coachInbox.hiddenCount).toBe(1);
    expect(vm.coachInbox.hiddenActions).toHaveLength(1);
  });

  it('uses secondary buttons for view-only actions and primary for draft generation', () => {
    const viewOnly = buildPlanViewModel(makeAppData(), {
      coachActions: [makeAction({ id: 'review-volume', actionType: 'review_volume', targetId: 'back', targetType: 'muscle' })],
    });
    const executable = buildPlanViewModel(makeAppData(), {
      coachActions: [
        makeAction({
          id: 'exercise-preview',
          source: 'plateau',
          actionType: 'create_plan_adjustment_preview',
          targetId: 'bench-press',
          targetType: 'exercise',
          requiresConfirmation: true,
          reversible: true,
        }),
      ],
    });

    expect(viewOnly.coachInbox.visibleActions[0].primaryVariant).toBe('secondary');
    expect(executable.coachInbox.visibleActions[0].primaryVariant).toBe('primary');
  });

  it('renders one compact pending-advice area instead of repeated volume cards', () => {
    const data = makeAppData();
    const text = visibleText(
      React.createElement(PlanView, {
        data,
        weeklyPrescription: buildWeeklyPrescription(data),
        trainingIntelligenceSummary: { volumeAdaptation: volumeReport, keyInsights: [], recommendedActions: [] },
        coachActions: [
          makeAction({ id: 'plateau-bench', source: 'plateau', actionType: 'review_exercise', title: '查看卧推进展', targetId: 'bench-press', targetType: 'exercise' }),
          makeAction({ id: 'plateau-row', source: 'plateau', actionType: 'review_exercise', title: '查看划船进展', targetId: 'barbell-row', targetType: 'exercise' }),
        ],
        selectedTemplateId: data.selectedTemplateId,
        onSelectTemplate: noop,
        onStartTemplate: noop,
        onUpdateExercise: noop,
        onResetTemplates: noop,
      }),
    );

    expect(text).toContain('待处理建议');
    expect(text).toContain('训练量建议：背、腿、胸低于目标');
    expect(text).toContain('查看全部建议');
    expect(text).not.toContain('计划相关教练建议');
    expect(text).not.toContain('背：增加训练量');
    expect(text).not.toContain('腿：增加训练量');
    expect(text).not.toContain('胸：增加训练量');
    expect(text).not.toMatch(/\b(undefined|null|review_volume|create_plan_adjustment_preview|increase|medium|low|high)\b/);
  });
});
