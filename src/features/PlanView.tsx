import React from 'react';
import { Play, RotateCcw } from 'lucide-react';
import { DEFAULT_PROGRAM_TEMPLATE } from '../data/trainingData';
import { classNames, enrichExercise, findTemplate, getPrimaryMuscles, todayKey } from '../engines/engineUtils';
import { applyStatusRules } from '../engines/progressionEngine';
import { buildEnginePipeline } from '../engines/enginePipeline';
import { buildAdjustmentDiff } from '../engines/programAdjustmentEngine';
import { buildRecommendationTrace } from '../engines/recommendationTraceEngine';
import { buildSupportPlan } from '../engines/supportPlanEngine';
import type { CoachAction } from '../engines/coachActionEngine';
import { getCurrentMesocycleWeek } from '../engines/mesocycleEngine';
import { formatAutoTrainingLevel } from '../engines/trainingLevelEngine';
import type { TrainingIntelligenceSummary } from '../engines/trainingIntelligenceSummaryEngine';
import { buildPlanViewModel, type AdjustmentDraftView, type PlanCoachInboxActionView } from '../presenters/planPresenter';
import {
  formatAdjustmentChangeLabel,
  formatConfidence,
  formatCyclePhase,
  formatExerciseName,
  formatIntensityBias,
  formatMuscleName,
  formatPrimaryGoal,
  formatSplitType,
  formatTemplateName,
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
import { Drawer } from '../ui/Drawer';
import { EmptyState } from '../ui/EmptyState';
import { ListItem } from '../ui/ListItem';
import { MetricCard } from '../ui/MetricCard';
import { PageHeader } from '../ui/PageHeader';
import { PageSection } from '../ui/PageSection';
import { StatusBadge } from '../ui/StatusBadge';
import { RecommendationExplanationPanel } from '../ui/RecommendationExplanationPanel';
import { ResponsivePageLayout } from '../ui/layouts/ResponsivePageLayout';

export type PlanTarget = {
  section: 'volume_adaptation' | 'adjustment_drafts' | 'coach_actions';
  muscleId?: string;
  actionId?: string;
  draftId?: string;
  highlight?: boolean;
  version?: number;
};

interface PlanViewProps {
  data: AppData;
  weeklyPrescription: WeeklyPrescription;
  trainingIntelligenceSummary?: TrainingIntelligenceSummary;
  coachActions?: CoachAction[];
  target?: PlanTarget | null;
  selectedTemplateId: string;
  onSelectTemplate: (id: string) => void;
  onStartTemplate: (id: string) => void;
  onUpdateExercise: (templateId: string, exerciseIndex: number, field: string, value: string) => void;
  onResetTemplates: () => void;
  onApplyProgramAdjustmentDraft?: (draft: ProgramAdjustmentDraft) => void;
  onDismissProgramAdjustmentDraft?: (draftId: string) => void;
  onDeleteProgramAdjustmentDraft?: (draftId: string) => void;
  onRegenerateProgramAdjustmentDraft?: (draft: ProgramAdjustmentDraft) => void;
  onCoachAction?: (action: CoachAction) => void;
  onDismissCoachAction?: (action: CoachAction) => void;
  onRollbackProgramAdjustment?: (historyItemId: string) => void;
}

const templateLabel = (template: Pick<TrainingTemplate, 'id' | 'name'> | string, fallback = '') => {
  if (typeof template === 'string') return formatTemplateName(template, fallback || '未命名');
  return formatTemplateName(template, fallback || '未命名');
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
    return `新增 ${formatExerciseName(change.exerciseName || change.exerciseId)}，${change.sets || 1} 组${change.repMin && change.repMax ? `，${change.repMin}-${change.repMax} 次` : ''}。`;
  }
  if (change.type === 'swap_exercise') return `替换为 ${formatExerciseName(change.replacementExerciseName || change.replacementExerciseId)}。`;
  if (change.type === 'reduce_support') return '降低纠偏或功能补丁剂量，缩短训练负担。';
  if (change.type === 'increase_support') return '增加关键纠偏或功能补丁，优先处理短板。';
  return '保留当前计划结构。';
};

const formatChangeReason = (change: AdjustmentChange) => change.reason || change.previewNote || '根据近期训练记录生成。';

const statusView = (status?: ProgramAdjustmentDraft['status']) => {
  if (status === 'recommendation') return { label: '建议', tone: 'sky' as const };
  if (status === 'draft_created') return { label: '草案已生成', tone: 'sky' as const };
  if (status === 'ready_to_apply' || status === 'previewed' || status === 'draft') return { label: '待确认', tone: 'amber' as const };
  if (status === 'applied') return { label: '已应用', tone: 'emerald' as const };
  if (status === 'dismissed') return { label: '已暂不采用', tone: 'slate' as const };
  if (status === 'rolled_back') return { label: '已回滚', tone: 'slate' as const };
  if (status === 'expired' || status === 'stale') return { label: '已过期', tone: 'amber' as const };
  return { label: '待确认', tone: 'amber' as const };
};

const riskView = (risk?: 'low' | 'medium' | 'high') => {
  if (risk === 'high') return { label: '风险：高', tone: 'rose' as const, explanation: '变化较大或需要人工确认，建议先查看差异。' };
  if (risk === 'medium') return { label: '风险：中等', tone: 'amber' as const, explanation: '变化不大，但建议观察一周反馈。' };
  return { label: '风险：低', tone: 'emerald' as const, explanation: '调整幅度较小，应用后仍建议观察一周。' };
};

const strongestRisk = (levels: Array<'low' | 'medium' | 'high'>): 'low' | 'medium' | 'high' => {
  if (levels.includes('high')) return 'high';
  if (levels.includes('medium')) return 'medium';
  return 'low';
};

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
  trainingIntelligenceSummary,
  coachActions,
  target,
  selectedTemplateId,
  onSelectTemplate,
  onStartTemplate,
  onUpdateExercise,
  onResetTemplates,
  onApplyProgramAdjustmentDraft,
  onDismissProgramAdjustmentDraft,
  onDeleteProgramAdjustmentDraft,
  onRegenerateProgramAdjustmentDraft,
  onCoachAction,
  onDismissCoachAction,
  onRollbackProgramAdjustment,
}: PlanViewProps) {
  const [rollbackTarget, setRollbackTarget] = React.useState<ProgramAdjustmentHistoryItem | null>(null);
  const [applyTarget, setApplyTarget] = React.useState<ProgramAdjustmentDraft | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<ProgramAdjustmentDraft | null>(null);
  const [diffTarget, setDiffTarget] = React.useState<ProgramAdjustmentDraft | null>(null);
  const [scheduleDetailTemplate, setScheduleDetailTemplate] = React.useState<TrainingTemplate | null>(null);
  const adjustmentSectionRef = React.useRef<HTMLDivElement | null>(null);
  const draftSectionRef = React.useRef<HTMLDivElement | null>(null);
  const historySectionRef = React.useRef<HTMLDivElement | null>(null);
  const [highlightTarget, setHighlightTarget] = React.useState<PlanTarget | null>(() => (target?.highlight === false ? null : target || null));
  const fallbackTemplateId = data.templates.some((item) => item.id === selectedTemplateId) ? selectedTemplateId : data.templates[0]?.id || selectedTemplateId;
  const selectedTemplate = findTemplate(data.templates, fallbackTemplateId) as TrainingTemplate;
  const program = data.programTemplate || DEFAULT_PROGRAM_TEMPLATE;
  const mesocycle = data.mesocyclePlan;
  const mesocycleWeek = getCurrentMesocycleWeek(mesocycle);
  const activeTemplateId = data.activeProgramTemplateId || data.selectedTemplateId;
  const currentTemplate = data.templates.find((item) => item.id === activeTemplateId) || selectedTemplate;
  const supportPlan = buildSupportPlan(data, selectedTemplate);
  const recommendationTrace = React.useMemo(
    () =>
      buildRecommendationTrace({
        ...data,
        template: selectedTemplate,
        sessionTemplateId: selectedTemplate.id,
        trainingMode: data.trainingMode,
        weeklyPrescription,
      }),
    [data, selectedTemplate, weeklyPrescription]
  );
  const enginePipeline = React.useMemo(
    () => buildEnginePipeline(data, todayKey(), { coachActions }),
    [data, coachActions],
  );
  const trainingLevelAssessment = enginePipeline.context.trainingLevelAssessment;
  const adjustmentHistory = data.programAdjustmentHistory || [];
  const activeHistoryItem = adjustmentHistory.find((item) => !item.rolledBackAt && item.experimentalProgramTemplateId === currentTemplate.id);
  const experimentalTemplates = data.templates.filter((template) => template.isExperimentalTemplate || template.sourceTemplateId);
  const activeTemplateMissing = Boolean(data.activeProgramTemplateId && !data.templates.some((item) => item.id === data.activeProgramTemplateId));
  const planViewModel = React.useMemo(
    () => buildPlanViewModel(data, { coachActions: enginePipeline.visibleCoachActions, volumeAdaptation: trainingIntelligenceSummary?.volumeAdaptation }),
    [data, enginePipeline.visibleCoachActions, trainingIntelligenceSummary?.volumeAdaptation],
  );
  const adjustmentDraftViews = planViewModel.adjustmentDrafts.drafts;
  const adjustmentDrafts = adjustmentDraftViews
    .map((view) => (data.programAdjustmentDrafts || []).find((draft) => draft.id === view.id))
    .filter((draft): draft is ProgramAdjustmentDraft => Boolean(draft));

  const currentTemplateStatus = activeHistoryItem
    ? '实验模板'
    : adjustmentHistory.some((item) => item.rolledBackAt && item.sourceProgramTemplateId === currentTemplate.id)
      ? '已回滚模板'
      : '原始模板';

  React.useEffect(() => {
    if (!target) return undefined;
    const nextTarget = { ...target };
    setHighlightTarget(nextTarget.highlight === false ? null : nextTarget);

    const node =
      nextTarget.section === 'volume_adaptation' || nextTarget.section === 'coach_actions'
        ? adjustmentSectionRef.current
        : draftSectionRef.current || adjustmentSectionRef.current;
    if (typeof window !== 'undefined') {
      window.setTimeout(() => node?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
    }
    const timer = typeof window !== 'undefined' ? window.setTimeout(() => setHighlightTarget(null), 3000) : undefined;
    return () => {
      if (timer) window.clearTimeout(timer);
    };
  }, [target?.section, target?.muscleId, target?.draftId, target?.actionId, target?.version, target?.highlight]);

  const confirmRollback = () => {
    if (!rollbackTarget || !onRollbackProgramAdjustment) return;
    onRollbackProgramAdjustment(rollbackTarget.id);
    setRollbackTarget(null);
  };

  const confirmApplyDraft = () => {
    if (!applyTarget || !onApplyProgramAdjustmentDraft) return;
    onApplyProgramAdjustmentDraft(applyTarget);
    setApplyTarget(null);
  };

  const confirmDeleteDraft = () => {
    if (!deleteTarget || !onDeleteProgramAdjustmentDraft) return;
    onDeleteProgramAdjustmentDraft(deleteTarget.id);
    setDeleteTarget(null);
  };

  const scrollToPlanSection = (ref: React.RefObject<HTMLDivElement | null>) => {
    if (typeof window === 'undefined') return;
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const sourceTemplateForDraft = (draft: ProgramAdjustmentDraft) =>
    data.templates.find((template) => template.id === draft.sourceProgramTemplateId) || selectedTemplate;

  const diffForDraft = (draft: ProgramAdjustmentDraft) => {
    const sourceTemplate = sourceTemplateForDraft(draft);
    return draft.diffPreview || buildAdjustmentDiff(draft, sourceTemplate, data.programTemplate || DEFAULT_PROGRAM_TEMPLATE, data.templates);
  };

  const renderCurrentTemplate = () => (
    <PageSection data-plan-primary-section="current-plan" title="当前计划" description="这里显示现在计划正在使用的模板，不混入历史训练详情。">
      <Card className={classNames('space-y-3', activeHistoryItem ? 'border-amber-200 bg-amber-50' : '')}>
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-1.5">
              <StatusBadge tone={activeHistoryItem ? 'amber' : currentTemplateStatus === '已回滚模板' ? 'sky' : 'emerald'}>{currentTemplateStatus}</StatusBadge>
              {activeTemplateMissing ? <StatusBadge tone="amber">已回退到可用模板</StatusBadge> : null}
            </div>
            <h2 className="text-lg font-bold text-slate-950 md:text-xl">{templateLabel(currentTemplate)}</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              {currentTemplate.focus || '计划训练'} · {currentTemplate.duration || program.dayTemplates?.[0]?.estimatedDurationMin || 60} 分钟 · {currentTemplate.exercises?.length || 0} 个动作
            </p>
            {activeHistoryItem ? (
              <p className="mt-2 rounded-lg bg-white/70 px-3 py-2 text-sm leading-6 text-amber-950">
                当前计划：实验模板
                <br />
                来源模板：{formatTemplateName(activeHistoryItem.sourceProgramTemplateName || activeHistoryItem.sourceProgramTemplateId)}
                <br />
                应用时间：{formatDateLabel(activeHistoryItem.appliedAt)}
                <br />
                主要调整：{activeHistoryItem.mainChangeSummary || activeHistoryItem.changes?.[0]?.reason || '实验模板调整'}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2 md:justify-end">
            {activeHistoryItem?.rollbackAvailable && onRollbackProgramAdjustment ? (
              <ActionButton size="sm" variant="danger" onClick={() => setRollbackTarget(activeHistoryItem)}>
                回滚到原模板
              </ActionButton>
            ) : null}
            <ActionButton size="sm" variant="secondary" onClick={onResetTemplates}>
              <RotateCcw className="h-4 w-4" />
              恢复默认
            </ActionButton>
            <ActionButton size="sm" variant="secondary" onClick={() => onStartTemplate(currentTemplate.id)}>
              <Play className="h-4 w-4" />
              以此开练
            </ActionButton>
          </div>
        </div>
        <div className="grid gap-2 md:grid-cols-3">
          <MetricCard label="计划目标" value={formatPrimaryGoal(program.primaryGoal)} tone="emerald" />
          <MetricCard label="分化方式" value={formatSplitType(program.splitType)} />
          <MetricCard label="每周频率" value={`${program.daysPerWeek} 天`} />
        </div>
      </Card>
    </PageSection>
  );

  const renderCycleTimeline = () => (
    <PageSection title="周期时间线" description="当前周期只说明未来几周怎么推进，不展示训练历史。">
      <Card className="space-y-3">
        <div className="grid gap-2 md:grid-cols-3">
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

  const openScheduleDetail = (template?: TrainingTemplate) => {
    if (!template) return;
    onSelectTemplate(template.id);
    setScheduleDetailTemplate(template);
  };

  const renderWeeklySchedule = () => (
    <PageSection data-plan-primary-section="weekly-schedule" title="本周安排" description="把本周安排和模板摘要合并在这里；先看摘要，需要时再打开详情。">
      <div className="grid gap-2 md:grid-cols-2 md:gap-3">
        {planViewModel.weeklySchedule.days.map((day, index) => {
          const template = data.templates.find((item) => item.id === day.id);
          const selected = template?.id === selectedTemplate.id;
          return (
            <Card
              key={day.id}
              className={classNames(
                'space-y-3 transition',
                selected ? 'border-emerald-300 bg-emerald-50' : '',
                template?.isExperimentalTemplate && !selected ? 'border-amber-200 bg-amber-50' : '',
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold text-emerald-700">训练日 {index + 1}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold text-slate-950">{day.name}</h3>
                    {template ? <TemplateStatusBadge template={template} activeTemplateId={activeTemplateId} /> : null}
                  </div>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    {day.focus} · 预计 {day.durationMin} 分钟 · {day.exerciseCount} 个动作
                  </p>
                </div>
                <StatusBadge tone={selected ? 'emerald' : 'sky'}>{selected ? '正在查看' : '本周安排'}</StatusBadge>
              </div>
              <div className="flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
                {day.primaryExercises.slice(0, 4).map((exerciseName) => (
                  <span key={`${day.id}-${exerciseName}`} className="rounded-md bg-white px-2 py-1">
                    {exerciseName}
                  </span>
                ))}
              </div>
              <div className="flex justify-end">
                <ActionButton size="sm" variant="secondary" onClick={() => openScheduleDetail(template)}>
                  查看详情
                </ActionButton>
              </div>
            </Card>
          );
        })}
      </div>
    </PageSection>
  );

  const renderScheduleDetailDrawer = () => {
    const detailTemplate = scheduleDetailTemplate;
    if (!detailTemplate) return null;
    const detailPrescribed = applyStatusRules(detailTemplate, data.todayStatus, data.trainingMode, weeklyPrescription, data.history, data.screeningProfile, mesocycle);
    return (
      <Drawer open={Boolean(detailTemplate)} title="训练日详情" onClose={() => setScheduleDetailTemplate(null)}>
        <Card className="space-y-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-950">{templateLabel(detailTemplate)}</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">{detailTemplate.note || detailTemplate.focus}</p>
          </div>
          <ActionButton variant="secondary" onClick={() => onStartTemplate(detailTemplate.id)}>
            以此模板训练
          </ActionButton>
        </div>
        <RecommendationExplanationPanel
          trace={recommendationTrace}
          title="为什么这样建议？"
          maxVisibleFactors={4}
        />
        <div className="space-y-2">
          {detailTemplate.exercises.map((exercise, index) => {
            const enriched = enrichExercise(exercise);
            const prescription = detailPrescribed.exercises[index] || enriched;
            const muscles = (getPrimaryMuscles(prescription).length ? getPrimaryMuscles(prescription) : [exercise.muscle]).map(formatMuscleName).join(' / ');
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
                  </div>
                </summary>
                <div className="mt-3 grid gap-3 md:grid-cols-5">
                  <PlanInput label="别名" value={exercise.alias || ''} onChange={(value) => onUpdateExercise(detailTemplate.id, index, 'alias', value)} />
                  <PlanInput label="组数" type="number" value={exercise.sets} onChange={(value) => onUpdateExercise(detailTemplate.id, index, 'sets', value)} />
                  <PlanInput label="次数下限" type="number" value={exercise.repMin} onChange={(value) => onUpdateExercise(detailTemplate.id, index, 'repMin', value)} />
                  <PlanInput label="次数上限" type="number" value={exercise.repMax} onChange={(value) => onUpdateExercise(detailTemplate.id, index, 'repMax', value)} />
                  <PlanInput label="休息秒数" type="number" value={exercise.rest} onChange={(value) => onUpdateExercise(detailTemplate.id, index, 'rest', value)} />
                </div>
              </details>
            );
          })}
        </div>
      </Card>
      </Drawer>
    );
  };

  const renderAdjustmentDraft = (draft: ProgramAdjustmentDraft) => {
    const draftView: AdjustmentDraftView | undefined = adjustmentDraftViews.find((view) => view.id === draft.id);
    const highlighted = highlightTarget?.section === 'adjustment_drafts' && highlightTarget.draftId === draft.id;
    const diff = diffForDraft(draft);
    const risk = riskView(draft.riskLevel || strongestRisk(diff.changes.map((change) => change.riskLevel)));
    const appliedHistory = adjustmentHistory.find((item) => item.experimentalProgramTemplateId === draft.experimentalProgramTemplateId);
    const canApply = Boolean(onApplyProgramAdjustmentDraft && (draft.status === 'ready_to_apply' || draft.status === 'previewed' || draft.status === 'draft_created' || draft.status === 'draft'));
    const isApplied = draft.status === 'applied';
    const isRolledBack = draft.status === 'rolled_back' || Boolean(appliedHistory?.rolledBackAt);
    const status = statusView(isRolledBack ? 'rolled_back' : draft.status);
    const statusLabel = isRolledBack ? '已回滚' : draftView?.statusLabel || status.label;
    const title = draftView?.title || draft.title || draft.experimentalTemplateName || '调整草案';
    const summary = draftView?.summary || draft.explanation || draft.summary || '应用前需要确认，不会自动覆盖原计划。';
    const sourceLabel = draftView?.sourceLabel || (draft.sourceRecommendationId || draft.selectedRecommendationIds?.length ? '教练自动调整建议' : '手动调整草案');
    const primaryChangeSummary = draftView?.primaryChangeSummary || '查看差异后再决定是否应用。';
    return (
      <Card key={draft.id} className={classNames('space-y-3 transition', highlighted ? 'border-emerald-300 bg-emerald-50 ring-2 ring-emerald-200' : '')}>
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold text-slate-950">{title}</h3>
              <StatusBadge tone={status.tone}>状态：{statusLabel}</StatusBadge>
              <StatusBadge tone={risk.tone}>{risk.label}</StatusBadge>
              <StatusBadge tone="slate">置信度：{formatConfidence(draft.confidence)}</StatusBadge>
            </div>
            <p className="mt-1 text-sm leading-6 text-slate-600">{summary}</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              来源建议：{sourceLabel} · 创建时间：{formatDateLabel(draft.createdAt)}
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-500">{risk.explanation}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ActionButton size="sm" variant="secondary" onClick={() => setDiffTarget(draft)}>
              查看差异
            </ActionButton>
            {canApply ? (
              <ActionButton size="sm" variant="primary" onClick={() => setApplyTarget(draft)}>
                应用为实验模板
              </ActionButton>
            ) : null}
            {isApplied && draft.experimentalProgramTemplateId ? (
              <ActionButton size="sm" variant="secondary" onClick={() => onSelectTemplate(draft.experimentalProgramTemplateId!)}>
                查看实验模板
              </ActionButton>
            ) : null}
            {isApplied && appliedHistory?.rollbackAvailable && !appliedHistory.rolledBackAt && onRollbackProgramAdjustment ? (
              <ActionButton size="sm" variant="danger" onClick={() => setRollbackTarget(appliedHistory)}>
                回滚到原模板
              </ActionButton>
            ) : null}
            {isRolledBack && onRegenerateProgramAdjustmentDraft ? (
              <ActionButton size="sm" variant="primary" onClick={() => onRegenerateProgramAdjustmentDraft(draft)}>
                重新生成草案
              </ActionButton>
            ) : null}
            {isRolledBack ? (
              <ActionButton size="sm" variant="secondary" onClick={() => scrollToPlanSection(historySectionRef)}>
                查看历史
              </ActionButton>
            ) : null}
            {!isApplied && !isRolledBack && draft.status !== 'dismissed' && onDismissProgramAdjustmentDraft ? (
              <ActionButton size="sm" variant="secondary" onClick={() => onDismissProgramAdjustmentDraft(draft.id)}>
                暂不采用
              </ActionButton>
            ) : null}
            {!isApplied && !isRolledBack && onDeleteProgramAdjustmentDraft ? (
              <ActionButton size="sm" variant="ghost" onClick={() => setDeleteTarget(draft)}>
                删除草案
              </ActionButton>
            ) : null}
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-stone-50 p-3">
          <div className="text-xs font-semibold text-slate-500">主要变化</div>
          <div className="mt-1 text-sm font-semibold text-slate-950">{primaryChangeSummary}</div>
        </div>
        <div className="space-y-2">
          <div className="text-xs font-semibold text-slate-500">变化明细</div>
          {draft.changes.length ? (
            draft.changes.slice(0, 4).map((change) => (
              <div key={change.id} className="rounded-lg bg-stone-50 p-3">
                <div className="text-sm font-semibold text-slate-950">{formatAdjustmentChangeLabel(change.type)}</div>
                <div className="mt-1 text-xs leading-5 text-slate-600">原因：{formatChangeReason(change)}</div>
                <div className="mt-1 text-xs leading-5 text-slate-600">影响：{formatChangeImpact(change)}</div>
              </div>
            ))
          ) : (
            <div className="rounded-lg bg-stone-50 p-3 text-sm text-slate-600">查看差异后再决定是否应用。</div>
          )}
        </div>
      </Card>
    );
  };

  const renderCoachInboxAction = (action: PlanCoachInboxActionView) => {
    const highlighted =
      highlightTarget?.actionId === action.action.id ||
      (highlightTarget?.section === 'volume_adaptation' && Boolean(action.detailItems?.some((item) => item.id === highlightTarget.muscleId)));
    return (
      <Card key={action.id} className={classNames('space-y-3 transition', highlighted ? 'border-emerald-300 bg-emerald-50 ring-2 ring-emerald-200' : '')}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold text-slate-950">{action.title}</h3>
              <StatusBadge tone={action.priorityTone}>{action.priorityLabel}</StatusBadge>
              {action.requiresConfirmation ? <StatusBadge tone="amber">需要确认</StatusBadge> : <StatusBadge tone="emerald">只查看</StatusBadge>}
            </div>
            <p className="mt-1 text-sm leading-6 text-slate-600">{action.description}</p>
          </div>
          <StatusBadge tone="slate">{action.sourceLabel}</StatusBadge>
        </div>
        {action.detailItems?.length ? (
          <details className="rounded-lg border border-slate-200 bg-stone-50 px-3 py-2 text-sm" open={highlighted}>
            <summary className="cursor-pointer font-semibold text-slate-700">查看肌群详情</summary>
            <div className="mt-2 space-y-2 text-xs leading-5 text-slate-600">
              {action.detailItems.map((item) => (
                <div key={item.id} className="rounded-md bg-white px-3 py-2">
                  <div className="font-semibold text-slate-800">{item.label}</div>
                  <div className="mt-1">{item.reason}</div>
                  {item.suggestedActions.length ? (
                    <div className="mt-1 text-slate-500">{item.suggestedActions.join(' / ')}</div>
                  ) : null}
                </div>
              ))}
            </div>
          </details>
        ) : null}
        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <ActionButton
            type="button"
            size="sm"
            variant={action.primaryVariant}
            fullWidth
            disabled={!onCoachAction}
            onClick={() => onCoachAction?.(action.action)}
          >
            {action.primaryLabel}
          </ActionButton>
          <ActionButton
            type="button"
            size="sm"
            variant="secondary"
            disabled={!onDismissCoachAction}
            onClick={() => onDismissCoachAction?.(action.action)}
          >
            暂不处理
          </ActionButton>
        </div>
      </Card>
    );
  };

  const renderCoachInbox = () => {
    const inbox = planViewModel.coachInbox;
    return (
      <PageSection data-plan-primary-section="coach-inbox" title="待处理建议" description="同类建议已合并显示，处理前不会修改当前计划。">
        {inbox.visibleItems.length ? (
          <div className="space-y-3">
            <p className="rounded-lg border border-slate-200 bg-stone-50 px-3 py-2 text-sm leading-6 text-slate-600">{inbox.summary}</p>
            <div className="space-y-2">{inbox.visibleItems.map(renderCoachInboxAction)}</div>
            {inbox.hiddenItems.length ? (
              <details className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
                <summary className="cursor-pointer font-semibold text-slate-700">查看全部建议（还有 {inbox.hiddenCount} 条）</summary>
                <div className="mt-3 space-y-2">{inbox.hiddenItems.map(renderCoachInboxAction)}</div>
              </details>
            ) : null}
          </div>
        ) : (
          <EmptyState title="暂无待处理建议" description="积累更多训练记录后，系统会在这里提示可生成草案的建议。" />
        )}
      </PageSection>
    );
  };

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
              description={`来源：${formatTemplateName(template.sourceTemplateName || template.sourceTemplateId || '原模板')} · ${template.adjustmentSummary || '计划调整实验'}`}
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
                    {formatDateLabel(item.appliedAt)} · 来源：{formatTemplateName(item.sourceProgramTemplateName || item.sourceProgramTemplateId)}
                    {' → '}
                    实验：{formatTemplateName(item.experimentalProgramTemplateName || item.experimentalProgramTemplateId)}
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

  const renderPlanSideSummary = () => {
    const sideSummary = planViewModel.sideSummary;
    const planStatusTone = currentTemplateStatus === '实验模板' ? 'amber' : currentTemplateStatus === '已回滚模板' ? 'slate' : 'emerald';
    return (
      <PageSection title="计划摘要" description="桌面侧栏只保留状态和跳转入口，完整建议在主内容区查看。">
        <Card className="space-y-3">
          <div className="space-y-2">
            <div className="text-xs font-semibold text-slate-500">当前计划状态</div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-base font-semibold text-slate-950">{sideSummary.currentTemplate}</span>
              <StatusBadge tone={planStatusTone}>{currentTemplateStatus}</StatusBadge>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-slate-200 bg-stone-50 p-3">
              <div className="text-xs font-semibold text-slate-500">待处理建议</div>
              <div className="mt-1 text-xl font-bold text-slate-950">{sideSummary.pendingActionCount} 条</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-stone-50 p-3">
              <div className="text-xs font-semibold text-slate-500">调整草案</div>
              <div className="mt-1 text-xl font-bold text-slate-950">{sideSummary.draftCount} 份</div>
            </div>
          </div>

          {sideSummary.experimentStatus ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900">
              <div className="font-semibold">当前实验模板状态</div>
              <div className="mt-1">{sideSummary.experimentStatus}</div>
            </div>
          ) : null}

          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="text-xs font-semibold text-slate-500">最近计划提醒</div>
            <p className="mt-1 text-sm leading-6 text-slate-700">{sideSummary.latestReminder}</p>
          </div>

          <div className="grid gap-2">
            <ActionButton size="sm" variant="secondary" onClick={() => scrollToPlanSection(adjustmentSectionRef)}>
              查看建议
            </ActionButton>
            <ActionButton size="sm" variant="secondary" onClick={() => scrollToPlanSection(draftSectionRef)}>
              查看草案
            </ActionButton>
          </div>
        </Card>
      </PageSection>
    );
  };

  const activeDiff = diffTarget ? diffForDraft(diffTarget) : null;

  return (
    <ResponsivePageLayout>
      <PageHeader eyebrow="计划" title="计划管理中心" description="回答“我以后怎么练”：当前计划、周期推进、本周安排和实验版本。" />
      <div className="grid gap-3 md:gap-4 xl:grid-cols-[minmax(0,1.55fr)_380px]">
        <div className="space-y-3 md:space-y-4">
          {renderCurrentTemplate()}
          {renderCycleTimeline()}
          {renderWeeklySchedule()}

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
                    ? '当前计划使用起始模板，不是基于历史数据生成。完成 2–3 次训练后，系统会开始校准。'
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

          <div ref={adjustmentSectionRef} className="scroll-mt-24">
            {renderCoachInbox()}
          </div>

          <div ref={draftSectionRef} className="scroll-mt-24">
            <PageSection data-plan-primary-section="adjustment-drafts" title="调整草案" description="草案是可应用前的预览。应用后会生成实验模板，原模板保留，可回滚。">
              {adjustmentDrafts.length ? (
                <div className="space-y-3">{adjustmentDrafts.map(renderAdjustmentDraft)}</div>
              ) : (
                <EmptyState title="暂无调整草案" description={planViewModel.adjustmentDrafts.emptyState || '生成草案后，你可以在这里查看差异、应用实验模板或暂不采用。'} />
              )}
            </PageSection>
          </div>

          {renderExperimentalTemplates()}
          <div ref={historySectionRef} className="scroll-mt-24">
            {renderVersionHistory()}
          </div>
        </div>
        <aside className="hidden space-y-3 xl:block xl:sticky xl:top-4 xl:self-start" aria-label="计划侧栏摘要">
          {renderPlanSideSummary()}
        </aside>
      </div>

      {renderScheduleDetailDrawer()}

      <Drawer open={Boolean(diffTarget && activeDiff)} title="查看调整差异" onClose={() => setDiffTarget(null)}>
        {diffTarget && activeDiff ? (
          <div className="space-y-4">
            <div>
              <h3 className="text-base font-semibold text-slate-950">{activeDiff.title}</h3>
              <p className="mt-1 text-sm leading-6 text-slate-600">{activeDiff.summary}</p>
            </div>
            {activeDiff.changes.map((change) => {
              const risk = riskView(change.riskLevel);
              return (
                <Card key={change.changeId} className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge tone="sky">{change.label}</StatusBadge>
                    <StatusBadge tone={risk.tone}>{risk.label}</StatusBadge>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-lg bg-stone-50 p-3">
                      <div className="text-xs font-semibold text-slate-500">原计划</div>
                      <div className="mt-1 text-sm font-semibold text-slate-950">{change.before}</div>
                    </div>
                    <div className="rounded-lg bg-emerald-50 p-3">
                      <div className="text-xs font-semibold text-emerald-700">调整后</div>
                      <div className="mt-1 text-sm font-semibold text-emerald-950">{change.after}</div>
                    </div>
                  </div>
                  <p className="text-sm leading-6 text-slate-600">原因：{change.reason || diffTarget.explanation || '根据近期训练记录生成。'}</p>
                  <p className="text-xs leading-5 text-slate-500">{risk.explanation}</p>
                </Card>
              );
            })}
          </div>
        ) : null}
      </Drawer>

      {applyTarget ? (
        <div className="fixed inset-0 z-[60] grid place-items-center overflow-y-auto bg-slate-950/30 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-[calc(1rem+env(safe-area-inset-top))]">
          <ConfirmDialog
            title="应用实验模板？"
            description="这会基于当前计划生成实验模板，不会删除原计划。之后可回滚。"
            confirmText="应用实验模板"
            cancelText="取消"
            variant="default"
            onCancel={() => setApplyTarget(null)}
            onConfirm={confirmApplyDraft}
          />
        </div>
      ) : null}

      {deleteTarget ? (
        <div className="fixed inset-0 z-[60] grid place-items-center overflow-y-auto bg-slate-950/30 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-[calc(1rem+env(safe-area-inset-top))]">
          <ConfirmDialog
            title="删除这份调整草案？"
            description="删除后这份草案不会再显示；不会影响原计划、实验模板或历史训练。"
            confirmText="删除草案"
            cancelText="取消"
            variant="danger"
            onCancel={() => setDeleteTarget(null)}
            onConfirm={confirmDeleteDraft}
          />
        </div>
      ) : null}

      {rollbackTarget ? (
        <div className="fixed inset-0 z-[60] grid place-items-center overflow-y-auto bg-slate-950/30 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-[calc(1rem+env(safe-area-inset-top))]">
          <ConfirmDialog
            title="回滚到原模板？"
            description="当前实验模板不会删除，但之后训练会切回原模板。"
            confirmText="回滚"
            cancelText="取消"
            variant="warning"
            onCancel={() => setRollbackTarget(null)}
            onConfirm={confirmRollback}
          />
        </div>
      ) : null}
    </ResponsivePageLayout>
  );
}
