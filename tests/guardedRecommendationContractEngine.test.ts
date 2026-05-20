import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { FocusNextSetRecommendation } from '../src/engines/focusNextSetRecommendationEngine';
import type { PostWorkoutNextTimeRecommendation } from '../src/engines/postWorkoutNextTimeRecommendationEngine';
import {
  GUARDED_RECOMMENDATION_LEVELS,
  buildGuardedRecommendationContract,
  buildGuardedRecommendationFingerprint,
  buildGuardedRecommendationPreview,
  classifyGuardedRecommendationApplySafety,
  normalizeFocusNextSetRecommendation,
  normalizePostWorkoutNextTimeRecommendation,
  resolveGuardedRecommendationState,
} from '../src/engines/guardedRecommendationContractEngine';

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

const focusSafeRecommendation: FocusNextSetRecommendation = {
  id: 'focus-next-set:set-1->set-2:increase_load',
  scope: 'set',
  level: 2,
  recommendationKind: 'increase_load',
  targetExerciseId: 'bench',
  targetSetId: 'bench-set-2',
  actionableLoadKg: 63.5,
  plannedReps: 8,
  confidence: 'high',
  reasonCodes: ['reps_above_plan'],
  userMessage: '下一组小幅加重。',
  riskFlags: [],
  requiresConfirmation: false,
  blockedReasons: [],
  sourceEngineIds: ['focus-next-set-recommendation-v1'],
  createdAt: '2026-05-20T10:00:00.000Z',
};

const focusRiskRecommendation: FocusNextSetRecommendation = {
  ...focusSafeRecommendation,
  id: 'focus-next-set:set-1->set-2:stop_exercise',
  level: 1,
  recommendationKind: 'stop_exercise',
  actionableLoadKg: undefined,
  plannedReps: undefined,
  confidence: 'high',
  reasonCodes: ['pain_flag'],
  userMessage: '已标记不适，先停止。',
  riskFlags: ['pain'],
  requiresConfirmation: true,
};

const postWorkoutRecommendation: PostWorkoutNextTimeRecommendation = {
  id: 'post-workout-next-time:session-1',
  scope: 'session',
  sourceSessionId: 'session-1',
  recommendations: [
    {
      id: 'post-workout-next-time:session-1:bench',
      scope: 'exercise',
      exerciseId: 'bench',
      exerciseName: '卧推',
      recommendationKind: 'increase_load',
      actionableLoadKg: 63.5,
      plannedReps: 8,
      confidence: 'high',
      reasonCodes: ['strong_completion'],
      riskFlags: [],
      blockedReasons: [],
      userMessage: '完成稳定，下次小幅加重。',
      sourceSessionId: 'session-1',
      createdAt: '2026-05-20T10:00:00.000Z',
    },
  ],
  summary: '下次建议：小幅推进。',
  confidence: 'high',
  blockedReasons: [],
  sourceEngineIds: ['post-workout-next-time-recommendation-v1'],
  createdAt: '2026-05-20T10:00:00.000Z',
};

describe('guarded recommendation contract engine', () => {
  it('builds stable fingerprints and changes when source, target, or action changes', () => {
    const base = {
      source: 'focus_next_set' as const,
      scope: 'current_set' as const,
      actionType: 'prefill_current_set' as const,
      target: { sessionId: 'session-1', exerciseId: 'bench', setId: 'set-2' },
      sourceRecommendationId: 'source-1',
      sourceEngineIds: ['b', 'a'],
      reasonCodes: ['second', 'first'],
      durableEffect: false,
    };

    expect(buildGuardedRecommendationFingerprint(base)).toBe(
      buildGuardedRecommendationFingerprint({
        ...base,
        sourceEngineIds: ['a', 'b'],
        reasonCodes: ['first', 'second'],
        target: { setId: 'set-2', exerciseId: 'bench', sessionId: 'session-1' },
      }),
    );
    expect(buildGuardedRecommendationFingerprint(base)).not.toBe(
      buildGuardedRecommendationFingerprint({ ...base, source: 'post_workout_next_time' }),
    );
    expect(buildGuardedRecommendationFingerprint(base)).not.toBe(
      buildGuardedRecommendationFingerprint({ ...base, actionType: 'open_review' }),
    );
    expect(buildGuardedRecommendationFingerprint(base)).not.toBe(
      buildGuardedRecommendationFingerprint({ ...base, target: { ...base.target, setId: 'set-3' } }),
    );
  });

  it('maps safe Focus Level 2 recommendations to current-set prefill only', () => {
    const contract = normalizeFocusNextSetRecommendation({
      recommendation: focusSafeRecommendation,
      nowIso: '2026-05-20T12:00:00.000Z',
    });

    expect(contract.source).toBe('focus_next_set');
    expect(contract.scope).toBe('current_set');
    expect(contract.actionType).toBe('prefill_current_set');
    expect(contract.level).toBe(2);
    expect(contract.target).toMatchObject({ exerciseId: 'bench', setId: 'bench-set-2' });
    expect(contract.preview.durableEffect).toBe(false);
    expect(contract.createdAt).toBe('2026-05-20T12:00:00.000Z');

    const safety = classifyGuardedRecommendationApplySafety(contract);
    expect(safety.canDisplay).toBe(true);
    expect(safety.canPrefill).toBe(true);
    expect(safety.canApplyDurably).toBe(false);
  });

  it('maps risk Focus recommendations to review-only behavior that cannot prefill', () => {
    const contract = normalizeFocusNextSetRecommendation({ recommendation: focusRiskRecommendation });

    expect(contract.actionType).toBe('open_review');
    expect(contract.level).toBe(1);
    expect(contract.riskLevel).toBe('high');
    expect(contract.confirmationLevel).toBe('review_required');
    expect(classifyGuardedRecommendationApplySafety(contract)).toMatchObject({
      canPrefill: false,
      canApplyDurably: false,
      requiresReview: true,
    });
  });

  it('maps post-workout recommendations to display-only by default', () => {
    const contracts = normalizePostWorkoutNextTimeRecommendation({ recommendation: postWorkoutRecommendation });

    expect(contracts).toHaveLength(1);
    expect(contracts[0]).toMatchObject({
      source: 'post_workout_next_time',
      scope: 'next_session',
      actionType: 'display_only',
      status: 'candidate',
      level: 1,
      confirmationLevel: 'none',
    });
    expect(contracts[0].preview.durableEffect).toBe(false);
    expect(classifyGuardedRecommendationApplySafety(contracts[0]).canQueue).toBe(false);
  });

  it('only creates post-workout plan-adjustment candidates when explicitly requested', () => {
    expect(
      normalizePostWorkoutNextTimeRecommendation({
        recommendation: postWorkoutRecommendation,
      }).some((contract) => contract.actionType === 'queue_plan_adjustment'),
    ).toBe(false);

    const [contract] = normalizePostWorkoutNextTimeRecommendation({
      recommendation: postWorkoutRecommendation,
      allowPlanAdjustmentCandidate: true,
      nowIso: '2026-05-20T12:00:00.000Z',
    });

    expect(contract.actionType).toBe('queue_plan_adjustment');
    expect(contract.level).toBe(4);
    expect(contract.status).toBe('pending_review');
    expect(contract.confirmationLevel).toBe('review_required');
    expect(contract.preview.durableEffect).toBe(true);
    expect(classifyGuardedRecommendationApplySafety(contract)).toMatchObject({
      canQueue: true,
      canApplyDurably: false,
      requiresReview: true,
    });
  });

  it('keeps session queues and all other contracts unable to apply durably in 18G', () => {
    const contract = buildGuardedRecommendationContract({
      source: 'today_readiness',
      scope: 'current_session',
      level: 3,
      actionType: 'queue_session_adjustment',
      status: 'pending_review',
      title: '待确认',
      summary: '查看后再决定',
      userMessage: '只影响本次。',
      target: { sessionId: 'session-1' },
      confidence: 'medium',
      riskLevel: 'medium',
      reasonCodes: ['fatigue'],
      riskFlags: [],
      blockedReasons: [],
      requiresConfirmation: true,
      confirmationLevel: 'confirm_dialog',
      sourceEngineIds: ['today-readiness-v1'],
      nowIso: '2026-05-20T12:00:00.000Z',
      preview: {
        title: '待确认',
        summary: '只影响本次，不改变计划',
        affectedAreas: ['本次训练'],
        reversible: true,
        durableEffect: false,
      },
    });

    expect(classifyGuardedRecommendationApplySafety(contract)).toMatchObject({
      canQueue: true,
      canApplyDurably: false,
    });

    for (const actionType of ['display_only', 'prefill_current_set', 'queue_plan_adjustment', 'open_review'] as const) {
      const next = buildGuardedRecommendationContract({ ...contract, actionType });
      expect(classifyGuardedRecommendationApplySafety(next).canApplyDurably).toBe(false);
    }
  });

  it('resolves expired, dismissed, consumed, and missing-target states without mutating the contract', () => {
    const contract = normalizeFocusNextSetRecommendation({ recommendation: focusSafeRecommendation });

    expect(resolveGuardedRecommendationState({ contract, currentDate: '2026-05-21T00:00:00.000Z', matchingTargetAvailable: false })).toMatchObject({
      status: 'blocked',
      blockedReasons: ['missing_target'],
    });
    expect(resolveGuardedRecommendationState({ contract: { ...contract, expiresAt: '2026-05-19T00:00:00.000Z' }, currentDate: '2026-05-20T00:00:00.000Z' }).status).toBe('expired');
    expect(resolveGuardedRecommendationState({ contract, dismissedFingerprints: [contract.sourceFingerprint] }).status).toBe('dismissed');
    expect(resolveGuardedRecommendationState({ contract, consumedFingerprints: [contract.sourceFingerprint] }).status).toBe('consumed');
    expect(contract.status).toBe('candidate');
  });

  it('does not accept Level 5 as a runtime contract level', () => {
    expect(GUARDED_RECOMMENDATION_LEVELS).toEqual([1, 2, 3, 4]);
    expect(GUARDED_RECOMMENDATION_LEVELS).not.toContain(5);
  });

  it('builds clean reversible previews for non-durable contracts', () => {
    const contract = normalizeFocusNextSetRecommendation({ recommendation: focusSafeRecommendation });
    const preview = buildGuardedRecommendationPreview(contract);

    expect(preview.summary).toContain('不改变计划');
    expect(preview.reversible).toBe(true);
    expect(preview.durableEffect).toBe(false);
  });

  it('keeps user-facing output strings free of forbidden technical wording', () => {
    const contracts = [
      normalizeFocusNextSetRecommendation({ recommendation: focusSafeRecommendation }),
      normalizeFocusNextSetRecommendation({ recommendation: focusRiskRecommendation }),
      ...normalizePostWorkoutNextTimeRecommendation({ recommendation: postWorkoutRecommendation }),
      ...normalizePostWorkoutNextTimeRecommendation({ recommendation: postWorkoutRecommendation, allowPlanAdjustmentCandidate: true }),
    ];
    const visibleText = contracts
      .flatMap((contract) => [
        contract.title,
        contract.summary,
        contract.userMessage,
        contract.preview.title,
        contract.preview.summary,
        contract.preview.before,
        contract.preview.after,
      ])
      .join(' ');

    for (const forbidden of [
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
      '应用到计划',
      '自动套用',
      '智能建议',
      '系统建议',
      '算法推荐',
      '引擎建议',
    ]) {
      expect(visibleText).not.toContain(forbidden);
    }
  });

  it('does not mutate source recommendation inputs', () => {
    const focusBefore = JSON.stringify(focusSafeRecommendation);
    const postBefore = JSON.stringify(postWorkoutRecommendation);

    normalizeFocusNextSetRecommendation({ recommendation: focusSafeRecommendation });
    normalizePostWorkoutNextTimeRecommendation({ recommendation: postWorkoutRecommendation, allowPlanAdjustmentCandidate: true });

    expect(JSON.stringify(focusSafeRecommendation)).toBe(focusBefore);
    expect(JSON.stringify(postWorkoutRecommendation)).toBe(postBefore);
  });

  it('keeps the contract engine isolated from UI, storage, API, and mutation helpers', () => {
    const source = read('src/engines/guardedRecommendationContractEngine.ts');

    for (const forbidden of [
      'react',
      '../ui',
      '../uiOs',
      '../storage',
      '/storage',
      'localStorage',
      'devApi',
      'apps/api',
      'node:',
      'applySessionPatches',
      'upsertPendingSessionPatch',
      'upsertPlanAdjustmentDraftByFingerprint',
      'ProgramAdjustmentDraft',
      'PendingSessionPatch',
      'fetch(',
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });
});
