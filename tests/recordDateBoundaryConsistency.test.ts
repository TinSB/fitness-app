import { describe, expect, it } from 'vitest';
import {
  buildTrainingCalendar,
  buildTrainingCalendarMonthRange,
  getSessionCalendarDate,
  resolveCalendarSelectedDate,
} from '../src/engines/trainingCalendarEngine';
import { getSessionLocalDate, listSessionHistory } from '../src/engines/sessionHistoryEngine';
import type { TrainingSession } from '../src/models/training-model';
import { makeSession } from './fixtures';

const session = (id: string, date: string, overrides: Partial<TrainingSession> = {}): TrainingSession => ({
  ...makeSession({
    id,
    date,
    templateId: 'push-a',
    exerciseId: 'bench-press',
    setSpecs: [{ weight: 80, reps: 5, rir: 2, techniqueQuality: 'good' }],
  }),
  ...overrides,
});

describe('record local date boundary consistency', () => {
  it('uses finishedAt before startedAt and date for calendar grouping', () => {
    const crossMidnight = session('cross-midnight', '2026-05-01', {
      startedAt: '2026-05-01T02:30:00.000Z',
      finishedAt: '2026-05-01T03:30:00.000Z',
    });
    const startedOnly = session('started-only', '2026-05-01', {
      startedAt: '2026-05-01T02:30:00.000Z',
      finishedAt: undefined,
    });
    const dateOnly = session('date-only', '2026-04-30', {
      startedAt: undefined,
      finishedAt: undefined,
    });

    expect(getSessionCalendarDate(crossMidnight)).toBe('2026-04-30');
    expect(getSessionCalendarDate(startedOnly)).toBe('2026-04-30');
    expect(getSessionCalendarDate(dateOnly)).toBe('2026-04-30');
    expect(getSessionLocalDate(crossMidnight)).toBe(getSessionCalendarDate(crossMidnight));
  });

  it('does not shift previous-month records into the wrong month around UTC boundaries', () => {
    const history = [
      session('april-local', '2026-05-01', {
        startedAt: '2026-05-01T02:10:00.000Z',
        finishedAt: '2026-05-01T02:55:00.000Z',
      }),
      session('may-local', '2026-05-01', {
        startedAt: '2026-05-01T14:00:00.000Z',
        finishedAt: '2026-05-01T14:45:00.000Z',
      }),
    ];

    const range = buildTrainingCalendarMonthRange(history, '2026-05');
    const april = buildTrainingCalendar(history, '2026-04', { includeDataFlags: 'all' });
    const may = buildTrainingCalendar(history, '2026-05', { includeDataFlags: 'all' });

    expect(range).toMatchObject({ earliestMonth: '2026-04', latestMonth: '2026-05' });
    expect(april.days.find((day) => day.date === '2026-04-30')?.sessions.map((item) => item.sessionId)).toEqual(['april-local']);
    expect(may.days.find((day) => day.date === '2026-05-01')?.sessions.map((item) => item.sessionId)).toEqual(['may-local']);
    expect(listSessionHistory(history).map((item) => getSessionCalendarDate(item))).toEqual(['2026-05-01', '2026-04-30']);
  });

  it('keeps an in-month selected date stable across render refreshes', () => {
    const before = [session('first', '2026-05-04'), session('second', '2026-05-20')];
    const after = [session('second', '2026-05-20')];

    expect(resolveCalendarSelectedDate(before, '2026-05', '2026-05-04', '2026-05-07')).toBe('2026-05-04');
    expect(resolveCalendarSelectedDate(after, '2026-05', '2026-05-04', '2026-05-07')).toBe('2026-05-04');
    expect(resolveCalendarSelectedDate(after, '2026-04', '2026-05-04', '2026-05-07')).toBe('2026-04-01');
  });
});
