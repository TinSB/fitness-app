import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { resolveActionableLoadContract } from '../src/engines/actionableLoadContract';
import { detectSetAnomalies } from '../src/engines/setAnomalyEngine';
import { applySuggestedFocusStepWithResult, getActualSetDraft, getCurrentFocusStep } from '../src/engines/focusModeStateEngine';
import { convertKgToDisplayWeight } from '../src/engines/unitConversionEngine';
import { TrainingFocusView } from '../src/features/TrainingFocusView';
import type { TrainingSession, UnitSettings } from '../src/models/training-model';
import { makeFocusSession, makeExercise } from './focusModeFixtures';

const lbToKg = (lb: number) => lb * 0.45359237;
const noop = (..._args: unknown[]) => undefined;
const setStateNoop = (() => undefined) as React.Dispatch<React.SetStateAction<number>>;
const unitSettings: UnitSettings = {
  weightUnit: 'lb',
  defaultIncrementKg: 2.5,
  defaultIncrementLb: 5,
  customIncrementsKg: [],
  customIncrementsLb: [],
};

const visibleText = (html: string) =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const renderFocusText = (session: TrainingSession) =>
  visibleText(
    renderToStaticMarkup(
      React.createElement(TrainingFocusView, {
        session,
        unitSettings,
        restTimer: null,
        expandedExercise: 0,
        setExpandedExercise: setStateNoop,
        onSetChange: noop,
        onCompleteSet: noop,
        onCopyPrevious: noop,
        onAdjustSet: noop,
        onApplySuggestion: noop,
        onUpdateActualDraft: noop,
        onSwitchExercise: noop,
        onReplaceExercise: noop,
        onLoadFeedback: noop,
        onFinish: noop,
        onCompleteSupportSet: noop,
        onSkipSupportExercise: noop,
        onSkipSupportBlock: noop,
        onUpdateSupportSkipReason: noop,
      }),
    ),
  );

const belowBarBenchSession = () =>
  makeFocusSession([
    {
      ...makeExercise('bench-press', 1, 0, 1),
      id: 'bench-press',
      baseId: 'bench-press',
      name: 'Bench Press',
      warmupSets: [{ weight: lbToKg(27), reps: 10 }],
    },
  ]);

describe('UI-OS R8.7A actionable load contract', () => {
  it('keeps raw theoretical load detail-only and uses actionable load as validation baseline', () => {
    const contract = resolveActionableLoadContract({
      exerciseName: 'Bench Press',
      rawTheoreticalLoadKg: lbToKg(27),
      plannedReps: 10,
      setPurpose: 'warmup',
      unitSettings,
      showTheoreticalDetail: true,
    });

    expect(convertKgToDisplayWeight(contract.rawTheoreticalLoadKg, 'lb')).toBe(27);
    expect(convertKgToDisplayWeight(contract.actionableLoadKg, 'lb')).toBe(45);
    expect(convertKgToDisplayWeight(contract.validationBaselineKg, 'lb')).toBe(45);
    expect(contract.rawTheoreticalLoadIsValidationBaseline).toBe(false);
    expect(contract.sourceOfTruthChanged).toBe(false);
    expect(contract.persistenceChanged).toBe(false);
  });

  it('does not flag applied 45 lb x 10 because the raw theoretical load was 27 lb', () => {
    const anomalies = detectSetAnomalies({
      currentDraft: {
        exerciseId: 'bench-press',
        stepId: 'main:bench-press:warmup:0',
        stepType: 'warmup',
        setType: 'warmup',
        isWarmup: true,
        actualWeightKg: lbToKg(45),
        actualReps: 10,
        displayWeight: 45,
        displayUnit: 'lb',
        source: 'prescription',
      },
      exerciseId: 'bench-press',
      previousSets: [],
      unitSettings,
      plannedPrescription: {
        rawTheoreticalWeightKg: lbToKg(27),
        plannedWeightKg: lbToKg(27),
        actionableWeightKg: lbToKg(45),
        validationBaselineKg: lbToKg(45),
        plannedReps: 10,
        repMax: 10,
        stepType: 'warmup',
        setType: 'warmup',
        isWarmup: true,
      },
    });

    expect(anomalies.map((item) => item.id)).not.toContain('planned-weight-large-diff');
    expect(anomalies.filter((item) => item.requiresConfirmation)).toEqual([]);
  });

  it('still requires input for truly missing weight and reps', () => {
    const anomalies = detectSetAnomalies({
      currentDraft: {
        exerciseId: 'bench-press',
        stepId: 'main:bench-press:warmup:0',
        stepType: 'warmup',
        setType: 'warmup',
        isWarmup: true,
      },
      exerciseId: 'bench-press',
      previousSets: [],
      unitSettings,
      plannedPrescription: {
        actionableWeightKg: lbToKg(45),
        plannedReps: 10,
        repMax: 10,
        stepType: 'warmup',
        setType: 'warmup',
        isWarmup: true,
      },
    });

    expect(anomalies.find((item) => item.id === 'empty-set-complete')?.requiresConfirmation).toBe(true);
  });

  it('aligns Focus display and apply suggestion to the same actionable load', () => {
    const session = belowBarBenchSession();
    const visible = renderFocusText(session);
    const applied = applySuggestedFocusStepWithResult(session, 0);
    const draft = getActualSetDraft(applied.session, getCurrentFocusStep(applied.session));

    expect(visible).toContain('空杆 45 lb × 10');
    expect(visible).not.toContain('27 lb × 10');
    expect(convertKgToDisplayWeight(draft?.actualWeightKg, 'lb')).toBe(45);
    expect(draft?.actualReps).toBe(10);
    expect(draft?.actualRir).toBeUndefined();
  });
});
