import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { completeFocusSet, getCurrentFocusStep } from '../src/engines/focusModeStateEngine';
import { createRestTimerState, pauseRestTimer, resetRestTimer, resumeRestTimer } from '../src/engines/restTimerEngine';
import { dispatchWorkoutExecutionEvent } from '../src/engines/workoutExecutionStateMachine';
import { TrainingFocusView } from '../src/features/TrainingFocusView';
import { TrainingView } from '../src/features/TrainingView';
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
        restTimer: session.restTimerState || null,
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
        onToggleRestTimer: noop,
        onResetRestTimer: noop,
        onEndRest: noop,
        onCompleteSupportSet: noop,
        onSkipSupportExercise: noop,
        onSkipSupportBlock: noop,
        onUpdateSupportSkipReason: noop,
      }),
    ),
  );

const renderTrainingText = (session: TrainingSession) =>
  visibleText(
    renderToStaticMarkup(
      React.createElement(TrainingView, {
        session,
        unitSettings,
        restTimer: session.restTimerState || null,
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
        onReturnFocusMode: noop,
        onExtendRestTimer: noop,
        onToggleRestTimer: noop,
        onResetRestTimer: noop,
        onEndRest: noop,
        onGoToday: noop,
      }),
    ),
  );

describe('rest timer action semantics', () => {
  it('ending rest enters the next set and clears the rest state', () => {
    const completed = completeFocusSet(makeFocusSession([makeExercise('bench-press', 2)]), 0, '2026-05-01T10:00:00.000Z', 1000);
    const resting = completed?.session as TrainingSession;

    const result = dispatchWorkoutExecutionEvent(resting, { type: 'END_REST' });
    const current = getCurrentFocusStep(result.updatedSession);

    expect(result.feedback).toBe('已进入下一组。');
    expect(result.updatedSession.restTimerState).toBeNull();
    expect(current.exerciseId).toBe('bench-press');
    expect(current.setIndex).toBe(1);
    expect(result.updatedSession.completed).toBe(false);
  });

  it('resetting the timer does not advance the current step', () => {
    const completed = completeFocusSet(makeFocusSession([makeExercise('bench-press', 2)]), 0, '2026-05-01T10:00:00.000Z', 1000);
    const resting = completed?.session as TrainingSession;
    const before = getCurrentFocusStep(resting);

    const reset = {
      ...resting,
      restTimerState: resetRestTimer(resting.restTimerState, new Date('2026-05-01T10:01:00.000Z')),
    };
    const after = getCurrentFocusStep(reset);

    expect(after.id).toBe(before.id);
    expect(after.setIndex).toBe(1);
    expect(reset.restTimerState).not.toBeNull();
  });

  it('pause and resume do not change the current step', () => {
    const completed = completeFocusSet(makeFocusSession([makeExercise('bench-press', 2)]), 0, '2026-05-01T10:00:00.000Z', 1000);
    const resting = completed?.session as TrainingSession;
    const before = getCurrentFocusStep(resting);

    const paused = { ...resting, restTimerState: pauseRestTimer(resting.restTimerState, new Date('2026-05-01T10:00:30.000Z')) };
    const resumed = { ...paused, restTimerState: resumeRestTimer(paused.restTimerState, new Date('2026-05-01T10:02:00.000Z')) };

    expect(getCurrentFocusStep(paused).id).toBe(before.id);
    expect(getCurrentFocusStep(resumed).id).toBe(before.id);
  });

  it('ending rest after the last set does not save or finalize the session', () => {
    const completed = completeFocusSet(makeFocusSession([makeExercise('bench-press', 1)]), 0, '2026-05-01T10:00:00.000Z', 1000);
    const resting = completed?.session as TrainingSession;

    const result = dispatchWorkoutExecutionEvent(resting, { type: 'END_REST' });

    expect(result.updatedSession.restTimerState).toBeNull();
    expect(result.updatedSession.completed).toBe(false);
    expect(result.updatedSession.finishedAt).toBeUndefined();
    expect(result.feedback).toContain('需要结束训练时请手动点击结束');
  });

  it('renders clear Chinese rest action labels without raw state text', () => {
    const session = {
      ...makeFocusSession([makeExercise('bench-press', 2)]),
      restTimerState: createRestTimerState('bench-press', 0, 90, new Date('2026-05-01T10:00:00.000Z'), '正式组 1 / 2'),
    };
    const text = `${renderFocusText(session)} ${renderTrainingText(session)}`;

    expect(text).toContain('暂停');
    expect(text).toContain('结束休息');
    expect(text).toContain('重置计时');
    expect(text).not.toContain('清零');
    expect(text).not.toMatch(/\b(undefined|null|END_REST|resting)\b/);
  });
});
