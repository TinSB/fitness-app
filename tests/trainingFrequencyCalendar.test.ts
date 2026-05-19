import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { TrainingFrequencyCalendar } from '../src/uiOs/history/TrainingFrequencyCalendar';
import type { HistoryCalendarDay } from '../src/engines/historyCalendarSummary';

const text = (element: React.ReactElement) => renderToStaticMarkup(element).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

const day = (date: string, overrides: Partial<HistoryCalendarDay> = {}): HistoryCalendarDay => ({
  date,
  displayLabel: String(Number(date.slice(-2))),
  isToday: false,
  isSelected: false,
  hasTraining: false,
  sessionCount: 0,
  hasPr: false,
  hasE1rmChange: false,
  hasIssueHint: false,
  intensityLabel: '休息',
  ...overrides,
});

describe('TrainingFrequencyCalendar', () => {
  it('renders trained and untrained days with scan-friendly calendar controls', () => {
    const markup = renderToStaticMarkup(
      React.createElement(TrainingFrequencyCalendar, {
        month: '2026-05',
        days: [
          day('2026-05-01', { hasTraining: true, sessionCount: 1, hasPr: true, intensityLabel: '已训练' }),
          day('2026-05-02', { isSelected: true }),
          day('2026-05-03', { isToday: true }),
        ],
        onSelectDate: vi.fn(),
      }),
    );

    expect(markup).toContain('训练日历');
    expect(markup).toContain('2026-05');
    expect(markup).toContain('已训练');
    expect(markup).toContain('未训练');
    expect(markup).toContain('PR/e1RM');
    expect(markup).toContain('rounded-2xl');
  });

  it('keeps month navigation and today controls visible', () => {
    const output = text(
      React.createElement(TrainingFrequencyCalendar, {
        month: '2026-05',
        days: [day('2026-05-01')],
        onPreviousMonth: vi.fn(),
        onNextMonth: vi.fn(),
        onToday: vi.fn(),
      }),
    );

    expect(output).toContain('上一月');
    expect(output).toContain('下一月');
    expect(output).toContain('今天');
  });
});
