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
    muscle: '背',
    kind: 'machine',
    sets: [],
    repMin: 8,
    repMax: 12,
    rest: 120,
    startWeight: 40,
  }) as ExercisePrescription;

const idsFor = (id: string) => buildReplacementOptions(exercise(id)).map((option) => option.id);

describe('pull replacement engine', () => {
  it('sorts lat-pulldown replacements by vertical-pull priority and hides not recommended options', () => {
    const options = buildReplacementOptions(exercise('lat-pulldown'));
    const ids = options.map((option) => option.id);

    expect(ids.slice(0, 3)).toEqual(['assisted-pull-up', 'pull-up', 'single-arm-lat-pulldown']);
    expect(ids).toEqual(expect.arrayContaining(['machine-row', 'seated-row']));
    expect(ids).not.toContain('triceps-pushdown');
    expect(ids).not.toContain('cable-fly');
    expect(ids).not.toContain('shoulder-press');
    expect(options.find((option) => option.id === 'assisted-pull-up')).toMatchObject({
      rank: 'priority',
      rankLabel: '优先',
    });
    expect(options.find((option) => option.id === 'single-arm-lat-pulldown')).toMatchObject({
      rank: 'angle',
      rankLabel: '角度相近',
    });
  });

  it('labels optional and equipment fallback replacements with Chinese explanation', () => {
    const options = buildReplacementOptions(exercise('lat-pulldown'));
    const machineRow = options.find((option) => option.id === 'machine-row');
    const seatedRow = options.find((option) => option.id === 'seated-row');

    expect(machineRow).toMatchObject({
      rank: 'equipment_fallback',
      rankLabel: '器械不可用时',
    });
    expect(machineRow?.reason).toContain('不是一线垂直拉等价替代');
    expect(seatedRow).toMatchObject({
      rank: 'optional',
      rankLabel: '可选',
    });
    expect(seatedRow?.reason).toContain('背部补量');
    expect(`${machineRow?.rankLabel} ${machineRow?.reason} ${seatedRow?.rankLabel} ${seatedRow?.reason}`).not.toMatch(
      /equipment_fallback|optional|undefined|null/
    );
  });

  it('builds seated-row replacements without confusing horizontal and vertical pulls', () => {
    const options = buildReplacementOptions(exercise('seated-row'));
    const ids = options.map((option) => option.id);

    expect(ids.slice(0, 2)).toEqual(['chest-supported-row', 'machine-row']);
    expect(ids).toContain('one-arm-db-row');
    expect(ids).not.toContain('lat-pulldown');
    expect(options.find((option) => option.id === 'one-arm-db-row')?.rank).toBe('acceptable');
  });

  it('builds barbell-row replacements with fatigue-reducing row options first', () => {
    const options = buildReplacementOptions(exercise('barbell-row'));
    const ids = options.map((option) => option.id);

    expect(ids.slice(0, 2)).toEqual(['chest-supported-row', 't-bar-row']);
    expect(ids).toEqual(expect.arrayContaining(['one-arm-db-row', 'seated-row', 'machine-row']));
    expect(options.find((option) => option.id === 'machine-row')).toMatchObject({
      rank: 'optional',
      rankLabel: '可选',
    });
  });

  it('builds face-pull replacements as rear-delt and scapular-control options', () => {
    const options = buildReplacementOptions(exercise('face-pull'));
    const ids = options.map((option) => option.id);

    expect(ids.slice(0, 2)).toEqual(['reverse-pec-deck', 'cable-rear-delt-fly']);
    expect(options.find((option) => option.id === 'reverse-pec-deck')?.reason).toContain('肩后束');
    expect(options.find((option) => option.id === 'reverse-pec-deck')?.reason).toContain('不作为背部主训练替代');
    expect(options.map((option) => option.name).join(' ')).toContain('反向飞鸟');
    expect(options.map((option) => option.name).join(' ')).toContain('绳索后束飞鸟');
  });

  it('does not include missing, synthetic or self replacement ids', () => {
    const ids = idsFor('lat-pulldown');

    expect(ids).not.toContain('lat-pulldown');
    expect(ids.some((id) => id.includes('__alt_') || id.includes('__auto_alt'))).toBe(false);
  });
});
