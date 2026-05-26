import { describe, expect, it } from 'vitest';
import {
  buildTrainingLapseSignal,
  decayAdaptiveStateForLapse,
  decayCalibrationStateForLapse,
} from '../src/engines/trainingLapseEngine';
import type { AdaptiveCalibrationState, TrainingSession } from '../src/models/training-model';

const makeSession = (date: string): TrainingSession =>
  ({
    id: `s-${date}`,
    date,
    templateId: 'push-a',
    templateName: 'Push A',
    trainingMode: 'hybrid',
    focus: 'push',
    completed: true,
    finishedAt: `${date}T10:00:00.000Z`,
    exercises: [],
  } as unknown as TrainingSession);

describe('trainingLapseEngine', () => {
  it('returns fresh when last session is within 4 days', () => {
    const signal = buildTrainingLapseSignal([makeSession('2026-05-25')], '2026-05-27T10:00:00.000Z');
    expect(signal.stage).toBe('fresh');
    expect(signal.resetFatigue).toBe(false);
    expect(signal.resetRotation).toBe(false);
  });

  it('returns normal between 4 and 9 days', () => {
    const signal = buildTrainingLapseSignal([makeSession('2026-05-20')], '2026-05-27T10:00:00.000Z');
    expect(signal.stage).toBe('normal');
    expect(signal.resetFatigue).toBe(false);
  });

  it('returns lapsed between 10 and 20 days and decays fatigue partially', () => {
    const signal = buildTrainingLapseSignal([makeSession('2026-05-10')], '2026-05-27T10:00:00.000Z');
    expect(signal.stage).toBe('lapsed');
    expect(signal.decayMultiplier).toBeLessThan(1);
    expect(signal.resetFatigue).toBe(false);
  });

  it('returns long_lapsed between 21 and 45 days and resets fatigue + rotation', () => {
    const signal = buildTrainingLapseSignal([makeSession('2026-05-01')], '2026-05-27T10:00:00.000Z');
    expect(signal.stage).toBe('long_lapsed');
    expect(signal.resetFatigue).toBe(true);
    expect(signal.resetRotation).toBe(true);
    expect(signal.resetCalibrationBias).toBe(false);
  });

  it('returns dormant past 45 days and resets calibration bias too', () => {
    const signal = buildTrainingLapseSignal([makeSession('2026-03-01')], '2026-05-27T10:00:00.000Z');
    expect(signal.stage).toBe('dormant');
    expect(signal.resetCalibrationBias).toBe(true);
  });

  it('treats empty history as fresh and recommends fresh advice', () => {
    const signal = buildTrainingLapseSignal([], '2026-05-27T10:00:00.000Z');
    expect(signal.stage).toBe('fresh');
    expect(signal.hasHistory).toBe(false);
  });

  it('decays adaptive state pain and performance drops when lapsed', () => {
    const lapse = buildTrainingLapseSignal([makeSession('2026-05-10')], '2026-05-27T10:00:00.000Z');
    const next = decayAdaptiveStateForLapse(
      {
        issueScores: { overhead_press_restriction: 4 },
        painByExercise: { 'bench-press': 2 },
        performanceDrops: ['bench-press'],
      },
      lapse,
    );
    expect(next.painByExercise!['bench-press']).toBeLessThanOrEqual(2);
    expect(next.performanceDrops).toEqual(['bench-press']);
  });

  it('wipes performance drops and pain when long lapsed', () => {
    const lapse = buildTrainingLapseSignal([makeSession('2026-05-01')], '2026-05-27T10:00:00.000Z');
    const next = decayAdaptiveStateForLapse(
      {
        issueScores: { overhead_press_restriction: 4 },
        painByExercise: { 'bench-press': 3 },
        performanceDrops: ['bench-press'],
      },
      lapse,
    );
    expect(next.performanceDrops).toEqual([]);
    expect(Object.keys(next.painByExercise || {}).length).toBeLessThanOrEqual(1);
  });

  it('resets calibration bias to 1 when dormant', () => {
    const lapse = buildTrainingLapseSignal([makeSession('2026-03-01')], '2026-05-27T10:00:00.000Z');
    const calibration: AdaptiveCalibrationState = {
      version: 1,
      entries: [
        {
          exerciseId: 'bench-press',
          repBand: 'moderate',
          dayState: 'green',
          loadBias: 1.08,
          observationCount: 5,
          recentSamples: [],
          lastUpdated: '2026-03-01T10:00:00.000Z',
          reasonHints: [],
          frozenUntil: '2026-03-15T00:00:00.000Z',
        },
      ],
      recommendationLog: [],
      lastUpdated: '2026-03-01T10:00:00.000Z',
    };
    const next = decayCalibrationStateForLapse(calibration, lapse);
    expect(next?.entries[0].loadBias).toBe(1);
    expect(next?.entries[0].frozenUntil).toBeUndefined();
  });

  it('partially decays bias toward 1 when long_lapsed (not dormant)', () => {
    const lapse = buildTrainingLapseSignal([makeSession('2026-05-01')], '2026-05-27T10:00:00.000Z');
    const calibration: AdaptiveCalibrationState = {
      version: 1,
      entries: [
        {
          exerciseId: 'bench-press',
          repBand: 'moderate',
          dayState: 'green',
          loadBias: 1.1,
          observationCount: 5,
          recentSamples: [],
          lastUpdated: '2026-05-01T10:00:00.000Z',
          reasonHints: [],
        },
      ],
      recommendationLog: [],
      lastUpdated: '2026-05-01T10:00:00.000Z',
    };
    const next = decayCalibrationStateForLapse(calibration, lapse);
    expect(next?.entries[0].loadBias).toBeLessThan(1.1);
    expect(next?.entries[0].loadBias).toBeGreaterThan(1);
  });
});
