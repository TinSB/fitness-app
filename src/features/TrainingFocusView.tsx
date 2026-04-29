import React from 'react';
import { AlertTriangle, CheckCircle, Copy, Dumbbell, ListChecks, Replace, SkipForward, Timer, XCircle } from 'lucide-react';
import { classNames, formatTimer, number } from '../engines/engineUtils';
import { dedupeFocusNotices, getFocusNavigationState } from '../engines/focusModeStateEngine';
import { getRestTimerRemainingSec } from '../engines/restTimerEngine';
import { convertKgToDisplayWeight, formatTrainingVolume, formatWeight, parseDisplayWeightToKg } from '../engines/unitConversionEngine';
import { buildSmartReplacementRecommendations, type SmartReplacementRecommendation } from '../engines/smartReplacementEngine';
import { detectSetAnomalies } from '../engines/setAnomalyEngine';
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
import type { LoadFeedbackValue, PainPattern, ReadinessResult, RestTimerState, SupportSkipReason, TrainingSession, TrainingSetLog, UnitSettings, WeightUnit } from '../models/training-model';
import { ActionButton } from '../ui/ActionButton';
import { BottomSheet } from '../ui/BottomSheet';
import { Card } from '../ui/Card';
import { StatusBadge } from '../ui/StatusBadge';
import { Toast } from '../ui/Toast';
import { WorkoutActionBar } from '../ui/WorkoutActionBar';
import { RecommendationExplanationPanel } from '../ui/RecommendationExplanationPanel';
import { buildSessionRecommendationTrace } from '../presenters/recommendationExplanationPresenter';

type EditableSetField = 'weight' | 'reps' | 'rpe' | 'rir' | 'note' | 'painFlag' | 'techniqueQuality';
type FocusBlockType = 'main' | 'correction' | 'functional';

interface TrainingFocusViewProps {
  session: TrainingSession;
  unitSettings: UnitSettings;
  restTimer: RestTimerState | null;
  expandedExercise: number;
  setExpandedExercise: React.Dispatch<React.SetStateAction<number>>;
  onSetChange: (exerciseIndex: number, setIndex: number, field: EditableSetField, value: string | boolean) => void;
  onCompleteSet: (exerciseIndex: number, advanceExercise?: boolean) => void;
  onCopyPrevious: (exerciseIndex: number) => void;
  onAdjustSet: (exerciseIndex: number, field: 'weight' | 'reps', delta: number) => void;
  onApplySuggestion: (exerciseIndex: number) => void;
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
    },
  ) => void;
  onSwitchExercise: (exerciseIndex: number) => void;
  onReplaceExercise: (exerciseIndex: number, replacementId?: string) => void;
  onLoadFeedback: (exerciseId: string, feedback: LoadFeedbackValue) => void;
  onFinish?: () => void;
  onFinishToCalendar?: () => void;
  onFinishToToday?: () => void;
  onShowFullTraining?: () => void;
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

const getSets = (exercise: TrainingSession['exercises'][number] | undefined): TrainingSetLog[] => (Array.isArray(exercise?.sets) ? exercise.sets : []);

const displayExerciseName = (exercise: TrainingSession['exercises'][number] | null | undefined) => {
  if (!exercise) return '未命名动作';
  return formatExerciseName(exercise);
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
  primary: '推荐',
  secondary: '可选',
  angle_variation: '角度变化',
  avoid: '不建议',
};

const replacementGroups: Array<{ priority: SmartReplacementRecommendation['priority']; title: string; tone: string }> = [
  { priority: 'primary', title: '推荐', tone: 'border-emerald-200 bg-emerald-50 text-emerald-800' },
  { priority: 'secondary', title: '可选', tone: 'border-sky-200 bg-sky-50 text-sky-800' },
  { priority: 'angle_variation', title: '角度变化', tone: 'border-amber-200 bg-amber-50 text-amber-800' },
  { priority: 'avoid', title: '不建议', tone: 'border-slate-200 bg-slate-100 text-slate-600' },
];

const replacementRankLabel = (rank: SmartReplacementRecommendation['priority']) => replacementRankLabels[rank] || formatReplacementCategory(rank);

export function TrainingFocusView({
  session,
  unitSettings,
  restTimer,
  expandedExercise,
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
  const [feedback, setFeedback] = React.useState('');
  const [showExercisePicker, setShowExercisePicker] = React.useState(false);
  const [showReplacementPicker, setShowReplacementPicker] = React.useState(false);
  const [showExplanationSheet, setShowExplanationSheet] = React.useState(false);
  const focusState = getFocusNavigationState(session, expandedExercise);
  const mainIndex = focusState.currentExerciseIndex;
  const mainExercise = focusState.currentExercise;
  const mainSets = getSets(mainExercise || undefined);
  const mainSetIndex = focusState.currentSetIndex;
  const mainSet = focusState.currentSet;
  const currentStep = focusState.currentStep;
  const actualDraft = focusState.actualDraft;
  const isSupportStep = currentStep.stepType === 'correction' || currentStep.stepType === 'functional' || currentStep.stepType === 'support';
  const sessionComplete = focusState.sessionComplete || Boolean(session.focusSessionComplete);
  const remainingSec = getRestTimerRemainingSec(restTimer);
  const weightUnit = unitSettings.weightUnit;
  const mainExercisePoolId = mainExercise?.canonicalExerciseId || mainExercise?.baseId || mainExercise?.id || '';
  const completedMainSets = mainSets.filter((set) => set.done);
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
          })
        : [],
    [equipmentPreferences, mainExercise, painPatterns, readinessResult, session.exercises, session.loadFeedback, trainingHistory],
  );
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

  const plannedSummary =
    isSupportStep && supportExercise
      ? `${supportExercise.sets || supportLog?.plannedSets || currentStep.totalSetsForStepType} 组${
          supportExercise.repMin || supportExercise.repMax ? ` · ${supportExercise.repMin || supportExercise.repMax}-${supportExercise.repMax || supportExercise.repMin} 次` : ''
        }${supportExercise.holdSec ? ` · 保持 ${supportExercise.holdSec} 秒` : ''}${supportTimeSec ? ` · ${supportTimeSec} 秒` : ''}${supportDistanceM ? ` · ${supportDistanceM} 米` : ''}`
      : isSupportStep
        ? '按支持动作计划完成'
        : currentStep.stepType === 'working' && mainExercise
          ? `${formatWeight(currentStep.plannedWeight, unitSettings)} × 建议 ${number(currentStep.plannedReps)} 次 · 目标范围 ${mainExercise.repMin}-${mainExercise.repMax} 次${
              currentStep.plannedRir ? ` · ${formatRirLabel(currentStep.plannedRir)}` : ''
            }`
          : `${formatWeight(currentStep.plannedWeight, unitSettings)} × ${number(currentStep.plannedReps)} 次${currentStep.plannedRir ? ` · ${formatRirLabel(currentStep.plannedRir)}` : ''}`;

  const actualWeight = actualDraft?.actualWeightKg;
  const actualReps = actualDraft?.actualReps;
  const actualRir = actualDraft?.actualRir;
  const actualDisplayWeight = actualWeight === undefined ? undefined : convertKgToDisplayWeight(actualWeight, weightUnit);
  const actualSummary = `${actualDisplayWeight === undefined ? '待输入' : `${actualDisplayWeight}${weightUnit}`} · ${actualReps === undefined ? '待输入' : `${number(actualReps)} 次`}${
    actualRir === undefined ? '' : ` · ${formatRirLabel(actualRir)}`
  }`;
  const weightAdjustments = weightUnit === 'lb' ? [-20, -10, -5, 5, 10, 20] : [-10, -5, -2.5, 2.5, 5, 10];
  const repAdjustments = [-5, -1, 1, 5];
  const canCompleteCurrentStep = isSupportStep || mainSetIndex >= 0;
  const painMarked = Boolean(actualDraft?.painFlag || (isSupportStep && skipReason === 'pain'));
  const auxiliaryActionClass = (tone: 'default' | 'pain' | 'replacement' = 'default', active = false) =>
    classNames(
      'grid min-h-14 place-items-center rounded-lg border px-2 py-2 text-center shadow-sm transition active:scale-[0.99]',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2',
      'disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 disabled:shadow-none',
      active
        ? 'border-rose-300 bg-rose-50 text-rose-800'
        : tone === 'replacement'
          ? 'border-emerald-200 bg-emerald-50 text-emerald-900 hover:border-emerald-300 hover:bg-emerald-100'
          : 'border-slate-200 bg-white text-slate-800 hover:border-emerald-200 hover:bg-emerald-50',
    );

  const notify = (message: string) => setFeedback(message);

  React.useEffect(() => {
    if (!feedback) return undefined;
    const timer = window.setTimeout(() => setFeedback(''), 2500);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  const switchExercise = (index: number) => {
    const exercise = session.exercises[index];
    if (!exercise) return;
    onSwitchExercise(index);
    setShowExercisePicker(false);
    notify(`已切换到 ${displayExerciseName(exercise)}`);
  };

  const copyPrevious = () => {
    if (isSupportStep) {
      notify('当前辅助动作暂无上一组可复制');
      return;
    }
    if (mainIndex < 0 || mainSetIndex <= 0) {
      notify('暂无上一组可复制');
      return;
    }
    onCopyPrevious(mainIndex);
    notify('已复制上一组');
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
    onUpdateActualDraft(mainIndex, { painFlag });
    notify(painFlag ? '已标记本组不适' : '已取消不适标记');
  };

  const openReplacementPicker = () => {
    if (mainIndex < 0 || !mainExercise) {
      notify('当前动作暂无可替代动作。');
      return;
    }
    if (!replacementOptions.length) {
      notify('当前动作暂无可替代动作。');
      return;
    }
    setShowReplacementPicker(true);
  };

  const chooseReplacement = (option: SmartReplacementRecommendation) => {
    if (mainIndex < 0) return;
    onReplaceExercise(mainIndex, option.exerciseId);
    setShowReplacementPicker(false);
    notify(`已替换为：${displayReplacementName(option)}`);
  };

  const completeCurrentSet = () => {
    if (sessionComplete) {
      notify('训练已完成');
      return;
    }
    if (isSupportStep && supportLog) {
      onCompleteSupportSet(supportLog.moduleId, supportLog.exerciseId);
      notify(currentStep.stepType === 'correction' ? '已完成纠偏组' : '已完成功能补丁');
      return;
    }
    if (mainIndex < 0 || mainSetIndex < 0) return;
    if (number(actualDraft?.actualWeightKg) <= 0 && number(actualDraft?.actualReps) <= 0) {
      notify('请先记录重量/次数，或点套用建议');
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
      unitSettings,
      plannedPrescription: {
        plannedWeight: currentStep.plannedWeight,
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
      const confirmed =
        typeof window === 'undefined'
          ? true
          : window.confirm(
              [
                `输入异常提示：${blockingAnomaly.title}`,
                blockingAnomaly.message,
                blockingAnomaly.suggestedAction,
                '仍要保存这一组吗？',
              ]
                .filter(Boolean)
                .join('\n'),
            );
      if (!confirmed) {
        notify('已取消保存，请先检查本组记录');
        return;
      }
    }
    const warningAnomaly = anomalies.find((item) => item.severity !== 'critical' && !item.requiresConfirmation);
    onCompleteSet(mainIndex);
    notify(warningAnomaly ? `输入异常提示：${warningAnomaly.title}` : currentStep.stepType === 'warmup' ? '已完成热身组' : '已完成正式组');
  };

  const updateDisplayWeight = (nextDisplayWeight: number) => {
    if (mainIndex < 0) return;
    const safeDisplayWeight = Math.max(0, nextDisplayWeight);
    onUpdateActualDraft(mainIndex, {
      actualWeightKg: parseDisplayWeightToKg(safeDisplayWeight, weightUnit),
      displayWeight: safeDisplayWeight,
      displayUnit: weightUnit,
    });
  };

  const updateActualReps = (nextReps: number) => {
    if (mainIndex < 0) return;
    onUpdateActualDraft(mainIndex, { actualReps: Math.max(0, Math.round(nextReps)) });
  };

  const updateActualRir = (nextRir: number) => {
    if (mainIndex < 0) return;
    onUpdateActualDraft(mainIndex, { actualRir: Math.max(0, Math.min(10, Math.round(nextRir))) });
  };

  const renderCompletedState = () => (
    <div className="min-h-svh bg-slate-950 px-4 pb-6 pt-[calc(1rem+env(safe-area-inset-top))] text-white">
      <div className="mx-auto flex min-h-[80svh] max-w-2xl flex-col justify-center">
        <Card className="border-emerald-400/20 bg-white p-5 text-center text-slate-950">
          <CheckCircle className="mx-auto h-10 w-10 text-emerald-600" />
          <h2 className="mt-4 text-2xl font-bold">本次训练已完成</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">保存后会进入训练历史、日历和记录详情。</p>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-emerald-50 p-4">
              <div className="text-xs font-semibold text-emerald-700">完成组数</div>
              <div className="mt-1 text-2xl font-bold text-emerald-950">
                {focusState.completedSets}/{focusState.totalSets}
              </div>
            </div>
            <div className="rounded-lg bg-stone-50 p-4">
              <div className="text-xs font-semibold text-slate-500">当前总量</div>
              <div className="mt-1 text-2xl font-bold text-slate-950">{formatTrainingVolume(focusState.totalVolume, unitSettings)}</div>
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
          const done = sets.filter((set) => set.done).length;
          const selected = index === mainIndex;
          return (
            <button
              key={`${exercise.id}-picker-${index}`}
              type="button"
              onClick={() => switchExercise(index)}
              className={classNames(
                'flex w-full items-center justify-between rounded-lg px-3 py-3 text-left',
                selected ? 'bg-emerald-50 ring-1 ring-emerald-200' : 'bg-stone-50',
              )}
            >
              <span className="font-semibold text-slate-900">{displayExerciseName(exercise)}</span>
              <span className="text-sm font-semibold text-slate-600">
                {done}/{sets.length}
              </span>
            </button>
          );
        })}
      </div>
    </BottomSheet>
  );

  const renderReplacementPicker = () => (
    <BottomSheet open={showReplacementPicker} title="选择本次实际执行动作" onClose={() => setShowReplacementPicker(false)}>
      <p className="mb-3 text-xs leading-5 text-slate-500">保留当前模板位置；训练量计入本次训练，PR / e1RM 按实际动作独立统计。</p>
      <div className="space-y-4">
        {replacementOptions.length ? (
          replacementGroups.map((group) => {
            const groupOptions = replacementOptions.filter((option) => option.priority === group.priority);
            if (!groupOptions.length) return null;
            return (
              <section key={group.priority} className="space-y-2">
                <div className="text-xs font-bold text-slate-500">{group.title}</div>
                {groupOptions.map((option) => (
                  <button
                    key={option.exerciseId}
                    type="button"
                    onClick={() => chooseReplacement(option)}
                    className={classNames(
                      'w-full rounded-lg border p-3 text-left transition hover:border-emerald-200 hover:bg-emerald-50',
                      option.priority === 'avoid' ? 'border-slate-200 bg-slate-50' : 'border-slate-200 bg-stone-50',
                    )}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold text-slate-950">{displayReplacementName(option)}</span>
                      <span className={classNames('rounded-md border px-2 py-1 text-xs font-semibold', group.tone)}>{replacementRankLabel(option.priority)}</span>
                    </div>
                    <div className="mt-2 text-xs leading-5 text-slate-600">{option.reason}</div>
                    {option.warnings.length ? (
                      <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-semibold leading-5 text-amber-900">
                        {option.warnings[0]}
                      </div>
                    ) : null}
                    <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-semibold text-slate-500">
                      <span>疲劳成本：{formatFatigueCost(option.fatigueCost)}</span>
                      <span>PR / e1RM 独立统计</span>
                    </div>
                  </button>
                ))}
              </section>
            );
          })
        ) : (
          <div className="rounded-lg border border-slate-200 bg-stone-50 p-4 text-sm font-semibold text-slate-600">当前动作暂无可替代动作</div>
        )}
      </div>
    </BottomSheet>
  );

  const renderExplanationSheet = () => (
    <BottomSheet open={showExplanationSheet} title="推荐依据" onClose={() => setShowExplanationSheet(false)}>
      <RecommendationExplanationPanel trace={recommendationTrace} compact maxVisibleFactors={3} defaultOpen />
    </BottomSheet>
  );

  const renderRestTimer = () =>
    remainingSec > 0 ? (
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
      </Card>
    ) : null;

  const renderSupportStep = () => {
    if (!supportLog) return null;
    const supportTitle = formatExerciseName({ id: supportLog.exerciseId, name: supportExercise?.name || supportLog.exerciseName || currentStep.exerciseName });
    const supportModuleName = supportBlock?.name || currentStep.moduleName || blockLabel(blockType);
    return (
      <>
        <Card className="border-white/10 bg-white text-slate-950">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              <StatusBadge tone={blockType === 'correction' ? 'amber' : 'sky'}>{blockLabel(blockType)}</StatusBadge>
              <StatusBadge tone="slate">{stageLabel(currentStep.stepType)}</StatusBadge>
            </div>
            <button
              type="button"
              onClick={() => setShowExplanationSheet(true)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
            >
              依据
            </button>
          </div>
          <h1 className="mt-3 text-3xl font-bold tracking-tight">{supportTitle}</h1>
          <p className="mt-1 text-sm font-medium text-slate-500">{supportModuleName}</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-stone-50 p-3">
              <div className="text-xs font-semibold text-slate-500">当前组</div>
              <div className="mt-1 text-2xl font-bold">
                {supportLog.completedSets || 0}/{supportLog.plannedSets || currentStep.totalSetsForStepType}
              </div>
            </div>
            <div className="rounded-lg bg-stone-50 p-3">
              <div className="text-xs font-semibold text-slate-500">建议</div>
              <div className="mt-1 text-sm font-semibold leading-6">{plannedSummary}</div>
            </div>
          </div>
        </Card>

        <Card className="border-white/10 bg-white text-slate-950">
          <div className="text-sm font-semibold">跳过原因</div>
          <select
            value={skipReason}
            onChange={(event) => {
              const next = event.target.value as SupportSkipReason;
              setSkipReason(next);
              onUpdateSupportSkipReason(supportLog.moduleId, supportLog.exerciseId, next);
            }}
            className="mt-2 h-12 w-full rounded-lg border border-slate-200 bg-white px-3 text-base font-semibold text-slate-700"
          >
            {supportReasonOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
            <ActionButton type="button" variant="primary" size="lg" onClick={() => onCompleteSupportSet(supportLog.moduleId, supportLog.exerciseId)} fullWidth>
              完成一组
            </ActionButton>
            <button
              type="button"
              aria-label="跳过当前支持动作"
              onClick={() => onSkipSupportExercise(supportLog.moduleId, supportLog.exerciseId, skipReason)}
              className="grid h-14 w-14 place-items-center rounded-lg border border-amber-200 bg-amber-50 text-amber-900"
            >
              <SkipForward className="h-5 w-5" />
            </button>
          </div>
          <ActionButton
            type="button"
            variant="ghost"
            size="md"
            fullWidth
            className="mt-2"
            onClick={() => {
              const label = supportLog.blockType === 'correction' ? '纠偏模块' : '功能补丁';
              const confirmed = typeof window === 'undefined' ? true : window.confirm(`跳过整个${label}？未完成的支持动作会记录为跳过。`);
              if (!confirmed) return;
              onSkipSupportBlock(supportLog.blockType, skipReason);
              notify(`已跳过${label}`);
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
        <Card className="border-white/10 bg-white text-slate-950">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap gap-2">
                <StatusBadge tone="emerald">{blockLabel('main')}</StatusBadge>
                <StatusBadge tone={currentStep.stepType === 'warmup' ? 'amber' : 'emerald'}>{stageLabel(currentStep.stepType)}</StatusBadge>
              </div>
              <h1 className="mt-3 text-3xl font-bold leading-tight tracking-tight">{displayExerciseName(mainExercise)}</h1>
              <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold text-slate-500">
                <span>{displayMovementPattern(mainExercise)}</span>
                <span>·</span>
                <span>{displayPrimaryMuscles(mainExercise)}</span>
              </div>
            </div>
            <div className="flex shrink-0 flex-col gap-2">
              <button
                type="button"
                onClick={() => setShowExplanationSheet(true)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
              >
                依据
              </button>
              <button
                type="button"
                onClick={() => setShowExercisePicker(true)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600"
              >
                切换
              </button>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-stone-50 p-3">
              <div className="text-xs font-semibold text-slate-500">当前组</div>
              <div className="mt-1 text-2xl font-bold">
                {currentStep.setIndex + 1}/{currentStep.totalSetsForStepType}
              </div>
              <div className="mt-1 text-xs text-slate-500">{currentStep.label}</div>
            </div>
            <div className="rounded-lg bg-stone-50 p-3">
              <div className="text-xs font-semibold text-slate-500">动作进度</div>
              <div className="mt-1 text-2xl font-bold">
                {completedMainSets.length}/{mainSets.length}
              </div>
              <div className="mt-1 text-xs text-slate-500">已完成正式组</div>
            </div>
          </div>
        </Card>

        {renderRestTimer()}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Card className="border-white/10 bg-white text-slate-950">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold text-slate-500">推荐处方</div>
                <div className="mt-2 text-lg font-bold leading-7">{plannedSummary}</div>
              </div>
              <ActionButton
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  onApplySuggestion(mainIndex);
                  notify('已套用建议重量和次数');
                }}
              >
                套用建议
              </ActionButton>
            </div>
          </Card>
          <Card className="border-white/10 bg-white text-slate-950">
            <div className="text-xs font-semibold text-slate-500">实际记录</div>
            <div className="mt-2 text-2xl font-bold">{actualSummary}</div>
            <div className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{mainExercise.lastSummary || '暂无上一条同动作记录'}</div>
          </Card>
        </div>

        <Card className="border-white/10 bg-white text-slate-950">
          <div className="text-sm font-semibold">重量（{weightUnit}）</div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {weightAdjustments.map((delta) => (
              <button
                key={`weight-${delta}`}
                type="button"
                aria-label={`重量${delta > 0 ? '增加' : '减少'} ${Math.abs(delta)}${weightUnit}`}
                onClick={() => {
                  updateDisplayWeight(number(actualDisplayWeight) + delta);
                  notify('已调整重量');
                }}
                className="h-12 rounded-lg border border-slate-200 bg-white text-base font-semibold text-slate-700"
              >
                {delta > 0 ? `+${delta}` : delta}
              </button>
            ))}
          </div>
          <label className="mt-3 block text-xs font-semibold text-slate-500">
            自定义重量
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step={weightUnit === 'lb' ? '1' : '0.5'}
              value={actualDisplayWeight ?? ''}
              onChange={(event) => updateDisplayWeight(number(event.target.value))}
              className="mt-1 h-12 w-full rounded-lg border border-slate-200 px-3 text-base font-semibold text-slate-900"
              placeholder={`0${weightUnit}`}
            />
          </label>
        </Card>

        <Card className="border-white/10 bg-white text-slate-950">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-sm font-semibold">次数</div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {repAdjustments.map((delta) => (
                  <button
                    key={`rep-${delta}`}
                    type="button"
                    aria-label={`次数${delta > 0 ? '增加' : '减少'} ${Math.abs(delta)} 次`}
                    onClick={() => {
                      updateActualReps(number(actualReps) + delta);
                      notify('已调整次数');
                    }}
                    className="h-12 rounded-lg border border-slate-200 bg-white text-base font-semibold text-slate-700"
                  >
                    {delta > 0 ? `+${delta}` : delta}
                  </button>
                ))}
              </div>
              <input
                type="number"
                inputMode="numeric"
                min="0"
                step="1"
                value={actualReps ?? ''}
                onChange={(event) => updateActualReps(number(event.target.value))}
                className="mt-2 h-12 w-full rounded-lg border border-slate-200 px-3 text-base font-semibold text-slate-900"
                placeholder="0 次"
              />
            </div>
            <div>
              <div className="text-sm font-semibold">余力（RIR）</div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {[0, 1, 2, 3, 4, 5].map((rir) => (
                  <button
                    key={rir}
                    type="button"
                    onClick={() => updateActualRir(rir)}
                    className={classNames(
                      'h-12 rounded-lg border text-sm font-semibold',
                      actualRir === rir ? 'border-emerald-500 bg-emerald-50 text-emerald-900' : 'border-slate-200 bg-white text-slate-700',
                    )}
                  >
                    {rir}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Card>

        {completedMainSets.length ? (
          <Card className="border-white/10 bg-white text-slate-950">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <ListChecks className="h-4 w-4 text-emerald-600" />
              已完成组
            </div>
            <div className="space-y-2">
              {completedMainSets.map((set, index) => (
                <div key={set.id || `${mainExercise.id}-${index}`} className="flex items-center justify-between rounded-lg bg-stone-50 px-3 py-2 text-sm">
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
          <div key={notice.id} className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            {notice.message}
          </div>
        ))}

        <details className="rounded-lg border border-white/10 bg-white/10 p-3 text-white">
          <summary className="cursor-pointer list-none text-sm font-semibold text-slate-200">查看动作顺序</summary>
          <div className="mt-3 space-y-2">
            {session.exercises.map((exercise, index) => {
              const sets = getSets(exercise);
              const done = sets.filter((set) => set.done).length;
              const selected = index === mainIndex;
              return (
                <button
                  key={`${exercise.id}-${index}`}
                  type="button"
                  onClick={() => switchExercise(index)}
                  className={classNames('flex w-full items-center justify-between rounded-lg px-3 py-3 text-left', selected ? 'bg-emerald-500 text-slate-950' : 'bg-white/10 text-white')}
                >
                  <span className="font-semibold">{displayExerciseName(exercise)}</span>
                  <span className="text-sm font-semibold">
                    {done}/{sets.length}
                  </span>
                </button>
              );
            })}
          </div>
        </details>

        {currentStep.stepType === 'working' && completedMainSets.length > 0 && mainExercisePoolId ? (
          <Card className="border-white/10 bg-white text-slate-950">
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
                      selected ? 'border-emerald-500 bg-emerald-50 text-emerald-900' : 'border-slate-200 bg-white text-slate-600',
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
    <div className="min-h-svh bg-slate-950 px-4 pb-[calc(10.5rem+env(safe-area-inset-bottom))] pt-[calc(1rem+env(safe-area-inset-top))] text-white md:pb-6">
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
            <button type="button" onClick={onFinish} className="rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-xs font-semibold text-slate-100">
              结束
            </button>
          </div>
        </header>

        {isSupportStep ? renderSupportStep() : renderMainStep()}
      </div>

      {feedback ? <Toast>{feedback}</Toast> : null}
      {renderExercisePicker()}
      {renderReplacementPicker()}
      {renderExplanationSheet()}

      <WorkoutActionBar className="border-slate-200 bg-white text-slate-950 md:static md:bg-transparent">
        <div className="mx-auto grid w-full max-w-2xl gap-2">
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              aria-label="复制上组"
              onClick={copyPrevious}
              className={auxiliaryActionClass()}
            >
              <Copy className="h-4 w-4" />
              <span className="text-xs font-semibold leading-tight">复制上组</span>
            </button>
            <button
              type="button"
              aria-label="标记不适"
              onClick={() => markPain(!painMarked)}
              className={auxiliaryActionClass('pain', painMarked)}
            >
              <XCircle className="h-4 w-4" />
              <span className="text-xs font-semibold leading-tight">标记不适</span>
            </button>
            <button
              type="button"
              aria-label="替代动作"
              onClick={openReplacementPicker}
              className={auxiliaryActionClass('replacement')}
            >
              <Replace className="h-4 w-4" />
              <span className="text-xs font-bold leading-tight">替代动作</span>
            </button>
          </div>
          <ActionButton
            type="button"
            aria-label="完成一组"
            onClick={completeCurrentSet}
            disabled={!canCompleteCurrentStep}
            variant="primary"
            size="lg"
            fullWidth
            className="shadow-lg shadow-emerald-900/20"
          >
            完成一组
          </ActionButton>
        </div>
      </WorkoutActionBar>
    </div>
  );
}
