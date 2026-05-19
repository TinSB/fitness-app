import type { ActualSetDraft } from '../models/training-model';
import type { FocusTrainingStep } from './focusModeStateEngine';

export type FocusSessionState =
  | 'no_session'
  | 'planned_session_ready'
  | 'active_session'
  | 'unfinished_session'
  | 'session_complete'
  | 'session_end_requested'
  | 'recovery_required';

export type FocusExerciseState =
  | 'exercise_ready'
  | 'active_exercise'
  | 'substituted_exercise'
  | 'correction_exercise'
  | 'mobility_exercise'
  | 'skipped_exercise'
  | 'discomfort_flagged';

export type FocusSetInteractionState =
  | 'warmup_set'
  | 'working_set'
  | 'correction_set'
  | 'mobility_task'
  | 'pending_actual_input'
  | 'suggestion_applied'
  | 'ready_to_complete'
  | 'completed'
  | 'skipped'
  | 'blocked';

export type FocusRecommendationState =
  | 'feasible_load_ready'
  | 'theoretical_only'
  | 'equipment_unknown'
  | 'manual_confirmation_required'
  | 'not_applicable';

export type FocusSafetyState =
  | 'local_ok'
  | 'backup_recommended'
  | 'source_unclear'
  | 'emergency_local_available'
  | 'cloud_candidate_paused';

export type FocusPrimaryActionKind =
  | 'start_today'
  | 'start_training'
  | 'continue_training'
  | 'open_actual_record'
  | 'complete_set'
  | 'complete_correction'
  | 'complete_mobility'
  | 'confirm_skip'
  | 'choose_discomfort_handling'
  | 'return_local_mode'
  | 'view_summary'
  | 'confirm_end_session';

export type FocusSecondaryActionKind =
  | 'apply_weight'
  | 'copy_previous'
  | 'mark_discomfort'
  | 'replace_exercise'
  | 'skip'
  | 'continue_training'
  | 'return_previous_state'
  | 'reduce_weight'
  | 'end_exercise'
  | 'view_details';

export type FocusModeSecondaryAction = {
  kind: FocusSecondaryActionKind;
  label: string;
};

export type FocusModeInteractionInput = {
  sessionState: FocusSessionState;
  exerciseState: FocusExerciseState;
  setState: FocusSetInteractionState;
  recommendationState: FocusRecommendationState;
  safetyState: FocusSafetyState;
  hasFeasibleLoad: boolean;
  hasAppliedSuggestion: boolean;
  hasActualInput: boolean;
  hasSkipReason: boolean;
  hasDiscomfort: boolean;
  canContinue: boolean;
  canComplete: boolean;
  canRecord: boolean;
  canApplySuggestion: boolean;
  isFormalWorkingSet: boolean;
  isCorrectionOrMobility: boolean;
  sourceOfTruthClear: boolean;
};

export type FocusModeInteractionState = {
  primaryAction: FocusPrimaryActionKind;
  primaryActionLabel: string;
  primaryActionKind: FocusPrimaryActionKind;
  secondaryActions: FocusModeSecondaryAction[];
  visiblePanels: string[];
  hiddenPanels: string[];
  shouldHideBottomNav: boolean;
  shouldOpenActualRecordSheet: boolean;
  requiresSecondConfirmation: boolean;
  canApplySuggestion: boolean;
  applySuggestionMode: 'weight_only' | 'unavailable';
  shouldCountAsFormalSet: boolean;
  warning?: string;
  severity: 'info' | 'warning' | 'danger';
  sourceOfTruthChanged: false;
  trainingAlgorithmChanged: false;
};

const baseSecondaryActions: FocusModeSecondaryAction[] = [
  { kind: 'copy_previous', label: '复制上组' },
  { kind: 'mark_discomfort', label: '标记不适' },
  { kind: 'replace_exercise', label: '替代动作' },
  { kind: 'skip', label: '跳过' },
  { kind: 'view_details', label: '查看详情' },
];

const makeState = (
  input: FocusModeInteractionInput,
  primaryAction: FocusPrimaryActionKind,
  primaryActionLabel: string,
  options: Partial<Omit<FocusModeInteractionState, 'primaryAction' | 'primaryActionKind' | 'primaryActionLabel' | 'sourceOfTruthChanged' | 'trainingAlgorithmChanged'>> = {},
): FocusModeInteractionState => ({
  primaryAction,
  primaryActionKind: primaryAction,
  primaryActionLabel,
  secondaryActions: options.secondaryActions ?? baseSecondaryActions,
  visiblePanels: options.visiblePanels ?? ['focus_hero', 'prescription', 'action_bar'],
  hiddenPanels: options.hiddenPanels ?? ['global_bottom_nav'],
  shouldHideBottomNav: options.shouldHideBottomNav ?? true,
  shouldOpenActualRecordSheet: options.shouldOpenActualRecordSheet ?? primaryAction === 'open_actual_record',
  requiresSecondConfirmation: options.requiresSecondConfirmation ?? false,
  canApplySuggestion: options.canApplySuggestion ?? input.canApplySuggestion,
  applySuggestionMode: options.applySuggestionMode ?? (input.canApplySuggestion ? 'weight_only' : 'unavailable'),
  shouldCountAsFormalSet: options.shouldCountAsFormalSet ?? input.isFormalWorkingSet,
  warning: options.warning,
  severity: options.severity ?? 'info',
  sourceOfTruthChanged: false,
  trainingAlgorithmChanged: false,
});

export const resolveFocusModeInteractionState = (input: FocusModeInteractionInput): FocusModeInteractionState => {
  if (!input.sourceOfTruthClear || input.safetyState === 'source_unclear') {
    return makeState(input, 'return_local_mode', '回到本地模式', {
      secondaryActions: [],
      warning: '当前数据来源不清晰，请先回到本地模式。',
      severity: 'danger',
      canApplySuggestion: false,
      applySuggestionMode: 'unavailable',
      shouldCountAsFormalSet: false,
    });
  }

  if (input.sessionState === 'session_end_requested') {
    return makeState(input, 'confirm_end_session', '确认结束训练', {
      secondaryActions: [{ kind: 'continue_training', label: '继续训练' }],
      requiresSecondConfirmation: true,
      shouldCountAsFormalSet: false,
      severity: 'warning',
    });
  }

  if (input.sessionState === 'no_session') {
    return makeState(input, 'start_today', '开始今天训练', { shouldCountAsFormalSet: false });
  }
  if (input.sessionState === 'planned_session_ready') {
    return makeState(input, 'start_training', '开始训练', { shouldCountAsFormalSet: false });
  }
  if (input.sessionState === 'unfinished_session') {
    return makeState(input, 'continue_training', '继续训练', { shouldCountAsFormalSet: false });
  }
  if (input.sessionState === 'session_complete') {
    return makeState(input, 'view_summary', '查看训练总结', { shouldCountAsFormalSet: false });
  }

  if (input.exerciseState === 'skipped_exercise' || input.setState === 'skipped' || input.hasSkipReason) {
    return makeState(input, 'confirm_skip', '确认跳过', {
      secondaryActions: [
        { kind: 'continue_training', label: '继续训练' },
        { kind: 'return_previous_state', label: '返回上一状态' },
      ],
      shouldCountAsFormalSet: false,
      severity: 'warning',
    });
  }

  if (input.exerciseState === 'discomfort_flagged' || input.hasDiscomfort) {
    return makeState(input, 'choose_discomfort_handling', '选择处理方式', {
      secondaryActions: [
        { kind: 'replace_exercise', label: '替代动作' },
        { kind: 'reduce_weight', label: '降低重量' },
        { kind: 'end_exercise', label: '结束本动作' },
      ],
      shouldCountAsFormalSet: false,
      severity: 'warning',
    });
  }

  if (input.setState === 'correction_set' || input.exerciseState === 'correction_exercise') {
    return makeState(input, 'complete_correction', '完成纠偏', {
      shouldCountAsFormalSet: false,
      canApplySuggestion: false,
      applySuggestionMode: 'unavailable',
    });
  }

  if (input.setState === 'mobility_task' || input.exerciseState === 'mobility_exercise') {
    return makeState(input, 'complete_mobility', '完成动作', {
      shouldCountAsFormalSet: false,
      canApplySuggestion: false,
      applySuggestionMode: 'unavailable',
    });
  }

  if (input.setState === 'suggestion_applied' && input.hasActualInput && input.canComplete) {
    return makeState(input, 'complete_set', '完成一组');
  }

  if (input.setState === 'ready_to_complete' && input.hasActualInput && input.canComplete) {
    return makeState(input, 'complete_set', '完成一组');
  }

  if (input.canRecord && (input.setState === 'warmup_set' || input.setState === 'working_set' || input.setState === 'pending_actual_input')) {
    return makeState(input, 'open_actual_record', '记录本组', {
      secondaryActions: input.canApplySuggestion ? [{ kind: 'apply_weight', label: '套用重量' }, ...baseSecondaryActions] : baseSecondaryActions,
      shouldOpenActualRecordSheet: true,
    });
  }

  return makeState(input, 'continue_training', '继续训练', {
    warning: input.setState === 'blocked' ? '当前步骤暂时不可完成。' : undefined,
    severity: input.setState === 'blocked' ? 'warning' : 'info',
    shouldCountAsFormalSet: false,
  });
};

const hasPositiveNumber = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value > 0;

export const buildFocusModeInteractionInput = ({
  currentStep,
  actualDraft,
  sessionComplete,
  sessionEndRequested = false,
  isSupportStep,
  blockType,
  hasSkipReason = false,
  painMarked = false,
  canCompleteCurrentStep,
  canApplySuggestion,
  hasFeasibleLoad,
  sourceOfTruthClear = true,
}: {
  currentStep: FocusTrainingStep;
  actualDraft?: ActualSetDraft | null;
  sessionComplete: boolean;
  sessionEndRequested?: boolean;
  isSupportStep: boolean;
  blockType?: 'main' | 'correction' | 'functional';
  hasSkipReason?: boolean;
  painMarked?: boolean;
  canCompleteCurrentStep: boolean;
  canApplySuggestion: boolean;
  hasFeasibleLoad: boolean;
  sourceOfTruthClear?: boolean;
}): FocusModeInteractionInput => {
  const hasWeight = hasPositiveNumber(actualDraft?.actualWeightKg);
  const hasReps = hasPositiveNumber(actualDraft?.actualReps);
  const hasActualInput = isSupportStep || (hasWeight && hasReps);
  const isCorrection = isSupportStep && (blockType === 'correction' || currentStep.stepType === 'correction');
  const isMobility = isSupportStep && !isCorrection;
  const hasAppliedSuggestion = Boolean(actualDraft?.source === 'prescription' && hasWeight);
  const setState: FocusSetInteractionState = sessionComplete
    ? 'completed'
    : hasSkipReason
      ? 'skipped'
      : isCorrection
        ? 'correction_set'
        : isMobility
          ? 'mobility_task'
          : hasAppliedSuggestion && hasActualInput
            ? 'suggestion_applied'
            : hasActualInput
              ? 'ready_to_complete'
              : currentStep.stepType === 'warmup'
                ? 'warmup_set'
                : currentStep.stepType === 'working'
                  ? 'working_set'
                  : 'pending_actual_input';

  return {
    sessionState: sessionEndRequested ? 'session_end_requested' : sessionComplete ? 'session_complete' : 'active_session',
    exerciseState: hasSkipReason
      ? 'skipped_exercise'
      : painMarked
        ? 'discomfort_flagged'
        : isCorrection
          ? 'correction_exercise'
          : isMobility
            ? 'mobility_exercise'
            : 'active_exercise',
    setState,
    recommendationState: isSupportStep ? 'not_applicable' : hasFeasibleLoad ? 'feasible_load_ready' : 'theoretical_only',
    safetyState: sourceOfTruthClear ? 'local_ok' : 'source_unclear',
    hasFeasibleLoad,
    hasAppliedSuggestion,
    hasActualInput,
    hasSkipReason,
    hasDiscomfort: painMarked,
    canContinue: true,
    canComplete: canCompleteCurrentStep,
    canRecord: !isSupportStep && currentStep.stepType !== 'completed',
    canApplySuggestion: !isSupportStep && canApplySuggestion,
    isFormalWorkingSet: currentStep.stepType === 'working',
    isCorrectionOrMobility: isSupportStep,
    sourceOfTruthClear,
  };
};
