import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { applySuggestedFocusStepWithResult, getActualSetDraft, getCurrentFocusStep, updateFocusActualDraftWithResult } from '../src/engines/focusModeStateEngine';
import { TrainingFocusView } from '../src/features/TrainingFocusView';
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

describe('UI-OS R8.6 applied suggestion state', () => {
  it('applies actionable weight and planned reps without filling RIR', () => {
    const applied = applySuggestedFocusStepWithResult(makeFocusSession([makeExercise('bench-press', 1)]), 0);
    const draft = getActualSetDraft(applied.session, getCurrentFocusStep(applied.session));

    expect(draft).toMatchObject({
      actualWeightKg: 50,
      actualReps: 8,
      source: 'prescription',
    });
    expect(draft?.actualRir).toBeUndefined();
  });

  it('shows current record once and removes normal apply action after suggestion is applied', () => {
    const applied = applySuggestedFocusStepWithResult(makeFocusSession([makeExercise('bench-press', 1)]), 0);
    const text = renderFocusText(applied.session);

    expect((text.match(/当前记录：50 kg × 8 次/g) || [])).toHaveLength(1);
    expect(text).toContain('完成一组');
    expect(text).toContain('修改');
    expect(text).not.toContain('已套用');
    expect(text).not.toContain('当前记录：缺少重量或次数');
    expect(text).not.toContain('套用建议');
  });

  it('keeps manual record state distinct from applied suggestion state', () => {
    const manual = updateFocusActualDraftWithResult(makeFocusSession([makeExercise('bench-press', 1)]), 0, {
      actualWeightKg: 47.5,
      actualReps: 7,
      source: 'manual',
    }).session;
    const text = renderFocusText(manual);

    expect(text).toContain('当前记录：47.5 kg × 7 次 · 手动');
    expect(text).not.toContain('已套用');
  });
});
