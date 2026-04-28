import { describe, expect, it } from 'vitest';
import { ACTIVE_DEFAULT_TEMPLATE_SCHEMA_VERSION, EXERCISE_DISPLAY_NAMES, INITIAL_TEMPLATES } from '../src/data/trainingData';
import { auditExerciseLibrary } from '../src/engines/exerciseDataAuditEngine';
import { buildExerciseMetadata, hydrateTemplates } from '../src/engines/engineUtils';
import { buildReplacementOptions } from '../src/engines/replacementEngine';
import { STORAGE_VERSION } from '../src/data/appConfig';
import { formatFatigueCost, formatReplacementCategory, formatSkillDemand } from '../src/i18n/formatters';
import { formatWeight } from '../src/engines/unitConversionEngine';

describe('exercise template regression', () => {
  const templates = hydrateTemplates(INITIAL_TEMPLATES);
  const exercises = templates.flatMap((template) => template.exercises);

  it('uses the latest default template schema version', () => {
    expect(ACTIVE_DEFAULT_TEMPLATE_SCHEMA_VERSION).toBe(STORAGE_VERSION);
  });

  it('keeps push/pull/legs template exercise ids and relationship ids valid', () => {
    const scopedExercises = templates
      .filter((template) => ['push-a', 'pull-a', 'legs-a'].includes(template.id))
      .flatMap((template) => template.exercises);
    const report = auditExerciseLibrary(scopedExercises);

    expect(report.errors).toEqual([]);
  });

  it('requires Chinese names and explicit primary muscle contribution for active exercises', () => {
    for (const exercise of exercises) {
      const metadata = buildExerciseMetadata(exercise);
      expect(EXERCISE_DISPLAY_NAMES[exercise.id], exercise.id).toBeTruthy();
      for (const muscle of metadata.primaryMuscles || []) {
        expect(metadata.muscleContribution?.[muscle], `${exercise.id}/${muscle}`).toBeGreaterThan(0);
      }
    }
  });

  it('keeps isolation exercises out of forced warmup by default', () => {
    const isolationExercises = exercises.filter((exercise) => exercise.kind === 'isolation');

    expect(isolationExercises.length).toBeGreaterThan(0);
    isolationExercises.forEach((exercise) => {
      expect(buildExerciseMetadata(exercise).warmupPreference).not.toBe('always');
    });
  });

  it('uses stable ids and clear priority for bench press replacements', () => {
    const bench = exercises.find((exercise) => exercise.id === 'bench-press');
    if (!bench) throw new Error('Missing bench press');
    const options = buildReplacementOptions(bench);
    const ids = options.map((option) => option.id);
    const priorityIds = options.filter((option) => option.rank === 'priority').map((option) => option.id);
    const angleIds = options.filter((option) => option.rank === 'angle').map((option) => option.id);

    expect(priorityIds).toEqual(expect.arrayContaining(['db-bench-press', 'machine-chest-press']));
    expect(angleIds).toContain('incline-db-press');
    expect(ids).not.toContain('cable-fly');
    expect(ids).not.toContain('triceps-pushdown');
    expect(ids).not.toContain('shoulder-press');
    expect(options.every((option) => option.rankLabel && !['priority', 'optional', 'angle'].includes(option.rankLabel))).toBe(true);
  });

  it('formats progression unit and metadata labels without raw enum leakage', () => {
    const bench = exercises.find((exercise) => exercise.id === 'bench-press');
    if (!bench) throw new Error('Missing bench press');
    const metadata = buildExerciseMetadata(bench);

    expect(formatWeight(metadata.progressionUnitKg, { weightUnit: 'kg' })).toBe('2.5kg');
    expect(formatWeight(metadata.progressionUnitKg, { weightUnit: 'lb' })).toBe('6lb');
    expect(formatFatigueCost(metadata.fatigueCost)).toBe('高');
    expect(formatSkillDemand(metadata.skillDemand)).toBe('高');
    expect(formatReplacementCategory('priority')).toBe('优先');
    expect(formatReplacementCategory('not_recommended')).toBe('不推荐');
  });
});
