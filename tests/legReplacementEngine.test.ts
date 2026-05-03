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
    muscle: '腿',
    kind: 'compound',
    sets: [],
    repMin: 8,
    repMax: 12,
    rest: 120,
    startWeight: 40,
  }) as ExercisePrescription;

const optionsFor = (id: string) => buildReplacementOptions(exercise(id));
const idsFor = (id: string) => optionsFor(id).map((option) => option.id);

describe('leg replacement engine', () => {
  it('builds squat replacements without mixing in knee-flexion or calf work', () => {
    const options = optionsFor('squat');
    const ids = options.map((option) => option.id);

    expect(ids).toEqual(['hack-squat', 'smith-squat', 'leg-press', 'belt-squat', 'goblet-squat']);
    expect(options.find((option) => option.id === 'hack-squat')?.rank).toBe('priority');
    expect(options.find((option) => option.id === 'smith-squat')?.rank).toBe('priority');
    expect(options.find((option) => option.id === 'leg-press')?.rank).toBe('acceptable');
    expect(options.find((option) => option.id === 'belt-squat')?.rank).toBe('acceptable');
    expect(options.find((option) => option.id === 'goblet-squat')?.rank).toBe('optional');
    expect(ids).not.toEqual(expect.arrayContaining(['leg-curl', 'calf-raise', 'seated-calf-raise']));
  });

  it('labels leg press and belt squat as acceptable rather than fully equivalent squat replacements', () => {
    const options = optionsFor('squat');
    const legPress = options.find((option) => option.id === 'leg-press');
    const beltSquat = options.find((option) => option.id === 'belt-squat');

    expect(legPress).toMatchObject({ rank: 'acceptable', rankLabel: '可接受' });
    expect(legPress?.reason).toContain('不是完全等价');
    expect(beltSquat).toMatchObject({ rank: 'acceptable', rankLabel: '可接受' });
    expect(beltSquat?.reason).toContain('不是完全等价');
  });

  it('builds RDL replacements with db-rdl first, hip-thrust as fatigue reduction, and curls after that', () => {
    const options = optionsFor('romanian-deadlift');
    const ids = options.map((option) => option.id);

    expect(ids).toEqual(['db-rdl', 'hip-thrust', 'leg-curl', 'seated-leg-curl', 'lying-leg-curl']);
    expect(options.find((option) => option.id === 'db-rdl')).toMatchObject({ rank: 'priority', rankLabel: '优先' });
    expect(options.find((option) => option.id === 'hip-thrust')).toMatchObject({ rank: 'acceptable', rankLabel: '可接受' });
    expect(options.find((option) => option.id === 'hip-thrust')?.reason).toContain('臀推更偏髋伸和臀腿后链');
    expect(options.find((option) => option.id === 'hip-thrust')?.reason).toContain('不是髋铰链完全等价');
    expect(options.findIndex((option) => option.id === 'leg-curl')).toBeGreaterThan(options.findIndex((option) => option.id === 'hip-thrust'));
    expect(ids).not.toEqual(expect.arrayContaining(['calf-raise', 'leg-extension']));
  });

  it('builds leg-curl replacements without putting RDL ahead of curl variants', () => {
    const options = optionsFor('leg-curl');
    const ids = options.map((option) => option.id);

    expect(ids).toEqual(['seated-leg-curl', 'lying-leg-curl', 'nordic-curl', 'romanian-deadlift']);
    expect(options.find((option) => option.id === 'seated-leg-curl')?.rank).toBe('priority');
    expect(options.find((option) => option.id === 'lying-leg-curl')?.rank).toBe('priority');
    expect(options.find((option) => option.id === 'nordic-curl')?.rank).toBe('acceptable');
    expect(options.find((option) => option.id === 'romanian-deadlift')?.rank).toBe('optional');
    expect(ids.indexOf('romanian-deadlift')).toBeGreaterThan(ids.indexOf('nordic-curl'));
  });

  it('builds calf-raise replacements only from the calf chain', () => {
    const options = optionsFor('calf-raise');
    const ids = options.map((option) => option.id);

    expect(ids).toEqual(['seated-calf-raise', 'standing-calf-raise', 'leg-press-calf-raise']);
    expect(options.find((option) => option.id === 'seated-calf-raise')?.rank).toBe('priority');
    expect(options.find((option) => option.id === 'standing-calf-raise')?.rank).toBe('priority');
    expect(options.find((option) => option.id === 'leg-press-calf-raise')?.rank).toBe('acceptable');
    expect(ids).not.toEqual(expect.arrayContaining(['squat', 'romanian-deadlift', 'leg-curl']));
  });

  it('does not show missing, self, synthetic or raw not-recommended replacements', () => {
    expect(idsFor('squat')).not.toContain('squat');
    expect(idsFor('romanian-deadlift')).not.toContain('calf-raise');
    expect(idsFor('romanian-deadlift')).not.toContain('leg-extension');
    expect([...idsFor('squat'), ...idsFor('romanian-deadlift'), ...idsFor('calf-raise')].some((id) => id.includes('__alt_'))).toBe(false);
  });
});
