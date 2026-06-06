// RGR-1 + RGR-2 + AR-2 + AR-3 + AR-4: reentry productive dose + no double penalty.
// See docs/IRONPATH_iOS_SYSTEM_LOGIC.md.

import { describe, expect, it } from 'vitest';
import { buildTrainingDecision } from '../src/engines/trainingDecisionEngine';
import { getTemplate, makeSession, makeStatus } from './fixtures';
import type { CyclePhase, MesocyclePlan } from '../src/models/training-model';

const REFERENCE_DATE = '2026-05-27';
const dateDaysBefore = (n: number) => {
  const d = new Date(`${REFERENCE_DATE}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() - n);
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
const seed = (n: number) =>
  makeSession({
    id: `s-${n}`,
    date: dateDaysBefore(n),
    templateId: 'push-a',
    exerciseId: 'bench-press',
    setSpecs: [
      { weight: 60, reps: 8, rir: 2 },
      { weight: 60, reps: 8, rir: 2 },
    ],
  });

describe('trainingDecisionHardRewriteReentryProductiveDose', () => {
  it('14-day gap + previous deload → reentry-productive, compounds ≥ 2 sets, no double penalty', () => {
    const decision = buildTrainingDecision({
      template: getTemplate('push-a'),
      todayStatus: makeStatus({ time: '60' }),
      mesocyclePlan: planEndingOnPhase('deload'),
      history: [seed(14), seed(15), seed(16), seed(17)],
      trainingMode: 'hybrid',
      nowIso: `${REFERENCE_DATE}T12:00:00.000Z`,
    });

    expect(decision.activePhase).toBe('reentry');
    expect(decision.sessionIntent).toBe('reentry-productive');
    expect(decision.volumeMode).toBe('reentry-floor');

    // Compounds must have ≥ 2 sets
    const compounds = decision.exercisePrescriptions.filter((ex) => ex.kind === 'compound');
    expect(compounds.length).toBeGreaterThan(0);
    for (const ex of compounds) {
      const sets = typeof ex.sets === 'number' ? ex.sets : (ex.sets || []).length;
      expect(sets).toBeGreaterThanOrEqual(2);
    }

    // Whole-session must NOT be all 1-set
    const counts = decision.exercisePrescriptions.map((ex) =>
      typeof ex.sets === 'number' ? ex.sets : (ex.sets || []).length,
    );
    expect(counts.every((s) => s <= 1)).toBe(false);

    // AR-2: finalVolumeMultiplier ≥ reentry floor (no 0.65 × 0.6 = 0.39 stacking)
    expect(decision.hiddenDebugSignals.finalVolumeMultiplier).toBeGreaterThanOrEqual(0.65);

    // AR-4: weekly direction cannot further reduce; blockedBy reentry-floor
    expect(decision.weeklyAdjustment.direction).not.toBe('decrease');
    expect(decision.weeklyAdjustment.blockedBy).toBe('reentry-floor');

    // Arbitration trace contains AR-2 + AR-3 + AR-4
    const trace = decision.hiddenDebugSignals.arbitrationTrace.join(',');
    expect(trace).toMatch(/AR-2/);
    expect(trace).toMatch(/AR-3/);
    expect(trace).toMatch(/AR-4/);
  });

  it('AR-1 severe override (acute pain) bypasses reentry path', () => {
    const decision = buildTrainingDecision({
      template: getTemplate('push-a'),
      todayStatus: makeStatus({ time: '60' }),
      mesocyclePlan: planEndingOnPhase('build'),
      history: [seed(2)],
      trainingMode: 'hybrid',
      nowIso: `${REFERENCE_DATE}T12:00:00.000Z`,
      acutePainReported: true,
    });
    expect(decision.sessionIntent).toBe('severe-rest');
    expect(decision.riskLevel).toBe('severe');
    expect(decision.hiddenDebugSignals.arbitrationTrace).toContain('AR-1-severe-override');
  });

  it('short gap (≤ 3 days) preserves persisted phase', () => {
    const decision = buildTrainingDecision({
      template: getTemplate('push-a'),
      todayStatus: makeStatus({ time: '60' }),
      mesocyclePlan: planEndingOnPhase('build'),
      history: [seed(2)],
      trainingMode: 'hybrid',
      nowIso: `${REFERENCE_DATE}T12:00:00.000Z`,
    });
    expect(decision.activePhase).toBe('build');
    expect(decision.sessionIntent).not.toBe('reentry-productive');
  });

  it('no history + no mesocyclePlan → safe defaults', () => {
    const decision = buildTrainingDecision({
      template: getTemplate('push-a'),
      todayStatus: makeStatus({ time: '60' }),
      mesocyclePlan: null,
      history: [],
      trainingMode: 'hybrid',
      nowIso: `${REFERENCE_DATE}T12:00:00.000Z`,
    });
    expect(decision.sessionIntent).toBe('normal-session');
    expect(decision.userFacing.today?.headline || '').not.toMatch(/保守|控制风险/);
  });
});
