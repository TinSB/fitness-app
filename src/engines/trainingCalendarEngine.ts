import type { TrainingSession } from '../models/training-model';
import { buildEffectiveVolumeSummary } from './effectiveSetEngine';
import { monthKey, number, sessionCompletedSets, sessionVolume } from './engineUtils';
import { filterAnalyticsHistory } from './sessionHistoryEngine';

export type TrainingCalendarDay = {
  date: string;
  sessions: Array<{
    sessionId: string;
    title: string;
    templateName?: string;
    startTime?: string;
    durationMin?: number;
    completedSets: number;
    effectiveSets: number;
    totalVolumeKg: number;
    isExperimentalTemplate?: boolean;
  }>;
  totalSessions: number;
  totalVolumeKg: number;
  hasPainFlags: boolean;
};

export type TrainingCalendarData = {
  month: string;
  days: TrainingCalendarDay[];
  weeklyFrequency: Array<{
    weekStart: string;
    sessionCount: number;
  }>;
};

const toDateKey = (value?: string) => String(value || '').slice(0, 10);

const startOfWeekKey = (dateKey: string) => {
  const date = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateKey;
  const day = date.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
};

const monthDayKeys = (month: string) => {
  const first = new Date(`${month}-01T00:00:00`);
  if (Number.isNaN(first.getTime())) return [];
  const result: string[] = [];
  const cursor = new Date(first);
  while (cursor.getMonth() === first.getMonth()) {
    result.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() + 1);
  }
  return result;
};

const sessionHasPain = (session: TrainingSession) =>
  (session.exercises || []).some((exercise) => Array.isArray(exercise.sets) && exercise.sets.some((set) => Boolean(set.painFlag)));

export const buildTrainingCalendar = (history: TrainingSession[] = [], month = monthKey()): TrainingCalendarData => {
  const analyticsHistory = filterAnalyticsHistory(history);
  const sessionsByDate = new Map<string, TrainingSession[]>();

  analyticsHistory.forEach((session) => {
    const date = toDateKey(session.date || session.startedAt);
    if (!date || !date.startsWith(month)) return;
    const list = sessionsByDate.get(date) || [];
    list.push(session);
    sessionsByDate.set(date, list);
  });

  const days = monthDayKeys(month).map<TrainingCalendarDay>((date) => {
    const sessions = (sessionsByDate.get(date) || []).sort((left, right) => String(left.startedAt || '').localeCompare(String(right.startedAt || '')));
    const sessionRows = sessions.map((session) => ({
      sessionId: session.id,
      title: session.focus || session.templateName || '训练',
      templateName: session.templateName,
      startTime: session.startedAt,
      durationMin: number(session.durationMin),
      completedSets: sessionCompletedSets(session),
      effectiveSets: buildEffectiveVolumeSummary([session]).effectiveSets,
      totalVolumeKg: sessionVolume(session),
      isExperimentalTemplate: Boolean(session.isExperimentalTemplate),
    }));

    return {
      date,
      sessions: sessionRows,
      totalSessions: sessionRows.length,
      totalVolumeKg: sessionRows.reduce((sum, item) => sum + item.totalVolumeKg, 0),
      hasPainFlags: sessions.some(sessionHasPain),
    };
  });

  const weekCounts = new Map<string, number>();
  analyticsHistory.forEach((session) => {
    const date = toDateKey(session.date || session.startedAt);
    if (!date) return;
    const weekStart = startOfWeekKey(date);
    weekCounts.set(weekStart, (weekCounts.get(weekStart) || 0) + 1);
  });

  const weeklyFrequency = [...weekCounts.entries()]
    .map(([weekStart, sessionCount]) => ({ weekStart, sessionCount }))
    .sort((left, right) => right.weekStart.localeCompare(left.weekStart))
    .slice(0, 4)
    .reverse();

  return { month, days, weeklyFrequency };
};
