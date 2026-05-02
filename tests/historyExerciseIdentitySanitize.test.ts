import { describe, expect, it } from 'vitest';
import { sanitizeData } from '../src/storage/persistence';
import { getExerciseRecordPoolId } from '../src/engines/e1rmEngine';
import { makeAppData, makeSession } from './fixtures';

const sessionWithActual = (actualExerciseId: string) => {
  const session = makeSession({
    id: 'identity-session',
    date: '2026-04-30',
    templateId: 'push-a',
    exerciseId: 'bench-press',
    setSpecs: [{ weight: 100, reps: 5, rir: 2, techniqueQuality: 'good' }],
  });
  session.exercises[0] = {
    ...session.exercises[0],
    originalExerciseId: 'bench-press',
    actualExerciseId,
  };
  return session;
};

describe('history exercise identity sanitize', () => {
  it('clears invalid actualExerciseId without falling back to originalExerciseId', () => {
    const sanitized = sanitizeData(makeAppData({ history: [sessionWithActual('missing-old-alt')] }));
    const exercise = sanitized.history[0].exercises[0];

    expect(exercise.actualExerciseId).toBeUndefined();
    expect(exercise.originalExerciseId).toBe('bench-press');
    expect(exercise.legacyActualExerciseId).toBe('missing-old-alt');
    expect(exercise.identityInvalid).toBe(true);
    expect(getExerciseRecordPoolId(exercise)).toBe('');
  });

  it('moves synthetic replacement ids into legacy identity fields', () => {
    const sanitized = sanitizeData(makeAppData({ history: [sessionWithActual('__auto_alt')] }));
    const exercise = sanitized.history[0].exercises[0];

    expect(exercise.actualExerciseId).toBeUndefined();
    expect(exercise.legacyActualExerciseId).toBe('__auto_alt');
    expect(exercise.identityReviewReason).toMatch(/invalid_actual_exercise_id|synthetic_replacement_id/);
    expect(exercise.identityInvalid).toBe(true);
  });

  it('keeps valid actualExerciseId unchanged', () => {
    const sanitized = sanitizeData(makeAppData({ history: [sessionWithActual('db-bench-press')] }));
    const exercise = sanitized.history[0].exercises[0];

    expect(exercise.actualExerciseId).toBe('db-bench-press');
    expect(exercise.legacyActualExerciseId).toBeUndefined();
    expect(exercise.identityInvalid).toBeUndefined();
    expect(getExerciseRecordPoolId(exercise)).toBe('db-bench-press');
  });
});
