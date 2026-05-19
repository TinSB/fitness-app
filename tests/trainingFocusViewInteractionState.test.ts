import React from 'react';
import { readFileSync } from 'fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { TrainingFocusView } from '../src/features/TrainingFocusView';
import type { TrainingSession, UnitSettings } from '../src/models/training-model';
import { attachSupportBlocks, makeExercise, makeFocusSession, makeFunctionalAddon } from './focusModeFixtures';

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

const renderFocus = (session: TrainingSession) =>
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
  );

const textOf = (html: string) =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const benchWarmupSession = () =>
  makeFocusSession([
    {
      ...makeExercise('bench-press', 1, 0, 1),
      name: 'Bench Press',
      warmupSets: [{ weight: lbToKg(17), reps: 10 }],
      sets: [{ id: 'bench-working', weight: lbToKg(135), reps: 5, rir: 2, done: false, painFlag: false, type: 'top' }],
    },
  ]);

describe('TrainingFocusView interaction state integration', () => {
  it('renders record as the dominant primary action before actual input and keeps equipment-aware prescription primary', () => {
    const html = renderFocus(benchWarmupSession());
    const text = textOf(html);

    expect(html).toContain('data-primary-action-kind="open_actual_record"');
    expect(text).toContain('记录本组');
    expect(text).toContain('空杆 45 lb × 10');
    expect(text).toContain('理论计算：17 lb');
  });

  it('renders correction and mobility support states without 完成一组 as the primary label', () => {
    const correctionHtml = renderFocus(attachSupportBlocks(makeFocusSession([makeExercise('bench-press', 1)])));
    const functionalSession = attachSupportBlocks(makeFocusSession([makeExercise('bench-press', 1)]), [], [makeFunctionalAddon()]);
    functionalSession.currentFocusStepId = 'functional:func-carry:farmer-carry:0';
    functionalSession.currentFocusStepType = 'functional';
    functionalSession.focusManualStepOverride = true;
    const functionalHtml = renderFocus(functionalSession);

    expect(correctionHtml).toContain('data-primary-action-kind="complete_correction"');
    expect(textOf(correctionHtml)).toContain('完成纠偏');
    expect(functionalHtml).toContain('data-primary-action-kind="complete_mobility"');
    expect(textOf(functionalHtml)).toContain('完成动作');
  });

  it('uses R2 Focus components and gates end workout behind confirmation state', () => {
    const source = readFileSync('src/features/TrainingFocusView.tsx', 'utf8');

    expect(source).toContain('resolveFocusModeInteractionState');
    expect(source).toContain('FocusModeActionBar');
    expect(source).toContain('FocusActualSetRecordSheet');
    expect(source).toContain('setSessionEndRequested(true)');
    expect(source).toContain('确认结束训练');
    expect(source).not.toContain("from '../src/prototype");
  });
});
