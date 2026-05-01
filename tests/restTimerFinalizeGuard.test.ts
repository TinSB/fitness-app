import { describe, expect, it } from 'vitest';
import { dispatchWorkoutExecutionEvent } from '../src/engines/workoutExecutionStateMachine';
import { createRestTimerState } from '../src/engines/restTimerEngine';
import { buildIncompleteMainWorkGuard } from '../src/engines/trainingCompletionEngine';
import { makeExercise, makeFocusSession } from './focusModeFixtures';

describe('rest timer finalize guard', () => {
  it('does not use a running rest timer as a reason to finalize the whole session', () => {
    const session = {
      ...makeFocusSession([makeExercise('assisted-pull-up', 2, 2), makeExercise('face-pull', 2, 0)]),
      restTimerState: createRestTimerState('assisted-pull-up', 1, 90, new Date('2026-04-30T10:30:00-04:00'), '辅助引体向上'),
    };

    const guard = buildIncompleteMainWorkGuard(session);

    expect(session.restTimerState?.isRunning).toBe(true);
    expect(guard.hasIncompleteMainWork).toBe(true);
    expect(guard.incompleteExercises.map((item) => item.exerciseId)).toContain('face-pull');
  });

  it('ending rest only clears rest state and does not complete a session with remaining main work', () => {
    const session = {
      ...makeFocusSession([makeExercise('assisted-pull-up', 2, 2), makeExercise('face-pull', 2, 0)]),
      restTimerState: createRestTimerState('assisted-pull-up', 1, 90, new Date('2026-04-30T10:30:00-04:00'), '辅助引体向上'),
    };

    const result = dispatchWorkoutExecutionEvent(session, { type: 'END_REST' });

    expect(result.updatedSession.completed).toBe(false);
    expect(result.updatedSession.restTimerState).toBeNull();
    expect(result.nextState).not.toBe('completed');
    expect(buildIncompleteMainWorkGuard(result.updatedSession).hasIncompleteMainWork).toBe(true);
  });
});
