import type { AppData, TrainingTemplate, WeeklyActionRecommendation } from '../models/training-model';
import { formatExerciseName, formatMuscleName } from '../i18n/formatters';
import { enrichExercise, getPrimaryMuscles } from './engineUtils';
import { sortDataHealthIssues, type DataHealthIssue, type DataHealthReport } from './dataHealthEngine';
import type { DailyTrainingAdjustment } from './dailyTrainingAdjustmentEngine';
import type { NextWorkoutRecommendation } from './nextWorkoutScheduler';
import type { PlateauDetectionResult } from './plateauDetectionEngine';
import type { RecommendationConfidenceResult } from './recommendationConfidenceEngine';
import type { RecoveryAwareRecommendation } from './recoveryAwareScheduler';
import type { SessionQualityResult } from './sessionQualityEngine';
import type { SetAnomaly } from './setAnomalyEngine';
import type { VolumeAdaptationReport, MuscleVolumeAdaptation } from './volumeAdaptationEngine';

export type CoachActionSource =
  | 'dailyAdjustment'
  | 'nextWorkout'
  | 'dataHealth'
  | 'plateau'
  | 'volumeAdaptation'
  | 'sessionQuality'
  | 'setAnomaly'
  | 'recovery'
  | 'recommendationConfidence';

export type CoachActionType =
  | 'apply_temporary_session_adjustment'
  | 'create_plan_adjustment_preview'
  | 'open_record_detail'
  | 'open_data_health'
  | 'open_replacement_sheet'
  | 'review_volume'
  | 'review_exercise'
  | 'review_session'
  | 'open_next_workout'
  | 'dismiss'
  | 'keep_observing';

export type CoachActionPriority = 'low' | 'medium' | 'high' | 'urgent';

export type CoachActionStatus = 'pending' | 'applied' | 'dismissed' | 'expired' | 'failed';

export type CoachActionExecutionStatus = 'success' | 'no_op' | 'needs_more_data' | 'unsupported' | 'failed';

export type CoachActionExecutionResult = {
  status: CoachActionExecutionStatus;
  message: string;
  openedTab?: 'today' | 'training' | 'record' | 'plan' | 'profile';
  openedSection?: string;
  createdDraftId?: string;
  highlightedTargetId?: string;
};

export type CoachAction = {
  id: string;
  title: string;
  description: string;
  source: CoachActionSource;
  actionType: CoachActionType;
  priority: CoachActionPriority;
  status: CoachActionStatus;
  requiresConfirmation: boolean;
  reversible: boolean;
  createdAt: string;
  expiresAt?: string;
  targetId?: string;
  targetType?: 'session' | 'exercise' | 'template' | 'muscle' | 'healthData' | 'dataHealth' | 'plan';
  reason: string;
  confirmTitle?: string;
  confirmDescription?: string;
  sourceFingerprint?: string;
};

export type BuildCoachActionsInput = {
  appData: AppData;
  dailyAdjustment?: DailyTrainingAdjustment | null;
  nextWorkout?: NextWorkoutRecommendation | null;
  dataHealthReport?: DataHealthReport | null;
  sessionQuality?: SessionQualityResult | null;
  plateauResults?: PlateauDetectionResult[] | null;
  volumeAdaptation?: VolumeAdaptationReport | null;
  recommendationConfidence?: RecommendationConfidenceResult | RecommendationConfidenceResult[] | null;
  setAnomalies?: SetAnomaly[] | null;
  recoveryRecommendation?: RecoveryAwareRecommendation | null;
  now?: string;
};

export type CoachActionAdjustmentDraftInput = {
  recommendation: WeeklyActionRecommendation;
  sourceTemplate: TrainingTemplate;
};

const priorityRank: Record<CoachActionPriority, number> = {
  urgent: 4,
  high: 3,
  medium: 2,
  low: 1,
};

const rawVisibleTokenPattern =
  /\b(undefined|null|normal|conservative|deload_like|main_only|reduce_support|substitute_risky_exercises|rest_or_recovery|possible_plateau|plateau|fatigue_limited|technique_limited|volume_limited|load_too_aggressive|insufficient_data|increase|maintain|decrease|hold|low|medium|high|urgent|pending|applied|dismissed|expired|failed)\b/gi;

const cleanVisibleText = (value: unknown, fallback: string) => {
  const text = String(value ?? '')
    .replace(rawVisibleTokenPattern, '')
    .replace(/\s+/g, ' ')
    .trim();
  return text || fallback;
};

const uniqueStrings = (items: Array<string | undefined>) => [...new Set(items.filter(Boolean) as string[])];

const tomorrowIso = (createdAt: string) => {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return undefined;
  date.setDate(date.getDate() + 1);
  return date.toISOString();
};

const activeSessionInProgress = (appData: AppData) => Boolean(appData.activeSession && appData.activeSession.completed !== true);

const priorityToWeeklyPriority = (priority: CoachActionPriority): WeeklyActionRecommendation['priority'] => {
  if (priority === 'urgent' || priority === 'high') return 'high';
  if (priority === 'medium') return 'medium';
  return 'low';
};

const confidenceFromActionPriority = (priority: CoachActionPriority): WeeklyActionRecommendation['confidence'] => {
  if (priority === 'urgent' || priority === 'high') return 'high';
  if (priority === 'medium') return 'medium';
  return 'low';
};

const normalizeText = (value: unknown) => String(value || '').trim().toLowerCase();

const fingerprintPart = (value: unknown) =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9._:-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'none';

export const buildCoachActionSourceFingerprint = (
  action: Pick<CoachAction, 'id' | 'actionType' | 'source' | 'targetId' | 'targetType'>,
  options: {
    sourceTemplateId?: string;
    suggestedChange?: WeeklyActionRecommendation['suggestedChange'];
    weekId?: string;
    cycleId?: string;
  } = {},
) => {
  const change = options.suggestedChange;
  const setsDelta = Number(change?.setsDelta || 0);
  const changeDirection = setsDelta > 0 ? 'add' : setsDelta < 0 ? 'remove' : 'none';
  return [
    'coach-action',
    action.actionType,
    action.source,
    action.targetType || 'none',
    action.targetId || action.id,
    options.sourceTemplateId || 'template-unknown',
    change?.muscleId || action.targetId || 'target-unknown',
    change?.exerciseIds?.join(',') || 'exercise-unknown',
    changeDirection,
    change?.supportDoseAdjustment || 'support-none',
    options.weekId || options.cycleId || 'current-cycle',
  ].map(fingerprintPart).join('|');
};

const muscleAliases = (muscleId?: string) => {
  const id = normalizeText(muscleId);
  const label = formatMuscleName(muscleId || '');
  const aliases: Record<string, string[]> = {
    back: ['背', '背部'],
    chest: ['胸', '胸部'],
    shoulders: ['肩', '肩部'],
    biceps: ['手臂', '肱二头'],
    triceps: ['手臂', '肱三头'],
    arms: ['手臂', '肱二头', '肱三头'],
    quads: ['腿', '股四头'],
    hamstrings: ['腿', '腿后侧'],
    glutes: ['腿', '臀'],
    calves: ['腿', '小腿'],
    legs: ['腿', '股四头', '腿后侧', '小腿', '臀'],
  };
  return [...new Set([id, label, ...(aliases[id] || [])].filter(Boolean).map(normalizeText))];
};

const exerciseMatchesMuscle = (exercise: TrainingTemplate['exercises'][number], muscleId?: string) => {
  const aliases = muscleAliases(muscleId);
  if (!aliases.length) return false;
  const enriched = enrichExercise(exercise);
  const muscles = [
    exercise.muscle,
    ...getPrimaryMuscles(enriched),
    ...((enriched.secondaryMuscles || []) as string[]),
  ].map(normalizeText);
  return muscles.some((muscle) => aliases.some((alias) => muscle === alias || muscle.includes(alias) || alias.includes(muscle)));
};

const findTemplateByExercise = (templates: TrainingTemplate[], exerciseId?: string) => {
  if (!exerciseId) return undefined;
  return templates.find((template) => template.exercises.some((exercise) => exercise.id === exerciseId || exercise.baseId === exerciseId));
};

const findTemplateByMuscle = (templates: TrainingTemplate[], muscleId?: string) => {
  if (!muscleId) return undefined;
  return templates.find((template) => template.exercises.some((exercise) => exerciseMatchesMuscle(exercise, muscleId)));
};

const firstExerciseForMuscle = (template: TrainingTemplate, muscleId?: string) =>
  template.exercises.find((exercise) => exerciseMatchesMuscle(exercise, muscleId)) || template.exercises[0];

export function buildCoachActionAdjustmentDraftInput(
  action: CoachAction,
  context: {
    templates?: TrainingTemplate[] | null;
    volumeAdaptation?: VolumeAdaptationReport | null;
    plateauResults?: PlateauDetectionResult[] | null;
  } = {},
): CoachActionAdjustmentDraftInput | null {
  if (!action || action.actionType !== 'create_plan_adjustment_preview') return null;
  const templates = context.templates || [];
  if (!templates.length || !action.targetId) return null;

  if (action.targetType === 'muscle') {
    const volumeItem = context.volumeAdaptation?.muscles?.find((item) => item.muscleId === action.targetId);
    const setsDelta = volumeItem?.setsDelta;
    if (!setsDelta) return null;
    const sourceTemplate = findTemplateByMuscle(templates, action.targetId);
    if (!sourceTemplate) return null;
    const exercise = firstExerciseForMuscle(sourceTemplate, action.targetId);
    if (!exercise) return null;
    const targetLabel = formatMuscleName(action.targetId);
    return {
      sourceTemplate,
      recommendation: {
        id: `coach-action-${action.id}`,
        priority: priorityToWeeklyPriority(action.priority),
        category: 'volume',
        targetType: 'muscle',
        targetId: action.targetId,
        targetLabel,
        issue: action.description || `${targetLabel}训练量需要复查`,
        recommendation: action.reason || action.description || `${targetLabel}训练量建议进入计划调整草案。`,
        reason: action.reason || volumeItem.reason || action.description,
        suggestedChange: {
          muscleId: action.targetId,
          setsDelta,
          exerciseIds: [exercise.id],
        },
        confidence: volumeItem?.confidence || confidenceFromActionPriority(action.priority),
      },
    };
  }

  if (action.targetType === 'exercise') {
    const sourceTemplate = findTemplateByExercise(templates, action.targetId);
    if (!sourceTemplate) return null;
    const plateau = context.plateauResults?.find((item) => item.exerciseId === action.targetId);
    return {
      sourceTemplate,
      recommendation: {
        id: `coach-action-${action.id}`,
        priority: priorityToWeeklyPriority(action.priority),
        category: 'exercise_selection',
        targetType: 'exercise',
        targetId: action.targetId,
        targetLabel: formatExerciseName(action.targetId),
        issue: action.description || '动作进展需要复查',
        recommendation: action.reason || plateau?.suggestedActions?.[0] || '生成动作调整草案，应用前由用户确认。',
        reason: action.reason || plateau?.summary || action.description,
        suggestedChange: {
          exerciseIds: [action.targetId],
          setsDelta: -1,
        },
        confidence: plateau?.confidence || confidenceFromActionPriority(action.priority),
      },
    };
  }

  return null;
}

const makeAction = (
  input: Omit<CoachAction, 'status' | 'createdAt' | 'title' | 'description' | 'reason'> & {
    title: unknown;
    description: unknown;
    reason: unknown;
    createdAt: string;
    status?: CoachActionStatus;
  },
): CoachAction => ({
  ...input,
  status: input.status || 'pending',
  title: cleanVisibleText(input.title, '教练建议'),
  description: cleanVisibleText(input.description, '请先查看详情，再决定是否采用。'),
  reason: cleanVisibleText(input.reason, '当前建议来自训练记录和状态信号。'),
});

const dataHealthPriority = (issue?: DataHealthIssue): CoachActionPriority => {
  if (!issue) return 'medium';
  if (issue.severity === 'error') return 'urgent';
  if (issue.severity === 'warning') return 'high';
  return 'medium';
};

const dataHealthTargetType = (issue?: DataHealthIssue): CoachAction['targetType'] => {
  if (!issue) return 'dataHealth';
  if (issue.category === 'healthData') return 'healthData';
  if (issue.category === 'template') return 'plan';
  if (issue.category === 'history' || issue.category === 'summary' || issue.category === 'analytics' || issue.category === 'replacement') return 'session';
  return 'dataHealth';
};

const dataHealthActions = (report: DataHealthReport | null | undefined, createdAt: string) => {
  if (!report || report.status === 'healthy') return [];
  return sortDataHealthIssues(report.issues || [])
    .slice(0, 3)
    .map((issue) =>
      makeAction({
        id: `data-health-${issue.id}`,
        source: 'dataHealth',
        actionType: 'open_data_health',
        priority: dataHealthPriority(issue),
        requiresConfirmation: false,
        reversible: false,
        createdAt,
        targetId: issue.affectedIds?.[0],
        targetType: dataHealthTargetType(issue),
        title: issue.severity === 'error' ? '优先检查数据健康' : '复查数据健康提醒',
        description: issue.title,
        reason: issue.message || report.summary,
      }),
    );
};

const dailyAdjustmentAction = (adjustment: DailyTrainingAdjustment | null | undefined, createdAt: string) => {
  if (!adjustment || adjustment.type === 'normal') return undefined;
  const priority: CoachActionPriority =
    adjustment.type === 'rest_or_recovery' || adjustment.type === 'substitute_risky_exercises'
      ? 'high'
      : 'medium';
  return makeAction({
    id: `daily-adjustment-${adjustment.type}`,
    source: 'dailyAdjustment',
    actionType: 'apply_temporary_session_adjustment',
    priority,
    status: 'pending',
    requiresConfirmation: true,
    reversible: true,
    createdAt,
    expiresAt: tomorrowIso(createdAt),
    targetType: 'session',
    title: `今日自动调整：${adjustment.title}`,
    description: adjustment.summary,
    reason: adjustment.reasons?.[0] || adjustment.summary,
    confirmTitle: '采用本次临时调整？',
    confirmDescription: '只影响本次训练，不会修改原训练模板或长期计划。',
  });
};

const nextWorkoutAction = (nextWorkout: NextWorkoutRecommendation | null | undefined, createdAt: string) => {
  if (!nextWorkout?.templateId) return undefined;
  const priority: CoachActionPriority = nextWorkout.warnings?.length ? 'medium' : 'low';
  return makeAction({
    id: `next-workout-${nextWorkout.templateId}`,
    source: 'nextWorkout',
    actionType: 'open_next_workout',
    priority,
    requiresConfirmation: false,
    reversible: false,
    createdAt,
    expiresAt: tomorrowIso(createdAt),
    targetId: nextWorkout.templateId,
    targetType: 'template',
    title: `查看下次训练：${nextWorkout.templateName}`,
    description: nextWorkout.warnings?.[0] || '打开下次训练建议详情，确认后再开始。',
    reason: nextWorkout.reason,
  });
};

const recoveryAction = (recommendation: RecoveryAwareRecommendation | null | undefined, createdAt: string) => {
  if (!recommendation || recommendation.kind === 'train' || !recommendation.requiresConfirmationToOverride) return undefined;
  const modified = recommendation.kind === 'modified_train';
  return makeAction({
    id: `recovery-${recommendation.kind}-${recommendation.templateId || 'day'}`,
    source: 'recovery',
    actionType: modified ? 'apply_temporary_session_adjustment' : 'keep_observing',
    priority: recommendation.kind === 'rest' || recommendation.kind === 'active_recovery' ? 'high' : 'medium',
    requiresConfirmation: modified,
    reversible: modified,
    createdAt,
    expiresAt: tomorrowIso(createdAt),
    targetId: recommendation.templateId,
    targetType: recommendation.templateId ? 'template' : 'session',
    title: modified ? '采用恢复保守版' : '查看恢复建议',
    description: recommendation.summary,
    reason: recommendation.reasons?.[0] || recommendation.summary,
    confirmTitle: modified ? '采用本次保守训练？' : undefined,
    confirmDescription: modified ? '只影响本次训练，不会修改原模板。' : undefined,
  });
};

const sessionQualityAction = (quality: SessionQualityResult | null | undefined, createdAt: string) => {
  if (!quality || quality.level === 'high' || quality.level === 'insufficient_data') return undefined;
  return makeAction({
    id: `session-quality-${quality.level}`,
    source: 'sessionQuality',
    actionType: 'review_session',
    priority: quality.level === 'low' ? 'medium' : 'low',
    requiresConfirmation: false,
    reversible: false,
    createdAt,
    targetType: 'session',
    title: quality.level === 'low' ? '复查本次训练质量' : '查看训练质量提示',
    description: quality.summary,
    reason: quality.issues?.[0]?.reason || quality.nextSuggestions?.[0] || quality.summary,
  });
};

const plateauActionType = (result: PlateauDetectionResult): CoachActionType =>
  result.status === 'plateau' && result.confidence !== 'low' ? 'create_plan_adjustment_preview' : 'review_exercise';

const plateauPriority = (result: PlateauDetectionResult): CoachActionPriority => {
  if (result.status === 'plateau' || result.status === 'load_too_aggressive') return 'medium';
  if (result.status === 'possible_plateau' || result.status === 'technique_limited' || result.status === 'fatigue_limited' || result.status === 'volume_limited') return 'medium';
  return 'low';
};

const plateauActions = (results: PlateauDetectionResult[] | null | undefined, createdAt: string) =>
  (results || [])
    .filter((result) => result.status !== 'none' && result.status !== 'insufficient_data')
    .slice(0, 3)
    .map((result) => {
      const actionType = plateauActionType(result);
      return makeAction({
        id: `plateau-${result.exerciseId}-${result.status}`,
        source: 'plateau',
        actionType,
        priority: plateauPriority(result),
        requiresConfirmation: actionType === 'create_plan_adjustment_preview',
        reversible: actionType === 'create_plan_adjustment_preview',
        createdAt,
        targetId: result.exerciseId,
        targetType: 'exercise',
        title: actionType === 'create_plan_adjustment_preview' ? '生成动作调整预览' : '查看动作进展',
        description: result.title,
        reason: result.summary || result.signals?.[0]?.reason || result.suggestedActions?.[0],
        confirmTitle: actionType === 'create_plan_adjustment_preview' ? '生成计划调整预览？' : undefined,
        confirmDescription: actionType === 'create_plan_adjustment_preview' ? '只生成预览，不会直接修改正式计划。' : undefined,
      });
    });

const shouldCreateVolumePreview = (item: MuscleVolumeAdaptation) =>
  item.decision === 'increase' || item.decision === 'decrease';

const volumeActions = (report: VolumeAdaptationReport | null | undefined, createdAt: string) => {
  const target = (report?.muscles || []).find(shouldCreateVolumePreview);
  if (!target) return [];
  return [
    makeAction({
      id: `volume-preview-${target.muscleId}-${target.decision}`,
      source: 'volumeAdaptation',
      actionType: 'create_plan_adjustment_preview',
      priority: 'medium',
      requiresConfirmation: true,
      reversible: true,
      createdAt,
      targetId: target.muscleId,
      targetType: 'muscle',
      title: '生成训练量调整预览',
      description: target.title,
      reason: target.reason || report?.summary,
      confirmTitle: '生成计划调整预览？',
      confirmDescription: '只生成可检查的草案，不会自动覆盖当前训练计划。',
    }),
    makeAction({
      id: `review-volume-${target.muscleId}`,
      source: 'volumeAdaptation',
      actionType: 'review_volume',
      priority: 'low',
      requiresConfirmation: false,
      reversible: false,
      createdAt,
      targetId: target.muscleId,
      targetType: 'muscle',
      title: '查看训练量建议',
      description: target.title,
      reason: target.reason || report?.summary,
    }),
  ];
};

const recommendationConfidenceActions = (
  input: RecommendationConfidenceResult | RecommendationConfidenceResult[] | null | undefined,
  createdAt: string,
) => {
  const results = (Array.isArray(input) ? input : input ? [input] : []).filter((result) => result.level === 'low');
  return results.slice(0, 2).map((result, index) =>
    makeAction({
      id: `recommendation-confidence-${index}`,
      source: 'recommendationConfidence',
      actionType: 'keep_observing',
      priority: 'low',
      requiresConfirmation: false,
      reversible: false,
      createdAt,
      title: '推荐建议保守参考',
      description: result.summary,
      reason: result.reasons?.[0]?.reason || result.missingData?.[0] || result.summary,
    }),
  );
};

const setAnomalyActions = (anomalies: SetAnomaly[] | null | undefined, createdAt: string) =>
  (anomalies || [])
    .filter((anomaly) => anomaly.severity === 'critical' || anomaly.severity === 'warning')
    .slice(0, 2)
    .map((anomaly) =>
      makeAction({
        id: `set-anomaly-${anomaly.id}`,
        source: 'setAnomaly',
        actionType: 'review_session',
        priority: anomaly.severity === 'critical' ? 'urgent' : 'medium',
        requiresConfirmation: anomaly.requiresConfirmation,
        reversible: false,
        createdAt,
        targetType: 'session',
        title: anomaly.severity === 'critical' ? '确认异常训练输入' : '复查训练输入',
        description: anomaly.title,
        reason: anomaly.message || anomaly.suggestedAction,
        confirmTitle: anomaly.requiresConfirmation ? '确认保存这组？' : undefined,
        confirmDescription: anomaly.requiresConfirmation ? '系统检测到重量、次数或 RIR 可能异常，请确认不是输入错误。' : undefined,
      }),
    );

const dedupeActions = (actions: CoachAction[]) => {
  const byId = new Map<string, CoachAction>();
  actions.forEach((action) => {
    const existing = byId.get(action.id);
    if (!existing || priorityRank[action.priority] > priorityRank[existing.priority]) byId.set(action.id, action);
  });
  return [...byId.values()];
};

const sortActions = (actions: CoachAction[]) =>
  [...actions].sort((left, right) => {
    const priorityDiff = priorityRank[right.priority] - priorityRank[left.priority];
    if (priorityDiff !== 0) return priorityDiff;
    if (left.source === 'dataHealth' && right.source !== 'dataHealth') return -1;
    if (right.source === 'dataHealth' && left.source !== 'dataHealth') return 1;
    return left.id.localeCompare(right.id);
  });

const lowNoiseDuringActiveSession = (actions: CoachAction[]) =>
  actions.filter((action) => {
    if (action.source === 'dataHealth') return action.priority === 'urgent' || action.priority === 'high';
    if (action.source === 'setAnomaly') return action.priority === 'urgent';
    return false;
  }).slice(0, 2);

export function buildCoachActions({
  appData,
  dailyAdjustment,
  nextWorkout,
  dataHealthReport,
  sessionQuality,
  plateauResults,
  volumeAdaptation,
  recommendationConfidence,
  setAnomalies,
  recoveryRecommendation,
  now,
}: BuildCoachActionsInput): CoachAction[] {
  const createdAt = now || new Date().toISOString();
  const actions = dedupeActions([
    ...dataHealthActions(dataHealthReport, createdAt),
    ...setAnomalyActions(setAnomalies, createdAt),
    dailyAdjustmentAction(dailyAdjustment, createdAt),
    nextWorkoutAction(nextWorkout, createdAt),
    recoveryAction(recoveryRecommendation || nextWorkout?.recovery, createdAt),
    sessionQualityAction(sessionQuality, createdAt),
    ...plateauActions(plateauResults, createdAt),
    ...volumeActions(volumeAdaptation, createdAt),
    ...recommendationConfidenceActions(recommendationConfidence, createdAt),
  ].filter((action): action is CoachAction => Boolean(action)));

  const sorted = sortActions(actions);
  return activeSessionInProgress(appData) ? lowNoiseDuringActiveSession(sorted) : sorted;
}
