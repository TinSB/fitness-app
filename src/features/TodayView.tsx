import React from 'react';
import { ChevronDown, ChevronRight, Play } from 'lucide-react';
import { AVAILABLE_TIME_OPTIONS, ENERGY_STATES, SLEEP_STATES } from '../models/training-model';
import { resolveMode, todayKey } from '../engines/engineUtils';
import { applyStatusRules } from '../engines/progressionEngine';
import { filterAnalyticsHistory } from '../engines/sessionHistoryEngine';
import { buildSupportPlan } from '../engines/supportPlanEngine';
import { getCurrentMesocycleWeek } from '../engines/mesocycleEngine';
import { buildTrainingLevelAssessment, formatAutoTrainingLevel } from '../engines/trainingLevelEngine';
import { buildTodayTrainingState } from '../engines/todayStateEngine';
import { buildTrainingDecisionContext, toStatusRulesDecisionContext } from '../engines/trainingDecisionContext';
import { buildTrainingLevelExplanation } from '../engines/explainability/trainingExplainability';
import { formatCyclePhase, formatExerciseName, formatIntensityBias } from '../i18n/formatters';
import { buildTodayViewModel } from '../presenters/todayPresenter';
import type { AppData, ExercisePrescription, TrainingMode, TrainingTemplate, WeeklyPrescription } from '../models/training-model';
import { InlineNotice, InfoPill, ModeSwitch, Segment, WeeklyPrescriptionCard } from '../ui/common';
import { ActionButton } from '../ui/ActionButton';
import { Card } from '../ui/Card';
import { MetricCard } from '../ui/MetricCard';
import { PageHeader } from '../ui/PageHeader';
import { PageSection } from '../ui/PageSection';
import { StatusBadge } from '../ui/StatusBadge';
import { DashboardLayout } from '../ui/layouts/DashboardLayout';
import { ResponsivePageLayout } from '../ui/layouts/ResponsivePageLayout';

interface TodayViewProps {
  data: AppData;
  selectedTemplate: TrainingTemplate;
  suggestedTemplate: TrainingTemplate;
  weeklyPrescription: WeeklyPrescription;
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
}

const sorenessOptions = ['无', '胸', '背', '腿', '肩', '手臂'] as const;
const templateNameLabels: Record<string, string> = {
  'push-a': '推 A',
  'pull-a': '拉 A',
  'legs-a': '腿 A',
  upper: '上肢',
  lower: '下肢',
  arms: '手臂 + 三角',
  'quick-30': '快练 30',
  'crowded-gym': '人多替代',
};

const templateLabel = (template: TrainingTemplate) => templateNameLabels[template.id] || template.name;

const statusTone = (status: 'not_started' | 'in_progress' | 'completed') => {
  if (status === 'completed') return 'emerald' as const;
  if (status === 'in_progress') return 'amber' as const;
  return 'sky' as const;
};

export function TodayView({
  data,
  selectedTemplate,
  suggestedTemplate,
  weeklyPrescription,
  trainingMode,
  onModeChange,
  onStatusChange,
  onSorenessToggle,
  onTemplateSelect,
  onUseSuggestion,
  onStart,
  onResume,
  onViewSession,
  onViewCalendar,
}: TodayViewProps) {
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
  const todayViewModel = buildTodayViewModel({
    todayState: todayTrainingState,
    selectedTemplate,
    completedTemplateName: completedSession?.templateName,
  });

  const adjustedExercises = adjustedPlan.exercises as ExercisePrescription[];
  const analyticsHistory = filterAnalyticsHistory(data.history || []);
  const trainingLevelAssessment = buildTrainingLevelAssessment({ history: analyticsHistory });
  const supportPlan = buildSupportPlan(data, selectedTemplate);
  const mesocycleWeek = getCurrentMesocycleWeek(data.mesocyclePlan);
  const recommendationLabel =
    todayTrainingState.status === 'completed' ? '下次建议' : todayTrainingState.status === 'in_progress' ? '当前训练' : '今日建议';
  const completedTitle = '今日训练已完成';
  const currentTrainingName =
    todayTrainingState.status === 'completed'
      ? completedSession?.templateName || completedSession?.focus || '本次训练'
      : todayTrainingState.status === 'in_progress'
        ? data.activeSession?.templateName || selectedTemplate.name
        : selectedTemplate.name;
  const modeMeta = resolveMode(trainingMode);

  const handleExtraTraining = () => {
    if (typeof window === 'undefined' || window.confirm('你今天已经完成训练，确定要再开始一场吗？')) {
      onStart();
    }
  };

  const primaryAction =
    todayTrainingState.status === 'completed' && completedSession ? (
      <ActionButton type="button" onClick={() => onViewSession?.(completedSession.id, completedSession.date)} variant="primary" size="lg">
        查看本次训练
        <ChevronRight className="h-4 w-4" />
      </ActionButton>
    ) : todayTrainingState.status === 'in_progress' ? (
      <ActionButton type="button" onClick={onResume} variant="primary" size="lg">
        继续训练
        <ChevronRight className="h-4 w-4" />
      </ActionButton>
    ) : (
      <ActionButton type="button" onClick={onStart} variant="primary" size="lg">
        <Play className="h-4 w-4" />
        开始训练
      </ActionButton>
    );

  return (
    <ResponsivePageLayout>
      <PageHeader eyebrow="今日" title={todayTrainingState.status === 'completed' ? completedTitle : todayViewModel.pageTitle} description="今天是否训练、练什么、从哪里开始。" />

      <DashboardLayout
        main={
          <div className="space-y-4">
            <Card className="border-emerald-100 bg-white">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge tone={statusTone(todayViewModel.state)}>{todayViewModel.pageTitle}</StatusBadge>
                    <span className="text-xs font-semibold text-slate-400">{todayKey()}</span>
                  </div>
                  <h2 className="mt-3 text-2xl font-semibold text-slate-950">{currentTrainingName}</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{todayViewModel.statusText}</p>
                </div>
                <div className="flex shrink-0 flex-col gap-2 sm:flex-row md:flex-col">
                  {primaryAction}
                  {todayTrainingState.status === 'completed' ? (
                    <>
                      <ActionButton type="button" onClick={() => onViewCalendar?.(todayTrainingState.date)} variant="secondary">
                        查看训练日历
                      </ActionButton>
                      <ActionButton type="button" onClick={handleExtraTraining} variant="ghost">
                        再练一场
                      </ActionButton>
                    </>
                  ) : null}
                </div>
              </div>
            </Card>

            <InlineNotice tone={trainingLevelAssessment.level === 'unknown' ? 'amber' : 'sky'} title={trainingLevelAssessment.level === 'unknown' ? '正在建立训练基线' : '训练基线'}>
              {trainingLevelAssessment.level === 'unknown'
                ? '当前模板是起始模板，不是基于历史数据生成。完成 2–3 次训练后，系统会开始估算力量、有效组和训练等级。'
                : buildTrainingLevelExplanation(trainingLevelAssessment)}
            </InlineNotice>

            <details className="group rounded-lg border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-slate-900">
                <span>查看动作安排</span>
                <ChevronDown className="h-4 w-4 text-slate-400 transition group-open:rotate-180" />
              </summary>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                {adjustedExercises.map((exercise, index) => (
                  <Card key={`${exercise.id}-${index}`} className="p-3 shadow-none">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-slate-950">{formatExerciseName(exercise)}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          {Array.isArray(exercise.sets) ? exercise.sets.length : exercise.sets} 组 / {exercise.repMin}-{exercise.repMax} 次 / 休息 {Math.round((exercise.rest || 90) / 60)} 分钟
                        </div>
                      </div>
                      <StatusBadge tone={exercise.warning ? 'amber' : 'slate'}>{exercise.targetRirText || 'RIR 1–3'}</StatusBadge>
                    </div>
                    {exercise.adjustment || exercise.warning ? (
                      <div className="mt-2 text-xs leading-5 text-slate-500">{exercise.warning || exercise.adjustment}</div>
                    ) : null}
                  </Card>
                ))}
              </div>
            </details>

            <details className="group rounded-lg border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-slate-900">
                <span>计划组成</span>
                <ChevronDown className="h-4 w-4 text-slate-400 transition group-open:rotate-180" />
              </summary>
              <div className="mt-3 space-y-3">
                <div className="grid gap-2 md:grid-cols-3">
                  <InfoPill label="主训练" value={`${adjustedExercises.length} 个动作`} />
                  <InfoPill label="纠偏" value={`${supportPlan.correctionModules.length} 项`} />
                  <InfoPill label="功能补丁" value={`${supportPlan.functionalAddons.length} 项`} />
                </div>
                <WeeklyPrescriptionCard weeklyPrescription={weeklyPrescription} compact />
              </div>
            </details>
          </div>
        }
        side={
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <MetricCard label="准备度" value={`${adjustedPlan.readinessResult?.score ?? '--'} / 100`} tone={adjustedPlan.readiness.level === 'green' ? 'emerald' : adjustedPlan.readiness.level === 'yellow' ? 'amber' : 'rose'} />
              <MetricCard label="预计时长" value={`${adjustedPlan.duration} 分钟`} tone="emerald" />
              <MetricCard label="动作数" value={adjustedExercises.length} />
              <MetricCard label="训练模式" value={modeMeta.shortLabel} tone="amber" />
            </div>

            <PageSection title="今日状态">
              <Card className="space-y-3">
                <div>
                  <div className="mb-2 text-xs font-semibold text-slate-500">睡眠</div>
                  <Segment value={data.todayStatus.sleep} options={SLEEP_STATES} onChange={(value) => onStatusChange('sleep', value)} />
                </div>
                <div>
                  <div className="mb-2 text-xs font-semibold text-slate-500">精力</div>
                  <Segment value={data.todayStatus.energy} options={ENERGY_STATES} onChange={(value) => onStatusChange('energy', value)} />
                </div>
                <div>
                  <div className="mb-2 text-xs font-semibold text-slate-500">可用时间</div>
                  <Segment value={data.todayStatus.time} options={AVAILABLE_TIME_OPTIONS} labels={{ 30: '30 分', 60: '60 分', 90: '90 分' }} onChange={(value) => onStatusChange('time', value)} />
                </div>
                <div>
                  <div className="mb-2 text-xs font-semibold text-slate-500">酸痛部位</div>
                  <div className="flex flex-wrap gap-2">
                    {sorenessOptions.map((part) => (
                      <button
                        key={part}
                        type="button"
                        onClick={() => onSorenessToggle(part)}
                        className={[
                          'min-h-10 rounded-lg border px-3 text-sm font-medium transition',
                          data.todayStatus.soreness.includes(part)
                            ? 'border-emerald-500 bg-emerald-50 text-emerald-900'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-stone-50',
                        ].join(' ')}
                      >
                        {part}
                      </button>
                    ))}
                  </div>
                </div>
              </Card>
            </PageSection>

            <PageSection title={recommendationLabel}>
              <Card>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-base font-semibold text-slate-950">{suggestedTemplate.name}</div>
                    <p className="mt-1 text-sm leading-6 text-slate-500">
                      {todayTrainingState.status === 'completed'
                        ? '今天的主训练已完成。这里仅作为下一次训练参考，不是今天必须继续训练。'
                        : suggestedTemplate.note}
                    </p>
                  </div>
                  <StatusBadge tone={todayTrainingState.status === 'completed' ? 'sky' : 'emerald'}>{recommendationLabel}</StatusBadge>
                </div>
                {suggestedTemplate.id !== selectedTemplate.id ? (
                  <div className="mt-3">
                    <ActionButton type="button" onClick={onUseSuggestion} variant="secondary" fullWidth>
                      采用这个安排
                    </ActionButton>
                  </div>
                ) : null}
              </Card>
            </PageSection>

            <PageSection title="训练模式">
              <Card>
                <ModeSwitch value={trainingMode} onChange={(value) => onModeChange(value as TrainingMode)} />
                <p className="mt-3 text-sm leading-6 text-slate-500">
                  当前模式：{modeMeta.label}。同一模板下，推荐会因历史记录、训练等级、准备度和动作质量不同而变化。
                </p>
              </Card>
            </PageSection>

            <PageSection title="当前周期">
              <Card>
                <div className="grid gap-2 text-sm">
                  <InfoPill label="阶段" value={mesocycleWeek ? formatCyclePhase(mesocycleWeek.phase) : '未设置'} />
                  <InfoPill label="强度倾向" value={mesocycleWeek ? formatIntensityBias(mesocycleWeek.intensityBias) : '常规'} />
                  <InfoPill label="自动等级" value={formatAutoTrainingLevel(trainingLevelAssessment.level)} />
                </div>
              </Card>
            </PageSection>
          </div>
        }
      />
    </ResponsivePageLayout>
  );
}
