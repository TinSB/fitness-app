import { describe, expect, it } from 'vitest';
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

const idsFor = (id: string, unavailableEquipment?: Parameters<typeof buildReplacementOptions>[1]['unavailableEquipment']) =>
  buildReplacementOptions(exercise(id), { unavailableEquipment }).map((option) => option.id);

describe('crowded gym replacement strategy', () => {
  it('keeps existing ordering when no equipment context is provided', () => {
    expect(idsFor('incline-db-press')).toEqual(['smith-incline-press', 'machine-incline-chest-press', 'machine-chest-press', 'db-bench-press']);
    expect(idsFor('triceps-pushdown')).toEqual([
      'straight-bar-pushdown',
      'overhead-cable-triceps-extension',
      'skull-crusher',
      'close-grip-bench',
      'assisted-dip',
    ]);
  });

  it('prioritizes non-dumbbell incline press options when the dumbbell area is unavailable', () => {
    const ids = idsFor('incline-db-press', ['dumbbell']);

    expect(ids.slice(0, 3)).toEqual(['smith-incline-press', 'machine-incline-chest-press', 'machine-chest-press']);
    expect(ids.indexOf('db-bench-press')).toBeGreaterThan(ids.indexOf('machine-chest-press'));
  });

  it('prioritizes non-cable chest fly options when the cable area is unavailable', () => {
    const ids = idsFor('cable-fly', ['cable']);

    expect(ids.slice(0, 3)).toEqual(['pec-deck-fly', 'db-fly', 'machine-chest-press']);
    expect(ids).toContain('assisted-dip');
    expect(buildReplacementOptions(exercise('cable-fly'), { unavailableEquipment: ['cable'] }).find((option) => option.id === 'assisted-dip')?.rank).toBe(
      'compound_fallback'
    );
  });

  it('prioritizes rack-free squat options when rack and barbell are unavailable', () => {
    const ids = idsFor('squat', ['rack', 'barbell']);

    expect(ids.slice(0, 4)).toEqual(['hack-squat', 'smith-squat', 'leg-press', 'belt-squat']);
    expect(ids).not.toContain('romanian-deadlift');
    expect(ids).not.toContain('calf-raise');
  });

  it('demotes cable-dependent triceps options when cable is unavailable without showing unsafe options', () => {
    const options = buildReplacementOptions(exercise('triceps-pushdown'), { unavailableEquipment: ['cable'] });
    const ids = options.map((option) => option.id);

    expect(ids.slice(0, 3)).toEqual(['skull-crusher', 'close-grip-bench', 'assisted-dip']);
    expect(ids.indexOf('straight-bar-pushdown')).toBeGreaterThan(ids.indexOf('assisted-dip'));
    expect(ids).not.toContain('bench-press');
    expect(ids).not.toContain('shoulder-press');
    expect(ids).not.toContain('cable-fly');
  });
});
