import { describe, expect, it } from 'vitest';
import { applySuggestedFocusStep, adjustFocusSetValue, getFocusNavigationState, updateFocusActualDraft } from '../src/engines/focusModeStateEngine';
import { parseDisplayWeightToKg } from '../src/engines/unitConversionEngine';
import { makeExercise, makeFocusSession } from './focusModeFixtures';

describe('actual set draft unit behavior', () => {
  it('new draft does not automatically equal planned prescription', () => {
    const session = makeFocusSession([makeExercise('bench', 1)]);
    const state = getFocusNavigationState(session, 0);
    expect(state.currentStep.plannedWeight).toBe(50);
    expect(state.actualDraft).toBeNull();
  });

  it('weight and reps increments update actual draft only', () => {
    let session = makeFocusSession([makeExercise('bench', 1)]);
    session = adjustFocusSetValue(session, 0, 'weight', 10);
    session = adjustFocusSetValue(session, 0, 'reps', 5);
    const state = getFocusNavigationState(session, 0);
    expect(state.actualDraft?.actualWeightKg).toBe(10);
    expect(state.actualDraft?.actualReps).toBe(5);
    expect(state.currentStep.plannedWeight).toBe(50);
    expect(state.currentStep.plannedReps).toBe(8);
  });

  it('lb custom input is stored as kg and preserves display unit', () => {
    let session = makeFocusSession([makeExercise('bench', 1)]);
    session = updateFocusActualDraft(session, 0, {
      actualWeightKg: parseDisplayWeightToKg(135, 'lb'),
      displayWeight: 135,
      displayUnit: 'lb',
    });
    const draft = getFocusNavigationState(session, 0).actualDraft;
    expect(draft?.actualWeightKg).toBeCloseTo(61.2, 1);
    expect(draft?.displayWeight).toBe(135);
    expect(draft?.displayUnit).toBe('lb');
  });

  it('apply suggestion copies planned into actual without mutating planned prescription', () => {
    const session = applySuggestedFocusStep(makeFocusSession([makeExercise('bench', 1)]), 0);
    const state = getFocusNavigationState(session, 0);
    expect(state.actualDraft?.actualWeightKg).toBe(50);
    expect(state.actualDraft?.actualReps).toBe(8);
    expect(state.currentStep.plannedWeight).toBe(50);
  });
});
