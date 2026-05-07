import { describe, expect, it } from 'vitest';
import { EXERCISE_EQUIVALENCE_CHAINS, EXERCISE_KNOWLEDGE_OVERRIDES } from '../src/data/exerciseLibrary';
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

const optionIds = (id: string) => buildReplacementOptions(exercise(id)).map((option) => option.id);
const priorityOf = (sourceId: string, targetId: string) =>
  (EXERCISE_KNOWLEDGE_OVERRIDES[sourceId]?.alternativePriorities as Record<string, string> | undefined)?.[targetId];

describe('replacement chain integrity', () => {
  it('keeps equivalence chains separated by movement pattern', () => {
    expect(EXERCISE_EQUIVALENCE_CHAINS['assisted-pull-up']).toMatchObject({ id: 'vertical-pull' });
    expect(EXERCISE_EQUIVALENCE_CHAINS['assisted-pull-up'].members).not.toContain('seated-row');

    expect(EXERCISE_EQUIVALENCE_CHAINS['face-pull']).toMatchObject({ id: 'rear-delt' });
    expect(EXERCISE_EQUIVALENCE_CHAINS['rear-delt-raise'].members).toEqual(
      expect.arrayContaining(['rear-delt-raise', 'reverse-pec-deck', 'cable-rear-delt-fly'])
    );
    expect(EXERCISE_EQUIVALENCE_CHAINS['rear-delt-raise'].members).not.toContain('barbell-row');

    expect(EXERCISE_EQUIVALENCE_CHAINS.squat.members).not.toContain('calf-raise');
    expect(EXERCISE_EQUIVALENCE_CHAINS['romanian-deadlift'].members).not.toContain('calf-raise');
    expect(EXERCISE_EQUIVALENCE_CHAINS['calf-raise'].members).not.toContain('squat');
  });

  it('does not promote non-equivalent alternatives to priority', () => {
    expect(priorityOf('romanian-deadlift', 'db-rdl')).toBe('priority');
    expect(priorityOf('romanian-deadlift', 'hip-thrust')).not.toBe('priority');
    expect(priorityOf('romanian-deadlift', 'leg-curl')).toBe('optional');

    expect(priorityOf('triceps-pushdown', 'close-grip-bench')).toBe('compound_fallback');
    expect(priorityOf('triceps-pushdown', 'assisted-dip')).toBe('compound_fallback');
    expect(priorityOf('shoulder-press', 'lateral-raise')).toBe('not_recommended');
    expect(priorityOf('bench-press', 'cable-fly')).toBe('not_recommended');
  });

  it('does not show hidden, self, missing or synthetic replacements', () => {
    const squatIds = optionIds('squat');
    const rdlIds = optionIds('romanian-deadlift');
    const shoulderPressIds = optionIds('shoulder-press');

    expect(squatIds).not.toContain('squat');
    expect(squatIds).not.toContain('calf-raise');
    expect(squatIds).not.toContain('seated-calf-raise');
    expect(rdlIds).not.toContain('calf-raise');
    expect(shoulderPressIds).not.toContain('lateral-raise');
    expect([...squatIds, ...rdlIds, ...shoulderPressIds].some((id) => /__auto_alt|__alt_/.test(id))).toBe(false);
  });

  it('sorts replacement output by supported rank order', () => {
    const ranks = buildReplacementOptions(exercise('triceps-pushdown')).map((option) => option.rank);

    expect(ranks).toEqual(['priority', 'acceptable', 'optional', 'compound_fallback', 'compound_fallback']);
  });
});
