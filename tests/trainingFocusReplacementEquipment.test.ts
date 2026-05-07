import { describe, expect, it } from 'vitest';
import { buildSmartReplacementRecommendations } from '../src/engines/smartReplacementEngine';
import type { ExerciseEquipmentTag } from '../src/data/exerciseLibrary';
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
    sets: [{ id: `${id}-1`, type: 'working', weight: 40, reps: 10, rir: 2, done: false }],
    repMin: 8,
    repMax: 12,
    rest: 120,
    startWeight: 40,
  }) as ExercisePrescription;

const recommendationsFor = (id: string, unavailableEquipment?: ExerciseEquipmentTag[]) =>
  buildSmartReplacementRecommendations({
    currentExercise: exercise(id),
    exerciseLibrary: [],
    unavailableEquipment,
  }).filter((option) => option.priority !== 'avoid');

const idsFor = (id: string, unavailableEquipment?: ExerciseEquipmentTag[]) => recommendationsFor(id, unavailableEquipment).map((option) => option.exerciseId);

const visibleText = (id: string, unavailableEquipment?: ExerciseEquipmentTag[]) =>
  recommendationsFor(id, unavailableEquipment)
    .map((option) => `${option.exerciseName} ${option.reason} ${option.warnings.join(' ')}`)
    .join(' ');

describe('Training Focus replacement equipment context', () => {
  it('keeps smart replacement ordering unchanged when equipment context is omitted or empty', () => {
    expect(idsFor('incline-db-press', [])).toEqual(idsFor('incline-db-press'));
    expect(idsFor('cable-fly', [])).toEqual(idsFor('cable-fly'));
  });

  it('moves non-dumbbell incline press replacements forward when the dumbbell area is unavailable', () => {
    const ids = idsFor('incline-db-press', ['dumbbell']);
    const text = visibleText('incline-db-press', ['dumbbell']);

    expect(ids.slice(0, 3)).toEqual(['smith-incline-press', 'machine-incline-chest-press', 'machine-chest-press']);
    expect(ids.indexOf('db-bench-press')).toBeGreaterThan(ids.indexOf('machine-chest-press'));
    expect(text).toContain('避开哑铃区');
    expect(text).toContain('可在固定器械区完成');
    expect(text).not.toMatch(/\b(dumbbell|equipment_fallback|undefined|null|__alt_)\b/);
  });

  it('moves non-cable chest fly replacements forward when the cable area is unavailable', () => {
    const ids = idsFor('cable-fly', ['cable']);
    const text = visibleText('cable-fly', ['cable']);

    expect(ids.slice(0, 2)).toEqual(['pec-deck-fly', 'db-fly']);
    expect(ids.indexOf('assisted-dip')).toBeGreaterThanOrEqual(0);
    expect(text).toContain('不依赖绳索');
    expect(text).not.toMatch(/\b(cable|compound_fallback|undefined|null|__alt_)\b/);
  });

  it('moves rack-free squat replacements forward when rack and barbell are unavailable', () => {
    const ids = idsFor('squat', ['rack', 'barbell']);
    const text = visibleText('squat', ['rack', 'barbell']);

    expect(ids.slice(0, 3)).toEqual(['hack-squat', 'smith-squat', 'leg-press']);
    expect(ids.indexOf('romanian-deadlift')).toBeGreaterThan(ids.indexOf('leg-press'));
    expect(text).toContain('不需要深蹲架');
    expect(text).not.toMatch(/\b(rack|barbell|undefined|null|__alt_)\b/);
  });

  it('does not promote cable-dependent triceps options when cable is unavailable', () => {
    const ids = idsFor('triceps-pushdown', ['cable']);
    const text = visibleText('triceps-pushdown', ['cable']);

    expect(ids.slice(0, 3)).toEqual(['skull-crusher', 'close-grip-bench', 'assisted-dip']);
    expect(ids.indexOf('straight-bar-pushdown')).toBeGreaterThan(ids.indexOf('assisted-dip'));
    expect(text).toContain('不依赖绳索');
    expect(text).toContain('复合动作替代');
    expect(text).not.toMatch(/\b(cable|priority|secondary|angle_variation|undefined|null|__alt_)\b/);
  });
});
