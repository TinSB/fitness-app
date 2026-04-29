import type { AppData } from '../models/training-model';
import { buildDataHealthReport, type DataHealthReport } from './dataHealthEngine';
import { buildDailyTrainingAdjustment, type DailyTrainingAdjustment } from './dailyTrainingAdjustmentEngine';
import { buildHealthSummary } from './healthSummaryEngine';
import { buildLoadFeedbackSummary } from './loadFeedbackEngine';
import { buildNextWorkoutRecommendation, type NextWorkoutRecommendation } from './nextWorkoutScheduler';
import { buildPainPatterns } from './painPatternEngine';
import { filterAnalyticsHistory } from './sessionHistoryEngine';
import { buildTodayReadiness } from './readinessEngine';
import { buildTodayTrainingState } from './todayStateEngine';
import { buildTrainingDecisionContext } from './trainingDecisionContext';
import { buildTrainingLevelAssessment } from './trainingLevelEngine';
import { todayKey } from './engineUtils';

export type CoachAutomationSummary = {
  todayAdjustment?: DailyTrainingAdjustment;
  nextWorkout?: NextWorkoutRecommendation;
  dataHealth?: DataHealthReport;
  keyWarnings: string[];
  recommendedActions: Array<{
    id: string;
    label: string;
    actionType:
      | 'review_data'
      | 'apply_daily_adjustment'
      | 'open_next_workout'
      | 'review_replacement'
      | 'edit_history'
      | 'ignore';
    reason: string;
    requiresConfirmation: boolean;
  }>;
};

type CoachAction = CoachAutomationSummary['recommendedActions'][number] & {
  priority: number;
};

const nonEmpty = (value: unknown) => String(value || '').trim();

const unique = (items: string[]) => [...new Set(items.map(nonEmpty).filter(Boolean))];

const selectedTemplateFor = (data: Partial<AppData>) => {
  const templateId = data.activeProgramTemplateId || data.selectedTemplateId;
  return (data.templates || []).find((template) => template.id === templateId) || (data.templates || [])[0] || null;
};

const issuePriority = (severity: string) => {
  if (severity === 'error') return 100;
  if (severity === 'warning') return 70;
  return 30;
};

const topDataHealthIssues = (report?: DataHealthReport) =>
  [...(report?.issues || [])].sort((left, right) => issuePriority(right.severity) - issuePriority(left.severity));

const dataHealthWarnings = (report?: DataHealthReport) =>
  topDataHealthIssues(report)
    .slice(0, 3)
    .map((issue) => `${issue.title}：${issue.message}`);

const buildDataHealthAction = (report: DataHealthReport): CoachAction | undefined => {
  if (report.status === 'healthy') return undefined;
  const topIssue = topDataHealthIssues(report)[0];
  return {
    id: 'review-data-health',
    label: topIssue?.severity === 'error' ? '优先检查数据' : '复查数据提示',
    actionType: 'review_data',
    reason: topIssue?.message || report.summary,
    requiresConfirmation: false,
    priority: topIssue?.severity === 'error' ? 100 : 80,
  };
};

const buildDailyAdjustmentAction = (adjustment?: DailyTrainingAdjustment): CoachAction | undefined => {
  if (!adjustment || adjustment.type === 'normal') return undefined;
  return {
    id: `daily-adjustment-${adjustment.type}`,
    label: `今日自动调整：${adjustment.title}`,
    actionType: 'apply_daily_adjustment',
    reason: adjustment.reasons[0] || adjustment.summary,
    requiresConfirmation: true,
    priority: adjustment.type === 'rest_or_recovery' || adjustment.type === 'substitute_risky_exercises' ? 85 : 65,
  };
};

const buildNextWorkoutAction = (nextWorkout?: NextWorkoutRecommendation): CoachAction | undefined => {
  if (!nextWorkout?.templateId) return undefined;
  return {
    id: `open-next-workout-${nextWorkout.templateId}`,
    label: `下次训练：${nextWorkout.templateName}`,
    actionType: 'open_next_workout',
    reason: nextWorkout.reason,
    requiresConfirmation: false,
    priority: 50,
  };
};

const summarizeWarnings = (
  dataHealth: DataHealthReport,
  todayAdjustment?: DailyTrainingAdjustment,
  nextWorkout?: NextWorkoutRecommendation,
) => {
  if (dataHealth.status !== 'healthy') {
    return unique(dataHealthWarnings(dataHealth)).slice(0, 3);
  }

  return unique([
    ...(todayAdjustment && todayAdjustment.type !== 'normal' ? todayAdjustment.reasons.slice(0, 2) : []),
    ...(nextWorkout?.warnings || []).slice(0, 2),
  ]).slice(0, 3);
};

export const buildCoachAutomationSummary = (appData: AppData): CoachAutomationSummary => {
  const before = appData;
  const dataHealth = buildDataHealthReport(appData);
  const decisionContext = buildTrainingDecisionContext(appData);
  const activeTemplate = selectedTemplateFor(appData);
  const analyticsHistory = filterAnalyticsHistory(appData.history || []);
  const painPatterns = buildPainPatterns(analyticsHistory);
  const healthSummary =
    decisionContext.healthSummary ||
    buildHealthSummary(appData.healthMetricSamples || [], appData.importedWorkoutSamples || []);
  const readinessResult = buildTodayReadiness(appData, activeTemplate || undefined, {
    healthSummary,
    useHealthDataForReadiness: decisionContext.useHealthDataForReadiness,
    painAreas: painPatterns.slice(0, 3).map((pattern) => pattern.area),
  });
  const todayState = buildTodayTrainingState({
    activeSession: appData.activeSession,
    history: appData.history || [],
    currentLocalDate: todayKey(),
    templates: appData.templates || [],
    programTemplate: appData.programTemplate,
    plannedTemplateId: appData.selectedTemplateId,
  });
  const trainingLevel = buildTrainingLevelAssessment({ history: analyticsHistory, painPatterns }).level;
  const loadFeedbackSummary = (activeTemplate?.exercises || []).map((exercise) =>
    buildLoadFeedbackSummary(analyticsHistory, exercise.id)
  );

  const hasActiveSession = Boolean(appData.activeSession && appData.activeSession.completed !== true);
  const todayAdjustment = hasActiveSession
    ? undefined
    : buildDailyTrainingAdjustment({
        readinessResult,
        healthSummary,
        previous24hActivity: healthSummary.activityLoad
          ? {
              workoutMinutes: healthSummary.activityLoad.previous24hWorkoutMinutes,
              activeEnergyKcal: healthSummary.activityLoad.previous24hActiveEnergyKcal,
              highActivity: healthSummary.activityLoad.previous24hHighActivity,
            }
          : undefined,
        recentHistory: analyticsHistory,
        painPatterns,
        loadFeedbackSummary,
        trainingLevel,
        activeTemplate,
      });
  const nextWorkout = buildNextWorkoutRecommendation({
    history: appData.history || [],
    activeSession: appData.activeSession,
    programTemplate: appData.programTemplate,
    templates: appData.templates || [],
    todayState,
    painPatterns,
    readinessResult,
    trainingMode: appData.trainingMode,
  });

  const actions: CoachAction[] = [];
  const dataAction = buildDataHealthAction(dataHealth);
  if (dataAction) actions.push(dataAction);

  if (!hasActiveSession) {
    const dailyAction = buildDailyAdjustmentAction(todayAdjustment);
    if (dailyAction) actions.push(dailyAction);
    if (todayState.status === 'completed') {
      const nextAction = buildNextWorkoutAction(nextWorkout);
      if (nextAction) actions.push(nextAction);
    }
  }

  const recommendedActions = actions
    .sort((left, right) => right.priority - left.priority)
    .slice(0, 3)
    .map(({ priority: _priority, ...action }) => action);

  if (before !== appData) {
    throw new Error('Coach automation summary must not replace AppData.');
  }

  return {
    todayAdjustment,
    nextWorkout,
    dataHealth,
    keyWarnings: summarizeWarnings(dataHealth, todayAdjustment, nextWorkout),
    recommendedActions,
  };
};
