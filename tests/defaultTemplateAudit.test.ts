import { describe, expect, it } from 'vitest';
import { EXERCISE_DISPLAY_NAMES, INITIAL_TEMPLATES } from '../src/data/trainingData';
import { buildExerciseMetadata, hydrateTemplates } from '../src/engines/engineUtils';
import { buildReplacementOptions } from '../src/engines/replacementEngine';
import { buildSystemConsistencyReport, resolveTemplateAlternativeToExerciseId } from '../src/engines/systemConsistencyEngine';
import { makeAppData } from './fixtures';

describe('default template audit', () => {
  const templates = hydrateTemplates(INITIAL_TEMPLATES);

  it('keeps every template exercise tied to a Chinese display name and metadata', () => {
    for (const template of templates) {
      for (const exercise of template.exercises) {
        const metadata = buildExerciseMetadata(exercise);
        expect(EXERCISE_DISPLAY_NAMES[exercise.id], exercise.id).toBeTruthy();
        expect(exercise.kind, exercise.id).toBeTruthy();
        expect(metadata.movementPattern, exercise.id).toBeTruthy();
        expect(metadata.primaryMuscles?.length, exercise.id).toBeGreaterThan(0);
        expect(metadata.recommendedRepRange, exercise.id).toBeTruthy();
        expect(metadata.targetRir, exercise.id).toBeTruthy();
      }
    }
  });

  it('does not force isolation exercises to warm up by default', () => {
    const isolationExercises = templates.flatMap((template) => template.exercises).filter((exercise) => exercise.kind === 'isolation');
    expect(isolationExercises.length).toBeGreaterThan(0);
    for (const exercise of isolationExercises) {
      expect(buildExerciseMetadata(exercise).warmupPreference).not.toBe('always');
    }
  });

  it('keeps template exercise ids valid', () => {
    const exerciseIds = new Set(templates.flatMap((template) => template.exercises.map((exercise) => exercise.id)));
    for (const template of INITIAL_TEMPLATES) {
      for (const exercise of template.exercises) {
        expect(exerciseIds.has(exercise.id), `${template.id}/${exercise.id}`).toBe(true);
      }
    }
  });

  it('resolves known template alternatives to real exercise ids when aliases exist', () => {
    expect(resolveTemplateAlternativeToExerciseId('哑铃卧推')).toBe('db-bench-press');
    expect(resolveTemplateAlternativeToExerciseId('器械推胸')).toBe('machine-chest-press');
    expect(resolveTemplateAlternativeToExerciseId('引体向上')).toBe('pull-up');
    expect(resolveTemplateAlternativeToExerciseId('腿举')).toBe('leg-press');
  });

  it('does not offer invalid first-line bench press replacements', () => {
    const bench = templates.flatMap((template) => template.exercises).find((exercise) => exercise.id === 'bench-press');
    if (!bench) throw new Error('Missing bench-press');
    const ids = buildReplacementOptions(bench).map((option) => option.id);

    expect(ids).not.toContain('triceps-pushdown');
    expect(ids).not.toContain('shoulder-press');
    expect(ids).not.toContain('machine-shoulder-press');
    expect(ids).not.toContain('cable-fly');
  });

  it('reports unresolved template alternative labels as suggestions, not silent failures', () => {
    const report = buildSystemConsistencyReport(makeAppData());
    expect(report.errors.filter((item) => item.includes('替代动作'))).toEqual([]);
    expect(report.suggestions.length).toBeGreaterThan(0);
  });
});
