import { describe, expect, it } from 'vitest';
import { detectSetAnomalies } from '../src/engines/setAnomalyEngine';
import type { ActualSetDraft, TrainingSetLog, UnitSettings } from '../src/models/training-model';

const kgSettings: UnitSettings = {
  weightUnit: 'kg',
  defaultIncrementKg: 2.5,
  defaultIncrementLb: 5,
  customIncrementsKg: [],
  customIncrementsLb: [],
};

const lbSettings: UnitSettings = {
  ...kgSettings,
  weightUnit: 'lb',
};

const previousSet = (weight: number, reps = 8): TrainingSetLog => ({
  id: `previous-${weight}`,
  type: 'working',
  weight,
  actualWeightKg: weight,
  reps,
  rir: 2,
  done: true,
});

const draft = (overrides: Partial<ActualSetDraft> = {}): ActualSetDraft => ({
  exerciseId: 'bench-press',
  stepId: 'main:bench-press:working:0',
  stepType: 'working',
  setIndex: 0,
  actualWeightKg: 70,
  displayWeight: 70,
  displayUnit: 'kg',
  actualReps: 8,
  actualRir: 2,
  ...overrides,
});

const issueIds = (result: ReturnType<typeof detectSetAnomalies>) => result.map((item) => item.id);

describe('setAnomalyEngine', () => {
  it('detects 155lb saved as 155kg in lb mode', () => {
    const anomalies = detectSetAnomalies({
      currentDraft: draft({
        actualWeightKg: 155,
        displayWeight: 155,
        displayUnit: 'lb',
      }),
      exerciseId: 'bench-press',
      previousSets: [previousSet(70)],
      unitSettings: lbSettings,
      plannedPrescription: { plannedWeightKg: 70, repMax: 10, stepType: 'working' },
    });

    expect(issueIds(anomalies)).toContain('unit-lb-saved-as-kg');
    expect(anomalies.find((item) => item.id === 'unit-lb-saved-as-kg')?.severity).toBe('critical');
    expect(anomalies.find((item) => item.id === 'unit-lb-saved-as-kg')?.requiresConfirmation).toBe(true);
  });

  it('detects kg input that looks like a lb number', () => {
    const anomalies = detectSetAnomalies({
      currentDraft: draft({ actualWeightKg: 155, displayWeight: 155, displayUnit: 'kg' }),
      exerciseId: 'bench-press',
      previousSets: [previousSet(70)],
      unitSettings: kgSettings,
      plannedPrescription: { plannedWeightKg: 70, repMax: 10, stepType: 'working' },
    });

    expect(issueIds(anomalies)).toContain('unit-kg-looks-like-lb');
  });

  it('detects reps 80 as an abnormal entry', () => {
    const anomalies = detectSetAnomalies({
      currentDraft: draft({ actualReps: 80 }),
      exerciseId: 'bench-press',
      previousSets: [previousSet(70)],
      unitSettings: kgSettings,
      plannedPrescription: { plannedWeightKg: 70, repMax: 10, stepType: 'working' },
    });

    const issue = anomalies.find((item) => item.id === 'reps-over-50');
    expect(issue?.severity).toBe('critical');
    expect(issue?.message).toContain('多输入');
  });

  it('detects RIR 12 as out of range', () => {
    const anomalies = detectSetAnomalies({
      currentDraft: draft({ actualRir: 12 }),
      exerciseId: 'bench-press',
      previousSets: [previousSet(70)],
      unitSettings: kgSettings,
      plannedPrescription: { plannedWeightKg: 70, repMax: 10, stepType: 'working' },
    });

    expect(issueIds(anomalies)).toContain('rir-out-of-range');
    expect(anomalies.find((item) => item.id === 'rir-out-of-range')?.requiresConfirmation).toBe(true);
  });

  it('detects sudden weight jumps above 50 percent', () => {
    const anomalies = detectSetAnomalies({
      currentDraft: draft({ actualWeightKg: 110, displayWeight: 110 }),
      exerciseId: 'bench-press',
      previousSets: [previousSet(70)],
      unitSettings: kgSettings,
      plannedPrescription: { plannedWeightKg: 70, repMax: 10, stepType: 'working' },
    });

    expect(issueIds(anomalies)).toContain('weight-jump-over-50-percent');
    expect(anomalies.find((item) => item.id === 'weight-jump-over-50-percent')?.message).toContain('超过 50%');
  });

  it('detects warmup sets that are heavier than formal working references', () => {
    const anomalies = detectSetAnomalies({
      currentDraft: draft({
        stepType: 'warmup',
        actualWeightKg: 90,
        displayWeight: 90,
        actualReps: 3,
      }),
      exerciseId: 'bench-press',
      previousSets: [previousSet(70)],
      unitSettings: kgSettings,
      plannedPrescription: { plannedWeightKg: 70, repMax: 10, stepType: 'warmup', isWarmup: true },
    });

    expect(issueIds(anomalies)).toContain('warmup-heavier-than-working');
  });

  it('detects working sets with zero weight but positive reps', () => {
    const anomalies = detectSetAnomalies({
      currentDraft: draft({ actualWeightKg: 0, displayWeight: 0, actualReps: 8 }),
      exerciseId: 'bench-press',
      previousSets: [previousSet(70)],
      unitSettings: kgSettings,
      plannedPrescription: { plannedWeightKg: 70, repMax: 10, stepType: 'working' },
    });

    expect(issueIds(anomalies)).toContain('working-weight-zero-with-reps');
  });

  it('detects empty weight and reps when completing a set', () => {
    const anomalies = detectSetAnomalies({
      currentDraft: {
        exerciseId: 'bench-press',
        stepId: 'main:bench-press:working:0',
        stepType: 'working',
        setIndex: 0,
      },
      exerciseId: 'bench-press',
      previousSets: [previousSet(70)],
      unitSettings: kgSettings,
      plannedPrescription: { plannedWeightKg: 70, repMax: 10, stepType: 'working' },
    });

    expect(issueIds(anomalies)).toContain('empty-set-complete');
    expect(anomalies.find((item) => item.id === 'empty-set-complete')?.requiresConfirmation).toBe(true);
  });

  it('returns no anomalies for a normal set', () => {
    const anomalies = detectSetAnomalies({
      currentDraft: draft(),
      exerciseId: 'bench-press',
      previousSets: [previousSet(67.5)],
      unitSettings: kgSettings,
      plannedPrescription: { plannedWeightKg: 70, repMax: 10, stepType: 'working' },
    });

    expect(anomalies).toEqual([]);
  });

  it('marks every critical anomaly as requiring confirmation and keeps text user-facing', () => {
    const anomalies = detectSetAnomalies({
      currentDraft: draft({ actualReps: 80, actualRir: -1 }),
      exerciseId: 'bench-press',
      previousSets: [previousSet(70)],
      unitSettings: kgSettings,
      plannedPrescription: { plannedWeightKg: 70, repMax: 10, stepType: 'working' },
    });
    const visibleText = anomalies.map((item) => `${item.title}\n${item.message}\n${item.suggestedAction || ''}`).join('\n');

    expect(anomalies.filter((item) => item.severity === 'critical').every((item) => item.requiresConfirmation)).toBe(true);
    expect(visibleText).not.toMatch(/\b(undefined|null|warning|critical|working|warmup)\b/);
    expect(visibleText).toMatch(/[重量次数确认]/);
  });
});
