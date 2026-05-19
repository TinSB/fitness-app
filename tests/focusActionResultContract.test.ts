import { describe, expect, it } from 'vitest';
import {
  applySuggestedFocusStepWithResult,
  getActualSetDraft,
  getCurrentFocusStep,
  updateFocusPainFlagWithResult,
} from '../src/engines/focusModeStateEngine';
import { dispatchWorkoutExecutionEvent, type FocusActionResult } from '../src/engines/workoutExecutionStateMachine';
import { makeExercise, makeFocusSession } from './focusModeFixtures';

const successWords = /已完成|已复制|已套用|已标记|已替换/;

const makeSession = () =>
  makeFocusSession([
    { ...makeExercise('bench-press', 2), name: '平板卧推' },
    { ...makeExercise('incline-db-press', 1), name: '上斜哑铃卧推' },
  ]);

const expectNoSuccessSemantics = (result: FocusActionResult) => {
  expect(result.changed).toBe(false);
  expect(result.tone).not.toBe('success');
  expect(result.message).not.toMatch(successWords);
  expect(result.message).not.toMatch(/undefined|null|__auto_alt|__alt_/);
};

describe('FocusActionResult contract', () => {
  it('reports complete-set success only when the current set is actually completed', () => {
    const prescribedWeightOnly = dispatchWorkoutExecutionEvent(makeSession(), { type: 'APPLY_PRESCRIPTION', exerciseIndex: 0 }).updatedSession;
    const prescribed = dispatchWorkoutExecutionEvent(prescribedWeightOnly, { type: 'ADJUST_REPS', exerciseIndex: 0, delta: 8 }).updatedSession;
    const current = getCurrentFocusStep(prescribed);

    const result = dispatchWorkoutExecutionEvent(prescribed, {
      type: 'COMPLETE_STEP',
      exerciseIndex: 0,
      completedAt: '2026-05-07T10:00:00.000Z',
      nowMs: 1000,
      expectedStepId: current.id,
      displayUnit: 'kg',
    });

    expect(result.actionResult).toMatchObject({
      ok: true,
      changed: true,
      tone: 'success',
      message: '已完成本组。',
      reasonCode: 'completed',
    });
    expect(result.updatedSession.exercises[0].sets[0]).toMatchObject({
      done: true,
      actualWeightKg: 50,
      reps: 8,
    });
    expect(result.updatedSession.exercises[0].sets[1].done).toBe(false);
  });

  it('returns stale_step without mutating state when expectedStepId is stale', () => {
    const prescribed = dispatchWorkoutExecutionEvent(makeSession(), { type: 'APPLY_PRESCRIPTION', exerciseIndex: 0 }).updatedSession;

    const result = dispatchWorkoutExecutionEvent(prescribed, {
      type: 'COMPLETE_STEP',
      exerciseIndex: 0,
      completedAt: '2026-05-07T10:00:00.000Z',
      nowMs: 1000,
      expectedStepId: 'main:incline-db-press:working:0',
      displayUnit: 'kg',
    });

    expect(result.actionResult).toMatchObject({
      ok: false,
      changed: false,
      tone: 'warning',
      message: '当前训练位置已更新，请重新确认后保存。',
      reasonCode: 'stale_step',
    });
    expectNoSuccessSemantics(result.actionResult);
    expect(result.updatedSession.exercises[0].sets[0].done).toBe(false);
    expect(result.updatedSession).toEqual(prescribed);
  });

  it('returns missing_draft without completing a set when no usable draft exists', () => {
    const session = makeSession();
    const current = getCurrentFocusStep(session);

    const result = dispatchWorkoutExecutionEvent(session, {
      type: 'COMPLETE_STEP',
      exerciseIndex: 0,
      completedAt: '2026-05-07T10:00:00.000Z',
      nowMs: 1000,
      expectedStepId: current.id,
      displayUnit: 'kg',
    });

    expect(result.actionResult).toMatchObject({
      ok: false,
      changed: false,
      tone: 'warning',
      message: '请先填写重量和次数。',
      reasonCode: 'missing_draft',
    });
    expectNoSuccessSemantics(result.actionResult);
    expect(result.updatedSession).toEqual(session);
    expect(result.updatedSession.exercises[0].sets[0].done).toBe(false);
  });

  it('distinguishes apply-suggestion success from already-at-suggestion no-op', () => {
    const first = applySuggestedFocusStepWithResult(makeSession(), 0);
    const draftAfterFirst = getActualSetDraft(first.session, getCurrentFocusStep(first.session));

    expect(first.actionResult).toMatchObject({
      ok: true,
      changed: true,
      tone: 'success',
      message: '已套用建议。',
    });
    expect(first.actionResult.reasonCode).toBeUndefined();
    expect(draftAfterFirst).toMatchObject({
      actualWeightKg: 50,
      source: 'prescription',
    });
    expect(draftAfterFirst?.actualReps).toBeUndefined();
    expect(draftAfterFirst?.actualRir).toBeUndefined();

    const second = applySuggestedFocusStepWithResult(first.session, 0);

    expect(second.actionResult).toMatchObject({
      ok: true,
      changed: false,
      tone: 'info',
      message: '当前已是建议值。',
      reasonCode: 'no_change',
    });
    expectNoSuccessSemantics(second.actionResult);
    expect(second.session).toEqual(first.session);
  });

  it('marks and cancels pain only on the current focus draft', () => {
    const marked = updateFocusPainFlagWithResult(makeSession(), 0, true);
    const markedDraft = getActualSetDraft(marked.session, getCurrentFocusStep(marked.session));

    expect(marked.actionResult).toMatchObject({
      ok: true,
      changed: true,
      tone: 'success',
      message: '已标记本组不适。',
    });
    expect(marked.actionResult.reasonCode).toBeUndefined();
    expect(markedDraft).toMatchObject({
      exerciseId: 'bench-press',
      setIndex: 0,
      painFlag: true,
    });
    expect(marked.session).not.toHaveProperty('todayStatus');
    expect(marked.session).not.toHaveProperty('screeningRestriction');

    const cancelled = updateFocusPainFlagWithResult(marked.session, 0, false);
    const cancelledDraft = getActualSetDraft(cancelled.session, getCurrentFocusStep(cancelled.session));

    expect(cancelled.actionResult).toMatchObject({
      ok: true,
      changed: true,
      tone: 'success',
      message: '已取消本组不适标记。',
    });
    expect(cancelledDraft?.painFlag).toBe(false);

    const noop = updateFocusPainFlagWithResult(cancelled.session, 0, false);

    expect(noop.actionResult).toMatchObject({
      ok: true,
      changed: false,
      tone: 'info',
      reasonCode: 'no_change',
    });
    expectNoSuccessSemantics(noop.actionResult);
    expect(noop.session).toEqual(cancelled.session);
  });

  it('returns replacement success, same-exercise no-op, and invalid replacement without writing bad identity', () => {
    const session = makeSession();

    const replaced = dispatchWorkoutExecutionEvent(session, {
      type: 'APPLY_REPLACEMENT',
      exerciseIndex: 1,
      replacementId: 'smith-incline-press',
    });

    expect(replaced.actionResult).toMatchObject({
      ok: true,
      changed: true,
      tone: 'success',
      message: '已替换为：史密斯上斜卧推。',
    });
    expect(replaced.actionResult.reasonCode).toBeUndefined();
    expect(replaced.updatedSession.exercises[1]).toMatchObject({
      originalExerciseId: 'incline-db-press',
      actualExerciseId: 'smith-incline-press',
      replacementExerciseId: 'smith-incline-press',
    });

    const same = dispatchWorkoutExecutionEvent(replaced.updatedSession, {
      type: 'APPLY_REPLACEMENT',
      exerciseIndex: 1,
      replacementId: 'smith-incline-press',
    });

    expect(same.actionResult).toMatchObject({
      ok: true,
      changed: false,
      tone: 'info',
      message: '当前已经是该动作。',
      reasonCode: 'no_change',
    });
    expectNoSuccessSemantics(same.actionResult);
    expect(same.updatedSession.exercises[1].actualExerciseId).toBe('smith-incline-press');

    const invalid = dispatchWorkoutExecutionEvent(session, {
      type: 'APPLY_REPLACEMENT',
      exerciseIndex: 1,
      replacementId: '__alt_synthetic',
    });

    expect(invalid.actionResult).toMatchObject({
      ok: false,
      changed: false,
      tone: 'warning',
      message: '该替代动作暂不可用。',
      reasonCode: 'invalid_replacement',
    });
    expectNoSuccessSemantics(invalid.actionResult);
    expect(invalid.updatedSession.exercises[1].actualExerciseId).toBeUndefined();
    expect(invalid.updatedSession.exercises[1].replacementExerciseId).toBeUndefined();
  });
});
