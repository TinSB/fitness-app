import { describe, expect, it } from 'vitest';
import { buildPrs } from '../src/engines/analytics';
import { buildEffectiveVolumeSummary } from '../src/engines/effectiveSetEngine';
import { buildE1RMProfile, getExerciseRecordPoolId } from '../src/engines/e1rmEngine';
import { applyExerciseReplacement } from '../src/engines/replacementEngine';
import { makeSession } from './fixtures';

describe('leg replacement effective set and record-pool mapping', () => {
  it('maps squat replaced by smith-squat to the actual exercise record pool', () => {
    const session = makeSession({
      id: 'smith-squat-session',
      date: '2026-05-03',
      templateId: 'legs-a',
      exerciseId: 'squat',
      setSpecs: [{ weight: 100, reps: 6, rir: 2, techniqueQuality: 'good' }],
    });
    const replaced = applyExerciseReplacement(session, 0, 'smith-squat');
    replaced.exercises[0].sets = [
      { id: 'smith-1', type: 'working', weight: 90, reps: 8, rir: 2, techniqueQuality: 'good', done: true },
    ];

    const prs = buildPrs([replaced]);
    const smithE1rm = buildE1RMProfile([replaced], 'smith-squat');
    const squatE1rm = buildE1RMProfile([replaced], 'squat');
    const effectiveSummary = buildEffectiveVolumeSummary([replaced]);

    expect(replaced.exercises[0]).toMatchObject({
      originalExerciseId: 'squat',
      actualExerciseId: 'smith-squat',
      replacementExerciseId: 'smith-squat',
    });
    expect(getExerciseRecordPoolId(replaced.exercises[0])).toBe('smith-squat');
    expect(prs.some((item) => item.exerciseId === 'smith-squat')).toBe(true);
    expect(prs.some((item) => item.exerciseId === 'squat')).toBe(false);
    expect(smithE1rm.best?.exerciseId).toBe('smith-squat');
    expect(squatE1rm.best).toBeUndefined();
    expect(effectiveSummary.byMuscle.腿.weightedEffectiveSets).toBeGreaterThanOrEqual(0.75);
  });

  it('maps RDL replaced by hip-thrust to hip-thrust without polluting RDL', () => {
    const session = makeSession({
      id: 'hip-thrust-session',
      date: '2026-05-03',
      templateId: 'legs-a',
      exerciseId: 'romanian-deadlift',
      setSpecs: [{ weight: 90, reps: 8, rir: 2, techniqueQuality: 'good' }],
    });
    const replaced = applyExerciseReplacement(session, 0, 'hip-thrust');
    replaced.exercises[0].sets = [
      { id: 'hip-thrust-1', type: 'working', weight: 110, reps: 10, rir: 2, techniqueQuality: 'good', done: true },
    ];

    const prs = buildPrs([replaced]);
    const hipThrustE1rm = buildE1RMProfile([replaced], 'hip-thrust');
    const rdlE1rm = buildE1RMProfile([replaced], 'romanian-deadlift');
    const effectiveSummary = buildEffectiveVolumeSummary([replaced]);

    expect(replaced.exercises[0]).toMatchObject({
      originalExerciseId: 'romanian-deadlift',
      actualExerciseId: 'hip-thrust',
      replacementExerciseId: 'hip-thrust',
      movementPattern: '髋伸',
    });
    expect(getExerciseRecordPoolId(replaced.exercises[0])).toBe('hip-thrust');
    expect(prs.some((item) => item.exerciseId === 'hip-thrust')).toBe(true);
    expect(prs.some((item) => item.exerciseId === 'romanian-deadlift')).toBe(false);
    expect(hipThrustE1rm.best?.exerciseId).toBe('hip-thrust');
    expect(rdlE1rm.best).toBeUndefined();
    expect(effectiveSummary.byMuscle.腿.weightedEffectiveSets).toBeGreaterThanOrEqual(0.75);
    expect(effectiveSummary.byMuscle.背.weightedEffectiveSets).toBeLessThan(0.5);
  });
});
