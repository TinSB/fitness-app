import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { buildTodayDecisionSurface } from '../src/engines/todayDecisionSurface';
import { ActionButton } from '../src/uiOs/primitives/ActionButton';
import { TodayDecisionHero } from '../src/uiOs/today/TodayDecisionHero';

const visibleText = (node: React.ReactElement) =>
  renderToStaticMarkup(node)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

describe('TodayDecisionHero', () => {
  it('renders the decisive Today hero with primary action', () => {
    const decision = buildTodayDecisionSurface({ recommendedFocus: '腿 A' });
    const text = visibleText(
      <TodayDecisionHero
        decision={decision}
        dateLabel="2026-05-19"
        primaryAction={<ActionButton>开始今天训练</ActionButton>}
      />,
    );

    expect(text).toContain('今日结论');
    expect(text).toContain('今天练什么');
    expect(text).toContain('今天建议：腿 A');
    expect(text).toContain('开始今天训练');
    expect(text).not.toContain('状态正常，按计划执行');
    expect(text).not.toContain('数据状态：');
  });
});
