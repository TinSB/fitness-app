import { describe, expect, it } from 'vitest';
import { adjustFocusSetValue, applySuggestedFocusStep, getActualSetDraft, getCurrentFocusStep } from '../src/engines/focusModeStateEngine';
import { makeExercise, makeFocusSession } from './focusModeFixtures';

describe('actual set draft', () => {
  it('新 set draft 不自动等于推荐', () => {
    const session = makeFocusSession([makeExercise('bench', 1)]);
    const step = getCurrentFocusStep(session);
    expect(step.plannedWeight).toBe(50);
    expect(step.plannedReps).toBe(8);
    expect(getActualSetDraft(session, step)).toBeNull();
  });

  it('+weight 和 +rep 从 0 开始', () => {
    let session = makeFocusSession([makeExercise('bench', 1)]);
    session = adjustFocusSetValue(session, 0, 'weight', 2.5);
    session = adjustFocusSetValue(session, 0, 'reps', 1);
    const draft = getActualSetDraft(session, getCurrentFocusStep(session));
    expect(draft?.actualWeightKg).toBe(2.5);
    expect(draft?.actualReps).toBe(1);
  });

  it('套用建议后 actual 等于 planned，后续调整不改变推荐', () => {
    let session = makeFocusSession([makeExercise('bench', 1)]);
    const planned = getCurrentFocusStep(session);
    session = applySuggestedFocusStep(session, 0);
    session = adjustFocusSetValue(session, 0, 'reps', 1);
    const step = getCurrentFocusStep(session);
    const draft = getActualSetDraft(session, step);
    expect(draft?.actualWeightKg).toBe(planned.plannedWeight);
    expect(draft?.actualReps).toBe(Number(planned.plannedReps) + 1);
    expect(step.plannedReps).toBe(planned.plannedReps);
  });
});
