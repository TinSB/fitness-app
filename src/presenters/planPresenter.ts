import type { CoachAction } from '../engines/coachActionEngine';
import { getCurrentMesocycleWeek } from '../engines/mesocycleEngine';
import type { VolumeAdaptationReport } from '../engines/volumeAdaptationEngine';
import {
  formatAdjustmentChangeLabel,
  formatCyclePhase,
  formatExerciseName,
  formatMuscleName,
  formatRiskLevel,
  formatTemplateName,
  formatTrainingDayName,
  formatTrainingMode,
} from '../i18n/formatters';
import type {
  AppData,
  DayTemplate,
  ProgramAdjustmentDraft,
  TrainingTemplate,
} from '../models/training-model';
import { buildCoachActionView, type CoachActionView } from './coachActionPresenter';
import { aggregatePlanAdvice, type AggregatedPlanAdvice } from './planAdviceAggregator';

export type WeeklyScheduleDayView = {
  id: string;
  name: string;
  focus: string;
  durationMin: number;
  exerciseCount: number;
  primaryExercises: string[];
};

export type AdjustmentDraftView = {
  id: string;
  title: string;
  summary: string;
  sourceLabel: string;
  statusLabel: string;
  riskLabel: string;
  createdAtLabel: string;
  changeCount: number;
  primaryChangeSummary: string;
};

export type PlanCoachInboxDetailView = {
  id: string;
  label: string;
  reason: string;
  suggestedActions: string[];
};

export type PlanCoachInboxActionView = CoachActionView & {
  detailItems?: PlanCoachInboxDetailView[];
  mergedCount?: number;
  advice?: AggregatedPlanAdvice;
};

export type PlanViewModel = {
  currentPlan: {
    templateName: string;
    phaseLabel: string;
    trainingModeLabel: string;
    weeklyFocus: string;
    experimentStatus?: string;
  };
  weeklySchedule: {
    days: WeeklyScheduleDayView[];
  };
  coachInbox: {
    summary: string;
    visibleAdvice: PlanCoachInboxActionView[];
    hiddenAdvice: PlanCoachInboxActionView[];
    visibleActions: PlanCoachInboxActionView[];
    hiddenActions: PlanCoachInboxActionView[];
    hiddenCount: number;
    totalCount: number;
    confirmationCount: number;
  };
  adjustmentDrafts: {
    drafts: AdjustmentDraftView[];
    emptyState?: string;
  };
  sideSummary: {
    currentTemplate: string;
    pendingActionCount: number;
    draftCount: number;
    experimentStatus?: string;
    latestReminder: string;
  };
  currentTemplateName: string;
  templateStateLabel: string;
  sections: string[];
  hasExperimentalTemplate: boolean;
};

export type BuildPlanViewModelOptions = {
  coachActions?: CoachAction[];
  volumeAdaptation?: VolumeAdaptationReport | null;
  maxVisibleCoachActions?: number;
};

const visibleFallback = (value: unknown, fallback: string) => {
  const text = String(value ?? '').trim();
  if (!text || text === 'undefined' || text === 'null') return fallback;
  return text;
};

const formatDateLabel = (value?: string) => {
  if (!value) return '未记录日期';
  return value.slice(0, 10);
};

const draftStatusLabel = (status?: ProgramAdjustmentDraft['status']) => {
  if (status === 'recommendation') return '建议';
  if (status === 'draft_created') return '草案已生成';
  if (status === 'ready_to_apply' || status === 'previewed' || status === 'draft') return '待确认';
  if (status === 'applied') return '已应用';
  if (status === 'dismissed') return '已暂不采用';
  if (status === 'rolled_back') return '已回滚';
  if (status === 'expired' || status === 'stale') return '已过期';
  return '待确认';
};

const findTemplateForDay = (templates: TrainingTemplate[], day: DayTemplate) =>
  templates.find((template) => template.id === day.id) ||
  templates.find((template) => formatTemplateName(template) === formatTrainingDayName(day.name));

const buildDayView = (templates: TrainingTemplate[], day: DayTemplate, index: number): WeeklyScheduleDayView => {
  const template = findTemplateForDay(templates, day);
  const exerciseIds = day.mainExerciseIds?.length ? day.mainExerciseIds : template?.exercises.map((exercise) => exercise.id) || [];
  const exercises = exerciseIds
    .map((exerciseId) => template?.exercises.find((exercise) => exercise.id === exerciseId || exercise.baseId === exerciseId) || exerciseId)
    .slice(0, 4)
    .map((exercise) => formatExerciseName(exercise));
  const focus = day.focusMuscles?.length
    ? day.focusMuscles.map((muscle) => formatMuscleName(muscle)).join(' / ')
    : visibleFallback(template?.focus, '综合训练');

  return {
    id: day.id || template?.id || `training-day-${index + 1}`,
    name: formatTrainingDayName({ id: day.id, name: day.name }, `训练日 ${index + 1}`),
    focus,
    durationMin: day.estimatedDurationMin || template?.duration || 0,
    exerciseCount: exerciseIds.length || template?.exercises.length || 0,
    primaryExercises: exercises.length ? exercises : ['未命名动作'],
  };
};

const buildWeeklySchedule = (data: AppData): PlanViewModel['weeklySchedule'] => {
  const dayTemplates = data.programTemplate?.dayTemplates?.length
    ? data.programTemplate.dayTemplates
    : data.templates.map((template) => ({
        id: template.id,
        name: template.name,
        focusMuscles: [],
        correctionBlockIds: [],
        mainExerciseIds: template.exercises.map((exercise) => exercise.id),
        functionalBlockIds: [],
        estimatedDurationMin: template.duration,
      }));

  return {
    days: dayTemplates.map((day, index) => buildDayView(data.templates, day, index)),
  };
};

const fallbackCoachActionFromAdvice = (advice: AggregatedPlanAdvice): CoachAction => ({
  id: advice.id,
  title: advice.title,
  description: advice.summary,
  source:
    advice.category === 'volume'
      ? 'volumeAdaptation'
      : advice.category === 'plateau'
        ? 'plateau'
        : advice.category === 'data_health'
          ? 'dataHealth'
          : advice.category === 'recovery'
            ? 'recovery'
            : 'volumeAdaptation',
  actionType: advice.primaryAction?.actionType === 'create_plan_adjustment_preview' ? 'create_plan_adjustment_preview' : advice.primaryAction?.actionType === 'review_exercise' ? 'review_exercise' : 'review_volume',
  priority: advice.priority,
  status: 'pending',
  requiresConfirmation: advice.status === 'needs_confirmation',
  reversible: advice.status === 'needs_confirmation',
  createdAt: new Date(0).toISOString(),
  targetId: advice.affectedItems[0]?.id,
  targetType: advice.affectedItems[0]?.type === 'muscle' || advice.affectedItems[0]?.type === 'exercise' || advice.affectedItems[0]?.type === 'template' || advice.affectedItems[0]?.type === 'session'
    ? advice.affectedItems[0].type
    : 'plan',
  reason: advice.summary,
});

const adviceToCoachInboxView = (advice: AggregatedPlanAdvice): PlanCoachInboxActionView => {
  const action = advice.primaryAction?.coachAction || fallbackCoachActionFromAdvice(advice);
  const view = buildCoachActionView({
    ...action,
    id: advice.id,
    title: advice.title,
    description: advice.summary,
    priority: advice.priority,
    requiresConfirmation: advice.status === 'needs_confirmation',
    reversible: advice.status === 'needs_confirmation',
  }) as PlanCoachInboxActionView;

  return {
    ...view,
    primaryLabel: advice.primaryAction?.label || view.primaryLabel,
    primaryVariant: advice.primaryAction?.variant || view.primaryVariant,
    detailItems: advice.affectedItems.map((item) => ({
      id: item.id,
      label: item.label,
      reason: item.summary,
      suggestedActions: [],
    })),
    mergedCount: advice.affectedItems.length || advice.sourceActionIds.length || 1,
    advice,
  };
};

const buildCoachInbox = (
  actions: CoachAction[] = [],
  volumeAdaptation?: VolumeAdaptationReport | null,
  drafts: ProgramAdjustmentDraft[] = [],
  maxVisible = 3,
): PlanViewModel['coachInbox'] => {
  const advice = aggregatePlanAdvice(actions, volumeAdaptation, drafts).filter(
    (item) => item.category !== 'draft' && (item.status === 'suggestion' || item.status === 'needs_confirmation'),
  );
  const views = advice.map(adviceToCoachInboxView);
  const visibleActions = views.slice(0, maxVisible);
  const hiddenActions = views.slice(maxVisible);
  const hiddenCount = hiddenActions.length;
  const totalCount = advice.reduce((sum, item) => sum + Math.max(item.affectedItems.length, item.sourceActionIds.length, 1), 0);
  const confirmationCount = views.filter((view) => view.requiresConfirmation).length;
  const summary = views.length
    ? `系统发现 ${totalCount} 条计划相关建议，其中 ${confirmationCount} 条需要确认。`
    : '暂无待处理计划建议。';

  return {
    summary,
    visibleAdvice: visibleActions,
    hiddenAdvice: hiddenActions,
    visibleActions,
    hiddenActions,
    hiddenCount,
    totalCount,
    confirmationCount,
  };
};

const isRealDraft = (draft: ProgramAdjustmentDraft) => draft.status !== 'recommendation';

const buildDraftView = (draft: ProgramAdjustmentDraft): AdjustmentDraftView => {
  const firstChange = draft.changes?.[0];
  const changeSummary = firstChange
    ? `${formatAdjustmentChangeLabel(firstChange.type)}：${visibleFallback(firstChange.reason || firstChange.previewNote, '查看差异后再决定是否应用。')}`
    : '查看差异后再决定是否应用。';

  return {
    id: draft.id,
    title: visibleFallback(draft.title || draft.experimentalTemplateName, '调整草案'),
    summary: visibleFallback(draft.summary || draft.explanation, '应用前需要确认，不会自动覆盖原计划。'),
    sourceLabel: draft.sourceRecommendationId || draft.selectedRecommendationIds?.length ? '教练自动调整建议' : '手动调整草案',
    statusLabel: draftStatusLabel(draft.status),
    riskLabel: formatRiskLevel(draft.riskLevel || 'low'),
    createdAtLabel: formatDateLabel(draft.createdAt),
    changeCount: draft.changes?.length || 0,
    primaryChangeSummary: changeSummary,
  };
};

const buildAdjustmentDrafts = (data: AppData): PlanViewModel['adjustmentDrafts'] => {
  const drafts = (data.programAdjustmentDrafts || []).filter(isRealDraft).map(buildDraftView);
  return {
    drafts,
    emptyState: drafts.length ? undefined : '生成草案后，你可以在这里查看差异、应用实验模板或暂不采用。',
  };
};

const buildLatestPlanReminder = (
  coachInbox: PlanViewModel['coachInbox'],
  adjustmentDrafts: PlanViewModel['adjustmentDrafts'],
  experimentStatus?: string,
) => {
  const readyDraft = adjustmentDrafts.drafts.find((draft) => draft.statusLabel === '待确认' || draft.statusLabel === '草案已生成');
  if (readyDraft) return '有调整草案待确认，应用前请先查看差异。';
  const firstAction = coachInbox.visibleActions[0] || coachInbox.hiddenActions[0];
  if (firstAction) return firstAction.title;
  if (experimentStatus) return experimentStatus;
  return '当前计划暂无需要处理的提醒。';
};

const buildExperimentStatus = (data: AppData, current?: TrainingTemplate) => {
  if (!current) return undefined;
  const activeHistoryItem = (data.programAdjustmentHistory || []).find(
    (item) => !item.rolledBackAt && item.experimentalProgramTemplateId === current.id,
  );
  if (activeHistoryItem) {
    const sourceName = formatTemplateName(activeHistoryItem.sourceProgramTemplateName || activeHistoryItem.sourceProgramTemplateId, '原模板');
    return `当前使用实验模板，来源：${sourceName}`;
  }
  if (current.isExperimentalTemplate) return '当前使用实验模板';
  const rolledBack = (data.programAdjustmentHistory || []).some((item) => item.rolledBackAt && item.sourceProgramTemplateId === current.id);
  return rolledBack ? '已回滚到原模板' : undefined;
};

const buildWeeklyFocus = (data: AppData) => {
  const muscles = [
    ...new Set((data.programTemplate?.dayTemplates || []).flatMap((day) => day.focusMuscles || []).map((muscle) => formatMuscleName(muscle))),
  ].filter(Boolean);
  if (muscles.length) return `本周重点：${muscles.slice(0, 5).join(' / ')}`;
  return `本周目标：${formatTrainingMode(data.trainingMode)}`;
};

export const buildPlanViewModel = (data: AppData, options: BuildPlanViewModelOptions = {}): PlanViewModel => {
  const current = data.templates.find((template) => template.id === (data.activeProgramTemplateId || data.selectedTemplateId));
  const hasExperimentalTemplate = Boolean(current?.isExperimentalTemplate);
  const templateName = current ? formatTemplateName(current, '当前模板') : '当前模板';
  const mesocycleWeek = getCurrentMesocycleWeek(data.mesocyclePlan);
  const phaseLabel = `第 ${mesocycleWeek.weekIndex + 1} 周 · ${formatCyclePhase(mesocycleWeek.phase)}`;
  const experimentStatus = buildExperimentStatus(data, current);
  const coachInbox = buildCoachInbox(options.coachActions, options.volumeAdaptation, data.programAdjustmentDrafts || [], options.maxVisibleCoachActions ?? 2);
  const adjustmentDrafts = buildAdjustmentDrafts(data);

  return {
    currentPlan: {
      templateName,
      phaseLabel,
      trainingModeLabel: formatTrainingMode(data.trainingMode),
      weeklyFocus: buildWeeklyFocus(data),
      experimentStatus,
    },
    weeklySchedule: buildWeeklySchedule(data),
    coachInbox,
    adjustmentDrafts,
    sideSummary: {
      currentTemplate: templateName,
      pendingActionCount: coachInbox.visibleActions.length + coachInbox.hiddenCount,
      draftCount: adjustmentDrafts.drafts.length,
      experimentStatus,
      latestReminder: buildLatestPlanReminder(coachInbox, adjustmentDrafts, experimentStatus),
    },
    currentTemplateName: templateName,
    templateStateLabel: hasExperimentalTemplate ? '实验模板' : '原始模板',
    sections: ['当前计划', '本周安排', '待处理建议', '调整草案', '计划调整'],
    hasExperimentalTemplate,
  };
};
