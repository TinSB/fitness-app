import { describe, expect, it } from 'vitest';
import {
  buildFocusCurrentSetSummary,
  isFocusSuggestionApplied,
} from '../src/features/TrainingFocusView';
import {
  getActualSetDraft,
  getCurrentFocusStep,
  switchFocusExercise,
  updateFocusActualDraftWithResult,
} from '../src/engines/focusModeStateEngine';
import { dispatchWorkoutExecutionEvent } from '../src/engines/workoutExecutionStateMachine';
import type { UnitSettings } from '../src/models/training-model';
import { makeExercise, makeFocusSession } from './focusModeFixtures';

const kgSettings: UnitSettings = {
  weightUnit: 'kg',
  defaultIncrementKg: 2.5,
  defaultIncrementLb: 5,
  customIncrementsKg: [],
  customIncrementsLb: [],
};

const lbSettings: UnitSettings = {
  ...kgSettings,
  weightUnit: 'lb',
};

const makeTwoExerciseSession = () =>
  makeFocusSession([
    { ...makeExercise('bench-press', 2), name: '平板卧推' },
    { ...makeExercise('incline-db-press', 2), name: '上斜哑铃卧推' },
  ]);

const currentSummary = (session: ReturnType<typeof makeFocusSession>, unitSettings: UnitSettings = kgSettings) => {
  const step = getCurrentFocusStep(session);
  const draft = getActualSetDraft(session, step);
  return {
    step,
    draft,
    summary: buildFocusCurrentSetSummary({ currentStep: step, actualDraft: draft, unitSettings }),
  };
};

describe('Focus current set summary', () => {
  it('uses the current cursor draft instead of the first unfinished exercise', () => {
    const withFirstDraft = updateFocusActualDraftWithResult(makeTwoExerciseSession(), 0, {
      actualWeightKg: 20,
      actualReps: 5,
      actualRir: 4,
      source: 'manual',
    }).session;
    const onSecondExercise = switchFocusExercise(withFirstDraft, 1);
    const withSecondDraft = updateFocusActualDraftWithResult(onSecondExercise, 1, {
      actualWeightKg: 60,
      actualReps: 7,
      actualRir: 2,
      source: 'manual',
    }).session;

    const { step, draft, summary } = currentSummary(withSecondDraft);

    expect(step.exerciseIndex).toBe(1);
    expect(step.exerciseId).toBe('incline-db-press');
    expect(draft).toMatchObject({
      exerciseId: 'incline-db-press',
      actualWeightKg: 60,
      actualReps: 7,
      actualRir: 2,
      source: 'manual',
    });
    expect(summary.text).toBe('当前记录：60 kg × 7 次 · 2 RIR 余力 · 手动');
    expect(summary.text).not.toContain('20 kg');
  });

  it('follows actualExerciseId after replacement and does not fall back to the original exercise', () => {
    const onSecondExercise = switchFocusExercise(makeTwoExerciseSession(), 1);
    const replaced = dispatchWorkoutExecutionEvent(onSecondExercise, {
      type: 'APPLY_REPLACEMENT',
      exerciseIndex: 1,
      replacementId: 'smith-incline-press',
    }).updatedSession;
    const withDraft = updateFocusActualDraftWithResult(replaced, 1, {
      actualWeightKg: 62.5,
      actualReps: 8,
      actualRir: 1,
      source: 'manual',
    }).session;

    const { step, draft, summary } = currentSummary(withDraft);

    expect(replaced.exercises[1]).toMatchObject({
      originalExerciseId: 'incline-db-press',
      actualExerciseId: 'smith-incline-press',
      replacementExerciseId: 'smith-incline-press',
    });
    expect(step.exerciseId).toBe('smith-incline-press');
    expect(draft).toMatchObject({
      exerciseId: 'smith-incline-press',
      actualWeightKg: 62.5,
      actualReps: 8,
      actualRir: 1,
    });
    expect(summary.text).toBe('当前记录：62.5 kg × 8 次 · 1 RIR 余力 · 手动');
  });

  it('localizes known draft sources and hides unknown source values', () => {
    const step = getCurrentFocusStep(makeTwoExerciseSession());
    const prescription = buildFocusCurrentSetSummary({
      currentStep: step,
      actualDraft: {
        stepId: step.id,
        exerciseId: step.exerciseId,
        setIndex: step.setIndex,
        actualWeightKg: 50,
        actualReps: 8,
        actualRir: 2,
        source: 'prescription',
      },
      unitSettings: kgSettings,
    });
    const copied = buildFocusCurrentSetSummary({
      currentStep: step,
      actualDraft: {
        stepId: step.id,
        exerciseId: step.exerciseId,
        setIndex: step.setIndex,
        actualWeightKg: 50,
        actualReps: 8,
        actualRir: 2,
        source: 'copy_previous',
      },
      unitSettings: kgSettings,
    });
    const unknown = buildFocusCurrentSetSummary({
      currentStep: step,
      actualDraft: {
        stepId: step.id,
        exerciseId: step.exerciseId,
        setIndex: step.setIndex,
        actualWeightKg: 50,
        actualReps: 8,
        actualRir: 2,
        source: 'legacy_source' as never,
      },
      unitSettings: kgSettings,
    });

    expect(prescription.text).not.toContain('建议');
    expect(copied.text).toContain('复制上组');
    expect(unknown.text).toBe('当前记录：50 kg × 8 次 · 2 RIR 余力');
    expect(unknown.text).not.toMatch(/legacy_source|prescription|manual|copy_previous|undefined|null/);
  });

  it('shows integer lb display while keeping the draft weight in actualWeightKg', () => {
    const session = updateFocusActualDraftWithResult(makeTwoExerciseSession(), 0, {
      actualWeightKg: 52.6,
      actualReps: 8,
      actualRir: 2,
      source: 'manual',
    }).session;

    const { draft, summary } = currentSummary(session, lbSettings);

    expect(draft?.actualWeightKg).toBe(52.6);
    expect(summary.text).toBe('当前记录：116 lb × 8 次 · 2 RIR 余力 · 手动');
    expect(summary.text).not.toContain('116.0 lb');
    expect(summary.text).not.toContain('52.6 kg');
  });

  it('reports applied suggestion only when the current draft matches the prescription source', () => {
    const session = makeTwoExerciseSession();
    const step = getCurrentFocusStep(session);
    const draft = {
      stepId: step.id,
      exerciseId: step.exerciseId,
      setIndex: step.setIndex,
      actualWeightKg: step.plannedWeight,
      actualReps: step.plannedReps,
      actualRir: step.plannedRir,
      source: 'prescription' as const,
    };

    expect(isFocusSuggestionApplied(step, draft)).toBe(true);
    expect(buildFocusCurrentSetSummary({ currentStep: step, actualDraft: draft, unitSettings: kgSettings }).isSuggestionApplied).toBe(true);
  });
});
