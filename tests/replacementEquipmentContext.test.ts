import { describe, expect, it } from 'vitest';
import { EXERCISE_EQUIPMENT_TAGS } from '../src/data/exerciseLibrary';
import { buildReplacementOptions } from '../src/engines/replacementEngine';
import type { ExercisePrescription } from '../src/models/training-model';

const exercise = (id: string): ExercisePrescription =>
  ({
    id,
    baseId: id,
    canonicalExerciseId: id,
    actualExerciseId: id,
    name: id,
    muscle: '综合',
    kind: 'compound',
    sets: [],
    repMin: 8,
    repMax: 12,
    rest: 120,
    startWeight: 40,
  }) as ExercisePrescription;

describe('replacement equipment context', () => {
  it('defines equipment tags for main lifts and common replacements', () => {
    expect(EXERCISE_EQUIPMENT_TAGS['incline-db-press']).toEqual(expect.arrayContaining(['dumbbell', 'bench']));
    expect(EXERCISE_EQUIPMENT_TAGS['smith-incline-press']).toEqual(expect.arrayContaining(['smith', 'machine']));
    expect(EXERCISE_EQUIPMENT_TAGS['cable-fly']).toContain('cable');
    expect(EXERCISE_EQUIPMENT_TAGS.squat).toEqual(expect.arrayContaining(['barbell', 'rack']));
    expect(EXERCISE_EQUIPMENT_TAGS['straight-bar-pushdown']).toContain('cable');
    expect(EXERCISE_EQUIPMENT_TAGS['skull-crusher']).not.toContain('cable');
  });

  it('does not allow equipment context to reveal not-recommended or avoid options', () => {
    const benchOptions = buildReplacementOptions(exercise('bench-press'), { unavailableEquipment: ['barbell', 'rack'] });
    const shoulderOptions = buildReplacementOptions(exercise('shoulder-press'), { unavailableEquipment: ['dumbbell'] });

    expect(benchOptions.map((option) => option.id)).not.toEqual(expect.arrayContaining(['cable-fly', 'triceps-pushdown', 'shoulder-press']));
    expect(shoulderOptions.map((option) => option.id)).not.toContain('lateral-raise');
  });

  it('treats machine as a weak sorting signal instead of a blanket blocker', () => {
    const ids = buildReplacementOptions(exercise('incline-db-press'), { unavailableEquipment: ['machine'] }).map((option) => option.id);

    expect(ids.slice(0, 2)).toEqual(['smith-incline-press', 'machine-incline-chest-press']);
    expect(ids).toContain('machine-chest-press');
  });
});
