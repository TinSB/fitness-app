import { describe, expect, it } from 'vitest';
import {
  addCalendarMonths,
  buildTrainingCalendarMonthRange,
  clampCalendarMonth,
  getDefaultCalendarDateForMonth,
  getInitialCalendarMonth,
} from '../src/engines/trainingCalendarEngine';
import { monthKey } from '../src/engines/engineUtils';
import { makeSession } from './fixtures';

const session = (id: string, date: string) =>
  makeSession({
    id,
    date,
    templateId: 'push-a',
    exerciseId: 'bench-press',
    setSpecs: [{ weight: 80, reps: 5 }],
  });

describe('record calendar month navigation state', () => {
  it('moves from May 2026 to April 2026 with previous-month navigation', () => {
    const history = [session('april', '2026-04-30'), session('may', '2026-05-01')];
    const range = buildTrainingCalendarMonthRange(history, '2026-05');

    const previousMonth = clampCalendarMonth(addCalendarMonths('2026-05', -1), range);

    expect(previousMonth).toBe('2026-04');
  });

  it('selects the latest training day in April when April has records', () => {
    const history = [session('push', '2026-04-27'), session('pull', '2026-04-30')];

    expect(getDefaultCalendarDateForMonth(history, '2026-04', '2026-05-01')).toBe('2026-04-30');
  });

  it('shows the current month when history is empty', () => {
    const currentMonth = monthKey();
    const range = buildTrainingCalendarMonthRange([], currentMonth);

    expect(range.earliestMonth).toBe(currentMonth);
    expect(range.latestMonth).toBe(currentMonth);
    expect(getInitialCalendarMonth([], undefined, currentMonth)).toBe(currentMonth);
  });

  it('clamps navigation to the history range', () => {
    const history = [session('april', '2026-04-30')];
    const range = buildTrainingCalendarMonthRange(history, '2026-05');

    expect(clampCalendarMonth('2026-03', range)).toBe('2026-04');
    expect(clampCalendarMonth('2026-06', range)).toBe('2026-05');
  });
});
