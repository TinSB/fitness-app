import React from 'react';
import { AlertTriangle, ChevronDown, ChevronRight, Flame, Play } from 'lucide-react';
import { TRAINING_MODE_META } from '../data/trainingData';
import { DEFINITIONS } from '../content/definitions';
import { formatAdherenceConfidence, formatCyclePhase, formatEvidenceConfidence, formatExerciseName, formatIntensityBias, formatReadinessLevel } from '../i18n/formatters';
import { buildDeloadSignal } from '../engines/deloadSignalEngine';
import { classNames, monthKey, resolveMode, sessionVolume, todayKey } from '../engines/engineUtils';
import { applyStatusRules, buildSetPrescription, makeSuggestion } from '../engines/progressionEngine';
import { buildPainPatterns } from '../engines/painPatternEngine';
import { filterAnalyticsHistory } from '../engines/sessionHistoryEngine';
import { buildSupportPlan, buildWeeklyPrescription } from '../engines/supportPlanEngine';
import { buildTodayExplanationItems, buildTrainingLevelExplanation, formatExplanationItem } from '../engines/explainability/trainingExplainability';
import { formatExplanationEvidence } from '../engines/explainability/evidenceExplainability';
import { getCurrentMesocycleWeek } from '../engines/mesocycleEngine';
import { buildE1RMProfile, estimateLoadFromE1RM, parsePercentRange } from '../engines/e1rmEngine';
import { buildTrainingLevelAssessment, formatAutoTrainingLevel } from '../engines/trainingLevelEngine';
import { formatTrainingVolume, formatWeight } from '../engines/unitConversionEngine';
import { buildTodayTrainingState } from '../engines/todayStateEngine';
import { buildTrainingDecisionContext, toStatusRulesDecisionContext } from '../engines/trainingDecisionContext';
import { buildTodayViewModel } from '../presenters/todayPresenter';
import type { AppData, ExercisePrescription, TrainingMode, TrainingTemplate, WeeklyPrescription } from '../models/training-model';
import { ActionButton, InlineNotice, InfoPill, InfoTooltip, ModeSwitch, Page, Segment, Stat, StatusBadge, WeeklyPrescriptionCard } from '../ui/common';
import { Card as ProductCard } from '../ui/Card';
import { MetricCard } from '../ui/MetricCard';
import { Term } from '../ui/Term';

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
const sleepOptions = ['差', '一般', '好'] as const;
const energyOptions = ['低', '中', '高'] as const;

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
    ]
  );
  const adjustedPlan = applyStatusRules(
    selectedTemplate,
    decisionContext.todayStatus,
    decisionContext.trainingMode,
    weeklyPrescription,
    decisionContext.history,
    decisionContext.screeningProfile,
    decisionContext.mesocyclePlan,
    toStatusRulesDecisionContext(decisionContext)
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
  const recommendationLabel =
    todayTrainingState.status === 'completed' ? '下次建议' : todayTrainingState.status === 'in_progress' ? '当前训练' : '今日建议';
  const pageTitle =
    todayTrainingState.status === 'completed' ? '今日训练已完成' : todayTrainingState.status === 'in_progress' ? '训练进行中' : '今天该怎么练';
  const handleExtraTraining = () => {
    if (typeof window === 'undefined' || window.confirm('你今天已经完成训练，确定要再开始一场吗？')) {
      onStart();
    }
  };
  const adjustedExercises = adjustedPlan.exercises as ExercisePrescription[];
  const analyticsHistory = filterAnalyticsHistory(data.history || []);
  const trainingLevelAssessment = buildTrainingLevelAssessment({ history: analyticsHistory });
  const supportPlan = buildSupportPlan(data, selectedTemplate);
  const projectedWeekly = buildWeeklyPrescription(data, { date: todayKey(), exercises: adjustedExercises });
  const deloadSignal = buildDeloadSignal(data);
  const lastSession = analyticsHistory[0];
  const mesocycleWeek = getCurrentMesocycleWeek(data.mesocyclePlan);
  const painPatterns = buildPainPatterns(analyticsHistory);
  const activePainWarnings = adjustedExercises
    .map((exercise) => painPatterns.find((item) => item.exerciseId && (item.exerciseId === exercise.baseId || item.exerciseId === exercise.id)))
    .filter(Boolean)
    .slice(0, 2);
  const monthVolume = analyticsHistory
    .filter((session) => session.date?.startsWith(monthKey()))
    .reduce((sum, session) => sum + sessionVolume(session), 0);
  const explanationItems = buildTodayExplanationItems({
    template: selectedTemplate,
    adjustedPlan: adjustedPlan as never,
    supportPlan,
    weeklyPrescription,
    screening: data.screeningProfile,
    todayStatus: data.todayStatus,
  });

  return (
    <Page
      eyebrow="今日"
      title={todayViewModel.pageTitle || pageTitle}
      action={
        todayTrainingState.status === 'in_progress' ? (
          <ActionButton type="button" onClick={onResume} variant="primary">
            继续上次训练
            <ChevronRight className="h-4 w-4" />
          </ActionButton>
        ) : todayTrainingState.status === 'completed' && completedSession ? (
          <ActionButton type="button" onClick={() => onViewSession?.(completedSession.id, completedSession.date)} variant="primary">
            查看本次训练
            <ChevronRight className="h-4 w-4" />
          </ActionButton>
        ) : null
      }
    >
      <ProductCard className="mb-3 border-emerald-100 bg-white">
        <div className="grid gap-4 lg:grid-cols-[1.4fr_0.6fr] lg:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge tone={todayViewModel.state === 'completed' ? 'emerald' : todayViewModel.state === 'in_progress' ? 'amber' : 'sky'}>
                {todayViewModel.pageTitle}
              </StatusBadge>
              <span className="text-xs font-semibold text-slate-400">{todayKey()}</span>
            </div>
            <h2 className="mt-3 text-2xl font-semibold text-slate-950">
              {todayViewModel.state === 'completed'
                ? completedSession?.templateName || '本次训练'
                : todayViewModel.state === 'in_progress'
                  ? data.activeSession?.templateName || selectedTemplate.name
                  : selectedTemplate.name}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{todayViewModel.statusText}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {todayTrainingState.status === 'completed' && completedSession ? (
                <>
                  <ActionButton type="button" onClick={() => onViewSession?.(completedSession.id, completedSession.date)} variant="primary">
                    查看本次训练
                  </ActionButton>
                  <ActionButton type="button" onClick={() => onViewCalendar?.(todayTrainingState.date)} variant="secondary">
                    查看日历
                  </ActionButton>
                  <ActionButton type="button" onClick={handleExtraTraining} variant="ghost">
                    再练一场
                  </ActionButton>
                </>
              ) : todayTrainingState.status === 'in_progress' ? (
                <ActionButton type="button" onClick={onResume} variant="primary">
                  继续训练
                  <ChevronRight className="h-4 w-4" />
                </ActionButton>
              ) : (
                <ActionButton type="button" onClick={onStart} variant="primary" size="lg">
                  <Play className="h-4 w-4" />
                  开始训练
                </ActionButton>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-1">
            <MetricCard label="准备度" value={`${adjustedPlan.readinessResult?.score ?? '--'} / 100`} />
            <MetricCard label="预计时长" value={`${adjustedPlan.duration} 分钟`} />
            <MetricCard label={todayTrainingState.status === 'completed' ? '下次建议' : '今日建议'} value={suggestedTemplate.name} />
          </div>
        </div>
      </ProductCard>

      <div className="grid gap-3 lg:grid-cols-[1.35fr_0.65fr]">
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="text-sm font-bold text-slate-500">{todayKey()}</div>
              <h2 className="mt-1 text-xl font-semibold text-slate-950 md:text-2xl">
                {todayTrainingState.status === 'completed'
                  ? `已完成 ${completedSession?.templateName || completedSession?.focus || '本次训练'}`
                  : todayTrainingState.status === 'in_progress'
                    ? data.activeSession?.templateName || selectedTemplate.name
                    : selectedTemplate.name}
              </h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                {todayTrainingState.status === 'completed'
                  ? '今天已经有一场正式训练记录。下面的安排会作为下次建议展示，不代表今天必须继续训练。'
                  : todayTrainingState.status === 'in_progress'
                    ? '当前有未完成训练，继续记录即可；不要重新开始覆盖 activeSession。'
                    : selectedTemplate.note}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <StatusBadge tone={adjustedPlan.readiness.level === 'green' ? 'emerald' : adjustedPlan.readiness.level === 'yellow' ? 'amber' : 'rose'}>
                  准备度 {adjustedPlan.readinessResult?.score ?? '--'} / 100
                </StatusBadge>
                <StatusBadge tone={deloadSignal.triggered ? 'rose' : 'slate'}>{deloadSignal.triggered ? '建议减量' : '正常推进'}</StatusBadge>
                <StatusBadge tone={trainingLevelAssessment.level === 'unknown' ? 'amber' : trainingLevelAssessment.confidence === 'high' ? 'emerald' : 'sky'}>
                  {formatAutoTrainingLevel(trainingLevelAssessment.level)}
                </StatusBadge>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-sm md:min-w-80">
              <Stat label="模式" value={resolveMode(trainingMode).shortLabel} tone="amber" />
              <Stat label="预计时长" value={`${adjustedPlan.duration} 分钟`} tone="emerald" />
              <Stat label="动作数" value={adjustedExercises.length} />
            </div>
          </div>

          <div className="mb-3">
            <InlineNotice tone={trainingLevelAssessment.level === 'unknown' ? 'amber' : 'sky'} title={trainingLevelAssessment.level === 'unknown' ? '正在建立训练基线' : '自动等级'}>
              {trainingLevelAssessment.level === 'unknown'
                ? '尚未建立训练基线。当前展示的是起始模板，不是基于你的历史数据生成的；完成 2–3 次训练后，系统会开始估算当前力量、有效组和训练等级。'
                : buildTrainingLevelExplanation(trainingLevelAssessment)}
            </InlineNotice>
          </div>

          <div className="mb-3 grid gap-2 md:grid-cols-[1fr_auto] md:items-center">
            <div className="relative">
              <select
                value={data.selectedTemplateId}
                onChange={(event) => onTemplateSelect(event.target.value)}
                className="w-full appearance-none rounded-lg border border-slate-200 bg-white px-4 py-3 text-base font-bold text-slate-900 outline-none focus:border-emerald-500 md:text-sm"
              >
                {data.templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name} / {template.duration} 分钟
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-3.5 h-4 w-4 text-slate-400" />
            </div>
            {todayTrainingState.status === 'not_started' ? (
              <ActionButton type="button" onClick={onStart} variant="primary" size="lg">
                <Play className="h-4 w-4" />
                开始训练
              </ActionButton>
            ) : todayTrainingState.status === 'in_progress' ? (
              <ActionButton type="button" onClick={onResume} variant="primary" size="lg">
                继续训练
                <ChevronRight className="h-4 w-4" />
              </ActionButton>
            ) : (
              <div className="grid gap-2 sm:grid-cols-3 md:flex">
                <ActionButton type="button" onClick={() => completedSession && onViewSession?.(completedSession.id, completedSession.date)} variant="primary">
                  查看本次训练
                </ActionButton>
                <ActionButton type="button" onClick={() => onViewCalendar?.(todayTrainingState.date)} variant="secondary">
                  查看训练日历
                </ActionButton>
                <ActionButton type="button" onClick={handleExtraTraining} variant="ghost">
                  再练一场
                </ActionButton>
              </div>
            )}
          </div>

          <details className="rounded-lg border border-slate-200 bg-stone-50 p-3">
            <summary className="cursor-pointer list-none text-sm font-semibold text-slate-700">
              查看动作安排
            </summary>
            <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {adjustedExercises.map((exercise) => {
              const suggestion = makeSuggestion(exercise, analyticsHistory);
              const setPrescription = buildSetPrescription(exercise, suggestion);
              const e1rmProfile = buildE1RMProfile(analyticsHistory, exercise.canonicalExerciseId || exercise.baseId || exercise.id);
              const e1rm = e1rmProfile.current?.confidence === 'low' ? null : e1rmProfile.current;
              const percentRange = parsePercentRange(exercise.recommendedLoadRange);
              const loadRange = e1rm && percentRange ? estimateLoadFromE1RM(e1rm.e1rmKg, percentRange) : null;
              return (
                <div key={`${exercise.id}-${exercise.name}`} className="rounded-lg border border-slate-200 bg-stone-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-black text-slate-950">{formatExerciseName(exercise)}</h3>
                      <div className="mt-1 text-xs font-bold text-slate-500">{formatExerciseName(exercise.baseId || exercise.id)}</div>
                    </div>
                    <span className="rounded-md bg-white px-2 py-1 text-xs font-bold text-slate-600">
                      {(Array.isArray(exercise.sets) ? exercise.sets.length : exercise.sets) || 0} 组
                    </span>
                  </div>
                  <div className="mt-3 space-y-1 text-sm">
                    <div className="flex justify-between gap-3">
                      <span className="text-slate-500">上次记录</span>
                      <span className="font-bold text-slate-900">{suggestion.lastSummary}</span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-slate-500">今日处方</span>
                      <span className="font-bold text-emerald-700">{setPrescription.summary}</span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-slate-500">负荷建议</span>
                      <span className="text-right font-bold text-slate-900">
                        {loadRange
                          ? `${formatWeight(loadRange.minKg, data.unitSettings)}-${formatWeight(loadRange.maxKg, data.unitSettings)} / ${exercise.targetRirText}`
                          : `按目标次数和 ${exercise.targetRirText || 'RIR'} 选择可控重量`}
                      </span>
                    </div>
                    <div className="rounded-md bg-white px-3 py-2 text-xs font-bold leading-5 text-slate-600">
                      {e1rm ? (
                        <>
                          估算 <Term id="oneRm" label="1RM" compact />：{formatWeight(e1rm.e1rmKg, data.unitSettings)}，置信度 {formatAdherenceConfidence(e1rm.confidence)}；依据最近工作组{' '}
                          {formatWeight(e1rm.sourceSet.weightKg, data.unitSettings)} x {e1rm.sourceSet.reps}。本次负荷建议基于近期高质量记录，不使用历史最高记录。
                        </>
                      ) : (
                        <>历史高质量记录不足，暂不输出精确公斤数；先按目标次数和 <Term id="rir" label="RIR" compact /> 控制重量。</>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1">
                    {[
                      exercise.movementPattern || '动作模式',
                      `${Math.round(exercise.rest / 60)} 分钟休息`,
                      `ROM：${formatReadinessLevel(exercise.romPriority || 'standard')}`,
                      `动作质量优先`,
                    ].map((tag) => (
                      <span key={tag} className="rounded-md bg-white px-2 py-1 text-xs font-bold text-slate-500">
                        {tag}
                      </span>
                    ))}
                  </div>
                  {(exercise.warning || exercise.adjustment) && (
                    <div className="mt-3 flex gap-2 rounded-md bg-amber-50 p-2 text-xs font-bold text-amber-800">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      {exercise.warning || exercise.adjustment}
                    </div>
                  )}
                </div>
              );
              })}
            </div>
          </details>
        </section>

        <aside className="space-y-4">
          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="mb-3">
              <h2 className="font-black text-slate-950">训练模式</h2>
              <p className="mt-1 text-sm leading-5 text-slate-500">{TRAINING_MODE_META[trainingMode]?.description}</p>
            </div>
            <ModeSwitch value={trainingMode} onChange={(value) => onModeChange(value as TrainingMode)} />
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-black text-slate-950">今日状态</h2>
              <Flame className="h-5 w-5 text-emerald-600" />
            </div>
            <div className="space-y-4">
              <div>
                <div className="mb-2 text-xs font-bold text-slate-500">睡眠</div>
                <Segment value={data.todayStatus.sleep} options={sleepOptions} onChange={(value) => onStatusChange('sleep', value)} />
              </div>
              <div>
                <div className="mb-2 text-xs font-bold text-slate-500">精力</div>
                <Segment value={data.todayStatus.energy} options={energyOptions} onChange={(value) => onStatusChange('energy', value)} />
              </div>
              <div>
                <div className="mb-2 text-xs font-bold text-slate-500">可训练时间</div>
                <Segment value={data.todayStatus.time} options={['30', '60', '90']} onChange={(value) => onStatusChange('time', value)} />
              </div>
              <div>
                <div className="mb-2 text-xs font-bold text-slate-500">酸痛部位</div>
                <div className="grid grid-cols-3 gap-1">
                  {sorenessOptions.map((part) => {
                    const selected = data.todayStatus.soreness.includes(part);
                    return (
                      <button
                        key={part}
                        type="button"
                        onClick={() => onSorenessToggle(part)}
                        className={classNames(
                          'rounded-md px-2 py-2 text-sm font-bold transition',
                          selected ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-500 hover:text-slate-900'
                        )}
                      >
                        {part}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>

          <section
            className={classNames(
              'rounded-lg border p-4',
              adjustedPlan.readiness.level === 'green' && 'border-emerald-200 bg-emerald-50',
              adjustedPlan.readiness.level === 'yellow' && 'border-amber-200 bg-amber-50',
              adjustedPlan.readiness.level === 'red' && 'border-rose-200 bg-rose-50'
            )}
          >
            <div className="mb-2 flex items-center gap-1 text-xs font-black uppercase tracking-widest text-slate-500">
              准备度评分
              <InfoTooltip title={DEFINITIONS.readinessScore.title} body={DEFINITIONS.readinessScore.body} />
            </div>
            <h2 className="text-xl font-black text-slate-950">
              {adjustedPlan.readinessResult?.score ?? '--'} / 100 · {adjustedPlan.readiness.title}
            </h2>
            <p className="mt-1 text-sm leading-6 text-slate-700">{adjustedPlan.readiness.advice}</p>
            {adjustedPlan.readiness.reasons?.length ? (
              <div className="mt-2 space-y-1 text-xs font-semibold leading-5 text-slate-600">
                {adjustedPlan.readiness.reasons.slice(0, 3).map((reason) => (
                  <div key={reason}>{reason}</div>
                ))}
              </div>
            ) : null}
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="mb-2 text-xs font-black uppercase tracking-widest text-slate-500">当前训练周期</div>
            <h2 className="font-black text-slate-950">
              第 {mesocycleWeek.weekIndex + 1} 周 / {formatCyclePhase(mesocycleWeek.phase)}
            </h2>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              <InfoPill label="训练量系数" value={`${Math.round(mesocycleWeek.volumeMultiplier * 100)}%`} />
              <InfoPill label="强度倾向" value={formatIntensityBias(mesocycleWeek.intensityBias)} />
            </div>
            {mesocycleWeek.notes ? <div className="mt-3 rounded-md bg-stone-50 px-3 py-2 text-sm text-slate-700">{mesocycleWeek.notes}</div> : null}
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="mb-2 text-xs font-black uppercase tracking-widest text-emerald-700">
              {todayTrainingState.status === 'completed' ? '下次计划参考' : todayTrainingState.status === 'in_progress' ? '当前计划' : '今日计划'}
            </div>
            <h2 className="font-black text-slate-950">主训练 + 纠偏模块 + 功能补丁</h2>
            <div className="mt-3 grid gap-2">
              <InfoPill label="主训练" value={`${supportPlan.mainline.name || selectedTemplate.name} / ${supportPlan.ratios.mainline}%`} />
              <InfoPill label="纠偏模块" value={supportPlan.correctionModules.map((module) => module.name).join(' / ') || '暂无'} />
              <InfoPill label="功能补丁" value={supportPlan.functionalAddons.map((addon) => addon.name).join(' / ') || '最小补丁'} />
              <InfoPill label="预计总时长" value={`${supportPlan.totalDurationMin} 分钟`} />
            </div>
          </section>

          {activePainWarnings.length > 0 && (
            <section className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <div className="mb-2 text-xs font-black uppercase tracking-widest text-amber-700">保守提醒</div>
              <div className="space-y-2">
                {activePainWarnings.map((item) => (
                  <InlineNotice key={`${item?.area}-${item?.exerciseId}`} tone="amber">
                    {item?.exerciseId || item?.area} 最近反复出现不适，今天优先保守推进或替代动作。
                  </InlineNotice>
                ))}
              </div>
            </section>
          )}

          <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
            <div className="mb-2 text-xs font-black uppercase tracking-widest text-emerald-700">{recommendationLabel}</div>
            <h2 className="text-xl font-black text-emerald-950">{suggestedTemplate.name}</h2>
            <p className="mt-1 text-sm leading-6 text-emerald-900">
              {todayTrainingState.status === 'completed'
                ? `今日已完成 ${completedSession?.templateName || '训练'}。${suggestedTemplate.note} 这是下次建议，不是今天必须继续训练。`
                : suggestedTemplate.note}
            </p>
            {todayTrainingState.status === 'not_started' ? (
              <ActionButton type="button" onClick={onUseSuggestion} variant="primary" fullWidth className="mt-4">
                采用这套安排
                <ChevronRight className="h-4 w-4" />
              </ActionButton>
            ) : todayTrainingState.status === 'completed' ? (
              <ActionButton type="button" onClick={handleExtraTraining} variant="secondary" fullWidth className="mt-4">
                安排加练
                <ChevronRight className="h-4 w-4" />
              </ActionButton>
            ) : (
              <div className="mt-4 rounded-md bg-white px-3 py-2 text-sm font-bold text-emerald-900">先完成当前训练，再查看下次建议。</div>
            )}
          </section>

          <details className="rounded-lg border border-slate-200 bg-white p-4">
            <summary className="cursor-pointer list-none font-black text-slate-950">更多计划信息</summary>
            <div className="mt-4 space-y-4">
              <section className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="mb-2 text-xs font-black uppercase tracking-widest text-slate-500">为什么这样排</div>
                <h2 className="font-black text-slate-950">{todayTrainingState.status === 'completed' ? '下次安排说明' : '今日安排解释'}</h2>
                <div className="mt-3 space-y-2">
                  {explanationItems.map((item) => (
                    <details key={`${item.title}-${item.conclusion}`} className="rounded-md bg-stone-50 px-3 py-2 text-sm font-medium leading-6 text-slate-700">
                      <summary className="cursor-pointer list-none">
                        <span className="font-black text-slate-950">{item.title}：</span>
                        {formatExplanationItem(item)}
                      </summary>
                      <div className="mt-2 space-y-1 border-t border-slate-200 pt-2 text-xs font-bold text-slate-500">
                        {formatExplanationEvidence(item).length ? <div>依据：{formatExplanationEvidence(item).join(' / ')}</div> : null}
                        {item.confidence ? <div>{formatEvidenceConfidence(item.confidence)}</div> : null}
                        {item.caveat ? <div>边界：{item.caveat}</div> : null}
                      </div>
                    </details>
                  ))}
                </div>
              </section>

              <WeeklyPrescriptionCard weeklyPrescription={weeklyPrescription} />

              <section className="rounded-lg border border-slate-200 bg-white p-4">
                <h2 className="mb-3 font-black text-slate-950">练完后的周预算预览</h2>
                <div className="space-y-2">
                  {projectedWeekly.muscles.map((item) => (
                    <div key={item.muscle} className="rounded-md bg-stone-50 px-3 py-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-600">{item.muscle}</span>
                        <span className="font-black text-slate-950">
                          {item.sets}/{item.target} 组
                        </span>
                      </div>
                      <div className="mt-1 grid grid-cols-3 gap-2 text-xs font-bold text-slate-500">
                        <span>剩余 {item.remaining}</span>
                        <span>额度 {item.remainingCapacity}</span>
                        <span>今日 {item.todayBudget}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </details>

          <section className={classNames('rounded-lg border p-4', deloadSignal.triggered ? 'border-rose-200 bg-rose-50' : 'border-slate-200 bg-white')}>
            <div className="mb-2 flex items-center gap-1 text-xs font-black uppercase tracking-widest text-slate-500">
              减量提醒
              <InfoTooltip title={DEFINITIONS.deloadWeek.title} body={DEFINITIONS.deloadWeek.body} />
            </div>
            <h2 className="font-black text-slate-950">{deloadSignal.title}</h2>
            <div className="mt-2 text-sm font-bold leading-6 text-slate-700">
              {deloadSignal.reasons.length ? deloadSignal.reasons.join(' / ') : '当前还没有明显的疲劳触发信号。'}
            </div>
          </section>

          <section className="grid grid-cols-2 gap-3">
            <Stat label="上次训练" value={lastSession ? lastSession.templateName : '暂无'} />
            <Stat label="本月总量" value={formatTrainingVolume(monthVolume, data.unitSettings)} tone="amber" />
          </section>
        </aside>
      </div>
    </Page>
  );
}
