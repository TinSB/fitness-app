import { describe, expect, it } from 'vitest';
import { getCurrentExerciseIdentity } from '../src/engines/currentExerciseSelector';
import { getExerciseRecordPoolId } from '../src/engines/e1rmEngine';
import { sanitizeData } from '../src/storage/persistence';
import { makeAppData, makeSession } from './fixtures';

describe('legacy replacement identity pollution guard', () => {
  it('does not let invalid replacementExerciseId become active actual identity', () => {
    const session = makeSession({
      id: 'legacy-replacement',
      date: '2026-04-30',
      templateId: 'push-a',
      exerciseId: 'bench-press',
      setSpecs: [{ weight: 90, reps: 5 }],
    });
    session.exercises[0] = {
      ...session.exercises[0],
      actualExerciseId: undefined,
      replacementExerciseId: '__alt_bench-press',
      originalExerciseId: 'bench-press',
    };

    const sanitized = sanitizeData(makeAppData({ history: [session] }));
    const exercise = sanitized.history[0].exercises[0];
    const identity = getCurrentExerciseIdentity({ exerciseId: exercise.id }, sanitized.history[0]);

    expect(exercise.actualExerciseId).toBeUndefined();
    expect(exercise.replacementExerciseId).toBeUndefined();
    expect(exercise.legacyReplacementExerciseId).toBe('__alt_bench-press');
    expect(exercise.identityInvalid).toBe(true);
    expect(getExerciseRecordPoolId(exercise)).toBe('');
    expect(identity.recordExerciseId).toBe('');
  });
});
