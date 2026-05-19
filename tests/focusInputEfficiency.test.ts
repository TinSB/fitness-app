import { describe, expect, it } from 'vitest';
import {
  adjustFocusSetValue,
  applySuggestedFocusStepWithResult,
  getActualSetDraft,
  getCurrentFocusStep,
  switchFocusExercise,
  updateFocusActualDraftWithResult,
} from '../src/engines/focusModeStateEngine';
import { dispatchWorkoutExecutionEvent } from '../src/engines/workoutExecutionStateMachine';
import { makeExercise, makeFocusSession } from './focusModeFixtures';

const makeSession = () =>
  makeFocusSession([
    { ...makeExercise('bench-press', 2), name: '平板卧推' },
    { ...makeExercise('incline-db-press', 2), name: '上斜哑铃卧推' },
  ]);

const expectOnSecondExercise = (session: ReturnType<typeof makeSession>) => {
  const step = getCurrentFocusStep(session);
  expect(step.exerciseIndex).toBe(1);
  expect(step.exerciseId).toBe('incline-db-press');
  expect(session.currentFocusStepId).toBe(step.id);
};

describe('Focus input efficiency state boundaries', () => {
  it('weight, reps, RIR, direct input, and apply suggestion keep the current cursor', () => {
    const onSecond = switchFocusExercise(makeSession(), 1);
    expectOnSecondExercise(onSecond);

    const afterWeight = adjustFocusSetValue(onSecond, 1, 'weight', 5);
    expectOnSecondExercise(afterWeight);
    expect(getActualSetDraft(afterWeight, getCurrentFocusStep(afterWeight))).toMatchObject({
      exerciseId: 'incline-db-press',
      actualWeightKg: 5,
      source: 'manual',
    });

    const afterReps = adjustFocusSetValue(afterWeight, 1, 'reps', 8);
    expectOnSecondExercise(afterReps);
    expect(getActualSetDraft(afterReps, getCurrentFocusStep(afterReps))).toMatchObject({
      actualWeightKg: 5,
      actualReps: 8,
      source: 'manual',
    });

    const afterRir = updateFocusActualDraftWithResult(afterReps, 1, {
      actualRir: 2,
      source: 'manual',
    }).session;
    expectOnSecondExercise(afterRir);
    expect(getActualSetDraft(afterRir, getCurrentFocusStep(afterRir))).toMatchObject({
      actualRir: 2,
      source: 'manual',
    });

    const afterDirectInput = updateFocusActualDraftWithResult(afterRir, 1, {
      actualWeightKg: 52.5,
      actualReps: 9,
      actualRir: 1,
      source: 'manual',
    }).session;
    expectOnSecondExercise(afterDirectInput);
    expect(getActualSetDraft(afterDirectInput, getCurrentFocusStep(afterDirectInput))).toMatchObject({
      exerciseId: 'incline-db-press',
      actualWeightKg: 52.5,
      actualReps: 9,
      actualRir: 1,
      source: 'manual',
    });

    const applied = applySuggestedFocusStepWithResult(afterDirectInput, 1);
    expect(applied.actionResult).toMatchObject({
      ok: true,
      changed: true,
      message: '已套用建议。',
    });
    expectOnSecondExercise(applied.session);
    expect(getActualSetDraft(applied.session, getCurrentFocusStep(applied.session))).toMatchObject({
      exerciseId: 'incline-db-press',
      actualWeightKg: 50,
      actualReps: 9,
      actualRir: 1,
      source: 'prescription',
    });
  });

  it('completes the current cursor step after quick apply instead of jumping back to an earlier exercise', () => {
    const onSecond = switchFocusExercise(makeSession(), 1);
    const appliedWeightOnly = applySuggestedFocusStepWithResult(onSecond, 1).session;
    const applied = updateFocusActualDraftWithResult(appliedWeightOnly, 1, {
      actualReps: 8,
      actualRir: 2,
      source: 'manual',
    }).session;
    const current = getCurrentFocusStep(applied);

    const completed = dispatchWorkoutExecutionEvent(applied, {
      type: 'COMPLETE_STEP',
      exerciseIndex: 1,
      completedAt: '2026-05-07T10:00:00.000Z',
      nowMs: 1000,
      expectedStepId: current.id,
      displayUnit: 'kg',
    });

    expect(completed.actionResult).toMatchObject({
      ok: true,
      changed: true,
      reasonCode: 'completed',
      message: '已完成本组。',
    });
    expect(completed.updatedSession.exercises[0].sets[0].done).toBe(false);
    expect(completed.updatedSession.exercises[1].sets[0]).toMatchObject({
      done: true,
      actualWeightKg: 50,
      reps: 8,
      completedAt: '2026-05-07T10:00:00.000Z',
    });
    expect(getCurrentFocusStep(completed.updatedSession).exerciseIndex).toBe(1);
  });
});
