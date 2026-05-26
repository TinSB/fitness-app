import { describe, expect, it } from 'vitest';
import { computeTrainingStreak } from '../src/engines/trainingStreakEngine';
import type { TrainingSession } from '../src/models/training-model';

const session = (id: string, date: string): TrainingSession =>
  ({
    id,
    date,
    templateId: 'push-a',
    templateName: 'Push A',
    trainingMode: 'hybrid',
    focus: 'push',
    completed: true,
    finishedAt: `${date}T10:00:00.000Z`,
    exercises: [],
  } as unknown as TrainingSession);

describe('trainingStreakEngine', () => {
  it('returns all zero for empty history', () => {
    const result = computeTrainingStreak([], { nowIso: '2026-05-27T10:00:00.000Z' });
    expect(result.currentWeekStreak).toBe(0);
    expect(result.totalAnalyticsSessions).toBe(0);
  });

  it('counts current week streak including this week', () => {
    const result = computeTrainingStreak(
      [
        session('s1', '2026-05-26'),
        session('s2', '2026-05-19'),
        session('s3', '2026-05-12'),
      ],
      { nowIso: '2026-05-27T10:00:00.000Z' },
    );
    expect(result.currentWeekStreak).toBe(3);
    expect(result.longestWeekStreak).toBe(3);
  });

  it('keeps streak alive if user has not trained this week yet but trained last week', () => {
    const result = computeTrainingStreak(
      [
        session('s1', '2026-05-19'),
        session('s2', '2026-05-12'),
      ],
      { nowIso: '2026-05-27T10:00:00.000Z' },
    );
    expect(result.currentWeekStreak).toBe(2);
  });

  it('reports broken streak when last training is older than last week', () => {
    const result = computeTrainingStreak(
      [
        session('s1', '2026-04-15'),
      ],
      { nowIso: '2026-05-27T10:00:00.000Z' },
    );
    expect(result.currentWeekStreak).toBe(0);
    expect(result.reason).toContain('中断');
  });

  it('computes longest streak distinctly from current streak', () => {
    const result = computeTrainingStreak(
      [
        session('s1', '2026-05-26'),
        session('s2', '2026-05-12'),
        session('s3', '2026-05-05'),
        session('s4', '2026-04-28'),
        session('s5', '2026-04-21'),
      ],
      { nowIso: '2026-05-27T10:00:00.000Z' },
    );
    expect(result.currentWeekStreak).toBe(1);
    expect(result.longestWeekStreak).toBe(4);
  });

  it('computes month streak independently', () => {
    const result = computeTrainingStreak(
      [
        session('s1', '2026-05-15'),
        session('s2', '2026-04-15'),
        session('s3', '2026-03-15'),
      ],
      { nowIso: '2026-05-27T10:00:00.000Z' },
    );
    expect(result.currentMonthStreak).toBe(3);
  });

  it('skips test/excluded sessions', () => {
    const flagged = { ...session('s-flagged', '2026-05-26'), dataFlag: 'test' as const };
    const result = computeTrainingStreak([flagged], { nowIso: '2026-05-27T10:00:00.000Z' });
    expect(result.totalAnalyticsSessions).toBe(0);
  });
});
