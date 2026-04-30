import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DEFAULT_PROGRAM_TEMPLATE, DEFAULT_SCREENING_PROFILE } from '../src/data/trainingData';
import { createAdjustmentDraftFromRecommendations } from '../src/engines/programAdjustmentEngine';
import { buildWeeklyPrescription } from '../src/engines/supportPlanEngine';
import { PlanView } from '../src/features/PlanView';
import type { WeeklyActionRecommendation } from '../src/models/training-model';
import { getTemplate, makeAppData, templates } from './fixtures';

const noop = (..._args: unknown[]) => undefined;

const visibleText = (node: React.ReactElement) =>
  renderToStaticMarkup(node)
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const makeRecommendation = (): WeeklyActionRecommendation => ({
  id: 'coach-action-volume-preview-back-increase',
  priority: 'medium',
  category: 'volume',
  targetType: 'muscle',
  targetId: 'back',
  targetLabel: '背部',
  issue: '背部训练量不足',
  recommendation: '下周给背部小幅增加 1 组。',
  reason: '背部近期有效组不足，且完成率良好。',
  suggestedChange: {
    muscleId: 'back',
    setsDelta: 1,
    exerciseIds: ['lat-pulldown'],
  },
  confidence: 'medium',
});

const makeDataWithDraft = () => {
  const sourceTemplate = getTemplate('pull-a');
  const draft = createAdjustmentDraftFromRecommendations([makeRecommendation()], sourceTemplate, {
    programTemplate: DEFAULT_PROGRAM_TEMPLATE,
    templates,
    screeningProfile: DEFAULT_SCREENING_PROFILE,
    painPatterns: [],
  });
  return makeAppData({ programAdjustmentDrafts: [draft] });
};

describe('PlanView adjustment draft UI', () => {
  it('shows a dedicated adjustment draft area with real apply and rollback workflow labels', () => {
    const data = makeDataWithDraft();
    const text = visibleText(
      <PlanView
        data={data}
        weeklyPrescription={buildWeeklyPrescription(data)}
        coachActions={[]}
        selectedTemplateId={data.selectedTemplateId}
        onSelectTemplate={noop}
        onStartTemplate={noop}
        onUpdateExercise={noop}
        onResetTemplates={noop}
        onApplyProgramAdjustmentDraft={noop}
        onDismissProgramAdjustmentDraft={noop}
        onDeleteProgramAdjustmentDraft={noop}
      />,
    );

    expect(text).toContain('调整草案');
    expect(text).toContain('状态：待确认');
    expect(text).toContain('查看差异');
    expect(text).toContain('应用为实验模板');
    expect(text).toContain('暂不采用');
    expect(text).toContain('删除草案');
    expect(text).not.toMatch(/\b(undefined|null|ready_to_apply|previewed|pull-a|lat-pulldown)\b/);
  });

  it('shows applied experimental template state and rollback entry at the top of Plan', () => {
    const sourceTemplate = getTemplate('pull-a');
    const data = makeAppData({
      selectedTemplateId: 'pull-a-experiment-123456',
      activeProgramTemplateId: 'pull-a-experiment-123456',
      templates: [
        ...templates,
        {
          ...sourceTemplate,
          id: 'pull-a-experiment-123456',
          name: '拉 A 实验版',
          isExperimentalTemplate: true,
          sourceTemplateId: 'pull-a',
          sourceTemplateName: '拉 A',
          appliedAt: '2026-04-29T12:00:00.000Z',
          adjustmentSummary: '高位下拉增加 1 组',
        },
      ],
      programAdjustmentHistory: [
        {
          id: 'history-1',
          appliedAt: '2026-04-29T12:00:00.000Z',
          sourceProgramTemplateId: 'pull-a',
          experimentalProgramTemplateId: 'pull-a-experiment-123456',
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
    const text = visibleText(
      <PlanView
        data={data}
        weeklyPrescription={buildWeeklyPrescription(data)}
        coachActions={[]}
        selectedTemplateId="pull-a-experiment-123456"
        onSelectTemplate={noop}
        onStartTemplate={noop}
        onUpdateExercise={noop}
        onResetTemplates={noop}
        onRollbackProgramAdjustment={noop}
      />,
    );

    expect(text).toContain('当前计划：实验模板');
    expect(text).toContain('来源模板：拉 A');
    expect(text).toContain('应用时间：2026-04-29');
    expect(text).toContain('回滚到原模板');
  });
});
