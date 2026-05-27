import { describe, expect, it } from 'vitest';
import {
  getDaysSinceLastTraining,
  getEffectiveTrainingPhase,
} from '../src/engines/effectiveTrainingPhaseEngine';
import type { CyclePhase, MesocyclePlan, TrainingSession } from '../src/models/training-model';
import { makeAppData, makeSession } from './fixtures';

// 训练周期 Gap 自动重入状态机 V1 — 派生逻辑单元测试 (automation-first)

const REFERENCE_DATE = '2026-05-27';

const dateDaysBefore = (days: number, from = REFERENCE_DATE) => {
  const d = new Date(`${from}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
};

// 构造一个 4 周 mesocyclePlan，使 referenceDate 落在指定 phase 上。
const planEndingOnPhase = (phase: CyclePhase): MesocyclePlan => {
  const phaseToWeekIndex: Record<CyclePhase, number> = {
    base: 0,
    build: 1,
    overload: 2,
    deload: 3,
  };
  const weekIndex = phaseToWeekIndex[phase];
  // startDate 距 reference 至少 weekIndex*7 天，最多 weekIndex*7+6 天
  const startDate = dateDaysBefore(weekIndex * 7 + 1);
  return {
    id: `meso-test-${phase}`,
    startDate,
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

const sessionOnDate = (date: string): TrainingSession =>
  makeSession({
    id: `session-${date}`,
    date,
    templateId: 'push-a',
    exerciseId: 'bench-press',
    setSpecs: [
      { weight: 60, reps: 8, rir: 2 },
      { weight: 60, reps: 8, rir: 2 },
    ],
  });

describe('getDaysSinceLastTraining', () => {
  it('returns null when there is no analytics history', () => {
    expect(getDaysSinceLastTraining([], REFERENCE_DATE)).toBeNull();
  });

  it('counts whole days since the latest completed session', () => {
    const history = [sessionOnDate(dateDaysBefore(5)), sessionOnDate(dateDaysBefore(12))];
    expect(getDaysSinceLastTraining(history, REFERENCE_DATE)?.days).toBe(5);
  });

  it('ignores sessions marked as test data', () => {
    const stale = sessionOnDate(dateDaysBefore(20));
    const tagged = { ...sessionOnDate(dateDaysBefore(2)), dataFlag: 'test' as const };
    expect(getDaysSinceLastTraining([stale, tagged], REFERENCE_DATE)?.days).toBe(20);
  });
});

describe('getEffectiveTrainingPhase — active phase derivation (automation-first)', () => {
  it('trainingPhaseEffectiveMappingShortGapPreservesDeload: short gap (0-3d) keeps persisted deload', () => {
    const mesocyclePlan = planEndingOnPhase('deload');
    const history = [sessionOnDate(dateDaysBefore(2))];
    const effective = getEffectiveTrainingPhase({ mesocyclePlan, history, referenceDate: REFERENCE_DATE });
    expect(effective.persistedPhase).toBe('deload');
    expect(effective.activePhase).toBe('deload');
    expect(effective.effectivePhase).toBe('deload');
    expect(effective.overridden).toBe(false);
    expect(effective.compactLabel).toBe('减量周');
    expect(effective.gapDays).toBe(2);
    expect(effective.mode).toBe('continue');
    expect(effective.severity).toBe('none');
  });

  it('trainingPhaseEffectiveMappingMidGapMildCaution: 4-7d gap keeps phase but flags mild severity', () => {
    const mesocyclePlan = planEndingOnPhase('build');
    const history = [sessionOnDate(dateDaysBefore(6))];
    const effective = getEffectiveTrainingPhase({ mesocyclePlan, history, referenceDate: REFERENCE_DATE });
    expect(effective.persistedPhase).toBe('build');
    expect(effective.activePhase).toBe('build');
    expect(effective.overridden).toBe(false);
    expect(effective.severity).toBe('mild');
  });

  it('trainingPhaseEffectiveMappingLongGapOverloadBecomesReentry: 8-13d gap with overload becomes reentry', () => {
    const mesocyclePlan = planEndingOnPhase('overload');
    const history = [sessionOnDate(dateDaysBefore(10))];
    const effective = getEffectiveTrainingPhase({ mesocyclePlan, history, referenceDate: REFERENCE_DATE });
    expect(effective.persistedPhase).toBe('overload');
    expect(effective.activePhase).toBe('reentry');
    expect(effective.overridden).toBe(true);
    expect(effective.compactLabel).toBe('回归周');
    expect(effective.effectiveWeek.phase).toBe('base');
    expect(effective.phaseForCompatibility).toBe('base');
    expect(effective.effectiveWeek.volumeMultiplier).toBeLessThan(1);
    expect(effective.effectiveWeek.intensityBias).toBe('conservative');
    expect(effective.mode).toBe('reentry');
  });

  it('trainingPhaseEffectiveMappingLongGapBaseKeepsBase: 8-13d gap with base only flags reentry severity', () => {
    const mesocyclePlan = planEndingOnPhase('base');
    const history = [sessionOnDate(dateDaysBefore(10))];
    const effective = getEffectiveTrainingPhase({ mesocyclePlan, history, referenceDate: REFERENCE_DATE });
    expect(effective.persistedPhase).toBe('base');
    expect(effective.activePhase).toBe('base');
    expect(effective.overridden).toBe(false);
    expect(effective.severity).toBe('reentry');
  });

  it('trainingPhaseEffectiveMappingFourteenDayGapForcesReentry: 14d gap forces reentry away from deload', () => {
    const mesocyclePlan = planEndingOnPhase('deload');
    const history = [sessionOnDate(dateDaysBefore(14))];
    const effective = getEffectiveTrainingPhase({ mesocyclePlan, history, referenceDate: REFERENCE_DATE });
    expect(effective.persistedPhase).toBe('deload');
    expect(effective.activePhase).toBe('reentry');
    expect(effective.overridden).toBe(true);
    expect(effective.compactLabel).toBe('回归周');
    expect(effective.effectiveWeek.phase).toBe('base');
    expect(effective.effectiveWeek.volumeMultiplier).toBeLessThanOrEqual(0.7);
  });

  it('trainingPhaseEffectiveMappingTwentyDayGapStillReentry: 20d gap (within 14-27) stays in reentry', () => {
    const mesocyclePlan = planEndingOnPhase('build');
    const history = [sessionOnDate(dateDaysBefore(20))];
    const effective = getEffectiveTrainingPhase({ mesocyclePlan, history, referenceDate: REFERENCE_DATE });
    expect(effective.activePhase).toBe('reentry');
    expect(effective.overridden).toBe(true);
  });

  it('trainingPhaseEffectiveMappingDormantPhaseRestart: 28+ day gap activates restart mode', () => {
    const mesocyclePlan = planEndingOnPhase('deload');
    const history = [sessionOnDate(dateDaysBefore(35))];
    const effective = getEffectiveTrainingPhase({ mesocyclePlan, history, referenceDate: REFERENCE_DATE });
    expect(effective.activePhase).toBe('restart');
    expect(effective.compactLabel).toBe('重新开始');
    expect(effective.overridden).toBe(true);
    expect(effective.effectiveWeek.phase).toBe('base');
    expect(effective.effectiveWeek.volumeMultiplier).toBeLessThanOrEqual(0.55);
    expect(effective.mode).toBe('restart');
  });

  it('trainingPhaseEffectiveMappingNoHistorySafeDefault: empty history keeps persisted phase without override', () => {
    const mesocyclePlan = planEndingOnPhase('deload');
    const effective = getEffectiveTrainingPhase({ mesocyclePlan, history: [], referenceDate: REFERENCE_DATE });
    expect(effective.hasHistory).toBe(false);
    expect(effective.activePhase).toBe('deload');
    expect(effective.overridden).toBe(false);
    expect(effective.gapDays).toBe(0);
  });

  it('trainingPhaseEffectiveMappingMissingPlanFallsBackToDefault: undefined plan still derives safely', () => {
    const history = [sessionOnDate(dateDaysBefore(18))];
    const effective = getEffectiveTrainingPhase({ mesocyclePlan: null, history, referenceDate: REFERENCE_DATE });
    expect(effective.activePhase).toBe('reentry');
    expect(effective.overridden).toBe(true);
  });
});

describe('getEffectiveTrainingPhase — automation-first contract', () => {
  it('compactLabel is at most 4 chars (no advisory wall)', () => {
    const cases: Array<{ phase: CyclePhase; gap: number }> = [
      { phase: 'deload', gap: 14 },
      { phase: 'deload', gap: 35 },
      { phase: 'overload', gap: 10 },
      { phase: 'base', gap: 1 },
    ];
    for (const { phase, gap } of cases) {
      const mesocyclePlan = planEndingOnPhase(phase);
      const history = [sessionOnDate(dateDaysBefore(gap))];
      const effective = getEffectiveTrainingPhase({ mesocyclePlan, history, referenceDate: REFERENCE_DATE });
      expect(effective.compactLabel.length).toBeLessThanOrEqual(4);
    }
  });

  it('does not expose verbose advisory copy in the helper return value', () => {
    const mesocyclePlan = planEndingOnPhase('deload');
    const history = [sessionOnDate(dateDaysBefore(20))];
    const effective = getEffectiveTrainingPhase({ mesocyclePlan, history, referenceDate: REFERENCE_DATE });
    const serialized = JSON.stringify(effective);
    // Helper 自身不再产出 "原计划阶段" / "当前建议" / "已停练约 X 天，建议先用一周..." 这类 advisory 文案
    expect(serialized).not.toContain('原计划阶段');
    expect(serialized).not.toContain('当前建议');
    expect(serialized).not.toMatch(/建议先用一周/);
  });

  it('phaseForCompatibility falls back to base for reentry / restart to keep CyclePhase type-safe', () => {
    const plan = planEndingOnPhase('deload');
    const reentry = getEffectiveTrainingPhase({
      mesocyclePlan: plan,
      history: [sessionOnDate(dateDaysBefore(14))],
      referenceDate: REFERENCE_DATE,
    });
    const restart = getEffectiveTrainingPhase({
      mesocyclePlan: plan,
      history: [sessionOnDate(dateDaysBefore(40))],
      referenceDate: REFERENCE_DATE,
    });
    expect(reentry.phaseForCompatibility).toBe('base');
    expect(restart.phaseForCompatibility).toBe('base');
    // 但 activePhase 仍准确反映 reentry / restart 状态
    expect(reentry.activePhase).toBe('reentry');
    expect(restart.activePhase).toBe('restart');
  });
});

describe('getEffectiveTrainingPhase — preserves identity for short gaps', () => {
  it('effectiveWeek === persistedWeek reference when no override', () => {
    const mesocyclePlan = planEndingOnPhase('base');
    const history = [sessionOnDate(dateDaysBefore(1))];
    const effective = getEffectiveTrainingPhase({ mesocyclePlan, history, referenceDate: REFERENCE_DATE });
    expect(effective.effectiveWeek).toBe(effective.persistedWeek);
  });

  it('overridden long-gap produces a new effectiveWeek object (not mutating persistedWeek)', () => {
    const mesocyclePlan = planEndingOnPhase('deload');
    const history = [sessionOnDate(dateDaysBefore(21))];
    const effective = getEffectiveTrainingPhase({ mesocyclePlan, history, referenceDate: REFERENCE_DATE });
    expect(effective.effectiveWeek).not.toBe(effective.persistedWeek);
    expect(effective.persistedWeek.phase).toBe('deload');
    expect(effective.effectiveWeek.phase).toBe('base');
  });
});

describe('getEffectiveTrainingPhase — data safety invariants', () => {
  it('does not mutate the input mesocyclePlan', () => {
    const mesocyclePlan = planEndingOnPhase('deload');
    const snapshot = JSON.stringify(mesocyclePlan);
    const history = [sessionOnDate(dateDaysBefore(30))];
    getEffectiveTrainingPhase({ mesocyclePlan, history, referenceDate: REFERENCE_DATE });
    expect(JSON.stringify(mesocyclePlan)).toBe(snapshot);
  });

  it('does not mutate training history', () => {
    const mesocyclePlan = planEndingOnPhase('deload');
    const history = [sessionOnDate(dateDaysBefore(20))];
    const snapshot = JSON.stringify(history);
    getEffectiveTrainingPhase({ mesocyclePlan, history, referenceDate: REFERENCE_DATE });
    expect(JSON.stringify(history)).toBe(snapshot);
  });

  it('does not require a writable AppData (works with default fixture too)', () => {
    const data = makeAppData();
    const effective = getEffectiveTrainingPhase({
      mesocyclePlan: data.mesocyclePlan,
      history: data.history,
      referenceDate: REFERENCE_DATE,
    });
    expect(effective.activePhase).toBeDefined();
  });
});
