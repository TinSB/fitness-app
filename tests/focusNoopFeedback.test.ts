import { describe, expect, it } from 'vitest';
import {
  copyPreviousFocusActualDraftWithResult,
  getActualSetDraft,
  getCurrentFocusStep,
  updateFocusActualDraftWithResult,
} from '../src/engines/focusModeStateEngine';
import type { FocusActionResult } from '../src/engines/workoutExecutionStateMachine';
import { makeExercise, makeFocusSession } from './focusModeFixtures';

const successWords = /已完成|已复制|已套用|已标记|已替换/;

const makeTwoSetSession = () => makeFocusSession([{ ...makeExercise('bench-press', 2), name: '平板卧推' }]);

const expectNoSuccessSemantics = (result: FocusActionResult) => {
  expect(result.changed).toBe(false);
  expect(result.tone).not.toBe('success');
  expect(result.message).not.toMatch(successWords);
  expect(result.message).not.toMatch(/undefined|null|__auto_alt|__alt_/);
};

const moveToSecondSetWithCompletedFirstSet = () => {
  const session = makeTwoSetSession();
  session.exercises[0].sets[0] = {
    ...session.exercises[0].sets[0],
    weight: 60,
    actualWeightKg: 60,
    reps: 8,
    rir: 2,
    done: true,
    painFlag: false,
    techniqueQuality: 'acceptable',
    completedAt: '2026-05-07T10:00:00.000Z',
  };
  session.currentFocusStepId = 'main:bench-press:working:1';
  session.currentExerciseId = 'bench-press';
  session.currentSetIndex = 1;
  return session;
};

describe('focus no-op feedback', () => {
  it('does not show copy success when there is no previous set', () => {
    const session = makeTwoSetSession();

    const result = copyPreviousFocusActualDraftWithResult(session, 0);

    expect(result.actionResult).toMatchObject({
      ok: true,
      changed: false,
      tone: 'info',
      message: '没有可复制的上一组。',
      reasonCode: 'no_previous_set',
    });
    expectNoSuccessSemantics(result.actionResult);
    expect(result.session).toEqual(session);
    expect(session.focusActualSetDrafts).toHaveLength(0);
  });

  it('does not show copy success when the current draft already matches the previous set', () => {
    const session = moveToSecondSetWithCompletedFirstSet();
    const prepared = updateFocusActualDraftWithResult(session, 0, {
      actualWeightKg: 60,
      actualReps: 8,
      actualRir: 2,
      painFlag: false,
      techniqueQuality: 'acceptable',
      source: 'copy_previous',
    }).session;

    const result = copyPreviousFocusActualDraftWithResult(prepared, 0);

    expect(result.actionResult).toMatchObject({
      ok: true,
      changed: false,
      tone: 'info',
      message: '当前记录已与上一组一致。',
      reasonCode: 'no_change',
    });
    expectNoSuccessSemantics(result.actionResult);
    expect(result.session).toEqual(prepared);
  });

  it('reports overwrite feedback when copy previous replaces a manual draft', () => {
    const session = moveToSecondSetWithCompletedFirstSet();
    const manual = updateFocusActualDraftWithResult(session, 0, {
      actualWeightKg: 52.5,
      actualReps: 7,
      actualRir: 3,
      source: 'manual',
    }).session;

    const result = copyPreviousFocusActualDraftWithResult(manual, 0);
    const draft = getActualSetDraft(result.session, getCurrentFocusStep(result.session));

    expect(result.actionResult).toMatchObject({
      ok: true,
      changed: true,
      tone: 'success',
      message: '已用上组覆盖当前输入。',
    });
    expect(result.actionResult.reasonCode).toBeUndefined();
    expect(draft).toMatchObject({
      actualWeightKg: 60,
      actualReps: 8,
      actualRir: 2,
      source: 'copy_previous',
    });
  });

  it('draft updates return no_change when the requested value is already present', () => {
    const session = updateFocusActualDraftWithResult(makeTwoSetSession(), 0, {
      actualWeightKg: 50,
      actualReps: 8,
      source: 'manual',
    }).session;

    const result = updateFocusActualDraftWithResult(session, 0, {
      actualWeightKg: 50,
      actualReps: 8,
      source: 'manual',
    });

    expect(result.actionResult).toMatchObject({
      ok: true,
      changed: false,
      tone: 'info',
      message: '当前记录未变化。',
      reasonCode: 'no_change',
    });
    expectNoSuccessSemantics(result.actionResult);
    expect(result.session).toEqual(session);
  });
});
