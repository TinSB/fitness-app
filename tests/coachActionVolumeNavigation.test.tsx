import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { buildWeeklyPrescription } from '../src/engines/supportPlanEngine';
import type { TrainingIntelligenceSummary } from '../src/engines/trainingIntelligenceSummaryEngine';
import { PlanView } from '../src/features/PlanView';
import { makeAppData } from './fixtures';

const noop = (..._args: unknown[]) => undefined;

const visibleText = (markup: string) =>
  markup
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const makeSummary = (): TrainingIntelligenceSummary => ({
  keyInsights: [],
  recommendedActions: [],
  volumeAdaptation: {
    summary: '背部训练量建议复查。',
    muscles: [
      {
        muscleId: 'back',
        decision: 'increase',
        setsDelta: 1,
        title: '背部：增加训练量',
        reason: '背部有效组低于目标，但完成度稳定。',
        confidence: 'medium',
        suggestedActions: ['下周只增加 1 组。', '优先放在拉 A。'],
      },
    ],
  },
});

describe('coach action volume navigation', () => {
  it('opens the volume adaptation section with the target muscle expanded and highlighted', () => {
    const data = makeAppData();
    const markup = renderToStaticMarkup(
      <PlanView
        data={data}
        weeklyPrescription={buildWeeklyPrescription(data)}
        trainingIntelligenceSummary={makeSummary()}
        coachActions={[]}
        target={{ section: 'volume_adaptation', muscleId: 'back', highlight: true, version: 1 }}
        selectedTemplateId={data.selectedTemplateId}
        onSelectTemplate={noop}
        onStartTemplate={noop}
        onUpdateExercise={noop}
        onResetTemplates={noop}
      />,
    );
    const text = visibleText(markup);

    expect(text).toContain('背部：增加训练量');
    expect(text).toContain('下周只增加 1 组');
    expect(markup).toContain('ring-2 ring-emerald-200');
    expect(markup).toContain('<details');
    expect(markup).toContain('open=""');
  });

  it('highlights a generated adjustment draft target without applying the plan', () => {
    const data = makeAppData({
      programAdjustmentDrafts: [
        {
          id: 'draft-from-action',
          createdAt: '2026-04-29T12:00:00.000Z',
          status: 'previewed',
          sourceProgramTemplateId: 'pull-a',
          title: '拉 A 下周实验调整',
          summary: '已生成调整草案，应用前请确认。',
          selectedRecommendationIds: ['coach-action-volume-preview-back-increase'],
          changes: [
            {
              id: 'change-1',
              type: 'add_sets',
              dayTemplateId: 'pull-a',
              dayTemplateName: '拉 A',
              exerciseId: 'lat-pulldown',
              exerciseName: '高位下拉',
              muscleId: 'back',
              setsDelta: 1,
              reason: '背部有效组低于目标。',
            },
          ],
          confidence: 'medium',
          notes: [],
        },
      ],
    });
    const markup = renderToStaticMarkup(
      <PlanView
        data={data}
        weeklyPrescription={buildWeeklyPrescription(data)}
        trainingIntelligenceSummary={makeSummary()}
        coachActions={[]}
        target={{ section: 'adjustment_drafts', draftId: 'draft-from-action', highlight: true, version: 2 }}
        selectedTemplateId={data.selectedTemplateId}
        onSelectTemplate={noop}
        onStartTemplate={noop}
        onUpdateExercise={noop}
        onResetTemplates={noop}
      />,
    );

    expect(visibleText(markup)).toContain('已生成调整草案，应用前请确认。');
    expect(markup).toContain('ring-2 ring-emerald-200');
    expect(data.activeProgramTemplateId).toBeUndefined();
  });
});
