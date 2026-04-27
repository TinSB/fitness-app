import { describe, expect, it } from 'vitest';
import { buildFocusStepQueue, completeFocusSet, getCurrentFocusStep, isFocusSessionComplete } from '../src/engines/focusModeStateEngine';
import type { TrainingSession } from '../src/models/training-model';
import { makeExercise, makeFocusSession } from './focusModeFixtures';

describe('focus step queue', () => {
  it('warmup steps 在 working steps 前', () => {
    const session = makeFocusSession([makeExercise('bench', 2, 0, 2)]);
    expect(buildFocusStepQueue(session).map((step) => step.stepType)).toEqual(['warmup', 'warmup', 'working', 'working']);
  });

  it('完成 warmup 后进入 working', () => {
    let session = makeFocusSession([makeExercise('bench', 1, 0, 1)]);
    session.focusActualSetDrafts = [{ exerciseId: 'bench', stepId: 'bench:warmup:0', stepType: 'warmup', setIndex: 0, actualWeightKg: 20, actualReps: 8 }];
    session = completeFocusSet(session, 0)?.session as TrainingSession;
    expect(getCurrentFocusStep(session).stepType).toBe('working');
  });

  it('完成 working 后进入 next exercise', () => {
    let session = makeFocusSession([makeExercise('bench', 1), makeExercise('row', 1)]);
    session = completeFocusSet(session, 0)?.session as TrainingSession;
    expect(getCurrentFocusStep(session).exerciseId).toBe('row');
    expect(getCurrentFocusStep(session).stepType).toBe('working');
  });

  it('所有 step 完成后 session complete 且不会 wrap 到第一个动作', () => {
    let session = makeFocusSession([makeExercise('bench', 1, 1), makeExercise('row', 1)]);
    session.currentExerciseId = 'row';
    session.currentFocusStepId = 'row:working:0';
    session = completeFocusSet(session, 1)?.session as TrainingSession;
    expect(isFocusSessionComplete(session)).toBe(true);
    expect(getCurrentFocusStep(session).stepType).toBe('completed');
    expect(session.currentExerciseId).toBe('');
  });
});
