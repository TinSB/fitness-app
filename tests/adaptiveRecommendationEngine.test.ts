import { describe, expect, it } from 'vitest';
import {
  applyCompletedSessionToCalibration,
  createEmptyAdaptiveCalibrationState,
  getDayState,
  getLoadBias,
  getRepBand,
  makeEntryKey,
} from '../src/engines/adaptiveRecommendationEngine';
import type {
  AdaptiveCalibrationState,
  ExercisePrescription,
  RecommendationRecord,
  TrainingSession,
} from '../src/models/training-model';

const EXERCISE_ID = 'bench-press';

type SetSpec = {
  weight: number;
  reps: number;
  rir?: number;
  painFlag?: boolean;
  techniqueQuality?: 'good' | 'acceptable' | 'poor';
  done?: boolean;
};

const buildSession = (
  id: string,
  date: string,
  recommended: { kg: number; reps: number; rir?: [number, number] },
  actuals: SetSpec[],
  repBand: 'low' | 'moderate' | 'high' = 'moderate',
  dayState: 'green' | 'yellow' | 'red' = 'green',
): TrainingSession => {
  const repMin = repBand === 'low' ? 3 : repBand === 'moderate' ? 6 : 12;
  const repMax = repBand === 'low' ? 5 : repBand === 'moderate' ? 10 : 15;
  const exercise: ExercisePrescription = {
    id: EXERCISE_ID,
    baseId: EXERCISE_ID,
    canonicalExerciseId: EXERCISE_ID,
    name: 'Bench Press',
    muscle: '胸',
    kind: 'compound',
    repMin,
    repMax,
    rest: 180,
    startWeight: 60,
    targetRir: recommended.rir || [1, 3],
    sets: actuals.map((spec, index) => ({
      id: `${EXERCISE_ID}-${index + 1}`,
      type: 'top',
      weight: spec.weight,
      reps: spec.reps,
      actualWeightKg: spec.weight,
      rir: spec.rir ?? 2,
      rpe: '',
      painFlag: Boolean(spec.painFlag),
      techniqueQuality: spec.techniqueQuality ?? 'acceptable',
      done: spec.done !== false,
      completionStatus: spec.done === false ? 'incomplete' : 'completed',
      completedAt: spec.done === false ? undefined : `${date}T08:00:00.000Z`,
      targetRir: recommended.rir || [1, 3],
    })),
  };

  const snapshots: RecommendationRecord[] = actuals.map((_, index) => ({
    id: `${id}::${EXERCISE_ID}::${index}`,
    sessionId: id,
    date,
    exerciseId: EXERCISE_ID,
    baseId: EXERCISE_ID,
    setIndex: index,
    setType: 'top',
    repBand,
    dayState,
    trainingMode: 'hybrid',
    recommendedKg: recommended.kg,
    recommendedReps: recommended.reps,
    recommendedRir: recommended.rir || [1, 3],
    appliedBias: 1,
  }));

  return {
    id,
    date,
    templateId: 'push-a',
    templateName: 'Push A',
    trainingMode: 'hybrid',
    focus: 'push',
    exercises: [exercise],
    status: undefined,
    completed: true,
    recommendationSnapshots: snapshots,
  } as TrainingSession;
};

describe('adaptiveRecommendationEngine basics', () => {
  it('getRepBand classifies rep ranges into low/moderate/high', () => {
    expect(getRepBand(3, 5)).toBe('low');
    expect(getRepBand(6, 10)).toBe('moderate');
    expect(getRepBand(12, 15)).toBe('high');
  });

  it('getDayState maps readiness level to day state buckets', () => {
    expect(getDayState({ level: 'green' } as never)).toBe('green');
    expect(getDayState({ level: 'yellow' } as never)).toBe('yellow');
    expect(getDayState({ level: 'red' } as never)).toBe('red');
    expect(getDayState(null)).toBe('green');
  });

  it('returns neutral bias when no entry exists yet', () => {
    const result = getLoadBias(undefined, EXERCISE_ID, 'moderate', 'green');
    expect(result.bias).toBe(1);
    expect(result.applied).toBe(false);
    expect(result.observationCount).toBe(0);
  });
});

describe('adaptiveRecommendationEngine learning loop', () => {
  it('shifts bias upward after repeated too-light outcomes (user keeps lifting more than recommended)', () => {
    let state: AdaptiveCalibrationState = createEmptyAdaptiveCalibrationState();
    for (let i = 0; i < 3; i += 1) {
      const session = buildSession(
        `s-${i}`,
        `2026-05-${10 + i}`,
        { kg: 80, reps: 8 },
        [{ weight: 87, reps: 9, rir: 3 }],
      );
      const result = applyCompletedSessionToCalibration(state, session, `2026-05-${10 + i}T09:00:00.000Z`);
      state = result.state;
    }
    const entry = state.entries.find((item) => item.exerciseId === EXERCISE_ID && item.repBand === 'moderate' && item.dayState === 'green');
    expect(entry).toBeDefined();
    expect(entry!.loadBias).toBeGreaterThan(1.01);
    const bias = getLoadBias(state, EXERCISE_ID, 'moderate', 'green');
    expect(bias.applied).toBe(true);
    expect(bias.bias).toBeGreaterThan(1);
  });

  it('shifts bias downward after repeated failures (reps below plan)', () => {
    let state: AdaptiveCalibrationState = createEmptyAdaptiveCalibrationState();
    for (let i = 0; i < 3; i += 1) {
      const session = buildSession(
        `f-${i}`,
        `2026-05-${10 + i}`,
        { kg: 100, reps: 8 },
        [{ weight: 100, reps: 5, rir: 0 }],
      );
      const result = applyCompletedSessionToCalibration(state, session, `2026-05-${10 + i}T09:00:00.000Z`);
      state = result.state;
    }
    const entry = state.entries.find((item) => item.exerciseId === EXERCISE_ID && item.repBand === 'moderate' && item.dayState === 'green');
    expect(entry).toBeDefined();
    expect(entry!.loadBias).toBeLessThan(0.99);
    const bias = getLoadBias(state, EXERCISE_ID, 'moderate', 'green');
    expect(bias.applied).toBe(true);
    expect(bias.bias).toBeLessThan(1);
  });

  it('freezes calibration after pain flag and does not apply upward bias', () => {
    let state: AdaptiveCalibrationState = createEmptyAdaptiveCalibrationState();
    const painSession = buildSession(
      'pain-1',
      '2026-05-20',
      { kg: 80, reps: 8 },
      [{ weight: 80, reps: 6, rir: 1, painFlag: true }],
    );
    const result = applyCompletedSessionToCalibration(state, painSession, '2026-05-20T09:00:00.000Z');
    state = result.state;
    const entry = state.entries.find((item) => item.exerciseId === EXERCISE_ID);
    expect(entry).toBeDefined();
    expect(entry!.frozenUntil).toBeTruthy();
    expect(entry!.loadBias).toBeLessThanOrEqual(1);
    const bias = getLoadBias(state, EXERCISE_ID, 'moderate', 'green', '2026-05-21T09:00:00.000Z');
    expect(bias.frozen).toBe(true);
    expect(bias.bias).toBeLessThanOrEqual(1);
  });

  it('keeps different rep bands isolated', () => {
    let state: AdaptiveCalibrationState = createEmptyAdaptiveCalibrationState();
    for (let i = 0; i < 2; i += 1) {
      const session = buildSession(
        `iso-${i}`,
        `2026-05-${10 + i}`,
        { kg: 60, reps: 12 },
        [{ weight: 70, reps: 14, rir: 3 }],
        'high',
      );
      state = applyCompletedSessionToCalibration(state, session, `2026-05-${10 + i}T09:00:00.000Z`).state;
    }
    const lowBias = getLoadBias(state, EXERCISE_ID, 'low', 'green');
    const highBias = getLoadBias(state, EXERCISE_ID, 'high', 'green');
    expect(lowBias.observationCount).toBe(0);
    expect(highBias.observationCount).toBeGreaterThan(0);
    expect(makeEntryKey(EXERCISE_ID, 'low', 'green')).not.toBe(makeEntryKey(EXERCISE_ID, 'high', 'green'));
  });

  it('keeps different day states isolated', () => {
    let state: AdaptiveCalibrationState = createEmptyAdaptiveCalibrationState();
    for (let i = 0; i < 2; i += 1) {
      const session = buildSession(
        `dy-${i}`,
        `2026-05-${10 + i}`,
        { kg: 80, reps: 8 },
        [{ weight: 88, reps: 9, rir: 3 }],
        'moderate',
        'yellow',
      );
      state = applyCompletedSessionToCalibration(state, session, `2026-05-${10 + i}T09:00:00.000Z`).state;
    }
    const greenBias = getLoadBias(state, EXERCISE_ID, 'moderate', 'green');
    const yellowBias = getLoadBias(state, EXERCISE_ID, 'moderate', 'yellow');
    expect(greenBias.observationCount).toBe(0);
    expect(yellowBias.observationCount).toBeGreaterThan(0);
    expect(yellowBias.bias).toBeGreaterThan(1);
  });

  it('reconciles records with actual outcomes and acceptance', () => {
    const session = buildSession(
      'rec-1',
      '2026-05-30',
      { kg: 80, reps: 8 },
      [{ weight: 85, reps: 8, rir: 2 }],
    );
    const { reconciledRecords, observations } = applyCompletedSessionToCalibration(
      createEmptyAdaptiveCalibrationState(),
      session,
      '2026-05-30T09:00:00.000Z',
    );
    expect(reconciledRecords).toHaveLength(1);
    expect(reconciledRecords[0].actualKg).toBe(85);
    expect(reconciledRecords[0].acceptance).toBe('overridden_up');
    expect(reconciledRecords[0].outcome).toBe('too_light');
    expect(observations).toHaveLength(1);
  });

  it('decays bias toward 1 after long inactivity', () => {
    let state: AdaptiveCalibrationState = createEmptyAdaptiveCalibrationState();
    for (let i = 0; i < 3; i += 1) {
      const session = buildSession(
        `decay-${i}`,
        `2026-01-${10 + i}`,
        { kg: 80, reps: 8 },
        [{ weight: 88, reps: 9, rir: 3 }],
      );
      state = applyCompletedSessionToCalibration(state, session, `2026-01-${10 + i}T09:00:00.000Z`).state;
    }
    const fresh = getLoadBias(state, EXERCISE_ID, 'moderate', 'green', '2026-01-13T09:00:00.000Z');
    const stale = getLoadBias(state, EXERCISE_ID, 'moderate', 'green', '2026-04-01T09:00:00.000Z');
    expect(stale.bias).toBeLessThan(fresh.bias);
    expect(stale.bias).toBeGreaterThanOrEqual(1);
  });
});
