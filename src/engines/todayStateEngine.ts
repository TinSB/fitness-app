import type { ProgramTemplate, TrainingSession, TrainingTemplate } from '../models/training-model';
import { toLocalDateKey } from './trainingCalendarEngine';

export type TodayTrainingState =
  | {
      status: 'not_started';
      date: string;
      plannedTemplateId?: string;
      primaryAction: 'start_training';
    }
  | {
      status: 'in_progress';
      date: string;
      activeSessionId: string;
      primaryAction: 'continue_training';
    }
  | {
      status: 'completed';
      date: string;
      completedSessionIds: string[];
      lastCompletedSessionId: string;
      primaryAction: 'view_summary';
    };

export type BuildTodayTrainingStateInput = {
  activeSession?: TrainingSession | null;
  history?: TrainingSession[];
  selectedDate?: string;
  templates?: TrainingTemplate[];
  programTemplate?: ProgramTemplate;
  currentLocalDate?: string;
  plannedTemplateId?: string;
};

const sessionDateKey = (session: TrainingSession) => toLocalDateKey(session.date || session.startedAt || session.finishedAt);

const recentTimestamp = (session: TrainingSession) =>
  String(session.finishedAt || session.startedAt || session.date || '');

export const buildTodayTrainingState = ({
  activeSession,
  history = [],
  selectedDate,
  currentLocalDate,
  plannedTemplateId,
}: BuildTodayTrainingStateInput): TodayTrainingState => {
  const date = toLocalDateKey(selectedDate || currentLocalDate || new Date().toISOString());

  if (activeSession && activeSession.completed !== true) {
    return {
      status: 'in_progress',
      date,
      activeSessionId: activeSession.id,
      primaryAction: 'continue_training',
    };
  }

  const completedSessions = history
    .filter((session) => {
      const flag = session.dataFlag || 'normal';
      if (flag === 'test' || flag === 'excluded') return false;
      if (session.completed !== true) return false;
      return sessionDateKey(session) === date;
    })
    .sort((left, right) => recentTimestamp(right).localeCompare(recentTimestamp(left)));

  if (completedSessions.length) {
    return {
      status: 'completed',
      date,
      completedSessionIds: completedSessions.map((session) => session.id),
      lastCompletedSessionId: completedSessions[0].id,
      primaryAction: 'view_summary',
    };
  }

  return {
    status: 'not_started',
    date,
    plannedTemplateId,
    primaryAction: 'start_training',
  };
};
