import { describe, expect, it } from 'vitest';
import { applySuggestedFocusStep, completeFocusSet, getCurrentFocusStep, switchFocusExercise } from '../src/engines/focusModeStateEngine';
import { dispatchWorkoutExecutionEvent } from '../src/engines/workoutExecutionStateMachine';
import { emptyData, sanitizeData } from '../src/storage/persistence';
import type { ExercisePrescription, TrainingSession } from '../src/models/training-model';
import { makeExercise, makeFocusSession } from './focusModeFixtures';

const makePushSession = () =>
  makeFocusSession([
    { ...makeExercise('bench-press', 2), name: '平板卧推' },
    { ...makeExercise('incline-db-press', 2), name: '上斜哑铃卧推' },
    { ...makeExercise('shoulder-press', 1), name: '肩推' },
  ]);

describe('focus cursor persistence', () => {
  it('completes the manually selected incline step rather than the earlier bench step', () => {
    let session = switchFocusExercise(makePushSession(), 1);
    session = applySuggestedFocusStep(session, 1);
    const current = getCurrentFocusStep(session);

    const result = completeFocusSet(session, 1, '2026-05-01T10:00:00.000Z', 1000, current.id);

    expect(result).not.toBeNull();
    const nextSession = result?.session as TrainingSession;
    expect(result?.completedExerciseIndex).toBe(1);
    expect(nextSession.exercises[1].sets[0].done).toBe(true);
    expect(nextSession.exercises[0].sets[0].done).toBe(false);
    expect(getCurrentFocusStep(nextSession).exerciseId).toBe('incline-db-press');
    expect(getCurrentFocusStep(nextSession).setIndex).toBe(1);
    expect(nextSession.focusManualStepOverride).toBe(true);
  });

  it('state machine complete step uses the current focus step and expectedStepId', () => {
    let session = switchFocusExercise(makePushSession(), 1);
    session = dispatchWorkoutExecutionEvent(session, { type: 'APPLY_PRESCRIPTION', exerciseIndex: 1 }).updatedSession;
    const current = getCurrentFocusStep(session);

    const result = dispatchWorkoutExecutionEvent(session, {
      type: 'COMPLETE_STEP',
      exerciseIndex: 1,
      completedAt: '2026-05-01T10:00:00.000Z',
      nowMs: 1000,
      expectedStepId: current.id,
    });

    expect(result.updatedSession.exercises[1].sets[0].done).toBe(true);
    expect(result.updatedSession.exercises[0].sets[0].done).toBe(false);
    expect(getCurrentFocusStep(result.updatedSession).exerciseId).toBe('incline-db-press');
    expect(getCurrentFocusStep(result.updatedSession).setIndex).toBe(1);
  });

  it('rejects a stale expectedStepId instead of completing the wrong exercise', () => {
    const session = applySuggestedFocusStep(switchFocusExercise(makePushSession(), 1), 1);

    const result = completeFocusSet(session, 1, '2026-05-01T10:00:00.000Z', 1000, 'main:bench-press:working:0');

    expect(result).toBeNull();
    expect(session.exercises[1].sets[0].done).toBe(false);
    expect(session.exercises[0].sets[0].done).toBe(false);
  });

  it('switchFocusExercise only changes the focus cursor and not replacement identity fields', () => {
    const replacedBench: ExercisePrescription = {
      ...makeExercise('bench-press', 2),
      name: '平板卧推',
      originalExerciseId: 'bench-press',
      actualExerciseId: 'db-bench-press',
      replacementExerciseId: 'db-bench-press',
    };
    const session = makeFocusSession([replacedBench, { ...makeExercise('incline-db-press', 2), name: '上斜哑铃卧推' }]);

    const nextSession = switchFocusExercise(session, 1);

    expect(nextSession.exercises[0].originalExerciseId).toBe('bench-press');
    expect(nextSession.exercises[0].actualExerciseId).toBe('db-bench-press');
    expect(nextSession.exercises[0].replacementExerciseId).toBe('db-bench-press');
    expect(nextSession.exercises[1].originalExerciseId).toBeUndefined();
    expect(nextSession.exercises[1].actualExerciseId).toBeUndefined();
    expect(nextSession.exercises[1].replacementExerciseId).toBeUndefined();
    expect(getCurrentFocusStep(nextSession).exerciseId).toBe('incline-db-press');
  });

  it('preserves the cursor across activeSession sanitize and restore', () => {
    const session = switchFocusExercise(makePushSession(), 1);

    const restored = sanitizeData({ ...emptyData(), activeSession: session }).activeSession as TrainingSession;

    expect(restored.focusManualStepOverride).toBe(true);
    expect(getCurrentFocusStep(restored).exerciseId).toBe('incline-db-press');
  });
});
