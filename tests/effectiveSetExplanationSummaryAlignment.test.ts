import { describe, expect, it } from 'vitest';
import { buildEffectiveSetExplanation } from '../src/engines/effectiveSetExplanationEngine';
import { buildSessionDetailSummary } from '../src/engines/sessionDetailSummaryEngine';
import type { TrainingSession, TrainingSetLog } from '../src/models/training-model';
import { makeSession } from './fixtures';

const setLog = (id: string, overrides: Partial<TrainingSetLog> = {}): TrainingSetLog => ({
  id,
  type: 'straight',
  weight: 80,
  actualWeightKg: 80,
  reps: 8,
  rir: 2,
  done: true,
  techniqueQuality: 'good',
  ...overrides,
});

const sessionWithMixedEffectiveSets = (overrides: Partial<TrainingSession> = {}): TrainingSession => {
  const session = makeSession({
    id: 'effective-summary-alignment',
    date: '2026-05-04',
    templateId: 'push-a',
    exerciseId: 'bench-press',
    setSpecs: [{ weight: 80, reps: 8, rir: 2, techniqueQuality: 'good' }],
  });
  session.exercises[0].sets = [
    setLog('effective'),
    setLog('too-easy', { rir: 6 }),
    setLog('draft', { done: false, weight: 100, actualWeightKg: 100, reps: 10 }),
  ];
  session.focusWarmupSetLogs = [
    { id: 'main:bench-press:warmup:0', exerciseId: 'bench-press', type: 'warmup', weight: 40, actualWeightKg: 40, reps: 8, rir: '', done: true },
  ];
  return { ...session, ...overrides };
};

describe('effective set explanation summary alignment', () => {
  it('matches Session Detail Summary completed and effective counts', () => {
    const session = sessionWithMixedEffectiveSets();
    const explanation = buildEffectiveSetExplanation(session);
    const summary = buildSessionDetailSummary(session);

    expect(explanation.completedWorkingSets).toBe(summary.completedWorkingSets);
    expect(explanation.totalCompletedWorkingSets).toBe(summary.completedWorkingSets);
    expect(explanation.countedEffectiveSets).toBe(summary.effectiveSets);
    expect(explanation.excludedSetCount).toBe(explanation.excludedSets.length);
    expect(explanation.excludedSets.map((item) => item.reasonCode)).toEqual(['not_enough_effort', 'incomplete', 'warmup']);
    expect(summary.effectiveSetExplanation).toMatchObject({
      completedWorkingSets: explanation.completedWorkingSets,
      countedEffectiveSets: explanation.countedEffectiveSets,
      excludedSetCount: explanation.excludedSetCount,
    });
  });

  it('aligns test and excluded sessions with excludedFromStats', () => {
    const session = sessionWithMixedEffectiveSets({ dataFlag: 'excluded' });
    const explanation = buildEffectiveSetExplanation(session);
    const summary = buildSessionDetailSummary(session);

    expect(summary.excludedFromStats).toBe(true);
    expect(explanation.completedWorkingSets).toBe(summary.completedWorkingSets);
    expect(explanation.countedEffectiveSets).toBe(0);
    expect(summary.effectiveSets).toBe(0);
    expect(explanation.excludedSets.map((item) => item.reasonCode)).toContain('test_or_excluded');
  });

  it('aligns identity issues with Session Detail Summary identity issue count', () => {
    const session = sessionWithMixedEffectiveSets();
    session.exercises[0] = {
      ...session.exercises[0],
      identityInvalid: true,
      legacyActualExerciseId: '__auto_alt_legacy',
      actualExerciseId: undefined,
    };

    const explanation = buildEffectiveSetExplanation(session);
    const summary = buildSessionDetailSummary(session);

    expect(summary.identityIssueCount).toBeGreaterThan(0);
    expect(explanation.countedEffectiveSets).toBe(0);
    expect(summary.effectiveSets).toBe(0);
    expect(explanation.excludedSets.map((item) => item.reasonCode)).toContain('identity_invalid');
  });
});
