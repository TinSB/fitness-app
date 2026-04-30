import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { buildWeeklyPrescription } from '../src/engines/supportPlanEngine';
import { PlanView } from '../src/features/PlanView';
import { getTemplate, makeAppData } from './fixtures';

const noop = (..._args: unknown[]) => undefined;

const visibleText = (node: React.ReactElement) =>
  renderToStaticMarkup(node)
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const makeSingleDayData = () => {
  const base = makeAppData();
  const push = getTemplate('push-a');
  const day = base.programTemplate.dayTemplates.find((item) => item.id === 'push-a');
  return makeAppData({
    templates: [push],
    selectedTemplateId: 'push-a',
    activeProgramTemplateId: 'push-a',
    programTemplate: {
      ...base.programTemplate,
      daysPerWeek: 1,
      dayTemplates: day ? [day] : base.programTemplate.dayTemplates.slice(0, 1),
    },
  });
};

describe('PlanView weekly schedule structure', () => {
  it('renders the merged weekly schedule cards with name, duration, and exercise count', () => {
    const data = makeSingleDayData();
    const text = visibleText(
      React.createElement(PlanView, {
        data,
        weeklyPrescription: buildWeeklyPrescription(data),
        coachActions: [],
        selectedTemplateId: data.selectedTemplateId,
        onSelectTemplate: noop,
        onStartTemplate: noop,
        onUpdateExercise: noop,
        onResetTemplates: noop,
      }),
    );

    expect(text).toContain('本周安排');
    expect(text).not.toContain('本周训练日');
    expect(text).not.toContain('训练日模板');
    expect(text).toContain('推 A');
    expect(text).toContain('预计 70 分钟');
    expect(text).toContain('6 个动作');
    expect(text).toContain('查看详情');
  });

  it('shows only the first four primary exercises before opening details', () => {
    const data = makeSingleDayData();
    const text = visibleText(
      React.createElement(PlanView, {
        data,
        weeklyPrescription: buildWeeklyPrescription(data),
        coachActions: [],
        selectedTemplateId: data.selectedTemplateId,
        onSelectTemplate: noop,
        onStartTemplate: noop,
        onUpdateExercise: noop,
        onResetTemplates: noop,
      }),
    );

    expect(text).toContain('平板卧推');
    expect(text).toContain('上斜哑铃卧推');
    expect(text).toContain('器械推胸');
    expect(text).toContain('绳索夹胸');
    expect(text).not.toContain('哑铃侧平举');
    expect(text).not.toContain('绳索下压');
    expect(text).not.toMatch(/\b(undefined|null|hybrid|hypertrophy|compound|isolation|machine)\b/);
  });
});
