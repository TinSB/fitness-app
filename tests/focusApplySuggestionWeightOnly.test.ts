import { describe, expect, it } from 'vitest';
import { applySuggestedFocusStepWithResult, getActualSetDraft, getCurrentFocusStep, updateFocusActualDraftWithResult } from '../src/engines/focusModeStateEngine';
import { convertKgToDisplayWeight } from '../src/engines/unitConversionEngine';
import type { TrainingSession } from '../src/models/training-model';
import { makeExercise, makeFocusSession } from './focusModeFixtures';

const lbToKg = (lb: number) => lb * 0.45359237;

const makeBenchWarmupSession = (): TrainingSession =>
  makeFocusSession([
    {
      ...makeExercise('bench-press', 1, 0, 1),
      name: 'Bench Press',
      warmupSets: [{ weight: lbToKg(17), reps: 10 }],
      sets: [{ id: 'bench-working', weight: lbToKg(135), reps: 5, rir: 2, done: false, painFlag: false, type: 'top' }],
    },
  ]);

describe('Focus apply suggestion weight-only behavior', () => {
  it('applies feasible equipment-aware weight only for a 17 lb bench warmup', () => {
    const applied = applySuggestedFocusStepWithResult(makeBenchWarmupSession(), 0);
    const draft = getActualSetDraft(applied.session, getCurrentFocusStep(applied.session));

    expect(convertKgToDisplayWeight(draft?.actualWeightKg, 'lb')).toBe(45);
    expect(draft?.actualReps).toBeUndefined();
    expect(draft?.actualRir).toBeUndefined();
    expect(draft?.source).toBe('prescription');
  });

  it('preserves existing user-entered reps and RIR while replacing weight', () => {
    const prepared = updateFocusActualDraftWithResult(makeFocusSession([makeExercise('bench-press', 1)]), 0, {
      actualWeightKg: 42.5,
      actualReps: 9,
      actualRir: 1,
      source: 'manual',
    }).session;

    const applied = applySuggestedFocusStepWithResult(prepared, 0);
    const draft = getActualSetDraft(applied.session, getCurrentFocusStep(applied.session));

    expect(draft).toMatchObject({
      actualWeightKg: 50,
      actualReps: 9,
      actualRir: 1,
      source: 'prescription',
    });
    expect(applied.session.exercises[0].sets[0].done).toBe(false);
  });
});
