import { describe, expect, it } from 'vitest';
import { buildPrs } from '../src/engines/analytics';
import { applyExerciseReplacement, buildReplacementOptions, restoreOriginalExercise, validateReplacementExerciseId } from '../src/engines/replacementEngine';
import { getExerciseRecordPoolId } from '../src/engines/e1rmEngine';
import type { ExercisePrescription, TrainingSession } from '../src/models/training-model';

const benchExercise = {
  id: 'bench-press',
  baseId: 'bench-press',
  canonicalExerciseId: 'bench-press',
  name: '平板卧推',
  originalName: '平板卧推',
  muscle: '胸',
  kind: 'compound',
  sets: [],
  repMin: 6,
  repMax: 8,
  rest: 180,
  startWeight: 60,
} as unknown as ExercisePrescription;

const makeSession = (): TrainingSession =>
  ({
    id: 'session-1',
    date: '2026-04-27',
    templateId: 'push-a',
    templateName: 'Push A',
    trainingMode: 'hybrid',
    exercises: [benchExercise],
  }) as TrainingSession;

describe('replacementEngine', () => {
  it('finds valid bench press replacements', () => {
    const options = buildReplacementOptions(benchExercise);
    const ids = options.map((option) => option.id);

    expect(ids).toContain('db-bench-press');
    expect(ids).toContain('machine-chest-press');
    expect(ids).toContain('push-up');
    expect(ids).toContain('incline-db-press');
    expect(options.filter((option) => option.rank === 'priority').map((option) => option.id)).toEqual(
      expect.arrayContaining(['db-bench-press', 'machine-chest-press'])
    );
  });

  it('does not suggest incorrect bench replacements', () => {
    const ids = buildReplacementOptions(benchExercise).map((option) => option.id);

    expect(ids).not.toContain('bench-press');
    expect(ids).not.toContain('triceps-pushdown');
    expect(ids).not.toContain('shoulder-press');
    expect(ids).not.toContain('machine-shoulder-press');
    expect(ids).not.toContain('cable-fly');
  });

  it('uses alternativeIds instead of legacy display names when present', () => {
    const options = buildReplacementOptions({
      ...benchExercise,
      alternatives: ['绳索下压', '器械推胸'],
      alternativeIds: ['db-bench-press', 'machine-chest-press'],
    });
    const ids = options.map((option) => option.id);

    expect(ids).toEqual(expect.arrayContaining(['db-bench-press', 'machine-chest-press']));
    expect(ids).not.toContain('triceps-pushdown');
  });

  it('records original and actual exercise separately after replacement', () => {
    const next = applyExerciseReplacement(makeSession(), 0, 'db-bench-press');
    const exercise = next.exercises[0];

    expect(exercise.id).toBe('db-bench-press');
    expect(exercise.actualExerciseId).toBe('db-bench-press');
    expect(exercise.replacementExerciseId).toBe('db-bench-press');
    expect(exercise.originalExerciseId).toBe('bench-press');
    expect(exercise.sameTemplateSlot).toBe(true);
    expect(exercise.canonicalExerciseId).toBe('db-bench-press');
    expect(exercise.replacedFromId).toBe('bench-press');
    expect(exercise.replacedFromName).toBe('平板卧推');
    expect(exercise.baseId).toBe('bench-press');
    expect(exercise.prIndependent).toBe(true);
  });

  it('keeps PR and e1RM record pool independent for the actual replacement', () => {
    const next = applyExerciseReplacement(makeSession(), 0, 'db-bench-press');

    expect(getExerciseRecordPoolId(next.exercises[0])).toBe('db-bench-press');
  });

  it('uses the actual replacement for PR records instead of polluting the planned exercise', () => {
    const next = applyExerciseReplacement(makeSession(), 0, 'db-bench-press');
    next.exercises[0].sets = [
      { id: 's1', type: 'working', weight: 40, reps: 8, rir: 2, techniqueQuality: 'good', done: true },
    ];

    const prs = buildPrs([next]);

    expect(prs.some((item) => item.exerciseId === 'db-bench-press')).toBe(true);
    expect(prs.some((item) => item.exerciseId === 'bench-press')).toBe(false);
  });

  it('filters the current canonical exercise from replacement options', () => {
    const replaced = applyExerciseReplacement(makeSession(), 0, 'db-bench-press');
    const ids = buildReplacementOptions(replaced.exercises[0]).map((option) => option.id);

    expect(ids).not.toContain('db-bench-press');
    expect(ids).not.toContain('bench-press');
  });

  it('rejects synthetic replacement ids', () => {
    const session = makeSession();
    const next = applyExerciseReplacement(session, 0, 'bench-press__auto_alt_alt');

    expect(validateReplacementExerciseId('bench-press__auto_alt_alt')).toBe(false);
    expect(validateReplacementExerciseId('bench-press__alt_1')).toBe(false);
    expect(next.exercises[0].id).toBe('bench-press');
  });

  it('can restore the original planned exercise explicitly', () => {
    const replaced = applyExerciseReplacement(makeSession(), 0, 'machine-chest-press');
    const restored = restoreOriginalExercise(replaced, 0);

    expect(restored.exercises[0].id).toBe('bench-press');
    expect(restored.exercises[0].actualExerciseId).toBe('bench-press');
    expect(restored.exercises[0].replacementExerciseId).toBeUndefined();
    expect(restored.exercises[0].sameTemplateSlot).toBe(false);
  });
});
