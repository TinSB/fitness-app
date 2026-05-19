import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { buildWeeklyPrescription } from '../src/engines/supportPlanEngine';
import { TodayView } from '../src/features/TodayView';
import { TodayDecisionHero } from '../src/uiOs/today/TodayDecisionHero';
import { ActionButton } from '../src/uiOs/primitives/ActionButton';
import { buildTodayDecisionSurface } from '../src/engines/todayDecisionSurface';
import { getTemplate, makeAppData, makeStatus } from './fixtures';

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');
const noop = (..._args: unknown[]) => undefined;
const text = (html: string) => html.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

const renderToday = () => {
  const data = makeAppData({ todayStatus: makeStatus({ sleep: '好', energy: '高', time: '90' }) });
  return renderToStaticMarkup(
    React.createElement(TodayView, {
      data,
      selectedTemplate: getTemplate(data.selectedTemplateId || 'push-a'),
      suggestedTemplate: getTemplate('pull-a'),
      weeklyPrescription: buildWeeklyPrescription(data),
      trainingMode: 'hybrid',
      onModeChange: noop,
      onStatusChange: noop,
      onSorenessToggle: noop,
      onTemplateSelect: noop,
      onUseSuggestion: noop,
      onStart: noop,
      onResume: noop,
      onReviewDataHealth: noop,
    }),
  );
};

describe('UI-OS R8.4 microcopy deletion', () => {
  it('removes the circled Today microcopy from the rendered primary flow', () => {
    const visible = text(renderToday());

    expect(visible).toContain('今日决策');
    expect(visible).toContain('今天建议');
    expect(visible).toContain('开始今天训练');
    expect(visible).not.toContain('判断今天练不练、练什么，以及从哪里开始');
    expect(visible).not.toContain('状态正常，按计划执行');
    expect(visible).not.toContain('系统推荐 · 只影响今天，不修改长期计划');
    expect(visible).not.toContain('中等优先级；选择只影响今天，不修改长期计划');
    expect(visible).not.toContain('用于判断今天能不能练');
  });

  it('keeps recommendation details collapsed and omits normal hero explanation', () => {
    const decision = buildTodayDecisionSurface({ recommendedFocus: '腿 A', sourceOfTruthClear: true });
    const hero = renderToStaticMarkup(
      React.createElement(TodayDecisionHero, {
        decision,
        primaryAction: React.createElement(ActionButton, null, '开始今天训练'),
      }),
    );
    const todaySource = read('src/features/TodayView.tsx');

    expect(decision.heroExplanation).toBe('');
    expect(hero).not.toContain('状态正常，按计划执行');
    expect(todaySource).toContain('data-today-secondary-details="collapsed"');
    expect(todaySource).toContain('为什么这样推荐？');
    expect(todaySource).not.toContain('<details open');
  });
});
