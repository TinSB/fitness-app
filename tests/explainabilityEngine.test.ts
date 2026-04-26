import { describe, expect, it } from 'vitest';
import { CORRECTION_MODULES, FUNCTIONAL_ADDONS } from '../src/data/trainingData';
import { buildTodayExplanations } from '../src/engines/explainabilityEngine';
import { hydrateTemplates } from '../src/engines/engineUtils';
import type { ExercisePrescription, SupportPlan, WeeklyPrescription } from '../src/models/training-model';
import { templates } from './fixtures';

const template = templates[0];

const makeExercise = (overrides: Partial<ExercisePrescription> = {}): ExercisePrescription => ({
  ...hydrateTemplates([template])[0].exercises[0],
  baseId: 'bench-press',
  sets: 3,
  progressLocked: false,
  conservativeTopSet: false,
  adaptiveTopSetFactor: 1,
  adaptiveBackoffFactor: 0.92,
  adaptiveReasons: [],
  ...overrides,
});

const makeWeeklyPrescription = (targetOverrides: Partial<WeeklyPrescription['muscles'][number]> = {}): WeeklyPrescription => ({
  weekStart: '2026-04-20',
  mode: {
    id: 'hybrid',
    label: '混合',
    shortLabel: '混合',
    description: '',
    weeklyTargets: { 胸: 10, 背: 12, 腿: 12, 肩: 8, 手臂: 8 },
  },
  muscles: [
    {
      muscle: '胸',
      baseTarget: 10,
      target: 10,
      sets: 6,
      remaining: 4,
      capacity: 10,
      remainingCapacity: 4,
      todayBudget: 2,
      targetMultiplier: 1,
      adjustmentReasons: [],
      recoveryMultiplier: 1,
      frequency: 1,
      targetFrequency: 2,
      directSets: 6,
      indirectSets: 0,
      status: '待补量',
      ...targetOverrides,
    },
  ],
});

const makeSupportPlan = (mode: 'baseline' | 'boost' | 'taper' = 'baseline'): SupportPlan => ({
  primaryGoal: 'hypertrophy',
  mainline: { name: template.name, splitType: 'upper_lower', durationMin: 60, ratio: 70 },
  correctionModules: [
    {
      ...CORRECTION_MODULES[0],
      dose: mode === 'boost' ? 'boost' : mode === 'taper' ? 'taper' : 'baseline',
    },
  ],
  functionalAddons: [
    {
      ...FUNCTIONAL_ADDONS[0],
      dose: 'baseline',
    },
  ],
  totalDurationMin: 78,
  ratios: { mainline: 70, correction: 20, functional: 10 },
});

describe('explainabilityEngine', () => {
  it('mentions recovery or deload when deload is red', () => {
    const explanations = buildTodayExplanations({
      template,
      adjustedPlan: {
        ...template,
        exercises: [makeExercise()],
        deloadDecision: {
          level: 'red',
          triggered: true,
          reasons: ['最近多次表现回落', '恢复信号偏差'],
          title: '建议恢复优先',
          strategy: 'recovery_template',
          volumeMultiplier: 0.6,
          options: [],
        },
        readiness: {
          level: 'red',
          title: '恢复优先',
          advice: '',
          reasons: ['睡眠差', '精力低'],
          poorSleepDays: 2,
        },
      },
      supportPlan: makeSupportPlan(),
      weeklyPrescription: makeWeeklyPrescription(),
    });

    expect(explanations.join(' ')).toMatch(/恢复|减量|疲劳/);
  });

  it('mentions weekly budget or recovery capacity when budget is reduced', () => {
    const explanations = buildTodayExplanations({
      template,
      adjustedPlan: { ...template, exercises: [makeExercise()] },
      supportPlan: makeSupportPlan(),
      weeklyPrescription: makeWeeklyPrescription({
        sets: 8,
        target: 10,
        remaining: 2,
        remainingCapacity: 1,
        targetMultiplier: 0.8,
      }),
    });

    expect(explanations.join(' ')).toMatch(/恢复额度|补量|周剂量/);
  });

  it('mentions replacement when replacementSuggested exists', () => {
    const explanations = buildTodayExplanations({
      template,
      adjustedPlan: {
        ...template,
        exercises: [makeExercise({ replacementSuggested: '器械推胸', adaptiveReasons: ['肩胛控制波动'] })],
      },
      supportPlan: makeSupportPlan(),
      weeklyPrescription: makeWeeklyPrescription(),
    });

    expect(explanations.join(' ')).toMatch(/换成|替代|器械推胸/);
  });

  it('mentions support module dose change when module is boosted or tapered', () => {
    const boosted = buildTodayExplanations({
      template,
      adjustedPlan: { ...template, exercises: [makeExercise()] },
      supportPlan: makeSupportPlan('boost'),
      weeklyPrescription: makeWeeklyPrescription(),
      screening: {
        userId: 'u1',
        postureFlags: {} as never,
        movementFlags: {} as never,
        painTriggers: [],
        restrictedExercises: [],
        correctionPriority: ['upper_crossed'],
        adaptiveState: {
          issueScores: { upper_crossed: 5 },
          painByExercise: {},
          performanceDrops: [],
          improvingIssues: [],
          moduleDose: { upper_crossed: 'boost' },
          lastUpdated: '2026-04-25',
        },
      },
    });

    const tapered = buildTodayExplanations({
      template,
      adjustedPlan: { ...template, exercises: [makeExercise()] },
      supportPlan: makeSupportPlan('taper'),
      weeklyPrescription: makeWeeklyPrescription(),
      screening: {
        userId: 'u1',
        postureFlags: {} as never,
        movementFlags: {} as never,
        painTriggers: [],
        restrictedExercises: [],
        correctionPriority: ['upper_crossed'],
        adaptiveState: {
          issueScores: { upper_crossed: 1 },
          painByExercise: {},
          performanceDrops: [],
          improvingIssues: ['upper_crossed'],
          moduleDose: { upper_crossed: 'taper' },
          lastUpdated: '2026-04-25',
        },
      },
    });

    expect(boosted.join(' ')).toMatch(/提高|剂量/);
    expect(tapered.join(' ')).toMatch(/维持剂量|改善/);
  });

  it('falls back to normal progression text when there is nothing special', () => {
    const explanations = buildTodayExplanations({
      template,
      adjustedPlan: {
        ...template,
        exercises: [makeExercise()],
        readiness: {
          level: 'green',
          title: '正常推进',
          advice: '',
          reasons: [],
          poorSleepDays: 0,
        },
      },
      supportPlan: { ...makeSupportPlan(), correctionModules: [], functionalAddons: [] },
      weeklyPrescription: makeWeeklyPrescription({ remaining: 0, todayBudget: 0 }),
      todayStatus: { sleep: '一般', energy: '中', soreness: ['无'], time: '60' },
    });

    expect(explanations.join(' ')).toMatch(/正常推进|按 .* 推进|当前模板/);
  });
});
