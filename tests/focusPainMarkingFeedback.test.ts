import { describe, expect, it } from 'vitest';
import {
  getActualSetDraft,
  getCurrentFocusStep,
  updateFocusPainFlagWithResult,
} from '../src/engines/focusModeStateEngine';
import type { FocusActionResult } from '../src/engines/workoutExecutionStateMachine';
import { makeExercise, makeFocusSession } from './focusModeFixtures';

const successWords = /已标记|已取消/;

const makeSession = () => makeFocusSession([{ ...makeExercise('bench-press', 2), name: '平板卧推' }]);

const expectNoSuccessSemantics = (result: FocusActionResult) => {
  expect(result.changed).toBe(false);
  expect(result.tone).not.toBe('success');
  expect(result.message).not.toMatch(successWords);
  expect(result.message).not.toMatch(/undefined|null|pain_flag|bench-press|__alt_/);
};

describe('Focus pain marking feedback', () => {
  it('returns changed=true for marking and cancellation with the existing FocusActionResult messages', () => {
    const marked = updateFocusPainFlagWithResult(makeSession(), 0, true);
    const markedDraft = getActualSetDraft(marked.session, getCurrentFocusStep(marked.session));

    expect(marked.actionResult).toMatchObject({
      ok: true,
      changed: true,
      tone: 'success',
      message: '已标记本组不适。',
    });
    expect(markedDraft?.painFlag).toBe(true);

    const cancelled = updateFocusPainFlagWithResult(marked.session, 0, false);
    const cancelledDraft = getActualSetDraft(cancelled.session, getCurrentFocusStep(cancelled.session));

    expect(cancelled.actionResult).toMatchObject({
      ok: true,
      changed: true,
      tone: 'success',
      message: '已取消本组不适标记。',
    });
    expect(cancelledDraft?.painFlag).toBe(false);
  });

  it('returns changed=false without success wording for no-op pain updates', () => {
    const noop = updateFocusPainFlagWithResult(makeSession(), 0, false);

    expect(noop.actionResult).toMatchObject({
      ok: true,
      changed: false,
      tone: 'info',
      reasonCode: 'no_change',
    });
    expectNoSuccessSemantics(noop.actionResult);
    expect(noop.session).toEqual(makeSession());
  });

  it('returns stale_step without writing a pain draft when the cursor is completed', () => {
    const completedSession = {
      ...makeFocusSession([{ ...makeExercise('bench-press', 2, 2), name: '平板卧推' }]),
      focusSessionComplete: true,
      currentFocusStepId: 'completed',
      currentFocusStepType: 'completed' as const,
    };

    const stale = updateFocusPainFlagWithResult(completedSession, 0, true);

    expect(stale.actionResult).toMatchObject({
      ok: false,
      changed: false,
      tone: 'warning',
      reasonCode: 'stale_step',
      message: '当前训练位置已更新，请重新确认后保存。',
    });
    expectNoSuccessSemantics(stale.actionResult);
    expect(stale.session.focusActualSetDrafts).toEqual([]);
  });
});
