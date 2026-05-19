import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { buildActionableEquipmentAwarePrescription } from '../src/engines/equipmentAwareActionablePrescription';
import { applySuggestedFocusStepWithResult, getActualSetDraft, getCurrentFocusStep } from '../src/engines/focusModeStateEngine';
import { convertKgToDisplayWeight } from '../src/engines/unitConversionEngine';
import { TrainingFocusView } from '../src/features/TrainingFocusView';
import type { EquipmentProfile } from '../src/engines/equipmentAwareLoadModel';
import type { TrainingSession, UnitSettings } from '../src/models/training-model';
import { makeExercise, makeFocusSession } from './focusModeFixtures';

const unitSettings: UnitSettings = {
  weightUnit: 'lb',
  defaultIncrementKg: 2.5,
  defaultIncrementLb: 5,
  customIncrementsKg: [],
  customIncrementsLb: [],
};

const noop = (..._args: unknown[]) => undefined;
const setStateNoop = (() => undefined) as React.Dispatch<React.SetStateAction<number>>;
const lbToKg = (lb: number) => lb * 0.45359237;

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

const makeBenchWarmupSession = () =>
  makeFocusSession([
    {
      ...makeExercise('bench-press', 1, 0, 1),
      name: 'Bench Press',
      warmupSets: [{ weight: lbToKg(17), reps: 10 }],
      sets: [{ id: 'bench-working', weight: lbToKg(135), reps: 5, rir: 2, done: false, painFlag: false, type: 'top' }],
    },
  ]);

describe('equipment-aware primary prescription and apply suggestion fix', () => {
  it('renders Bench Press warmup primary prescription as empty bar instead of theoretical 17 lb', () => {
    const text = renderFocusText(makeBenchWarmupSession());
    const prescriptionIndex = text.indexOf('本组建议');
    const detailIndex = text.indexOf('重量详情');
    const primaryBlock = text.slice(prescriptionIndex, detailIndex);

    expect(primaryBlock).toContain('空杆 45 lb × 10 次');
    expect(primaryBlock).not.toContain('17lb × 10 次');
    expect(text).toContain('理论计算：17 lb');
    expect(text).toContain('实际可做：45 lb');
  });

  it('applies the feasible empty bar load instead of the theoretical 17 lb warmup', () => {
    const applied = applySuggestedFocusStepWithResult(makeBenchWarmupSession(), 0);
    const step = getCurrentFocusStep(applied.session);
    const draft = getActualSetDraft(applied.session, step);

    expect(applied.actionResult).toMatchObject({ ok: true, changed: true, message: '已套用建议。' });
    expect(convertKgToDisplayWeight(draft?.actualWeightKg, 'lb')).toBe(45);
    expect(convertKgToDisplayWeight(draft?.actualWeightKg, 'lb')).not.toBe(17);
  });

  it('keeps normal barbell set display and apply value feasible at 135 lb', () => {
    const session = makeFocusSession([{ ...makeExercise('bench-press', 1), name: 'Bench Press', sets: [{ id: 'bench-1', weight: lbToKg(135), reps: 5, rir: 2, done: false, painFlag: false, type: 'top' }] }]);
    const text = renderFocusText(session);
    const applied = applySuggestedFocusStepWithResult(session, 0);
    const draft = getActualSetDraft(applied.session, getCurrentFocusStep(applied.session));

    expect(text).toContain('135 lb 总重量 × 5 次');
    expect(text).toContain('每边 45 lb');
    expect(convertKgToDisplayWeight(draft?.actualWeightKg, 'lb')).toBe(135);
  });

  it('uses per-hand dumbbell feasible load without doubling the primary or actionable weight', () => {
    const result = buildActionableEquipmentAwarePrescription({
      exerciseName: 'Dumbbell Bench Press',
      plannedWeightKg: lbToKg(42),
      plannedReps: 8,
      setPurpose: 'working',
      unitSettings,
      readinessBias: 'progressive',
    });

    expect(result.primaryPrescriptionLabel).toContain('每只手 45 lb');
    expect(result.primaryPrescriptionLabel).not.toContain('90 lb');
    expect(convertKgToDisplayWeight(result.actionableWeightKg, 'lb')).toBe(45);
  });

  it('uses selectorized custom stack options for display and actionable weight', () => {
    const equipmentProfile: EquipmentProfile = {
      id: 'lat-stack',
      name: 'Lat pulldown stack',
      equipmentKind: 'selectorized_machine',
      displayMode: 'machine_stack',
      includeBaseWeight: false,
      machineWeightOptionsLb: [15, 30, 45, 60, 75, 90],
      roundingPreference: 'nearest',
    };
    const result = buildActionableEquipmentAwarePrescription({
      exerciseName: 'Lat Pulldown',
      plannedWeightKg: lbToKg(52),
      plannedReps: 10,
      setPurpose: 'working',
      unitSettings,
      equipmentProfile,
    });

    expect(result.primaryPrescriptionLabel).toContain('插片 45 lb');
    expect(convertKgToDisplayWeight(result.actionableWeightKg, 'lb')).toBe(45);
  });

  it('keeps plate-loaded base warning when base weight is unknown or excluded', () => {
    const result = buildActionableEquipmentAwarePrescription({
      exerciseName: 'Leg Press',
      plannedWeightKg: lbToKg(90),
      plannedReps: 10,
      setPurpose: 'working',
      unitSettings,
    });

    expect(result.warning).toContain('器械自重未计入');
    expect(result.detailLabels.join(' ')).toContain('器械自重未计入');
  });

  it('falls back safely for unknown custom exercises', () => {
    const result = buildActionableEquipmentAwarePrescription({
      exerciseName: 'Custom Mystery Lift',
      plannedWeightKg: lbToKg(77),
      plannedReps: 8,
      setPurpose: 'working',
      unitSettings,
    });

    expect(result.shouldUseFeasibleLoad).toBe(false);
    expect(result.primaryPrescriptionLabel).toBe('77lb × 8 次');
    expect(convertKgToDisplayWeight(result.actionableWeightKg, 'lb')).toBe(77);
    expect(result.warning).toContain('未知器械档案');
  });
});
