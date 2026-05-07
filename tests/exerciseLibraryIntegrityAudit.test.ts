import { describe, expect, it } from 'vitest';
import {
  EXERCISE_DISPLAY_NAMES,
  EXERCISE_EQUIVALENCE_CHAINS,
  EXERCISE_KNOWLEDGE_OVERRIDES,
  formatExerciseDisplayName,
} from '../src/data/exerciseLibrary';
import { validateReplacementExerciseId } from '../src/engines/replacementEngine';

const syntheticPattern = /__auto_alt|__auto_alt_alt|__alt_/;
const mainExerciseIds = () =>
  Array.from(new Set([...Object.keys(EXERCISE_KNOWLEDGE_OVERRIDES), ...Object.keys(EXERCISE_EQUIVALENCE_CHAINS)])).sort();

describe('exercise library integrity audit', () => {
  it('keeps main exercise ids unique, stable and free of synthetic ids', () => {
    const ids = mainExerciseIds();

    expect(new Set(ids).size).toBe(ids.length);
    ids.forEach((id) => {
      expect(id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      expect(id).not.toMatch(syntheticPattern);
    });
  });

  it('formats every main exercise with a Chinese display name', () => {
    const unnamed: string[] = [];
    const invalidVisibleText: string[] = [];

    mainExerciseIds().forEach((id) => {
      const label = formatExerciseDisplayName(id);
      if (!/[\u3400-\u9fff]/.test(label) || label.includes('未命名动作')) unnamed.push(`${id}:${label}`);
      if (/undefined|null|__auto_alt|__alt_/.test(label)) invalidVisibleText.push(`${id}:${label}`);
    });

    expect(unnamed).toEqual([]);
    expect(invalidVisibleText).toEqual([]);
  });

  it('keeps key similar exercise display names distinct', () => {
    const groups = [
      ['seated-row', 'machine-row', 'chest-supported-row', 't-bar-row'],
      ['incline-db-press', 'smith-incline-press', 'machine-incline-chest-press', 'cable-fly', 'pec-deck-fly', 'db-fly'],
      ['lateral-raise', 'cable-lateral-raise', 'machine-lateral-raise', 'rear-delt-raise', 'reverse-pec-deck', 'cable-rear-delt-fly'],
      ['triceps-pushdown', 'straight-bar-pushdown', 'overhead-cable-triceps-extension', 'skull-crusher'],
      ['db-curl', 'preacher-curl', 'rope-hammer-curl'],
    ];

    groups.forEach((ids) => {
      const labels = ids.map((id) => formatExerciseDisplayName(id));
      expect(labels.every((label) => /[\u3400-\u9fff]/.test(label))).toBe(true);
      expect(new Set(labels).size).toBe(labels.length);
      expect(labels.join(' ')).not.toMatch(/未命名动作|undefined|null/);
    });
  });

  it('treats every main exercise id as a valid replacement identity', () => {
    const invalidIds = mainExerciseIds().filter((id) => !validateReplacementExerciseId(id));

    expect(invalidIds).toEqual([]);
    expect(EXERCISE_DISPLAY_NAMES['assisted-pull-up']).toBe('辅助引体向上');
    expect(validateReplacementExerciseId('assisted-pull-up')).toBe(true);
  });
});
