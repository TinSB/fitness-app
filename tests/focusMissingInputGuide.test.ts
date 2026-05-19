import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { TrainingFocusView } from '../src/features/TrainingFocusView';
import {
  getCurrentFocusStep,
  updateFocusActualDraftWithResult,
} from '../src/engines/focusModeStateEngine';
import { dispatchWorkoutExecutionEvent } from '../src/engines/workoutExecutionStateMachine';
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

const makeSession = () => makeFocusSession([{ ...makeExercise('bench-press', 2), name: '平板卧推' }]);

const completeCurrentStep = (session: TrainingSession) =>
  dispatchWorkoutExecutionEvent(session, {
    type: 'COMPLETE_STEP',
    exerciseIndex: 0,
    completedAt: '2026-05-07T10:00:00.000Z',
    nowMs: 1000,
    expectedStepId: getCurrentFocusStep(session).id,
    displayUnit: 'kg',
  });

const renderFocusText = (session: TrainingSession) =>
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
  )
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const expectMissingInputNoMutation = (before: TrainingSession) => {
  const result = completeCurrentStep(before);

  expect(result.actionResult).toMatchObject({
    ok: false,
    changed: false,
    tone: 'warning',
    message: '请先填写重量和次数。',
    reasonCode: 'missing_draft',
  });
  expect(result.updatedSession).toEqual(before);
  expect(result.updatedSession.currentFocusStepId).toBe(before.currentFocusStepId);
  expect(result.updatedSession.exercises[0].sets[0].done).toBe(false);
  expect(result.updatedSession.exercises[0].sets[0].completedAt).toBeUndefined();
  expect(result.updatedSession.restTimerState).toBeUndefined();
  expect(result.actionResult.message).not.toMatch(/已完成|已套用|已复制|已标记|已替换/);
};

describe('Focus missing input guide', () => {
  it('does not save, advance, start rest, or complete a set when both weight and reps are missing', () => {
    expectMissingInputNoMutation(makeSession());
  });

  it('treats missing weight or missing reps as missing_draft', () => {
    const repsOnly = updateFocusActualDraftWithResult(makeSession(), 0, {
      actualReps: 8,
      actualRir: 2,
      source: 'manual',
    }).session;
    const weightOnly = updateFocusActualDraftWithResult(makeSession(), 0, {
      actualWeightKg: 50,
      actualRir: 2,
      source: 'manual',
    }).session;

    expectMissingInputNoMutation(repsOnly);
    expectMissingInputNoMutation(weightOnly);
  });

  it('shows a visible current-record prompt that points to the missing input area', () => {
    const text = renderFocusText(makeSession());

    expect(text).toContain('当前记录：缺少重量或次数');
    expect(text).toContain('缺少重量或次数');
    expect(text).toContain('记录本组');
    expect(text).not.toMatch(/undefined|null|missing_draft|__auto_alt|__alt_/);
  });
});
