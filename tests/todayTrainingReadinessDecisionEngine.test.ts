import { describe, expect, it } from 'vitest';
import { classifyGuardedRecommendationApplySafety } from '../src/engines/guardedRecommendationContractEngine';
import type { DailyTrainingAdjustment } from '../src/engines/dailyTrainingAdjustmentEngine';
import type { RecoveryAwareRecommendation } from '../src/engines/recoveryAwareScheduler';
import { buildTodayTrainingReadinessDecision } from '../src/engines/todayTrainingReadinessDecisionEngine';
import { buildTrainingDecisionContext } from '../src/engines/trainingDecisionContext';
import type { ReadinessResult } from '../src/models/training-model';
import { getTemplate, makeAppData } from './fixtures';

const nowIso = '2026-05-20T12:00:00.000Z';

const normalReadiness: ReadinessResult = {
  score: 82,
  level: 'high',
  trainingAdjustment: 'normal',
  reasons: [],
};

const baseContext = (overrides: Parameters<typeof makeAppData>[0] = {}) =>
  buildTrainingDecisionContext(makeAppData(overrides), '2026-05-20', {
    readinessResult: normalReadiness,
    currentTrainingTemplate: getTemplate('push-a'),
    activeTemplate: getTemplate('push-a'),
  });

const adjustment = (overrides: Partial<DailyTrainingAdjustment>): DailyTrainingAdjustment => ({
  type: 'normal',
  title: '照常训练',
  summary: '按计划执行。',
  reasons: ['当前准备度正常。'],
  suggestedChanges: [],
  confidence: 'high',
  requiresUserConfirmation: false,
  ...overrides,
});

const recovery = (overrides: Partial<RecoveryAwareRecommendation>): RecoveryAwareRecommendation => ({
  kind: 'train',
  title: '今日建议',
  summary: '可以训练。',
  conflictLevel: 'none',
  affectedAreas: [],
  reasons: [],
  suggestedChanges: [],
  requiresConfirmationToOverride: false,
  ...overrides,
});

const visibleDecisionText = (decision: ReturnType<typeof buildTodayTrainingReadinessDecision>) =>
  [
    decision.title,
    decision.summary,
    decision.userMessage,
    ...decision.suggestedActions,
    decision.guardedRecommendation?.title,
    decision.guardedRecommendation?.summary,
    decision.guardedRecommendation?.userMessage,
    decision.guardedRecommendation?.preview.title,
    decision.guardedRecommendation?.preview.summary,
    decision.guardedRecommendation?.preview.after,
  ]
    .filter(Boolean)
    .join(' ');

describe('todayTrainingReadinessDecisionEngine', () => {
  it('returns a normal start-as-planned decision for a normal day', () => {
    const decision = buildTodayTrainingReadinessDecision({
      context: baseContext(),
      todayAdjustment: adjustment({ type: 'normal' }),
      activeSessionState: 'none',
      nowIso,
    });

    expect(decision).toMatchObject({
      id: 'today-readiness:2026-05-20:normal:start_as_planned',
      scope: 'today',
      decisionKind: 'normal',
      action: 'start_as_planned',
      title: '今天按计划',
      summary: '状态正常，按计划训练。',
      userMessage: '状态正常，按计划训练。',
      confidence: 'high',
      riskLevel: 'low',
      createdAt: nowIso,
    });
    expect(decision.requiresConfirmation).toBe(false);
    expect(decision.guardedRecommendation?.source).toBe('today_readiness');
    expect(decision.guardedRecommendation?.actionType).toBe('display_only');
  });

  it('returns continue_active_session when an active session exists', () => {
    const decision = buildTodayTrainingReadinessDecision({
      context: baseContext(),
      activeSessionState: 'active',
      nowIso,
    });

    expect(decision.decisionKind).toBe('normal');
    expect(decision.action).toBe('continue_active_session');
    expect(decision.title).toBe('继续训练');
    expect(decision.summary).toBe('当前有未完成训练，先继续记录。');
    expect(decision.confidence).toBe('high');
    expect(decision.guardedRecommendation?.actionType).toBe('display_only');
  });

  it('returns view_completed_session when today is already completed', () => {
    const decision = buildTodayTrainingReadinessDecision({
      context: baseContext(),
      activeSessionState: 'completed',
      nowIso,
    });

    expect(decision.decisionKind).toBe('conservative');
    expect(decision.action).toBe('view_completed_session');
    expect(decision.title).toBe('今日已完成');
    expect(decision.summary).toBe('今天已完成训练，下次建议仅供参考。');
    expect(decision.guardedRecommendation?.preview.durableEffect).toBe(false);
  });

  it('blocks start-as-planned when severe data health requires review first', () => {
    const decision = buildTodayTrainingReadinessDecision({
      context: baseContext(),
      severeDataHealthBlocker: true,
      nowIso,
    });

    expect(decision.decisionKind).toBe('postpone');
    expect(decision.action).toBe('review_first');
    expect(decision.riskLevel).toBe('high');
    expect(decision.requiresConfirmation).toBe(true);
    expect(decision.reasonCodes).toContain('severe_data_health');
    expect(decision.userMessage).toBe('先查看数据，再决定。');
    expect(decision.action).not.toBe('start_as_planned');
  });

  it('returns no_plan_available when there is no executable plan', () => {
    const context = buildTrainingDecisionContext(makeAppData({ templates: [], selectedTemplateId: '' }), '2026-05-20', {
      readinessResult: normalReadiness,
      currentTrainingTemplate: undefined,
      activeTemplate: undefined,
      templates: [],
      selectedTemplateId: '',
    });

    const decision = buildTodayTrainingReadinessDecision({ context, nowIso });

    expect(decision.decisionKind).toBe('postpone');
    expect(decision.action).toBe('no_plan_available');
    expect(decision.blockedReasons).toContain('no_plan');
    expect(decision.userMessage).toBe('先检查训练安排。');
  });

  it('maps rest or recovery signals to a high-risk review decision', () => {
    const decision = buildTodayTrainingReadinessDecision({
      context: baseContext(),
      todayAdjustment: adjustment({ type: 'rest_or_recovery', requiresUserConfirmation: true, confidence: 'medium' }),
      recoveryRecommendation: recovery({ kind: 'rest', requiresConfirmationToOverride: true }),
      nowIso,
    });

    expect(decision.decisionKind).toBe('postpone');
    expect(decision.action).toBe('postpone_training');
    expect(decision.riskLevel).toBe('high');
    expect(decision.requiresConfirmation).toBe(true);
    expect(decision.userMessage).toBe('恢复优先，今天不硬练。');
  });

  it('maps deload-like adjustment to a deload decision', () => {
    const decision = buildTodayTrainingReadinessDecision({
      context: baseContext(),
      todayAdjustment: adjustment({ type: 'deload_like', confidence: 'medium', requiresUserConfirmation: true }),
      nowIso,
    });

    expect(decision.decisionKind).toBe('deload');
    expect(decision.action).toBe('reduce_load_or_volume');
    expect(decision.userMessage).toBe('今天降量，保留动作质量。');
  });

  it('maps conservative adjustment to concise conservative actions', () => {
    const decision = buildTodayTrainingReadinessDecision({
      context: baseContext(),
      todayAdjustment: adjustment({ type: 'conservative', confidence: 'medium', requiresUserConfirmation: true }),
      nowIso,
    });

    expect(decision.decisionKind).toBe('conservative');
    expect(decision.action).toBe('train_conservative');
    expect(decision.userMessage).toBe('今天保守训练。');
    expect(decision.suggestedActions).toContain('不主动加量');
    expect(decision.guardedRecommendation?.actionType).toBe('open_review');
  });

  it('maps reduce-support and main-only adjustment to conservative actions', () => {
    const reduceSupport = buildTodayTrainingReadinessDecision({
      context: baseContext(),
      todayAdjustment: adjustment({
        type: 'reduce_support',
        suggestedChanges: [{ type: 'reduce_support', reason: '减少辅助。' }],
        requiresUserConfirmation: true,
      }),
      nowIso,
    });
    const mainOnly = buildTodayTrainingReadinessDecision({
      context: baseContext(),
      todayAdjustment: adjustment({
        type: 'main_only',
        suggestedChanges: [{ type: 'keep_main_lifts', reason: '保留主训练。' }],
        requiresUserConfirmation: true,
      }),
      nowIso,
    });

    expect(reduceSupport.decisionKind).toBe('conservative');
    expect(reduceSupport.suggestedActions).toContain('减少辅助');
    expect(mainOnly.decisionKind).toBe('conservative');
    expect(mainOnly.suggestedActions).toContain('保留主训练');
  });

  it('maps risky substitution to review-required conservative or technique decision', () => {
    const decision = buildTodayTrainingReadinessDecision({
      context: baseContext(),
      todayAdjustment: adjustment({
        type: 'substitute_risky_exercises',
        suggestedChanges: [{ type: 'substitute_exercise', targetId: 'bench-press', reason: '不适风险。' }],
        requiresUserConfirmation: true,
      }),
      nowIso,
    });

    expect(['conservative', 'technique']).toContain(decision.decisionKind);
    expect(decision.requiresConfirmation).toBe(true);
    expect(decision.suggestedActions).toContain('查看替代动作');
  });

  it('maps too-heavy load feedback and technique signals to technique focus', () => {
    const context = buildTrainingDecisionContext(makeAppData(), '2026-05-20', {
      readinessResult: normalReadiness,
      currentTrainingTemplate: getTemplate('push-a'),
      activeTemplate: getTemplate('push-a'),
      loadFeedbackSummary: [
        {
          exerciseId: 'bench-press',
          total: 3,
          counts: { too_light: 0, good: 0, too_heavy: 3 },
          dominantFeedback: 'too_heavy',
          adjustment: { direction: 'conservative', dominantFeedback: 'too_heavy', reasons: ['近期重量反馈偏重。'] },
        },
      ],
    });
    const decision = buildTodayTrainingReadinessDecision({
      context,
      todayAdjustment: adjustment({
        type: 'conservative',
        reasons: ['动作质量需要优先。'],
        suggestedChanges: [{ type: 'reduce_volume', reason: '动作质量优先。' }],
        requiresUserConfirmation: true,
      }),
      nowIso,
    });

    expect(decision.decisionKind).toBe('technique');
    expect(decision.action).toBe('technique_focus');
    expect(decision.userMessage).toBe('今天先稳住动作。');
  });

  it('uses readiness recovery and conservative scores when adjustment input is absent', () => {
    const recoveryDecision = buildTodayTrainingReadinessDecision({
      context: buildTrainingDecisionContext(makeAppData(), '2026-05-20', {
        readinessResult: { score: 38, level: 'low', trainingAdjustment: 'recovery', reasons: ['精力低'] },
        currentTrainingTemplate: getTemplate('legs-a'),
        activeTemplate: getTemplate('legs-a'),
      }),
      nowIso,
    });
    const conservativeDecision = buildTodayTrainingReadinessDecision({
      context: buildTrainingDecisionContext(makeAppData(), '2026-05-20', {
        readinessResult: { score: 58, level: 'medium', trainingAdjustment: 'conservative', reasons: ['睡眠少'] },
        currentTrainingTemplate: getTemplate('push-a'),
        activeTemplate: getTemplate('push-a'),
      }),
      nowIso,
    });

    expect(recoveryDecision.riskLevel).toBe('high');
    expect(recoveryDecision.decisionKind).toBe('postpone');
    expect(conservativeDecision.riskLevel).toBe('medium');
    expect(conservativeDecision.decisionKind).toBe('conservative');
  });

  it('creates a non-durable guarded recommendation that cannot apply durably', () => {
    const decision = buildTodayTrainingReadinessDecision({
      context: baseContext(),
      todayAdjustment: adjustment({ type: 'conservative', requiresUserConfirmation: true }),
      nowIso,
    });

    expect(decision.guardedRecommendation).toMatchObject({
      source: 'today_readiness',
      scope: 'today',
      actionType: 'open_review',
      preview: {
        summary: '只影响本次，不改变计划',
        durableEffect: false,
      },
    });
    expect(classifyGuardedRecommendationApplySafety(decision.guardedRecommendation!).canApplyDurably).toBe(false);
  });

  it('does not create patch or plan draft shaped objects', () => {
    const decision = buildTodayTrainingReadinessDecision({
      context: baseContext(),
      todayAdjustment: adjustment({ type: 'conservative', requiresUserConfirmation: true }),
      nowIso,
    });
    const text = JSON.stringify(decision);

    expect(text).not.toContain('PendingSessionPatch');
    expect(text).not.toContain('ProgramAdjustmentDraft');
    expect(text).not.toContain('patches');
    expect(text).not.toContain('changes');
  });

  it('does not mutate input objects', () => {
    const context = baseContext();
    const todayAdjustment = adjustment({ type: 'reduce_support', requiresUserConfirmation: true });
    const recoveryRecommendation = recovery({ kind: 'modified_train', requiresConfirmationToOverride: true });
    const before = JSON.stringify({ context, todayAdjustment, recoveryRecommendation });

    buildTodayTrainingReadinessDecision({
      context,
      todayAdjustment,
      recoveryRecommendation,
      nowIso,
    });

    expect(JSON.stringify({ context, todayAdjustment, recoveryRecommendation })).toBe(before);
  });

  it('keeps user-facing strings free of technical wording', () => {
    const decisions = [
      buildTodayTrainingReadinessDecision({ context: baseContext(), todayAdjustment: adjustment({ type: 'normal' }), nowIso }),
      buildTodayTrainingReadinessDecision({ context: baseContext(), todayAdjustment: adjustment({ type: 'conservative', requiresUserConfirmation: true }), nowIso }),
      buildTodayTrainingReadinessDecision({ context: baseContext(), severeDataHealthBlocker: true, nowIso }),
      buildTodayTrainingReadinessDecision({ context: baseContext(), todayAdjustment: adjustment({ type: 'deload_like', requiresUserConfirmation: true }), nowIso }),
    ];
    const visibleText = decisions.map(visibleDecisionText).join(' ');

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
      '智能判断',
      '系统建议',
      '算法推荐',
      '引擎判断',
      'AI 建议',
      '自动安排',
      '自动调整',
    ]) {
      expect(visibleText).not.toContain(forbidden);
    }
  });
});
