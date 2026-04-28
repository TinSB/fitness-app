import React from 'react';
import { Play, RotateCcw } from 'lucide-react';
import { DEFAULT_PROGRAM_TEMPLATE } from '../data/trainingData';
import { classNames, enrichExercise, findTemplate, getPrimaryMuscles } from '../engines/engineUtils';
import { applyStatusRules } from '../engines/progressionEngine';
import { buildSupportPlan } from '../engines/supportPlanEngine';
import { getCurrentMesocycleWeek } from '../engines/mesocycleEngine';
import { buildTrainingLevelAssessment, formatAutoTrainingLevel } from '../engines/trainingLevelEngine';
import {
  formatAdjustmentChangeLabel,
  formatConfidence,
  formatCyclePhase,
  formatExerciseName,
  formatFatigueCost,
  formatGoal,
  formatIntensityBias,
  formatReplacementCategory,
  formatRomPriority,
  formatSkillDemand,
  formatProgramTemplateName,
  formatSplitType,
} from '../i18n/formatters';
import type {
  AdjustmentChange,
  AppData,
  ProgramAdjustmentDraft,
  ProgramAdjustmentHistoryItem,
  TrainingTemplate,
  WeeklyPrescription,
} from '../models/training-model';
import { ActionButton } from '../ui/ActionButton';
import { Card } from '../ui/Card';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { EmptyState } from '../ui/EmptyState';
import { ListItem } from '../ui/ListItem';
import { MetricCard } from '../ui/MetricCard';
import { PageHeader } from '../ui/PageHeader';
import { PageSection } from '../ui/PageSection';
import { StatusBadge } from '../ui/StatusBadge';
import { ResponsivePageLayout } from '../ui/layouts/ResponsivePageLayout';
import { formatWeight } from '../engines/unitConversionEngine';

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

const templateNameLabels: Record<string, string> = {
  'push-a': '推 A',
  'pull-a': '拉 A',
  'legs-a': '腿 A',
  upper: '上肢',
  lower: '下肢',
  arms: '手臂补量',
  'quick-30': '30 分钟快练',
  'crowded-gym': '人多替代',
};

const templateLabel = (template: Pick<TrainingTemplate, 'id' | 'name'> | string, fallback = '') => {
  if (typeof template === 'string') return templateNameLabels[template] || formatProgramTemplateName(fallback || template);
  return templateNameLabels[template.id] || formatProgramTemplateName(template.name || template.id);
};

const formatDateLabel = (value?: string) => {
  if (!value) return '未记录日期';
  return value.slice(0, 10);
};

const formatChangeImpact = (change: AdjustmentChange) => {
  if (change.skipped) return change.skipReason || '该项已跳过，不会修改模板。';
  if (change.type === 'add_sets') return `给已有动作增加 ${change.setsDelta || change.sets || 1} 组。`;
  if (change.type === 'remove_sets') return `减少 ${Math.abs(change.setsDelta || change.sets || 1)} 组训练量。`;
  if (change.type === 'add_new_exercise') {
    return `新增 ${change.exerciseName || formatExerciseName(change.exerciseId)}，${change.sets || 1} 组${change.repMin && change.repMax ? `，${change.repMin}-${change.repMax} 次` : ''}。`;
  }
  if (change.type === 'swap_exercise') return `替换为 ${change.replacementExerciseName || formatExerciseName(change.replacementExerciseId)}。`;
  if (change.type === 'reduce_support') return '降低纠偏或功能补丁剂量，缩短训练负担。';
  if (change.type === 'increase_support') return '增加关键纠偏或功能补丁，优先处理短板。';
  return '保留当前计划结构。';
};

const formatChangeReason = (change: AdjustmentChange) => change.reason || change.previewNote || '根据近期训练记录生成。';

const adjustmentStatusTone = (item: ProgramAdjustmentHistoryItem): 'emerald' | 'amber' | 'slate' => {
  if (item.rolledBackAt) return 'slate';
  if (item.rollbackAvailable) return 'amber';
  return 'emerald';
};

const TemplateStatusBadge = ({
  template,
  activeTemplateId,
}: {
  template: TrainingTemplate;
  activeTemplateId?: string;
}) => {
  if (template.id === activeTemplateId && template.isExperimentalTemplate) return <StatusBadge tone="amber">当前实验模板</StatusBadge>;
  if (template.id === activeTemplateId) return <StatusBadge tone="emerald">当前使用</StatusBadge>;
  if (template.isExperimentalTemplate) return <StatusBadge tone="amber">实验模板</StatusBadge>;
  return <StatusBadge tone="slate">可选模板</StatusBadge>;
};

const PlanInput = ({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  type?: string;
}) => (
  <label className="block">
    <span className="mb-1 block text-xs font-semibold text-slate-500">{label}</span>
    <input
      type={type}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-base font-semibold text-slate-900 outline-none transition focus:border-emerald-500 md:text-sm"
    />
  </label>
);

export function PlanView({
  data,
  weeklyPrescription,
  selectedTemplateId,
  onSelectTemplate,
  onStartTemplate,
  onUpdateExercise,
  onResetTemplates,
  onRollbackProgramAdjustment,
}: PlanViewProps) {
  const [rollbackTarget, setRollbackTarget] = React.useState<ProgramAdjustmentHistoryItem | null>(null);
  const fallbackTemplateId = data.templates.some((item) => item.id === selectedTemplateId) ? selectedTemplateId : data.templates[0]?.id || selectedTemplateId;
  const selectedTemplate = findTemplate(data.templates, fallbackTemplateId) as TrainingTemplate;
  const program = data.programTemplate || DEFAULT_PROGRAM_TEMPLATE;
  const mesocycle = data.mesocyclePlan;
  const mesocycleWeek = getCurrentMesocycleWeek(mesocycle);
  const activeTemplateId = data.activeProgramTemplateId || data.selectedTemplateId;
  const currentTemplate = data.templates.find((item) => item.id === activeTemplateId) || selectedTemplate;
  const prescribed = applyStatusRules(selectedTemplate, data.todayStatus, data.trainingMode, weeklyPrescription, data.history, data.screeningProfile, mesocycle);
  const supportPlan = buildSupportPlan(data, selectedTemplate);
  const trainingLevelAssessment = buildTrainingLevelAssessment({ history: data.history || [] });
  const adjustmentDrafts = (data.programAdjustmentDrafts || []).slice(0, 3);
  const adjustmentHistory = data.programAdjustmentHistory || [];
  const activeHistoryItem = adjustmentHistory.find((item) => !item.rolledBackAt && item.experimentalProgramTemplateId === currentTemplate.id);
  const experimentalTemplates = data.templates.filter((template) => template.isExperimentalTemplate || template.sourceTemplateId);
  const activeTemplateMissing = Boolean(data.activeProgramTemplateId && !data.templates.some((item) => item.id === data.activeProgramTemplateId));

  const currentTemplateStatus = activeHistoryItem
    ? '实验模板'
    : adjustmentHistory.some((item) => item.rolledBackAt && item.sourceProgramTemplateId === currentTemplate.id)
      ? '已回滚模板'
      : '原始模板';

  const confirmRollback = () => {
    if (!rollbackTarget || !onRollbackProgramAdjustment) return;
    onRollbackProgramAdjustment(rollbackTarget.id);
    setRollbackTarget(null);
  };

  const renderCurrentTemplate = () => (
    <PageSection title="当前模板" description="这里显示现在计划正在使用的模板，不混入历史训练详情。">
      <Card className={classNames('space-y-4', activeHistoryItem ? 'border-amber-200 bg-amber-50' : '')}>
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <StatusBadge tone={activeHistoryItem ? 'amber' : currentTemplateStatus === '已回滚模板' ? 'sky' : 'emerald'}>{currentTemplateStatus}</StatusBadge>
              {activeTemplateMissing ? <StatusBadge tone="amber">已回退到可用模板</StatusBadge> : null}
            </div>
            <h2 className="text-xl font-bold text-slate-950">{templateLabel(currentTemplate)}</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              {currentTemplate.focus || '计划训练'} · {currentTemplate.duration || program.dayTemplates?.[0]?.estimatedDurationMin || 60} 分钟 · {currentTemplate.exercises?.length || 0} 个动作
            </p>
            {activeHistoryItem ? (
              <p className="mt-2 rounded-lg bg-white/70 px-3 py-2 text-sm leading-6 text-amber-950">
                来源模板：{formatProgramTemplateName(activeHistoryItem.sourceProgramTemplateName || activeHistoryItem.sourceProgramTemplateId)}
                <br />
                主要调整：{activeHistoryItem.mainChangeSummary || activeHistoryItem.changes?.[0]?.reason || '实验模板调整'}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <ActionButton variant="secondary" onClick={onResetTemplates}>
              <RotateCcw className="h-4 w-4" />
              恢复默认
            </ActionButton>
            <ActionButton variant="secondary" onClick={() => onStartTemplate(currentTemplate.id)}>
              <Play className="h-4 w-4" />
              以此开练
            </ActionButton>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <MetricCard label="计划目标" value={formatGoal(program.primaryGoal)} tone="emerald" />
          <MetricCard label="分化方式" value={formatSplitType(program.splitType)} />
          <MetricCard label="每周频率" value={`${program.daysPerWeek} 天`} />
        </div>
      </Card>
    </PageSection>
  );

  const renderCycleTimeline = () => (
    <PageSection title="周期时间线" description="当前周期只说明未来几周怎么推进，不展示训练历史。">
      <Card>
        <div className="mb-3 grid gap-3 md:grid-cols-3">
          <MetricCard label="当前周" value={`第 ${mesocycleWeek.weekIndex + 1} 周`} tone="sky" />
          <MetricCard label="阶段" value={formatCyclePhase(mesocycleWeek.phase)} />
          <MetricCard label="容量 / 强度" value={`${Math.round(mesocycleWeek.volumeMultiplier * 100)}% / ${formatIntensityBias(mesocycleWeek.intensityBias)}`} />
        </div>
        <div className="grid gap-2 md:grid-cols-4">
          {(mesocycle.weeks || []).map((week) => {
            const isCurrent = week.weekIndex === mesocycleWeek.weekIndex;
            return (
              <div
                key={week.weekIndex}
                className={classNames(
                  'rounded-lg border p-3',
                  isCurrent ? 'border-emerald-300 bg-emerald-50 text-emerald-950' : 'border-slate-200 bg-stone-50 text-slate-700',
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold">第 {week.weekIndex + 1} 周</span>
                  {isCurrent ? <StatusBadge tone="emerald">当前</StatusBadge> : null}
                </div>
                <div className="mt-2 text-xs leading-5 text-slate-600">
                  {formatCyclePhase(week.phase)} · 容量 {Math.round(week.volumeMultiplier * 100)}% · {formatIntensityBias(week.intensityBias)}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </PageSection>
  );

  const renderThisWeekDays = () => (
    <PageSection title="本周训练日" description="这些是本周计划结构，用来回答接下来每次大致练什么。">
      <div className="grid gap-3 md:grid-cols-2">
        {(program.dayTemplates || []).map((day, index) => (
          <Card key={day.id} className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-semibold text-emerald-700">训练日 {index + 1}</div>
                <h3 className="mt-1 text-base font-semibold text-slate-950">{day.name}</h3>
                <p className="mt-1 text-sm text-slate-500">{day.focusMuscles.join(' / ') || '综合训练'} · 预计 {day.estimatedDurationMin} 分钟</p>
              </div>
              <StatusBadge tone="sky">{day.mainExerciseIds.length} 个主动作</StatusBadge>
            </div>
            <div className="flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
              {day.mainExerciseIds.slice(0, 5).map((exerciseId) => (
                <span key={exerciseId} className="rounded-md bg-stone-50 px-2 py-1">
                  {formatExerciseName(exerciseId)}
                </span>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </PageSection>
  );

  const renderTrainingTemplates = () => (
    <PageSection title="训练日模板" description="选择一个模板查看结构。实验模板会用独立标记区分。">
      <div className="grid gap-3">
        {data.templates.map((template) => {
          const selected = template.id === selectedTemplate.id;
          return (
            <Card
              key={template.id}
              className={classNames(
                'transition',
                selected ? 'border-emerald-300 bg-emerald-50' : '',
                template.isExperimentalTemplate && !selected ? 'border-amber-200 bg-amber-50' : '',
              )}
            >
              <button type="button" className="w-full text-left" onClick={() => onSelectTemplate(template.id)}>
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold text-slate-950">{templateLabel(template)}</h3>
                      <TemplateStatusBadge template={template} activeTemplateId={activeTemplateId} />
                    </div>
                    <p className="mt-1 text-sm leading-6 text-slate-600">{template.focus} · {template.duration} 分钟 · {template.exercises.length} 个动作</p>
                  </div>
                  <StatusBadge tone={selected ? 'emerald' : 'slate'}>{selected ? '正在查看' : '点击查看'}</StatusBadge>
                </div>
              </button>
            </Card>
          );
        })}
      </div>
    </PageSection>
  );

  const renderSelectedTemplateDetail = () => (
    <PageSection title="当前查看的训练日" description="只展示训练执行所需的处方摘要；细节可展开调整。">
      <Card className="space-y-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-950">{templateLabel(selectedTemplate)}</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">{selectedTemplate.note || selectedTemplate.focus}</p>
          </div>
          <ActionButton variant="secondary" onClick={() => onStartTemplate(selectedTemplate.id)}>
            以此模板训练
          </ActionButton>
        </div>
        <div className="space-y-2">
          {selectedTemplate.exercises.map((exercise, index) => {
            const enriched = enrichExercise(exercise);
            const prescription = prescribed.exercises[index] || enriched;
            const muscles = getPrimaryMuscles(prescription).join(' / ') || exercise.muscle;
            return (
              <details key={`${exercise.id}-${index}`} className="rounded-lg border border-slate-200 bg-stone-50 p-3">
                <summary className="cursor-pointer list-none">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="text-xs font-semibold text-slate-500">#{index + 1}</div>
                      <h3 className="font-semibold text-slate-950">{formatExerciseName(exercise)}</h3>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        {muscles} · {exercise.sets} 组 · {exercise.repMin}-{exercise.repMax} 次 · 休息 {exercise.rest} 秒
                      </p>
                    </div>
                    <StatusBadge tone={exercise.kind === 'compound' ? 'emerald' : exercise.kind === 'machine' ? 'sky' : 'slate'}>
                      {exercise.kind === 'compound' ? '复合动作' : exercise.kind === 'machine' ? '器械动作' : '孤立动作'}
                    </StatusBadge>
                  </div>
                </summary>
                <div className="mt-3 grid gap-3 md:grid-cols-5">
                  <PlanInput label="别名" value={exercise.alias || ''} onChange={(value) => onUpdateExercise(selectedTemplate.id, index, 'alias', value)} />
                  <PlanInput label="组数" type="number" value={exercise.sets} onChange={(value) => onUpdateExercise(selectedTemplate.id, index, 'sets', value)} />
                  <PlanInput label="次数下限" type="number" value={exercise.repMin} onChange={(value) => onUpdateExercise(selectedTemplate.id, index, 'repMin', value)} />
                  <PlanInput label="次数上限" type="number" value={exercise.repMax} onChange={(value) => onUpdateExercise(selectedTemplate.id, index, 'repMax', value)} />
                  <PlanInput label="休息秒数" type="number" value={exercise.rest} onChange={(value) => onUpdateExercise(selectedTemplate.id, index, 'rest', value)} />
                </div>
                <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3 text-xs leading-5 text-slate-600">
                  <div className="grid gap-2 md:grid-cols-3">
                    <div>递增单位：{formatWeight(prescription.progressionUnitKg || enriched.progressionUnitKg || 1, data.unitSettings)}</div>
                    <div>疲劳成本：{formatFatigueCost(prescription.fatigueCost)}</div>
                    <div>技术需求：{formatSkillDemand(prescription.skillDemand)}</div>
                    <div>幅度优先：{formatRomPriority(prescription.romPriority)}</div>
                    <div>
                      替代层级：
                      {Object.values(prescription.alternativePriorities || {}).slice(0, 3).map(formatReplacementCategory).join(' / ') || '按动作链推断'}
                    </div>
                    <div>动作链：{prescription.equivalence?.label || '默认动作链'}</div>
                  </div>
                  {prescription.techniqueStandard ? (
                    <div className="mt-2 rounded-md bg-stone-50 p-2">
                      技术标准：{prescription.techniqueStandard.rom}；节奏 {prescription.techniqueStandard.tempo}；{prescription.techniqueStandard.stopRule}
                    </div>
                  ) : null}
                </div>
              </details>
            );
          })}
        </div>
      </Card>
    </PageSection>
  );

  const renderAdjustmentSuggestion = (draft: ProgramAdjustmentDraft) => (
    <Card key={draft.id} className="space-y-3">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-slate-950">{draft.title}</h3>
            <StatusBadge tone={draft.status === 'stale' ? 'amber' : 'sky'}>{draft.status === 'stale' ? '已过期' : '草稿'}</StatusBadge>
            <StatusBadge tone="slate">置信度：{formatConfidence(draft.confidence)}</StatusBadge>
          </div>
          <p className="mt-1 text-sm leading-6 text-slate-600">{draft.summary}</p>
        </div>
      </div>
      <div className="space-y-2">
        {draft.changes.slice(0, 4).map((change) => (
          <div key={change.id} className="rounded-lg bg-stone-50 p-3">
            <div className="text-sm font-semibold text-slate-950">{formatAdjustmentChangeLabel(change.type)}</div>
            <div className="mt-1 text-xs leading-5 text-slate-600">原因：{formatChangeReason(change)}</div>
            <div className="mt-1 text-xs leading-5 text-slate-600">影响：{formatChangeImpact(change)}</div>
          </div>
        ))}
      </div>
    </Card>
  );

  const renderExperimentalTemplates = () => (
    <PageSection title="实验模板" description="实验模板不会覆盖原模板，完成过的训练记录也会保留。">
      {experimentalTemplates.length ? (
        <div className="space-y-2">
          {experimentalTemplates.map((template) => (
            <ListItem
              key={template.id}
              title={
                <span className="flex flex-wrap items-center gap-2">
                  {templateLabel(template)}
                  <TemplateStatusBadge template={template} activeTemplateId={activeTemplateId} />
                </span>
              }
              description={`来源：${formatProgramTemplateName(template.sourceTemplateName || template.sourceTemplateId || '原模板')} · ${template.adjustmentSummary || '计划调整实验'}`}
              meta={template.appliedAt ? `应用时间：${formatDateLabel(template.appliedAt)}` : undefined}
            />
          ))}
        </div>
      ) : (
        <EmptyState title="暂无实验模板" description="应用计划调整后，会生成独立实验模板；原模板和历史训练记录不会被删除。" />
      )}
    </PageSection>
  );

  const renderVersionHistory = () => (
    <PageSection title="版本历史与回滚" description="回滚只恢复当前使用的计划模板，不会删除已经完成的训练记录。">
      {adjustmentHistory.length ? (
        <div className="space-y-2">
          {adjustmentHistory.map((item) => (
            <Card key={item.id} className={classNames('space-y-3', item.rollbackAvailable && !item.rolledBackAt ? 'border-amber-200 bg-amber-50' : '')}>
              <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold text-slate-950">{item.mainChangeSummary || '计划版本调整'}</h3>
                    <StatusBadge tone={adjustmentStatusTone(item)}>{item.rolledBackAt ? '已回滚' : item.rollbackAvailable ? '可回滚' : '已应用'}</StatusBadge>
                  </div>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    {formatDateLabel(item.appliedAt)} · 来源：{formatProgramTemplateName(item.sourceProgramTemplateName || item.sourceProgramTemplateId)}
                    {' → '}
                    实验：{formatProgramTemplateName(item.experimentalProgramTemplateName || item.experimentalProgramTemplateId)}
                  </p>
                  <p className="mt-2 rounded-lg bg-white/70 px-3 py-2 text-xs leading-5 text-slate-600">
                    回滚说明：只切回原计划模板；已经完成的训练记录、历史详情、PR/e1RM 记录不会被删除。
                  </p>
                </div>
                {item.rollbackAvailable && !item.rolledBackAt && onRollbackProgramAdjustment ? (
                  <ActionButton variant="danger" onClick={() => setRollbackTarget(item)}>
                    回滚到原模板
                  </ActionButton>
                ) : null}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState title="暂无版本历史" description="应用实验模板后，这里会保留版本记录和回滚入口。" />
      )}
    </PageSection>
  );

  return (
    <ResponsivePageLayout>
      <PageHeader eyebrow="计划" title="计划管理中心" description="回答“我以后怎么练”：当前计划、周期推进、训练日模板和实验版本。" />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_420px]">
        <div className="space-y-4">
          {renderCurrentTemplate()}
          {renderCycleTimeline()}
          {renderThisWeekDays()}
          {renderTrainingTemplates()}
          {renderSelectedTemplateDetail()}
        </div>
        <aside className="space-y-4">
          <PageSection title="训练基线" description="等级只影响计划建议的保守程度，不会强制改模板。">
            <Card className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge tone={trainingLevelAssessment.level === 'unknown' ? 'slate' : 'emerald'}>
                  {formatAutoTrainingLevel(trainingLevelAssessment.level)}
                </StatusBadge>
                <StatusBadge tone="slate">置信度：{formatConfidence(trainingLevelAssessment.confidence)}</StatusBadge>
              </div>
              <p className="text-sm leading-6 text-slate-600">
                {trainingLevelAssessment.level === 'unknown'
                  ? '当前模板是起始模板，不是基于历史数据生成。完成 2–3 次训练后，系统会开始校准。'
                  : '近期记录会影响高级功能启用、训练量上限和动作复杂度建议。'}
              </p>
            </Card>
          </PageSection>

          <PageSection title="计划构成" description="主训练、纠偏和功能补丁的未来安排。">
            <div className="grid gap-3">
              <MetricCard label="主训练占比" value={`${supportPlan.ratios.mainline}%`} tone="emerald" helper={`${formatSplitType(program.splitType)} · ${program.daysPerWeek} 天`} />
              <MetricCard label="纠偏模块" value={`${supportPlan.correctionModules.length} 项`} helper={supportPlan.correctionModules.map((item) => item.name).join(' / ') || '暂无'} />
              <MetricCard label="功能补丁" value={`${supportPlan.functionalAddons.length} 项`} helper={supportPlan.functionalAddons.map((item) => item.name).join(' / ') || '最低配补丁'} />
            </div>
          </PageSection>

          <PageSection title="调整建议" description="每条建议都显示原因和对模板的影响。">
            {adjustmentDrafts.length ? (
              <div className="space-y-3">{adjustmentDrafts.map(renderAdjustmentSuggestion)}</div>
            ) : (
              <EmptyState title="暂无调整建议" description="积累更多训练记录后，系统会在这里生成计划调整草稿。" />
            )}
          </PageSection>

          {renderExperimentalTemplates()}
          {renderVersionHistory()}
        </aside>
      </div>

      {rollbackTarget ? (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/30 p-4">
          <ConfirmDialog
            title="回滚到原模板？"
            description="回滚只会把当前计划切回原模板。已经完成的训练记录、历史详情、PR/e1RM 和日历不会被删除。"
            confirmLabel="确认回滚"
            danger
            onCancel={() => setRollbackTarget(null)}
            onConfirm={confirmRollback}
          />
        </div>
      ) : null}
    </ResponsivePageLayout>
  );
}
