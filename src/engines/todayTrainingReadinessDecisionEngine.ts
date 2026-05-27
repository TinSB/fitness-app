// todayTrainingReadinessDecisionEngine — signal-only after Training
// Recommendation Hard Rewrite V2. The legacy user-facing copy fields
// (title, summary, userMessage, suggestedActions) are deleted; the only
// remaining exports are enums (decisionKind, action, riskLevel),
// confidence, and structured reason codes consumed by the UI through
// TrainingDecision.userFacing.* or via the small label adapter in
// `src/uiOs/today/TodayReadinessDecisionSummary.tsx`.
//
// See docs/TRAINING_RECOMMENDATION_HARD_REWRITE_PLAN_V2.md §2.2.

import type { DailyTrainingAdjustment, DailyTrainingAdjustmentType } from './dailyTrainingAdjustmentEngine';
import type { RecoveryAwareRecommendation } from './recoveryAwareScheduler';
import type { TrainingDecisionContext } from './trainingDecisionContext';

export type TodayTrainingReadinessDecisionKind = 'normal' | 'conservative' | 'technique' | 'deload' | 'postpone';

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

/**
 * Signal-only decision shape. No `title`, no `summary`, no `userMessage`,
 * no `suggestedActions` text array. Downstream UI consumers must build the
 * display copy via TrainingDecision.userFacing.today or via a presenter.
 */
export interface TodayTrainingReadinessDecision {
  id: string;
  scope: 'today';
  decisionKind: TodayTrainingReadinessDecisionKind;
  action: TodayTrainingReadinessAction;
  confidence: TodayTrainingReadinessConfidence;
  riskLevel: TodayTrainingReadinessRiskLevel;
  reasonCodes: string[];
  riskFlags: string[];
  blockedReasons: string[];
  requiresConfirmation: boolean;
  sourceEngineIds: string[];
  createdAt: string;
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
  const codes = [
    ...(adjustment?.reasons || []),
    ...(adjustment?.suggestedChanges || []).map((change) => change.code || ''),
  ].join(' ');
  return /technique|too_heavy|load_feedback_risk/i.test(codes) || hasTooHeavyLoadFeedback(context);
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

type DecisionDraft = Omit<TodayTrainingReadinessDecision, 'id' | 'scope' | 'sourceEngineIds' | 'createdAt'>;

const withCommonFields = (
  draft: DecisionDraft,
  context: TrainingDecisionContext,
  createdAt: string,
): TodayTrainingReadinessDecision => ({
  id: `today-readiness:${context.currentDateLocalKey}:${draft.decisionKind}:${draft.action}`,
  scope: 'today',
  ...draft,
  sourceEngineIds: [SOURCE_ENGINE_ID],
  createdAt,
});

const normalDecision = (): DecisionDraft => ({
  decisionKind: 'normal',
  action: 'start_as_planned',
  confidence: 'high',
  riskLevel: 'low',
  reasonCodes: ['normal_readiness'],
  riskFlags: [],
  blockedReasons: [],
  requiresConfirmation: false,
});

export const buildTodayTrainingReadinessDecision = (input: TodayTrainingReadinessInput): TodayTrainingReadinessDecision => {
  const { context, todayAdjustment, recoveryRecommendation } = input;
  const createdAt = input.nowIso || FALLBACK_CREATED_AT;
  const activeSessionState = activeSessionStateFrom(input);

  if (activeSessionState === 'active') {
    return withCommonFields(
      {
        decisionKind: 'normal',
        action: 'continue_active_session',
        confidence: 'high',
        riskLevel: 'low',
        reasonCodes: ['active_session'],
        riskFlags: [],
        blockedReasons: [],
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
        confidence: 'high',
        riskLevel: 'low',
        reasonCodes: ['completed_today'],
        riskFlags: [],
        blockedReasons: [],
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
        confidence: 'high',
        riskLevel: 'high',
        reasonCodes: ['severe_data_health'],
        riskFlags: ['data_health'],
        blockedReasons: [],
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
        confidence: 'high',
        riskLevel: 'medium',
        reasonCodes: ['no_plan'],
        riskFlags: [],
        blockedReasons: ['no_plan'],
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
        confidence: confidenceFrom(context, todayAdjustment),
        riskLevel: 'high',
        reasonCodes: unique(['recovery_priority', ...(todayAdjustment?.type === 'rest_or_recovery' ? ['rest_or_recovery'] : [])]),
        riskFlags: ['recovery'],
        blockedReasons: [],
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
        confidence: confidenceFrom(context, todayAdjustment),
        riskLevel: 'medium',
        reasonCodes: ['deload_like'],
        riskFlags: ['fatigue'],
        blockedReasons: [],
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
        confidence: confidenceFrom(context, todayAdjustment),
        riskLevel: 'medium',
        reasonCodes: unique(['technique_signal', ...(hasTooHeavyLoadFeedback(context) ? ['load_feedback_too_heavy'] : [])]),
        riskFlags: ['technique'],
        blockedReasons: [],
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
        confidence: confidenceFrom(context, todayAdjustment),
        riskLevel: todayAdjustment?.type === 'substitute_risky_exercises' ? 'medium' : riskForReadiness(context),
        reasonCodes: unique([(todayAdjustment?.type as DailyTrainingAdjustmentType) || 'readiness_conservative']),
        riskFlags: todayAdjustment?.type === 'substitute_risky_exercises' ? ['risky_exercise'] : [],
        blockedReasons: [],
        requiresConfirmation: todayAdjustment?.requiresUserConfirmation ?? true,
      },
      context,
      createdAt,
    );
  }

  return withCommonFields(normalDecision(), context, createdAt);
};
