import type { AppData } from '../models/training-model';
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
