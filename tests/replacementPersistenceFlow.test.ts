import { describe, expect, it } from 'vitest';
import { buildPrs } from '../src/engines/analytics';
import { buildE1RMProfile } from '../src/engines/e1rmEngine';
import { getActualSetDraft, getCurrentFocusStep } from '../src/engines/focusModeStateEngine';
import { completeTrainingSessionIntoHistory } from '../src/engines/trainingCompletionEngine';
import { dispatchWorkoutExecutionEvent } from '../src/engines/workoutExecutionStateMachine';
import type { TrainingSession } from '../src/models/training-model';
import { emptyData, sanitizeData } from '../src/storage/persistence';
import { makeExercise, makeFocusSession } from './focusModeFixtures';

const dispatch = (session: TrainingSession, event: Parameters<typeof dispatchWorkoutExecutionEvent>[1]) =>
  dispatchWorkoutExecutionEvent(session, event).updatedSession;

const currentExerciseId = (session: TrainingSession) => getCurrentFocusStep(session).exerciseId;

const completeCurrentSet = (session: TrainingSession, at: string) =>
  dispatch(session, {
    type: 'COMPLETE_STEP',
    exerciseIndex: 0,
    completedAt: at,
    nowMs: Date.parse(at),
    expectedStepId: getCurrentFocusStep(session).id,
  });

describe('replacement persistence flow', () => {
  it('keeps the actual replacement exercise through focus operations, persistence, and history', () => {
    let session = makeFocusSession([makeExercise('bench-press', 2)]);

    session = dispatch(session, { type: 'APPLY_REPLACEMENT', exerciseIndex: 0, replacementId: 'db-bench-press' });
    expect(session.exercises[0].originalExerciseId).toBe('bench-press');
    expect(session.exercises[0].actualExerciseId).toBe('db-bench-press');
    expect(session.exercises[0].replacementExerciseId).toBe('db-bench-press');
    expect(session.exercises[0].sameTemplateSlot).toBe(true);
    expect(session.exercises[0].prIndependent).toBe(true);
    expect(currentExerciseId(session)).toBe('db-bench-press');

    session = dispatch(session, { type: 'APPLY_PRESCRIPTION', exerciseIndex: 0 });
    expect(currentExerciseId(session)).toBe('db-bench-press');
    expect(getActualSetDraft(session, getCurrentFocusStep(session))?.exerciseId).toBe('db-bench-press');

    session = dispatch(session, { type: 'MARK_PAIN', exerciseIndex: 0, painFlag: true });
    expect(currentExerciseId(session)).toBe('db-bench-press');
    expect(getActualSetDraft(session, getCurrentFocusStep(session))?.exerciseId).toBe('db-bench-press');
    expect(getActualSetDraft(session, getCurrentFocusStep(session))?.painFlag).toBe(true);

    session = dispatch(session, { type: 'MARK_PAIN', exerciseIndex: 0, painFlag: false });
    session = completeCurrentSet(session, '2026-04-27T10:00:00-04:00');
    expect(session.exercises[0].sets[0].done).toBe(true);
    expect(session.exercises[0].sets[0].painFlag).toBe(false);
    expect(currentExerciseId(session)).toBe('db-bench-press');
    expect(session.restTimerState?.exerciseId).toBe('db-bench-press');

    session = dispatch(session, { type: 'END_REST' });
    expect(currentExerciseId(session)).toBe('db-bench-press');

    session = dispatch(session, { type: 'COPY_PREVIOUS_SET', exerciseIndex: 0 });
    expect(currentExerciseId(session)).toBe('db-bench-press');
    expect(getActualSetDraft(session, getCurrentFocusStep(session))?.exerciseId).toBe('db-bench-press');
    expect(getActualSetDraft(session, getCurrentFocusStep(session))?.actualWeightKg).toBe(50);

    const persistedActive = sanitizeData({ ...emptyData(), activeSession: session });
    session = persistedActive.activeSession as TrainingSession;
    expect(session.exercises[0].actualExerciseId).toBe('db-bench-press');
    expect(currentExerciseId(session)).toBe('db-bench-press');

    session = dispatch(session, { type: 'MARK_PAIN', exerciseIndex: 0, painFlag: true });
    session = completeCurrentSet(session, '2026-04-27T10:03:00-04:00');
    expect(session.exercises[0].sets[1].painFlag).toBe(true);

    const persisted = sanitizeData({ ...emptyData(), activeSession: session });
    session = persisted.activeSession as TrainingSession;
    expect(session.exercises[0].actualExerciseId).toBe('db-bench-press');

    const finished = completeTrainingSessionIntoHistory(
      { ...emptyData(), activeSession: session },
      '2026-04-27T10:10:00-04:00',
    );
    const historySession = finished.session;
    expect(historySession?.exercises[0].originalExerciseId).toBe('bench-press');
    expect(historySession?.exercises[0].actualExerciseId).toBe('db-bench-press');
    expect(historySession?.exercises[0].replacementExerciseId).toBe('db-bench-press');

    const history = finished.data.history;
    expect(buildPrs(history).some((item) => item.exerciseId === 'db-bench-press')).toBe(true);
    expect(buildPrs(history).some((item) => item.exerciseId === 'bench-press')).toBe(false);
    expect(buildE1RMProfile(history, 'db-bench-press').best).toBeTruthy();
    expect(buildE1RMProfile(history, 'bench-press').best).toBeUndefined();
  });
});
