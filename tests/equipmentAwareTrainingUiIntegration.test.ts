import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { TrainingFocusView } from '../src/features/TrainingFocusView';
import { TrainingView } from '../src/features/TrainingView';
import { EquipmentAwareRecommendationWeight } from '../src/ui/EquipmentAwareRecommendationWeight';
import type { TrainingSession, UnitSettings } from '../src/models/training-model';
import { makeExercise, makeFocusSession } from './focusModeFixtures';

const unitSettings: UnitSettings = {
  weightUnit: 'kg',
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

const renderTrainingText = (session: TrainingSession) =>
  visibleText(
    renderToStaticMarkup(
      React.createElement(TrainingView, {
        session,
        unitSettings,
        restTimer: null,
        expandedExercise: 0,
        setExpandedExercise: setStateNoop,
        onStartFromSelected: noop,
        onSetChange: noop,
        onCompleteSet: noop,
        onCopyPrevious: noop,
        onAdjustSet: noop,
        onApplySuggestion: noop,
        onUpdateActualDraft: noop,
        onSwitchExercise: noop,
        onCompleteSupportSet: noop,
        onSkipSupportExercise: noop,
        onSkipSupportBlock: noop,
        onUpdateSupportSkipReason: noop,
        onReplaceExercise: noop,
        onLoadFeedback: noop,
        onFinish: noop,
        onDelete: noop,
        onExtendRestTimer: noop,
        onToggleRestTimer: noop,
        onResetRestTimer: noop,
        onEndRest: noop,
        onGoToday: noop,
      }),
    ),
  );

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

describe('equipment aware training UI integration', () => {
  it('renders the adapter for barbell loads without changing callbacks on render', () => {
    const onOpenEquipmentProfile = vi.fn();
    const markup = renderToStaticMarkup(
      React.createElement(EquipmentAwareRecommendationWeight, {
        exerciseName: 'Bench Press',
        plannedWeightKg: lbToKg(115),
        setPurpose: 'working',
        unitSettings,
        showDetails: true,
        onOpenEquipmentProfile,
      }),
    );

    expect(markup).toContain('115 lb 总重量');
    expect(markup).toContain('每边 35 lb');
    expect(markup).toContain('每边 25 + 10');
    expect(markup).toContain('重量详情');
    expect(onOpenEquipmentProfile).not.toHaveBeenCalled();
  });

  it('returns no adapter UI for missing or zero planned weight', () => {
    expect(renderToStaticMarkup(React.createElement(EquipmentAwareRecommendationWeight, {
      exerciseName: 'Bench Press',
      plannedWeightKg: 0,
      setPurpose: 'working',
      unitSettings,
    }))).toBe('');
  });

  it('integrates display-only equipment load copy into TrainingView set cards', () => {
    const session = makeFocusSession([
      {
        ...makeExercise('bench-press', 2),
        name: 'Bench Press',
        sets: [
          { id: 'bench-1', weight: lbToKg(135), reps: 5, rir: 2, done: false, painFlag: false, type: 'top' },
          { id: 'bench-2', weight: lbToKg(115), reps: 8, rir: 2, done: false, painFlag: false, type: 'backoff' },
        ],
      },
    ]);
    const before = JSON.stringify(session);

    const text = renderTrainingText(session);

    expect(text).toContain('本组建议');
    expect(text).toContain('135 lb 总重量');
    expect(text).toContain('每边 45 lb');
    expect(text).toContain('115 lb 总重量');
    expect(text).toContain('每边 25 + 10');
    expect(JSON.stringify(session)).toBe(before);
  });

  it('integrates display-only empty-bar copy into TrainingFocusView warmup recommendations', () => {
    const session = makeFocusSession([
      {
        ...makeExercise('bench-press', 1, 0, 1),
        name: 'Bench Press',
        warmupSets: [{ weight: lbToKg(17), reps: 8 }],
        sets: [{ id: 'bench-working', weight: lbToKg(135), reps: 5, rir: 2, done: false, painFlag: false, type: 'top' }],
      },
    ]);
    const before = JSON.stringify(session);

    const text = renderFocusText(session);

    expect(text).toContain('本组建议');
    expect(text).toContain('空杆 45 lb');
    expect(text).toContain('重量详情');
    expect(text).not.toContain('理论重量低于空杆，使用空杆热身');
    expect(JSON.stringify(session)).toBe(before);
  });

  it('supports dumbbell per-hand and selectorized stack display through the adapter', () => {
    const dumbbell = visibleText(renderToStaticMarkup(React.createElement(EquipmentAwareRecommendationWeight, {
      exerciseName: 'Dumbbell Bench Press',
      plannedWeightKg: lbToKg(42),
      setPurpose: 'working',
      unitSettings,
      readinessBias: 'progressive',
    })));
    const selectorized = visibleText(renderToStaticMarkup(React.createElement(EquipmentAwareRecommendationWeight, {
      exerciseName: 'Lat Pulldown',
      plannedWeightKg: lbToKg(52),
      setPurpose: 'working',
      unitSettings,
      equipmentProfile: {
        id: 'lat-pulldown-stack',
        name: 'Lat pulldown stack',
        equipmentKind: 'selectorized_machine',
        displayMode: 'machine_stack',
        includeBaseWeight: false,
        roundingPreference: 'nearest',
        machineWeightOptionsLb: [15, 30, 45, 60, 75, 90],
      },
    })));

    expect(dumbbell).toContain('每只手 45 lb');
    expect(dumbbell).not.toContain('90 lb 总重量');
    expect(selectorized).toContain('插片 45 lb');
    expect(selectorized).not.toContain('machine stack');
  });
});
