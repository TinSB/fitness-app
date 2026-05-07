import { describe, expect, it } from 'vitest';
import { buildPrs } from '../src/engines/analytics';
import { buildEffectiveVolumeSummary } from '../src/engines/effectiveSetEngine';
import { buildE1RMProfile, getExerciseRecordPoolId } from '../src/engines/e1rmEngine';
import { applyExerciseReplacement } from '../src/engines/replacementEngine';
import type { ExercisePrescription, TrainingSession } from '../src/models/training-model';

const baseExercise = (id: string): ExercisePrescription =>
  ({
    id,
    baseId: id,
    canonicalExerciseId: id,
    actualExerciseId: id,
    name: id,
    muscle: '综合',
    kind: 'compound',
    sets: [{ id: `${id}-1`, type: 'working', weight: 40, reps: 10, rir: 2, done: true, techniqueQuality: 'good' }],
    repMin: 8,
    repMax: 12,
    rest: 120,
    startWeight: 40,
  }) as ExercisePrescription;

const sessionWith = (exerciseId: string): TrainingSession =>
  ({
    id: `${exerciseId}-session`,
    date: '2026-05-04',
    templateId: 'audit',
    templateName: '审计',
    trainingMode: 'hybrid',
    focus: '综合',
    completed: true,
    dataFlag: 'normal',
    exercises: [baseExercise(exerciseId)],
  }) as TrainingSession;

describe('replacement statistics boundary', () => {
  it('uses actualExerciseId for PR and e1RM record pools after replacement', () => {
    const replaced = applyExerciseReplacement(sessionWith('cable-fly'), 0, 'assisted-dip');

    expect(replaced.exercises[0]).toMatchObject({
      originalExerciseId: 'cable-fly',
      actualExerciseId: 'assisted-dip',
      replacementExerciseId: 'assisted-dip',
    });
    expect(getExerciseRecordPoolId(replaced.exercises[0])).toBe('assisted-dip');
    expect(buildPrs([replaced]).map((item) => item.exerciseId)).toContain('assisted-dip');
    expect(buildPrs([replaced]).map((item) => item.exerciseId)).not.toContain('cable-fly');
    expect(buildE1RMProfile([replaced], 'assisted-dip').best?.exerciseId).toBe('assisted-dip');
    expect(buildE1RMProfile([replaced], 'cable-fly').best).toBeUndefined();
  });

  it('uses actual exercise muscle contribution for compound fallback replacements', () => {
    const replaced = applyExerciseReplacement(sessionWith('triceps-pushdown'), 0, 'assisted-dip');
    const summary = buildEffectiveVolumeSummary([replaced]);

    expect(getExerciseRecordPoolId(replaced.exercises[0])).toBe('assisted-dip');
    expect(summary.byMuscle['胸'].weightedEffectiveSets).toBeGreaterThan(summary.byMuscle['手臂'].weightedEffectiveSets);
    expect(summary.byMuscle['手臂'].weightedEffectiveSets).toBeGreaterThan(0);
  });

  it('keeps rear-delt replacement volume shoulder-focused instead of main-back focused', () => {
    const replaced = applyExerciseReplacement(sessionWith('face-pull'), 0, 'reverse-pec-deck');
    const summary = buildEffectiveVolumeSummary([replaced]);

    expect(getExerciseRecordPoolId(replaced.exercises[0])).toBe('reverse-pec-deck');
    expect(summary.byMuscle['肩'].weightedEffectiveSets).toBeGreaterThan(summary.byMuscle['背'].weightedEffectiveSets);
    expect(summary.byMuscle['背'].weightedEffectiveSets).toBeLessThan(0.5);
  });

  it('excludes invalid or synthetic identity from record pools and effective sets', () => {
    const invalid = sessionWith('lat-pulldown');
    invalid.exercises[0] = {
      ...invalid.exercises[0],
      actualExerciseId: '__auto_alt',
      legacyActualExerciseId: '__auto_alt',
      identityInvalid: true,
    };

    expect(getExerciseRecordPoolId(invalid.exercises[0])).toBe('');
    expect(buildPrs([invalid])).toHaveLength(0);
    expect(buildE1RMProfile([invalid], 'lat-pulldown').best).toBeUndefined();
    expect(buildEffectiveVolumeSummary([invalid]).completedSets).toBe(0);
  });
});
