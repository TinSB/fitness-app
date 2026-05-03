import { describe, expect, it } from 'vitest';
import { buildPrs } from '../src/engines/analytics';
import { buildEffectiveVolumeSummary } from '../src/engines/effectiveSetEngine';
import { buildE1RMProfile, getExerciseRecordPoolId } from '../src/engines/e1rmEngine';
import { applyExerciseReplacement } from '../src/engines/replacementEngine';
import { makeSession } from './fixtures';

describe('replacement effective set and record-pool mapping', () => {
  it('maps lat-pulldown replaced by assisted-pull-up to the actual exercise record pool', () => {
    const session = makeSession({
      id: 'pull-replacement-session',
      date: '2026-05-02',
      templateId: 'pull-a',
      exerciseId: 'lat-pulldown',
      setSpecs: [{ weight: 45, reps: 8, rir: 2, techniqueQuality: 'good' }],
    });
    const replaced = applyExerciseReplacement(session, 0, 'assisted-pull-up');
    replaced.exercises[0].sets = [
      { id: 'assisted-1', type: 'working', weight: 45, reps: 8, rir: 2, techniqueQuality: 'good', done: true },
    ];

    const prs = buildPrs([replaced]);
    const e1rm = buildE1RMProfile([replaced], 'assisted-pull-up');
    const latPulldownE1rm = buildE1RMProfile([replaced], 'lat-pulldown');
    const effectiveSummary = buildEffectiveVolumeSummary([replaced]);

    expect(replaced.exercises[0]).toMatchObject({
      originalExerciseId: 'lat-pulldown',
      actualExerciseId: 'assisted-pull-up',
      replacementExerciseId: 'assisted-pull-up',
    });
    expect(getExerciseRecordPoolId(replaced.exercises[0])).toBe('assisted-pull-up');
    expect(prs.some((item) => item.exerciseId === 'assisted-pull-up')).toBe(true);
    expect(prs.some((item) => item.exerciseId === 'lat-pulldown')).toBe(false);
    expect(e1rm.best?.exerciseId).toBe('assisted-pull-up');
    expect(latPulldownE1rm.best).toBeUndefined();
    expect(effectiveSummary.byMuscle.背.weightedEffectiveSets).toBeGreaterThanOrEqual(0.75);
    expect(effectiveSummary.byMuscle.手臂.weightedEffectiveSets).toBeGreaterThan(0);
  });

  it('keeps face-pull rear-delt replacements from becoming main back volume', () => {
    const session = makeSession({
      id: 'rear-delt-replacement-session',
      date: '2026-05-02',
      templateId: 'pull-a',
      exerciseId: 'face-pull',
      setSpecs: [{ weight: 15, reps: 15, rir: 2, techniqueQuality: 'good' }],
    });
    const replaced = applyExerciseReplacement(session, 0, 'reverse-pec-deck');
    replaced.exercises[0].sets = [
      { id: 'rear-delt-1', type: 'working', weight: 20, reps: 15, rir: 2, techniqueQuality: 'good', done: true },
    ];

    const effectiveSummary = buildEffectiveVolumeSummary([replaced]);

    expect(replaced.exercises[0]).toMatchObject({
      originalExerciseId: 'face-pull',
      actualExerciseId: 'reverse-pec-deck',
      replacementExerciseId: 'reverse-pec-deck',
      primaryMuscles: ['肩'],
    });
    expect(effectiveSummary.byMuscle.肩.weightedEffectiveSets).toBeGreaterThan(effectiveSummary.byMuscle.背.weightedEffectiveSets);
    expect(effectiveSummary.byMuscle.背.weightedEffectiveSets).toBeLessThan(0.5);
  });
});
