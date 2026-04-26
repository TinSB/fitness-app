import { describe, expect, it } from 'vitest';
import { buildE1RMProfile, estimateLoadFromE1RM, estimateOneRepMaxForExercise } from '../src/engines/e1rmEngine';
import { makeSession } from './fixtures';

describe('e1rmEngine', () => {
  it('estimates e1RM from a normal work set', () => {
    const session = makeSession({
      id: 's1',
      date: '2026-04-24',
      templateId: 'push-a',
      exerciseId: 'bench-press',
      setSpecs: [{ weight: 80, reps: 6, rir: 2, techniqueQuality: 'good' }],
    });

    const result = estimateOneRepMaxForExercise([session], 'bench-press');
    expect(result?.formula).toBe('epley');
    expect(result?.e1rmKg).toBeGreaterThan(90);
    expect(result?.sourceSet.weightKg).toBe(80);
  });

  it('returns null without history', () => {
    expect(estimateOneRepMaxForExercise([], 'bench-press')).toBeNull();
  });

  it('lowers confidence for poor technique and pain flags', () => {
    const poor = makeSession({
      id: 's1',
      date: '2026-04-24',
      templateId: 'push-a',
      exerciseId: 'bench-press',
      setSpecs: [{ weight: 90, reps: 5, rir: 2, techniqueQuality: 'poor' }],
    });
    const pain = makeSession({
      id: 's2',
      date: '2026-04-25',
      templateId: 'push-a',
      exerciseId: 'bench-press',
      setSpecs: [{ weight: 90, reps: 5, rir: 2, painFlag: true, techniqueQuality: 'good' }],
    });

    expect(estimateOneRepMaxForExercise([poor], 'bench-press')?.confidence).toBe('low');
    expect(estimateOneRepMaxForExercise([pain], 'bench-press')?.confidence).toBe('low');
  });

  it('converts e1RM percent range into a practical load range', () => {
    expect(estimateLoadFromE1RM(100, [60, 80])).toEqual({ minKg: 60, maxKg: 80 });
  });

  it('uses current e1RM for recent ability while preserving historical best', () => {
    const oldBest = makeSession({
      id: 'old-best',
      date: '2026-03-01',
      templateId: 'push-a',
      exerciseId: 'bench-press',
      setSpecs: [{ weight: 100, reps: 5, rir: 2, techniqueQuality: 'good' }],
    });
    const recent = Array.from({ length: 5 }, (_, index) =>
      makeSession({
        id: `recent-${index}`,
        date: `2026-04-${20 + index}`,
        templateId: 'push-a',
        exerciseId: 'bench-press',
        setSpecs: [{ weight: 80, reps: 6, rir: 2, techniqueQuality: 'good' }],
      })
    );

    const profile = buildE1RMProfile([...recent, oldBest], 'bench-press');
    expect(profile.current?.e1rmKg).toBeLessThan(profile.best?.e1rmKg || 0);
    expect(profile.current?.sourceSet.weightKg).toBe(80);
    expect(profile.best?.sourceSet.weightKg).toBe(100);
  });

  it('uses a stable recent estimate instead of a single outlier for current e1RM', () => {
    const recent = [
      { id: 'r1', date: '2026-04-20', weight: 80 },
      { id: 'r2', date: '2026-04-21', weight: 81 },
      { id: 'r3', date: '2026-04-22', weight: 82 },
      { id: 'r4', date: '2026-04-23', weight: 83 },
      { id: 'outlier', date: '2026-04-24', weight: 110 },
    ].map((item) =>
      makeSession({
        id: item.id,
        date: item.date,
        templateId: 'push-a',
        exerciseId: 'bench-press',
        setSpecs: [{ weight: item.weight, reps: 6, rir: 2, techniqueQuality: 'good' }],
      })
    );

    const profile = buildE1RMProfile(recent, 'bench-press');
    expect(profile.method).toBe('median_recent');
    expect(profile.current?.e1rmKg).toBeLessThan(105);
    expect(profile.best?.e1rmKg).toBeGreaterThan(125);
    expect(estimateLoadFromE1RM(profile.current?.e1rmKg || 0, [60, 80]).maxKg).toBeLessThan(
      estimateLoadFromE1RM(profile.best?.e1rmKg || 0, [60, 80]).maxKg
    );
  });

  it('marks current e1RM as low confidence when recent data is too sparse', () => {
    const single = makeSession({
      id: 'single',
      date: '2026-04-24',
      templateId: 'push-a',
      exerciseId: 'bench-press',
      setSpecs: [{ weight: 80, reps: 6, rir: 2, techniqueQuality: 'good' }],
    });

    const profile = buildE1RMProfile([single], 'bench-press');
    expect(profile.method).toBe('single_recent_low_confidence');
    expect(profile.current?.confidence).toBe('low');
  });

  it('returns no current e1RM when recent high-quality data is missing', () => {
    const oldBest = makeSession({
      id: 'old-best',
      date: '2026-03-01',
      templateId: 'push-a',
      exerciseId: 'bench-press',
      setSpecs: [{ weight: 95, reps: 5, rir: 2, techniqueQuality: 'good' }],
    });
    const recentPoor = Array.from({ length: 5 }, (_, index) =>
      makeSession({
        id: `recent-poor-${index}`,
        date: `2026-04-${20 + index}`,
        templateId: 'push-a',
        exerciseId: 'bench-press',
        setSpecs: [{ weight: 80, reps: 6, rir: 2, techniqueQuality: 'poor' }],
      })
    );

    const profile = buildE1RMProfile([...recentPoor, oldBest], 'bench-press');
    expect(profile.current).toBeUndefined();
    expect(profile.best?.e1rmKg).toBeGreaterThan(100);
  });

  it('does not share precise e1RM across equivalence-chain variants', () => {
    const machineOnly = makeSession({
      id: 'machine',
      date: '2026-04-24',
      templateId: 'push-a',
      exerciseId: 'machine-chest-press',
      setSpecs: [{ weight: 120, reps: 6, rir: 2, techniqueQuality: 'good' }],
    });

    expect(buildE1RMProfile([machineOnly], 'bench-press').current).toBeUndefined();
    expect(buildE1RMProfile([machineOnly], 'machine-chest-press').current?.e1rmKg).toBeGreaterThan(130);
  });

  it('allows pooling only when canonicalExerciseId explicitly matches', () => {
    const machine = makeSession({
      id: 'machine-canonical',
      date: '2026-04-24',
      templateId: 'push-a',
      exerciseId: 'machine-chest-press',
      setSpecs: [{ weight: 100, reps: 6, rir: 2, techniqueQuality: 'good' }],
    });
    machine.exercises[0].canonicalExerciseId = 'bench-press';

    expect(buildE1RMProfile([machine], 'bench-press').current?.sourceSet.weightKg).toBe(100);
  });
});
