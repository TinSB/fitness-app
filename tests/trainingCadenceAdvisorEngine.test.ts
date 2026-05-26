import { describe, expect, it } from 'vitest';
import { recommendWeeklyCadence } from '../src/engines/trainingCadenceAdvisorEngine';
import type { TrainingSession, UserProfile } from '../src/models/training-model';

const profile = (days: number): UserProfile =>
  ({
    sex: 'male',
    age: 30,
    heightCm: 175,
    weightKg: 70,
    trainingLevel: 'intermediate',
    primaryGoal: 'hypertrophy',
    weeklyTrainingDays: days,
    sessionDurationMin: 60,
    secondaryPreferences: [],
    equipmentAccess: [],
    injuryFlags: [],
    painNotes: [],
  } as unknown as UserProfile);

const session = (id: string, date: string, dataFlag?: 'test' | 'excluded'): TrainingSession =>
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
    dataFlag,
  } as unknown as TrainingSession);

describe('trainingCadenceAdvisorEngine', () => {
  it('rebuilds from 1-2 sessions with empty history', () => {
    const result = recommendWeeklyCadence(profile(4), [], { nowIso: '2026-05-27T10:00:00.000Z' });
    expect(result.advice).toBe('rebuild');
    expect(result.targetSessionsPerWeek).toBeLessThanOrEqual(2);
    expect(result.cap).toBe(2);
  });

  it('keeps baseline target when training cadence is fresh', () => {
    const history = [session('s1', '2026-05-26')];
    const result = recommendWeeklyCadence(profile(4), history, { nowIso: '2026-05-27T10:00:00.000Z' });
    expect(result.advice).toBe('maintain');
    expect(result.targetSessionsPerWeek).toBe(4);
  });

  it('reduces target when training is lapsed (10-20 days)', () => {
    const history = [session('s1', '2026-05-10')];
    const result = recommendWeeklyCadence(profile(5), history, { nowIso: '2026-05-27T10:00:00.000Z' });
    expect(result.advice).toBe('rebuild');
    expect(result.targetSessionsPerWeek).toBe(4);
  });

  it('clamps target when training is long_lapsed (21-45 days)', () => {
    const history = [session('s1', '2026-05-01')];
    const result = recommendWeeklyCadence(profile(6), history, { nowIso: '2026-05-27T10:00:00.000Z' });
    expect(result.advice).toBe('rebuild');
    expect(result.targetSessionsPerWeek).toBe(3);
    expect(result.cap).toBe(3);
  });

  it('clamps to 1-2 when training is dormant (>45 days)', () => {
    const history = [session('s1', '2026-03-01')];
    const result = recommendWeeklyCadence(profile(6), history, { nowIso: '2026-05-27T10:00:00.000Z' });
    expect(result.advice).toBe('rebuild');
    expect(result.targetSessionsPerWeek).toBeLessThanOrEqual(2);
    expect(result.cap).toBe(2);
  });

  it('reports extend advice once weekly target is met', () => {
    const history = [
      session('s1', '2026-05-25'),
      session('s2', '2026-05-26'),
      session('s3', '2026-05-27'),
    ];
    const result = recommendWeeklyCadence(profile(3), history, { nowIso: '2026-05-27T18:00:00.000Z' });
    expect(result.advice).toBe('extend');
    expect(result.sessionsCompletedThisWeek).toBe(3);
    expect(result.remainingThisWeek).toBe(0);
  });

  it('ignores test or excluded sessions', () => {
    const history = [
      session('s1', '2026-05-25', 'test'),
      session('s2', '2026-05-26', 'excluded'),
    ];
    const result = recommendWeeklyCadence(profile(3), history, { nowIso: '2026-05-27T18:00:00.000Z' });
    expect(result.sessionsCompletedThisWeek).toBe(0);
  });
});
