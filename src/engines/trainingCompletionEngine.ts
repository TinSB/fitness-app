import type { AppData, TrainingSession } from '../models/training-model';
import { reconcileScreeningProfile } from './adaptiveFeedbackEngine';
import { toLocalDateKey } from './trainingCalendarEngine';

export const finalizeTrainingSession = (session: TrainingSession, finishedAt = new Date().toISOString()): TrainingSession => {
  const startedAt = session.startedAt || finishedAt;
  return {
    ...session,
    date: toLocalDateKey(session.date || startedAt || finishedAt),
    startedAt,
    finishedAt,
    completed: true,
    dataFlag: session.dataFlag || 'normal',
    durationMin: Math.max(1, Math.round((new Date(finishedAt).getTime() - new Date(startedAt).getTime()) / 60000)),
    programTemplateId: session.programTemplateId || session.templateId,
    programTemplateName: session.programTemplateName || session.templateName,
    isExperimentalTemplate: Boolean(session.isExperimentalTemplate),
    supportExerciseLogs: Array.isArray(session.supportExerciseLogs) ? session.supportExerciseLogs : [],
  };
};

export const completeTrainingSessionIntoHistory = (
  data: AppData,
  finishedAt = new Date().toISOString(),
): { data: AppData; session: TrainingSession | null } => {
  if (!data.activeSession) return { data, session: null };

  const finishedBase = finalizeTrainingSession(data.activeSession, finishedAt);
  const provisionalHistory = [finishedBase, ...(data.history || [])].slice(0, 500);
  const nextScreening = reconcileScreeningProfile(data.screeningProfile, provisionalHistory);
  const finished: TrainingSession = {
    ...finishedBase,
    feedbackSummary: {
      painExercises: Object.entries(nextScreening.adaptiveState?.painByExercise || {})
        .filter(([, count]) => count >= 2)
        .map(([exerciseId]) => exerciseId),
      performanceDrops: nextScreening.adaptiveState?.performanceDrops || [],
      improvingIssues: (nextScreening.adaptiveState?.improvingIssues || []) as NonNullable<TrainingSession['feedbackSummary']>['improvingIssues'],
    },
  };

  return {
    session: finished,
    data: {
      ...data,
      activeSession: null,
      history: [finished, ...(data.history || [])].slice(0, 500),
      screeningProfile: nextScreening,
    },
  };
};
