import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
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

const renderFocusHtml = (session: TrainingSession) =>
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

const visibleText = (html: string) =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

describe('TrainingFocusView bottom action bar', () => {
  const focusSource = readFileSync(resolve(process.cwd(), 'src/features/TrainingFocusView.tsx'), 'utf8');

  it('keeps auxiliary actions visible in Focus Mode', () => {
    const text = visibleText(renderFocusHtml(makeFocusSession([makeExercise('bench-press', 2)])));

    expect(text).toContain('复制上组');
    expect(text).toContain('标记不适');
    expect(text).toContain('替代动作');
    expect(text).toContain('完成一组');
  });

  it('binds replacement action to the picker and keeps the empty-state toast', () => {
    expect(focusSource).toContain('onClick={openReplacementPicker}');
    expect(focusSource).toContain('setShowReplacementPicker(true)');
    expect(focusSource).toContain('当前动作暂无可替代动作');
  });

  it('renders replacement as a labeled, accessible button', () => {
    const html = renderFocusHtml(makeFocusSession([makeExercise('squat', 2)]));

    expect(html).toContain('aria-label="替代动作"');
    expect(html).toContain('>替代动作</span>');
  });

  it('keeps the two-layer action order with auxiliary actions above the primary CTA', () => {
    const replacementIndex = focusSource.indexOf('aria-label="替代动作"');
    const completeIndex = focusSource.lastIndexOf('aria-label="完成一组"');

    expect(focusSource).toContain('grid grid-cols-3 gap-2');
    expect(replacementIndex).toBeGreaterThan(-1);
    expect(completeIndex).toBeGreaterThan(replacementIndex);
  });
});
