import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { TrainingFocusView } from '../src/features/TrainingFocusView';
import { applySuggestedFocusStepWithResult } from '../src/engines/focusModeStateEngine';
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

describe('Focus quick apply suggestion near CTA', () => {
  it('keeps one compact prescription surface and one quick apply entry near the complete CTA', () => {
    const html = renderFocusHtml(makeFocusSession([{ ...makeExercise('bench-press', 2), name: '平板卧推' }]));
    const text = visibleText(html);

    expect(text).toContain('本组建议');
    expect(text).toContain('当前记录：缺少重量或次数');
    expect((text.match(/套用建议/g) || [])).toHaveLength(1);

    const bottomSummaryIndex = text.lastIndexOf('当前记录：');
    const bottomApplyIndex = text.lastIndexOf('套用建议');
    const ctaIndex = text.lastIndexOf('记录本组');

    expect(bottomSummaryIndex).toBeGreaterThan(-1);
    expect(bottomApplyIndex).toBeGreaterThan(bottomSummaryIndex);
    expect(ctaIndex).toBeGreaterThan(bottomApplyIndex);
    expect(text).not.toMatch(/undefined|null|prescription|manual|copy_previous|__auto_alt|__alt_/);
  });

  it('shows the applied quick action while keeping the compact prescription visible', () => {
    const applied = applySuggestedFocusStepWithResult(makeFocusSession([{ ...makeExercise('bench-press', 2), name: '平板卧推' }]), 0);
    const html = renderFocusHtml(applied.session);
    const text = visibleText(html);

    expect(applied.actionResult).toMatchObject({
      ok: true,
      changed: true,
      message: '已套用建议。',
    });
    expect(text).toContain('本组建议');
    expect(text).toContain('当前记录：缺少重量或次数');
    expect(text).toContain('已套用');
    expect(text).not.toContain('套用建议');
    expect(text).not.toMatch(/undefined|null|prescription|manual|copy_previous|__auto_alt|__alt_/);
  });

  it('keeps the applied quick action clickable through FocusActionResult no-op semantics', () => {
    const first = applySuggestedFocusStepWithResult(makeFocusSession([{ ...makeExercise('bench-press', 2), name: '平板卧推' }]), 0);
    const second = applySuggestedFocusStepWithResult(first.session, 0);

    expect(second.actionResult).toMatchObject({
      ok: true,
      changed: false,
      tone: 'info',
      message: '当前已是建议值。',
      reasonCode: 'no_change',
    });
    expect(second.actionResult.message).not.toMatch(/已套用建议/);
    expect(second.session).toEqual(first.session);
  });
});
