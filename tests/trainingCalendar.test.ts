import { describe, expect, it } from 'vitest';
import {
  buildTrainingCalendar,
  buildTrainingCalendarMonthRange,
  getDefaultCalendarDateForMonth,
  getInitialCalendarMonth,
  toLocalDateKey,
} from '../src/engines/trainingCalendarEngine';
import { makeExercise, makeFocusSession } from './focusModeFixtures';

const completedSession = (id: string, date: string, dataFlag: 'normal' | 'test' | 'excluded' = 'normal') => ({
  ...makeFocusSession([makeExercise('bench', 2, 2)]),
  id,
  date,
  startedAt: `${date}T10:00:00.000Z`,
  finishedAt: `${date}T10:50:00.000Z`,
  durationMin: 50,
  completed: true,
  dataFlag,
});

describe('training calendar', () => {
  it('builds calendar days from history', () => {
    const calendar = buildTrainingCalendar([completedSession('s1', '2026-04-10')], '2026-04');
    const day = calendar.days.find((item) => item.date === '2026-04-10');
    expect(day?.totalSessions).toBe(1);
    expect(day?.sessions[0].completedSets).toBe(2);
  });

  it('calculates weekly frequency', () => {
    const calendar = buildTrainingCalendar([
      completedSession('s1', '2026-04-10'),
      completedSession('s2', '2026-04-12'),
      completedSession('s3', '2026-04-18'),
    ], '2026-04');
    expect(calendar.weeklyFrequency.some((week) => week.sessionCount >= 2)).toBe(true);
  });

  it('excludes test and excluded data from calendar', () => {
    const calendar = buildTrainingCalendar([
      completedSession('s1', '2026-04-10', 'test'),
      completedSession('s2', '2026-04-11', 'excluded'),
    ], '2026-04');
    expect(calendar.days.reduce((sum, day) => sum + day.totalSessions, 0)).toBe(0);
  });

  it('can include test and excluded data when requested', () => {
    const calendar = buildTrainingCalendar([
      completedSession('s1', '2026-04-10', 'test'),
      completedSession('s2', '2026-04-11', 'excluded'),
    ], '2026-04', { includeDataFlags: 'all' });
    expect(calendar.days.reduce((sum, day) => sum + day.totalSessions, 0)).toBe(2);
  });

  it('returns visible empty month data for empty history', () => {
    const calendar = buildTrainingCalendar([], '2026-04');
    expect(calendar.days.length).toBe(30);
    expect(calendar.days.every((day) => day.totalSessions === 0)).toBe(true);
  });

  it('uses local date key for ISO timestamps', () => {
    expect(toLocalDateKey('2026-04-27T23:30:00-04:00')).toBe('2026-04-27');
    expect(toLocalDateKey('2026-04-27T02:30:00Z')).toBe('2026-04-26');
  });

  it('uses finishedAt before startedAt and date when assigning sessions to calendar days', () => {
    const session = {
      ...completedSession('late-april', '2026-05-01'),
      startedAt: '2026-05-01T00:30:00.000Z',
      finishedAt: '2026-05-01T01:30:00.000Z',
    };

    const april = buildTrainingCalendar([session], '2026-04');
    const may = buildTrainingCalendar([session], '2026-05');

    expect(april.days.find((item) => item.date === '2026-04-30')?.totalSessions).toBe(1);
    expect(may.days.reduce((sum, day) => sum + day.totalSessions, 0)).toBe(0);
  });

  it('builds a navigable month range from history and keeps the current month visible', () => {
    const range = buildTrainingCalendarMonthRange(
      [completedSession('april', '2026-04-30'), completedSession('early-may', '2026-05-01')],
      '2026-05',
    );

    expect(range).toEqual({
      earliestMonth: '2026-04',
      latestMonth: '2026-05',
      hasHistory: true,
    });
  });

  it('defaults to the latest training date instead of today when history exists', () => {
    const history = [completedSession('push', '2026-04-27'), completedSession('pull', '2026-04-30')];

    expect(getInitialCalendarMonth(history, undefined, '2026-05')).toBe('2026-04');
    expect(getDefaultCalendarDateForMonth(history, '2026-04', '2026-05-01')).toBe('2026-04-30');
  });
});
