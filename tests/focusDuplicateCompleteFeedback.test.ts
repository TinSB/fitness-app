import { describe, expect, it } from 'vitest';
import { getCurrentFocusStep } from '../src/engines/focusModeStateEngine';
import {
  dispatchWorkoutExecutionEvent,
  focusInfoResult,
  focusWarningResult,
  type FocusActionResult,
} from '../src/engines/workoutExecutionStateMachine';
import type { TrainingSession } from '../src/models/training-model';
import { makeExercise, makeFocusSession } from './focusModeFixtures';

const successWords = /已完成|已复制|已套用|已标记|已替换/;

const makeSession = () => makeFocusSession([{ ...makeExercise('bench-press', 2), name: '平板卧推' }]);

const expectNoSuccessSemantics = (result: FocusActionResult) => {
  expect(result.changed).toBe(false);
  expect(result.tone).not.toBe('success');
  expect(result.message).not.toMatch(successWords);
  expect(result.message).not.toMatch(/undefined|null|__auto_alt|__alt_/);
};

const createCompleteHarness = (initialSession: TrainingSession) => {
  let renderedSession = initialSession;
  let activeSession = initialSession;
  let guard: { key: string; at: number } | null = null;

  const rerender = () => {
    renderedSession = activeSession;
  };

  const complete = (nowMs: number): FocusActionResult => {
    const stepFromRender = getCurrentFocusStep(renderedSession);
    if (stepFromRender.stepType === 'completed') return focusWarningResult('当前训练位置已更新，请重新确认后保存。', 'stale_step');
    const guardKey = `${renderedSession.id}:${stepFromRender.id}`;
    if (guard?.key === guardKey && nowMs - guard.at < 500) return focusInfoResult('当前组未重复记录。', 'duplicate_submit');
    guard = { key: guardKey, at: nowMs };

    const result = dispatchWorkoutExecutionEvent(activeSession, {
      type: 'COMPLETE_STEP',
      exerciseIndex: stepFromRender.exerciseIndex,
      completedAt: `2026-05-07T10:00:${String(nowMs).slice(0, 2).padStart(2, '0')}.000Z`,
      nowMs,
      expectedStepId: stepFromRender.id,
      displayUnit: 'kg',
    });
    if (result.actionResult.changed) activeSession = result.updatedSession;
    return result.actionResult;
  };

  return {
    complete,
    rerender,
    get activeSession() {
      return activeSession;
    },
  };
};

describe('focus duplicate complete feedback', () => {
  it('returns duplicate_submit for a rapid second complete call and does not record a second set', () => {
    const prescribed = dispatchWorkoutExecutionEvent(makeSession(), { type: 'APPLY_PRESCRIPTION', exerciseIndex: 0 }).updatedSession;
    const harness = createCompleteHarness(prescribed);

    const first = harness.complete(1000);
    const afterFirst = harness.activeSession;
    const second = harness.complete(1100);

    expect(first).toMatchObject({
      ok: true,
      changed: true,
      tone: 'success',
      message: '已完成本组。',
      reasonCode: 'completed',
    });
    expect(afterFirst.exercises[0].sets[0].done).toBe(true);
    expect(afterFirst.exercises[0].sets[1].done).toBe(false);
    expect(second).toMatchObject({
      ok: true,
      changed: false,
      tone: 'info',
      message: '当前组未重复记录。',
      reasonCode: 'duplicate_submit',
    });
    expectNoSuccessSemantics(second);
    expect(harness.activeSession).toEqual(afterFirst);
    expect(harness.activeSession.exercises[0].sets.filter((set) => set.done)).toHaveLength(1);
  });

  it('allows the next set to complete after the UI receives the updated activeSession', () => {
    const prescribed = dispatchWorkoutExecutionEvent(makeSession(), { type: 'APPLY_PRESCRIPTION', exerciseIndex: 0 }).updatedSession;
    const harness = createCompleteHarness(prescribed);

    const first = harness.complete(1000);
    harness.rerender();
    const secondDraft = dispatchWorkoutExecutionEvent(harness.activeSession, { type: 'APPLY_PRESCRIPTION', exerciseIndex: 0 }).updatedSession;
    const nextHarness = createCompleteHarness(secondDraft);
    const second = nextHarness.complete(2000);

    expect(first.changed).toBe(true);
    expect(second).toMatchObject({
      ok: true,
      changed: true,
      tone: 'success',
      message: '已完成本组。',
      reasonCode: 'completed',
    });
    expect(nextHarness.activeSession.exercises[0].sets.filter((set) => set.done)).toHaveLength(2);
  });
});
