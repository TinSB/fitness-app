import { describe, expect, it } from 'vitest';
import { CORRECTION_MODULES, FUNCTIONAL_ADDONS } from '../src/data/trainingData';
import {
  buildE1RMExplanation,
  buildSessionSummaryExplanations,
  buildTodayExplanationItems,
  buildTodayExplanations,
  buildWeeklyActionExplanation,
  explainAdjustmentDefaultSelection,
  explainAdjustmentRisk,
  explainAdjustmentReview,
  explainExperimentalTemplatePolicy,
  formatExplanationEvidence,
  formatExplanationItem,
} from '../src/engines/explainabilityEngine';
import { upsertLoadFeedback } from '../src/engines/loadFeedbackEngine';
import { hydrateTemplates } from '../src/engines/engineUtils';
import type { ExercisePrescription, SupportPlan, WeeklyPrescription } from '../src/models/training-model';
import { makeSession, templates } from './fixtures';

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

  it('adds evidence, confidence and caveat to low readiness explanations', () => {
    const items = buildTodayExplanationItems({
      template,
      adjustedPlan: {
        ...template,
        exercises: [makeExercise()],
        readinessResult: {
          score: 42,
          level: 'low',
          trainingAdjustment: 'conservative',
          reasons: ['睡眠差', '精力低'],
        },
      },
      supportPlan: makeSupportPlan(),
      weeklyPrescription: makeWeeklyPrescription(),
    });

    const text = items.map(formatExplanationItem).join(' ');
    expect(text).toContain('准备度评分');
    expect(text).toContain('保守训练');
    expect(formatExplanationEvidence(items[0]).length).toBeGreaterThan(0);
    expect(items[0].caveat).toBeTruthy();
  });

  it('explains poor technique progression gate without raw enum leakage', () => {
    const items = buildTodayExplanationItems({
      template,
      adjustedPlan: {
        ...template,
        exercises: [makeExercise({ suggestion: '动作质量较差，本次不建议加重' })],
      },
      supportPlan: makeSupportPlan(),
      weeklyPrescription: makeWeeklyPrescription(),
    });
    const text = items.map(formatExplanationItem).join(' ');
    expect(text).toContain('动作质量');
    expect(text).not.toContain('poor');
    expect(text).not.toContain('undefined');
  });

  it('explains insufficient e1RM data conservatively', () => {
    const item = buildE1RMExplanation(null, '卧推');
    const text = formatExplanationItem(item);
    expect(text).toContain('历史高质量工作组不足');
    expect(text).toContain('RIR');
    expect(formatExplanationEvidence(item)).toContain('RIR 努力程度控制');
  });

  it('states that load guidance uses recent records instead of historical best', () => {
    const item = buildE1RMExplanation(
      {
        exerciseId: 'bench-press',
        e1rmKg: 96,
        formula: 'epley',
        confidence: 'medium',
        sourceSet: {
          sessionId: 's1',
          date: '2026-04-24',
          weightKg: 80,
          reps: 6,
          rir: 2,
          techniqueQuality: 'good',
        },
        notes: ['基于最近高质量工作组估算，不使用历史最高记录作为训练推荐。'],
      },
      '卧推'
    );

    expect(formatExplanationItem(item)).toContain('近期同动作高质量记录');
    expect(formatExplanationItem(item)).toContain('历史最高');
  });

  it('summarizes load feedback after a session', () => {
    const session = upsertLoadFeedback(
      makeSession({
        id: 'summary-feedback',
        date: '2026-04-24',
        templateId: 'push-a',
        exerciseId: 'bench-press',
        setSpecs: [{ weight: 80, reps: 6, rir: 2, techniqueQuality: 'good' }],
      }),
      'bench-press',
      'too_heavy'
    );

    const text = buildSessionSummaryExplanations({ session }).join(' ');
    expect(text).toContain('推荐重量反馈');
    expect(text).toContain('不会直接篡改历史最佳 e1RM');
  });

  it('explains weekly action recommendations without raw enum or empty values', () => {
    const item = buildWeeklyActionExplanation({
      id: 'volume-back',
      priority: 'high',
      category: 'volume',
      targetType: 'muscle',
      targetId: '背',
      targetLabel: '背',
      issue: '背本周加权有效组明显低于目标。',
      recommendation: '下周优先补 3 组背部训练量，可放在坐姿划船或高位下拉。',
      reason: '目标 12 组，目前加权有效组 5 组。',
      suggestedChange: { muscleId: '背', setsDelta: 3, exerciseIds: ['seated-row', 'lat-pulldown'] },
      evidenceRuleIds: ['weekly_volume_distribution'],
      confidence: 'high',
    });
    const text = formatExplanationItem(item);
    expect(text).toContain('下周优先补');
    expect(text).not.toMatch(/undefined|null|volume|high/);
    expect(formatExplanationEvidence(item)).toContain('每周训练量分配');
  });
});
