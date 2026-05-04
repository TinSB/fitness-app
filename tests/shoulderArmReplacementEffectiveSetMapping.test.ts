import { describe, expect, it } from 'vitest';
import { buildPrs } from '../src/engines/analytics';
import { buildEffectiveVolumeSummary } from '../src/engines/effectiveSetEngine';
import { buildE1RMProfile, getExerciseRecordPoolId } from '../src/engines/e1rmEngine';
import { applyExerciseReplacement } from '../src/engines/replacementEngine';
import type { TrainingSession } from '../src/models/training-model';
import { makeSession } from './fixtures';

const shoulderPressSession = (): TrainingSession =>
  ({
    id: 'machine-shoulder-press-session',
    date: '2026-05-04',
    startedAt: '2026-05-04T18:00:00.000Z',
    finishedAt: '2026-05-04T19:00:00.000Z',
    templateId: 'push-a',
    programTemplateId: 'push-a',
    completed: true,
    exercises: [
      {
        id: 'shoulder-press',
        baseId: 'shoulder-press',
        canonicalExerciseId: 'shoulder-press',
        actualExerciseId: 'shoulder-press',
        name: '哑铃肩推',
        alias: '哑铃肩推',
        muscle: '肩',
        kind: 'compound',
        sets: [{ id: 'shoulder-1', type: 'working', weight: 24, reps: 8, rir: 2, techniqueQuality: 'good', done: true }],
        repMin: 8,
        repMax: 12,
        rest: 120,
        startWeight: 24,
      },
    ],
  }) as TrainingSession;

describe('shoulder and arm replacement effective set and record-pool mapping', () => {
  it('maps shoulder-press replaced by machine-shoulder-press to the actual exercise record pool', () => {
    const session = shoulderPressSession();
    const replaced = applyExerciseReplacement(session, 0, 'machine-shoulder-press');
    replaced.exercises[0].sets = [
      { id: 'machine-shoulder-1', type: 'working', weight: 35, reps: 9, rir: 2, techniqueQuality: 'good', done: true },
    ];

    const prs = buildPrs([replaced]);
    const machineShoulderE1rm = buildE1RMProfile([replaced], 'machine-shoulder-press');
    const shoulderPressE1rm = buildE1RMProfile([replaced], 'shoulder-press');
    const effectiveSummary = buildEffectiveVolumeSummary([replaced]);

    expect(replaced.exercises[0]).toMatchObject({
      originalExerciseId: 'shoulder-press',
      actualExerciseId: 'machine-shoulder-press',
      replacementExerciseId: 'machine-shoulder-press',
    });
    expect(getExerciseRecordPoolId(replaced.exercises[0])).toBe('machine-shoulder-press');
    expect(prs.some((item) => item.exerciseId === 'machine-shoulder-press')).toBe(true);
    expect(prs.some((item) => item.exerciseId === 'shoulder-press')).toBe(false);
    expect(machineShoulderE1rm.best?.exerciseId).toBe('machine-shoulder-press');
    expect(shoulderPressE1rm.best).toBeUndefined();
    expect(effectiveSummary.byMuscle.肩.weightedEffectiveSets).toBeGreaterThanOrEqual(0.75);
  });

  it('maps db-curl replaced by preacher-curl to preacher-curl without polluting db-curl', () => {
    const session = makeSession({
      id: 'preacher-curl-session',
      date: '2026-05-04',
      templateId: 'pull-a',
      exerciseId: 'db-curl',
      setSpecs: [{ weight: 12, reps: 10, rir: 2, techniqueQuality: 'good' }],
    });
    const replaced = applyExerciseReplacement(session, 0, 'preacher-curl');
    replaced.exercises[0].sets = [
      { id: 'preacher-1', type: 'working', weight: 22, reps: 10, rir: 2, techniqueQuality: 'good', done: true },
    ];

    const prs = buildPrs([replaced]);
    const preacherE1rm = buildE1RMProfile([replaced], 'preacher-curl');
    const dbCurlE1rm = buildE1RMProfile([replaced], 'db-curl');
    const effectiveSummary = buildEffectiveVolumeSummary([replaced]);

    expect(replaced.exercises[0]).toMatchObject({
      originalExerciseId: 'db-curl',
      actualExerciseId: 'preacher-curl',
      replacementExerciseId: 'preacher-curl',
    });
    expect(getExerciseRecordPoolId(replaced.exercises[0])).toBe('preacher-curl');
    expect(prs.some((item) => item.exerciseId === 'preacher-curl')).toBe(true);
    expect(prs.some((item) => item.exerciseId === 'db-curl')).toBe(false);
    expect(preacherE1rm.best?.exerciseId).toBe('preacher-curl');
    expect(dbCurlE1rm.best).toBeUndefined();
    expect(effectiveSummary.byMuscle.手臂.weightedEffectiveSets).toBeGreaterThanOrEqual(0.75);
  });

  it('maps triceps-pushdown replaced by overhead cable extension to the actual exercise record pool', () => {
    const session = makeSession({
      id: 'overhead-triceps-session',
      date: '2026-05-04',
      templateId: 'push-a',
      exerciseId: 'triceps-pushdown',
      setSpecs: [{ weight: 25, reps: 12, rir: 2, techniqueQuality: 'good' }],
    });
    const replaced = applyExerciseReplacement(session, 0, 'overhead-cable-triceps-extension');
    replaced.exercises[0].sets = [
      { id: 'overhead-triceps-1', type: 'working', weight: 20, reps: 12, rir: 2, techniqueQuality: 'good', done: true },
    ];

    const prs = buildPrs([replaced]);
    const overheadE1rm = buildE1RMProfile([replaced], 'overhead-cable-triceps-extension');
    const pushdownE1rm = buildE1RMProfile([replaced], 'triceps-pushdown');
    const effectiveSummary = buildEffectiveVolumeSummary([replaced]);

    expect(replaced.exercises[0]).toMatchObject({
      originalExerciseId: 'triceps-pushdown',
      actualExerciseId: 'overhead-cable-triceps-extension',
      replacementExerciseId: 'overhead-cable-triceps-extension',
    });
    expect(getExerciseRecordPoolId(replaced.exercises[0])).toBe('overhead-cable-triceps-extension');
    expect(prs.some((item) => item.exerciseId === 'overhead-cable-triceps-extension')).toBe(true);
    expect(prs.some((item) => item.exerciseId === 'triceps-pushdown')).toBe(false);
    expect(overheadE1rm.best?.exerciseId).toBe('overhead-cable-triceps-extension');
    expect(pushdownE1rm.best).toBeUndefined();
    expect(effectiveSummary.byMuscle.手臂.weightedEffectiveSets).toBeGreaterThanOrEqual(0.75);
  });
});
