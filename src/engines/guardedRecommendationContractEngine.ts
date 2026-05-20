import type { FocusNextSetRecommendation } from './focusNextSetRecommendationEngine';
import type {
  PostWorkoutExerciseRecommendation,
  PostWorkoutNextTimeRecommendation,
} from './postWorkoutNextTimeRecommendationEngine';

export type GuardedRecommendationSource =
  | 'focus_next_set'
  | 'post_workout_next_time'
  | 'today_readiness'
  | 'weekly_progression'
  | 'coach_action'
  | 'manual';

export type GuardedRecommendationScope =
  | 'current_set'
  | 'current_session'
  | 'next_session'
  | 'today'
  | 'week'
  | 'plan';

export type GuardedRecommendationLevel = 1 | 2 | 3 | 4;

export const GUARDED_RECOMMENDATION_LEVELS = [1, 2, 3, 4] as const satisfies readonly GuardedRecommendationLevel[];

export type GuardedRecommendationActionType =
  | 'display_only'
  | 'prefill_current_set'
  | 'queue_session_adjustment'
  | 'queue_plan_adjustment'
  | 'open_review'
  | 'dismiss'
  | 'no_action';

export type GuardedRecommendationStatus =
  | 'candidate'
  | 'pending_review'
  | 'ready_to_apply'
  | 'blocked'
  | 'dismissed'
  | 'expired'
  | 'consumed';

export type GuardedRecommendationConfirmationLevel =
  | 'none'
  | 'tap'
  | 'confirm_dialog'
  | 'review_required';

export type GuardedRecommendationRiskLevel = 'low' | 'medium' | 'high';

export interface GuardedRecommendationTarget {
  sessionId?: string;
  exerciseId?: string;
  setId?: string;
  templateId?: string;
  muscleId?: string;
  sourceSessionId?: string;
  sourceRecommendationId?: string;
}

export interface GuardedRecommendationPreview {
  title: string;
  summary: string;
  before?: string;
  after?: string;
  affectedAreas: string[];
  reversible: boolean;
  durableEffect: boolean;
}

export interface GuardedRecommendationContract {
  id: string;
  source: GuardedRecommendationSource;
  scope: GuardedRecommendationScope;
  level: GuardedRecommendationLevel;
  actionType: GuardedRecommendationActionType;
  status: GuardedRecommendationStatus;
  title: string;
  summary: string;
  userMessage: string;
  target: GuardedRecommendationTarget;
  confidence: 'low' | 'medium' | 'high';
  riskLevel: GuardedRecommendationRiskLevel;
  reasonCodes: string[];
  riskFlags: string[];
  blockedReasons: string[];
  requiresConfirmation: boolean;
  confirmationLevel: GuardedRecommendationConfirmationLevel;
  preview: GuardedRecommendationPreview;
  sourceFingerprint: string;
  sourceEngineIds: string[];
  createdAt: string;
  expiresAt?: string;
}

export interface GuardedRecommendationFingerprintInput {
  source: GuardedRecommendationSource;
  scope: GuardedRecommendationScope;
  actionType: GuardedRecommendationActionType;
  target?: GuardedRecommendationTarget;
  sourceRecommendationId?: string;
  sourceEngineIds?: string[];
  reasonCodes?: string[];
  durableEffect?: boolean;
}

export interface GuardedRecommendationContractInput {
  id?: string;
  source: GuardedRecommendationSource;
  scope: GuardedRecommendationScope;
  level: GuardedRecommendationLevel;
  actionType: GuardedRecommendationActionType;
  status?: GuardedRecommendationStatus;
  title: string;
  summary: string;
  userMessage: string;
  target?: GuardedRecommendationTarget;
  confidence: 'low' | 'medium' | 'high';
  riskLevel?: GuardedRecommendationRiskLevel;
  reasonCodes?: string[];
  riskFlags?: string[];
  blockedReasons?: string[];
  requiresConfirmation?: boolean;
  confirmationLevel?: GuardedRecommendationConfirmationLevel;
  preview?: Partial<GuardedRecommendationPreview>;
  sourceFingerprint?: string;
  sourceEngineIds?: string[];
  createdAt?: string;
  nowIso?: string;
  expiresAt?: string;
}

export interface NormalizePostWorkoutNextTimeRecommendationInput {
  recommendation: PostWorkoutNextTimeRecommendation;
  selectedExerciseRecommendationId?: string;
  allowPlanAdjustmentCandidate?: boolean;
  nowIso?: string;
}

export interface NormalizeFocusNextSetRecommendationInput {
  recommendation: FocusNextSetRecommendation;
  nowIso?: string;
}

export interface ResolveGuardedRecommendationStateInput {
  contract: GuardedRecommendationContract;
  currentDate?: string;
  dismissedFingerprints?: string[];
  consumedFingerprints?: string[];
  matchingTargetAvailable?: boolean;
}

export interface GuardedRecommendationApplySafety {
  canDisplay: boolean;
  canPrefill: boolean;
  canQueue: boolean;
  canApplyDurably: false;
  requiresReview: boolean;
  blockedReasons: string[];
}

const FALLBACK_CREATED_AT = '1970-01-01T00:00:00.000Z';

const cleanText = (value: unknown) => String(value ?? '').trim();

const cleanList = (items: readonly string[] | undefined) => [...new Set((items || []).map(cleanText).filter(Boolean))];

const stableHash = (value: string) => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
};

const stableValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined && item !== '')
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, stableValue(item)]),
  );
};

const stableStringify = (value: unknown) => JSON.stringify(stableValue(value));

const targetCopy = (target: GuardedRecommendationTarget | undefined): GuardedRecommendationTarget => ({
  sessionId: cleanText(target?.sessionId) || undefined,
  exerciseId: cleanText(target?.exerciseId) || undefined,
  setId: cleanText(target?.setId) || undefined,
  templateId: cleanText(target?.templateId) || undefined,
  muscleId: cleanText(target?.muscleId) || undefined,
  sourceSessionId: cleanText(target?.sourceSessionId) || undefined,
  sourceRecommendationId: cleanText(target?.sourceRecommendationId) || undefined,
});

const hasHighRisk = (riskFlags: readonly string[]) => riskFlags.some((flag) => flag === 'pain' || flag === 'medical_risk');

const riskLevelFor = (riskFlags: readonly string[], requiresConfirmation = false): GuardedRecommendationRiskLevel => {
  if (hasHighRisk(riskFlags)) return 'high';
  if (riskFlags.length || requiresConfirmation) return 'medium';
  return 'low';
};

const defaultConfirmationLevel = (
  actionType: GuardedRecommendationActionType,
  requiresConfirmation: boolean,
  riskLevel: GuardedRecommendationRiskLevel,
): GuardedRecommendationConfirmationLevel => {
  if (actionType === 'queue_plan_adjustment') return 'review_required';
  if (actionType === 'queue_session_adjustment') return 'confirm_dialog';
  if (actionType === 'open_review' || riskLevel === 'high') return 'review_required';
  if (requiresConfirmation) return 'confirm_dialog';
  if (actionType === 'prefill_current_set') return 'tap';
  return 'none';
};

const defaultPreviewSummary = (durableEffect: boolean) => (durableEffect ? '查看后再决定' : '只影响本次，不改变计划');

const previewFromInput = (
  input: Pick<GuardedRecommendationContractInput, 'title' | 'summary' | 'target' | 'preview'>,
  durableEffect: boolean,
): GuardedRecommendationPreview => {
  const affectedAreas = input.preview?.affectedAreas?.length
    ? [...input.preview.affectedAreas]
    : [
        input.target?.setId ? '当前组' : '',
        input.target?.sourceSessionId ? '下次训练' : '',
        input.target?.exerciseId ? '动作' : '',
        input.target?.muscleId ? '肌群' : '',
        input.target?.templateId ? '计划' : '',
      ].filter(Boolean);

  return {
    title: input.preview?.title || input.title,
    summary: input.preview?.summary || defaultPreviewSummary(durableEffect),
    before: input.preview?.before,
    after: input.preview?.after || input.summary,
    affectedAreas: affectedAreas.length ? affectedAreas : ['训练'],
    reversible: input.preview?.reversible ?? !durableEffect,
    durableEffect,
  };
};

export const buildGuardedRecommendationFingerprint = (input: GuardedRecommendationFingerprintInput): string => {
  const payload = {
    source: input.source,
    scope: input.scope,
    actionType: input.actionType,
    target: targetCopy(input.target),
    sourceRecommendationId: cleanText(input.sourceRecommendationId || input.target?.sourceRecommendationId) || undefined,
    sourceEngineIds: cleanList(input.sourceEngineIds).sort(),
    reasonCodes: cleanList(input.reasonCodes).sort(),
    durableEffect: Boolean(input.durableEffect),
  };
  return `guarded:${stableHash(stableStringify(payload))}`;
};

export const buildGuardedRecommendationPreview = (contract: GuardedRecommendationContract): GuardedRecommendationPreview => ({
  title: contract.preview.title || contract.title,
  summary: contract.preview.summary || defaultPreviewSummary(contract.preview.durableEffect),
  before: contract.preview.before,
  after: contract.preview.after || contract.summary,
  affectedAreas: [...contract.preview.affectedAreas],
  reversible: contract.preview.reversible,
  durableEffect: contract.preview.durableEffect,
});

export const buildGuardedRecommendationContract = (input: GuardedRecommendationContractInput): GuardedRecommendationContract => {
  const target = targetCopy(input.target);
  const reasonCodes = cleanList(input.reasonCodes);
  const riskFlags = cleanList(input.riskFlags);
  const blockedReasons = cleanList(input.blockedReasons);
  const sourceEngineIds = cleanList(input.sourceEngineIds);
  const durableEffect = Boolean(input.preview?.durableEffect);
  const riskLevel = input.riskLevel ?? riskLevelFor(riskFlags, input.requiresConfirmation);
  const requiresConfirmation = Boolean(input.requiresConfirmation || riskLevel === 'high' || input.actionType === 'queue_plan_adjustment');
  const confirmationLevel = input.confirmationLevel ?? defaultConfirmationLevel(input.actionType, requiresConfirmation, riskLevel);
  const sourceFingerprint =
    input.sourceFingerprint ||
    buildGuardedRecommendationFingerprint({
      source: input.source,
      scope: input.scope,
      actionType: input.actionType,
      target,
      sourceRecommendationId: target.sourceRecommendationId,
      sourceEngineIds,
      reasonCodes,
      durableEffect,
    });
  const preview = previewFromInput({ title: input.title, summary: input.summary, target, preview: input.preview }, durableEffect);

  return {
    id: input.id || `guarded-recommendation:${sourceFingerprint.replace(/^guarded:/, '')}`,
    source: input.source,
    scope: input.scope,
    level: input.level,
    actionType: input.actionType,
    status: input.status || 'candidate',
    title: input.title,
    summary: input.summary,
    userMessage: input.userMessage,
    target,
    confidence: input.confidence,
    riskLevel,
    reasonCodes,
    riskFlags,
    blockedReasons,
    requiresConfirmation,
    confirmationLevel,
    preview,
    sourceFingerprint,
    sourceEngineIds,
    createdAt: input.createdAt || input.nowIso || FALLBACK_CREATED_AT,
    expiresAt: input.expiresAt,
  };
};

const focusActionType = (recommendation: FocusNextSetRecommendation): GuardedRecommendationActionType => {
  const safePrefill =
    recommendation.level === 2 &&
    !recommendation.requiresConfirmation &&
    !recommendation.riskFlags.length &&
    (recommendation.actionableLoadKg !== undefined || recommendation.plannedReps !== undefined);
  if (safePrefill) return 'prefill_current_set';
  if (recommendation.requiresConfirmation || recommendation.riskFlags.length) return 'open_review';
  return 'display_only';
};

export const normalizeFocusNextSetRecommendation = ({
  recommendation,
  nowIso,
}: NormalizeFocusNextSetRecommendationInput): GuardedRecommendationContract => {
  const actionType = focusActionType(recommendation);
  const riskLevel = riskLevelFor(recommendation.riskFlags, recommendation.requiresConfirmation);
  const isPrefill = actionType === 'prefill_current_set';

  return buildGuardedRecommendationContract({
    source: 'focus_next_set',
    scope: 'current_set',
    level: isPrefill ? 2 : 1,
    actionType,
    status: 'candidate',
    title: '下一组建议',
    summary: recommendation.userMessage || '查看后再决定',
    userMessage: recommendation.userMessage || '查看后再决定',
    target: {
      exerciseId: recommendation.targetExerciseId,
      setId: recommendation.targetSetId,
      sourceRecommendationId: recommendation.id,
    },
    confidence: recommendation.confidence,
    riskLevel,
    reasonCodes: recommendation.reasonCodes,
    riskFlags: recommendation.riskFlags,
    blockedReasons: recommendation.blockedReasons,
    requiresConfirmation: recommendation.requiresConfirmation,
    confirmationLevel: isPrefill ? 'tap' : riskLevel === 'low' ? 'none' : 'review_required',
    sourceEngineIds: recommendation.sourceEngineIds,
    nowIso,
    preview: {
      title: '下一组建议',
      summary: '只影响本次，不改变计划',
      affectedAreas: ['当前组'],
      reversible: true,
      durableEffect: false,
    },
  });
};

const postWorkoutItems = (
  recommendation: PostWorkoutNextTimeRecommendation,
  selectedExerciseRecommendationId: string | undefined,
): PostWorkoutExerciseRecommendation[] => {
  const items = recommendation.recommendations || [];
  if (!selectedExerciseRecommendationId) return items;
  return items.filter((item) => item.id === selectedExerciseRecommendationId);
};

export const normalizePostWorkoutNextTimeRecommendation = ({
  recommendation,
  selectedExerciseRecommendationId,
  allowPlanAdjustmentCandidate = false,
  nowIso,
}: NormalizePostWorkoutNextTimeRecommendationInput): GuardedRecommendationContract[] =>
  postWorkoutItems(recommendation, selectedExerciseRecommendationId).map((item) => {
    const actionType: GuardedRecommendationActionType = allowPlanAdjustmentCandidate ? 'queue_plan_adjustment' : 'display_only';
    const durableEffect = allowPlanAdjustmentCandidate;

    return buildGuardedRecommendationContract({
      source: 'post_workout_next_time',
      scope: allowPlanAdjustmentCandidate ? 'plan' : 'next_session',
      level: allowPlanAdjustmentCandidate ? 4 : 1,
      actionType,
      status: allowPlanAdjustmentCandidate ? 'pending_review' : 'candidate',
      title: '下次建议',
      summary: item.userMessage || recommendation.summary || '下次建议已生成。',
      userMessage: item.userMessage || recommendation.summary || '下次建议已生成。',
      target: {
        sourceSessionId: recommendation.sourceSessionId,
        exerciseId: item.exerciseId,
        sourceRecommendationId: item.id,
      },
      confidence: item.confidence || recommendation.confidence,
      riskLevel: riskLevelFor(item.riskFlags),
      reasonCodes: item.reasonCodes,
      riskFlags: item.riskFlags,
      blockedReasons: item.blockedReasons,
      requiresConfirmation: allowPlanAdjustmentCandidate,
      confirmationLevel: allowPlanAdjustmentCandidate ? 'review_required' : 'none',
      sourceEngineIds: recommendation.sourceEngineIds,
      nowIso,
      preview: {
        title: '下次建议',
        summary: durableEffect ? '查看后再决定' : '只影响本次，不改变计划',
        affectedAreas: [item.exerciseName || item.exerciseId].filter(Boolean),
        reversible: true,
        durableEffect,
      },
    });
  });

export const resolveGuardedRecommendationState = ({
  contract,
  currentDate,
  dismissedFingerprints = [],
  consumedFingerprints = [],
  matchingTargetAvailable = true,
}: ResolveGuardedRecommendationStateInput): GuardedRecommendationContract => {
  if (contract.expiresAt && currentDate && contract.expiresAt < currentDate) {
    return { ...contract, status: 'expired' };
  }
  if (dismissedFingerprints.includes(contract.sourceFingerprint)) {
    return { ...contract, status: 'dismissed' };
  }
  if (consumedFingerprints.includes(contract.sourceFingerprint)) {
    return { ...contract, status: 'consumed' };
  }
  if (!matchingTargetAvailable) {
    return {
      ...contract,
      status: 'blocked',
      blockedReasons: [...new Set([...contract.blockedReasons, 'missing_target'])],
    };
  }
  return { ...contract };
};

export const classifyGuardedRecommendationApplySafety = (contract: GuardedRecommendationContract): GuardedRecommendationApplySafety => {
  const blockedReasons = [...contract.blockedReasons];
  const inactive = contract.status === 'expired' || contract.status === 'dismissed' || contract.status === 'consumed';
  if (inactive) blockedReasons.push(`status_${contract.status}`);
  if (contract.status === 'blocked') blockedReasons.push('blocked_status');

  const canDisplay = !inactive;
  const canPrefill =
    canDisplay &&
    contract.actionType === 'prefill_current_set' &&
    contract.level <= 2 &&
    !contract.preview.durableEffect &&
    contract.riskLevel !== 'high' &&
    (contract.confirmationLevel === 'none' || contract.confirmationLevel === 'tap') &&
    !blockedReasons.length;
  const canQueue =
    canDisplay &&
    ((contract.actionType === 'queue_session_adjustment' &&
      (contract.confirmationLevel === 'confirm_dialog' || contract.confirmationLevel === 'review_required')) ||
      (contract.actionType === 'queue_plan_adjustment' && contract.confirmationLevel === 'review_required'));
  const requiresReview =
    contract.confirmationLevel === 'review_required' ||
    contract.actionType === 'open_review' ||
    contract.actionType === 'queue_plan_adjustment';

  return {
    canDisplay,
    canPrefill,
    canQueue,
    canApplyDurably: false,
    requiresReview,
    blockedReasons: [...new Set(blockedReasons)],
  };
};
