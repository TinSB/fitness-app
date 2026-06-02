import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyStatusRules } from '../src/engines/exercisePrescriptionEngine';
import { buildSupportPlan, buildWeeklyPrescription } from '../src/engines/supportPlanEngine';
import { buildPlanViewModel } from '../src/presenters/planPresenter';
import type { CyclePhase, MesocyclePlan } from '../src/models/training-model';
import { getTemplate, makeAppData, makeSession, makeStatus } from './fixtures';

// 验证 effectiveTrainingPhase 已经接入推荐 / 显示链路（automation-first）：
// 长 gap 时所有 surface 自动应用 activePhase；UI/文案不出现"原计划阶段" / "当前建议" /
// "已停练约 X 天" 等 advisory 长文案，也不要求手动 apply。

const REFERENCE_DATE = '2026-05-27';

// FIX-2: 冻结"现在"到 REFERENCE_DATE。本文件多处通过 buildWeeklyPrescription /
// buildSupportPlan / buildPlanViewModel 间接走引擎环境 new Date()
// （supportPlanEngine getWeekStart 默认参数 = new Date()），不冻结时钟则真实日历
// 漂移会让 fixture 相对今天的 gap/phase 改变、断言失效（time-bomb）。这里只把
// "现在" 冻到 REFERENCE_DATE，fixture 日期仍相对它，断言意图不变。
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(`${REFERENCE_DATE}T12:00:00.000Z`));
});

afterEach(() => {
  vi.useRealTimers();
});

const dateDaysBefore = (days: number) => {
  const d = new Date(`${REFERENCE_DATE}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
};

const planEndingOnPhase = (phase: CyclePhase): MesocyclePlan => {
  const phaseToWeekIndex: Record<CyclePhase, number> = {
    base: 0,
    build: 1,
    overload: 2,
    deload: 3,
  };
  const weekIndex = phaseToWeekIndex[phase];
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

const seedSession = (daysAgo: number) =>
  makeSession({
    id: `session-${daysAgo}`,
    date: dateDaysBefore(daysAgo),
    templateId: 'push-a',
    exerciseId: 'bench-press',
    setSpecs: [
      { weight: 60, reps: 8, rir: 2 },
      { weight: 60, reps: 8, rir: 2 },
    ],
  });

describe('trainingPhaseEffectiveMappingExercisePrescriptionWiring', () => {
  it('14d gap + persisted deload: prescription is not tagged as active deload', () => {
    const mesocyclePlan = planEndingOnPhase('deload');
    const history = [seedSession(14)];
    const template = getTemplate('push-a');
    const adjusted = applyStatusRules(template, makeStatus({ time: '60' }), 'hybrid', null, history, undefined, mesocyclePlan, {
      nowIso: `${REFERENCE_DATE}T12:00:00.000Z`,
    });
    expect(adjusted.exercises.length).toBeGreaterThan(0);
    // 兼容字段反映 effective（base），不是 deload
    adjusted.exercises.forEach((ex) => {
      expect(ex.mesocyclePhase).not.toBe('deload');
    });
    // 文案使用紧凑 "回归周"，不出现 "已停练" / "原计划阶段" / "当前建议" / 长文案
    const adjustmentTexts = adjusted.exercises.map((ex) => ex.adjustment || '').join(' | ');
    expect(adjustmentTexts).toMatch(/回归周/);
    expect(adjustmentTexts).not.toMatch(/已停练/);
    expect(adjustmentTexts).not.toMatch(/原计划阶段/);
    expect(adjustmentTexts).not.toMatch(/当前建议/);
    expect(adjustmentTexts).not.toMatch(/当前处于减量周/);
  });

  it('short gap + persisted deload: prescription still routes through deload semantics', () => {
    const mesocyclePlan = planEndingOnPhase('deload');
    const history = [seedSession(2)];
    const template = getTemplate('push-a');
    const adjusted = applyStatusRules(template, makeStatus({ time: '60' }), 'hybrid', null, history, undefined, mesocyclePlan, {
      nowIso: `${REFERENCE_DATE}T12:00:00.000Z`,
    });
    adjusted.exercises.forEach((ex) => {
      expect(ex.mesocyclePhase).toBe('deload');
    });
  });

  it('28+ day gap → compact restart copy surfaces in exercise adjustment, no advisory wall', () => {
    const mesocyclePlan = planEndingOnPhase('deload');
    const history = [seedSession(40)];
    const template = getTemplate('push-a');
    const adjusted = applyStatusRules(template, makeStatus({ time: '60' }), 'hybrid', null, history, undefined, mesocyclePlan, {
      nowIso: `${REFERENCE_DATE}T12:00:00.000Z`,
    });
    const adjustmentTexts = adjusted.exercises.map((ex) => ex.adjustment || '').join(' | ');
    expect(adjustmentTexts).toMatch(/重新开始/);
    expect(adjustmentTexts).not.toMatch(/已停练/);
    expect(adjustmentTexts).not.toMatch(/建议先用一周/);
  });
});

describe('trainingPhaseEffectiveMappingWeeklyPrescription', () => {
  it('14d gap + persisted overload: weekly multiplier drops below original overload bump', () => {
    const mesocyclePlan = planEndingOnPhase('overload');
    const dataLongGap = makeAppData({
      mesocyclePlan,
      history: [seedSession(14)],
      todayStatus: makeStatus({ time: '60' }),
    });
    const dataShortGap = makeAppData({
      mesocyclePlan,
      history: [seedSession(1)],
      todayStatus: makeStatus({ time: '60' }),
    });
    const longGapPrescription = buildWeeklyPrescription(dataLongGap);
    const shortGapPrescription = buildWeeklyPrescription(dataShortGap);
    const longGapTarget = longGapPrescription.muscles[0]?.target ?? 0;
    const shortGapTarget = shortGapPrescription.muscles[0]?.target ?? 0;
    expect(longGapTarget).toBeLessThan(shortGapTarget);
  });

  it('weekly prescription rationale uses compact phase label, not persisted overload', () => {
    const mesocyclePlan = planEndingOnPhase('overload');
    const data = makeAppData({
      mesocyclePlan,
      history: [seedSession(14)],
    });
    const prescription = buildWeeklyPrescription(data);
    const reasons = prescription.muscles.flatMap((m) => m.adjustmentReasons).join(' | ');
    expect(reasons).not.toMatch(/当前周期 过载周/);
    // reentry 时若周剂量倍率 ≠ 1，应出现紧凑 "回归周" 文案
    if (reasons) {
      expect(reasons).not.toMatch(/原计划阶段|当前建议|已停练/);
    }
  });
});

describe('trainingPhaseEffectiveMappingSupportPlanEngine', () => {
  it('14d gap + persisted deload: support plan should not minimum-effective-trim by deload alone', () => {
    const mesocyclePlan = planEndingOnPhase('deload');
    const data = makeAppData({
      mesocyclePlan,
      history: [seedSession(14)],
    });
    const template = getTemplate('push-a');
    const plan = buildSupportPlan(data, template);
    // effective=reentry，deload-trim 不应被触发（除非 deloadDecision.level === red）
    expect(plan.correctionModules.length + plan.functionalAddons.length).toBeGreaterThanOrEqual(1);
  });
});

describe('trainingPhaseEffectiveMappingPlanViewModel', () => {
  it('14d gap + persisted deload: phaseLabel uses 回归周 (no comparison card content)', () => {
    const mesocyclePlan = planEndingOnPhase('deload');
    const data = makeAppData({
      mesocyclePlan,
      history: [seedSession(14)],
    });
    const vm = buildPlanViewModel(data);
    expect(vm.currentPlan.phaseLabel).toContain('回归周');
    expect(vm.currentPlan.phaseLabel).not.toContain('减量周');
    const serialized = JSON.stringify(vm.currentPlan);
    expect(serialized).not.toContain('原计划阶段');
    expect(serialized).not.toContain('当前建议');
    expect(serialized).not.toMatch(/已停练/);
  });

  it('short gap + persisted deload: phaseLabel keeps 减量周', () => {
    const mesocyclePlan = planEndingOnPhase('deload');
    const data = makeAppData({
      mesocyclePlan,
      history: [seedSession(2)],
    });
    const vm = buildPlanViewModel(data);
    expect(vm.currentPlan.phaseLabel).toContain('减量周');
  });

  it('no history: phaseLabel keeps persisted label (safe default)', () => {
    const mesocyclePlan = planEndingOnPhase('deload');
    const data = makeAppData({ mesocyclePlan, history: [] });
    const vm = buildPlanViewModel(data);
    expect(vm.currentPlan.phaseLabel).toContain('减量周');
  });
});

describe('trainingPhaseEffectiveMappingDataSafety', () => {
  it('long gap does not mutate AppData or training history', () => {
    const mesocyclePlan = planEndingOnPhase('deload');
    const history = [seedSession(20)];
    const data = makeAppData({ mesocyclePlan, history });
    const snapshot = JSON.stringify(data);
    buildWeeklyPrescription(data);
    buildSupportPlan(data, getTemplate('push-a'));
    buildPlanViewModel(data);
    expect(JSON.stringify(data)).toBe(snapshot);
  });
});
