import React from 'react';
import { CalendarDays, ChevronDown, ChevronRight, Clock3, Dumbbell, Play, RotateCcw } from 'lucide-react';
import { AVAILABLE_TIME_OPTIONS, ENERGY_STATES, SLEEP_STATES } from '../models/training-model';
import { classNames, number, todayKey } from '../engines/engineUtils';
import { applyStatusRules } from '../engines/progressionEngine';
import { filterAnalyticsHistory } from '../engines/sessionHistoryEngine';
import { buildSupportPlan } from '../engines/supportPlanEngine';
import { getCurrentMesocycleWeek } from '../engines/mesocycleEngine';
import { buildTrainingLevelAssessment, type AutoTrainingLevel } from '../engines/trainingLevelEngine';
import { buildTodayTrainingState } from '../engines/todayStateEngine';
import { buildTrainingDecisionContext, toStatusRulesDecisionContext } from '../engines/trainingDecisionContext';
import { buildTrainingLevelExplanation } from '../engines/explainability/trainingExplainability';
import { buildRecommendationTrace } from '../engines/recommendationTraceEngine';
import type { CoachAutomationSummary } from '../engines/coachAutomationEngine';
import type { CoachAction } from '../engines/coachActionEngine';
import type { TrainingIntelligenceSummary } from '../engines/trainingIntelligenceSummaryEngine';
import type { RecoveryAwareRecommendation } from '../engines/recoveryAwareScheduler';
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

interface TodayViewProps {
  data: AppData;
  selectedTemplate: TrainingTemplate;
  suggestedTemplate: TrainingTemplate;
  recoveryRecommendation?: RecoveryAwareRecommendation;
  weeklyPrescription: WeeklyPrescription;
  coachAutomationSummary?: CoachAutomationSummary;
  coachActions?: CoachAction[];
  trainingIntelligenceSummary?: TrainingIntelligenceSummary;
  trainingMode: TrainingMode;
  onModeChange: (mode: TrainingMode) => void;
  onStatusChange: (field: 'sleep' | 'energy' | 'time', value: string) => void;
  onSorenessToggle: (part: AppData['todayStatus']['soreness'][number]) => void;
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

const statusTone = (status: 'not_started' | 'in_progress' | 'completed') => {
  if (status === 'completed') return 'emerald' as const;
  if (status === 'in_progress') return 'amber' as const;
  return 'sky' as const;
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

export function TodayView({
  data,
  selectedTemplate,
  suggestedTemplate,
  recoveryRecommendation,
  weeklyPrescription,
  coachAutomationSummary,
  coachActions,
  trainingIntelligenceSummary,
  trainingMode,
  onModeChange,
  onStatusChange,
  onSorenessToggle,
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
  onRevertTemporarySessionPatches,
}: TodayViewProps) {
  const [coachActionFeedback, setCoachActionFeedback] = React.useState('');
  const { confirm, ConfirmDialogHost } = useConfirmDialog();
  const decisionContext = React.useMemo(
    () => buildTrainingDecisionContext(data, { trainingMode }),
    [
      data.todayStatus,
      data.history,
      data.activeSession,
      data.healthMetricSamples,
      data.importedWorkoutSamples,
      data.settings?.healthIntegrationSettings?.useHealthDataForReadiness,
      data.screeningProfile,
      data.mesocyclePlan,
      data.programTemplate,
      trainingMode,
    ],
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

  const todayTrainingState = buildTodayTrainingState({
    activeSession: data.activeSession,
    history: data.history,
    currentLocalDate: todayKey(),
    templates: data.templates,
    programTemplate: data.programTemplate,
    plannedTemplateId: data.selectedTemplateId,
  });
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
    nextSuggestion: suggestedTemplate,
    recoveryRecommendation,
  });

  const adjustedExercises = adjustedPlan.exercises as ExercisePrescription[];
  const previewExercises = adjustedExercises.slice(0, 4);
  const hiddenExerciseCount = Math.max(0, adjustedExercises.length - previewExercises.length);
  const analyticsHistory = filterAnalyticsHistory(data.history || []);
  const trainingLevelAssessment = buildTrainingLevelAssessment({ history: analyticsHistory });
  const supportPlan = buildSupportPlan(data, selectedTemplate);
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
  const recommendationLabel = todayViewModel.recommendationLabel;
  const currentTrainingName = todayViewModel.currentTrainingName;
  const decisionText = todayViewModel.decisionText;
  const nextSuggestion = todayViewModel.nextSuggestion;
  const hasAlternativeSuggestion = Boolean(nextSuggestion.templateId && nextSuggestion.templateId !== selectedTemplate.id);
  const todayNote =
    readinessReasons[0] ||
    (trainingLevelAssessment.level === 'unknown'
      ? '系统还在建立训练基线，今天的建议会保持保守。'
      : '今天优先完成主训练，细节记录放到训练页处理。');
  const rawCoachActions = coachAutomationSummary?.recommendedActions || [];
  const coachActionListViewModel = React.useMemo(
    () => buildCoachActionListViewModel(coachActions || [], { surface: 'today', maxVisible: 2 }),
    [coachActions],
  );
  const dataHealthViewModel = React.useMemo(
    () => (coachAutomationSummary?.dataHealth ? buildDataHealthViewModel(coachAutomationSummary.dataHealth) : null),
    [coachAutomationSummary?.dataHealth],
  );
  const rawCoachWarnings = coachAutomationSummary?.keyWarnings || [];
  const shouldUseDataHealthActionCopy = dataHealthViewModel && dataHealthViewModel.statusTone !== 'healthy';
  const displayCoachWarnings = shouldUseDataHealthActionCopy ? [] : rawCoachWarnings;
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

  const coachActionTitle = (action: CoachAutomationSummary['recommendedActions'][number]) =>
    action.actionType === 'review_data'
      ? dataHealthViewModel?.primaryIssues[0]?.title || action.label
      : action.label;

  const coachActionReason = (action: CoachAutomationSummary['recommendedActions'][number]) =>
    action.actionType === 'review_data'
      ? dataHealthViewModel?.primaryIssues[0]?.userMessage || dataHealthViewModel?.summary || action.reason
      : action.reason;

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
    const actionReminders = rawCoachActions.map((action, index) => ({
      id: action.id || `coach-action-${index}`,
      title: coachActionTitle(action),
      message: coachActionReason(action),
      tone: coachReminderTone(action),
      source: `action:${action.id}`,
      priority:
        action.actionType === 'review_data'
          ? 100
          : action.requiresConfirmation
            ? 85
            : action.actionType === 'apply_daily_adjustment'
              ? 75
              : 60,
    }));

    const warningReminders = displayCoachWarnings.map((warning, index) => ({
      id: `coach-warning-${index}`,
      title: /酸痛|不适|恢复|冲突|保守/.test(warning) ? '恢复提醒' : '教练提醒',
      message: warning,
      tone: 'warning' as const,
      source: 'warning',
      priority: 70 - index,
    }));

    return [...actionReminders, ...warningReminders];
  }, [rawCoachActions, displayCoachWarnings, dataHealthViewModel]);

  const { visible: coachReminders, hidden: hiddenCoachReminders } = React.useMemo(
    () => splitCoachReminders(rawCoachReminders, 2),
    [rawCoachReminders],
  );
  const shouldShowCoachActionList = coachActionListViewModel.pending.length > 0;
  const shouldShowCoachAdvice = !shouldShowCoachActionList && coachReminders.length > 0;
  const coachActionForReminder = (reminder: CoachReminderView) =>
    rawCoachActions.find((action) => reminder.source === `action:${action.id}` || reminder.id === action.id);
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
      const nextWorkout = coachAutomationSummary?.nextWorkout;
      setCoachActionFeedback(nextWorkout ? `下次建议详情：${nextWorkout.templateName}。${nextWorkout.reason}` : action.reason);
      return;
    }
    if (action.actionType === 'apply_daily_adjustment') {
      const adjustment = coachAutomationSummary?.todayAdjustment;
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

  const primaryAction =
    todayTrainingState.status === 'completed' && completedSession ? (
      <ActionButton type="button" onClick={() => onViewSession?.(completedSession.id, completedSession.date)} variant="primary" size="lg" fullWidth>
        查看本次训练
        <ChevronRight className="h-4 w-4" />
      </ActionButton>
    ) : todayTrainingState.status === 'in_progress' ? (
      <ActionButton type="button" onClick={onResume} variant="primary" size="lg" fullWidth>
        继续训练
        <ChevronRight className="h-4 w-4" />
      </ActionButton>
    ) : recoveryNeedsNonTrainingPrimary ? (
      <ActionButton type="button" onClick={handleRecoveryPrimaryAction} variant="primary" size="lg" fullWidth>
        {todayViewModel.primaryActionLabel}
      </ActionButton>
    ) : recommendedTemplateId && recommendedTemplateId !== selectedTemplate.id ? (
      <ActionButton type="button" onClick={() => (onStartRecommended ? onStartRecommended(recommendedTemplateId) : onStart())} variant="primary" size="lg" fullWidth>
        <Play className="h-4 w-4" />
        {todayViewModel.primaryActionLabel}
      </ActionButton>
    ) : (
      <ActionButton type="button" onClick={onStart} variant="primary" size="lg" fullWidth>
        <Play className="h-4 w-4" />
        {todayViewModel.primaryActionLabel}
      </ActionButton>
    );

  return (
    <ResponsivePageLayout>
      <PageHeader eyebrow="今日" title="今日决策" description="判断今天练不练、练什么，以及从哪里开始。" />

      <DashboardLayout
        main={
          <div className="space-y-4">
            <Card className="overflow-hidden border-emerald-100 bg-white p-0">
              <div className="border-b border-emerald-100 bg-emerald-50/70 px-4 py-3 md:px-5">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge tone={statusTone(todayViewModel.state)}>{todayViewModel.pageTitle}</StatusBadge>
                  <span className="text-xs font-medium text-slate-500">{todayTrainingState.date}</span>
                </div>
              </div>
              <div className="grid gap-5 p-4 md:grid-cols-[minmax(0,1fr)_240px] md:p-5">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-emerald-700">{recommendationLabel}</div>
                  <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 md:text-3xl">{currentTrainingName}</h2>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">{decisionText}</p>
                  {todayTrainingState.status === 'not_started' && todayViewModel.recoverySummary ? (
                    <div className="mt-4 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-sm leading-6 text-amber-900">
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
                      className="mt-4 rounded-lg border border-sky-100 bg-sky-50 px-3 py-2 text-sm leading-6 text-sky-900"
                      aria-label={`下次建议：${nextSuggestion.templateName}，不是今天必须继续训练`}
                    >
                      {nextSuggestion.description}
                    </div>
                  ) : hasAlternativeSuggestion && !todayViewModel.recoverySummary ? (
                    <div className="mt-4 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-sm leading-6 text-amber-900">
                      系统建议可切换到 {nextSuggestion.templateName}。采用后再开始训练。
                    </div>
                  ) : null}
                </div>
                <div className="flex flex-col gap-2">
                  {primaryAction}
                  {todayTrainingState.status === 'completed' ? (
                    <>
                      <ActionButton type="button" onClick={() => onViewCalendar?.(todayTrainingState.date)} variant="secondary" fullWidth>
                        <CalendarDays className="h-4 w-4" />
                        查看日历
                      </ActionButton>
                      <ActionButton type="button" onClick={handleExtraTraining} variant="ghost" fullWidth>
                        <RotateCcw className="h-4 w-4" />
                        再练一场
                      </ActionButton>
                    </>
                  ) : recoveryNeedsNonTrainingPrimary || todayViewModel.requiresRecoveryOverride ? (
                    <ActionButton type="button" onClick={handleRecoveryOverride} variant="secondary" fullWidth>
                      {recoveryOverrideLabel}
                    </ActionButton>
                  ) : hasAlternativeSuggestion ? (
                    <ActionButton type="button" onClick={onUseSuggestion} variant="secondary" fullWidth>
                      采用推荐安排
                    </ActionButton>
                  ) : null}
                </div>
              </div>
            </Card>

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
                title="教练建议"
                description="只显示当前最重要的 1–2 条；采用临时调整前会再次确认。"
                viewModel={coachActionListViewModel}
                compact
                onAction={onCoachAction}
                onDismiss={onDismissCoachAction}
                onDetail={onCoachAction}
              />
            ) : null}

            {temporarySessionAdjustmentActive ? (
              <Card className="space-y-3 border-sky-100 bg-sky-50">
                <div>
                  <div className="text-sm font-semibold text-slate-950">本次临时调整已生效</div>
                  <p className="mt-1 text-sm leading-6 text-slate-600">只影响当前这次训练，不会修改原模板或长期计划。</p>
                </div>
                {onRevertTemporarySessionPatches ? (
                  <ActionButton type="button" variant="secondary" size="sm" onClick={onRevertTemporarySessionPatches}>
                    撤销调整
                  </ActionButton>
                ) : null}
              </Card>
            ) : null}

            {shouldShowCoachAdvice ? (
              <Card className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-base font-semibold text-slate-950">教练提醒</div>
                    <p className="mt-1 text-sm leading-6 text-slate-500">默认只显示当前最重要的 1–2 条；所有建议都可忽略，采用前仍需你确认。</p>
                  </div>
                  <StatusBadge tone={coachAutomationSummary?.dataHealth?.status === 'has_errors' ? 'rose' : 'emerald'}>可忽略</StatusBadge>
                </div>
                <div className="space-y-2">
                  {coachReminders.map((reminder) => {
                    const action = coachActionForReminder(reminder);
                    return (
                      <div key={reminder.id} className="rounded-lg border border-slate-200 bg-stone-50 px-3 py-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold text-slate-950">{reminder.title}</span>
                            {action?.requiresConfirmation ? <StatusBadge tone="amber">需确认</StatusBadge> : null}
                            {!action ? <StatusBadge tone={reminderToneBadge(reminder.tone)}>{reminder.tone === 'warning' ? '提醒' : '提示'}</StatusBadge> : null}
                          </div>
                          {action ? (
                            <ActionButton type="button" size="sm" variant="secondary" onClick={() => handleCoachAction(action)}>
                              {coachActionButtonLabel(action)}
                            </ActionButton>
                          ) : null}
                        </div>
                        <div className="mt-1 text-xs leading-5 text-slate-600">{reminder.message}</div>
                      </div>
                    );
                  })}
                </div>
                {coachActionFeedback ? (
                  <div className="rounded-lg border border-sky-100 bg-sky-50 px-3 py-2 text-xs font-semibold leading-5 text-sky-900">
                    {coachActionFeedback}
                  </div>
                ) : null}
                {hiddenCoachReminders.length ? (
                  <details className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
                    <summary className="cursor-pointer font-semibold text-slate-700">查看更多提醒</summary>
                    <div className="mt-2 space-y-2">
                      {hiddenCoachReminders.map((reminder) => {
                        const action = coachActionForReminder(reminder);
                        return (
                          <div key={reminder.id} className="rounded-lg bg-stone-50 px-3 py-2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-semibold text-slate-950">{reminder.title}</span>
                                {action?.requiresConfirmation ? <StatusBadge tone="amber">需确认</StatusBadge> : null}
                                {!action ? <StatusBadge tone={reminderToneBadge(reminder.tone)}>{reminder.tone === 'warning' ? '提醒' : '提示'}</StatusBadge> : null}
                              </div>
                              {action ? (
                                <ActionButton type="button" size="sm" variant="secondary" onClick={() => handleCoachAction(action)}>
                                  {coachActionButtonLabel(action)}
                                </ActionButton>
                              ) : null}
                            </div>
                            <div className="mt-1 text-xs leading-5 text-slate-600">{reminder.message}</div>
                          </div>
                        );
                      })}
                    </div>
                  </details>
                ) : null}
              </Card>
            ) : null}

            <Card className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-base font-semibold text-slate-950">训练预览</div>
                  <p className="mt-1 text-sm leading-6 text-slate-500">只展示今天开始训练前需要知道的核心安排。</p>
                </div>
                <StatusBadge tone="slate">{adjustedExercises.length} 个动作</StatusBadge>
              </div>
              <div className="divide-y divide-slate-100">
                {previewExercises.map((exercise, index) => (
                  <div key={`${exercise.id}-${index}`} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-slate-950">{exerciseLabel(exercise)}</div>
                      <div className="mt-1 text-xs text-slate-500">{formatExercisePrescription(exercise)}</div>
                    </div>
                    {recoveryPreviewGuidance.get(exercise.id) ? (
                      <StatusBadge tone={recoveryPreviewGuidance.get(exercise.id)?.tone}>{recoveryPreviewGuidance.get(exercise.id)?.label}</StatusBadge>
                    ) : (
                      <StatusBadge tone={exercise.warning ? 'amber' : 'slate'}>{formatRirLabel(exercise.targetRirText || '1–3')}</StatusBadge>
                    )}
                  </div>
                ))}
              </div>
              {hiddenExerciseCount > 0 ? (
                <div className="rounded-lg bg-stone-50 px-3 py-2 text-sm text-slate-500">
                  还有 {hiddenExerciseCount} 个动作会在训练页显示完整记录入口。
                </div>
              ) : null}
            </Card>

            <Card tone={trainingLevelAssessment.level === 'unknown' ? 'amber' : 'sky'} className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold">{trainingLevelAssessment.level === 'unknown' ? '正在建立训练基线' : '今日提示'}</div>
                <StatusBadge tone={trainingLevelAssessment.level === 'unknown' ? 'amber' : 'sky'}>
                  {trainingLevelLabels[trainingLevelAssessment.level]}
                </StatusBadge>
              </div>
              <p className="text-sm leading-6">
                {trainingLevelAssessment.level === 'unknown'
                  ? '当前模板是起始模板，不是基于历史数据生成。完成 2-3 次训练后，系统会开始估算当前力量、有效组和训练等级。'
                  : buildTrainingLevelExplanation(trainingLevelAssessment)}
              </p>
            </Card>
          </div>
        }
        side={
          <div className="space-y-4">
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
                  <ChoiceRow value={data.todayStatus.sleep} options={SLEEP_STATES} onChange={(value) => onStatusChange('sleep', value)} />
                </div>
                <div>
                  <div className="mb-2 text-xs font-semibold text-slate-500">精力</div>
                  <ChoiceRow value={data.todayStatus.energy} options={ENERGY_STATES} onChange={(value) => onStatusChange('energy', value)} />
                </div>
                <div>
                  <div className="mb-2 text-xs font-semibold text-slate-500">可用时间</div>
                  <ChoiceRow
                    value={data.todayStatus.time}
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
                          data.todayStatus.soreness.includes(part)
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
        }
      />
      <ConfirmDialogHost />
    </ResponsivePageLayout>
  );
}
