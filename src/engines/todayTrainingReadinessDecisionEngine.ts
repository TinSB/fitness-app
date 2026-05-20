import {
  buildGuardedRecommendationContract,
  type GuardedRecommendationActionType,
  type GuardedRecommendationContract,
  type GuardedRecommendationRiskLevel,
} from './guardedRecommendationContractEngine';
import type { DailyTrainingAdjustment, DailyTrainingAdjustmentType } from './dailyTrainingAdjustmentEngine';
import type { RecoveryAwareRecommendation } from './recoveryAwareScheduler';
import type { TrainingDecisionContext } from './trainingDecisionContext';

export type TodayTrainingReadinessDecisionKind = 'normal' | 'conservative' | 'technique' | 'deload' | 'postpone';

export type TodayTrainingReadinessDecisionScope = 'today';

export type TodayTrainingReadinessConfidence = 'low' | 'medium' | 'high';

export type TodayTrainingReadinessRiskLevel = 'low' | 'medium' | 'high';

export type TodayTrainingReadinessAction =
  | 'start_as_planned'
  | 'train_conservative'
  | 'technique_focus'
  | 'reduce_load_or_volume'
  | 'postpone_training'
  | 'review_first'
  | 'continue_active_session'
  | 'view_completed_session'
  | 'no_plan_available';

export interface TodayTrainingReadinessInput {
  context: TrainingDecisionContext;
  todayAdjustment?: DailyTrainingAdjustment;
  recoveryRecommendation?: RecoveryAwareRecommendation;
  activeSessionState?: 'none' | 'active' | 'completed';
  severeDataHealthBlocker?: boolean;
  nowIso?: string;
}

export interface TodayTrainingReadinessDecision {
  id: string;
  scope: 'today';
  decisionKind: TodayTrainingReadinessDecisionKind;
  action: TodayTrainingReadinessAction;
  title: string;
  summary: string;
  userMessage: string;
  confidence: TodayTrainingReadinessConfidence;
  riskLevel: TodayTrainingReadinessRiskLevel;
  reasonCodes: string[];
  riskFlags: string[];
  blockedReasons: string[];
  suggestedActions: string[];
  requiresConfirmation: boolean;
  sourceEngineIds: string[];
  createdAt: string;
  guardedRecommendation?: GuardedRecommendationContract;
}

const SOURCE_ENGINE_ID = 'today-training-readiness-decision-v1';
const FALLBACK_CREATED_AT = '1970-01-01T00:00:00.000Z';

const unique = (items: readonly string[]) => [...new Set(items.filter(Boolean))];

const activeSessionStateFrom = (input: TodayTrainingReadinessInput) => {
  if (input.activeSessionState) return input.activeSessionState;
  return input.context.activeSession && input.context.activeSession.completed !== true ? 'active' : 'none';
};

const hasExecutablePlan = (context: TrainingDecisionContext) => {
  if (context.currentTrainingTemplate || context.activeTemplate) return true;
  if (!context.selectedTemplateId) return false;
  return context.templates.some((template) => template.id === context.selectedTemplateId);
};

const recoveryKind = (recommendation?: RecoveryAwareRecommendation) => recommendation?.kind;

const isRecoveryRecommendation = (recommendation?: RecoveryAwareRecommendation) =>
  recoveryKind(recommendation) === 'rest' ||
  recoveryKind(recommendation) === 'active_recovery' ||
  recoveryKind(recommendation) === 'mobility_only';

const hasTooHeavyLoadFeedback = (context: TrainingDecisionContext) =>
  context.loadFeedbackSummary.some(
    (summary) =>
      summary.dominantFeedback === 'too_heavy' ||
      summary.adjustment.direction === 'conservative' ||
      summary.counts.too_heavy >= 2,
  );

const hasTechniqueSignal = (context: TrainingDecisionContext, adjustment?: DailyTrainingAdjustment) => {
  const text = [
    ...(adjustment?.reasons || []),
    ...(adjustment?.suggestedChanges || []).map((change) => change.reason),
    ...(context.readinessResult.reasons || []),
  ].join(' ');

  return /technique|poor movement|动作质量|动作|偏重|too heavy|too_heavy/i.test(text) || hasTooHeavyLoadFeedback(context);
};

const confidenceFrom = (
  context: TrainingDecisionContext,
  adjustment?: DailyTrainingAdjustment,
): TodayTrainingReadinessConfidence => {
  if (adjustment?.confidence) return adjustment.confidence;
  if (context.readinessResult.level === 'low') return 'low';
  if (context.readinessResult.level === 'medium') return 'medium';
  return 'high';
};

const riskForReadiness = (context: TrainingDecisionContext): TodayTrainingReadinessRiskLevel => {
  if (context.readinessResult.trainingAdjustment === 'recovery' || context.readinessResult.score < 45) return 'high';
  if (context.readinessResult.trainingAdjustment === 'conservative' || context.readinessResult.score < 65) return 'medium';
  return 'low';
};

const conservativeActions = (type?: DailyTrainingAdjustmentType, adjustment?: DailyTrainingAdjustment) => {
  const actions = ['不主动加量', '保留主训练'];
  const changeTypes = new Set((adjustment?.suggestedChanges || []).map((change) => change.type));

  if (type === 'reduce_support' || type === 'main_only' || changeTypes.has('reduce_support') || changeTypes.has('skip_optional')) {
    actions.push('减少辅助');
  }
  if (type === 'substitute_risky_exercises' || changeTypes.has('substitute_exercise')) {
    actions.push('查看替代动作');
  }

  return unique(actions);
};

type DecisionDraft = Omit<TodayTrainingReadinessDecision, 'id' | 'scope' | 'sourceEngineIds' | 'createdAt' | 'guardedRecommendation'>;

const withCommonFields = (draft: DecisionDraft, context: TrainingDecisionContext, createdAt: string): TodayTrainingReadinessDecision => {
  const decision: TodayTrainingReadinessDecision = {
    id: `today-readiness:${context.currentDateLocalKey}:${draft.decisionKind}:${draft.action}`,
    scope: 'today',
    ...draft,
    sourceEngineIds: [SOURCE_ENGINE_ID],
    createdAt,
  };

  return {
    ...decision,
    guardedRecommendation: normalizeTodayReadinessDecisionToGuardedRecommendation(decision),
  };
};

const normalDecision = (): DecisionDraft => ({
  decisionKind: 'normal',
  action: 'start_as_planned',
  title: '今天按计划',
  summary: '状态正常，按计划训练。',
  userMessage: '状态正常，按计划训练。',
  confidence: 'high',
  riskLevel: 'low',
  reasonCodes: ['normal_readiness'],
  riskFlags: [],
  blockedReasons: [],
  suggestedActions: [],
  requiresConfirmation: false,
});

const actionTypeForDecision = (decision: TodayTrainingReadinessDecision): GuardedRecommendationActionType =>
  decision.decisionKind === 'normal' || decision.action === 'view_completed_session' ? 'display_only' : 'open_review';

const guardedRiskLevelFor = (riskLevel: TodayTrainingReadinessRiskLevel): GuardedRecommendationRiskLevel => riskLevel;

export const normalizeTodayReadinessDecisionToGuardedRecommendation = (
  decision: TodayTrainingReadinessDecision,
): GuardedRecommendationContract => {
  const actionType = actionTypeForDecision(decision);
  const requiresReview = actionType === 'open_review' || decision.requiresConfirmation;

  return buildGuardedRecommendationContract({
    source: 'today_readiness',
    scope: 'today',
    level: 1,
    actionType,
    status: 'candidate',
    title: decision.title,
    summary: decision.summary,
    userMessage: decision.userMessage,
    target: {
      sourceRecommendationId: decision.id,
    },
    confidence: decision.confidence,
    riskLevel: guardedRiskLevelFor(decision.riskLevel),
    reasonCodes: decision.reasonCodes,
    riskFlags: decision.riskFlags,
    blockedReasons: decision.blockedReasons,
    requiresConfirmation: decision.requiresConfirmation,
    confirmationLevel: requiresReview ? 'review_required' : 'none',
    sourceEngineIds: decision.sourceEngineIds,
    createdAt: decision.createdAt,
    preview: {
      title: decision.title,
      summary: '只影响本次，不改变计划',
      after: decision.userMessage,
      affectedAreas: ['今日'],
      reversible: true,
      durableEffect: false,
    },
  });
};

export const buildTodayTrainingReadinessDecision = (input: TodayTrainingReadinessInput): TodayTrainingReadinessDecision => {
  const { context, todayAdjustment, recoveryRecommendation } = input;
  const createdAt = input.nowIso || FALLBACK_CREATED_AT;
  const activeSessionState = activeSessionStateFrom(input);

  if (activeSessionState === 'active') {
    return withCommonFields(
      {
        decisionKind: 'normal',
        action: 'continue_active_session',
        title: '继续训练',
        summary: '当前有未完成训练，先继续记录。',
        userMessage: '当前有未完成训练，先继续记录。',
        confidence: 'high',
        riskLevel: 'low',
        reasonCodes: ['active_session'],
        riskFlags: [],
        blockedReasons: [],
        suggestedActions: [],
        requiresConfirmation: false,
      },
      context,
      createdAt,
    );
  }

  if (activeSessionState === 'completed') {
    return withCommonFields(
      {
        decisionKind: 'conservative',
        action: 'view_completed_session',
        title: '今日已完成',
        summary: '今天已完成训练，下次建议仅供参考。',
        userMessage: '今天已完成训练，下次建议仅供参考。',
        confidence: 'high',
        riskLevel: 'low',
        reasonCodes: ['completed_today'],
        riskFlags: [],
        blockedReasons: [],
        suggestedActions: [],
        requiresConfirmation: false,
      },
      context,
      createdAt,
    );
  }

  if (input.severeDataHealthBlocker) {
    return withCommonFields(
      {
        decisionKind: 'postpone',
        action: 'review_first',
        title: '先查看数据',
        summary: '先查看数据，再决定。',
        userMessage: '先查看数据，再决定。',
        confidence: 'high',
        riskLevel: 'high',
        reasonCodes: ['severe_data_health'],
        riskFlags: ['data_health'],
        blockedReasons: [],
        suggestedActions: ['查看后再决定'],
        requiresConfirmation: true,
      },
      context,
      createdAt,
    );
  }

  if (!hasExecutablePlan(context)) {
    return withCommonFields(
      {
        decisionKind: 'postpone',
        action: 'no_plan_available',
        title: '先检查训练安排',
        summary: '先检查训练安排。',
        userMessage: '先检查训练安排。',
        confidence: 'high',
        riskLevel: 'medium',
        reasonCodes: ['no_plan'],
        riskFlags: [],
        blockedReasons: ['no_plan'],
        suggestedActions: ['查看后再决定'],
        requiresConfirmation: true,
      },
      context,
      createdAt,
    );
  }

  if (todayAdjustment?.type === 'rest_or_recovery' || isRecoveryRecommendation(recoveryRecommendation) || riskForReadiness(context) === 'high') {
    return withCommonFields(
      {
        decisionKind: 'postpone',
        action: 'postpone_training',
        title: '恢复优先',
        summary: '恢复优先，今天不硬练。',
        userMessage: '恢复优先，今天不硬练。',
        confidence: confidenceFrom(context, todayAdjustment),
        riskLevel: 'high',
        reasonCodes: unique(['recovery_priority', ...(todayAdjustment?.type === 'rest_or_recovery' ? ['rest_or_recovery'] : [])]),
        riskFlags: ['recovery'],
        blockedReasons: [],
        suggestedActions: ['查看后再决定'],
        requiresConfirmation: true,
      },
      context,
      createdAt,
    );
  }

  if (todayAdjustment?.type === 'deload_like') {
    return withCommonFields(
      {
        decisionKind: 'deload',
        action: 'reduce_load_or_volume',
        title: '今天降量',
        summary: '今天降量，保留动作质量。',
        userMessage: '今天降量，保留动作质量。',
        confidence: confidenceFrom(context, todayAdjustment),
        riskLevel: 'medium',
        reasonCodes: ['deload_like'],
        riskFlags: ['fatigue'],
        blockedReasons: [],
        suggestedActions: ['不主动加量', '保留主训练', '减少辅助'],
        requiresConfirmation: true,
      },
      context,
      createdAt,
    );
  }

  if (hasTechniqueSignal(context, todayAdjustment)) {
    return withCommonFields(
      {
        decisionKind: 'technique',
        action: 'technique_focus',
        title: '今天先稳住动作',
        summary: '今天先稳住动作。',
        userMessage: '今天先稳住动作。',
        confidence: confidenceFrom(context, todayAdjustment),
        riskLevel: 'medium',
        reasonCodes: unique(['technique_signal', ...(hasTooHeavyLoadFeedback(context) ? ['load_feedback_too_heavy'] : [])]),
        riskFlags: ['technique'],
        blockedReasons: [],
        suggestedActions: ['不主动加量', '保留主训练'],
        requiresConfirmation: true,
      },
      context,
      createdAt,
    );
  }

  if (
    todayAdjustment?.type === 'conservative' ||
    todayAdjustment?.type === 'reduce_support' ||
    todayAdjustment?.type === 'main_only' ||
    todayAdjustment?.type === 'substitute_risky_exercises' ||
    riskForReadiness(context) === 'medium'
  ) {
    return withCommonFields(
      {
        decisionKind: 'conservative',
        action: 'train_conservative',
        title: '今天保守训练',
        summary: '今天保守训练。',
        userMessage: '今天保守训练。',
        confidence: confidenceFrom(context, todayAdjustment),
        riskLevel: todayAdjustment?.type === 'substitute_risky_exercises' ? 'medium' : riskForReadiness(context),
        reasonCodes: unique([todayAdjustment?.type || 'readiness_conservative']),
        riskFlags: todayAdjustment?.type === 'substitute_risky_exercises' ? ['risky_exercise'] : [],
        blockedReasons: [],
        suggestedActions: conservativeActions(todayAdjustment?.type, todayAdjustment),
        requiresConfirmation: todayAdjustment?.requiresUserConfirmation ?? true,
      },
      context,
      createdAt,
    );
  }

  return withCommonFields(normalDecision(), context, createdAt);
};
