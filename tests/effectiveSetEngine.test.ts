import { describe, expect, it } from 'vitest';
import { buildEffectiveVolumeSummary, countEffectiveSets, evaluateEffectiveSet } from '../src/engines/effectiveSetEngine';
import type { TrainingSetLog } from '../src/models/training-model';
import { makeSession } from './fixtures';

const makeSet = (overrides: Partial<TrainingSetLog> = {}): TrainingSetLog => ({
  id: 'set-1',
  type: 'straight',
  weight: 60,
  reps: 10,
  rir: 2,
  done: true,
  techniqueQuality: 'acceptable',
  ...overrides,
});

describe('effectiveSetEngine', () => {
  it('does not count warmup sets as effective hypertrophy sets', () => {
    const result = evaluateEffectiveSet(makeSet({ type: 'warmup' }));
    expect(result.isEffective).toBe(false);
    expect(result.flags).toContain('warmup');
  });

  it('reduces effectiveness for poor technique and pain', () => {
    expect(evaluateEffectiveSet(makeSet({ techniqueQuality: 'poor' })).isEffective).toBe(false);
    expect(evaluateEffectiveSet(makeSet({ painFlag: true })).isEffective).toBe(false);
  });

  it('counts RIR 1-3 with acceptable or good technique as effective', () => {
    const result = evaluateEffectiveSet(makeSet({ rir: 2, techniqueQuality: 'good' }));
    expect(result.isEffective).toBe(true);
    expect(result.confidence).toBe('high');
    expect(result.flags).toContain('valid_effort');
  });

  it('uses medium confidence when RIR is missing but the set is otherwise valid', () => {
    const result = evaluateEffectiveSet(makeSet({ rir: undefined, techniqueQuality: 'acceptable' }));
    expect(result.isEffective).toBe(true);
    expect(result.confidence).toBe('medium');
  });

  it('does not assign high confidence to pain-flagged sets', () => {
    const result = evaluateEffectiveSet(makeSet({ painFlag: true, techniqueQuality: 'good' }));
    expect(result.confidence).toBe('low');
  });

  it('builds effective volume from session history', () => {
    const session = makeSession({
      id: 's1',
      date: '2026-04-24',
      templateId: 'push-a',
      exerciseId: 'bench-press',
      setSpecs: [
        { weight: 60, reps: 8, rir: 2, techniqueQuality: 'good' },
        { weight: 60, reps: 8, rir: 6, techniqueQuality: 'good' },
      ],
    });
    const summary = buildEffectiveVolumeSummary([session]);
    expect(countEffectiveSets(session)).toBe(1);
    expect(summary.completedSets).toBe(2);
    expect(summary.effectiveSets).toBe(1);
    expect(summary.highConfidenceEffectiveSets).toBe(1);
  });

  it('uses muscle contribution weights for effective volume', () => {
    const session = makeSession({
      id: 'weighted',
      date: '2026-04-24',
      templateId: 'push-a',
      exerciseId: 'bench-press',
      setSpecs: [{ weight: 60, reps: 8, rir: 2, techniqueQuality: 'good' }],
    });
    session.exercises[0].muscleContribution = { chest: 1, triceps: 0.5, front_delts: 0.4 };

    const summary = buildEffectiveVolumeSummary([session]);
    expect(summary.byMuscle.chest.weightedEffectiveSets).toBe(1);
    expect(summary.byMuscle.triceps.weightedEffectiveSets).toBe(0.5);
    expect(summary.byMuscle.front_delts.weightedEffectiveSets).toBe(0.4);
  });

  it('falls back to primary and secondary muscle weights when contribution is missing', () => {
    const session = makeSession({
      id: 'fallback',
      date: '2026-04-24',
      templateId: 'push-a',
      exerciseId: 'bench-press',
      setSpecs: [{ weight: 60, reps: 8, rir: 2, techniqueQuality: 'good' }],
    });
    session.exercises[0].primaryMuscles = ['chest'];
    session.exercises[0].secondaryMuscles = ['triceps'];
    session.exercises[0].muscleContribution = undefined;

    const summary = buildEffectiveVolumeSummary([session]);
    expect(summary.byMuscle.chest.weightedEffectiveSets).toBe(1);
    expect(summary.byMuscle.triceps.weightedEffectiveSets).toBe(0.5);
  });

  it('poor technique does not contribute high-confidence effective volume', () => {
    const session = makeSession({
      id: 'poor',
      date: '2026-04-24',
      templateId: 'push-a',
      exerciseId: 'bench-press',
      setSpecs: [{ weight: 60, reps: 8, rir: 2, techniqueQuality: 'poor' }],
    });
    session.exercises[0].muscleContribution = { chest: 1 };

    const summary = buildEffectiveVolumeSummary([session]);
    expect(summary.highConfidenceEffectiveSets).toBe(0);
    expect(summary.byMuscle.chest?.highConfidenceWeightedSets || 0).toBe(0);
  });
});
