import { describe, expect, it } from 'vitest';
import {
  adjustFocusSetValue,
  applySuggestedFocusStep,
  copyPreviousFocusActualDraft,
  getActualSetDraft,
  getCurrentFocusStep,
  switchFocusExercise,
  updateFocusActualDraft,
} from '../src/engines/focusModeStateEngine';
import { dispatchWorkoutExecutionEvent } from '../src/engines/workoutExecutionStateMachine';
import type { TrainingSession } from '../src/models/training-model';
import { makeExercise, makeFocusSession } from './focusModeFixtures';

const makePushSession = () =>
  makeFocusSession([
    { ...makeExercise('bench-press', 2), name: '平板卧推' },
    { ...makeExercise('incline-db-press', 2), name: '上斜哑铃卧推' },
    { ...makeExercise('shoulder-press', 1), name: '肩推' },
  ]);

const expectStillOnIncline = (session: TrainingSession) => {
  const current = getCurrentFocusStep(session);
  expect(current.exerciseId).toBe('incline-db-press');
  expect(session.focusManualStepOverride).toBe(true);
};

describe('focus actions preserve manual exercise cursor', () => {
  it('does not jump back to bench after adjusting weight', () => {
    const session = adjustFocusSetValue(switchFocusExercise(makePushSession(), 1), 1, 'weight', 2.5);

    expectStillOnIncline(session);
  });

  it('does not jump back to bench after adjusting reps', () => {
    const session = adjustFocusSetValue(switchFocusExercise(makePushSession(), 1), 1, 'reps', 1);

    expectStillOnIncline(session);
  });

  it('does not jump back to bench after applying the prescription', () => {
    const session = applySuggestedFocusStep(switchFocusExercise(makePushSession(), 1), 1);

    expectStillOnIncline(session);
  });

  it('uses the manual cursor even if an adjust event carries a stale earlier exercise index', () => {
    const session = adjustFocusSetValue(switchFocusExercise(makePushSession(), 1), 0, 'weight', 2.5);
    const draft = getActualSetDraft(session, getCurrentFocusStep(session));

    expectStillOnIncline(session);
    expect(draft?.exerciseId).toBe('incline-db-press');
    expect(draft?.actualWeightKg).toBe(2.5);
  });

  it('uses the manual cursor even if apply prescription carries a stale earlier exercise index', () => {
    const session = applySuggestedFocusStep(switchFocusExercise(makePushSession(), 1), 0);
    const draft = getActualSetDraft(session, getCurrentFocusStep(session));

    expectStillOnIncline(session);
    expect(draft?.exerciseId).toBe('incline-db-press');
    expect(draft?.source).toBe('prescription');
  });

  it('does not jump back to bench after marking discomfort', () => {
    const session = updateFocusActualDraft(switchFocusExercise(makePushSession(), 1), 1, { painFlag: true });

    expectStillOnIncline(session);
  });

  it('does not jump back to bench after copying the previous set', () => {
    const session = switchFocusExercise(makePushSession(), 1);
    session.exercises[1].sets[0] = {
      ...session.exercises[1].sets[0],
      weight: 42,
      actualWeightKg: 42,
      reps: 8,
      rir: 2,
      done: true,
      completedAt: '2026-05-01T10:00:00.000Z',
    };
    session.currentFocusStepId = 'main:incline-db-press:working:1';
    session.currentExerciseId = 'incline-db-press';
    session.currentSetIndex = 1;
    session.focusManualStepOverride = true;

    const nextSession = copyPreviousFocusActualDraft(session, 1);

    expectStillOnIncline(nextSession);
    expect(getCurrentFocusStep(nextSession).setIndex).toBe(1);
  });

  it('preserves manual cursor through the execution state machine', () => {
    const switched = switchFocusExercise(makePushSession(), 1);
    const adjusted = dispatchWorkoutExecutionEvent(switched, { type: 'ADJUST_WEIGHT', exerciseIndex: 1, delta: 2.5 }).updatedSession;
    const applied = dispatchWorkoutExecutionEvent(adjusted, { type: 'APPLY_PRESCRIPTION', exerciseIndex: 1 }).updatedSession;
    const marked = dispatchWorkoutExecutionEvent(applied, { type: 'MARK_PAIN', exerciseIndex: 1, painFlag: true }).updatedSession;

    expectStillOnIncline(marked);
  });

  it('does not jump back to bench when rest ends', () => {
    const switched = switchFocusExercise(makePushSession(), 1);
    const runningRest = {
      ...switched,
      restTimerState: {
        exerciseId: 'incline-db-press',
        setIndex: 0,
        durationSec: 90,
        startedAtMs: 1000,
        isRunning: true,
      },
    };

    const nextSession = dispatchWorkoutExecutionEvent(runningRest, { type: 'END_REST' }).updatedSession;

    expectStillOnIncline(nextSession);
    expect(nextSession.restTimerState).toBeNull();
  });
});
