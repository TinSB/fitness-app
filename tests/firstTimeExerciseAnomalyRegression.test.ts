import { describe, expect, it } from 'vitest';
import { detectSetAnomalies, getReliablePreviousWorkingSetsForExercise } from '../src/engines/setAnomalyEngine';
import type { TrainingSession, TrainingSetLog, UnitSettings } from '../src/models/training-model';

const unitSettings: UnitSettings = {
  weightUnit: 'kg',
  defaultIncrementKg: 2.5,
  defaultIncrementLb: 5,
  customIncrementsKg: [],
  customIncrementsLb: [],
};

const lbUnitSettings: UnitSettings = {
  ...unitSettings,
  weightUnit: 'lb',
};

const workingSet = (exerciseId: string, weight: number): TrainingSetLog => ({
  id: `${exerciseId}-${weight}`,
  type: 'working',
  weight,
  actualWeightKg: weight,
  reps: 10,
  rir: 2,
  done: true,
});

const session = (exerciseId: string, sets: TrainingSetLog[], overrides: Partial<TrainingSession> = {}): TrainingSession =>
  ({
    id: `session-${exerciseId}`,
    date: '2026-04-22',
    templateId: 'pull-a',
    templateName: '拉 A',
    trainingMode: 'hypertrophy',
    completed: true,
    finishedAt: '2026-04-22T10:00:00.000Z',
    exercises: [
      {
        id: exerciseId,
        name: exerciseId === 'lat-pulldown' ? '高位下拉' : '坐姿划船',
        muscle: 'back',
        kind: 'machine',
        sets,
        repMin: 8,
        repMax: 12,
        rest: 90,
        startWeight: sets[0]?.weight || 0,
      },
    ],
    ...overrides,
  }) as TrainingSession;

const ids = (items: ReturnType<typeof detectSetAnomalies>) => items.map((item) => item.id);

describe('first-time exercise set anomaly regression', () => {
  it('does not report same-exercise weight jump when the exercise has no reliable history', () => {
    const anomalies = detectSetAnomalies({
      currentDraft: {
        exerciseId: 'lat-pulldown',
        stepId: 'main:lat-pulldown:working:0',
        stepType: 'working',
        setIndex: 0,
        actualWeightKg: 55,
        displayWeight: 55,
        displayUnit: 'kg',
        actualReps: 10,
        source: 'prescription',
      },
      exerciseId: 'lat-pulldown',
      previousSets: [],
      recentHistory: [session('seated-row', [workingSet('seated-row', 25)])],
      unitSettings,
      plannedPrescription: { plannedWeightKg: 55, plannedReps: 10, repMax: 12, stepType: 'working' },
    });

    expect(ids(anomalies)).not.toContain('weight-jump-over-50-percent');
    expect(anomalies.some((item) => item.severity === 'critical')).toBe(false);
  });

  it('uses only reliable same-exercise working sets as previous history', () => {
    const reliable = getReliablePreviousWorkingSetsForExercise({
      exerciseId: 'lat-pulldown',
      history: [
        session('seated-row', [workingSet('seated-row', 20)]),
        session('lat-pulldown', [{ ...workingSet('lat-pulldown', 20), type: 'warmup' }]),
        session('lat-pulldown', [workingSet('lat-pulldown', 25)], { dataFlag: 'excluded' }),
        session('lat-pulldown', [workingSet('lat-pulldown', 30)]),
      ],
    });

    expect(reliable).toHaveLength(1);
    expect(reliable[0].actualWeightKg).toBe(30);
  });

  it('does not use unfinished planned sets in the current session as history', () => {
    const anomalies = detectSetAnomalies({
      currentDraft: {
        exerciseId: 'lat-pulldown',
        stepId: 'main:lat-pulldown:working:0',
        stepType: 'working',
        setIndex: 0,
        actualWeightKg: 60,
        displayWeight: 60,
        displayUnit: 'kg',
        actualReps: 10,
        source: 'manual',
      },
      exerciseId: 'lat-pulldown',
      previousSets: [{ ...workingSet('lat-pulldown', 30), done: undefined }],
      recentHistory: [],
      unitSettings,
      plannedPrescription: { plannedWeightKg: 60, plannedReps: 10, repMax: 12, stepType: 'working' },
    });

    expect(ids(anomalies)).not.toContain('weight-jump-over-50-percent');
  });

  it('still reports a jump when real same-exercise history exists and the user enters an extreme weight', () => {
    const anomalies = detectSetAnomalies({
      currentDraft: {
        exerciseId: 'lat-pulldown',
        stepId: 'main:lat-pulldown:working:0',
        stepType: 'working',
        setIndex: 0,
        actualWeightKg: 80,
        displayWeight: 80,
        displayUnit: 'kg',
        actualReps: 10,
        source: 'manual',
      },
      exerciseId: 'lat-pulldown',
      previousSets: [],
      recentHistory: [session('lat-pulldown', [workingSet('lat-pulldown', 40)])],
      unitSettings,
      plannedPrescription: { plannedWeightKg: 45, plannedReps: 10, repMax: 12, stepType: 'working' },
    });

    expect(ids(anomalies)).toContain('weight-jump-over-50-percent');
  });

  it('still asks for confirmation when the user manually changes far above the suggested weight', () => {
    const anomalies = detectSetAnomalies({
      currentDraft: {
        exerciseId: 'lat-pulldown',
        stepId: 'main:lat-pulldown:working:0',
        stepType: 'working',
        setIndex: 0,
        actualWeightKg: 113.4,
        displayWeight: 250,
        displayUnit: 'lb',
        actualReps: 10,
        source: 'manual',
      },
      exerciseId: 'lat-pulldown',
      previousSets: [],
      recentHistory: [],
      unitSettings: lbUnitSettings,
      plannedPrescription: { plannedWeightKg: 52.6, plannedReps: 10, repMax: 12, stepType: 'working' },
    });

    const plannedDiff = anomalies.find((item) => item.id === 'planned-weight-large-diff');
    expect(plannedDiff?.requiresConfirmation).toBe(true);
  });

  it('does not treat a copied previous set as a plan-difference error unless it is extreme', () => {
    const anomalies = detectSetAnomalies({
      currentDraft: {
        exerciseId: 'lat-pulldown',
        stepId: 'main:lat-pulldown:working:1',
        stepType: 'working',
        setIndex: 1,
        actualWeightKg: 70,
        displayWeight: 70,
        displayUnit: 'kg',
        actualReps: 10,
        source: 'copy_previous',
      },
      exerciseId: 'lat-pulldown',
      previousSets: [{ ...workingSet('lat-pulldown', 70), done: true }],
      recentHistory: [],
      unitSettings,
      plannedPrescription: { plannedWeightKg: 40, plannedReps: 10, repMax: 12, stepType: 'working' },
    });

    expect(ids(anomalies)).not.toContain('planned-weight-large-diff');
  });
});
