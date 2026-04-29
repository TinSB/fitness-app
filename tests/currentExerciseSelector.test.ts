import { describe, expect, it } from 'vitest';
import { getCurrentExerciseIdentity } from '../src/engines/currentExerciseSelector';
import { applyExerciseReplacement } from '../src/engines/replacementEngine';
import { makeExercise, makeFocusSession } from './focusModeFixtures';

describe('currentExerciseSelector', () => {
  it('uses the planned exercise for display and records when there is no replacement', () => {
    const session = makeFocusSession([makeExercise('bench-press', 2)]);
    const identity = getCurrentExerciseIdentity({ exerciseIndex: 0, exerciseId: 'bench-press' }, session);

    expect(identity.originalExerciseId).toBe('bench-press');
    expect(identity.actualExerciseId).toBe('bench-press');
    expect(identity.displayExerciseId).toBe('bench-press');
    expect(identity.recordExerciseId).toBe('bench-press');
    expect(identity.isReplacement).toBe(false);
  });

  it('uses the actual replacement exercise for display and records', () => {
    const session = applyExerciseReplacement(makeFocusSession([makeExercise('bench-press', 2)]), 0, 'db-bench-press');
    const identity = getCurrentExerciseIdentity({ exerciseIndex: 0, exerciseId: 'bench-press' }, session);

    expect(identity.originalExerciseId).toBe('bench-press');
    expect(identity.actualExerciseId).toBe('db-bench-press');
    expect(identity.displayExerciseId).toBe('db-bench-press');
    expect(identity.recordExerciseId).toBe('db-bench-press');
    expect(identity.isReplacement).toBe(true);
  });

  it('falls back to replacementExerciseId while preserving originalExerciseId', () => {
    const session = makeFocusSession([
      {
        ...makeExercise('bench-press', 2),
        originalExerciseId: 'bench-press',
        actualExerciseId: undefined,
        replacementExerciseId: 'db-bench-press',
        sameTemplateSlot: true,
        prIndependent: true,
      },
    ]);
    const identity = getCurrentExerciseIdentity({ exerciseIndex: 0, exerciseId: 'bench-press' }, session);

    expect(identity.originalExerciseId).toBe('bench-press');
    expect(identity.displayExerciseId).toBe('db-bench-press');
    expect(identity.recordExerciseId).toBe('db-bench-press');
    expect(identity.isReplacement).toBe(true);
  });
});
