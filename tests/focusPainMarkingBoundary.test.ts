import { describe, expect, it } from 'vitest';
import { buildFocusPainBoundaryNotice } from '../src/features/TrainingFocusView';
import {
  getActualSetDraft,
  getCurrentFocusStep,
  switchFocusExercise,
} from '../src/engines/focusModeStateEngine';
import { dispatchWorkoutExecutionEvent } from '../src/engines/workoutExecutionStateMachine';
import { makeAppData, makeStatus } from './fixtures';
import { attachSupportBlocks, makeExercise, makeFocusSession } from './focusModeFixtures';

const makeSession = () =>
  makeFocusSession([
    { ...makeExercise('bench-press', 2), name: '平板卧推' },
    { ...makeExercise('incline-db-press', 1), name: '上斜哑铃卧推' },
  ]);

describe('Focus pain marking boundary', () => {
  it('marks pain only on the current cursor draft and does not touch app-level soreness or restrictions', () => {
    const data = makeAppData({
      todayStatus: makeStatus({ date: '2026-05-07', soreness: ['背'] }),
      activeSession: makeSession(),
    });
    const beforeTodayStatus = structuredClone(data.todayStatus);
    const beforeScreeningProfile = structuredClone(data.screeningProfile);
    const beforeSettings = structuredClone(data.settings);

    const result = dispatchWorkoutExecutionEvent(data.activeSession!, {
      type: 'MARK_PAIN',
      exerciseIndex: 0,
      painFlag: true,
    });
    const nextData = { ...data, activeSession: result.updatedSession };
    const draft = getActualSetDraft(nextData.activeSession!, getCurrentFocusStep(nextData.activeSession!));

    expect(result.actionResult).toMatchObject({
      ok: true,
      changed: true,
      message: '已标记本组不适。',
    });
    expect(draft).toMatchObject({
      stepId: 'main:bench-press:working:0',
      exerciseId: 'bench-press',
      setIndex: 0,
      painFlag: true,
    });
    expect(nextData.todayStatus).toEqual(beforeTodayStatus);
    expect(nextData.screeningProfile).toEqual(beforeScreeningProfile);
    expect(nextData.settings).toEqual(beforeSettings);
    expect(nextData.history).toEqual([]);
    expect(JSON.stringify(nextData)).not.toMatch(/screeningRestriction|长期限制|限制问题/);
  });

  it('keeps pain marking on the actual replacement exercise draft', () => {
    const onSecond = switchFocusExercise(makeSession(), 1);
    const replaced = dispatchWorkoutExecutionEvent(onSecond, {
      type: 'APPLY_REPLACEMENT',
      exerciseIndex: 1,
      replacementId: 'smith-incline-press',
    }).updatedSession;

    const marked = dispatchWorkoutExecutionEvent(replaced, {
      type: 'MARK_PAIN',
      exerciseIndex: 1,
      painFlag: true,
    }).updatedSession;
    const current = getCurrentFocusStep(marked);
    const draft = getActualSetDraft(marked, current);

    expect(marked.exercises[1]).toMatchObject({
      originalExerciseId: 'incline-db-press',
      actualExerciseId: 'smith-incline-press',
      replacementExerciseId: 'smith-incline-press',
    });
    expect(current.exerciseId).toBe('smith-incline-press');
    expect(draft).toMatchObject({
      exerciseId: 'smith-incline-press',
      painFlag: true,
    });
    expect(draft?.exerciseId).not.toBe('incline-db-press');
  });

  it('does not show a pain boundary notice for support steps', () => {
    const supportSession = attachSupportBlocks(makeSession());
    const current = getCurrentFocusStep(supportSession);

    expect(current.stepType).toBe('correction');
    expect(
      buildFocusPainBoundaryNotice({
        currentStep: current,
        actualDraft: {
          stepId: current.id,
          exerciseId: current.exerciseId,
          setIndex: current.setIndex,
          painFlag: true,
        },
      }),
    ).toBeNull();
  });
});
