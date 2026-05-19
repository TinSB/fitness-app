import React from 'react';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { applySuggestedFocusStepWithResult, getActualSetDraft, getCurrentFocusStep } from '../src/engines/focusModeStateEngine';
import { convertKgToDisplayWeight } from '../src/engines/unitConversionEngine';
import { TrainingFocusView } from '../src/features/TrainingFocusView';
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

describe('UI-OS 4 Today Train Focus redesign', () => {
  const todaySource = readFileSync('src/features/TodayView.tsx', 'utf8');
  const todayFocusOverrideSource = readFileSync('src/uiOs/today/TodayFocusOverridePanel.tsx', 'utf8');
  const focusSource = readFileSync('src/features/TrainingFocusView.tsx', 'utf8');
  const trainingSource = readFileSync('src/features/TrainingView.tsx', 'utf8');
  const cardsSource = readFileSync('src/uiOs/training/TrainingOsCards.tsx', 'utf8');

  it('adds UI-OS training surfaces for Today, Focus, prescriptions, inputs, and action bar', () => {
    for (const marker of [
      'TodayHeroCard',
      'TodayFocusOverrideCard',
      'TrainingFocusHeroCard',
      'SetPrescriptionCard',
      'ActualSetInputCard',
      'TrainingActionBar',
      'UnfinishedSessionNotice',
    ]) {
      expect(cardsSource).toContain(marker);
    }
    expect(cardsSource).toContain('bg-white/[0.07]');
    expect(cardsSource).toContain('backdrop-blur-xl');
  });

  it('keeps Today daily recommendation, compact focus override, source-unclear safety path, and start or continue action visible', () => {
    expect(todaySource).toContain('<TodayDecisionHero');
    expect(todaySource).toContain('buildTodayDecisionSurface');
    expect(todaySource).toContain('<TodayFocusOverrideControl');
    expect(todayFocusOverrideSource).toContain('今天想练');
    expect(todayFocusOverrideSource).not.toContain('选择只影响今天');
    expect(todayFocusOverrideSource).not.toContain('不修改长期计划');
    expect(todaySource).toContain('<SafetyStrip state="source-unclear"');
    expect(todaySource).not.toContain('<SafetyStrip includeSecondaryCopy');
    expect(todaySource).toContain('继续训练');
    expect(todaySource).toContain('primaryAction');
  });

  it('renders Bench Press warmup primary prescription as empty bar 45 lb instead of theoretical 17 lb', () => {
    const text = renderFocusText(makeBenchWarmupSession());
    const prescriptionIndex = text.indexOf('本组建议');
    const detailIndex = text.indexOf('重量详情');
    const primaryBlock = text.slice(prescriptionIndex, detailIndex);

    expect(primaryBlock).toContain('空杆 45 lb × 10 次');
    expect(primaryBlock).not.toContain('17lb × 10 次');
    expect(text).toContain('理论计算：17 lb');
    expect(text).toContain('实际可做：45 lb');
  });

  it('keeps apply suggestion on the feasible equipment-aware load path', () => {
    const applied = applySuggestedFocusStepWithResult(makeBenchWarmupSession(), 0);
    const draft = getActualSetDraft(applied.session, getCurrentFocusStep(applied.session));

    expect(convertKgToDisplayWeight(draft?.actualWeightKg, 'lb')).toBe(45);
    expect(convertKgToDisplayWeight(draft?.actualWeightKg, 'lb')).not.toBe(17);
  });

  it('keeps existing focus controls and full training flow actions reachable', () => {
    expect(focusSource).toContain('buildActionableEquipmentAwarePrescription');
    expect(focusSource).toContain('EquipmentAwareRecommendationWeight');
    expect(focusSource).toContain('套用建议');
    expect(focusSource).toContain('FocusModeActionBar');
    expect(focusSource).toContain('替代动作');
    expect(focusSource).toContain('标记不适');
    expect(focusSource).toContain('onFinish');
    expect(trainingSource).toContain('onApplySuggestion(exerciseIndex)');
    expect(trainingSource).toContain('onReplaceExercise(exerciseIndex)');
  });
});
