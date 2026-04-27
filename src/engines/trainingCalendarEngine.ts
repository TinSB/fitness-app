import type { ImportedWorkoutSample, SessionDataFlag, TrainingSession } from '../models/training-model';
import { buildEffectiveVolumeSummary } from './effectiveSetEngine';
import { monthKey, number, sessionCompletedSets, sessionVolume } from './engineUtils';

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
    dataFlag?: SessionDataFlag;
  }>;
  externalWorkouts: Array<{
    workoutId: string;
    title: string;
    workoutType: string;
    startTime?: string;
    durationMin: number;
    activeEnergyKcal?: number;
    avgHeartRate?: number;
    dataFlag?: SessionDataFlag;
    source: string;
  }>;
  totalSessions: number;
  totalExternalWorkouts: number;
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

export type TrainingCalendarOptions = {
  includeDataFlags?: Array<SessionDataFlag | 'unset'> | 'all';
  importedWorkouts?: ImportedWorkoutSample[];
  includeExternalWorkouts?: boolean;
  includeExternalDataFlags?: Array<SessionDataFlag | 'unset'> | 'all';
};

export const toLocalDateKey = (value?: string) => {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value).slice(0, 10);
  const local = new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

const shouldIncludeSession = (session: TrainingSession, includeDataFlags: TrainingCalendarOptions['includeDataFlags']) => {
  if (includeDataFlags === 'all') return true;
  const flag = session.dataFlag || 'normal';
  const allowed = includeDataFlags || ['normal', 'unset'];
  return allowed.includes(flag as SessionDataFlag) || (!session.dataFlag && allowed.includes('unset'));
};

const shouldIncludeExternalWorkout = (
  workout: ImportedWorkoutSample,
  includeDataFlags: TrainingCalendarOptions['includeExternalDataFlags']
) => {
  if (includeDataFlags === 'all') return true;
  const flag = workout.dataFlag || 'normal';
  const allowed = includeDataFlags || ['normal', 'unset'];
  return allowed.includes(flag as SessionDataFlag) || (!workout.dataFlag && allowed.includes('unset'));
};

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

export const buildTrainingCalendar = (history: TrainingSession[] = [], month = monthKey(), options: TrainingCalendarOptions = {}): TrainingCalendarData => {
  const calendarHistory = history.filter((session) => shouldIncludeSession(session, options.includeDataFlags));
  const calendarExternalWorkouts = options.includeExternalWorkouts
    ? (options.importedWorkouts || []).filter((workout) => shouldIncludeExternalWorkout(workout, options.includeExternalDataFlags))
    : [];
  const sessionsByDate = new Map<string, TrainingSession[]>();
  const externalWorkoutsByDate = new Map<string, ImportedWorkoutSample[]>();

  calendarHistory.forEach((session) => {
    const date = toLocalDateKey(session.date || session.startedAt);
    if (!date || !date.startsWith(month)) return;
    const list = sessionsByDate.get(date) || [];
    list.push(session);
    sessionsByDate.set(date, list);
  });

  calendarExternalWorkouts.forEach((workout) => {
    const date = toLocalDateKey(workout.startDate);
    if (!date || !date.startsWith(month)) return;
    const list = externalWorkoutsByDate.get(date) || [];
    list.push(workout);
    externalWorkoutsByDate.set(date, list);
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
      dataFlag: session.dataFlag || 'normal',
    }));
    const externalWorkoutRows = (externalWorkoutsByDate.get(date) || [])
      .sort((left, right) => String(left.startDate || '').localeCompare(String(right.startDate || '')))
      .map((workout) => ({
        workoutId: workout.id,
        title: `外部活动：${workout.workoutType || '活动'}`,
        workoutType: workout.workoutType || '活动',
        startTime: workout.startDate,
        durationMin: number(workout.durationMin),
        activeEnergyKcal: workout.activeEnergyKcal,
        avgHeartRate: workout.avgHeartRate,
        dataFlag: workout.dataFlag || 'normal',
        source: workout.source,
      }));

    return {
      date,
      sessions: sessionRows,
      externalWorkouts: externalWorkoutRows,
      totalSessions: sessionRows.length,
      totalExternalWorkouts: externalWorkoutRows.length,
      totalVolumeKg: sessionRows.reduce((sum, item) => sum + item.totalVolumeKg, 0),
      hasPainFlags: sessions.some(sessionHasPain),
    };
  });

  const weekCounts = new Map<string, number>();
  calendarHistory.forEach((session) => {
    const date = toLocalDateKey(session.date || session.startedAt);
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
