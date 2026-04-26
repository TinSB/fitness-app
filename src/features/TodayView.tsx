import React from 'react';
import { AlertTriangle, ChevronDown, ChevronRight, Flame, Play } from 'lucide-react';
import { TRAINING_MODE_META } from '../data/trainingData';
import { buildDeloadSignal } from '../engines/analytics';
import {
  applyStatusRules,
  buildTodayExplanations,
  buildSetPrescription,
  buildSupportPlan,
  buildWeeklyPrescription,
  buildPainPatterns,
  classNames,
  getCurrentMesocycleWeek,
  makeSuggestion,
  monthKey,
  resolveMode,
  sessionVolume,
  todayKey,
} from '../engines/trainingEngine';
import type { AppData, ExercisePrescription, TrainingMode, TrainingTemplate, WeeklyPrescription } from '../models/training-model';
import { InfoPill, ModeSwitch, Page, Segment, Stat, WeeklyPrescriptionCard } from '../ui/common';

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
}

const movementPatternLabels: Record<string, string> = {
  squat: '深蹲',
  hinge: '髋铰链',
  horizontal_push: '水平推',
  horizontal_pull: '水平拉',
  vertical_push: '垂直推',
  vertical_pull: '垂直拉',
  single_leg: '单腿',
  carry: '搬运',
  anti_rotation: '抗旋转',
  anti_extension: '抗伸展',
  scapular_control: '肩胛控制',
  mobility: '活动度',
};

const fatigueLabels: Record<string, string> = {
  low: '低',
  medium: '中',
  high: '高',
};

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

const sorenessOptions = ['无', '胸', '背', '腿', '肩', '手臂'] as const;

const labelFromMap = (value: string | undefined, labels: Record<string, string>) => {
  if (!value) return '未标记';
  return labels[value] || value;
};

const templateLabel = (id: string, fallback: string) => templateNameLabels[id] || fallback;

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
}: TodayViewProps) {
  const adjustedPlan = applyStatusRules(selectedTemplate, data.todayStatus, trainingMode, weeklyPrescription, data.history, data.screeningProfile, data.mesocyclePlan);
  const adjustedExercises = adjustedPlan.exercises as ExercisePrescription[];
  const supportPlan = buildSupportPlan(data, selectedTemplate);
  const projectedWeekly = buildWeeklyPrescription(data, {
    date: todayKey(),
    exercises: adjustedExercises,
  });
  const deloadSignal = buildDeloadSignal(data);
  const lastSession = data.history?.[0];
  const mesocycleWeek = getCurrentMesocycleWeek(data.mesocyclePlan);
  const painPatterns = buildPainPatterns(data.history || []);
  const activePainWarnings = adjustedExercises
    .map((exercise) => painPatterns.find((item) => item.exerciseId && (item.exerciseId === exercise.baseId || item.exerciseId === exercise.id)))
    .filter(Boolean)
    .slice(0, 2);
  const monthVolume = (data.history || [])
    .filter((session) => session.date?.startsWith(monthKey()))
    .reduce((sum, session) => sum + sessionVolume(session), 0);
  const adaptiveSignals = data.screeningProfile?.adaptiveState?.performanceDrops || [];
  const explanations = buildTodayExplanations({
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
      title="今天练什么"
      action={
        data.activeSession ? (
          <button onClick={onResume} className="flex items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 py-3 text-sm font-black text-white">
            回到训练中
            <ChevronRight className="h-4 w-4" />
          </button>
        ) : null
      }
    >
      <div className="grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
        <section className="rounded-lg border border-slate-200 bg-white p-4 md:p-5">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="text-sm font-bold text-slate-500">{todayKey()}</div>
              <h2 className="mt-1 text-2xl font-black text-slate-950">{templateLabel(selectedTemplate.id, selectedTemplate.name)}</h2>
              <p className="mt-1 text-sm text-slate-500">{selectedTemplate.note}</p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-sm md:min-w-80">
              <Stat label="模式" value={resolveMode(trainingMode).shortLabel} tone="amber" />
              <Stat label="预计时长" value={`${adjustedPlan.duration} 分钟`} tone="emerald" />
              <Stat label="动作数" value={adjustedExercises.length} />
            </div>
          </div>

          <div className="mb-4 grid gap-2 md:grid-cols-[1fr_auto] md:items-center">
            <div className="relative">
              <select
                value={data.selectedTemplateId}
                onChange={(event) => onTemplateSelect(event.target.value)}
                className="w-full appearance-none rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-emerald-500"
              >
                {data.templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {templateLabel(template.id, template.name)} / {template.duration} 分钟
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-3.5 h-4 w-4 text-slate-400" />
            </div>
            <button onClick={onStart} className="flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 py-3 text-sm font-black text-white hover:bg-emerald-700">
              <Play className="h-4 w-4" />
              开始训练
            </button>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {adjustedExercises.map((exercise) => {
              const suggestion = makeSuggestion(exercise, data.history);
              const setPrescription = buildSetPrescription(exercise, suggestion);
              return (
                <div key={`${exercise.id}-${exercise.name}`} className="rounded-lg border border-slate-200 bg-stone-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-black text-slate-950">{exercise.alias || exercise.name}</h3>
                      <div className="mt-1 text-xs font-bold text-slate-500">{exercise.name}</div>
                    </div>
                    <span className="rounded-md bg-white px-2 py-1 text-xs font-bold text-slate-600">
                      {(Array.isArray(exercise.sets) ? exercise.sets.length : exercise.sets) || 0} 组
                    </span>
                  </div>
                  <div className="mt-3 space-y-1 text-sm">
                    <div className="flex justify-between gap-3">
                      <span className="text-slate-500">上次表现</span>
                      <span className="font-bold text-slate-900">{suggestion.lastSummary}</span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-slate-500">今天处方</span>
                      <span className="font-bold text-emerald-700">{setPrescription.summary}</span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-slate-500">负荷范围</span>
                      <span className="font-bold text-slate-900">
                        {exercise.recommendedLoadRange} / {exercise.targetRirText}
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1">
                    {[
                      labelFromMap(exercise.movementPattern, movementPatternLabels),
                      `${Math.round(exercise.rest / 60)} 分钟休息`,
                      `ROM ${exercise.romPriority || '标准'}`,
                      `疲劳 ${labelFromMap(exercise.fatigueCost, fatigueLabels)}`,
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
                <Segment value={data.todayStatus.sleep} options={['差', '一般', '好']} onChange={(value) => onStatusChange('sleep', value)} />
              </div>
              <div>
                <div className="mb-2 text-xs font-bold text-slate-500">精力</div>
                <Segment value={data.todayStatus.energy} options={['低', '中', '高']} onChange={(value) => onStatusChange('energy', value)} />
              </div>
              <div>
                <div className="mb-2 text-xs font-bold text-slate-500">可训练时间</div>
                <Segment value={data.todayStatus.time} options={['30', '60', '90']} onChange={(value) => onStatusChange('time', value)} />
              </div>
              <div>
                <div className="mb-2 text-xs font-bold text-slate-500">酸痛</div>
                <div className="grid grid-cols-3 gap-1">
                  {sorenessOptions.map((part) => {
                    const selected = data.todayStatus.soreness.includes(part);
                    return (
                      <button
                        key={part}
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
            <div className="mb-2 text-xs font-black uppercase tracking-widest text-slate-500">状态灯</div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-black text-slate-950">
                  {adjustedPlan.readiness.label} / {adjustedPlan.readiness.title}
                </h2>
                <p className="mt-1 text-sm leading-6 text-slate-700">{adjustedPlan.readiness.advice}</p>
                <p className="mt-2 text-xs font-bold text-slate-600">readiness score：{adjustedPlan.readinessResult?.score ?? '--'} / 100</p>
              </div>
              <div className="rounded-md bg-white px-3 py-2 text-xs font-black text-slate-600">
                {adjustedPlan.readiness.reasons.join(' / ') || '状态稳定'}
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="mb-2 text-xs font-black uppercase tracking-widest text-slate-500">当前周期</div>
            <h2 className="font-black text-slate-950">第 {mesocycleWeek.weekIndex + 1} 周 / {mesocycleWeek.phase}</h2>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              <InfoPill label="容量倍率" value={`${Math.round(mesocycleWeek.volumeMultiplier * 100)}%`} />
              <InfoPill label="强度偏向" value={mesocycleWeek.intensityBias} />
            </div>
            {mesocycleWeek.notes ? <div className="mt-3 rounded-md bg-stone-50 px-3 py-2 text-sm text-slate-700">{mesocycleWeek.notes}</div> : null}
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="mb-2 text-xs font-black uppercase tracking-widest text-emerald-700">今日计划</div>
            <h2 className="font-black text-slate-950">主线 + 纠偏 + 功能补丁</h2>
            <div className="mt-3 grid gap-2">
              <InfoPill label="主训练" value={`${templateLabel(selectedTemplate.id, supportPlan.mainline.name || selectedTemplate.name)} / ${supportPlan.ratios.mainline}%`} />
              <InfoPill label="纠偏模块" value={supportPlan.correctionModules.map((module) => module.name).join(' / ') || '暂无'} />
              <InfoPill label="功能补丁" value={supportPlan.functionalAddons.map((addon) => addon.name).join(' / ') || '最低配补丁'} />
              <InfoPill label="预计总时长" value={`${supportPlan.totalDurationMin} 分钟`} />
            </div>
            {supportPlan.adherenceAdjustment?.reasons?.length ? (
              <div className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">{supportPlan.adherenceAdjustment.reasons[0]}</div>
            ) : null}
          </section>

          {activePainWarnings.length > 0 && (
            <section className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <div className="mb-2 text-xs font-black uppercase tracking-widest text-amber-700">保守提醒</div>
              <div className="space-y-2">
                {activePainWarnings.map((item) => (
                  <div key={`${item?.area}-${item?.exerciseId}`} className="rounded-md bg-white/70 px-3 py-2 text-sm font-medium text-amber-950">
                    {item?.exerciseId || item?.area} 最近反复出现不适，今天优先保守推进或替代。
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
            <div className="mb-2 text-xs font-black uppercase tracking-widest text-emerald-700">今日建议</div>
            <h2 className="text-xl font-black text-emerald-950">{templateLabel(suggestedTemplate.id, suggestedTemplate.name)}</h2>
            <p className="mt-1 text-sm leading-6 text-emerald-900">{suggestedTemplate.note}</p>
            <button onClick={onUseSuggestion} className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-3 text-sm font-black text-white">
              采用这套安排
              <ChevronRight className="h-4 w-4" />
            </button>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="mb-2 text-xs font-black uppercase tracking-widest text-slate-500">为什么这样排</div>
            <h2 className="font-black text-slate-950">今日安排解释</h2>
            <div className="mt-3 space-y-2">
              {explanations.map((item) => (
                <div key={item} className="rounded-md bg-stone-50 px-3 py-2 text-sm font-medium leading-6 text-slate-700">
                  {item}
                </div>
              ))}
            </div>
          </section>

          <WeeklyPrescriptionCard weeklyPrescription={weeklyPrescription} />

          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="mb-3 font-black text-slate-950">练完之后的周预算预览</h2>
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

          <section className={classNames('rounded-lg border p-4', deloadSignal.triggered ? 'border-rose-200 bg-rose-50' : 'border-slate-200 bg-white')}>
            <div className="mb-2 text-xs font-black uppercase tracking-widest text-slate-500">减量提醒</div>
            <h2 className="font-black text-slate-950">{deloadSignal.title}</h2>
            <div className="mt-2 text-sm font-bold leading-6 text-slate-700">
              {deloadSignal.reasons.length ? deloadSignal.reasons.join(' / ') : '当前还没有明显的疲劳触发信号。'}
            </div>
          </section>

          <section className="grid grid-cols-2 gap-3">
            <Stat label="上次训练" value={lastSession ? lastSession.templateName : '暂无'} />
            <Stat label="本月总量" value={`${Math.round(monthVolume)}kg`} tone="amber" />
          </section>

          {adaptiveSignals.length > 0 && (
            <section className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="mb-2 text-xs font-black uppercase tracking-widest text-slate-500">自适应反馈</div>
              <div className="space-y-2">
                {adaptiveSignals.slice(0, 4).map((item) => (
                  <div key={item} className="rounded-md bg-stone-50 px-3 py-2 text-sm font-bold text-slate-700">
                    表现回落：{item}
                  </div>
                ))}
              </div>
            </section>
          )}
        </aside>
      </div>
    </Page>
  );
}
