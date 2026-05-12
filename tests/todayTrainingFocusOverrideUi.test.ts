import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { buildWeeklyPrescription } from '../src/engines/supportPlanEngine';
import { buildTodayTrainingFocusSelection } from '../src/engines/todayTrainingFocusOverrideEngine';
import { TodayView } from '../src/features/TodayView';
import { getTemplate, makeAppData, makeStatus, templates } from './fixtures';

const noop = (..._args: unknown[]) => undefined;

const visibleText = (node: React.ReactElement) =>
  renderToStaticMarkup(node)
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

describe('today training focus override UI', () => {
  it('shows the original system recommendation while displaying a chest override', () => {
    const data = makeAppData({
      selectedTemplateId: 'legs-a',
      todayStatus: makeStatus({ soreness: ['胸'], date: '2026-05-12' }),
    });
    const selection = buildTodayTrainingFocusSelection({
      systemTemplate: getTemplate('legs-a'),
      templates,
      override: 'chest',
      todayStatus: data.todayStatus,
    });

    const text = visibleText(
      React.createElement(TodayView, {
        data,
        selectedTemplate: selection.selectedTemplate,
        suggestedTemplate: selection.systemTemplate,
        todayFocusSelection: selection,
        weeklyPrescription: buildWeeklyPrescription(data),
        trainingMode: 'hybrid',
        onModeChange: noop,
        onStatusChange: noop,
        onSorenessToggle: noop,
        onFocusOverrideChange: noop,
        onTemplateSelect: noop,
        onUseSuggestion: noop,
        onStart: noop,
        onResume: noop,
      }),
    );

    expect(text).toContain('今天想练');
    expect(text).toContain('原计划：腿 A');
    expect(text).toContain('已切换为：胸 · 推 A');
    expect(text).toContain('手动目标');
    expect(text).toContain('平板卧推');
    expect(text).toContain('可能影响恢复');
    expect(text).toContain('恢复信号有冲突');
  });

  it('renders every override choice and the system recommendation return path', () => {
    const data = makeAppData({ todayStatus: makeStatus({ date: '2026-05-12' }) });
    const selection = buildTodayTrainingFocusSelection({
      systemTemplate: getTemplate('pull-a'),
      templates,
      override: 'system',
      todayStatus: data.todayStatus,
    });

    const text = visibleText(
      React.createElement(TodayView, {
        data,
        selectedTemplate: selection.selectedTemplate,
        suggestedTemplate: selection.systemTemplate,
        todayFocusSelection: selection,
        weeklyPrescription: buildWeeklyPrescription(data),
        trainingMode: 'hybrid',
        onModeChange: noop,
        onStatusChange: noop,
        onSorenessToggle: noop,
        onFocusOverrideChange: noop,
        onTemplateSelect: noop,
        onUseSuggestion: noop,
        onStart: noop,
        onResume: noop,
      }),
    );

    expect(text).toContain('系统推荐');
    expect(text).toContain('胸');
    expect(text).toContain('背');
    expect(text).toContain('腿');
    expect(text).toContain('肩');
    expect(text).toContain('手臂');
    expect(text).toContain('核心');
    expect(text).toContain('全身');
    expect(text).toContain('恢复 / 活动度');
  });
});
