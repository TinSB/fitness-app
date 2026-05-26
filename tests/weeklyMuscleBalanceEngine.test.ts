import { describe, expect, it } from 'vitest';
import { computeWeeklyMuscleBalance } from '../src/engines/weeklyMuscleBalanceEngine';
import { makeSession } from './fixtures';

const NOW = '2026-05-27T18:00:00.000Z';

describe('weeklyMuscleBalanceEngine', () => {
  it('returns zero state when there is no training this week', () => {
    const result = computeWeeklyMuscleBalance([], { nowIso: NOW });
    expect(result.totalEffectiveSets).toBe(0);
    expect(result.balanceScore).toBe(0);
    expect(result.headline).toContain('尚无');
  });

  it('aggregates effective sets and estimated volume per muscle within the current week', () => {
    const history = [
      makeSession({
        id: 's-push',
        date: '2026-05-25',
        templateId: 'push-a',
        exerciseId: 'bench-press',
        setSpecs: [
          { weight: 80, reps: 6, rir: 1 },
          { weight: 80, reps: 6, rir: 1 },
        ],
      }),
    ];
    const result = computeWeeklyMuscleBalance(history, { nowIso: NOW, focusMuscles: ['胸', '背', '腿'] });
    const chest = result.entries.find((entry) => entry.muscle === '胸');
    expect(chest).toBeDefined();
    expect(chest!.effectiveSets).toBeGreaterThan(0);
    expect(chest!.estimatedVolumeKg).toBeGreaterThan(0);
  });

  it('flags overworked and underworked muscles when one dominates', () => {
    const history = [
      makeSession({
        id: 's-chest-1',
        date: '2026-05-25',
        templateId: 'push-a',
        exerciseId: 'bench-press',
        setSpecs: Array.from({ length: 5 }, () => ({ weight: 80, reps: 6, rir: 1 })),
      }),
      makeSession({
        id: 's-chest-2',
        date: '2026-05-26',
        templateId: 'push-a',
        exerciseId: 'bench-press',
        setSpecs: Array.from({ length: 5 }, () => ({ weight: 80, reps: 6, rir: 1 })),
      }),
    ];
    const result = computeWeeklyMuscleBalance(history, {
      nowIso: NOW,
      focusMuscles: ['胸', '背', '腿'],
    });
    expect(result.overworkedMuscles).toContain('胸');
    expect(result.underworkedMuscles).toEqual(expect.arrayContaining(['背', '腿']));
    expect(result.balanceScore).toBeLessThan(100);
  });

  it('excludes sessions outside the current week', () => {
    const history = [
      makeSession({
        id: 's-old',
        date: '2026-05-01',
        templateId: 'push-a',
        exerciseId: 'bench-press',
        setSpecs: [{ weight: 80, reps: 6, rir: 1 }],
      }),
    ];
    const result = computeWeeklyMuscleBalance(history, { nowIso: NOW });
    expect(result.totalEffectiveSets).toBe(0);
  });

  it('produces a balanced score when several muscles are evenly trained', () => {
    const history = [
      makeSession({
        id: 's-push',
        date: '2026-05-25',
        templateId: 'push-a',
        exerciseId: 'bench-press',
        setSpecs: [{ weight: 80, reps: 6, rir: 1 }, { weight: 80, reps: 6, rir: 1 }, { weight: 80, reps: 6, rir: 1 }],
      }),
      makeSession({
        id: 's-pull',
        date: '2026-05-26',
        templateId: 'pull-a',
        exerciseId: 'barbell-row',
        setSpecs: [{ weight: 70, reps: 6, rir: 1 }, { weight: 70, reps: 6, rir: 1 }, { weight: 70, reps: 6, rir: 1 }],
      }),
      makeSession({
        id: 's-legs',
        date: '2026-05-27',
        templateId: 'legs-a',
        exerciseId: 'squat',
        setSpecs: [{ weight: 100, reps: 6, rir: 1 }, { weight: 100, reps: 6, rir: 1 }, { weight: 100, reps: 6, rir: 1 }],
      }),
    ];
    const result = computeWeeklyMuscleBalance(history, {
      nowIso: NOW,
      focusMuscles: ['胸', '背', '腿'],
    });
    expect(result.balanceScore).toBeGreaterThan(70);
  });
});
