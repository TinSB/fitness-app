import { describe, expect, it } from 'vitest';
import { applySuggestedFocusStep, completeFocusSet, getCurrentFocusStep } from '../src/engines/focusModeStateEngine';
import { makeExercise, makeFocusSession } from './focusModeFixtures';

describe('complete focus set', () => {
  it('完成一组会把 actual draft 写入 working set log', () => {
    let session = makeFocusSession([makeExercise('bench', 1)]);
    session = applySuggestedFocusStep(session, 0);
    const result = completeFocusSet(session, 0);
    const set = result?.session.exercises[0].sets[0];
    expect(set.done).toBe(true);
    expect(set.weight).toBe(50);
    expect(set.reps).toBe(8);
  });

  it('空实际值在 engine 层按 0 保存，UI 层负责提示用户先输入', () => {
    const session = makeFocusSession([makeExercise('bench', 1)]);
    const result = completeFocusSet(session, 0);
    const set = result?.session.exercises[0].sets[0];
    expect(set.weight).toBe(0);
    expect(set.reps).toBe(0);
  });

  it('double submit 不重复写入同一 step', () => {
    let session = makeFocusSession([makeExercise('bench', 1)]);
    session = applySuggestedFocusStep(session, 0);
    const first = completeFocusSet(session, 0);
    const second = completeFocusSet(first?.session as typeof session, 0);
    expect(first).not.toBeNull();
    expect(second).toBeNull();
  });

  it('完成最后一组进入 completed', () => {
    let session = makeFocusSession([makeExercise('bench', 1)]);
    session = applySuggestedFocusStep(session, 0);
    session = completeFocusSet(session, 0)?.session as typeof session;
    expect(getCurrentFocusStep(session).stepType).toBe('completed');
  });
});
