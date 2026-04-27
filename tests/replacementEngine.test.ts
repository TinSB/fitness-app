import { describe, expect, it } from 'vitest';
import { applyExerciseReplacement, buildReplacementOptions } from '../src/engines/replacementEngine';
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
  });

  it('does not suggest incorrect bench replacements', () => {
    const ids = buildReplacementOptions(benchExercise).map((option) => option.id);

    expect(ids).not.toContain('triceps-pushdown');
    expect(ids).not.toContain('shoulder-press');
    expect(ids).not.toContain('machine-shoulder-press');
    expect(ids).not.toContain('cable-fly');
  });

  it('records original and actual exercise separately after replacement', () => {
    const next = applyExerciseReplacement(makeSession(), 0, 'db-bench-press');
    const exercise = next.exercises[0];

    expect(exercise.id).toBe('db-bench-press');
    expect(exercise.canonicalExerciseId).toBe('db-bench-press');
    expect(exercise.replacedFromId).toBe('bench-press');
    expect(exercise.replacedFromName).toBe('平板卧推');
    expect(exercise.baseId).toBe('bench-press');
  });

  it('keeps PR and e1RM record pool independent for the actual replacement', () => {
    const next = applyExerciseReplacement(makeSession(), 0, 'db-bench-press');

    expect(getExerciseRecordPoolId(next.exercises[0])).toBe('db-bench-press');
  });
});
