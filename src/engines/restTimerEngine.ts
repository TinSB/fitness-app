import type { RestTimerState, TrainingSession } from '../models/training-model';

const nowMs = (now: Date | number = Date.now()) => (now instanceof Date ? now.getTime() : now);

export const createRestTimerState = (
  exerciseId: string,
  setIndex: number,
  durationSec: number,
  now: Date | number = Date.now(),
  label = ''
): RestTimerState => ({
  exerciseId,
  setIndex,
  startedAt: new Date(nowMs(now)).toISOString(),
  durationSec: Math.max(0, Math.round(durationSec)),
  isRunning: true,
  label,
});

export const getRestTimerElapsedSec = (timer?: RestTimerState | null, now: Date | number = Date.now()) => {
  if (!timer?.startedAt) return 0;
  const startedAt = new Date(timer.startedAt).getTime();
  if (!Number.isFinite(startedAt)) return 0;
  return Math.max(0, Math.floor((nowMs(now) - startedAt) / 1000));
};

export const getRestTimerRemainingSec = (timer?: RestTimerState | null, now: Date | number = Date.now()) => {
  if (!timer) return 0;
  if (!timer.isRunning) return Math.max(0, Math.round(timer.pausedRemainingSec ?? timer.durationSec));
  return Math.max(0, Math.round(timer.durationSec) - getRestTimerElapsedSec(timer, now));
};

export const isRestTimerExpired = (timer?: RestTimerState | null, now: Date | number = Date.now()) =>
  Boolean(timer?.isRunning) && getRestTimerRemainingSec(timer, now) <= 0;

export const stopRestTimer = (timer?: RestTimerState | null): RestTimerState | null =>
  timer ? { ...timer, isRunning: false, pausedRemainingSec: getRestTimerRemainingSec(timer) } : null;

export const extendRestTimer = (timer: RestTimerState | null | undefined, deltaSec: number): RestTimerState | null =>
  timer
    ? {
        ...timer,
        durationSec: Math.max(0, timer.durationSec + deltaSec),
        pausedRemainingSec: timer.isRunning ? timer.pausedRemainingSec : Math.max(0, (timer.pausedRemainingSec ?? timer.durationSec) + deltaSec),
      }
    : null;

export const pauseRestTimer = (timer?: RestTimerState | null, now: Date | number = Date.now()): RestTimerState | null =>
  timer ? { ...timer, isRunning: false, pausedRemainingSec: getRestTimerRemainingSec(timer, now) } : null;

export const resumeRestTimer = (timer?: RestTimerState | null, now: Date | number = Date.now()): RestTimerState | null => {
  if (!timer) return null;
  const remaining = Math.max(0, timer.pausedRemainingSec ?? getRestTimerRemainingSec(timer, now));
  return {
    ...timer,
    startedAt: new Date(nowMs(now)).toISOString(),
    durationSec: remaining,
    pausedRemainingSec: undefined,
    isRunning: remaining > 0,
  };
};

export const resetRestTimer = (timer?: RestTimerState | null, now: Date | number = Date.now()): RestTimerState | null =>
  timer
    ? {
        ...timer,
        startedAt: new Date(nowMs(now)).toISOString(),
        durationSec: Math.max(0, Math.round(timer.durationSec)),
        pausedRemainingSec: undefined,
        isRunning: true,
      }
    : null;

export const getSessionRestTimer = (session?: TrainingSession | null): RestTimerState | null =>
  session?.restTimerState && session.restTimerState.isRunning ? session.restTimerState : null;
