import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { TrainingFocusView } from '../src/features/TrainingFocusView';
import type { UnitSettings } from '../src/models/training-model';
import { makeExercise, makeFocusSession } from './focusModeFixtures';

const noop = (..._args: unknown[]) => undefined;
const setStateNoop = (() => undefined) as React.Dispatch<React.SetStateAction<number>>;
const lbToKg = (lb: number) => lb * 0.45359237;
const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');
const visibleText = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

const unitSettings: UnitSettings = {
  weightUnit: 'lb',
  defaultIncrementKg: 2.5,
  defaultIncrementLb: 5,
  customIncrementsKg: [],
  customIncrementsLb: [],
};

const renderFocus = () =>
  renderToStaticMarkup(
    React.createElement(TrainingFocusView, {
      session: makeFocusSession([{ ...makeExercise('bench-press', 1, 0, 1), sets: [{ id: 'set-1', weight: lbToKg(135), reps: 5, rir: 2, done: false, painFlag: false, type: 'top' }] }]),
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

describe('UI-OS R8.5 Focus microcopy purge', () => {
  it('removes default actual-record helper and long explanations from the visible Focus screen', () => {
    const html = renderFocus();
    const text = visibleText(html);

    expect(text).not.toContain('实际记录通过底部动作栏填写');
    expect(text).not.toContain('推荐处方与实际记录分开');
    expect(text).not.toContain('base weight not included');
    expect(text).not.toContain('estimated display');
  });

  it('keeps recommendation basis and weight details collapsed by default', () => {
    const html = renderFocus();
    const source = read('src/features/TrainingFocusView.tsx');

    expect(html).toContain('重量详情');
    expect(html).not.toContain('<details');
    expect(html).toContain('依据');
    expect(html).not.toContain('aria-label="推荐依据"');
    expect(source).toContain('showExplanationSheet');
    expect(source).toContain('<BottomSheet open={showExplanationSheet} title="推荐依据"');
  });
});
