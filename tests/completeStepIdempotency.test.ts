import { describe, expect, it } from 'vitest';
import { applySuggestedFocusStep, completeFocusSet, getCurrentFocusStep } from '../src/engines/focusModeStateEngine';
import type { TrainingSession } from '../src/models/training-model';
import { makeExercise, makeFocusSession } from './focusModeFixtures';

describe('complete step idempotency', () => {
  it('does not complete the next step when the same expected step is submitted twice', () => {
    let session = makeFocusSession([makeExercise('bench', 2, 0, 3)]);
    const firstStep = getCurrentFocusStep(session);

    session = applySuggestedFocusStep(session, 0);
    const first = completeFocusSet(session, 0, '2026-04-27T10:00:00.000Z', 1000, firstStep.id);
    expect(first).not.toBeNull();
    session = first?.session as TrainingSession;
    expect(getCurrentFocusStep(session).id).toBe('main:bench:warmup:1');

    const second = completeFocusSet(session, 0, '2026-04-27T10:00:00.100Z', 1100, firstStep.id);
    expect(second).toBeNull();
    expect(getCurrentFocusStep(session).id).toBe('main:bench:warmup:1');
    expect(session.focusCompletedStepIds).toEqual(['main:bench:warmup:0']);
  });

  it('does not duplicate completed step ids', () => {
    let session = makeFocusSession([makeExercise('bench', 1, 0, 1)]);
    const step = getCurrentFocusStep(session);
    session.focusCompletedStepIds = [step.id];

    const result = completeFocusSet(session, 0, '2026-04-27T10:00:00.000Z', 1000, step.id);
    expect(result).toBeNull();
    expect(session.focusCompletedStepIds).toEqual([step.id]);
  });
});
