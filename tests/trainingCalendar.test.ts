import { describe, expect, it } from 'vitest';
import { buildTrainingCalendar } from '../src/engines/trainingCalendarEngine';
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
});
