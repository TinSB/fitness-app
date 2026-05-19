import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { buildProgressClaritySummary } from '../src/engines/progressClaritySummary';
import { EffectiveSetsVolumeCard } from '../src/uiOs/progress/EffectiveSetsVolumeCard';
import { ProgressInsightHero } from '../src/uiOs/progress/ProgressInsightHero';
import { ReadinessPressureCard } from '../src/uiOs/progress/ReadinessPressureCard';
import { StrengthTrendCards } from '../src/uiOs/progress/StrengthTrendCards';

const summary = buildProgressClaritySummary({
  strengthTrend: 'improving',
  recoveryPressure: 'high',
  dataCoverageStatus: 'sufficient',
  effectiveSetSummary: {
    completedSets: 34,
    effectiveSets: 27,
    highConfidenceEffectiveSets: 20,
    mediumConfidenceEffectiveSets: 5,
    lowConfidenceEffectiveSets: 2,
  },
  volumeSummary: {
    thisMonthSessions: 8,
    recentFourWeekAverage: 3.25,
    completedSets: 34,
    painSessionCount: 1,
  },
  strengthTrendItems: [{
    id: 'bench-press',
    label: '卧推',
    currentLabel: '105kg e1RM',
    bestLabel: '100kg x 5',
    trend: 'improving',
    explanation: '使用现有 PR / e1RM 结果做只读解释。',
  }],
});

describe('Progress clarity UI components', () => {
  it('renders insight hero with human-readable recommendation', () => {
    const html = renderToStaticMarkup(React.createElement(ProgressInsightHero, { summary }));

    expect(html).toContain('训练状态解读');
    expect(html).toContain('力量有进步');
    expect(html).toContain('下次建议');
    expect(html).toContain('保持重量');
    expect(html).not.toContain('raw dashboard');
  });

  it('renders readiness and recovery pressure card', () => {
    const html = renderToStaticMarkup(React.createElement(ReadinessPressureCard, { summary }));

    expect(html).toContain('Readiness');
    expect(html).toContain('Recovery pressure');
    expect(html).toContain('压力偏高');
    expect(html).toContain('不依赖穿戴设备');
  });

  it('renders PR e1RM strength trend cards', () => {
    const html = renderToStaticMarkup(React.createElement(StrengthTrendCards, { items: summary.strengthTrendItems }));

    expect(html).toContain('力量趋势 / PR / e1RM');
    expect(html).toContain('卧推');
    expect(html).toContain('105kg e1RM');
    expect(html).toContain('趋势上升');
  });

  it('renders effective sets and volume explanation with caveat', () => {
    const html = renderToStaticMarkup(React.createElement(EffectiveSetsVolumeCard, { summary }));

    expect(html).toContain('有效组解释');
    expect(html).toContain('训练量 / 恢复含义');
    expect(html).toContain('恢复压力可能增加');
    expect(html).toContain('计算保持不变');
  });

  it('renders insufficient-data caveat when needed', () => {
    const insufficient = buildProgressClaritySummary({ dataCoverageStatus: 'insufficient', strengthTrendItems: [] });
    const html = renderToStaticMarkup(React.createElement(ProgressInsightHero, { summary: insufficient }));

    expect(html).toContain('数据不足');
    expect(html).toContain('继续观察');
  });
});
