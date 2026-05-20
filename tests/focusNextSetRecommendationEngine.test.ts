import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildFocusStepQueue, type FocusTrainingStep } from '../src/engines/focusModeStateEngine';
import { buildFocusNextSetRecommendation } from '../src/engines/focusNextSetRecommendationEngine';
import { convertKgToDisplayWeight } from '../src/engines/unitConversionEngine';
import type { TrainingSession, UnitSettings } from '../src/models/training-model';
import { attachSupportBlocks, makeExercise, makeFocusSession } from './focusModeFixtures';

const lbToKg = (lb: number) => lb * 0.45359237;

const unitSettings: UnitSettings = {
  weightUnit: 'lb',
  defaultIncrementKg: 2.5,
  defaultIncrementLb: 5,
  customIncrementsKg: [],
  customIncrementsLb: [],
};

const nowIso = '2026-05-19T12:00:00.000Z';

const makeStep = (overrides: Partial<FocusTrainingStep> = {}): FocusTrainingStep => ({
  id: 'main:bench-press:working:0',
  exerciseId: 'bench-press',
  exerciseIndex: 0,
  blockType: 'main',
  stepType: 'working',
  setIndex: 0,
  totalSetsForStepType: 3,
  label: '正式组 1 / 3',
  plannedWeight: lbToKg(45),
  plannedReps: 10,
  plannedRir: 2,
  plannedRestSec: 120,
  source: 'working-set',
  exerciseName: 'Bench Press',
  ...overrides,
});

const makeSession = (): TrainingSession =>
  makeFocusSession([
    {
      ...makeExercise('bench-press', 3),
      name: 'Bench Press',
      sets: [
        { id: 'bench-1', weight: lbToKg(45), reps: 10, rir: 2, done: false, painFlag: false, type: 'working' },
        { id: 'bench-2', weight: lbToKg(45), reps: 10, rir: 2, done: false, painFlag: false, type: 'working' },
        { id: 'bench-3', weight: lbToKg(45), reps: 10, rir: 2, done: false, painFlag: false, type: 'working' },
      ],
    },
  ]);

const buildRecommendation = (
  overrides: Partial<Parameters<typeof buildFocusNextSetRecommendation>[0]> = {},
  completedStep: FocusTrainingStep = makeStep({ id: 'main:bench-press:working:0', setIndex: 0 }),
  nextStep: FocusTrainingStep | null = makeStep({ id: 'main:bench-press:working:1', setIndex: 1 }),
) =>
  buildFocusNextSetRecommendation({
    session: makeSession(),
    completedStep,
    nextStep,
    completedActualWeightKg: lbToKg(45),
    completedActualReps: 10,
    completedActualRir: 2,
    techniqueQuality: 'good',
    unitSettings,
    nowIso,
    ...overrides,
  });

describe('focus next set recommendation engine', () => {
  it('returns no recommendation when there is no next step', () => {
    const result = buildRecommendation({}, makeStep(), null);

    expect(result.recommendationKind).toBe('no_recommendation');
    expect(result.confidence).toBe('low');
    expect(result.reasonCodes).toContain('session_or_exercise_complete');
    expect(result.actionableLoadKg).toBeUndefined();
    expect(result.level).toBe(1);
  });

  it('does not invent load recommendations for support, correction, or functional steps', () => {
    const session = attachSupportBlocks(makeFocusSession([makeExercise('bench-press', 1)]));
    const supportStep = buildFocusStepQueue(session).find((step) => step.stepType === 'correction');
    expect(supportStep).toBeTruthy();

    const result = buildFocusNextSetRecommendation({
      session,
      completedStep: supportStep as FocusTrainingStep,
      nextStep: makeStep({ id: 'main:bench-press:working:0', setIndex: 0 }),
      completedActualReps: 10,
      completedActualWeightKg: lbToKg(45),
      unitSettings,
      nowIso,
    });

    expect(result.recommendationKind).toBe('no_recommendation');
    expect(result.reasonCodes).toContain('support_step_not_supported');
    expect(result.actionableLoadKg).toBeUndefined();
  });

  it('holds when a normal working set matches the plan', () => {
    const result = buildRecommendation();

    expect(result.recommendationKind).toBe('hold');
    expect(result.confidence).toBe('high');
    expect(result.reasonCodes).toContain('matched_plan');
    expect(result.plannedReps).toBe(10);
    expect(convertKgToDisplayWeight(result.actionableLoadKg, 'lb')).toBe(45);
    expect(result.level).toBe(2);
  });

  it('increases load after reps above target with good technique and no pain', () => {
    const result = buildRecommendation({ completedActualReps: 12, completedActualRir: 3 });

    expect(result.recommendationKind).toBe('increase_load');
    expect(result.reasonCodes).toContain('reps_above_plan');
    expect(result.actionableLoadKg).toBeGreaterThan(0);
    expect(result.level).toBe(2);
  });

  it('decreases load or reduces reps after reps below target', () => {
    const result = buildRecommendation({ completedActualReps: 7 });

    expect(['decrease_load', 'reduce_reps']).toContain(result.recommendationKind);
    expect(result.reasonCodes).toContain('reps_below_plan');
    expect(result.recommendationKind).not.toBe('increase_load');
  });

  it('blocks progression and requires confirmation when pain is flagged', () => {
    const result = buildRecommendation({ painFlag: true, completedActualReps: 12 });

    expect(result.recommendationKind).toBe('stop_exercise');
    expect(result.reasonCodes).toContain('pain_flag');
    expect(result.riskFlags).toContain('pain');
    expect(result.requiresConfirmation).toBe(true);
    expect(result.level).toBe(1);
  });

  it('blocks progression when technique is poor', () => {
    const result = buildRecommendation({ techniqueQuality: 'poor', completedActualReps: 12 });

    expect(result.recommendationKind).toBe('decrease_load');
    expect(result.reasonCodes).toContain('poor_technique');
    expect(result.riskFlags).toContain('technique_breakdown');
    expect(result.recommendationKind).not.toBe('increase_load');
  });

  it('blocks aggressive increases after near-failure RIR', () => {
    const result = buildRecommendation(
      { completedActualReps: 12, completedActualRir: 0 },
      makeStep({ id: 'main:bench-press:working:0', plannedWeight: lbToKg(45), setIndex: 0 }),
      makeStep({ id: 'main:bench-press:working:1', plannedWeight: lbToKg(50), setIndex: 1 }),
    );

    expect(['avoid_pr_attempt', 'extend_rest', 'hold']).toContain(result.recommendationKind);
    expect(result.recommendationKind).not.toBe('increase_load');
    expect(result.reasonCodes).toContain('near_failure');
  });

  it('does not recommend aggressive load jumps during warmup', () => {
    const completedWarmup = makeStep({
      id: 'main:bench-press:warmup:0',
      stepType: 'warmup',
      setIndex: 0,
      totalSetsForStepType: 2,
      plannedWeight: lbToKg(45),
      plannedReps: 10,
      source: 'warmup',
    });
    const nextWarmup = makeStep({
      id: 'main:bench-press:warmup:1',
      stepType: 'warmup',
      setIndex: 1,
      totalSetsForStepType: 2,
      plannedWeight: lbToKg(65),
      plannedReps: 8,
      source: 'warmup',
    });

    const result = buildRecommendation({ completedActualReps: 10, completedActualRir: 2 }, completedWarmup, nextWarmup);

    expect(result.recommendationKind).toBe('hold');
    expect(result.recommendationKind).not.toBe('increase_load');
    expect(result.reasonCodes).toContain('warmup_hold');
  });

  it('resolves below-bar raw planned load to an actionable empty bar output', () => {
    const result = buildRecommendation(
      { completedActualWeightKg: lbToKg(45), completedActualReps: 10 },
      makeStep({ id: 'main:bench-press:working:0', plannedWeight: lbToKg(27), setIndex: 0 }),
      makeStep({ id: 'main:bench-press:working:1', plannedWeight: lbToKg(27), setIndex: 1 }),
    );

    expect(result.recommendationKind).toBe('hold');
    expect(convertKgToDisplayWeight(result.actionableLoadKg, 'lb')).toBe(45);
    expect(convertKgToDisplayWeight(lbToKg(27), 'lb')).toBe(27);
  });

  it('does not treat raw theoretical load as the validation baseline', () => {
    const result = buildRecommendation(
      { completedActualWeightKg: lbToKg(45), completedActualReps: 10 },
      makeStep({ id: 'main:bench-press:working:0', plannedWeight: lbToKg(27), setIndex: 0 }),
      makeStep({ id: 'main:bench-press:working:1', plannedWeight: lbToKg(27), setIndex: 1 }),
    );

    expect(result.actionableLoadKg).toBeDefined();
    expect(convertKgToDisplayWeight(result.actionableLoadKg, 'lb')).not.toBe(27);
    expect(convertKgToDisplayWeight(result.actionableLoadKg, 'lb')).toBe(45);
  });

  it('uses deterministic timestamps and stable ids when nowIso is provided', () => {
    const result = buildRecommendation({ completedActualReps: 12 });

    expect(result.createdAt).toBe(nowIso);
    expect(result.id).toBe('focus-next-set:main:bench-press:working:0->main:bench-press:working:1:increase_load');
    expect(result.sourceEngineIds).toEqual(['focus-next-set-recommendation-v1']);
  });

  it('does not mutate the session or focus steps', () => {
    const session = makeSession();
    const completedStep = makeStep({ id: 'main:bench-press:working:0', setIndex: 0 });
    const nextStep = makeStep({ id: 'main:bench-press:working:1', setIndex: 1 });
    const before = JSON.stringify({ session, completedStep, nextStep });

    buildFocusNextSetRecommendation({
      session,
      completedStep,
      nextStep,
      completedActualWeightKg: lbToKg(45),
      completedActualReps: 12,
      completedActualRir: 3,
      techniqueQuality: 'good',
      unitSettings,
      nowIso,
    });

    expect(JSON.stringify({ session, completedStep, nextStep })).toBe(before);
  });

  it('keeps the pure engine free of storage, UI, dev API, and Node runtime imports', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/engines/focusNextSetRecommendationEngine.ts'), 'utf8');
    const forbidden = [
      'localStorage',
      '../storage',
      '/storage',
      '../features',
      '../ui',
      '../uiOs',
      'React',
      'devApi',
      'apps/api',
      'node:',
      'fs',
      'path',
    ];

    for (const token of forbidden) {
      expect(source).not.toContain(token);
    }
  });
});
