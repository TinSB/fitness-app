import { describe, expect, it } from 'vitest';
import { getCurrentFocusStep, setCurrentStep, switchFocusExercise } from '../src/engines/focusModeStateEngine';
import { makeExercise, makeFocusSession } from './focusModeFixtures';

const makePushSession = () =>
  makeFocusSession([
    { ...makeExercise('bench-press', 2), name: '平板卧推' },
    { ...makeExercise('incline-db-press', 2), name: '上斜哑铃卧推' },
    { ...makeExercise('shoulder-press', 1), name: '肩推' },
  ]);

describe('focus step selector', () => {
  it('prioritizes a valid manual cursor over an earlier first incomplete step', () => {
    const session = switchFocusExercise(makePushSession(), 1);

    const current = getCurrentFocusStep(session);

    expect(current.exerciseId).toBe('incline-db-press');
    expect(current.setIndex).toBe(0);
    expect(session.focusManualStepOverride).toBe(true);
  });

  it('falls back to the first incomplete step only when the saved cursor is invalid', () => {
    const session = makePushSession();
    session.currentFocusStepId = 'main:missing-exercise:working:0';
    session.currentExerciseId = 'missing-exercise';
    session.currentSetIndex = 0;
    session.focusManualStepOverride = true;

    const current = getCurrentFocusStep(session);

    expect(current.exerciseId).toBe('bench-press');
    expect(current.setIndex).toBe(0);
  });

  it('advances a completed manual cursor to the same exercise next set before earlier incomplete work', () => {
    const session = switchFocusExercise(makePushSession(), 1);
    session.exercises[1].sets[0].done = true;
    session.exercises[1].sets[0].completedAt = '2026-05-01T10:00:00.000Z';
    session.currentFocusStepId = 'main:incline-db-press:working:0';
    session.currentExerciseId = 'incline-db-press';
    session.currentSetIndex = 0;
    session.focusManualStepOverride = true;

    const current = getCurrentFocusStep(session);

    expect(current.exerciseId).toBe('incline-db-press');
    expect(current.setIndex).toBe(1);
  });

  it('moves a completed manual cursor forward instead of jumping back to earlier incomplete work', () => {
    const session = switchFocusExercise(makePushSession(), 1);
    session.exercises[1].sets.forEach((set, index) => {
      set.done = true;
      set.completedAt = `2026-05-01T10:0${index}:00.000Z`;
    });
    session.currentFocusStepId = 'main:incline-db-press:working:1';
    session.currentExerciseId = 'incline-db-press';
    session.currentSetIndex = 1;
    session.focusManualStepOverride = true;

    const current = getCurrentFocusStep(session);

    expect(current.exerciseId).toBe('shoulder-press');
    expect(current.setIndex).toBe(0);
  });

  it('preserves manual override by default when setting the same current step', () => {
    const session = switchFocusExercise(makePushSession(), 1);
    const current = getCurrentFocusStep(session);

    setCurrentStep(session, current);
    expect(session.focusManualStepOverride).toBe(true);

    setCurrentStep(session, current, { clearManualOverride: true });
    expect(session.focusManualStepOverride).toBe(false);
  });
});
