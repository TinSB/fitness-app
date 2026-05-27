import type { AppData } from '../models/training-model';
import { buildCoachActions, type CoachAction } from './coachActionEngine';
import { filterVisibleCoachActions } from './coachActionDismissEngine';
import { buildDataHealthReport, sortDataHealthIssues, type DataHealthReport } from './dataHealthEngine';
import { buildDailyTrainingAdjustment, type DailyTrainingAdjustment } from './dailyTrainingAdjustmentEngine';
import { buildNextWorkoutRecommendation, type NextWorkoutRecommendation } from './nextWorkoutScheduler';
import { buildTodayTrainingState, type TodayTrainingState } from './todayStateEngine';
import { buildTrainingDecisionContext, type TrainingDecisionContext } from './trainingDecisionContext';
import { actionableSorenessAreas } from './engineUtils';

export type CoachAutomationSummary = {
  todayAdjustment?: DailyTrainingAdjustment;
  nextWorkout?: NextWorkoutRecommendation;
  dataHealth?: DataHealthReport;
  keyWarnings: string[];
};

export type EnginePipelineResult = {
  context: TrainingDecisionContext;
  todayState: TodayTrainingState;
  dataHealth: DataHealthReport;
  nextWorkout: NextWorkoutRecommendation;
  todayAdjustment?: DailyTrainingAdjustment;
  coachActions: CoachAction[];
  visibleCoachActions: CoachAction[];
  coachAutomationSummary: CoachAutomationSummary;
};

export type BuildEnginePipelineOptions = {
  coachActions?: CoachAction[] | null;
  currentDate?: string;
  trainingMode?: AppData['trainingMode'];
};

const activeSessionInProgress = (data: AppData) => Boolean(data.activeSession && data.activeSession.completed !== true);

export function buildEnginePipeline(
  appData: AppData,
  currentDate: string,
  options: BuildEnginePipelineOptions = {},
): EnginePipelineResult {
  const context = buildTrainingDecisionContext(appData, options.currentDate || currentDate, {
    trainingMode: options.trainingMode || appData.trainingMode,
  });
  const todayState = buildTodayTrainingState({
    activeSession: context.activeSession,
    history: context.allHistory,
    currentLocalDate: context.currentDateLocalKey,
    templates: context.templates,
    programTemplate: context.currentProgramTemplate,
    plannedTemplateId: context.selectedTemplateId,
  });
  const dataHealth = buildDataHealthReport(appData);
  const nextWorkout = buildNextWorkoutRecommendation({
    history: context.allHistory,
    activeSession: context.activeSession,
    programTemplate: context.currentProgramTemplate,
    templates: context.templates,
    todayState,
    painPatterns: context.painPatterns,
    sorenessAreas: actionableSorenessAreas(context.todayStatus.soreness),
    painAreas: context.painPatterns.map((pattern) => pattern.area),
    readinessResult: context.readinessResult,
    trainingMode: context.trainingMode,
  });
  const todayAdjustment = activeSessionInProgress(appData)
    ? undefined
    : buildDailyTrainingAdjustment({
        readinessResult: context.readinessResult,
        healthSummary: context.healthSummary,
        previous24hActivity: context.healthSummary?.activityLoad
          ? {
              workoutMinutes: context.healthSummary.activityLoad.previous24hWorkoutMinutes,
              activeEnergyKcal: context.healthSummary.activityLoad.previous24hActiveEnergyKcal,
              highActivity: context.healthSummary.activityLoad.previous24hHighActivity,
            }
          : undefined,
        recentHistory: context.normalHistory,
        painPatterns: context.painPatterns,
        sorenessAreas: actionableSorenessAreas(context.todayStatus.soreness),
        painAreas: context.painPatterns.map((pattern) => pattern.area),
        loadFeedbackSummary: context.loadFeedbackSummary,
        trainingLevel: context.trainingLevel,
        activeTemplate: context.currentTrainingTemplate,
      });
  const coachActions =
    options.coachActions ??
    buildCoachActions({
      appData,
      dailyAdjustment: todayAdjustment,
      nextWorkout,
      dataHealthReport: dataHealth,
      now: `${context.currentDateLocalKey}T12:00:00.000Z`,
    });
  const visibleCoachActions = filterVisibleCoachActions(
    coachActions,
    appData.programAdjustmentDrafts || [],
    appData.programAdjustmentHistory || [],
    appData.dismissedCoachActions || appData.settings?.dismissedCoachActions || [],
    context.currentDateLocalKey,
  );

  const coachAutomationSummary: CoachAutomationSummary = {
    todayAdjustment,
    nextWorkout,
    dataHealth,
    keyWarnings: buildCoachAutomationKeyWarnings(dataHealth, todayAdjustment, nextWorkout),
  };

  return {
    context,
    todayState,
    dataHealth,
    nextWorkout,
    todayAdjustment,
    coachActions,
    visibleCoachActions,
    coachAutomationSummary,
  };
}

const nonEmpty = (value: unknown) => String(value || '').trim();
const uniqueWarnings = (items: string[]) => [...new Set(items.map(nonEmpty).filter(Boolean))];

const dataHealthWarnings = (report?: DataHealthReport) =>
  sortDataHealthIssues(report?.issues || [])
    .slice(0, 3)
    .map((issue) => `${issue.title}：${issue.message}`);

const buildCoachAutomationKeyWarnings = (
  dataHealth: DataHealthReport,
  todayAdjustment?: DailyTrainingAdjustment,
  nextWorkout?: NextWorkoutRecommendation,
): string[] => {
  if (dataHealth.status !== 'healthy') {
    return uniqueWarnings(dataHealthWarnings(dataHealth)).slice(0, 3);
  }
  return uniqueWarnings([
    ...(todayAdjustment && todayAdjustment.type !== 'normal' ? todayAdjustment.reasons.slice(0, 2) : []),
    ...(nextWorkout?.warnings || []).slice(0, 2),
  ]).slice(0, 3);
};
