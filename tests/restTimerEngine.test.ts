import { describe, expect, it } from 'vitest';
import { createRestTimerState, getRestTimerRemainingSec, pauseRestTimer, resetRestTimer, resumeRestTimer } from '../src/engines/restTimerEngine';

describe('restTimerEngine', () => {
  it('calculates remaining seconds from startedAt and durationSec', () => {
    const timer = createRestTimerState('bench-press', 1, 120, new Date('2026-04-25T10:00:00.000Z'));

    expect(getRestTimerRemainingSec(timer, new Date('2026-04-25T10:00:30.000Z'))).toBe(90);
  });

  it('returns 0 after the timer expires', () => {
    const timer = createRestTimerState('bench-press', 1, 60, new Date('2026-04-25T10:00:00.000Z'));

    expect(getRestTimerRemainingSec(timer, new Date('2026-04-25T10:02:00.000Z'))).toBe(0);
  });

  it('preserves remaining time when paused and resumes from the current time', () => {
    const timer = createRestTimerState('bench-press', 1, 120, new Date('2026-04-25T10:00:00.000Z'));
    const paused = pauseRestTimer(timer, new Date('2026-04-25T10:00:40.000Z'));
    const resumed = resumeRestTimer(paused, new Date('2026-04-25T10:05:00.000Z'));

    expect(paused?.pausedRemainingSec).toBe(80);
    expect(getRestTimerRemainingSec(resumed, new Date('2026-04-25T10:05:10.000Z'))).toBe(70);
  });

  it('resets the current timer to the full duration without changing its target step', () => {
    const timer = createRestTimerState('bench-press', 1, 120, new Date('2026-04-25T10:00:00.000Z'));
    const paused = pauseRestTimer(timer, new Date('2026-04-25T10:00:40.000Z'));
    const reset = resetRestTimer(paused, new Date('2026-04-25T10:05:00.000Z'));

    expect(reset?.exerciseId).toBe('bench-press');
    expect(reset?.setIndex).toBe(1);
    expect(reset?.isRunning).toBe(true);
    expect(reset?.pausedRemainingSec).toBeUndefined();
    expect(getRestTimerRemainingSec(reset, new Date('2026-04-25T10:05:10.000Z'))).toBe(110);
  });
});
