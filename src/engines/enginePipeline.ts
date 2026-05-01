import type { AppData } from '../models/training-model';
import { buildCoachActions, type CoachAction } from './coachActionEngine';
import { filterVisibleCoachActions } from './coachActionDismissEngine';
import { buildDataHealthReport, type DataHealthReport } from './dataHealthEngine';
import { buildDailyTrainingAdjustment, type DailyTrainingAdjustment } from './dailyTrainingAdjustmentEngine';
import { buildNextWorkoutRecommendation, type NextWorkoutRecommendation } from './nextWorkoutScheduler';
import { buildTodayTrainingState, type TodayTrainingState } from './todayStateEngine';
import { buildTrainingDecisionContext, type TrainingDecisionContext } from './trainingDecisionContext';
import { actionableSorenessAreas } from './engineUtils';

export type EnginePipelineResult = {
  context: TrainingDecisionContext;
  todayState: TodayTrainingState;
  dataHealth: DataHealthReport;
  nextWorkout: NextWorkoutRecommendation;
  todayAdjustment?: DailyTrainingAdjustment;
  coachActions: CoachAction[];
  visibleCoachActions: CoachAction[];
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

  return {
    context,
    todayState,
    dataHealth,
    nextWorkout,
    todayAdjustment,
    coachActions,
    visibleCoachActions,
  };
}
