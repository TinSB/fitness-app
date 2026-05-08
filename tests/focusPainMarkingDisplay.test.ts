import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  buildFocusPainBoundaryNotice,
  TrainingFocusView,
} from '../src/features/TrainingFocusView';
import {
  getActualSetDraft,
  getCurrentFocusStep,
  switchFocusExercise,
} from '../src/engines/focusModeStateEngine';
import { dispatchWorkoutExecutionEvent } from '../src/engines/workoutExecutionStateMachine';
import type { TrainingSession, UnitSettings } from '../src/models/training-model';
import { attachSupportBlocks, makeExercise, makeFocusSession } from './focusModeFixtures';

const unitSettings: UnitSettings = {
  weightUnit: 'kg',
  defaultIncrementKg: 2.5,
  defaultIncrementLb: 5,
  customIncrementsKg: [],
  customIncrementsLb: [],
};

const makeSession = () =>
  makeFocusSession([
    { ...makeExercise('bench-press', 2), name: '平板卧推' },
    { ...makeExercise('incline-db-press', 1), name: '上斜哑铃卧推' },
  ]);

const visibleText = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

const renderFocus = (session: TrainingSession) =>
  renderToStaticMarkup(
    React.createElement(TrainingFocusView, {
      session,
      unitSettings,
      restTimer: null,
      expandedExercise: 0,
      setExpandedExercise: () => undefined,
      onSetChange: () => undefined,
      onCompleteSet: () => undefined,
      onCopyPrevious: () => undefined,
      onAdjustSet: () => undefined,
      onApplySuggestion: () => undefined,
      onUpdateActualDraft: () => undefined,
      onSwitchExercise: () => undefined,
      onReplaceExercise: () => undefined,
      onLoadFeedback: () => undefined,
      onCompleteSupportSet: () => undefined,
      onSkipSupportExercise: () => undefined,
      onSkipSupportBlock: () => undefined,
      onUpdateSupportSkipReason: () => undefined,
    }),
  );

describe('Focus pain marking display boundary', () => {
  it('renders a short current-group notice when the current cursor draft has painFlag', () => {
    const marked = dispatchWorkoutExecutionEvent(makeSession(), {
      type: 'MARK_PAIN',
      exerciseIndex: 0,
      painFlag: true,
    }).updatedSession;
    const text = visibleText(renderFocus(marked));

    expect(text).toContain('本组已标记不适，可再次点击取消。');
    expect(text).toContain('仅记录本组，不会自动设为长期限制。');
    expect(text).not.toMatch(/受伤|禁忌|限制问题|长期风险|undefined|null|pain_flag|bench-press/);
  });

  it('does not show another exercise or set painFlag after switching cursor', () => {
    const markedFirstExercise = dispatchWorkoutExecutionEvent(makeSession(), {
      type: 'MARK_PAIN',
      exerciseIndex: 0,
      painFlag: true,
    }).updatedSession;
    const switched = switchFocusExercise(markedFirstExercise, 1);
    const current = getCurrentFocusStep(switched);

    expect(current.exerciseId).toBe('incline-db-press');
    expect(getActualSetDraft(switched, current)).toBeNull();
    expect(buildFocusPainBoundaryNotice({ currentStep: current, actualDraft: getActualSetDraft(switched, current) })).toBeNull();
    expect(visibleText(renderFocus(switched))).not.toContain('本组已标记不适，可再次点击取消。');
  });

  it('does not show a current-group notice for another set on the same exercise', () => {
    const prescribed = dispatchWorkoutExecutionEvent(makeSession(), { type: 'APPLY_PRESCRIPTION', exerciseIndex: 0 }).updatedSession;
    const marked = dispatchWorkoutExecutionEvent(prescribed, { type: 'MARK_PAIN', exerciseIndex: 0, painFlag: true }).updatedSession;
    const firstStep = getCurrentFocusStep(marked);
    const completed = dispatchWorkoutExecutionEvent(marked, {
      type: 'COMPLETE_STEP',
      exerciseIndex: 0,
      completedAt: '2026-05-07T10:00:00.000Z',
      nowMs: 1000,
      expectedStepId: firstStep.id,
      displayUnit: 'kg',
    }).updatedSession;
    const nextStep = getCurrentFocusStep(completed);

    expect(completed.exercises[0].sets[0].painFlag).toBe(true);
    expect(nextStep.exerciseId).toBe('bench-press');
    expect(nextStep.setIndex).toBe(1);
    expect(buildFocusPainBoundaryNotice({ currentStep: nextStep, actualDraft: getActualSetDraft(completed, nextStep) })).toBeNull();
  });

  it('does not render the main-training pain notice for support steps', () => {
    const supportSession = attachSupportBlocks(makeSession());
    const current = getCurrentFocusStep(supportSession);

    expect(current.stepType).toBe('correction');
    expect(buildFocusPainBoundaryNotice({ currentStep: current, actualDraft: null })).toBeNull();
    expect(visibleText(renderFocus(supportSession))).not.toContain('仅记录本组，不会自动设为长期限制。');
  });
});
