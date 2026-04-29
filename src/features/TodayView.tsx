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
import { formatCyclePhase, formatExerciseName, formatIntensityBias, formatRirLabel, formatTemplateName, formatTrainingMode } from '../i18n/formatters';
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
import { useConfirmDialog } from '../ui/useConfirmDialog';
import { DashboardLayout } from '../ui/layouts/DashboardLayout';
import { ResponsivePageLayout } from '../ui/layouts/ResponsivePageLayout';

interface TodayViewProps {
  data: AppData;
  selectedTemplate: TrainingTemplate;
  suggestedTemplate: TrainingTemplate;
  weeklyPrescription: WeeklyPrescription;
  coachAutomationSummary?: CoachAutomationSummary;
  trainingMode: TrainingMode;
  onModeChange: (mode: TrainingMode) => void;
  onStatusChange: (field: 'sleep' | 'energy' | 'time', value: string) => void;
  onSorenessToggle: (part: AppData['todayStatus']['soreness'][number]) => void;
  onTemplateSelect: (id: string) => void;
  onUseSuggestion: () => void;
  onStart: () => void;
  onResume: () => void;
  onViewSession?: (sessionId: string, date?: string) => void;
  onViewCalendar?: (date?: string) => void;
  onReviewDataHealth?: () => void;
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
  weeklyPrescription,
  coachAutomationSummary,
  trainingMode,
  onModeChange,
  onStatusChange,
  onSorenessToggle,
  onUseSuggestion,
  onStart,
  onResume,
  onViewSession,
  onViewCalendar,
  onReviewDataHealth,
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
  const coachActions = (coachAutomationSummary?.recommendedActions || []).slice(0, 2);
  const hiddenCoachActions = (coachAutomationSummary?.recommendedActions || []).slice(2);
  const dataHealthViewModel = React.useMemo(
    () => (coachAutomationSummary?.dataHealth ? buildDataHealthViewModel(coachAutomationSummary.dataHealth) : null),
    [coachAutomationSummary?.dataHealth],
  );
  const rawCoachWarnings = coachAutomationSummary?.keyWarnings || [];
  const shouldUseDataHealthActionCopy = dataHealthViewModel && dataHealthViewModel.statusTone !== 'healthy';
  const coachWarnings = shouldUseDataHealthActionCopy ? [] : rawCoachWarnings.slice(0, Math.max(0, 2 - coachActions.length));
  const hiddenCoachWarnings = shouldUseDataHealthActionCopy ? [] : rawCoachWarnings.slice(coachWarnings.length);
  const shouldShowCoachAdvice = coachActions.length > 0 || coachWarnings.length > 0;

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
    ) : (
      <ActionButton type="button" onClick={onStart} variant="primary" size="lg" fullWidth>
        <Play className="h-4 w-4" />
        开始训练
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
                  {todayTrainingState.status === 'completed' ? (
                    <div
                      className="mt-4 rounded-lg border border-sky-100 bg-sky-50 px-3 py-2 text-sm leading-6 text-sky-900"
                      aria-label={`下次建议：${nextSuggestion.templateName}，不是今天必须继续训练`}
                    >
                      {nextSuggestion.description}
                    </div>
                  ) : hasAlternativeSuggestion ? (
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
            />

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
                  {coachActions.map((action) => (
                    <div key={action.id} className="rounded-lg border border-slate-200 bg-stone-50 px-3 py-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-slate-950">{coachActionTitle(action)}</span>
                          {action.requiresConfirmation ? <StatusBadge tone="amber">需确认</StatusBadge> : null}
                        </div>
                        <ActionButton type="button" size="sm" variant="secondary" onClick={() => handleCoachAction(action)}>
                          {coachActionButtonLabel(action)}
                        </ActionButton>
                      </div>
                      <div className="mt-1 text-xs leading-5 text-slate-600">{coachActionReason(action)}</div>
                    </div>
                  ))}
                  {coachWarnings.map((warning) => (
                    <div key={warning} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold leading-5 text-amber-900">
                      {warning}
                    </div>
                  ))}
                </div>
                {coachActionFeedback ? (
                  <div className="rounded-lg border border-sky-100 bg-sky-50 px-3 py-2 text-xs font-semibold leading-5 text-sky-900">
                    {coachActionFeedback}
                  </div>
                ) : null}
                {hiddenCoachActions.length || hiddenCoachWarnings.length ? (
                  <details className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
                    <summary className="cursor-pointer font-semibold text-slate-700">查看更多提醒</summary>
                    <div className="mt-2 space-y-2">
                      {hiddenCoachActions.map((action) => (
                        <div key={action.id} className="rounded-lg bg-stone-50 px-3 py-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-semibold text-slate-950">{coachActionTitle(action)}</span>
                              {action.requiresConfirmation ? <StatusBadge tone="amber">需确认</StatusBadge> : null}
                            </div>
                            <ActionButton type="button" size="sm" variant="secondary" onClick={() => handleCoachAction(action)}>
                              {coachActionButtonLabel(action)}
                            </ActionButton>
                          </div>
                          <div className="mt-1 text-xs leading-5 text-slate-600">{coachActionReason(action)}</div>
                        </div>
                      ))}
                      {hiddenCoachWarnings.map((warning) => (
                        <div key={warning} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold leading-5 text-amber-900">
                          {warning}
                        </div>
                      ))}
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
                    <StatusBadge tone={exercise.warning ? 'amber' : 'slate'}>{formatRirLabel(exercise.targetRirText || '1–3')}</StatusBadge>
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
