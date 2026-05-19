import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { HistoryFrequencySummary } from '../src/uiOs/history/HistoryFrequencySummary';

describe('HistoryFrequencySummary', () => {
  it('renders weekly monthly recent-four-week and calm data health summary', () => {
    const html = renderToStaticMarkup(
      React.createElement(HistoryFrequencySummary, {
        thisWeekTrainingDays: 3,
        thisMonthTrainingDays: 10,
        recentFourWeekAverage: 2.5,
        currentStreak: 2,
        dataHealthHint: '没有明显异常',
      }),
    );

    for (const expected of ['本周训练', '本月训练', '近 4 周平均', '连续性', '没有明显异常']) {
      expect(html).toContain(expected);
    }
    expect(html).toContain('backdrop-blur');
  });
});
