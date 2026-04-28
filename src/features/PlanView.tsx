import React from 'react';
import { Play, RotateCcw } from 'lucide-react';
import { DEFAULT_PROGRAM_TEMPLATE, DEFAULT_TECHNIQUE_STANDARD, PRESCRIPTION_SOURCES } from '../data/trainingData';
import { classNames, enrichExercise, findTemplate, getPrimaryMuscles, getSecondaryMuscles } from '../engines/engineUtils';
import { applyStatusRules } from '../engines/progressionEngine';
import { buildSupportPlan } from '../engines/supportPlanEngine';
import { getCurrentMesocycleWeek } from '../engines/mesocycleEngine';
import { buildTrainingLevelAssessment, formatAutoTrainingLevel } from '../engines/trainingLevelEngine';
import {
  formatCyclePhase,
  formatExerciseName,
  formatFatigueCost,
  formatIntensityBias,
  formatProgramTemplateName,
  formatReadinessLevel,
  formatSplitType,
} from '../i18n/formatters';
import type { AppData, ExercisePrescription, TrainingTemplate, WeeklyPrescription } from '../models/training-model';
import { ActionButton, InfoPill, LabelInput, Page, StatusBadge } from '../ui/common';

interface PlanViewProps {
  data: AppData;
  weeklyPrescription: WeeklyPrescription;
  selectedTemplateId: string;
  onSelectTemplate: (id: string) => void;
  onStartTemplate: (id: string) => void;
  onUpdateExercise: (templateId: string, exerciseIndex: number, field: string, value: string) => void;
  onResetTemplates: () => void;
  onRollbackProgramAdjustment?: (historyItemId: string) => void;
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

const goalBiasLabels: Record<string, string> = {
  hypertrophy: '肌肥大（增肌）',
  strength: '力量',
  posture: '纠偏',
  functional: '功能',
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

const labelJoin = (values: string[] = [], labels: Record<string, string>) => values.map((value) => labels[value] || value).join(' / ');
const templateLabel = (id: string, fallback: string) => templateNameLabels[id] || formatProgramTemplateName(fallback || id);

export function PlanView({ data, weeklyPrescription, selectedTemplateId, onSelectTemplate, onStartTemplate, onUpdateExercise, onResetTemplates, onRollbackProgramAdjustment }: PlanViewProps) {
  const fallbackTemplate = data.templates.find((item) => item.id === selectedTemplateId) ? selectedTemplateId : data.templates[0]?.id || selectedTemplateId;
  const template = findTemplate(data.templates, fallbackTemplate) as TrainingTemplate;
  const prescribedExercises = applyStatusRules(template, data.todayStatus, data.trainingMode, weeklyPrescription, data.history, data.screeningProfile, data.mesocyclePlan)
    .exercises as ExercisePrescription[];
  const supportPlan = buildSupportPlan(data, template);
  const trainingLevelAssessment = buildTrainingLevelAssessment({ history: data.history || [] });
  const program = data.programTemplate || DEFAULT_PROGRAM_TEMPLATE;
  const mesocycleWeek = getCurrentMesocycleWeek(data.mesocyclePlan);
  const activeTemplateId = data.activeProgramTemplateId || data.selectedTemplateId;
  const currentTemplate = data.templates.find((item) => item.id === activeTemplateId) || template;
  const activeHistoryItem = (data.programAdjustmentHistory || []).find(
    (item) => !item.rolledBackAt && item.experimentalProgramTemplateId === currentTemplate.id
  );
  const sourceTemplate = activeHistoryItem
    ? data.templates.find((item) => item.id === activeHistoryItem.sourceProgramTemplateId)
    : undefined;
  const activeTemplateMissing = Boolean(data.activeProgramTemplateId && !data.templates.some((item) => item.id === data.activeProgramTemplateId));
  const hasRollbackRecord = (data.programAdjustmentHistory || []).some((item) => item.rolledBackAt && item.sourceProgramTemplateId === currentTemplate.id);
  const currentTemplateStatus = activeHistoryItem
    ? '实验模板'
    : hasRollbackRecord
      ? '已回滚到原模板'
      : '原始模板';
  const currentTemplateName = formatProgramTemplateName(currentTemplate.name || currentTemplate.id);
  const sourceTemplateName = formatProgramTemplateName(sourceTemplate?.name || activeHistoryItem?.sourceProgramTemplateName || '');
  const mainAdjustmentSummary =
    activeHistoryItem?.mainChangeSummary ||
    currentTemplate.adjustmentSummary ||
    activeHistoryItem?.changes.slice(0, 3).map((change) => change.reason).join(' / ') ||
    '保留原计划结构';

  return (
    <Page
      eyebrow="计划"
      title="计划与模板"
      action={
        <div className="flex gap-2">
          <ActionButton onClick={onResetTemplates} variant="secondary">
            <RotateCcw className="h-4 w-4" />
            恢复默认
          </ActionButton>
          <ActionButton onClick={() => onStartTemplate(template.id)} variant="primary">
            <Play className="h-4 w-4" />
            以此开练
          </ActionButton>
        </div>
      }
    >
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <section className="rounded-lg border border-slate-200 bg-white p-3">
          <div className="space-y-2">
            {data.templates.map((item) => {
              const selected = item.id === selectedTemplateId;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectTemplate(item.id)}
                  className={classNames(
                    'w-full rounded-lg border p-4 text-left transition',
                    selected ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-white hover:bg-stone-50'
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="font-black text-slate-950">{templateLabel(item.id, item.name)}</h2>
                    <span className="rounded-md bg-white px-2 py-1 text-xs font-bold text-slate-600">{item.duration} 分钟</span>
                  </div>
                  <div className="mt-1 text-sm text-slate-500">
                    {item.focus} / {item.exercises.length} 个动作
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-2xl font-black text-slate-950">{templateLabel(template.id, template.name)}</h2>
              <p className="mt-1 text-sm text-slate-500">{template.note}</p>
            </div>
            <div className="rounded-lg bg-stone-50 px-4 py-3 text-sm font-bold text-slate-700">
              {template.focus} / {template.duration} 分钟
            </div>
          </div>

          {activeTemplateMissing ? (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold leading-6 text-amber-900">
              当前激活模板不存在，系统已回退到可用模板继续展示，不会让页面崩溃。
            </div>
          ) : null}

          <section className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="text-xs font-black uppercase tracking-widest text-emerald-700">当前模板状态</div>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <h3 className="font-black text-slate-950">{currentTemplateStatus}</h3>
                  <StatusBadge tone={activeHistoryItem ? 'amber' : hasRollbackRecord ? 'sky' : 'emerald'}>{currentTemplateStatus}</StatusBadge>
                </div>
                <div className="mt-2 text-sm font-bold leading-6 text-slate-700">
                  当前使用：{currentTemplateName}
                  {sourceTemplate ? `；来源模板：${sourceTemplateName}` : ''}
                </div>
                {activeHistoryItem ? (
                  <div className="mt-2 text-sm leading-6 text-emerald-950">
                    应用时间：{activeHistoryItem.appliedAt.slice(0, 10)}；主要调整：{mainAdjustmentSummary}
                  </div>
                ) : null}
              </div>
              {activeHistoryItem && onRollbackProgramAdjustment ? (
                <ActionButton
                  type="button"
                  onClick={() => {
                    if (!window.confirm('确认回滚到原模板吗？实验模板历史会保留。')) return;
                    onRollbackProgramAdjustment(activeHistoryItem.id);
                  }}
                  variant="danger"
                >
                  回滚到原模板
                </ActionButton>
              ) : null}
            </div>
          </section>

          <section className="mb-4 rounded-lg border border-sky-200 bg-sky-50 p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="text-xs font-black uppercase tracking-widest text-sky-700">训练基线</div>
                <h3 className="mt-1 font-black text-slate-950">{formatAutoTrainingLevel(trainingLevelAssessment.level)}</h3>
                <p className="mt-2 text-sm font-bold leading-6 text-slate-700">
                  {trainingLevelAssessment.level === 'unknown'
                    ? '当前模板是起始模板，不是基于历史数据生成。系统会在 2–3 次训练后开始校准等级。'
                    : `当前等级会影响模板建议：顶组/回退组${trainingLevelAssessment.readinessForAdvancedFeatures.topBackoff ? '可用' : '保守关闭'}，高容量${trainingLevelAssessment.readinessForAdvancedFeatures.higherVolume ? '可用' : '未启用'}。`}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <StatusBadge tone={trainingLevelAssessment.readinessForAdvancedFeatures.advancedExerciseSelection ? 'emerald' : 'slate'}>
                  复杂动作选择{trainingLevelAssessment.readinessForAdvancedFeatures.advancedExerciseSelection ? '可用' : '保守'}
                </StatusBadge>
                <StatusBadge tone={trainingLevelAssessment.readinessForAdvancedFeatures.aggressiveProgression ? 'emerald' : 'slate'}>
                  激进进阶{trainingLevelAssessment.readinessForAdvancedFeatures.aggressiveProgression ? '可用' : '关闭'}
                </StatusBadge>
              </div>
            </div>
          </section>

          <div className="mb-4 grid gap-3 md:grid-cols-3">
            <section className="rounded-lg border border-slate-200 bg-stone-50 p-4">
              <div className="text-xs font-black uppercase tracking-widest text-slate-500">主线</div>
              <h3 className="mt-1 font-black text-slate-950">主线结构</h3>
              <div className="mt-2 text-sm font-bold leading-6 text-slate-600">
                {formatSplitType(program.splitType)} / {program.daysPerWeek} 天 / {supportPlan.ratios.mainline}%
              </div>
            </section>
            <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
              <div className="text-xs font-black uppercase tracking-widest text-emerald-700">纠偏</div>
              <h3 className="mt-1 font-black text-slate-950">纠偏层</h3>
              <div className="mt-2 text-sm font-bold leading-6 text-slate-600">
                {supportPlan.correctionModules.map((module) => module.name).join(' / ') || '暂无'} / {supportPlan.ratios.correction}%
              </div>
            </section>
            <section className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <div className="text-xs font-black uppercase tracking-widest text-amber-700">补丁</div>
              <h3 className="mt-1 font-black text-slate-950">功能补丁层</h3>
              <div className="mt-2 text-sm font-bold leading-6 text-slate-600">
                {supportPlan.functionalAddons.map((addon) => addon.name).join(' / ') || '最低配补丁'} / {supportPlan.ratios.functional}%
              </div>
            </section>
          </div>

          <div className="mb-4 rounded-lg border border-slate-200 bg-white p-4">
            <div className="text-xs font-black uppercase tracking-widest text-slate-500">周期层</div>
            <div className="mt-2 grid gap-2 md:grid-cols-3">
              <InfoPill label="当前周" value={`第 ${mesocycleWeek.weekIndex + 1} 周`} />
              <InfoPill label="周期阶段" value={formatCyclePhase(mesocycleWeek.phase)} />
              <InfoPill label="容量 / 强度" value={`${Math.round(mesocycleWeek.volumeMultiplier * 100)}% / ${formatIntensityBias(mesocycleWeek.intensityBias)}`} />
            </div>
            {mesocycleWeek.notes ? <div className="mt-3 rounded-md bg-stone-50 px-3 py-2 text-sm text-slate-700">{mesocycleWeek.notes}</div> : null}
          </div>

          <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
            <div className="text-xs font-black uppercase tracking-widest text-emerald-700">处方依据</div>
            <div className="mt-2 grid gap-2 md:grid-cols-3">
              {PRESCRIPTION_SOURCES.map((source) => (
                <div key={source} className="rounded-md bg-white/70 p-3 text-xs font-bold leading-5 text-emerald-950">
                  {source}
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {template.exercises.map((exercise: TrainingTemplate['exercises'][number], index: number) => {
              const prescribed = prescribedExercises[index] || (enrichExercise(exercise) as ExercisePrescription);
              return (
                <div key={`${exercise.id}-${index}`} className="rounded-lg border border-slate-200 bg-stone-50 p-3">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-black text-slate-500">#{index + 1}</div>
                      <h3 className="font-black text-slate-950">{formatExerciseName(exercise)}</h3>
                    </div>
                    <span className="rounded-md bg-white px-2 py-1 text-xs font-bold text-slate-600">{exercise.muscle}</span>
                  </div>

                  <div className="grid gap-2 md:grid-cols-6">
                    <LabelInput label="别名" value={exercise.alias || ''} onChange={(value) => onUpdateExercise(template.id, index, 'alias', value)} />
                    <LabelInput label="组数" type="number" value={exercise.sets} onChange={(value) => onUpdateExercise(template.id, index, 'sets', value)} />
                    <LabelInput label="次数下限" type="number" value={exercise.repMin} onChange={(value) => onUpdateExercise(template.id, index, 'repMin', value)} />
                    <LabelInput label="次数上限" type="number" value={exercise.repMax} onChange={(value) => onUpdateExercise(template.id, index, 'repMax', value)} />
                    <LabelInput label="休息秒数" type="number" value={exercise.rest} onChange={(value) => onUpdateExercise(template.id, index, 'rest', value)} />
                    <LabelInput label="默认重量 kg" type="number" value={exercise.startWeight} onChange={(value) => onUpdateExercise(template.id, index, 'startWeight', value)} />
                  </div>

                  <div className="mt-3 rounded-md bg-white p-3 text-sm text-slate-600">
                    <span className="font-bold text-slate-950">替代动作：</span>
                    {exercise.alternatives?.map((item) => formatExerciseName(item)).join(' / ') || '暂无'}
                  </div>

                  <div className="mt-3 grid gap-2 md:grid-cols-3">
                    <LabelInput label="ROM 标准" value={exercise.techniqueStandard?.rom || DEFAULT_TECHNIQUE_STANDARD.rom} onChange={(value) => onUpdateExercise(template.id, index, 'rom', value)} />
                    <LabelInput label="动作节奏" value={exercise.techniqueStandard?.tempo || DEFAULT_TECHNIQUE_STANDARD.tempo} onChange={(value) => onUpdateExercise(template.id, index, 'tempo', value)} />
                    <LabelInput
                      label="停止条件"
                      value={exercise.techniqueStandard?.stopRule || DEFAULT_TECHNIQUE_STANDARD.stopRule}
                      onChange={(value) => onUpdateExercise(template.id, index, 'stopRule', value)}
                    />
                  </div>

                  <div className="mt-3 grid gap-2 md:grid-cols-4">
                    <InfoPill label="动作模式" value={movementPatternLabels[prescribed.movementPattern || ''] || prescribed.movementPattern || '未标记'} />
                    <InfoPill label="主要肌群" value={`${getPrimaryMuscles(prescribed).join(' / ')} / 辅助 ${getSecondaryMuscles(prescribed).join(' / ') || '无'}`} />
                    <InfoPill label="替代链" value={`${prescribed.equivalence?.label || prescribed.movementPattern || '同模式'} / 最佳记录分池`} />
                    <InfoPill label="目标偏向" value={labelJoin(prescribed.goalBias, goalBiasLabels) || '增肌'} />
                    <InfoPill label="负荷 / 次数" value={`${prescribed.recommendedLoadRange} / ${prescribed.repMin}-${prescribed.repMax}`} />
                    <InfoPill label="休息 / RIR" value={`${prescribed.rest}s / ${prescribed.targetRirText || '2-3 RIR'}`} />
                    <InfoPill label="疲劳 / 技术" value={`${formatFatigueCost(prescribed.fatigueCost)} / ${formatReadinessLevel(prescribed.skillDemand)}`} />
                    <InfoPill label="ROM 优先级" value={formatReadinessLevel(prescribed.romPriority || 'medium')} />
                    <InfoPill label="加重单位" value={prescribed.progressionUnit || '自动'} />
                    <InfoPill label="处方规则" value={prescribed.prescription?.rule || '默认推进'} />
                    <InfoPill label="热身方案" value={prescribed.warmupSets?.map((set) => `${set.label || `${set.weight}kg`} x ${set.reps}`).join(' / ') || '自动生成'} />
                    <InfoPill label="顶组 / 回退" value={prescribed.setPrescription?.summary || '直线组'} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </Page>
  );
}
