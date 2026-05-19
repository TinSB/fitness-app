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
  const focusActionBarSource = readFileSync(resolve(process.cwd(), 'src/uiOs/training/FocusModeActionBar.tsx'), 'utf8');
  const focusSecondaryActionsSource = readFileSync(resolve(process.cwd(), 'src/uiOs/training/FocusModeSecondaryActions.tsx'), 'utf8');

  it('keeps auxiliary actions behind the More panel in Focus Mode', () => {
    const text = visibleText(renderFocusHtml(makeFocusSession([makeExercise('bench-press', 2)])));

    expect(text).toContain('更多');
    expect(text).not.toContain('复制上组');
    expect(text).not.toContain('标记不适');
    expect(text).not.toContain('替代动作');
    expect(text).toContain('记录本组');
    expect(focusSource).not.toContain("label: '复制上组'");
    expect(focusSource).toContain("label: '标记不适'");
    expect(focusSource).toContain("label: '替代动作'");
    expect(focusSource).toContain("label: '动作顺序'");
    expect(focusSource).not.toContain("label: '记录详情'");
    expect(focusSource).not.toContain("label: '查看详情'");
  });

  it('binds replacement action to the picker and keeps the empty-state toast', () => {
    expect(focusSource).toContain('onClick: openReplacementPicker');
    expect(focusSource).toContain('setShowReplacementPicker(true)');
    expect(focusSource).toContain('当前动作暂无可替代动作');
  });

  it('keeps replacement as a labeled accessible action inside More', () => {
    const html = renderFocusHtml(makeFocusSession([makeExercise('squat', 2)]));

    expect(html).toContain('更多');
    expect(html).not.toContain('aria-label="替代动作"');
    expect(focusSource).toContain("id: 'replace-exercise'");
    expect(focusSource).toContain("label: '替代动作'");
  });

  it('keeps the two-layer action order with auxiliary actions above the primary CTA', () => {
    expect(focusSource).toContain('FocusModeActionBar');
    expect(focusSecondaryActionsSource).toContain('grid grid-cols-3 gap-2');
    expect(focusSecondaryActionsSource).toContain('data-focus-secondary-actions="visual-secondary"');
    expect(focusActionBarSource).toContain('data-focus-mode-action-bar="one-dominant-primary"');
    expect(focusActionBarSource).toContain('data-primary-action-kind');
  });
});
