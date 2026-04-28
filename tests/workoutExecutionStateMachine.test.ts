import { describe, expect, it } from 'vitest';
import { dispatchWorkoutExecutionEvent } from '../src/engines/workoutExecutionStateMachine';
import { getCurrentFocusStep } from '../src/engines/focusModeStateEngine';
import { makeExercise, makeFocusSession } from './focusModeFixtures';

describe('workoutExecutionStateMachine', () => {
  it('routes weight and rep adjustments through one event dispatcher', () => {
    const session = makeFocusSession([makeExercise('bench-press', 2, 0, 1)]);
    const weightResult = dispatchWorkoutExecutionEvent(session, { type: 'ADJUST_WEIGHT', exerciseIndex: 0, delta: 10 });
    const repsResult = dispatchWorkoutExecutionEvent(weightResult.updatedSession, { type: 'ADJUST_REPS', exerciseIndex: 0, delta: 5 });
    const draft = repsResult.updatedSession.focusActualSetDrafts?.[0];

    expect(weightResult.nextState).toBe('editing_actual_set');
    expect(draft?.actualWeightKg).toBe(10);
    expect(draft?.actualReps).toBe(5);
  });

  it('prevents duplicate complete events from advancing a changed step', () => {
    const session = makeFocusSession([makeExercise('bench-press', 2, 0, 2)]);
    const prepared = dispatchWorkoutExecutionEvent(session, { type: 'APPLY_PRESCRIPTION', exerciseIndex: 0 }).updatedSession;
    const firstStep = getCurrentFocusStep(prepared);
    const first = dispatchWorkoutExecutionEvent(prepared, {
      type: 'COMPLETE_STEP',
      exerciseIndex: 0,
      expectedStepId: firstStep.id,
      completedAt: '2026-04-27T20:00:00.000Z',
      nowMs: 1000,
    });
    const duplicate = dispatchWorkoutExecutionEvent(first.updatedSession, {
      type: 'COMPLETE_STEP',
      exerciseIndex: 0,
      expectedStepId: firstStep.id,
      completedAt: '2026-04-27T20:00:01.000Z',
      nowMs: 1100,
    });

    expect(getCurrentFocusStep(first.updatedSession).id).not.toBe(firstStep.id);
    expect(duplicate.warnings.join(' ')).toContain('未重复提交');
    expect(getCurrentFocusStep(duplicate.updatedSession).id).toBe(getCurrentFocusStep(first.updatedSession).id);
  });

  it('applies replacement using a real exercise id and keeps current display on actual exercise', () => {
    const session = makeFocusSession([makeExercise('bench-press', 2)]);
    const result = dispatchWorkoutExecutionEvent(session, { type: 'APPLY_REPLACEMENT', exerciseIndex: 0, replacementId: 'db-bench-press' });

    expect(result.updatedSession.exercises[0].actualExerciseId).toBe('db-bench-press');
    expect(result.updatedSession.exercises[0].originalExerciseId).toBe('bench-press');
    expect(result.updatedSession.currentExerciseId).toBe('db-bench-press');
  });
});
