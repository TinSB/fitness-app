import { describe, expect, it } from 'vitest';
import { buildPrs } from '../src/engines/analytics';
import { buildEffectiveVolumeSummary } from '../src/engines/effectiveSetEngine';
import { buildE1RMProfile, getExerciseRecordPoolId } from '../src/engines/e1rmEngine';
import { applyExerciseReplacement, buildReplacementOptions } from '../src/engines/replacementEngine';
import type { ExercisePrescription, TrainingSession } from '../src/models/training-model';

const exercise = (id: string): ExercisePrescription =>
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

const sessionWith = (id: string): TrainingSession =>
  ({
    id: `${id}-session`,
    date: '2026-05-04',
    templateId: 'audit',
    templateName: '审计',
    trainingMode: 'hybrid',
    focus: '综合',
    completed: true,
    dataFlag: 'normal',
    exercises: [exercise(id)],
  }) as TrainingSession;

describe('replacement equipment statistics boundary', () => {
  it('keeps equipment context out of replacement identity and record pools', () => {
    const selected = buildReplacementOptions(exercise('incline-db-press'), { unavailableEquipment: ['dumbbell'] })[0];
    const replaced = applyExerciseReplacement(sessionWith('incline-db-press'), 0, selected.id);

    expect(selected.id).toBe('smith-incline-press');
    expect(replaced.exercises[0]).toMatchObject({
      originalExerciseId: 'incline-db-press',
      actualExerciseId: 'smith-incline-press',
      replacementExerciseId: 'smith-incline-press',
    });
    expect(JSON.stringify(replaced)).not.toMatch(/unavailableEquipment|dumbbell/);
    expect(getExerciseRecordPoolId(replaced.exercises[0])).toBe('smith-incline-press');
    expect(buildPrs([replaced]).map((item) => item.exerciseId)).toContain('smith-incline-press');
    expect(buildPrs([replaced]).map((item) => item.exerciseId)).not.toContain('incline-db-press');
    expect(buildE1RMProfile([replaced], 'smith-incline-press').best?.exerciseId).toBe('smith-incline-press');
  });

  it('continues using actual exercise muscle contribution after crowded-gym sorting', () => {
    const selected = buildReplacementOptions(exercise('triceps-pushdown'), { unavailableEquipment: ['cable'] }).find((option) => option.id === 'assisted-dip');
    const replaced = applyExerciseReplacement(sessionWith('triceps-pushdown'), 0, selected?.id || 'assisted-dip');
    const summary = buildEffectiveVolumeSummary([replaced]);

    expect(getExerciseRecordPoolId(replaced.exercises[0])).toBe('assisted-dip');
    expect(summary.byMuscle['胸'].weightedEffectiveSets).toBeGreaterThan(summary.byMuscle['手臂'].weightedEffectiveSets);
    expect(summary.byMuscle['手臂'].weightedEffectiveSets).toBeGreaterThan(0);
  });
});
