import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { buildWeeklyPrescription } from '../src/engines/supportPlanEngine';
import { PlanView } from '../src/features/PlanView';
import type { ProgramAdjustmentDraft, ProgramAdjustmentHistoryItem, TrainingTemplate } from '../src/models/training-model';
import { getTemplate, makeAppData, templates } from './fixtures';

const noop = (..._args: unknown[]) => undefined;
const now = '2026-04-29T12:00:00.000Z';

const visibleText = (node: React.ReactElement) =>
  renderToStaticMarkup(node)
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const makeDraft = (overrides: Partial<ProgramAdjustmentDraft> = {}): ProgramAdjustmentDraft => ({
  id: 'draft-back-volume',
  createdAt: now,
  status: 'ready_to_apply',
  sourceProgramTemplateId: 'program-hypertrophy-support',
  sourceTemplateId: 'pull-a',
  sourceRecommendationId: 'coach-action-volume-preview-back-increase',
  experimentalProgramTemplateId: undefined,
  experimentalTemplateName: '拉 A 实验版',
  title: '背部训练量调整草案',
  summary: '背部近期有效组不足，应用前需要确认。',
  selectedRecommendationIds: ['coach-action-volume-preview-back-increase'],
  changes: [
    {
      id: 'change-add-lat-pulldown',
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
  diffPreview: {
    title: '背部训练量调整草案',
    summary: '拉 A 小幅增加背部训练量。',
    changes: [
      {
        changeId: 'diff-add-lat-pulldown',
        type: 'add_sets',
        label: '增加组数',
        before: '拉 A：高位下拉 3 组',
        after: '拉 A：高位下拉 4 组',
        reason: '背部近期有效组不足，且完成率良好。',
        riskLevel: 'low',
      },
    ],
  },
  notes: [],
  ...overrides,
});

const makeAppliedHistory = (overrides: Partial<ProgramAdjustmentHistoryItem> = {}): ProgramAdjustmentHistoryItem => ({
  id: 'history-1',
  appliedAt: now,
  sourceProgramTemplateId: 'pull-a',
  experimentalProgramTemplateId: 'pull-a-experiment-draft',
  sourceProgramTemplateName: '拉 A',
  experimentalProgramTemplateName: '拉 A 实验版',
  mainChangeSummary: '高位下拉增加 1 组',
  selectedRecommendationIds: ['coach-action-volume-preview-back-increase'],
  changes: makeDraft().changes,
  status: 'applied',
  rollbackAvailable: true,
  ...overrides,
});

const renderPlan = (
  programAdjustmentDrafts: ProgramAdjustmentDraft[],
  extra: {
    templates?: TrainingTemplate[];
    activeProgramTemplateId?: string;
    selectedTemplateId?: string;
    programAdjustmentHistory?: ProgramAdjustmentHistoryItem[];
    onApplyProgramAdjustmentDraft?: (draft: ProgramAdjustmentDraft) => void;
    onRollbackProgramAdjustment?: (historyItemId: string) => void;
  } = {},
) => {
  const data = makeAppData({
    programAdjustmentDrafts,
    programAdjustmentHistory: extra.programAdjustmentHistory || [],
    templates: extra.templates || templates,
    activeProgramTemplateId: extra.activeProgramTemplateId,
    selectedTemplateId: extra.selectedTemplateId || 'pull-a',
  });

  return visibleText(
    React.createElement(PlanView, {
      data,
      weeklyPrescription: buildWeeklyPrescription(data),
      coachActions: [],
      selectedTemplateId: extra.selectedTemplateId || data.selectedTemplateId,
      onSelectTemplate: noop,
      onStartTemplate: noop,
      onUpdateExercise: noop,
      onResetTemplates: noop,
      onApplyProgramAdjustmentDraft: extra.onApplyProgramAdjustmentDraft || noop,
      onDismissProgramAdjustmentDraft: noop,
      onDeleteProgramAdjustmentDraft: noop,
      onRollbackProgramAdjustment: extra.onRollbackProgramAdjustment || noop,
    }),
  );
};

describe('Plan adjustment draft area', () => {
  it('shows a lightweight empty state when there is no draft', () => {
    const text = renderPlan([]);

    expect(text).toContain('调整草案');
    expect(text).toContain('暂无调整草案');
    expect(text).toContain('生成草案后，你可以在这里查看差异、应用实验模板或暂不采用。');
    expect(text).not.toContain('应用为实验模板');
  });

  it('does not mix recommendation-only items into the draft area', () => {
    const text = renderPlan([makeDraft({ id: 'recommendation-only', status: 'recommendation', title: '计划相关建议，不是真草案' })]);

    expect(text).toContain('暂无调整草案');
    expect(text).not.toContain('计划相关建议，不是真草案');
  });

  it('shows draft card fields with Chinese status and actions', () => {
    const text = renderPlan([makeDraft()]);

    expect(text).toContain('背部训练量调整草案');
    expect(text).toContain('来源建议：教练自动调整建议');
    expect(text).toContain('主要变化');
    expect(text).toContain('风险：低');
    expect(text).toContain('状态：待确认');
    expect(text).toContain('查看差异');
    expect(text).toContain('应用为实验模板');
    expect(text).toContain('暂不采用');
  });

  it('keeps internal ids out of the visible draft and diff summary text', () => {
    const text = renderPlan([makeDraft()]);

    expect(text).not.toMatch(/\b(pull-a|lat-pulldown|coach-action-volume-preview-back-increase|diff-add-lat-pulldown|change-add-lat-pulldown)\b/);
    expect(text).not.toMatch(/\b(undefined|null|ready_to_apply|applied|rolled_back|low|medium|high)\b/);
  });

  it('shows view-template and rollback actions for an applied draft', () => {
    const sourceTemplate = getTemplate('pull-a');
    const experimentalTemplate: TrainingTemplate = {
      ...sourceTemplate,
      id: 'pull-a-experiment-draft',
      name: '拉 A 实验版',
      isExperimentalTemplate: true,
      sourceTemplateId: 'pull-a',
      sourceTemplateName: '拉 A',
      appliedAt: now,
      adjustmentSummary: '高位下拉增加 1 组',
    };
    const text = renderPlan(
      [makeDraft({ status: 'applied', experimentalProgramTemplateId: 'pull-a-experiment-draft' })],
      {
        templates: [...templates, experimentalTemplate],
        activeProgramTemplateId: 'pull-a-experiment-draft',
        selectedTemplateId: 'pull-a-experiment-draft',
        programAdjustmentHistory: [makeAppliedHistory()],
      },
    );

    expect(text).toContain('状态：已应用');
    expect(text).toContain('查看实验模板');
    expect(text).toContain('回滚到原模板');
  });

  it('does not show the apply button for a rolled-back draft', () => {
    const text = renderPlan([makeDraft({ status: 'rolled_back', experimentalProgramTemplateId: 'pull-a-experiment-draft' })]);

    expect(text).toContain('状态：已回滚');
    expect(text).not.toContain('应用为实验模板');
  });

  it('does not apply a draft during render', () => {
    let applied = false;
    renderPlan([makeDraft()], {
      onApplyProgramAdjustmentDraft: () => {
        applied = true;
      },
    });

    expect(applied).toBe(false);
  });
});
