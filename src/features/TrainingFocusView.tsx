import React from 'react';
import { AlertTriangle, CheckCircle, Copy, Dumbbell, ListChecks, Replace, SkipForward, Timer, XCircle } from 'lucide-react';
import { classNames, formatTimer, isCompletedSet, number } from '../engines/engineUtils';
import { dedupeFocusNotices, getFocusNavigationState, type FocusTrainingStep } from '../engines/focusModeStateEngine';
import { getRestTimerRemainingSec } from '../engines/restTimerEngine';
import { convertKgToDisplayWeight, formatTrainingVolume, formatWeight, parseDisplayWeightToKg } from '../engines/unitConversionEngine';
import { buildSmartReplacementRecommendations, type SmartReplacementRecommendation } from '../engines/smartReplacementEngine';
import type { ExerciseEquipmentTag } from '../data/exerciseLibrary';
import { detectSetAnomalies, type SetAnomaly } from '../engines/setAnomalyEngine';
import { getCurrentExerciseIdentity, getExerciseIdentityFromExercise } from '../engines/currentExerciseSelector';
import type { FocusActionResult } from '../engines/workoutExecutionStateMachine';
import { buildFocusModeInteractionInput, resolveFocusModeInteractionState } from '../engines/focusModeInteractionState';
import {
  formatExerciseName,
  formatFatigueCost,
  formatMovementPattern,
  formatMuscleName,
  formatReplacementCategory,
  formatRirLabel,
  formatSetType,
  formatSkippedReason,
  formatTechniqueQuality,
  formatTemplateName,
} from '../i18n/formatters';
import type { ActualSetDraft, LoadFeedbackValue, PainPattern, ReadinessResult, RestTimerState, SupportSkipReason, TrainingSession, TrainingSetLog, UnitSettings, WeightUnit } from '../models/training-model';
import { ActionButton } from '../ui/ActionButton';
import { BottomSheet } from '../ui/BottomSheet';
import { Card } from '../ui/Card';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { StatusBadge } from '../ui/StatusBadge';
import { Toast } from '../ui/Toast';
import { RecommendationExplanationPanel } from '../ui/RecommendationExplanationPanel';
import { EquipmentAwareRecommendationWeight } from '../ui/EquipmentAwareRecommendationWeight';
import { SetPrescriptionCard, TrainingFocusHeroCard } from '../uiOs/training/TrainingOsCards';
import { FocusActualSetRecordSheet } from '../uiOs/training/FocusActualSetRecordSheet';
import { FocusModeActionBar } from '../uiOs/training/FocusModeActionBar';
import type { FocusModeSecondaryActionItem } from '../uiOs/training/FocusModeSecondaryActions';
import { ActionButton as UiOsActionButton } from '../uiOs/primitives/ActionButton';
import { BottomSheet as UiOsBottomSheet } from '../uiOs/surfaces/BottomSheet';
import { buildSessionRecommendationTrace } from '../presenters/recommendationExplanationPresenter';
import { resolveActionableLoadContract } from '../engines/actionableLoadContract';

type EditableSetField = 'weight' | 'reps' | 'rpe' | 'rir' | 'note' | 'painFlag' | 'techniqueQuality';
type FocusBlockType = 'main' | 'correction' | 'functional';
type PendingFocusConfirmation =
  | { type: 'set-anomaly'; anomaly: SetAnomaly; exerciseIndex: number; completionNotice: string }
  | { type: 'skip-support-exercise'; moduleId: string; exerciseId: string; reason: SupportSkipReason; label: string }
  | { type: 'skip-support-block'; blockType: 'correction' | 'functional'; reason: SupportSkipReason; label: string };

export type FocusFeedback = { message: string; tone: 'success' | 'info' | 'warning' | 'danger' };
type FocusActionCallbackResult = FocusActionResult | void;

export const focusFeedbackToneFromActionResult = (tone: FocusActionResult['tone']): FocusFeedback['tone'] => (tone === 'error' ? 'danger' : tone);

export const focusFeedbackFromActionResult = (result: FocusActionResult): FocusFeedback => ({
  message: result.message,
  tone: focusFeedbackToneFromActionResult(result.tone),
});

export type FocusCurrentSetSummary = {
  text: string;
  actualText: string;
  missingInput: boolean;
  isSuggestionApplied: boolean;
  sourceLabel?: string;
};

export type FocusPainBoundaryNotice = {
  title: string;
  description: string;
};

const focusDraftSourceLabels: Partial<Record<NonNullable<ActualSetDraft['source']>, string>> = {
  manual: '手动',
  copy_previous: '复制上组',
};

const hasPositiveNumber = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value > 0;

const sameOptionalNumber = (left: unknown, right: unknown) => {
  if (left === undefined && right === undefined) return true;
  return typeof left === 'number' && typeof right === 'number' && left === right;
};

export const isFocusSuggestionApplied = (
  currentStep: FocusTrainingStep,
  actualDraft: ActualSetDraft | null | undefined,
  actionableWeightKg?: number,
) =>
  Boolean(
    actualDraft &&
      actualDraft.source === 'prescription' &&
      sameOptionalNumber(actualDraft.actualWeightKg, actionableWeightKg ?? currentStep.plannedWeight),
  );

export const buildFocusCurrentSetSummary = ({
  currentStep,
  actualDraft,
  unitSettings,
  actionableWeightKg,
}: {
  currentStep: FocusTrainingStep;
  actualDraft: ActualSetDraft | null | undefined;
  unitSettings: UnitSettings;
  actionableWeightKg?: number;
}): FocusCurrentSetSummary => {
  if (currentStep.stepType !== 'warmup' && currentStep.stepType !== 'working') {
    return {
      text: '当前记录：按支持动作计划完成',
      actualText: '按支持动作计划完成',
      missingInput: false,
      isSuggestionApplied: false,
    };
  }

  const hasWeight = hasPositiveNumber(actualDraft?.actualWeightKg);
  const hasReps = hasPositiveNumber(actualDraft?.actualReps);
  const missingInput = !hasWeight || !hasReps;
  const weightText = hasWeight ? formatWeight(actualDraft?.actualWeightKg, unitSettings) : '待输入';
  const repsText = hasReps ? `${number(actualDraft?.actualReps)} 次` : '待输入';
  const rirText = typeof actualDraft?.actualRir === 'number' ? formatRirLabel(actualDraft.actualRir) : '';
  const sourceLabel = actualDraft?.source ? focusDraftSourceLabels[actualDraft.source] : undefined;
  const isSuggestionApplied = isFocusSuggestionApplied(currentStep, actualDraft, actionableWeightKg);
  const actualParts = [`${weightText} × ${repsText}`, rirText].filter(Boolean);
  const summaryParts = [`${weightText} × ${repsText}`, rirText, sourceLabel].filter(Boolean);

  return {
    text: missingInput ? '当前记录：缺少重量或次数' : `当前记录：${summaryParts.join(' · ')}`,
    actualText: actualParts.join(' · '),
    missingInput,
    isSuggestionApplied,
    sourceLabel,
  };
};

export const buildFocusPainBoundaryNotice = ({
  currentStep,
  actualDraft,
}: {
  currentStep: FocusTrainingStep;
  actualDraft: ActualSetDraft | null | undefined;
}): FocusPainBoundaryNotice | null => {
  if (currentStep.stepType !== 'warmup' && currentStep.stepType !== 'working') return null;
  if (actualDraft?.stepId !== currentStep.id) return null;
  if (actualDraft.painFlag !== true) return null;
  return {
    title: '本组已标记不适，可再次点击取消。',
    description: '仅记录本组，不会自动设为长期限制。',
  };
};

interface TrainingFocusViewProps {
  session: TrainingSession;
  unitSettings: UnitSettings;
  restTimer: RestTimerState | null;
  expandedExercise: number;
  setExpandedExercise: React.Dispatch<React.SetStateAction<number>>;
  onSetChange: (exerciseIndex: number, setIndex: number, field: EditableSetField, value: string | boolean) => void;
  onCompleteSet: (exerciseIndex: number, advanceExercise?: boolean) => FocusActionCallbackResult;
  onCopyPrevious: (exerciseIndex: number) => FocusActionCallbackResult;
  onAdjustSet: (exerciseIndex: number, field: 'weight' | 'reps', delta: number) => void;
  onApplySuggestion: (exerciseIndex: number) => FocusActionCallbackResult;
  onUpdateActualDraft: (
    exerciseIndex: number,
    updates: {
      actualWeightKg?: number;
      displayWeight?: number;
      displayUnit?: WeightUnit;
      actualReps?: number;
      actualRir?: number;
      techniqueQuality?: TrainingSetLog['techniqueQuality'];
      painFlag?: boolean;
      source?: 'prescription' | 'manual' | 'copy_previous';
    },
  ) => FocusActionCallbackResult;
  onSwitchExercise: (exerciseIndex: number) => void;
  onReplaceExercise: (exerciseIndex: number, replacementId?: string) => FocusActionCallbackResult;
  onLoadFeedback: (exerciseId: string, feedback: LoadFeedbackValue) => void;
  onFinish?: () => void;
  onFinishToCalendar?: () => void;
  onFinishToToday?: () => void;
  onShowFullTraining?: () => void;
  onToggleRestTimer?: () => void;
  onResetRestTimer?: () => void;
  onEndRest?: () => void;
  onCompleteSupportSet: (moduleId: string, exerciseId: string) => void;
  onSkipSupportExercise: (moduleId: string, exerciseId: string, reason: SupportSkipReason) => void;
  onSkipSupportBlock: (blockType: 'correction' | 'functional', reason: SupportSkipReason) => void;
  onUpdateSupportSkipReason: (moduleId: string, exerciseId: string, reason: SupportSkipReason) => void;
  painPatterns?: PainPattern[];
  readinessResult?: ReadinessResult | null;
  trainingHistory?: TrainingSession[];
  equipmentPreferences?: string[];
}

const supportReasonOptions: Array<{ value: SupportSkipReason; label: string }> = [
  { value: 'time', label: formatSkippedReason('time') },
  { value: 'pain', label: formatSkippedReason('pain') },
  { value: 'equipment', label: formatSkippedReason('equipment') },
  { value: 'too_tired', label: formatSkippedReason('too_tired') },
  { value: 'forgot', label: formatSkippedReason('forgot') },
  { value: 'not_needed', label: formatSkippedReason('not_needed') },
  { value: 'other', label: formatSkippedReason('other') },
];

const qualityOptions: Array<{ value: NonNullable<TrainingSetLog['techniqueQuality']>; label: string }> = [
  { value: 'good', label: formatTechniqueQuality('good') },
  { value: 'acceptable', label: formatTechniqueQuality('acceptable') },
  { value: 'poor', label: formatTechniqueQuality('poor') },
];

const loadFeedbackOptions: Array<{ value: LoadFeedbackValue; label: string }> = [
  { value: 'too_light', label: '偏轻' },
  { value: 'good', label: '合适' },
  { value: 'too_heavy', label: '偏重' },
];

export const replacementEquipmentChips: Array<{ tag: ExerciseEquipmentTag; label: string }> = [
  { tag: 'dumbbell', label: '哑铃区' },
  { tag: 'cable', label: '绳索区' },
  { tag: 'rack', label: '深蹲架' },
  { tag: 'barbell', label: '杠铃' },
  { tag: 'smith', label: '史密斯' },
  { tag: 'machine', label: '固定器械' },
];

export const toggleReplacementEquipmentTag = (selected: ExerciseEquipmentTag[], tag: ExerciseEquipmentTag): ExerciseEquipmentTag[] =>
  selected.includes(tag) ? selected.filter((item) => item !== tag) : [...selected, tag];

const getSets = (exercise: TrainingSession['exercises'][number] | undefined): TrainingSetLog[] => (Array.isArray(exercise?.sets) ? exercise.sets : []);

const displayExerciseName = (exercise: TrainingSession['exercises'][number] | null | undefined) => {
  if (!exercise) return '未命名动作';
  const identity = getExerciseIdentityFromExercise(exercise, exercise.id);
  return formatExerciseName({ id: identity.displayExerciseId, name: exercise.name });
};

const displayReplacementName = (option: SmartReplacementRecommendation) => formatExerciseName({ id: option.exerciseId, name: option.exerciseName });

const displayMovementPattern = (exercise: TrainingSession['exercises'][number] | null | undefined) => {
  return formatMovementPattern(exercise?.movementPattern);
};

const displayPrimaryMuscles = (exercise: TrainingSession['exercises'][number] | null | undefined) => {
  const muscles = exercise?.primaryMuscles?.length ? exercise.primaryMuscles : exercise?.muscle ? [exercise.muscle] : [];
  const labels = muscles.map(formatMuscleName).filter(Boolean);
  return labels.length ? labels.join(' / ') : '未标注主肌群';
};

const blockLabel = (blockType: FocusBlockType) => (blockType === 'main' ? '主训练' : blockType === 'correction' ? '纠偏' : '功能补丁');

const stageLabel = (stepType: string) => {
  if (stepType === 'correction') return '纠偏组';
  if (stepType === 'functional') return '功能补丁';
  if (stepType === 'support') return '辅助动作';
  if (stepType === 'warmup' || stepType === 'working') return formatSetType(stepType);
  return '完成';
};

const replacementRankLabels: Record<SmartReplacementRecommendation['priority'], string> = {
  primary: '优先',
  secondary: '可选',
  angle_variation: '角度相近',
  avoid: '不推荐',
};

const replacementRankTone: Record<SmartReplacementRecommendation['priority'], string> = {
  primary: 'border-emerald-300/35 bg-emerald-300/12 text-emerald-100',
  secondary: 'border-sky-300/30 bg-sky-300/10 text-sky-100',
  angle_variation: 'border-amber-300/30 bg-amber-300/10 text-amber-100',
  avoid: 'border-amber-300/25 bg-amber-400/10 text-amber-100',
};

const replacementRankLabel = (rank: SmartReplacementRecommendation['priority']) => replacementRankLabels[rank] || formatReplacementCategory(rank);

const replacementPriorityWeight: Record<SmartReplacementRecommendation['priority'], number> = {
  primary: 0,
  secondary: 1,
  angle_variation: 2,
  avoid: 3,
};

export type ReplacementDisplayGroup = {
  key: 'all' | 'top' | 'other';
  title?: string;
  options: SmartReplacementRecommendation[];
};

export type ReplacementCardCopy = {
  exerciseName: string;
  rankLabel: string;
  shortReason: string;
  detailReason: string;
  warning?: string;
  fatigueLabel: string;
  statsNote: string;
};

export type ReplacementPickerUiState = {
  selectedUnavailableEquipment: ExerciseEquipmentTag[];
  expandedReplacementDetailsId: string | null;
};

export const resetReplacementPickerUiState = (): ReplacementPickerUiState => ({
  selectedUnavailableEquipment: [],
  expandedReplacementDetailsId: null,
});

export const toggleReplacementPickerEquipment = (state: ReplacementPickerUiState, tag: ExerciseEquipmentTag): ReplacementPickerUiState => ({
  ...state,
  selectedUnavailableEquipment: toggleReplacementEquipmentTag(state.selectedUnavailableEquipment, tag),
});

export const toggleReplacementPickerDetails = (state: ReplacementPickerUiState, exerciseId: string): ReplacementPickerUiState => ({
  ...state,
  expandedReplacementDetailsId: state.expandedReplacementDetailsId === exerciseId ? null : exerciseId,
});

export const buildReplacementDisplayGroups = (options: SmartReplacementRecommendation[]): ReplacementDisplayGroup[] => {
  if (options.length <= 1) return [{ key: 'all', options: [...options] }];

  const bestWeight = Math.min(...options.map((option) => replacementPriorityWeight[option.priority] ?? Number.MAX_SAFE_INTEGER));
  const topOptions: SmartReplacementRecommendation[] = [];

  options.forEach((option) => {
    if ((replacementPriorityWeight[option.priority] ?? Number.MAX_SAFE_INTEGER) === bestWeight && topOptions.length < 2) {
      topOptions.push(option);
    }
  });

  const topIds = new Set(topOptions.map((option) => option.exerciseId));
  const otherOptions = options.filter((option) => !topIds.has(option.exerciseId));

  return [
    { key: 'top', title: '推荐优先', options: topOptions },
    ...(otherOptions.length ? [{ key: 'other' as const, title: '其他可选', options: otherOptions }] : []),
  ];
};

const normalizeReasonText = (text: string) => text.replace(/\s+/g, ' ').trim();

const firstChineseSentence = (text: string) => {
  const [sentence] = normalizeReasonText(text).split(/[。；;]/);
  const cleaned = sentence?.replace(/[，,]?\s*(PR\s*\/\s*e1RM|e1RM|PR).*$/i, '').trim();
  return cleaned ? `${cleaned}。` : '';
};

const buildReplacementShortReason = (option: SmartReplacementRecommendation) => {
  const reason = normalizeReasonText([option.reason, ...option.warnings].filter(Boolean).join(' '));
  const equipmentReasons = ['避开哑铃区', '不依赖绳索', '不需要深蹲架', '可在固定器械区完成'].filter((item) => reason.includes(item));
  if (equipmentReasons.length) return `${equipmentReasons.slice(0, 2).join('，')}。`;
  if (reason.includes('复合动作替代')) return '复合动作替代，疲劳成本更高。';
  if (reason.includes('降低下背压力')) return '降低下背压力，但不是完全等价。';
  if (reason.includes('不是完全等价') || reason.includes('不完全等价') || reason.includes('不是同模式')) return '不是完全等价替代。';
  return firstChineseSentence(option.reason) || '可作为本次替代选择。';
};

export const buildReplacementCardCopy = (option: SmartReplacementRecommendation): ReplacementCardCopy => ({
  exerciseName: displayReplacementName(option),
  rankLabel: replacementRankLabel(option.priority),
  shortReason: buildReplacementShortReason(option),
  detailReason: normalizeReasonText(option.reason || '可作为本次替代选择。'),
  warning: option.warnings[0],
  fatigueLabel: formatFatigueCost(option.fatigueCost),
  statsNote: '统计按实际执行动作计算，不污染原动作。',
});

export function ReplacementEquipmentChips({
  selected,
  onToggle,
}: {
  selected: ExerciseEquipmentTag[];
  onToggle: (tag: ExerciseEquipmentTag) => void;
}) {
  return (
    <section className="mb-3 rounded-lg border border-white/10 bg-white/[0.05] p-2.5" data-theme-surface="compact_row">
      <div className="text-sm font-bold text-white">器械被占用？</div>
      <div className="mt-1 text-xs leading-5 text-white/45">只调整本次替代排序。</div>
      <div className="mt-2 flex flex-wrap gap-2">
        {replacementEquipmentChips.map((chip) => {
          const active = selected.includes(chip.tag);
          return (
            <button
              key={chip.tag}
              type="button"
              aria-pressed={active}
              onClick={() => onToggle(chip.tag)}
              className={classNames(
                'min-h-10 rounded-full border px-3 py-2 text-sm font-semibold transition',
                active ? 'border-emerald-300 bg-emerald-400 text-slate-950' : 'border-white/10 bg-white/[0.05] text-white/62 hover:border-emerald-300/40 hover:bg-white/[0.08]',
              )}
            >
              {chip.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}

export function ReplacementOptionCard({
  option,
  expanded,
  onToggleDetails,
  onChoose,
}: {
  option: SmartReplacementRecommendation;
  expanded: boolean;
  onToggleDetails: () => void;
  onChoose: () => void;
}) {
  const copy = buildReplacementCardCopy(option);

  return (
    <article className="rounded-lg border border-white/10 bg-white/[0.05] p-3" data-theme-surface="compact_row">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold text-white">{copy.exerciseName}</span>
        <span className={classNames('rounded-md border px-2 py-1 text-xs font-semibold', replacementRankTone[option.priority] || replacementRankTone.secondary)}>
          {copy.rankLabel}
        </span>
      </div>
      <div className="mt-2 text-xs leading-5 text-white/58">{copy.shortReason}</div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onChoose}
          className="min-h-10 flex-1 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700"
        >
          选择此动作
        </button>
        <button
          type="button"
          onClick={onToggleDetails}
          aria-expanded={expanded}
          className="min-h-10 rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-sm font-semibold text-white/68 transition hover:border-emerald-300/40 hover:bg-white/[0.08]"
        >
          {expanded ? '收起详情' : '查看详情'}
        </button>
      </div>
      {expanded ? (
        <div className="mt-3 space-y-2 rounded-lg border border-white/10 bg-white/[0.05] p-3 text-xs leading-5 text-white/58" data-theme-surface="compact_row">
          <div>{copy.detailReason}</div>
          {copy.warning ? <div className="rounded-md border border-amber-400/25 bg-amber-400/10 px-2 py-1 font-semibold text-amber-50">{copy.warning}</div> : null}
          <div>疲劳成本：{copy.fatigueLabel}</div>
          <div>{copy.statsNote}</div>
        </div>
      ) : null}
    </article>
  );
}

export function TrainingFocusView({
  session,
  unitSettings,
  restTimer,
  expandedExercise,
  onSetChange,
  onCompleteSet,
  onCopyPrevious,
  onApplySuggestion,
  onUpdateActualDraft,
  onSwitchExercise,
  onReplaceExercise,
  onLoadFeedback,
  onFinish,
  onFinishToCalendar,
  onFinishToToday,
  onShowFullTraining,
  onToggleRestTimer,
  onResetRestTimer,
  onEndRest,
  onCompleteSupportSet,
  onSkipSupportExercise,
  onSkipSupportBlock,
  onUpdateSupportSkipReason,
  painPatterns,
  readinessResult,
  trainingHistory,
  equipmentPreferences,
}: TrainingFocusViewProps) {
  const [skipReason, setSkipReason] = React.useState<SupportSkipReason>('time');
  const [feedback, setFeedback] = React.useState<FocusFeedback | null>(null);
  const [showExercisePicker, setShowExercisePicker] = React.useState(false);
  const [showReplacementPicker, setShowReplacementPicker] = React.useState(false);
  const [replacementPickerUi, setReplacementPickerUi] = React.useState<ReplacementPickerUiState>(() => resetReplacementPickerUiState());
  const [showExplanationSheet, setShowExplanationSheet] = React.useState(false);
  const [pendingConfirmation, setPendingConfirmation] = React.useState<PendingFocusConfirmation | null>(null);
  const [showMissingInputGuide, setShowMissingInputGuide] = React.useState(false);
  const [showActualRecordSheet, setShowActualRecordSheet] = React.useState(false);
  const [sessionEndRequested, setSessionEndRequested] = React.useState(false);
  const currentInputRef = React.useRef<HTMLDivElement | null>(null);
  const focusState = getFocusNavigationState(session, expandedExercise);
  const mainIndex = focusState.currentExerciseIndex;
  const mainExercise = focusState.currentExercise;
  const mainSets = getSets(mainExercise || undefined);
  const mainSetIndex = focusState.currentSetIndex;
  const mainSet = focusState.currentSet;
  const currentStep = focusState.currentStep;
  const currentExerciseIdentity = React.useMemo(() => getCurrentExerciseIdentity(currentStep, session), [currentStep, session]);
  const actualDraft = focusState.actualDraft;
  const selectedUnavailableEquipment = replacementPickerUi.selectedUnavailableEquipment;
  const expandedReplacementDetailsId = replacementPickerUi.expandedReplacementDetailsId;
  const isSupportStep = currentStep.stepType === 'correction' || currentStep.stepType === 'functional' || currentStep.stepType === 'support';
  const sessionComplete = focusState.sessionComplete || Boolean(session.focusSessionComplete);
  const remainingSec = getRestTimerRemainingSec(restTimer);
  const weightUnit = unitSettings.weightUnit;
  const mainExercisePoolId = currentExerciseIdentity.recordExerciseId || mainExercise?.actualExerciseId || mainExercise?.replacementExerciseId || mainExercise?.id || '';
  const completedMainSets = mainSets.filter((set) => isCompletedSet(set));
  const existingLoadFeedback = mainExercisePoolId ? (session.loadFeedback || []).find((item) => item.exerciseId === mainExercisePoolId) : undefined;
  const replacementOptions = React.useMemo(
    () =>
      mainExercise
        ? buildSmartReplacementRecommendations({
            currentExercise: mainExercise,
            exerciseLibrary: session.exercises,
            painPatterns,
            readinessResult,
            loadFeedback: session.loadFeedback,
            trainingHistory,
            equipmentPreferences,
            unavailableEquipment: selectedUnavailableEquipment.length ? selectedUnavailableEquipment : undefined,
          })
        : [],
    [equipmentPreferences, mainExercise, painPatterns, readinessResult, selectedUnavailableEquipment, session.exercises, session.loadFeedback, trainingHistory],
  );
  const visibleReplacementOptions = React.useMemo(() => replacementOptions.filter((option) => option.priority !== 'avoid'), [replacementOptions]);
  const replacementDisplayGroups = React.useMemo(() => buildReplacementDisplayGroups(visibleReplacementOptions), [visibleReplacementOptions]);
  const recommendationTrace = React.useMemo(() => buildSessionRecommendationTrace(session), [session]);

  const warmupPolicyNotice =
    currentStep.stepType === 'working' && currentStep.warmupPolicy && !currentStep.warmupPolicy.shouldShowWarmupSets && currentStep.warmupPolicy.policy !== 'none'
      ? {
          id: `warmup-policy-${currentStep.exerciseId}`,
          type: 'warmup-policy',
          tone: 'info' as const,
          message: currentStep.warmupPolicy.reason || '已按热身策略直接进入正式组。',
        }
      : null;
  const notices = dedupeFocusNotices(
    [
      warmupPolicyNotice,
      mainExercise?.warning
        ? {
            id: `warning-${mainExercise.id}`,
            type: 'exercise-warning',
            tone: 'warning' as const,
            message: mainExercise.warning,
          }
        : null,
    ].filter(Boolean) as Parameters<typeof dedupeFocusNotices>[0],
    1,
  );

  const [legacySupportModuleId, legacySupportExerciseId] = currentStep.stepType === 'support' ? currentStep.exerciseId.split('::') : ['', ''];
  const supportModuleId = currentStep.moduleId || legacySupportModuleId;
  const supportExerciseId = currentStep.moduleId ? currentStep.exerciseId : legacySupportExerciseId;
  const supportLog = isSupportStep
    ? (session.supportExerciseLogs || []).find((log) => log.moduleId === supportModuleId && log.exerciseId === supportExerciseId) || null
    : null;
  const supportBlock =
    supportLog?.blockType === 'correction'
      ? session.correctionBlock?.find((block) => block.id === supportLog.moduleId)
      : supportLog?.blockType === 'functional'
        ? session.functionalBlock?.find((block) => block.id === supportLog.moduleId)
        : undefined;
  const supportExercise = supportBlock?.exercises.find((exercise) => exercise.exerciseId === supportLog?.exerciseId);
  const blockType: FocusBlockType = isSupportStep ? supportLog?.blockType || currentStep.blockType || 'functional' : 'main';
  const supportTimeSec = supportExercise && 'timeSec' in supportExercise ? supportExercise.timeSec : undefined;
  const supportDistanceM = supportExercise && 'distanceM' in supportExercise ? supportExercise.distanceM : undefined;
  const equipmentAwareExerciseName = mainExercisePoolId || mainExercise?.id || displayExerciseName(mainExercise);
  const actionableLoadContract = !isSupportStep
    ? resolveActionableLoadContract({
        exerciseName: equipmentAwareExerciseName,
        rawTheoreticalLoadKg: currentStep.plannedWeight,
        plannedReps: currentStep.plannedReps,
        plannedRir: currentStep.plannedRir,
        setPurpose: currentStep.stepType === 'warmup' ? 'warmup' : 'working',
        unitSettings,
        showTheoreticalDetail: true,
      })
    : null;
  const actionablePrescription = actionableLoadContract?.prescription ?? null;
  const plannedWeightSummary = actionablePrescription?.shouldUseFeasibleLoad
    ? actionablePrescription.primaryDisplayWeightLabel
    : formatWeight(currentStep.plannedWeight, unitSettings);

  const plannedSummary =
    isSupportStep && supportExercise
      ? `${supportExercise.sets || supportLog?.plannedSets || currentStep.totalSetsForStepType} 组${
          supportExercise.repMin || supportExercise.repMax ? ` · ${supportExercise.repMin || supportExercise.repMax}-${supportExercise.repMax || supportExercise.repMin} 次` : ''
        }${supportExercise.holdSec ? ` · 保持 ${supportExercise.holdSec} 秒` : ''}${supportTimeSec ? ` · ${supportTimeSec} 秒` : ''}${supportDistanceM ? ` · ${supportDistanceM} 米` : ''}`
      : isSupportStep
        ? '按支持动作计划完成'
        : currentStep.stepType === 'working' && mainExercise
          ? `${plannedWeightSummary} × 建议 ${number(currentStep.plannedReps)} 次 · 目标范围 ${mainExercise.repMin}-${mainExercise.repMax} 次${
              currentStep.plannedRir ? ` · ${formatRirLabel(currentStep.plannedRir)}` : ''
            }`
          : `${plannedWeightSummary} × ${number(currentStep.plannedReps)} 次${currentStep.plannedRir ? ` · ${formatRirLabel(currentStep.plannedRir)}` : ''}`;
  const actualWeight = actualDraft?.actualWeightKg;
  const actualReps = actualDraft?.actualReps;
  const actualRir = actualDraft?.actualRir;
  const actualDisplayWeight = actualWeight === undefined ? undefined : convertKgToDisplayWeight(actualWeight, weightUnit);
  const currentSetSummary = buildFocusCurrentSetSummary({
    currentStep,
    actualDraft,
    unitSettings,
    actionableWeightKg: actionablePrescription?.actionableWeightKg,
  });
  const painBoundaryNotice = buildFocusPainBoundaryNotice({ currentStep, actualDraft });
  const actualSummary = currentSetSummary.actualText;
  const canCompleteCurrentStep = isSupportStep || mainSetIndex >= 0;
  const painMarked = Boolean(actualDraft?.painFlag || (isSupportStep && skipReason === 'pain'));
  const pendingSkipConfirmation = pendingConfirmation?.type === 'skip-support-exercise' ? pendingConfirmation : null;
  const interactionInput = buildFocusModeInteractionInput({
    currentStep,
    actualDraft,
    sessionComplete,
    sessionEndRequested,
    isSupportStep,
    blockType,
    hasSkipReason: Boolean(pendingSkipConfirmation || supportLog?.skippedReason),
    painMarked,
    canCompleteCurrentStep,
    canApplySuggestion: Boolean(!isSupportStep && mainIndex >= 0),
    hasFeasibleLoad: Boolean(actionablePrescription?.shouldUseFeasibleLoad),
  });
  const interactionState = resolveFocusModeInteractionState(interactionInput);

  const requestInputGuide = () => {
    setShowMissingInputGuide(true);
    setShowActualRecordSheet(true);
    window.setTimeout(() => currentInputRef.current?.scrollIntoView?.({ block: 'center', behavior: 'smooth' }), 0);
  };

  const notify = (message: string, tone: FocusFeedback['tone'] = 'success') => setFeedback({ message, tone });
  const notifyResult = (result: FocusActionCallbackResult, fallbackMessage?: string) => {
    if (!result) {
      if (fallbackMessage) notify(fallbackMessage, 'info');
      return;
    }
    const nextFeedback = focusFeedbackFromActionResult(result);
    if (result.reasonCode === 'missing_draft') requestInputGuide();
    if (result.changed) setShowMissingInputGuide(false);
    notify(nextFeedback.message, nextFeedback.tone);
  };

  React.useEffect(() => {
    if (!currentSetSummary.missingInput) setShowMissingInputGuide(false);
  }, [currentSetSummary.missingInput, currentStep.id]);

  React.useEffect(() => {
    if (!feedback) return undefined;
    const timer = window.setTimeout(() => setFeedback(null), 2500);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  React.useEffect(() => {
    setShowActualRecordSheet(false);
    setSessionEndRequested(false);
  }, [currentStep.id]);

  const switchExercise = (index: number) => {
    const exercise = session.exercises[index];
    if (!exercise) return;
    onSwitchExercise(index);
    setShowExercisePicker(false);
    notify(`已切换到 ${displayExerciseName(exercise)}`);
  };

  const copyPrevious = () => {
    if (isSupportStep) {
      notify('没有可复制的上一组。', 'info');
      return;
    }
    if (mainIndex < 0 || mainSetIndex <= 0) {
      notify('没有可复制的上一组。', 'info');
      return;
    }
    notifyResult(onCopyPrevious(mainIndex));
  };

  const markPain = (painFlag: boolean) => {
    if (isSupportStep && supportLog) {
      const nextReason = painFlag ? 'pain' : 'time';
      setSkipReason(nextReason);
      onUpdateSupportSkipReason(supportLog.moduleId, supportLog.exerciseId, nextReason);
      notify(painFlag ? '已记录当前辅助动作不适' : '已取消当前辅助动作不适标记');
      return;
    }
    if (mainIndex < 0 || mainSetIndex < 0) return;
    notifyResult(onUpdateActualDraft(mainIndex, { painFlag }));
  };

  const toggleUnavailableEquipment = (tag: ExerciseEquipmentTag) => {
    setReplacementPickerUi((current) => toggleReplacementPickerEquipment(current, tag));
  };

  const closeReplacementPicker = () => {
    setShowReplacementPicker(false);
    setReplacementPickerUi(resetReplacementPickerUiState());
  };

  const openReplacementPicker = () => {
    if (mainIndex < 0 || !mainExercise) {
      notify('当前动作暂无可替代动作。', 'info');
      return;
    }
    if (!visibleReplacementOptions.length) {
      notify('当前动作暂无可替代动作。', 'info');
      return;
    }
    setReplacementPickerUi(resetReplacementPickerUiState());
    setShowReplacementPicker(true);
  };

  const chooseReplacement = (option: SmartReplacementRecommendation) => {
    if (mainIndex < 0) return;
    const result = onReplaceExercise(mainIndex, option.exerciseId);
    if (!result || result.changed) closeReplacementPicker();
    notifyResult(result, `已替换为：${displayReplacementName(option)}。`);
  };

  const completeCurrentSet = () => {
    if (sessionComplete) {
      notify('训练已完成。', 'info');
      return;
    }
    if (isSupportStep && supportLog) {
      onCompleteSupportSet(supportLog.moduleId, supportLog.exerciseId);
      notify(currentStep.stepType === 'correction' ? '已完成纠偏组' : '已完成功能补丁');
      return;
    }
    if (mainIndex < 0 || mainSetIndex < 0) return;
    if (currentSetSummary.missingInput) {
      notifyResult(onCompleteSet(mainIndex));
      return;
    }
    const anomalyStepType = currentStep.stepType === 'completed' ? 'working' : currentStep.stepType;
    const anomalies = detectSetAnomalies({
      currentDraft: {
        ...actualDraft,
        stepType: anomalyStepType,
        setType: anomalyStepType,
        isWarmup: anomalyStepType === 'warmup',
      },
      exerciseId: mainExercisePoolId || mainExercise?.id,
      previousSets: mainSets,
      recentHistory: trainingHistory || [],
      currentSessionId: session.id,
      unitSettings,
      plannedPrescription: {
        actionableWeightKg: actionableLoadContract?.actionableLoadKg,
        validationBaselineKg: actionableLoadContract?.validationBaselineKg,
        rawTheoreticalWeightKg: actionableLoadContract?.rawTheoreticalLoadKg,
        plannedWeightKg: currentStep.plannedWeight,
        plannedReps: currentStep.plannedReps,
        repMin: mainExercise?.repMin,
        repMax: mainExercise?.repMax,
        stepType: anomalyStepType,
        setType: anomalyStepType,
        isWarmup: anomalyStepType === 'warmup',
      },
    });
    const blockingAnomaly = anomalies.find((item) => item.requiresConfirmation || item.severity === 'critical');
    if (blockingAnomaly) {
      setPendingConfirmation({
        type: 'set-anomaly',
        anomaly: blockingAnomaly,
        exerciseIndex: mainIndex,
        completionNotice: currentStep.stepType === 'warmup' ? '已完成热身组' : '已完成正式组',
      });
      return;
    }
    const warningAnomaly = anomalies.find((item) => item.severity !== 'critical' && !item.requiresConfirmation);
    const result = onCompleteSet(mainIndex);
    if (warningAnomaly && (!result || result.changed)) {
      notify(`输入异常提示：${warningAnomaly.title}`, 'warning');
      return;
    }
    notifyResult(result);
  };

  const confirmPendingAction = () => {
    if (!pendingConfirmation) return;
    if (pendingConfirmation.type === 'set-anomaly') {
      notifyResult(onCompleteSet(pendingConfirmation.exerciseIndex));
    } else if (pendingConfirmation.type === 'skip-support-exercise') {
      onSkipSupportExercise(pendingConfirmation.moduleId, pendingConfirmation.exerciseId, pendingConfirmation.reason);
      notify(`已跳过${pendingConfirmation.label}`);
    } else {
      onSkipSupportBlock(pendingConfirmation.blockType, pendingConfirmation.reason);
      notify(`已跳过${pendingConfirmation.label}`);
    }
    setPendingConfirmation(null);
  };

  const cancelPendingAction = () => {
    if (pendingConfirmation?.type === 'set-anomaly') {
      notify('已返回修改。', 'info');
    }
    setPendingConfirmation(null);
  };

  const updateDisplayWeight = (nextDisplayWeight: number) => {
    if (mainIndex < 0) return undefined;
    const safeDisplayWeight = Math.max(0, nextDisplayWeight);
    return onUpdateActualDraft(mainIndex, {
      actualWeightKg: parseDisplayWeightToKg(safeDisplayWeight, weightUnit),
      displayWeight: safeDisplayWeight,
      displayUnit: weightUnit,
      source: 'manual',
    });
  };

  const updateActualReps = (nextReps: number) => {
    if (mainIndex < 0) return undefined;
    return onUpdateActualDraft(mainIndex, { actualReps: Math.max(0, Math.round(nextReps)), source: 'manual' });
  };

  const updateActualRir = (nextRir: number) => {
    if (mainIndex < 0) return undefined;
    return onUpdateActualDraft(mainIndex, { actualRir: Math.max(0, Math.min(10, Math.round(nextRir))), source: 'manual' });
  };

  const updateWorkingSetNote =
    currentStep.stepType === 'working' && mainIndex >= 0 && mainSetIndex >= 0
      ? (value: string) => onSetChange(mainIndex, mainSetIndex, 'note', value)
      : undefined;

  const completeFromActualRecordSheet = () => {
    const wasMissingInput = currentSetSummary.missingInput;
    completeCurrentSet();
    if (!wasMissingInput) setShowActualRecordSheet(false);
  };

  const requestSkipCurrentStep = () => {
    if (isSupportStep && supportLog) {
      const label = supportLog.blockType === 'correction' ? '纠偏动作' : '活动动作';
      setPendingConfirmation({ type: 'skip-support-exercise', moduleId: supportLog.moduleId, exerciseId: supportLog.exerciseId, reason: skipReason, label });
      return;
    }
    notify('正式训练组跳过请先选择替代动作或进入完整页处理。', 'info');
  };

  const handlePrimaryFocusAction = () => {
    switch (interactionState.primaryActionKind) {
      case 'open_actual_record':
        setShowActualRecordSheet(true);
        return;
      case 'complete_set':
      case 'complete_correction':
      case 'complete_mobility':
        completeCurrentSet();
        return;
      case 'confirm_skip':
        if (pendingSkipConfirmation) {
          confirmPendingAction();
        } else {
          requestSkipCurrentStep();
        }
        return;
      case 'choose_discomfort_handling':
        notify('请选择处理方式：替代动作、降低重量或结束本动作。', 'warning');
        return;
      case 'confirm_end_session':
      case 'view_summary':
        onFinish?.();
        return;
      case 'return_local_mode':
        notify('当前仍在本地训练模式。', 'info');
        return;
      default:
        notify(interactionState.primaryActionLabel, 'info');
    }
  };

  const focusSecondaryActions: FocusModeSecondaryActionItem[] = [
    {
      id: 'copy-previous',
      label: '复制上组',
      icon: <Copy className="h-4 w-4" />,
      onClick: copyPrevious,
      disabled: isSupportStep,
    },
    {
      id: 'mark-pain',
      label: '标记不适',
      icon: <XCircle className="h-4 w-4" />,
      onClick: () => markPain(!painMarked),
      active: painMarked,
      tone: 'danger',
    },
    {
      id: 'replace-exercise',
      label: '替代动作',
      icon: <Replace className="h-4 w-4" />,
      onClick: openReplacementPicker,
      disabled: isSupportStep,
      tone: 'success',
    },
    {
      id: 'record-details',
      label: '记录详情',
      icon: <ListChecks className="h-4 w-4" />,
      onClick: () => setShowActualRecordSheet(true),
      disabled: isSupportStep,
    },
    {
      id: 'exercise-order',
      label: '动作顺序',
      icon: <ListChecks className="h-4 w-4" />,
      onClick: () => setShowExercisePicker(true),
    },
    {
      id: 'skip-step',
      label: '跳过',
      icon: <SkipForward className="h-4 w-4" />,
      onClick: requestSkipCurrentStep,
      tone: 'default',
    },
    {
      id: 'view-details',
      label: '查看详情',
      icon: <ListChecks className="h-4 w-4" />,
      onClick: () => setShowExplanationSheet(true),
      tone: 'default',
    },
  ];

  const focusActionSummary = !isSupportStep ? (
    <div className="flex items-center gap-2">
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold">{currentSetSummary.text}</div>
        {showMissingInputGuide && currentSetSummary.missingInput ? <div className="mt-1 text-xs font-semibold text-amber-200">缺少重量或次数</div> : null}
        {painBoundaryNotice ? (
          <div className="mt-1 space-y-0.5 text-xs font-semibold text-rose-200">
            <div>{painBoundaryNotice.title}</div>
            <div className="font-medium text-rose-100/80">{painBoundaryNotice.description}</div>
          </div>
        ) : null}
      </div>
      {currentSetSummary.missingInput ? (
        <button
          type="button"
          onClick={() => notifyResult(onApplySuggestion(mainIndex))}
          className="shrink-0 rounded-xl border border-emerald-300/25 bg-white/10 px-3 py-2 text-xs font-bold text-emerald-100 transition active:scale-[0.98]"
        >
          套用建议
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setShowActualRecordSheet(true)}
          className="shrink-0 rounded-xl border border-white/10 bg-white/[0.08] px-3 py-2 text-xs font-bold text-white/72 transition active:scale-[0.98]"
        >
          修改
        </button>
      )}
    </div>
  ) : null;

  const renderActualRecordSheet = () =>
    !isSupportStep ? (
      <FocusActualSetRecordSheet
        isOpen={showActualRecordSheet}
        onClose={() => setShowActualRecordSheet(false)}
        weightUnit={weightUnit}
        weightValue={actualDisplayWeight}
        repsValue={actualReps}
        rirValue={actualRir}
        noteValue={mainSet?.note}
        missingInput={currentSetSummary.missingInput}
        onWeightChange={(value) => updateDisplayWeight(value)}
        onRepsChange={(value) => updateActualReps(value)}
        onRirChange={(value) => updateActualRir(value)}
        onNoteChange={updateWorkingSetNote}
        onComplete={completeFromActualRecordSheet}
      />
    ) : null;

  const renderEndSessionSheet = () => (
    <UiOsBottomSheet isOpen={sessionEndRequested} onClose={() => setSessionEndRequested(false)} title="结束训练" tone="danger">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <UiOsActionButton type="button" variant="secondary" size="md" onClick={() => setSessionEndRequested(false)}>
            继续训练
          </UiOsActionButton>
          <UiOsActionButton type="button" variant="danger" size="md" onClick={onFinish}>
            确认结束训练
          </UiOsActionButton>
        </div>
      </div>
    </UiOsBottomSheet>
  );

  const renderCompletedState = () => (
    <div className="min-h-svh bg-slate-950 px-4 pb-6 pt-[calc(1rem+env(safe-area-inset-top))] text-white">
      <div className="mx-auto flex min-h-[80svh] max-w-2xl flex-col justify-center">
        <Card className="border-emerald-400/20 bg-white/10 p-5 text-center text-white">
          <CheckCircle className="mx-auto h-10 w-10 text-emerald-600" />
          <h2 className="mt-4 text-2xl font-bold">本次训练已完成</h2>
          <p className="mt-2 text-sm leading-6 text-white/62">保存后会进入训练历史、日历和记录详情。</p>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-emerald-400/10 p-4">
              <div className="text-xs font-semibold text-emerald-200">完成组数</div>
              <div className="mt-1 text-2xl font-bold text-emerald-50">
                {focusState.completedSets}/{focusState.totalSets}
              </div>
            </div>
            <div className="rounded-lg bg-white/10 p-4">
              <div className="text-xs font-semibold text-white/45">当前总量</div>
              <div className="mt-1 text-2xl font-bold text-white">{formatTrainingVolume(focusState.totalVolume, unitSettings)}</div>
            </div>
          </div>
          <div className="mt-5 grid gap-2 sm:grid-cols-3">
            <ActionButton type="button" onClick={onFinish} variant="primary" size="lg">
              查看本次训练
            </ActionButton>
            <ActionButton type="button" onClick={onFinishToCalendar || onFinish} variant="secondary" size="lg">
              查看日历
            </ActionButton>
            <ActionButton type="button" onClick={onFinishToToday || onFinish} variant="ghost" size="lg">
              返回今日
            </ActionButton>
          </div>
        </Card>
      </div>
    </div>
  );

  if (sessionComplete || currentStep.stepType === 'completed') {
    return renderCompletedState();
  }

  const renderExercisePicker = () => (
    <BottomSheet open={showExercisePicker} title="切换动作" onClose={() => setShowExercisePicker(false)}>
      <div className="space-y-2">
        {session.exercises.map((exercise, index) => {
          const sets = getSets(exercise);
          const done = sets.filter((set) => isCompletedSet(set)).length;
          const selected = index === mainIndex;
          return (
            <button
              key={`${exercise.id}-picker-${index}`}
              type="button"
              onClick={() => switchExercise(index)}
              className={classNames(
                'flex w-full items-center justify-between rounded-lg px-3 py-3 text-left',
                selected ? 'border border-emerald-300/35 bg-emerald-300/15 text-emerald-50' : 'border border-white/10 bg-white/[0.05] text-white',
              )}
            >
              <span className="font-semibold">{displayExerciseName(exercise)}</span>
              <span className="text-sm font-semibold text-white/58">
                {done}/{sets.length}
              </span>
            </button>
          );
        })}
      </div>
    </BottomSheet>
  );

  const renderReplacementPicker = () => (
    <BottomSheet open={showReplacementPicker} title="选择本次实际执行动作" onClose={closeReplacementPicker}>
      <p className="mb-2 text-xs leading-5 text-white/45">选择本次实际执行动作，保留当前模板位置。</p>
      <ReplacementEquipmentChips selected={selectedUnavailableEquipment} onToggle={toggleUnavailableEquipment} />
      <div className="space-y-3">
        {visibleReplacementOptions.length ? (
          replacementDisplayGroups.map((group) => (
            <section key={group.key} className="space-y-2">
              {group.title ? <div className="text-xs font-bold text-white/45">{group.title}</div> : null}
              {group.options.map((option) => (
                <ReplacementOptionCard
                  key={option.exerciseId}
                  option={option}
                  expanded={expandedReplacementDetailsId === option.exerciseId}
                  onToggleDetails={() => setReplacementPickerUi((current) => toggleReplacementPickerDetails(current, option.exerciseId))}
                  onChoose={() => chooseReplacement(option)}
                />
              ))}
            </section>
          ))
        ) : (
          <div className="rounded-lg border border-white/10 bg-white/[0.05] p-4 text-sm font-semibold text-white/58" data-theme-surface="compact_row">当前动作暂无可替代动作</div>
        )}
      </div>
    </BottomSheet>
  );

  const renderExplanationSheet = () => (
    <BottomSheet open={showExplanationSheet} title="推荐依据" onClose={() => setShowExplanationSheet(false)}>
      <RecommendationExplanationPanel trace={recommendationTrace} compact maxVisibleFactors={3} defaultOpen />
    </BottomSheet>
  );

  const renderPendingConfirmation = () => {
    if (!pendingConfirmation) return null;
    const isSetAnomaly = pendingConfirmation.type === 'set-anomaly';
    const isSupportExerciseSkip = pendingConfirmation.type === 'skip-support-exercise';
    return (
      <div className="fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-slate-950/40 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-[calc(1rem+env(safe-area-inset-top))]">
        <ConfirmDialog
          title={isSetAnomaly ? '确认保存这组？' : isSupportExerciseSkip ? `跳过${pendingConfirmation.label}？` : `跳过整个${pendingConfirmation.label}？`}
          description={
            isSetAnomaly ? (
              <div className="space-y-2">
                <div>系统检测到重量、次数或 RIR 可能异常，请确认不是输入错误。</div>
                <details className="rounded-lg bg-amber-50 px-3 py-2 text-amber-900">
                  <summary className="cursor-pointer font-semibold">查看详情</summary>
                  <div className="mt-1 font-semibold">{pendingConfirmation.anomaly.title}</div>
                  <div>{pendingConfirmation.anomaly.message}</div>
                </details>
                {pendingConfirmation.anomaly.suggestedAction ? (
                  <div className="rounded-lg bg-amber-50 px-3 py-2 text-amber-900">建议：{pendingConfirmation.anomaly.suggestedAction}</div>
                ) : null}
              </div>
            ) : isSupportExerciseSkip ? (
              <div>当前支持动作会记录为跳过，你可以返回继续训练。</div>
            ) : (
              <div>未完成的支持动作会记录为跳过，你可以返回继续完成。</div>
            )
          }
          cancelText={isSetAnomaly ? '返回修改' : '返回'}
          confirmText={isSetAnomaly ? '仍然保存' : '确认跳过'}
          variant={isSetAnomaly ? 'warning' : 'danger'}
          onCancel={cancelPendingAction}
          onConfirm={confirmPendingAction}
        />
      </div>
    );
  };

  const renderRestTimer = () =>
    restTimer ? (
      <Card className="border-white/10 bg-white/10 text-white">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-200">
              <Timer className="h-4 w-4" />
              休息中
            </div>
            <div className="mt-1 text-sm text-slate-300">下一步：{currentStep.label}</div>
          </div>
          <div className="text-3xl font-bold tabular-nums">{formatTimer(remainingSec)}</div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <ActionButton type="button" variant="secondary" size="sm" onClick={onToggleRestTimer} disabled={!onToggleRestTimer}>
            {restTimer.isRunning ? '暂停' : '继续'}
          </ActionButton>
          <ActionButton type="button" variant="primary" size="sm" onClick={onEndRest} disabled={!onEndRest}>
            结束休息
          </ActionButton>
          <ActionButton type="button" variant="secondary" size="sm" onClick={onResetRestTimer} disabled={!onResetRestTimer}>
            重置计时
          </ActionButton>
        </div>
      </Card>
    ) : null;

  const renderSupportStep = () => {
    if (!supportLog) return null;
    const supportTitle = formatExerciseName({ id: supportLog.exerciseId, name: supportExercise?.name || supportLog.exerciseName || currentStep.exerciseName });
    const supportModuleName = supportBlock?.name || currentStep.moduleName || blockLabel(blockType);
    return (
      <>
        <TrainingFocusHeroCard>
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              <StatusBadge tone={blockType === 'correction' ? 'amber' : 'sky'}>{blockLabel(blockType)}</StatusBadge>
              <StatusBadge tone="slate">{stageLabel(currentStep.stepType)}</StatusBadge>
            </div>
            <button
              type="button"
              onClick={() => setShowExplanationSheet(true)}
              className="rounded-2xl border border-white/10 bg-white/10 px-3 py-2 text-xs font-semibold text-slate-100"
            >
              依据
            </button>
          </div>
          <h1 className="mt-3 text-3xl font-bold tracking-tight">{supportTitle}</h1>
          <p className="mt-1 text-sm font-medium text-slate-300">{supportModuleName}</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-3xl bg-white/10 p-3">
              <div className="text-xs font-semibold text-slate-300">当前组</div>
              <div className="mt-1 text-2xl font-bold">
                {supportLog.completedSets || 0}/{supportLog.plannedSets || currentStep.totalSetsForStepType}
              </div>
            </div>
            <div className="rounded-3xl bg-white/10 p-3">
              <div className="text-xs font-semibold text-slate-300">建议</div>
              <div className="mt-1 text-sm font-semibold leading-6">{plannedSummary}</div>
            </div>
          </div>
        </TrainingFocusHeroCard>

        <Card className="border-white/10 bg-white/10 text-white">
          <div className="text-sm font-semibold">跳过原因</div>
          <select
            value={skipReason}
            onChange={(event) => {
              const next = event.target.value as SupportSkipReason;
              setSkipReason(next);
              onUpdateSupportSkipReason(supportLog.moduleId, supportLog.exerciseId, next);
            }}
            className="mt-2 h-12 w-full rounded-lg border border-white/10 bg-[#1c1c1e] px-3 text-base font-semibold text-white"
          >
            {supportReasonOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <ActionButton
            type="button"
            variant="ghost"
            size="md"
            fullWidth
            className="mt-2"
            onClick={() => {
              const label = supportLog.blockType === 'correction' ? '纠偏模块' : '功能补丁';
              setPendingConfirmation({ type: 'skip-support-block', blockType: supportLog.blockType, reason: skipReason, label });
            }}
          >
            跳过整个{supportLog.blockType === 'correction' ? '纠偏模块' : '功能补丁'}
          </ActionButton>
        </Card>
      </>
    );
  };

  const renderMainStep = () => {
    if (!mainExercise) return null;
    return (
      <>
        <TrainingFocusHeroCard>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap gap-2">
                <StatusBadge tone="emerald">{blockLabel('main')}</StatusBadge>
                <StatusBadge tone={currentStep.stepType === 'warmup' ? 'amber' : 'emerald'}>{stageLabel(currentStep.stepType)}</StatusBadge>
              </div>
              <h1 className="mt-3 text-3xl font-bold leading-tight tracking-tight">{displayExerciseName(mainExercise)}</h1>
              <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold text-slate-300">
                <span>{displayMovementPattern(mainExercise)}</span>
                <span>·</span>
                <span>{displayPrimaryMuscles(mainExercise)}</span>
              </div>
            </div>
            <div className="flex shrink-0 flex-col gap-2">
              <button
                type="button"
                onClick={() => setShowExplanationSheet(true)}
                className="rounded-2xl border border-white/10 bg-white/10 px-3 py-2 text-xs font-semibold text-slate-100"
              >
                依据
              </button>
              <button
                type="button"
                onClick={() => setShowExercisePicker(true)}
                className="rounded-2xl border border-white/10 bg-white/10 px-3 py-2 text-xs font-semibold text-slate-100"
              >
                切换
              </button>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-3xl bg-white/10 p-3">
              <div className="text-xs font-semibold text-slate-300">当前组</div>
              <div className="mt-1 text-2xl font-bold">
                {currentStep.setIndex + 1}/{currentStep.totalSetsForStepType}
              </div>
              <div className="mt-1 text-xs text-slate-300">{currentStep.label}</div>
            </div>
            <div className="rounded-3xl bg-white/10 p-3">
              <div className="text-xs font-semibold text-slate-300">动作进度</div>
              <div className="mt-1 text-2xl font-bold">
                {completedMainSets.length}/{mainSets.length}
              </div>
              <div className="mt-1 text-xs text-slate-300">已完成正式组</div>
            </div>
          </div>
        </TrainingFocusHeroCard>

        {renderRestTimer()}

        <div
          ref={currentInputRef}
          className={classNames(
            'space-y-3 rounded-xl',
            showMissingInputGuide && currentSetSummary.missingInput && 'ring-2 ring-amber-300 ring-offset-2 ring-offset-slate-950',
          )}
          data-focus-actual-form-visible="false"
        >
          <SetPrescriptionCard>
            <div className="space-y-3" data-focus-recommendation-density="compact-single">
              <div className="min-w-0">
                <div className="text-xs font-semibold text-emerald-100">本组建议</div>
                <EquipmentAwareRecommendationWeight
                  exerciseName={equipmentAwareExerciseName}
                  plannedWeightKg={currentStep.plannedWeight}
                  setPurpose={currentStep.stepType === 'warmup' ? 'warmup' : 'working'}
                  unitSettings={unitSettings}
                  reps={currentStep.plannedReps}
                  compact
                  showDetails
                />
                {showMissingInputGuide && currentSetSummary.missingInput ? (
                  <div className="mt-2 rounded-2xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-sm font-semibold text-amber-100">缺少重量或次数</div>
                ) : null}
              </div>
            </div>
          </SetPrescriptionCard>
        </div>

        {completedMainSets.length ? (
          <Card className="border-white/10 bg-white/10 text-white">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <ListChecks className="h-4 w-4 text-emerald-600" />
              已完成组
            </div>
            <div className="space-y-2">
              {completedMainSets.map((set, index) => (
                <div key={set.id || `${mainExercise.id}-${index}`} className="flex items-center justify-between rounded-lg bg-white/[0.06] px-3 py-2 text-sm">
                  <span>第 {index + 1} 组</span>
                  <span className="font-semibold">
                    {formatWeight(set.actualWeightKg ?? set.weight, unitSettings)} × {set.reps} 次{set.rir !== undefined && set.rir !== '' ? ` · ${formatRirLabel(set.rir)}` : ''}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        ) : null}

        {notices.map((notice) => (
          <div key={notice.id} className="flex gap-2 rounded-lg border border-amber-400/30 bg-amber-400/10 p-3 text-sm font-semibold text-amber-100">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            {notice.message}
          </div>
        ))}

        {currentStep.stepType === 'working' && completedMainSets.length > 0 && mainExercisePoolId ? (
          <Card className="border-white/10 bg-white/10 text-white">
            <div className="mb-2 text-sm font-semibold">本次重量感觉</div>
            <div className="grid grid-cols-3 gap-2">
              {loadFeedbackOptions.map((option) => {
                const selected = existingLoadFeedback?.feedback === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => onLoadFeedback(mainExercisePoolId, option.value)}
                    className={classNames(
                      'h-11 rounded-lg border text-sm font-semibold',
                      selected ? 'border-emerald-300 bg-emerald-300/20 text-emerald-50' : 'border-white/10 bg-white/10 text-white/62',
                    )}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </Card>
        ) : null}
      </>
    );
  };

  return (
    <div className="min-h-svh bg-[#0a0a0b] px-4 pb-[calc(10.5rem+env(safe-area-inset-bottom))] pt-[calc(1rem+env(safe-area-inset-top))] text-white md:pb-6">
      <div className="mx-auto max-w-2xl space-y-3">
        <header className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-300">
              <Dumbbell className="h-4 w-4" />
              专注训练
            </div>
            <div className="mt-1 truncate text-lg font-bold">{formatTemplateName(session.templateId || session.templateName, '当前训练')}</div>
          </div>
          <div className="flex gap-2">
            {onShowFullTraining ? (
              <button type="button" onClick={onShowFullTraining} className="rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-xs font-semibold text-slate-100">
                完整页
              </button>
            ) : null}
            <button type="button" onClick={() => setSessionEndRequested(true)} className="rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-xs font-semibold text-slate-100">
              结束训练
            </button>
          </div>
        </header>

        {isSupportStep ? renderSupportStep() : renderMainStep()}
      </div>

      {feedback ? <Toast tone={feedback.tone}>{feedback.message}</Toast> : null}
      {renderExercisePicker()}
      {renderReplacementPicker()}
      {renderExplanationSheet()}
      {renderPendingConfirmation()}
      {renderActualRecordSheet()}
      {renderEndSessionSheet()}

      <FocusModeActionBar
        primaryLabel={interactionState.primaryActionLabel}
        primaryActionKind={interactionState.primaryActionKind}
        onPrimaryAction={handlePrimaryFocusAction}
        primaryDisabled={
          (interactionState.primaryActionKind === 'complete_set' ||
            interactionState.primaryActionKind === 'complete_correction' ||
            interactionState.primaryActionKind === 'complete_mobility') &&
          !canCompleteCurrentStep
        }
        secondaryActions={focusSecondaryActions}
        summary={focusActionSummary}
        warning={interactionState.warning}
      />
    </div>
  );
}
