import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { buildTodayTrainingFocusSelection } from '../src/engines/todayTrainingFocusOverrideEngine';
import { TodayFocusOverridePanel } from '../src/uiOs/today/TodayFocusOverridePanel';
import { getTemplate, makeAppData, templates } from './fixtures';

const visibleText = (node: React.ReactElement) =>
  renderToStaticMarkup(node)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

describe('TodayFocusOverridePanel', () => {
  it('keeps today focus override medium-priority and today-only', () => {
    const data = makeAppData();
    const selection = buildTodayTrainingFocusSelection({
      systemTemplate: getTemplate('legs-a'),
      templates,
      override: 'chest',
      todayStatus: data.todayStatus,
    });

    const text = visibleText(<TodayFocusOverridePanel selection={selection} onChange={() => undefined} />);

    expect(text).toContain('今天想练');
    expect(text).not.toContain('中等优先级');
    expect(text).not.toContain('选择只影响今天');
    expect(text).not.toContain('不修改长期计划');
    expect(text).toContain('原计划：腿 A');
    expect(text).toContain('已切换为：胸 · 推 A');
    expect(text).toContain('恢复 / 活动度');
  });
});
