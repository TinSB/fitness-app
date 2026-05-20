import { describe, expect, it } from 'vitest';
import { dispatchWorkoutExecutionEvent } from '../src/engines/workoutExecutionStateMachine';
import { getCurrentFocusStep } from '../src/engines/focusModeStateEngine';
import { makeExercise, makeFocusSession } from './focusModeFixtures';

const unitSettings = {
  weightUnit: 'kg' as const,
  defaultIncrementKg: 2.5,
  defaultIncrementLb: 5,
  customIncrementsKg: [],
  customIncrementsLb: [],
};

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
    expect(duplicate.actionResult).toMatchObject({
      ok: false,
      changed: false,
      tone: 'warning',
      message: '当前训练位置已更新，请重新确认后保存。',
      reasonCode: 'stale_step',
    });
    expect(getCurrentFocusStep(duplicate.updatedSession).id).toBe(getCurrentFocusStep(first.updatedSession).id);
  });

  it('emits a transient next-set recommendation after a successful complete step', () => {
    const session = makeFocusSession([makeExercise('bench-press', 2)]);
    const prepared = dispatchWorkoutExecutionEvent(session, { type: 'APPLY_PRESCRIPTION', exerciseIndex: 0 }).updatedSession;
    const current = getCurrentFocusStep(prepared);

    const result = dispatchWorkoutExecutionEvent(prepared, {
      type: 'COMPLETE_STEP',
      exerciseIndex: 0,
      expectedStepId: current.id,
      completedAt: '2026-05-19T12:00:00.000Z',
      nowMs: 1000,
      displayUnit: 'kg',
      unitSettings,
    });
    const nextStep = getCurrentFocusStep(result.updatedSession);

    expect(result.actionResult.reasonCode).toBe('completed');
    expect(result.nextSetRecommendation?.recommendationKind).toBe('hold');
    expect(result.nextSetRecommendation?.targetSetId).toBe(nextStep.id);
    expect(result.nextSetRecommendation?.createdAt).toBe('2026-05-19T12:00:00.000Z');
    expect(JSON.stringify(result.updatedSession)).not.toContain('nextSetRecommendation');
  });

  it('does not emit a next-set recommendation for missing draft, stale step, or duplicate submit paths', () => {
    const session = makeFocusSession([makeExercise('bench-press', 2)]);
    const current = getCurrentFocusStep(session);
    const missingDraft = dispatchWorkoutExecutionEvent(session, {
      type: 'COMPLETE_STEP',
      exerciseIndex: 0,
      expectedStepId: current.id,
      completedAt: '2026-05-19T12:00:00.000Z',
      nowMs: 1000,
      displayUnit: 'kg',
      unitSettings,
    });
    const prepared = dispatchWorkoutExecutionEvent(session, { type: 'APPLY_PRESCRIPTION', exerciseIndex: 0 }).updatedSession;
    const stale = dispatchWorkoutExecutionEvent(prepared, {
      type: 'COMPLETE_STEP',
      exerciseIndex: 0,
      expectedStepId: 'main:bench-press:working:9',
      completedAt: '2026-05-19T12:00:00.000Z',
      nowMs: 1000,
      displayUnit: 'kg',
      unitSettings,
    });
    const duplicateSession = {
      ...prepared,
      exercises: [
        {
          ...prepared.exercises[0],
          sets: [{ ...prepared.exercises[0].sets[0], done: true }, ...prepared.exercises[0].sets.slice(1)],
        },
      ],
    };
    const duplicate = dispatchWorkoutExecutionEvent(duplicateSession, {
      type: 'COMPLETE_STEP',
      exerciseIndex: 0,
      completedAt: '2026-05-19T12:00:00.000Z',
      nowMs: 1000,
      displayUnit: 'kg',
      unitSettings,
    });

    expect(missingDraft.nextSetRecommendation).toBeUndefined();
    expect(stale.nextSetRecommendation).toBeUndefined();
    expect(duplicate.nextSetRecommendation).toBeUndefined();
  });

  it('applies replacement using a real exercise id and keeps current display on actual exercise', () => {
    const session = makeFocusSession([makeExercise('bench-press', 2)]);
    const result = dispatchWorkoutExecutionEvent(session, { type: 'APPLY_REPLACEMENT', exerciseIndex: 0, replacementId: 'db-bench-press' });

    expect(result.updatedSession.exercises[0].actualExerciseId).toBe('db-bench-press');
    expect(result.updatedSession.exercises[0].originalExerciseId).toBe('bench-press');
    expect(result.updatedSession.currentExerciseId).toBe('db-bench-press');
  });
});
