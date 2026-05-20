import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { convertKgToDisplayWeight } from '../src/engines/unitConversionEngine';
import { buildPostWorkoutNextTimeRecommendation } from '../src/engines/postWorkoutNextTimeRecommendationEngine';
import type { ExercisePrescription, TrainingSession, TrainingSetLog, UnitSettings } from '../src/models/training-model';

const lbToKg = (lb: number) => lb * 0.45359237;

const unitSettings: UnitSettings = {
  weightUnit: 'lb',
  defaultIncrementKg: 2.5,
  defaultIncrementLb: 5,
  customIncrementsKg: [],
  customIncrementsLb: [],
};

const nowIso = '2026-05-20T12:00:00.000Z';

const set = (overrides: Partial<TrainingSetLog> = {}): TrainingSetLog => ({
  id: overrides.id || 'set-1',
  type: 'working',
  weight: 100,
  actualWeightKg: 100,
  reps: 8,
  rir: 2,
  rpe: '',
  done: true,
  painFlag: false,
  techniqueQuality: 'good',
  ...overrides,
});

const exercise = (overrides: Partial<ExercisePrescription> & { sets?: TrainingSetLog[] | number } = {}): ExercisePrescription =>
  ({
    id: 'bench-press',
    baseId: 'bench-press',
    canonicalExerciseId: 'bench-press',
    name: 'Bench Press',
    alias: 'Bench Press',
    muscle: '胸',
    kind: 'compound',
    sets: overrides.sets ?? [set()],
    repMin: 6,
    repMax: 8,
    rest: 120,
    startWeight: 100,
    ...overrides,
  }) as ExercisePrescription;

const session = (overrides: Partial<TrainingSession> = {}): TrainingSession => ({
  id: 'session-post-workout',
  date: '2026-05-20',
  templateId: 'push-a',
  templateName: 'Push A',
  trainingMode: 'hybrid',
  completed: true,
  dataFlag: 'normal',
  exercises: [exercise()],
  ...overrides,
});

const firstRecommendation = (inputSession: TrainingSession = session()) => {
  const result = buildPostWorkoutNextTimeRecommendation({
    session: inputSession,
    unitSettings,
    nowIso,
  });
  expect(result.recommendations.length).toBeGreaterThan(0);
  return result.recommendations[0];
};

const visibleForbiddenTerms = [
  '引擎',
  '算法',
  '自动化',
  '模型',
  'AI 教练',
  '系统判断',
  '智能推荐',
  '决策系统',
  'engine',
  'algorithm',
  'automation',
  'model',
  'AI coach',
  'intelligent recommendation',
  'decision system',
];

describe('post-workout next-time recommendation engine', () => {
  it('returns an insufficient-data session result when there are no completed working sets', () => {
    const result = buildPostWorkoutNextTimeRecommendation({
      session: session({
        exercises: [
          exercise({
            sets: [
              set({ id: 'warmup-1', type: 'warmup', done: true, reps: 10 }),
              set({ id: 'draft-1', type: 'working', done: false, completionStatus: 'draft', reps: 8 }),
            ],
          }),
        ],
      }),
      nowIso,
    });

    expect(result.scope).toBe('session');
    expect(result.recommendations).toEqual([]);
    expect(result.blockedReasons).toContain('insufficient_completed_working_sets');
    expect(result.summary).toBe('暂无足够记录。');
    expect(result.createdAt).toBe(nowIso);
  });

  it('ignores warmup and support/correction/functional sets', () => {
    const result = buildPostWorkoutNextTimeRecommendation({
      session: session({
        exercises: [
          exercise({
            sets: [
              set({ id: 'warmup-1', type: 'warmup', reps: 20 }),
              set({ id: 'correction-1', type: 'correction', reps: 20 }),
              set({ id: 'corrective-1', type: 'corrective', reps: 20 }),
              set({ id: 'functional-1', type: 'functional', reps: 20 }),
              set({ id: 'support-1', type: 'support', reps: 20 }),
            ],
          }),
        ],
      }),
      nowIso,
    });

    expect(result.recommendations).toEqual([]);
    expect(result.blockedReasons).toContain('insufficient_completed_working_sets');
  });

  it('does not mutate the session or history inputs', () => {
    const inputSession = session({
      exercises: [exercise({ sets: [set({ id: 'work-1', reps: 10 }), set({ id: 'work-2', reps: 10 })] })],
    });
    const history = [session({ id: 'history-1', exercises: [exercise({ sets: [set({ id: 'history-set', reps: 8 })] })] })];
    const before = JSON.stringify({ inputSession, history });

    buildPostWorkoutNextTimeRecommendation({ session: inputSession, history, unitSettings, nowIso });

    expect(JSON.stringify({ inputSession, history })).toBe(before);
  });

  it('blocks load increase and returns pain review when pain is recorded', () => {
    const recommendation = firstRecommendation(
      session({
        exercises: [exercise({ sets: [set({ id: 'work-1', reps: 10, painFlag: true })] })],
      }),
    );

    expect(recommendation.recommendationKind).toBe('pain_review');
    expect(recommendation.riskFlags).toContain('pain');
    expect(recommendation.confidence).toBe('high');
    expect(recommendation.actionableLoadKg).toBeUndefined();
    expect(recommendation.userMessage).toBe('有不适，先复查。');
  });

  it('blocks load increase when technique quality is poor', () => {
    const recommendation = firstRecommendation(
      session({
        exercises: [exercise({ sets: [set({ id: 'work-1', reps: 10, techniqueQuality: 'poor' })] })],
      }),
    );

    expect(['technique_review', 'decrease_load']).toContain(recommendation.recommendationKind);
    expect(recommendation.recommendationKind).not.toBe('increase_load');
    expect(recommendation.riskFlags).toContain('technique_breakdown');
    expect(recommendation.userMessage).toBe('动作质量不足，先稳住。');
  });

  it('returns an actionable small load increase after strong completion', () => {
    const recommendation = firstRecommendation(
      session({
        exercises: [
          exercise({
            sets: [
              set({ id: 'work-1', weight: 100, actualWeightKg: 100, reps: 10 }),
              set({ id: 'work-2', weight: 100, actualWeightKg: 100, reps: 10 }),
            ],
          }),
        ],
      }),
    );

    expect(recommendation.recommendationKind).toBe('increase_load');
    expect(recommendation.reasonCodes).toContain('strong_completion');
    expect(recommendation.actionableLoadKg).toBeGreaterThan(100);
    expect(recommendation.userMessage).toBe('完成稳定，下次小幅加重。');
  });

  it('keeps load after matching the plan', () => {
    const recommendation = firstRecommendation(
      session({
        exercises: [exercise({ sets: [set({ id: 'work-1', reps: 8 }), set({ id: 'work-2', reps: 8 })] })],
      }),
    );

    expect(recommendation.recommendationKind).toBe('keep_load');
    expect(recommendation.reasonCodes).toContain('matched_plan');
    expect(recommendation.actionableLoadKg).toBeGreaterThan(0);
    expect(recommendation.userMessage).toBe('完成稳定，下次保持。');
  });

  it('repeats next time after a small miss', () => {
    const recommendation = firstRecommendation(
      session({
        exercises: [exercise({ sets: [set({ id: 'work-1', reps: 7 }), set({ id: 'work-2', reps: 8 })] })],
      }),
    );

    expect(recommendation.recommendationKind).toBe('repeat_next_time');
    expect(recommendation.reasonCodes).toContain('small_underperformance');
    expect(recommendation.userMessage).toBe('完成不足，下次保守。');
  });

  it('decreases load or reduces reps after clear underperformance', () => {
    const recommendation = firstRecommendation(
      session({
        exercises: [exercise({ sets: [set({ id: 'work-1', reps: 5 }), set({ id: 'work-2', reps: 6 })] })],
      }),
    );

    expect(['decrease_load', 'reduce_reps']).toContain(recommendation.recommendationKind);
    expect(recommendation.reasonCodes).toContain('clear_underperformance');
    expect(recommendation.recommendationKind).not.toBe('increase_load');
  });

  it('blocks increase after multiple near-failure sets', () => {
    const recommendation = firstRecommendation(
      session({
        exercises: [exercise({ sets: [set({ id: 'work-1', reps: 10, rir: 0 }), set({ id: 'work-2', reps: 10, rir: 0 })] })],
      }),
    );

    expect(['repeat_next_time', 'deload']).toContain(recommendation.recommendationKind);
    expect(recommendation.riskFlags).toContain('near_failure');
    expect(recommendation.recommendationKind).not.toBe('increase_load');
    expect(recommendation.userMessage).toBe('接近力竭，下次不加重。');
  });

  it('returns a conservative recommendation when main work ended early', () => {
    const recommendation = firstRecommendation(
      session({
        earlyEndReason: 'incomplete_main_work',
        exercises: [
          exercise({
            completionStatus: 'partial',
            incompleteReason: 'ended_early',
            sets: [
              set({ id: 'work-1', reps: 8 }),
              set({ id: 'work-2', done: false, completionStatus: 'incomplete', incompleteReason: 'ended_early' }),
            ],
          }),
        ],
      }),
    );

    expect(['reduce_set', 'repeat_next_time']).toContain(recommendation.recommendationKind);
    expect(recommendation.reasonCodes).toContain('incomplete_main_work');
    expect(recommendation.userMessage).toBe('本次未完成，下次先补齐。');
  });

  it('uses actionable load instead of the raw below-bar baseline', () => {
    const recommendation = firstRecommendation(
      session({
        exercises: [
          exercise({
            id: 'bench-press',
            baseId: 'bench-press',
            canonicalExerciseId: 'bench-press',
            sets: [set({ id: 'work-1', weight: lbToKg(27), actualWeightKg: lbToKg(27), reps: 8 })],
          }),
        ],
      }),
    );

    expect(recommendation.recommendationKind).toBe('keep_load');
    expect(convertKgToDisplayWeight(recommendation.actionableLoadKg, 'lb')).toBe(45);
    expect(convertKgToDisplayWeight(lbToKg(27), 'lb')).toBe(27);
  });

  it('uses deterministic ids and timestamps', () => {
    const result = buildPostWorkoutNextTimeRecommendation({ session: session(), unitSettings, nowIso });
    const recommendation = result.recommendations[0];

    expect(result.id).toBe('post-workout-next-time:session-post-workout');
    expect(result.createdAt).toBe(nowIso);
    expect(result.sourceEngineIds).toEqual(['post-workout-next-time-recommendation-v1']);
    expect(recommendation.id).toBe('post-workout-next-time:session-post-workout:bench-press');
    expect(recommendation.createdAt).toBe(nowIso);
    expect(recommendation.sourceSessionId).toBe('session-post-workout');
  });

  it('keeps the pure engine free of UI, storage, API, node, and mutation imports', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/engines/postWorkoutNextTimeRecommendationEngine.ts'), 'utf8');
    const forbidden = [
      'React',
      '../features',
      '../ui',
      '../uiOs',
      '../storage',
      '/storage',
      'localStorage',
      'devApi',
      'apps/api',
      'node:',
      'fs',
      'path',
      'applyAdjustmentDraft',
      'upsertPlanAdjustmentDraftByFingerprint',
      'PendingSessionPatch',
      'ProgramAdjustmentDraft',
      'sessionPatchEngine',
    ];

    for (const token of forbidden) {
      expect(source).not.toContain(token);
    }
  });

  it('does not add post-workout recommendation persistence fields to AppData or TrainingSession', () => {
    const modelSource = readFileSync(resolve(process.cwd(), 'src/models/training-model.ts'), 'utf8');
    const storageSource = readFileSync(resolve(process.cwd(), 'src/storage/persistence.ts'), 'utf8');

    expect(modelSource).not.toContain('PostWorkoutNextTimeRecommendation');
    expect(modelSource).not.toContain('postWorkoutNextTimeRecommendation');
    expect(storageSource).not.toContain('postWorkoutNextTimeRecommendation');
    expect(storageSource).not.toContain('postWorkout');
  });

  it('keeps user-facing summary and messages free of forbidden technical wording', () => {
    const scenarios = [
      session({ exercises: [] }),
      session({ exercises: [exercise({ sets: [set({ reps: 10, painFlag: true })] })] }),
      session({ exercises: [exercise({ sets: [set({ reps: 10, techniqueQuality: 'poor' })] })] }),
      session({ exercises: [exercise({ sets: [set({ reps: 10 }), set({ id: 'work-2', reps: 10 })] })] }),
    ];

    const visibleText = scenarios
      .map((item) => buildPostWorkoutNextTimeRecommendation({ session: item, unitSettings, nowIso }))
      .flatMap((result) => [result.summary, ...result.recommendations.map((recommendation) => recommendation.userMessage)])
      .join('\n');

    for (const term of visibleForbiddenTerms) {
      expect(visibleText).not.toContain(term);
    }
  });
});
