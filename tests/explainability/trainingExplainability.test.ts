import { describe, expect, it } from 'vitest';
import { CORRECTION_MODULES, FUNCTIONAL_ADDONS } from '../../src/data/trainingData';
import {
  buildSessionSummaryExplanations,
  buildTodayExplanationItems,
  buildTodayExplanations,
  formatExplanationItem,
} from '../../src/engines/explainability';
import { hydrateTemplates } from '../../src/engines/engineUtils';
import type { ExercisePrescription, SupportPlan, WeeklyPrescription } from '../../src/models/training-model';
import { makeSession, templates } from '../fixtures';
import { expectCleanExplanation, expectCleanExplanationList } from './testUtils';

const template = templates[0];

const makeExercise = (overrides: Partial<ExercisePrescription> = {}): ExercisePrescription => ({
  ...hydrateTemplates([template])[0].exercises[0],
  name: 'Bench Press',
  alias: 'Bench Press',
  baseId: 'bench-press',
  sets: 3,
  progressLocked: false,
  conservativeTopSet: false,
  adaptiveTopSetFactor: 1,
  adaptiveBackoffFactor: 0.92,
  adaptiveReasons: [],
  ...overrides,
});

const makeWeeklyPrescription = (): WeeklyPrescription => ({
  weekStart: '2026-04-20',
  muscles: [
    {
      muscle: 'chest',
      target: 10,
      sets: 6,
      remaining: 4,
      remainingCapacity: 4,
      todayBudget: 2,
      targetMultiplier: 1,
      frequency: 1,
    },
  ],
});

const makeSupportPlan = (): SupportPlan => ({
  primaryGoal: 'hypertrophy',
  mainline: { name: template.name, splitType: 'upper_lower', durationMin: 60, ratio: 70 },
  correctionModules: [{ ...CORRECTION_MODULES[0], dose: 'baseline' }],
  functionalAddons: [{ ...FUNCTIONAL_ADDONS[0], dose: 'baseline' }],
  totalDurationMin: 78,
  ratios: { mainline: 70, correction: 20, functional: 10 },
});

describe('training explainability module', () => {
  it('explains low readiness with conservative training context', () => {
    const items = buildTodayExplanationItems({
      template,
      adjustedPlan: {
        ...template,
        exercises: [makeExercise()],
        readinessResult: {
          score: 42,
          level: 'low',
          trainingAdjustment: 'conservative',
          reasons: ['sleep debt', 'energy debt'],
        },
      },
      supportPlan: makeSupportPlan(),
      weeklyPrescription: makeWeeklyPrescription(),
    });

    const text = items.map(formatExplanationItem).join(' ');
    expect(text).toContain('42');
    expect(text).toContain('sleep debt');
    expectCleanExplanation(text);
  });

  it('explains poor technique as a reason not to add load', () => {
    const explanations = buildTodayExplanations({
      template,
      adjustedPlan: {
        ...template,
        exercises: [makeExercise({ suggestion: '动作质量较差，本次不建议加重' })],
      },
      supportPlan: makeSupportPlan(),
      weeklyPrescription: makeWeeklyPrescription(),
    });

    const text = explanations.join(' ');
    expect(text).toContain('Bench Press');
    expect(text).toContain('动作质量');
    expectCleanExplanationList(explanations);
  });

  it('explains pain pattern handling in session summary', () => {
    const session = makeSession({
      id: 'pain-summary',
      date: '2026-04-24',
      templateId: 'push-a',
      exerciseId: 'bench-press',
      setSpecs: [{ weight: 80, reps: 6, rir: 2, painFlag: true, painArea: 'shoulder', painSeverity: 4 }],
    });

    const lines = buildSessionSummaryExplanations({
      session,
      painPatterns: [
        {
          area: 'shoulder',
          exerciseId: 'bench-press',
          frequency: 2,
          severityAvg: 4,
          lastOccurredAt: '2026-04-24',
          suggestedAction: 'substitute',
        },
      ],
    });

    expect(lines.join(' ')).toContain('shoulder');
    expectCleanExplanationList(lines);
  });
});
