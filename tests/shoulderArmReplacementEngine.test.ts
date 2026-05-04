import { describe, expect, it } from 'vitest';
import { buildReplacementOptions } from '../src/engines/replacementEngine';
import type { ExercisePrescription } from '../src/models/training-model';

const exercise = (id: string, muscle = '肩'): ExercisePrescription =>
  ({
    id,
    baseId: id,
    canonicalExerciseId: id,
    actualExerciseId: id,
    name: id,
    muscle,
    kind: 'isolation',
    sets: [],
    repMin: 8,
    repMax: 12,
    rest: 90,
    startWeight: 10,
  }) as ExercisePrescription;

const optionsFor = (id: string, muscle?: string) => buildReplacementOptions(exercise(id, muscle));
const idsFor = (id: string, muscle?: string) => optionsFor(id, muscle).map((option) => option.id);

describe('shoulder and arm replacement engine', () => {
  it('builds shoulder-press replacements only from vertical or angled press options', () => {
    const options = optionsFor('shoulder-press');
    const ids = options.map((option) => option.id);

    expect(ids).toEqual(['machine-shoulder-press', 'smith-shoulder-press', 'landmine-press', 'db-bench-press']);
    expect(options.find((option) => option.id === 'machine-shoulder-press')).toMatchObject({ rank: 'priority', rankLabel: '优先' });
    expect(options.find((option) => option.id === 'smith-shoulder-press')).toMatchObject({ rank: 'priority', rankLabel: '优先' });
    expect(options.find((option) => option.id === 'landmine-press')).toMatchObject({ rank: 'acceptable', rankLabel: '可接受' });
    expect(options.find((option) => option.id === 'landmine-press')?.reason).toContain('不是垂直推完全等价替代');
    expect(ids).not.toEqual(expect.arrayContaining(['lateral-raise', 'triceps-pushdown', 'cable-fly']));
  });

  it('builds lateral-raise replacements without putting rear-delt work ahead', () => {
    const options = optionsFor('lateral-raise');
    const ids = options.map((option) => option.id);

    expect(ids).toEqual(['cable-lateral-raise', 'machine-lateral-raise']);
    expect(options.every((option) => option.rank === 'priority')).toBe(true);
    expect(ids).not.toContain('rear-delt-raise');
    expect(ids).not.toContain('shoulder-press');
  });

  it('builds db-curl replacements with hammer curl only optional', () => {
    const options = optionsFor('db-curl', '手臂');
    const ids = options.map((option) => option.id);

    expect(ids).toEqual(['ez-bar-curl', 'preacher-curl', 'cable-curl', 'incline-db-curl', 'hammer-curl']);
    expect(options.find((option) => option.id === 'ez-bar-curl')?.rank).toBe('priority');
    expect(options.find((option) => option.id === 'preacher-curl')?.rank).toBe('priority');
    expect(options.find((option) => option.id === 'cable-curl')?.rank).toBe('priority');
    expect(options.find((option) => option.id === 'incline-db-curl')?.rank).toBe('acceptable');
    expect(options.find((option) => option.id === 'hammer-curl')).toMatchObject({ rank: 'optional', rankLabel: '可选' });
    expect(options.find((option) => option.id === 'hammer-curl')?.reason).toContain('握法侧重点不同');
  });

  it('builds hammer-curl replacements with db-curl acceptable but not priority', () => {
    const options = optionsFor('hammer-curl', '手臂');
    const ids = options.map((option) => option.id);

    expect(ids).toEqual(['rope-hammer-curl', 'db-curl', 'ez-bar-curl']);
    expect(options.find((option) => option.id === 'rope-hammer-curl')).toMatchObject({ rank: 'priority', rankLabel: '优先' });
    expect(options.find((option) => option.id === 'db-curl')).toMatchObject({ rank: 'acceptable', rankLabel: '可接受' });
    expect(options.find((option) => option.id === 'ez-bar-curl')).toMatchObject({ rank: 'optional', rankLabel: '可选' });
  });

  it('builds triceps-pushdown replacements without duplicate rope pushdown identity', () => {
    const options = optionsFor('triceps-pushdown', '手臂');
    const ids = options.map((option) => option.id);

    expect(ids).toEqual(['straight-bar-pushdown', 'overhead-cable-triceps-extension', 'skull-crusher', 'close-grip-bench', 'assisted-dip']);
    expect(ids).not.toContain('rope-triceps-pushdown');
    expect(options.find((option) => option.id === 'straight-bar-pushdown')).toMatchObject({ rank: 'priority', rankLabel: '优先' });
    expect(options.find((option) => option.id === 'overhead-cable-triceps-extension')).toMatchObject({ rank: 'acceptable', rankLabel: '可接受' });
    expect(options.find((option) => option.id === 'skull-crusher')).toMatchObject({ rank: 'optional', rankLabel: '可选' });
    expect(options.find((option) => option.id === 'close-grip-bench')).toMatchObject({ rank: 'compound_fallback', rankLabel: '复合动作替代' });
    expect(options.find((option) => option.id === 'assisted-dip')).toMatchObject({ rank: 'compound_fallback', rankLabel: '复合动作替代' });
    expect(ids).not.toEqual(expect.arrayContaining(['bench-press', 'shoulder-press', 'cable-fly']));
  });

  it('does not show missing, self, not-recommended or synthetic replacement ids', () => {
    const ids = [
      ...idsFor('shoulder-press'),
      ...idsFor('lateral-raise'),
      ...idsFor('db-curl', '手臂'),
      ...idsFor('triceps-pushdown', '手臂'),
    ];

    expect(ids).not.toContain('shoulder-press');
    expect(ids).not.toContain('triceps-pushdown');
    expect(ids.some((id) => id.includes('__alt_') || id.includes('__auto_alt'))).toBe(false);
  });
});
