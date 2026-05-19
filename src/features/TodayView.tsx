import React from 'react';
import { CalendarDays, ChevronDown, ChevronRight, Play, RotateCcw } from 'lucide-react';
import { AVAILABLE_TIME_OPTIONS, ENERGY_STATES, SLEEP_STATES } from '../models/training-model';
import { classNames, number, todayKey } from '../engines/engineUtils';
import { applyStatusRules } from '../engines/progressionEngine';
import { buildSupportPlan } from '../engines/supportPlanEngine';
import { getCurrentMesocycleWeek } from '../engines/mesocycleEngine';
import { type AutoTrainingLevel } from '../engines/trainingLevelEngine';
import { toStatusRulesDecisionContext } from '../engines/trainingDecisionContext';
import { buildEnginePipeline } from '../engines/enginePipeline';
import { buildTodayDecisionSurface } from '../engines/todayDecisionSurface';
import { buildTrainingLevelExplanation } from '../engines/explainability/trainingExplainability';
import { buildRecommendationTrace } from '../engines/recommendationTraceEngine';
import type { CoachAutomationSummary } from '../engines/coachAutomationEngine';
import type { CoachAction } from '../engines/coachActionEngine';
import type { TrainingIntelligenceSummary } from '../engines/trainingIntelligenceSummaryEngine';
import type { RecoveryAwareRecommendation } from '../engines/recoveryAwareScheduler';
import type { SessionPatch } from '../engines/sessionPatchEngine';
import {
  buildTodayTrainingFocusSelection,
  type TodayTrainingFocusOverrideOption,
  type TodayTrainingFocusSelection,
} from '../engines/todayTrainingFocusOverrideEngine';
import { formatCyclePhase, formatExerciseName, formatIntensityBias, formatRirLabel, formatTemplateName, formatTrainingMode } from '../i18n/formatters';
import { buildCoachActionListViewModel } from '../presenters/coachActionPresenter';
import { splitCoachReminders, type CoachReminderView } from '../presenters/coachReminderPresenter';
import { buildDataHealthViewModel } from '../presenters/dataHealthPresenter';
import { buildTodayViewModel } from '../presenters/todayPresenter';
import type { AppData, ExercisePrescription, TrainingMode, TrainingTemplate, WeeklyPrescription } from '../models/training-model';
import { ActionButton } from '../ui/ActionButton';
import { Card } from '../ui/Card';
import { MetricCard } from '../ui/MetricCard';
import { PageHeader } from '../ui/PageHeader';
import { PageSection } from '../ui/PageSection';
import { StatusBadge } from '../ui/StatusBadge';
import { RecommendationExplanationPanel } from '../ui/RecommendationExplanationPanel';
import { CoachActionList } from '../ui/CoachActionList';
import { useConfirmDialog } from '../ui/useConfirmDialog';
import { DashboardLayout } from '../ui/layouts/DashboardLayout';
import { ResponsivePageLayout } from '../ui/layouts/ResponsivePageLayout';
import { ActionButton as UiOsActionButton } from '../uiOs/primitives/ActionButton';
import { GlassCard } from '../uiOs/primitives/GlassCard';
import { SafetyStrip } from '../uiOs/surfaces/SafetyStrip';
import { TodayActiveSessionNotice } from '../uiOs/today/TodayActiveSessionNotice';
import { TodayDecisionHero } from '../uiOs/today/TodayDecisionHero';
import { TodayFocusOverridePanel } from '../uiOs/today/TodayFocusOverridePanel';
import { TodayReadinessSummary } from '../uiOs/today/TodayReadinessSummary';
import { TodaySevereRiskNotice } from '../uiOs/today/TodaySevereRiskNotice';
import { UnfinishedSessionNotice } from '../uiOs/training/TrainingOsCards';

interface TodayViewProps {
  data: AppData;
  selectedTemplate: TrainingTemplate;
  suggestedTemplate: TrainingTemplate;
  todayFocusSelection?: TodayTrainingFocusSelection;
  recoveryRecommendation?: RecoveryAwareRecommendation;
  weeklyPrescription: WeeklyPrescription;
  coachActions?: CoachAction[];
  trainingIntelligenceSummary?: TrainingIntelligenceSummary;
  trainingMode: TrainingMode;
  onModeChange: (mode: TrainingMode) => void;
  onStatusChange: (field: 'sleep' | 'energy' | 'time', value: string) => void;
  onSorenessToggle: (part: AppData['todayStatus']['soreness'][number]) => void;
  onFocusOverrideChange?: (override: TodayTrainingFocusOverrideOption) => void;
  onTemplateSelect: (id: string) => void;
  onUseSuggestion: () => void;
  onStart: () => void;
  onStartRecommended?: (templateId: string) => void;
  onResume: () => void;
  onViewSession?: (sessionId: string, date?: string) => void;
  onViewCalendar?: (date?: string) => void;
  onReviewDataHealth?: () => void;
  onCoachAction?: (action: CoachAction) => void;
  onDismissCoachAction?: (action: CoachAction) => void;
  temporarySessionAdjustmentActive?: boolean;
  pendingSessionPatches?: SessionPatch[];
  onRevertTemporarySessionPatches?: () => void;
}

const sorenessOptions: AppData['todayStatus']['soreness'] = ['无', '胸', '背', '腿', '肩', '手臂'];

const trainingLevelLabels: Record<AutoTrainingLevel, string> = {
  unknown: '正在建立基线',
  beginner: '新手阶段',
  novice_plus: '入门进阶',
  intermediate: '中阶',
  advanced: '高阶',
};

const readinessTone = (level?: string) => {
  if (level === 'green' || level === 'high') return 'emerald' as const;
  if (level === 'yellow' || level === 'medium') return 'amber' as const;
  if (level === 'red' || level === 'low') return 'rose' as const;
  return 'slate' as const;
};

const templateLabel = (template: Pick<TrainingTemplate, 'id' | 'name'>) => formatTemplateName(template, '未命名训练');

const sessionTemplateLabel = (session?: { templateId?: string; templateName?: string; focus?: string }) =>
  session?.templateId
    ? formatTemplateName(session.templateId, '本次训练')
    : session?.templateName
      ? formatTemplateName(session.templateName, '本次训练')
      : session?.focus || '本次训练';

const exerciseLabel = (exercise: ExercisePrescription) => formatExerciseName(exercise);

const formatExercisePrescription = (exercise: ExercisePrescription) => {
  const sets = Array.isArray(exercise.sets) ? exercise.sets.length : number(exercise.sets);
  const restSec = number(exercise.prescription?.restSec || exercise.rest || 90);
  return `${sets} 组 · ${exercise.repMin}-${exercise.repMax} 次 · 休息 ${Math.round(restSec / 60)} 分钟`;
};

const recoveryExerciseLabel = (action: string) => {
  if (action === 'substitute') return '建议替代';
  if (action === 'skip') return '建议跳过';
  if (action === 'reduce_intensity' || action === 'reduce_volume') return '降低强度';
  return '可保留';
};

const recoveryExerciseTone = (label: string) => {
  if (label === '建议替代' || label === '建议跳过') return 'amber' as const;
  if (label === '降低强度') return 'sky' as const;
  return 'emerald' as const;
};

type PreviewBadge = { label: string; tone: 'slate' | 'emerald' | 'amber' | 'rose' | 'sky' };

type SupportPreviewItem = {
  id: string;
  name: string;
  label: string;
};

const supportPreviewItems = (supportPlan: ReturnType<typeof buildSupportPlan>): SupportPreviewItem[] => [
  ...(supportPlan.correctionModules || []).flatMap((module) =>
    module.exercises.map((exercise) => ({
      id: `${module.id}:${exercise.exerciseId}`,
      name: formatExerciseName({ id: exercise.exerciseId, name: exercise.name }),
      label: '本次跳过',
    })),
  ),
  ...(supportPlan.functionalAddons || []).flatMap((addon) =>
    addon.exercises.map((exercise) => ({
      id: `${addon.id}:${exercise.exerciseId}`,
      name: formatExerciseName({ id: exercise.exerciseId, name: exercise.name }),
      label: '本次跳过',
    })),
  ),
];

const patchTargetsExercise = (patch: SessionPatch, exercise: ExercisePrescription) =>
  Boolean(
    patch.targetId &&
      [exercise.id, exercise.baseId, exercise.canonicalExerciseId, exercise.originalExerciseId, exercise.actualExerciseId].filter(Boolean).includes(patch.targetId),
  );

const patchBadgeForExercise = (exercise: ExercisePrescription, patches: SessionPatch[]): PreviewBadge | null => {
  if (!patches.length) return null;
  if (patches.some((patch) => patch.type === 'substitute_exercise' && patchTargetsExercise(patch, exercise))) return { label: '建议替代', tone: 'amber' };
  if (patches.some((patch) => patch.type === 'skip_optional' && patchTargetsExercise(patch, exercise))) return { label: '本次跳过', tone: 'amber' };
  if (patches.some((patch) => patch.type === 'reduce_intensity' && (!patch.targetId || patchTargetsExercise(patch, exercise)))) return { label: '降低强度', tone: 'sky' };
  if (patches.some((patch) => patch.type === 'reduce_volume' && (!patch.targetId || patchTargetsExercise(patch, exercise)))) return { label: '控制总量', tone: 'sky' };
  if (patches.some((patch) => patch.type === 'main_only' || patch.type === 'reduce_support')) return { label: '保留', tone: 'emerald' };
  return null;
};

const temporaryPatchSummary = (patches: SessionPatch[], supportPlan: ReturnType<typeof buildSupportPlan>) => {
  const supportCount = supportPreviewItems(supportPlan).length;
  const summaries = new Set<string>();
  patches.forEach((patch) => {
    if (patch.type === 'reduce_support') summaries.add(supportCount ? `减少/跳过 ${supportCount} 个辅助内容` : '减少辅助内容');
    else if (patch.type === 'main_only') summaries.add('主训练保留，纠偏和功能补丁本次跳过');
    else if (patch.type === 'reduce_intensity') summaries.add('不主动加重，降低本次强度');
    else if (patch.type === 'reduce_volume') summaries.add('不额外加组，控制本次总量');
    else if (patch.type === 'substitute_exercise') summaries.add('高冲突动作会在训练中提示替代');
    else if (patch.type === 'extend_rest') summaries.add('组间休息略延长');
    else if (patch.type === 'skip_optional') summaries.add('跳过本次可选内容');
  });
  if (patches.length) summaries.add('只影响本次训练，不修改原模板');
  return [...summaries];
};

const ChoiceRow = ({
  value,
  options,
  labels,
  onChange,
}: {
  value: string;
  options: readonly string[];
  labels?: Partial<Record<string, string>>;
  onChange: (value: string) => void;
}) => (
  <div className="grid grid-cols-3 gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1">
    {options.map((option) => {
      const selected = value === option;
      return (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          className={classNames(
            'min-h-10 rounded-md px-3 py-2 text-sm font-medium transition',
            selected ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500 hover:text-slate-900',
          )}
        >
          {labels?.[option] ?? option}
        </button>
      );
    })}
  </div>
);

const TodayFocusOverrideControl = ({
  selection,
  onChange,
  expanded,
  onToggleExpanded,
  embedded = false,
}: {
  selection: TodayTrainingFocusSelection;
  onChange?: (override: TodayTrainingFocusOverrideOption) => void;
  expanded: boolean;
  onToggleExpanded: () => void;
  embedded?: boolean;
}) => <TodayFocusOverridePanel selection={selection} onChange={onChange} compact expanded={expanded} embedded={embedded} onToggleExpanded={onToggleExpanded} />;

export function TodayView({
  data,
  selectedTemplate,
  suggestedTemplate,
  todayFocusSelection,
  recoveryRecommendation,
  weeklyPrescription,
  coachActions,
  trainingIntelligenceSummary,
  trainingMode,
  onModeChange,
  onStatusChange,
  onSorenessToggle,
  onFocusOverrideChange,
  onUseSuggestion,
  onStart,
  onStartRecommended,
  onResume,
  onViewSession,
  onViewCalendar,
  onReviewDataHealth,
  onCoachAction,
  onDismissCoachAction,
  temporarySessionAdjustmentActive,
  pendingSessionPatches = [],
  onRevertTemporarySessionPatches,
}: TodayViewProps) {
  const [coachActionFeedback, setCoachActionFeedback] = React.useState('');
  const [focusOverrideExpanded, setFocusOverrideExpanded] = React.useState(false);
  const { confirm, ConfirmDialogHost } = useConfirmDialog();
  const enginePipeline = React.useMemo(
    () => buildEnginePipeline(data, todayKey(), { trainingMode, coachActions }),
    [data, trainingMode, coachActions],
  );
  const decisionContext = React.useMemo(
    () => enginePipeline.context,
    [
      enginePipeline.context,
    ],
  );
  const resolvedTodayFocusSelection = React.useMemo(
    () =>
      todayFocusSelection ||
      buildTodayTrainingFocusSelection({
        systemTemplate: suggestedTemplate,
        templates: data.templates || [],
        override: 'system',
        todayStatus: decisionContext.todayStatus,
        history: decisionContext.history,
      }),
    [todayFocusSelection, suggestedTemplate, data.templates, decisionContext.todayStatus, decisionContext.history],
  );

  const adjustedPlan = applyStatusRules(
    selectedTemplate,
    decisionContext.todayStatus,
    decisionContext.trainingMode,
    weeklyPrescription,
    decisionContext.history,
    decisionContext.screeningProfile,
    decisionContext.mesocyclePlan,
    toStatusRulesDecisionContext(decisionContext),
  );

  const todayTrainingState = enginePipeline.todayState;
  const completedSession =
    todayTrainingState.status === 'completed'
      ? data.history.find((session) => session.id === todayTrainingState.lastCompletedSessionId)
      : undefined;

  const selectedTemplateName = templateLabel(selectedTemplate);
  const completedTrainingName = sessionTemplateLabel(completedSession);
  const activeTrainingName = data.activeSession?.templateId
    ? formatTemplateName(data.activeSession.templateId, '当前训练')
    : formatTemplateName(data.activeSession?.templateName, selectedTemplateName);
  const todayViewModel = buildTodayViewModel({
    todayState: todayTrainingState,
    selectedTemplate: { ...selectedTemplate, name: selectedTemplateName },
    completedTemplateName: completedTrainingName,
    activeTemplateName: activeTrainingName,
    nextSuggestion: resolvedTodayFocusSelection.overrideActive ? selectedTemplate : suggestedTemplate,
    nextWorkout: resolvedTodayFocusSelection.overrideActive ? undefined : enginePipeline.nextWorkout,
    recoveryRecommendation,
  });

  const adjustedExercises = adjustedPlan.exercises as ExercisePrescription[];
  const previewExercises = adjustedExercises.slice(0, 2);
  const hiddenExerciseCount = Math.max(0, adjustedExercises.length - previewExercises.length);
  const trainingLevelAssessment = decisionContext.trainingLevelAssessment;
  const supportPlan = buildSupportPlan(data, selectedTemplate);
  const temporaryAdjustmentSummaries = React.useMemo(
    () => temporaryPatchSummary(pendingSessionPatches, supportPlan),
    [pendingSessionPatches, supportPlan],
  );
  const temporarySkippedSupportItems = React.useMemo(() => {
    if (!pendingSessionPatches.some((patch) => patch.type === 'reduce_support' || patch.type === 'main_only' || patch.type === 'skip_optional')) return [];
    return supportPreviewItems(supportPlan);
  }, [pendingSessionPatches, supportPlan]);
  const mesocycleWeek = getCurrentMesocycleWeek(data.mesocyclePlan);
  const readinessScore = adjustedPlan.readinessResult?.score;
  const readinessReasons = adjustedPlan.readinessResult?.reasons || adjustedPlan.readiness.reasons || [];
  const explanationTemplate =
    todayTrainingState.status === 'completed'
      ? suggestedTemplate
      : todayTrainingState.status === 'in_progress' && data.activeSession?.templateId
        ? data.templates.find((template) => template.id === data.activeSession?.templateId) || selectedTemplate
        : recoveryRecommendation?.templateId
          ? data.templates.find((template) => template.id === recoveryRecommendation.templateId) || selectedTemplate
          : selectedTemplate;
  const recommendationTrace = React.useMemo(
    () =>
      buildRecommendationTrace({
        ...data,
        template: explanationTemplate,
        sessionTemplateId: explanationTemplate.id,
        trainingMode,
        weeklyPrescription,
        history: decisionContext.history,
        todayStatus: decisionContext.todayStatus,
        screeningProfile: decisionContext.screeningProfile,
        mesocyclePlan: decisionContext.mesocyclePlan,
        healthMetricSamples: decisionContext.healthMetricSamples,
        importedWorkoutSamples: decisionContext.importedWorkoutSamples,
      }),
    [data, explanationTemplate, trainingMode, weeklyPrescription, decisionContext]
  );
  const recommendationExplanationTitle = todayTrainingState.status === 'completed' ? '为什么这样建议下次训练？' : '为什么这样推荐？';
  const currentTrainingName = todayViewModel.currentTrainingName;
  const decisionText = todayViewModel.decisionText;
  const nextSuggestion = todayViewModel.nextSuggestion;
  const hasAlternativeSuggestion = !resolvedTodayFocusSelection.overrideActive && Boolean(nextSuggestion.templateId && nextSuggestion.templateId !== selectedTemplate.id);
  const todayNote =
    readinessReasons[0] ||
    (trainingLevelAssessment.level === 'unknown'
      ? '系统还在建立训练基线，今天的建议会保持保守。'
      : '今天优先完成主训练，细节记录放到训练页处理。');
  const coachActionListViewModel = React.useMemo(
    () =>
      buildCoachActionListViewModel(
        enginePipeline.visibleCoachActions.filter((action) => action.source !== 'dataHealth' && action.actionType !== 'open_data_health'),
        { surface: 'today', maxVisible: 2 },
      ),
    [enginePipeline.visibleCoachActions],
  );
  const dataHealthViewModel = React.useMemo(
    () => buildDataHealthViewModel(enginePipeline.dataHealth),
    [enginePipeline.dataHealth],
  );
  const shouldUseDataHealthActionCopy = dataHealthViewModel && dataHealthViewModel.statusTone !== 'healthy';
  const severeDataHealthNotice =
    dataHealthViewModel?.statusTone === 'error'
      ? {
          title: dataHealthViewModel.primaryIssues[0]?.title || dataHealthViewModel.statusLabel,
          message: dataHealthViewModel.primaryIssues[0]?.userMessage || dataHealthViewModel.summary,
        }
      : undefined;
  const displayCoachWarnings: string[] = shouldUseDataHealthActionCopy ? [] : [];
  const recommendationConfidence = trainingIntelligenceSummary?.recommendationConfidence?.find((item) => item.level !== 'high');
  const confidenceCopy =
    recommendationConfidence?.level === 'low'
      ? {
          label: '推荐可信度偏低',
          tone: 'amber' as const,
          text: `${recommendationConfidence.summary} 建议保守参考，继续记录后会更稳定。`,
        }
      : recommendationConfidence?.level === 'medium'
        ? {
            label: '推荐可信度中等',
            tone: 'sky' as const,
            text: `${recommendationConfidence.summary} 可以执行，但请继续记录余力（RIR）和动作质量。`,
          }
        : null;
  const recoveryOverrideLabel = todayViewModel.recommendationKind === 'modified_train' ? '仍按原计划训练' : '仍要训练';
  const recoveryPreviewGuidance = React.useMemo(() => {
    const guidance = new Map<string, { label: string; tone: 'slate' | 'emerald' | 'amber' | 'rose' | 'sky' }>();
    const conflict = todayViewModel.recoveryTemplateConflict;
    if (todayViewModel.recommendationKind !== 'modified_train' || !conflict) return guidance;
    conflict.safeExercises.forEach((exercise) => {
      guidance.set(exercise.exerciseId, { label: '可保留', tone: 'emerald' });
    });
    conflict.conflictingExercises.forEach((exercise) => {
      const label = recoveryExerciseLabel(exercise.recommendedAction);
      guidance.set(exercise.exerciseId, { label, tone: recoveryExerciseTone(label) });
    });
    return guidance;
  }, [todayViewModel.recommendationKind, todayViewModel.recoveryTemplateConflict]);

  const handleExtraTraining = async () => {
    const confirmed = await confirm({
      title: '今天已经完成训练，仍要再练一场？',
      description: '系统会把这次训练作为额外训练记录保存。',
      confirmText: '再练一场',
      cancelText: '取消',
      variant: 'warning',
    });
    if (confirmed) onStart();
  };

  const handleRecoveryOverride = async () => {
    const confirmed = await confirm({
      title: '今天存在恢复冲突，确定继续训练吗？',
      description: '你仍然可以训练。建议降低相关部位压力，并在不适加重时停止当前动作。',
      confirmText: recoveryOverrideLabel,
      cancelText: '返回建议',
      variant: 'warning',
    });
    if (!confirmed) return;
    const templateId =
      todayViewModel.recommendationKind === 'train' && todayViewModel.recommendedTemplateId && todayViewModel.recommendedTemplateId !== selectedTemplate.id
        ? selectedTemplate.id
        : todayViewModel.recommendedTemplateId || selectedTemplate.id;
    if (onStartRecommended) {
      onStartRecommended(templateId);
      return;
    }
    onStart();
  };

  const handleRecoveryPrimaryAction = () => {
    const summary = todayViewModel.recoverySummary || '今天建议保守处理恢复信号。';
    const reasons = (todayViewModel.recoveryReasons || []).slice(0, 2).join(' ');
    setCoachActionFeedback([summary, reasons].filter(Boolean).join(' '));
  };

  const coachActionButtonLabel = (action: CoachAutomationSummary['recommendedActions'][number]) => {
    if (action.actionType === 'review_data') return '去检查数据';
    if (action.actionType === 'open_next_workout') return '查看下次建议';
    if (action.actionType === 'apply_daily_adjustment') return '查看建议';
    return '查看说明';
  };

  const coachReminderTone = (action: CoachAutomationSummary['recommendedActions'][number]): CoachReminderView['tone'] => {
    if (action.actionType === 'review_data') return 'danger';
    if (action.requiresConfirmation || action.actionType === 'apply_daily_adjustment') return 'warning';
    return 'info';
  };

  const rawCoachReminders = React.useMemo<CoachReminderView[]>(() => {
    const warningReminders = displayCoachWarnings.map((warning, index) => ({
      id: `coach-warning-${index}`,
      title: /酸痛|不适|恢复|冲突|保守/.test(warning) ? '恢复提醒' : '教练提醒',
      message: warning,
      tone: 'warning' as const,
      source: 'warning',
      priority: 70 - index,
    }));

    return warningReminders;
  }, [displayCoachWarnings, dataHealthViewModel]);

  const { visible: coachReminders, hidden: hiddenCoachReminders } = React.useMemo(
    () => splitCoachReminders(rawCoachReminders, 2),
    [rawCoachReminders],
  );
  const shouldShowCoachActionList = coachActionListViewModel.pending.length > 0 || Boolean(coachActions);
  const shouldShowCoachAdvice = !shouldShowCoachActionList && coachReminders.length > 0;
  const coachActionForReminder = (reminder: CoachReminderView) =>
    ([] as CoachAutomationSummary['recommendedActions']).find((action) => reminder.source === `action:${action.id}` || reminder.id === action.id);
  const reminderToneBadge = (tone: CoachReminderView['tone']) =>
    tone === 'danger' ? ('rose' as const) : tone === 'warning' ? ('amber' as const) : tone === 'success' ? ('emerald' as const) : ('sky' as const);

  const handleCoachAction = (action: CoachAutomationSummary['recommendedActions'][number]) => {
    if (action.actionType === 'review_data') {
      if (onReviewDataHealth) {
        onReviewDataHealth();
        return;
      }
      setCoachActionFeedback('请到记录页的数据区或我的页查看数据健康检查。');
      return;
    }
    if (action.actionType === 'open_next_workout') {
      const nextWorkout = enginePipeline.nextWorkout;
      setCoachActionFeedback(nextWorkout ? `下次建议详情：${nextWorkout.templateName}。${nextWorkout.reason}` : action.reason);
      return;
    }
    if (action.actionType === 'apply_daily_adjustment') {
      const adjustment = enginePipeline.todayAdjustment;
      setCoachActionFeedback(adjustment ? `今日自动调整：${adjustment.summary} 本轮只提供查看，不会自动覆盖计划。` : '本轮只提供查看，不会自动覆盖计划。');
      return;
    }
    setCoachActionFeedback(action.reason || '这条建议只是提示，可忽略。');
  };

  const recoveryNeedsNonTrainingPrimary =
    todayTrainingState.status === 'not_started' &&
    Boolean(
      todayViewModel.recommendationKind === 'rest' ||
        todayViewModel.recommendationKind === 'active_recovery' ||
        todayViewModel.recommendationKind === 'mobility_only',
    );
  const recommendedTemplateId = todayTrainingState.status === 'not_started' ? todayViewModel.recommendedTemplateId : undefined;
  const readinessDecisionState =
    todayViewModel.recommendationKind === 'rest' ||
    todayViewModel.recommendationKind === 'active_recovery' ||
    todayViewModel.recommendationKind === 'mobility_only'
      ? 'recovery'
      : todayViewModel.recommendationKind === 'modified_train' || adjustedPlan.readiness.level === 'yellow' || adjustedPlan.readiness.level === 'red'
        ? 'conservative'
        : 'normal';
  const fatigueDecisionState =
    decisionContext.todayStatus.energy === '低' || decisionContext.todayStatus.sleep === '差' ? 'high' : 'normal';
  const todayDecisionSurface = buildTodayDecisionSurface({
    recommendedFocus: currentTrainingName,
    selectedFocusOverride: resolvedTodayFocusSelection.overrideActive ? resolvedTodayFocusSelection.selectedFocusLabel : undefined,
    activeSessionState:
      todayTrainingState.status === 'in_progress'
        ? 'active'
        : todayTrainingState.status === 'completed'
          ? 'completed'
          : 'none',
    hasUnfinishedSession: todayTrainingState.status === 'in_progress',
    hasCompletedSession: todayTrainingState.status === 'completed',
    readinessState: readinessDecisionState,
    fatigueState: fatigueDecisionState,
    recentTrainingFrequency: mesocycleWeek ? formatCyclePhase(mesocycleWeek.phase) : undefined,
    severeDataHealthBlocker: severeDataHealthNotice,
    backupStatus: 'local-ok',
    sourceOfTruthClear: true,
    canStartTraining: todayTrainingState.status !== 'completed',
    canContinueTraining: todayTrainingState.status === 'in_progress',
    canRecoverTraining: Boolean(recoveryNeedsNonTrainingPrimary),
    currentDate: todayTrainingState.date,
    noPlanAvailable: !selectedTemplate.id,
    existingPrimaryActionLabel: todayViewModel.primaryActionLabel,
    existingDecisionText: decisionText,
  });
  const handleSevereRiskAction = () => {
    if (onReviewDataHealth) {
      onReviewDataHealth();
      return;
    }
    setCoachActionFeedback('请到设置或数据安全区域查看严重数据健康问题。');
  };

  const primaryAction =
    todayDecisionSurface.decisionState === 'blocked_by_severe_risk' ? (
      <UiOsActionButton type="button" onClick={handleSevereRiskAction} variant="primary" size="lg" fullWidth data-today-primary-cta="true">
        {todayDecisionSurface.primaryActionLabel}
      </UiOsActionButton>
    ) : todayTrainingState.status === 'completed' && completedSession ? (
      <UiOsActionButton type="button" onClick={() => onViewSession?.(completedSession.id, completedSession.date)} variant="primary" size="lg" fullWidth data-today-primary-cta="true">
        查看本次训练
        <ChevronRight className="h-4 w-4" />
      </UiOsActionButton>
    ) : todayTrainingState.status === 'in_progress' ? (
      <UiOsActionButton type="button" onClick={onResume} variant="primary" size="lg" fullWidth data-today-primary-cta="true">
        继续训练
        <ChevronRight className="h-4 w-4" />
      </UiOsActionButton>
    ) : recoveryNeedsNonTrainingPrimary ? (
      <UiOsActionButton type="button" onClick={handleRecoveryPrimaryAction} variant="primary" size="lg" fullWidth data-today-primary-cta="true">
        {todayDecisionSurface.primaryActionLabel}
      </UiOsActionButton>
    ) : recommendedTemplateId && recommendedTemplateId !== selectedTemplate.id ? (
      <UiOsActionButton type="button" onClick={() => (onStartRecommended ? onStartRecommended(recommendedTemplateId) : onStart())} variant="primary" size="lg" fullWidth data-today-primary-cta="true">
        <Play className="h-4 w-4" />
        {todayDecisionSurface.primaryActionLabel}
      </UiOsActionButton>
    ) : (
      <UiOsActionButton type="button" onClick={onStart} variant="primary" size="lg" fullWidth data-today-primary-cta="true">
        <Play className="h-4 w-4" />
        {todayDecisionSurface.primaryActionLabel}
      </UiOsActionButton>
    );
  const heroSecondaryActions =
    todayDecisionSurface.decisionState === 'blocked_by_severe_risk' ? null : todayTrainingState.status === 'completed' ? (
      <>
        <UiOsActionButton type="button" onClick={() => onViewCalendar?.(todayTrainingState.date)} variant="secondary" fullWidth>
          <CalendarDays className="h-4 w-4" />
          查看日历
        </UiOsActionButton>
        <UiOsActionButton type="button" onClick={handleExtraTraining} variant="ghost" fullWidth>
          <RotateCcw className="h-4 w-4" />
          再练一场
        </UiOsActionButton>
      </>
    ) : recoveryNeedsNonTrainingPrimary || todayViewModel.requiresRecoveryOverride ? (
      <UiOsActionButton type="button" onClick={handleRecoveryOverride} variant="secondary" fullWidth>
        {recoveryOverrideLabel}
      </UiOsActionButton>
    ) : hasAlternativeSuggestion ? (
      <UiOsActionButton type="button" onClick={onUseSuggestion} variant="secondary" fullWidth>
        采用推荐安排
      </UiOsActionButton>
    ) : null;
  const meaningfulRecoveryRisk =
    todayTrainingState.status === 'not_started' &&
    (todayViewModel.recommendationKind === 'rest' ||
      todayViewModel.recommendationKind === 'active_recovery' ||
      todayViewModel.recommendationKind === 'mobility_only' ||
      todayViewModel.recommendationKind === 'modified_train' ||
      todayDecisionSurface.decisionState === 'train_conservative' ||
      todayDecisionSurface.decisionState === 'recovery_recommended' ||
    adjustedPlan.readiness.level === 'yellow' ||
    adjustedPlan.readiness.level === 'red' ||
      fatigueDecisionState === 'high');
  const shouldShowRecoveryProminently = meaningfulRecoveryRisk;
  const shouldShowTodaySafetyStrip = todayDecisionSurface.decisionState === 'source_unclear';
  const keyExerciseNames = previewExercises.map((exercise) => exerciseLabel(exercise)).join(' / ');
  const heroSupportingAction =
    todayDecisionSurface.showFocusOverride && todayTrainingState.status === 'not_started' ? (
      <TodayFocusOverrideControl
        selection={resolvedTodayFocusSelection}
        onChange={onFocusOverrideChange}
        expanded={false}
        onToggleExpanded={() => setFocusOverrideExpanded((current) => !current)}
        embedded
      />
    ) : null;
  const shouldShowSecondaryTodayDetails =
    Boolean(
      todayViewModel.recoverySummary ||
        hasAlternativeSuggestion ||
        confidenceCopy ||
        shouldShowCoachActionList ||
        shouldShowCoachAdvice ||
        temporarySessionAdjustmentActive ||
        trainingLevelAssessment.level === 'unknown',
    );

  return (
    <ResponsivePageLayout>
      <PageHeader eyebrow="今日" title="今日决策" description="判断今天练不练、练什么，以及从哪里开始。" />

      <DashboardLayout
        main={
          <div className="space-y-4">
            <TodayDecisionHero
              decision={todayDecisionSurface}
              dateLabel={todayTrainingState.date}
              primaryAction={primaryAction}
              secondaryActions={heroSecondaryActions}
              supportingAction={heroSupportingAction}
            />

            {focusOverrideExpanded && todayDecisionSurface.showFocusOverride && todayTrainingState.status === 'not_started' ? (
              <TodayFocusOverrideControl
                selection={resolvedTodayFocusSelection}
                onChange={onFocusOverrideChange}
                expanded
                onToggleExpanded={() => setFocusOverrideExpanded(false)}
              />
            ) : null}

            {todayTrainingState.status === 'in_progress' ? (
              <TodayActiveSessionNotice
                message="当前有未完成训练，继续记录优先；不会自动完成或放弃上一场。"
                action={
                  <UiOsActionButton type="button" variant="secondary" size="sm" onClick={onResume} fullWidth>
                    继续训练
                  </UiOsActionButton>
                }
              />
            ) : null}

            {todayDecisionSurface.severeNotice ? (
              <TodaySevereRiskNotice
                title={todayDecisionSurface.severeNotice.title}
                message={todayDecisionSurface.severeNotice.message}
                onAction={handleSevereRiskAction}
              />
            ) : null}

            {shouldShowRecoveryProminently ? (
              <TodayReadinessSummary
                decision={todayDecisionSurface}
                readinessScore={readinessScore}
                durationMinutes={adjustedPlan.duration}
                note={todayNote}
              />
            ) : (
              <div
                className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-white/62"
                data-today-recovery-density="compact"
                aria-label="恢复疲劳摘要"
              >
                <span>恢复 / 疲劳：{todayDecisionSurface.readinessLabel}</span>
                <StatusBadge tone="emerald">状态正常</StatusBadge>
              </div>
            )}

            {shouldShowTodaySafetyStrip ? <SafetyStrip state="source-unclear" /> : null}

            <GlassCard as="section" surface="health_card" padding="md" className="space-y-3" ariaLabel="今日核心安排" data-today-training-preview="concise">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-base font-semibold text-white">
                    {pendingSessionPatches.length ? '训练预览 · 已应用本次调整' : '训练预览'}
                  </div>
                  <p className="mt-1 text-sm leading-6 text-white/55">
                    {keyExerciseNames ? `核心动作：${keyExerciseNames}` : '只展示今天开始训练前需要知道的核心安排。'}
                  </p>
                </div>
                <StatusBadge tone="slate">{adjustedExercises.length} 个动作</StatusBadge>
              </div>
              {pendingSessionPatches.length ? (
                <div className="rounded-2xl border border-sky-300/25 bg-sky-300/10 px-3 py-2">
                  <div className="text-sm font-semibold text-sky-50">本次调整</div>
                  <ul className="mt-1 space-y-1 text-xs leading-5 text-sky-100">
                    {temporaryAdjustmentSummaries.map((summary) => (
                      <li key={summary}>- {summary}</li>
                    ))}
                  </ul>
                  {temporarySkippedSupportItems.length ? (
                    <div className="mt-2 space-y-1 border-t border-sky-300/20 pt-2 text-xs leading-5 text-sky-100">
                      {temporarySkippedSupportItems.slice(0, 3).map((item) => (
                        <div key={item.id}>
                          {item.name} · {item.label}
                        </div>
                      ))}
                      {temporarySkippedSupportItems.length > 3 ? <div>还有 {temporarySkippedSupportItems.length - 3} 个辅助内容本次减少。</div> : null}
                    </div>
                  ) : null}
                </div>
              ) : null}
              <div className="divide-y divide-white/10">
                {previewExercises.map((exercise, index) => {
                  const patchBadge = patchBadgeForExercise(exercise, pendingSessionPatches);
                  return (
                    <div key={`${exercise.id}-${index}`} className="flex items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-white">{exerciseLabel(exercise)}</div>
                        <div className="mt-1 text-xs text-white/45">{formatExercisePrescription(exercise)}</div>
                      </div>
                      {patchBadge ? (
                        <StatusBadge tone={patchBadge.tone}>{patchBadge.label}</StatusBadge>
                      ) : recoveryPreviewGuidance.get(exercise.id) ? (
                        <StatusBadge tone={recoveryPreviewGuidance.get(exercise.id)?.tone}>{recoveryPreviewGuidance.get(exercise.id)?.label}</StatusBadge>
                      ) : (
                        <StatusBadge tone={exercise.warning ? 'amber' : 'slate'}>{formatRirLabel(exercise.targetRirText || '1–3')}</StatusBadge>
                      )}
                    </div>
                  );
                })}
              </div>
              {hiddenExerciseCount > 0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-white/55">
                  还有 {hiddenExerciseCount} 个动作会在训练页显示完整记录入口。
                </div>
              ) : null}
            </GlassCard>

            <details className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-white" data-today-secondary-details="collapsed">
              <summary className="cursor-pointer text-sm font-semibold">为什么这样推荐？ / 更多说明</summary>
              <div className="mt-4 space-y-3">
                {todayTrainingState.status === 'not_started' && todayViewModel.recoverySummary ? (
                  <div className="rounded-2xl border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-sm leading-6 text-amber-50">
                    {todayViewModel.recoverySummary}
                    {todayViewModel.recoveryReasons?.length ? (
                      <ul className="mt-2 list-disc space-y-1 pl-4 text-xs leading-5">
                        {todayViewModel.recoveryReasons.slice(0, 2).map((reason) => (
                          <li key={reason}>{reason}</li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ) : null}

                {todayTrainingState.status === 'completed' ? (
                  <div
                    className="rounded-2xl border border-sky-300/25 bg-sky-300/10 px-3 py-2 text-sm leading-6 text-sky-50"
                    aria-label={`下次建议：${nextSuggestion.templateName}，不是今天必须继续训练`}
                  >
                    {nextSuggestion.description}
                  </div>
                ) : hasAlternativeSuggestion && !todayViewModel.recoverySummary ? (
                  <div className="rounded-2xl border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-sm leading-6 text-amber-50">
                    系统建议可切换到 {nextSuggestion.templateName}。采用后再开始训练。
                  </div>
                ) : null}

                <RecommendationExplanationPanel
                  trace={recommendationTrace}
                  title={recommendationExplanationTitle}
                  compact
                  maxVisibleFactors={3}
                  recoveryRecommendation={recoveryRecommendation}
                />

                {confidenceCopy ? (
                  <Card className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-sm font-semibold text-slate-950">推荐置信度</div>
                      <StatusBadge tone={confidenceCopy.tone}>{confidenceCopy.label}</StatusBadge>
                    </div>
                    <p className="text-sm leading-6 text-slate-600">{confidenceCopy.text}</p>
                  </Card>
                ) : null}

                {shouldShowCoachActionList ? (
                  <CoachActionList
                    title="教练提醒"
                    description="低频建议移到详情里；采用临时调整前会再次确认。查看更多提醒在本区域处理。"
                    viewModel={coachActionListViewModel}
                    compact
                    onAction={onCoachAction}
                    onDismiss={onDismissCoachAction}
                    onDetail={onCoachAction}
                    emptyText="暂无待处理建议"
                  />
                ) : null}

                <div className="rounded-2xl border border-white/10 bg-white/[0.05] px-3 py-2 text-sm leading-6 text-white/70">
                  <div className="font-semibold text-white">完整动作指导</div>
                  <div className="mt-2 space-y-1">
                    {adjustedExercises.map((exercise) => {
                      const patchBadge = patchBadgeForExercise(exercise, pendingSessionPatches);
                      const recoveryBadge = recoveryPreviewGuidance.get(exercise.id);
                      const label = patchBadge?.label || recoveryBadge?.label || '可执行';
                      return (
                        <div key={`detail-${exercise.id}`} className="flex flex-wrap items-center gap-2">
                          <span>{exerciseLabel(exercise)}</span>
                          <StatusBadge tone={patchBadge?.tone || recoveryBadge?.tone || 'slate'}>{label}</StatusBadge>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {temporarySessionAdjustmentActive ? (
                  <UnfinishedSessionNotice className="space-y-3">
                    <div>
                      <div className="text-sm font-semibold text-white">本次临时调整已生效</div>
                      <p className="mt-1 text-sm leading-6 text-amber-100">只影响当前这次训练，不会修改原模板或长期计划。</p>
                    </div>
                    {onRevertTemporarySessionPatches ? (
                      <ActionButton type="button" variant="secondary" size="sm" onClick={onRevertTemporarySessionPatches}>
                        撤销调整
                      </ActionButton>
                    ) : null}
                  </UnfinishedSessionNotice>
                ) : null}

                {trainingLevelAssessment.level === 'unknown' ? (
                  <Card tone="amber" className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold">正在建立训练基线</div>
                      <StatusBadge tone="amber">{trainingLevelLabels[trainingLevelAssessment.level]}</StatusBadge>
                    </div>
                    <p className="text-sm leading-6">当前模板是起始模板，不是基于历史数据生成。完成 2-3 次训练后，系统会开始估算当前力量、有效组和训练等级。</p>
                  </Card>
                ) : shouldShowSecondaryTodayDetails ? (
                  <Card tone="sky" className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold">今日提示</div>
                      <StatusBadge tone="sky">{trainingLevelLabels[trainingLevelAssessment.level]}</StatusBadge>
                    </div>
                    <p className="text-sm leading-6">{buildTrainingLevelExplanation(trainingLevelAssessment)}</p>
                  </Card>
                ) : null}
              </div>
            </details>
          </div>
        }
        side={
          <details className="rounded-3xl border border-white/10 bg-white/[0.05] p-4 text-white" data-today-status-controls="collapsed">
            <summary className="cursor-pointer text-sm font-semibold">状态与计划细节</summary>
            <div className="mt-4 space-y-4">
            <PageSection title="准备度">
              <Card className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <MetricCard
                    label="准备度"
                    value={typeof readinessScore === 'number' ? `${readinessScore}` : '--'}
                    helper="满分 100"
                    tone={readinessTone(adjustedPlan.readiness.level)}
                  />
                  <MetricCard label="预计时长" value={`${adjustedPlan.duration} 分钟`} helper="按今天状态调整" tone="emerald" />
                </div>
                <div className="rounded-lg bg-stone-50 px-3 py-2 text-sm leading-6 text-slate-600">{todayNote}</div>
              </Card>
            </PageSection>

            <PageSection title="今日状态">
              <Card className="space-y-4">
                <div>
                  <div className="mb-2 text-xs font-semibold text-slate-500">睡眠</div>
                  <ChoiceRow value={decisionContext.todayStatus.sleep} options={SLEEP_STATES} onChange={(value) => onStatusChange('sleep', value)} />
                </div>
                <div>
                  <div className="mb-2 text-xs font-semibold text-slate-500">精力</div>
                  <ChoiceRow value={decisionContext.todayStatus.energy} options={ENERGY_STATES} onChange={(value) => onStatusChange('energy', value)} />
                </div>
                <div>
                  <div className="mb-2 text-xs font-semibold text-slate-500">可用时间</div>
                  <ChoiceRow
                    value={decisionContext.todayStatus.time}
                    options={AVAILABLE_TIME_OPTIONS}
                    labels={{ 30: '30 分', 60: '60 分', 90: '90 分' }}
                    onChange={(value) => onStatusChange('time', value)}
                  />
                </div>
                <div>
                  <div className="mb-2 text-xs font-semibold text-slate-500">酸痛部位</div>
                  <div className="flex flex-wrap gap-2">
                    {sorenessOptions.map((part) => (
                      <button
                        key={part}
                        type="button"
                        onClick={() => onSorenessToggle(part)}
                        className={classNames(
                          'min-h-10 rounded-lg border px-3 text-sm font-medium transition',
                          decisionContext.todayStatus.soreness.includes(part)
                            ? 'border-emerald-500 bg-emerald-50 text-emerald-900'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-stone-50',
                        )}
                      >
                        {part}
                      </button>
                    ))}
                  </div>
                </div>
              </Card>
            </PageSection>

            <PageSection title="计划进度">
              <Card className="space-y-3">
                <div className="grid gap-2 text-sm">
                  <div className="flex items-center justify-between gap-3 rounded-lg bg-stone-50 px-3 py-2">
                    <span className="text-slate-500">当前模板</span>
                    <span className="font-semibold text-slate-950">{selectedTemplateName}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-lg bg-stone-50 px-3 py-2">
                    <span className="text-slate-500">训练模式</span>
                    <span className="font-semibold text-slate-950">{formatTrainingMode(trainingMode)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-lg bg-stone-50 px-3 py-2">
                    <span className="text-slate-500">周期阶段</span>
                    <span className="font-semibold text-slate-950">{mesocycleWeek ? formatCyclePhase(mesocycleWeek.phase) : '未设置'}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-lg bg-stone-50 px-3 py-2">
                    <span className="text-slate-500">强度倾向</span>
                    <span className="font-semibold text-slate-950">{mesocycleWeek ? formatIntensityBias(mesocycleWeek.intensityBias) : '常规'}</span>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-lg bg-emerald-50 p-3 text-center">
                    <div className="text-lg font-bold text-emerald-900">{adjustedExercises.length}</div>
                    <div className="text-xs text-emerald-700">主训练</div>
                  </div>
                  <div className="rounded-lg bg-sky-50 p-3 text-center">
                    <div className="text-lg font-bold text-sky-900">{supportPlan.correctionModules.length}</div>
                    <div className="text-xs text-sky-700">纠偏</div>
                  </div>
                  <div className="rounded-lg bg-amber-50 p-3 text-center">
                    <div className="text-lg font-bold text-amber-900">{supportPlan.functionalAddons.length}</div>
                    <div className="text-xs text-amber-700">功能</div>
                  </div>
                </div>
              </Card>
            </PageSection>

            <PageSection title="训练模式">
              <Card className="space-y-3">
                <ChoiceRow
                  value={trainingMode}
                  options={['hypertrophy', 'strength', 'hybrid'] as const}
                  labels={{
                    hypertrophy: formatTrainingMode('hypertrophy'),
                    strength: formatTrainingMode('strength'),
                    hybrid: formatTrainingMode('hybrid'),
                  }}
                  onChange={(value) => onModeChange(value as TrainingMode)}
                />
                <p className="text-sm leading-6 text-slate-500">
                  同一模板下，推荐会因历史记录、准备度、训练等级和动作质量变化。
                </p>
              </Card>
            </PageSection>
            </div>
          </details>
        }
      />
      <ConfirmDialogHost />
    </ResponsivePageLayout>
  );
}
