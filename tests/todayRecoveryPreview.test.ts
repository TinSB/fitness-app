import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { buildRecoveryAwareRecommendation } from '../src/engines/recoveryAwareScheduler';
import { buildWeeklyPrescription } from '../src/engines/supportPlanEngine';
import { TodayView } from '../src/features/TodayView';
import { getTemplate, makeAppData, templates } from './fixtures';

const noop = (..._args: unknown[]) => undefined;

const visibleText = (node: React.ReactElement) =>
  renderToStaticMarkup(node)
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const renderToday = () => {
  const data = makeAppData({
    selectedTemplateId: 'legs-a',
    todayStatus: { sleep: '好', energy: '中', time: '60', soreness: ['背'] },
  });
  const recoveryRecommendation = buildRecoveryAwareRecommendation({
    preferredTemplate: getTemplate('legs-a'),
    templates,
    sorenessAreas: ['背部'],
  });

  return visibleText(
    React.createElement(TodayView, {
      data,
      selectedTemplate: getTemplate('legs-a'),
      suggestedTemplate: getTemplate('legs-a'),
      weeklyPrescription: buildWeeklyPrescription(data),
      recoveryRecommendation,
      trainingMode: 'hybrid',
      onModeChange: noop,
      onStatusChange: noop,
      onSorenessToggle: noop,
      onTemplateSelect: noop,
      onUseSuggestion: noop,
      onStart: noop,
      onResume: noop,
    }),
  );
};

describe('Today recovery preview', () => {
  it('marks Romanian deadlift as a recommended substitution for back soreness plus Legs A', () => {
    const text = renderToday();

    expect(text).toContain('腿 A（保守版）');
    expect(text).toMatch(/罗马尼亚硬拉[\s\S]*建议替代/);
  });

  it('marks leg press as keepable for back soreness plus Legs A', () => {
    const text = renderToday();

    expect(text).toMatch(/腿举[\s\S]*可保留/);
  });

  it('does not expose raw recovery enums or metadata in the preview', () => {
    const text = renderToday();

    expect(text).not.toMatch(/\b(modified_train|active_recovery|reduce_volume|reduce_intensity|substitute|skip|high|moderate|low|none|undefined|null)\b/);
    expect(text).not.toMatch(/muscleContribution|fatigueCost|skillDemand/);
  });
});
