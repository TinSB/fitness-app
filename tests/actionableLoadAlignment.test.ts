import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { buildActionableEquipmentAwarePrescription } from '../src/engines/equipmentAwareActionablePrescription';
import { createSelectorizedMachineProfile } from '../src/engines/equipmentAwareLoadModel';
import { applySuggestedFocusStepWithResult, getActualSetDraft, getCurrentFocusStep } from '../src/engines/focusModeStateEngine';
import { convertKgToDisplayWeight } from '../src/engines/unitConversionEngine';
import { TrainingFocusView } from '../src/features/TrainingFocusView';
import type { TrainingSession, UnitSettings } from '../src/models/training-model';
import { makeExercise, makeFocusSession } from './focusModeFixtures';

const lbToKg = (lb: number) => lb * 0.45359237;
const unitSettings: UnitSettings = {
  weightUnit: 'lb',
  defaultIncrementKg: 2.5,
  defaultIncrementLb: 5,
  customIncrementsKg: [],
  customIncrementsLb: [],
};
const noop = (..._args: unknown[]) => undefined;
const setStateNoop = (() => undefined) as React.Dispatch<React.SetStateAction<number>>;
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

const renderFocusText = (session: TrainingSession) =>
  text(
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

describe('actionable load alignment', () => {
  it('aligns bench below-bar display and apply suggestion to empty bar plus reps', () => {
    const session = makeFocusSession([
      {
        ...makeExercise('bench-press', 1, 0, 1),
        name: 'Bench Press',
        warmupSets: [{ weight: lbToKg(17), reps: 10 }],
        sets: [{ id: 'bench-working', weight: lbToKg(135), reps: 5, rir: 2, done: false, painFlag: false, type: 'top' }],
      },
    ]);
    const visible = renderFocusText(session);
    const applied = applySuggestedFocusStepWithResult(session, 0);
    const draft = getActualSetDraft(applied.session, getCurrentFocusStep(applied.session));

    expect(visible).toContain('空杆 45 lb × 10');
    expect(visible).not.toContain('17 lb × 10');
    expect(convertKgToDisplayWeight(draft?.actualWeightKg, 'lb')).toBe(45);
    expect(draft?.actualReps).toBe(10);
  });

  it('resolves plate-loaded 33 lb theoretical load to 30 lb actionable load', () => {
    const result = buildActionableEquipmentAwarePrescription({
      exerciseName: 'Leg Press',
      plannedWeightKg: lbToKg(33),
      plannedReps: 10,
      setPurpose: 'warmup',
      unitSettings,
    });

    expect(result.primaryPrescriptionLabel).toContain('加重 30 lb × 10 次');
    expect(convertKgToDisplayWeight(result.actionableWeightKg, 'lb')).toBe(30);
    expect(result.detailLabels.join(' ')).toContain('器械自重未计入');
  });

  it('resolves dumbbell and selectorized loads to feasible increments', () => {
    const dumbbell = buildActionableEquipmentAwarePrescription({
      exerciseName: 'Dumbbell Bench Press',
      plannedWeightKg: lbToKg(42),
      plannedReps: 8,
      setPurpose: 'working',
      unitSettings,
    });
    const selectorized = buildActionableEquipmentAwarePrescription({
      exerciseName: 'Lat Pulldown',
      plannedWeightKg: lbToKg(52),
      plannedReps: 10,
      setPurpose: 'working',
      unitSettings,
      equipmentProfile: { ...createSelectorizedMachineProfile(), machineWeightOptionsLb: [15, 30, 45, 60, 75] },
    });

    expect(dumbbell.primaryPrescriptionLabel).toContain('每只手 40 lb × 8 次');
    expect(convertKgToDisplayWeight(dumbbell.actionableWeightKg, 'lb')).toBe(40);
    expect(selectorized.primaryPrescriptionLabel).toContain('插片 45 lb × 10 次');
    expect(convertKgToDisplayWeight(selectorized.actionableWeightKg, 'lb')).toBe(45);
  });
});
