// RGR-1 + RGR-2: 14-day gap + previous deload must produce a productive reentry session,
// not a 1-set whole-session, and weekly suggestion must not double-penalize.
// See docs/TRAINING_RECOMMENDATION_SOURCE_OF_TRUTH_REWRITE_PLAN_V1.md §9 AR-2/AR-3/AR-4.

import { describe, expect, it } from 'vitest';
import { buildTrainingDecision } from '../src/engines/trainingDecisionEngine';
import { getTemplate, makeSession, makeStatus } from './fixtures';
import type { CyclePhase, MesocyclePlan } from '../src/models/training-model';

const REFERENCE_DATE = '2026-05-27';

const dateDaysBefore = (days: number) => {
  const d = new Date(`${REFERENCE_DATE}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
};

const planEndingOnPhase = (phase: CyclePhase): MesocyclePlan => {
  const idx: Record<CyclePhase, number> = { base: 0, build: 1, overload: 2, deload: 3 };
  const weekIndex = idx[phase];
  return {
    id: `meso-test-${phase}`,
    startDate: dateDaysBefore(weekIndex * 7 + 1),
    lengthWeeks: 4,
    currentWeekIndex: weekIndex,
    primaryGoal: 'hypertrophy',
    weeks: [
      { weekIndex: 0, phase: 'base', volumeMultiplier: 0.9, intensityBias: 'normal' },
      { weekIndex: 1, phase: 'build', volumeMultiplier: 1, intensityBias: 'normal' },
      { weekIndex: 2, phase: 'overload', volumeMultiplier: 1.1, intensityBias: 'aggressive' },
      { weekIndex: 3, phase: 'deload', volumeMultiplier: 0.6, intensityBias: 'conservative' },
    ],
  };
};

const seedSession = (daysAgo: number, weight = 60) =>
  makeSession({
    id: `session-${daysAgo}`,
    date: dateDaysBefore(daysAgo),
    templateId: 'push-a',
    exerciseId: 'bench-press',
    setSpecs: [
      { weight, reps: 8, rir: 2 },
      { weight, reps: 8, rir: 2 },
    ],
  });

describe('trainingDecisionSourceOfTruthReentryProductiveDose', () => {
  it('14-day gap + previous deload → activePhase reentry, sessionIntent reentry-productive', () => {
    const decision = buildTrainingDecision({
      template: getTemplate('push-a'),
      todayStatus: makeStatus({ time: '60' }),
      mesocyclePlan: planEndingOnPhase('deload'),
      history: [seedSession(14), seedSession(15), seedSession(16), seedSession(17)],
      trainingMode: 'hybrid',
      nowIso: `${REFERENCE_DATE}T12:00:00.000Z`,
    });

    expect(decision.activePhase).toBe('reentry');
    expect(decision.sessionIntent).toBe('reentry-productive');
    expect(decision.volumeMode).toBe('reentry-floor');
  });

  it('14-day gap + previous deload → all compound exercises have ≥ 2 working sets (no all-1-set session)', () => {
    const decision = buildTrainingDecision({
      template: getTemplate('push-a'),
      todayStatus: makeStatus({ time: '60' }),
      mesocyclePlan: planEndingOnPhase('deload'),
      history: [seedSession(14), seedSession(15), seedSession(16), seedSession(17)],
      trainingMode: 'hybrid',
      nowIso: `${REFERENCE_DATE}T12:00:00.000Z`,
    });

    const compoundExercises = decision.exercisePrescriptions.filter((ex) => ex.kind === 'compound');
    expect(compoundExercises.length).toBeGreaterThan(0);
    for (const ex of compoundExercises) {
      const sets = typeof ex.sets === 'number' ? ex.sets : (ex.sets || []).length;
      expect(sets).toBeGreaterThanOrEqual(2);
    }

    // No "all-1-set whole-session" by default: at least one exercise must have ≥ 2 sets
    const exerciseSetCounts = decision.exercisePrescriptions.map((ex) =>
      typeof ex.sets === 'number' ? ex.sets : (ex.sets || []).length,
    );
    const allOneSet = exerciseSetCounts.length > 0 && exerciseSetCounts.every((s) => s <= 1);
    expect(allOneSet).toBe(false);
  });

  it('14-day gap + previous deload → finalVolumeMultiplier respects reentry floor (no double penalty)', () => {
    const decision = buildTrainingDecision({
      template: getTemplate('push-a'),
      todayStatus: makeStatus({ time: '60' }),
      mesocyclePlan: planEndingOnPhase('deload'),
      history: [seedSession(14), seedSession(15), seedSession(16), seedSession(17)],
      trainingMode: 'hybrid',
      nowIso: `${REFERENCE_DATE}T12:00:00.000Z`,
    });

    expect(decision.hiddenDebugSignals.finalVolumeMultiplier).toBeGreaterThanOrEqual(0.65);
    // Trace must mention reentry-aware arbitration (AR-2 or AR-3 fired)
    const trace = decision.hiddenDebugSignals.arbitrationTrace.join(',');
    expect(trace).toMatch(/AR-2|AR-3/);
  });

  it('14-day gap + previous deload → weeklyAdjustment direction is hold (AR-4), not decrease', () => {
    const decision = buildTrainingDecision({
      template: getTemplate('push-a'),
      todayStatus: makeStatus({ time: '60' }),
      mesocyclePlan: planEndingOnPhase('deload'),
      history: [seedSession(14), seedSession(15), seedSession(16), seedSession(17)],
      trainingMode: 'hybrid',
      nowIso: `${REFERENCE_DATE}T12:00:00.000Z`,
    });

    // AR-4: cannot decrease weekly volume on top of reentry unless a severe flag fires
    expect(decision.weeklyAdjustment.direction).not.toBe('decrease');
    expect(decision.weeklyAdjustment.blockedBy).toBe('reentry-floor');
  });

  it('short gap (≤ 3 days) preserves persisted phase (no AR-2 fire)', () => {
    const decision = buildTrainingDecision({
      template: getTemplate('push-a'),
      todayStatus: makeStatus({ time: '60' }),
      mesocyclePlan: planEndingOnPhase('build'),
      history: [seedSession(2)],
      trainingMode: 'hybrid',
      nowIso: `${REFERENCE_DATE}T12:00:00.000Z`,
    });

    expect(decision.activePhase).toBe('build');
    expect(decision.sessionIntent).not.toBe('reentry-productive');
    expect(
      decision.hiddenDebugSignals.arbitrationTrace.some((entry) => entry.startsWith('AR-2-reentry')),
    ).toBe(false);
  });

  it('severe flag (acute pain) overrides everything (AR-1)', () => {
    const decision = buildTrainingDecision({
      template: getTemplate('push-a'),
      todayStatus: makeStatus({ time: '60' }),
      mesocyclePlan: planEndingOnPhase('build'),
      history: [seedSession(2)],
      trainingMode: 'hybrid',
      nowIso: `${REFERENCE_DATE}T12:00:00.000Z`,
      acutePainReported: true,
    });

    expect(decision.sessionIntent).toBe('severe-rest');
    expect(decision.riskLevel).toBe('severe');
    expect(decision.weeklyAdjustment.direction).toBe('decrease');
    expect(decision.hiddenDebugSignals.arbitrationTrace).toContain('AR-1-severe-override');
  });

  it('no history + no mesocyclePlan → safe defaults, no crash, no 保守 in headline', () => {
    const decision = buildTrainingDecision({
      template: getTemplate('push-a'),
      todayStatus: makeStatus({ time: '60' }),
      mesocyclePlan: null,
      history: [],
      trainingMode: 'hybrid',
      nowIso: `${REFERENCE_DATE}T12:00:00.000Z`,
    });

    expect(decision.sessionIntent).toBe('normal-session');
    expect(decision.riskLevel === 'none' || decision.riskLevel === 'low').toBe(true);
    expect(decision.userFacing.today?.headline || '').not.toMatch(/保守|风险|控制/);
  });
});
