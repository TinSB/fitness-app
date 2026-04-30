import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { CoachAction } from '../src/engines/coachActionEngine';
import { buildWeeklyPrescription } from '../src/engines/supportPlanEngine';
import type { VolumeAdaptationReport } from '../src/engines/volumeAdaptationEngine';
import { PlanView } from '../src/features/PlanView';
import type { ProgramAdjustmentHistoryItem, TrainingTemplate } from '../src/models/training-model';
import { buildPlanViewModel } from '../src/presenters/planPresenter';
import { getTemplate, makeAppData, templates } from './fixtures';

const noop = (..._args: unknown[]) => undefined;
const now = '2026-04-29T12:00:00.000Z';

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

const visibleText = (html: string) =>
  html
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const renderPlanHtml = (
  extra: {
    coachActions?: CoachAction[];
    volumeAdaptation?: VolumeAdaptationReport;
    templates?: TrainingTemplate[];
    activeProgramTemplateId?: string;
    selectedTemplateId?: string;
    programAdjustmentHistory?: ProgramAdjustmentHistoryItem[];
  } = {},
) => {
  const data = makeAppData({
    templates: extra.templates || templates,
    activeProgramTemplateId: extra.activeProgramTemplateId,
    selectedTemplateId: extra.selectedTemplateId || 'pull-a',
    programAdjustmentHistory: extra.programAdjustmentHistory || [],
  });
  return renderToStaticMarkup(
    React.createElement(PlanView, {
      data,
      weeklyPrescription: buildWeeklyPrescription(data),
      trainingIntelligenceSummary: extra.volumeAdaptation ? { volumeAdaptation: extra.volumeAdaptation, keyInsights: [], recommendedActions: [] } : undefined,
      coachActions: extra.coachActions || [],
      selectedTemplateId: extra.selectedTemplateId || data.selectedTemplateId,
      onSelectTemplate: noop,
      onStartTemplate: noop,
      onUpdateExercise: noop,
      onResetTemplates: noop,
    }),
  );
};

const extractSideSummary = (html: string) => html.match(/<aside[^>]*aria-label="计划侧栏摘要"[^>]*>([\s\S]*?)<\/aside>/)?.[1] || '';

describe('Plan side summary', () => {
  it('keeps the desktop side rail as a summary instead of a second suggestion list', () => {
    const html = renderPlanHtml({
      volumeAdaptation: volumeReport,
      coachActions: [
        makeAction({ id: 'plateau-bench', source: 'plateau', actionType: 'review_exercise', title: '查看卧推进展', targetId: 'bench-press', targetType: 'exercise' }),
        makeAction({ id: 'plateau-row', source: 'plateau', actionType: 'review_exercise', title: '查看划船进展', targetId: 'barbell-row', targetType: 'exercise' }),
      ],
    });
    const side = visibleText(extractSideSummary(html));

    expect(side).toContain('计划摘要');
    expect(side).toContain('当前计划状态');
    expect(side).toContain('待处理建议');
    expect(side).toContain('最近计划提醒');
    expect(side).toContain('查看建议');
    expect(side).toContain('查看草案');
    expect(side).not.toContain('查看肌群详情');
    expect(side).not.toContain('查看全部建议');
    expect(side).not.toContain('背：增加训练量');
    expect(side).not.toContain('腿：增加训练量');
    expect(side).not.toContain('胸：增加训练量');
  });

  it('shows the de-duplicated pending action count in the side summary', () => {
    const vm = buildPlanViewModel(makeAppData(), {
      volumeAdaptation: volumeReport,
      coachActions: [
        makeAction({ id: 'plateau-bench', source: 'plateau', actionType: 'review_exercise', priority: 'low', targetId: 'bench-press', targetType: 'exercise' }),
        makeAction({ id: 'plateau-row', source: 'plateau', actionType: 'review_exercise', priority: 'low', targetId: 'barbell-row', targetType: 'exercise' }),
      ],
    });

    expect(vm.sideSummary.pendingActionCount).toBe(2);
    expect(vm.sideSummary.latestReminder).toBe('训练量建议');
  });

  it('shows the current experimental template status when one is active', () => {
    const sourceTemplate = getTemplate('pull-a');
    const experimentalTemplate: TrainingTemplate = {
      ...sourceTemplate,
      id: 'pull-a-experiment-side',
      name: '拉 A 实验版',
      isExperimentalTemplate: true,
      sourceTemplateId: 'pull-a',
      sourceTemplateName: '拉 A',
      appliedAt: now,
      adjustmentSummary: '高位下拉增加 1 组',
    };
    const html = renderPlanHtml({
      templates: [...templates, experimentalTemplate],
      activeProgramTemplateId: 'pull-a-experiment-side',
      selectedTemplateId: 'pull-a-experiment-side',
      programAdjustmentHistory: [
        {
          id: 'history-1',
          appliedAt: now,
          sourceProgramTemplateId: 'pull-a',
          experimentalProgramTemplateId: 'pull-a-experiment-side',
          sourceProgramTemplateName: '拉 A',
          experimentalProgramTemplateName: '拉 A 实验版',
          mainChangeSummary: '高位下拉增加 1 组',
          selectedRecommendationIds: ['coach-action-volume-preview-back-increase'],
          changes: [],
          status: 'applied',
          rollbackAvailable: true,
        },
      ],
    });
    const side = visibleText(extractSideSummary(html));

    expect(side).toContain('当前实验模板状态');
    expect(side).toContain('当前使用实验模板，来源：拉 A');
  });

  it('wires side-summary buttons to the main advice and draft sections', () => {
    const source = readFileSync('src/features/PlanView.tsx', 'utf8');

    expect(source).toContain('scrollToPlanSection(adjustmentSectionRef)');
    expect(source).toContain('scrollToPlanSection(draftSectionRef)');
  });

  it('keeps the side summary desktop-only and free of raw visible tokens', () => {
    const html = renderPlanHtml({ volumeAdaptation: volumeReport });
    const sideMarkup = extractSideSummary(html);
    const side = visibleText(sideMarkup);

    expect(html).toContain('hidden space-y-3 xl:block');
    expect(side).not.toMatch(/\b(undefined|null|review_volume|create_plan_adjustment_preview|increase|medium|low|high)\b/);
  });
});
