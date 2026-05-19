import { CORE_TREND_EXERCISES, buildPrs } from './analytics';
import { buildE1RMProfile } from './e1rmEngine';
import { number, todayKey } from './engineUtils';
import { listSessionHistory } from './sessionHistoryEngine';
import { buildSessionDetailSummary } from './sessionDetailSummaryEngine';
import { buildTrainingCalendar, getSessionCalendarDate, toLocalDateKey } from './trainingCalendarEngine';
import { formatExerciseName, formatTemplateName } from '../i18n/formatters';
import type { ImportedWorkoutSample, SessionDataFlag, TrainingSession } from '../models/training-model';

export type HistoryCalendarDay = {
  date: string;
  isToday: boolean;
  isSelected: boolean;
  hasTraining: boolean;
  sessionCount: number;
  focusLabel?: string;
  hasPr: boolean;
  hasE1rmChange: boolean;
  hasIssueHint: boolean;
  intensityLabel?: string;
  displayLabel: string;
};

export type HistorySelectedDaySummary = {
  date: string;
  trained: boolean;
  sessionTitles: string[];
  mainExercises: string[];
  totalSets?: number;
  mainLiftSummary?: string;
  issueHint?: string;
  emptyCopy?: string;
};

export type HistoryPrQuickAccessItem = {
  exerciseId: string;
  label: string;
  prLabel: string;
  e1rmLabel: string;
  date?: string;
  hasData: boolean;
};

export type HistoryCalendarSummaryInput = {
  sessions?: TrainingSession[];
  selectedDate?: string;
  today?: string;
  month?: string;
  weekStartsOn?: 0 | 1;
  majorLiftNames?: Array<{ id: string; label: string }>;
  dataHealthIssueCount?: number;
  prEvents?: Array<{ date: string; exerciseId?: string }>;
  e1rmSummaries?: Array<{ date?: string; exerciseId: string }>;
  importedWorkouts?: ImportedWorkoutSample[];
  includeExternalWorkouts?: boolean;
};

export type HistoryCalendarSummaryResult = {
  calendarDays: HistoryCalendarDay[];
  selectedDaySummary: HistorySelectedDaySummary;
  thisWeekTrainingDays: number;
  thisMonthTrainingDays: number;
  recentFourWeekAverage: number;
  currentStreak?: number;
  trainedDaysCount: number;
  restDaysCount: number;
  prDaysCount: number;
  issueHintCount: number;
  prQuickAccessItems: HistoryPrQuickAccessItem[];
  recentSessions: TrainingSession[];
  dataHealthHint: string;
  sourceOfTruthChanged: false;
  trainingAlgorithmChanged: false;
};

const DEFAULT_MAJOR_LIFTS = [
  { id: 'bench-press', label: '卧推' },
  { id: 'squat', label: '深蹲' },
  { id: 'deadlift', label: '硬拉' },
  { id: 'romanian-deadlift', label: '罗马尼亚硬拉' },
  { id: 'barbell-row', label: '杠铃划船' },
  ...CORE_TREND_EXERCISES,
];

const isCountedTrainingSession = (session: TrainingSession) => {
  const flag = session.dataFlag || 'normal';
  return flag !== 'test' && flag !== 'excluded';
};

const uniqueById = (items: Array<{ id: string; label: string }>) => {
  const result = new Map<string, string>();
  items.forEach((item) => {
    if (item.id && !result.has(item.id)) result.set(item.id, item.label);
  });
  return [...result.entries()].map(([id, label]) => ({ id, label }));
};

const toDate = (dateKey: string) => new Date(`${dateKey}T00:00:00`);

const addDays = (dateKey: string, delta: number) => {
  const date = toDate(dateKey);
  if (Number.isNaN(date.getTime())) return dateKey;
  date.setDate(date.getDate() + delta);
  return date.toISOString().slice(0, 10);
};

const startOfWeek = (dateKey: string, weekStartsOn: 0 | 1) => {
  const date = toDate(dateKey);
  if (Number.isNaN(date.getTime())) return dateKey;
  const day = date.getDay();
  const offset = weekStartsOn === 1 ? (day === 0 ? -6 : 1 - day) : -day;
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
};

const countUniqueTrainingDaysInRange = (sessions: TrainingSession[], start: string, end: string) =>
  new Set(
    sessions
      .filter(isCountedTrainingSession)
      .map(getSessionCalendarDate)
      .filter((date) => date >= start && date <= end),
  ).size;

const currentStreakFrom = (trainedDates: Set<string>, today: string) => {
  if (!trainedDates.size) return 0;
  let cursor = trainedDates.has(today) ? today : [...trainedDates].sort((left, right) => right.localeCompare(left))[0];
  let streak = 0;
  while (cursor && trainedDates.has(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
};

const sessionTitle = (session: TrainingSession) =>
  session.templateId
    ? formatTemplateName(session.templateId, '未命名训练')
    : formatTemplateName(session.templateName || session.focus, '未命名训练');

const selectedDaySummary = (sessions: TrainingSession[], selectedDate: string): HistorySelectedDaySummary => {
  const selectedSessions = sessions.filter((session) => getSessionCalendarDate(session) === selectedDate);
  const summaries = selectedSessions.map((session) => buildSessionDetailSummary(session));
  const mainExercises = selectedSessions
    .flatMap((session) => (session.exercises || []).slice(0, 3).map((exercise) => formatExerciseName(exercise)))
    .filter(Boolean);
  const totalSets = summaries.reduce((sum, summary) => sum + summary.completedWorkingSets, 0);
  const totalEffectiveSets = summaries.reduce((sum, summary) => sum + summary.effectiveSets, 0);
  const totalVolume = summaries.reduce((sum, summary) => sum + summary.workingVolumeKg, 0);
  const issueCount = selectedSessions.filter((session) => session.dataFlag === 'test' || session.dataFlag === 'excluded').length;

  if (!selectedSessions.length) {
    return {
      date: selectedDate,
      trained: false,
      sessionTitles: [],
      mainExercises: [],
      emptyCopy: '这天没有训练记录。休息日也属于计划的一部分。',
    };
  }

  return {
    date: selectedDate,
    trained: true,
    sessionTitles: selectedSessions.map(sessionTitle),
    mainExercises: [...new Set(mainExercises)].slice(0, 6),
    totalSets,
    mainLiftSummary: `${totalSets} 组 · ${totalEffectiveSets} 有效组 · ${Math.round(totalVolume)}kg`,
    issueHint: issueCount ? `${issueCount} 条记录建议检查` : undefined,
  };
};

const buildQuickAccess = (sessions: TrainingSession[], configuredLifts?: Array<{ id: string; label: string }>) => {
  const prs = buildPrs(sessions);
  const liftOptions = uniqueById([...(configuredLifts || []), ...DEFAULT_MAJOR_LIFTS]);

  return liftOptions.slice(0, 8).map<HistoryPrQuickAccessItem>((lift) => {
    const exercisePrs = prs.filter((item) => item.exerciseId === lift.id);
    const bestPr = exercisePrs[0];
    const e1rm = buildE1RMProfile(sessions, lift.id);
    const estimate = e1rm.current || e1rm.best;
    return {
      exerciseId: lift.id,
      label: lift.label,
      prLabel: bestPr?.displayValue || '暂无正式记录',
      e1rmLabel: estimate ? `${Math.round(number(estimate.e1rmKg))}kg e1RM` : '暂无 e1RM',
      date: estimate?.sourceSet?.date || bestPr?.date,
      hasData: Boolean(bestPr || estimate),
    };
  });
};

export const buildHistoryCalendarSummary = ({
  sessions = [],
  selectedDate,
  today = todayKey(),
  month,
  weekStartsOn = 1,
  majorLiftNames,
  dataHealthIssueCount = 0,
  prEvents,
  e1rmSummaries,
  importedWorkouts,
  includeExternalWorkouts,
}: HistoryCalendarSummaryInput): HistoryCalendarSummaryResult => {
  const normalizedToday = toLocalDateKey(today) || todayKey();
  const normalizedSelectedDate = toLocalDateKey(selectedDate) || normalizedToday;
  const calendarMonth = month || normalizedSelectedDate.slice(0, 7);
  const calendar = buildTrainingCalendar(sessions, calendarMonth, {
    includeDataFlags: 'all',
    importedWorkouts,
    includeExternalWorkouts,
  });
  const countedTrainingDates = new Set(
    sessions
      .filter(isCountedTrainingSession)
      .map(getSessionCalendarDate)
      .filter(Boolean),
  );
  const prDates = new Set((prEvents || buildPrs(sessions)).map((item) => item.date).filter(Boolean));
  const e1rmDates = new Set((e1rmSummaries || []).map((item) => item.date).filter((date): date is string => Boolean(date)));

  const calendarDays = calendar.days.map<HistoryCalendarDay>((day) => {
    const countableSessions = day.sessions.filter((session) => {
      const flag: SessionDataFlag = session.dataFlag || 'normal';
      return flag !== 'test' && flag !== 'excluded';
    });
    const hasTraining = countableSessions.length > 0;
    return {
      date: day.date,
      isToday: day.date === normalizedToday,
      isSelected: day.date === normalizedSelectedDate,
      hasTraining,
      sessionCount: countableSessions.length,
      focusLabel: countableSessions[0]?.title,
      hasPr: prDates.has(day.date),
      hasE1rmChange: e1rmDates.has(day.date),
      hasIssueHint: day.hasPainFlags || day.sessions.some((session) => session.dataFlag === 'test' || session.dataFlag === 'excluded'),
      intensityLabel: hasTraining ? (countableSessions.length > 1 ? '多次训练' : '已训练') : '休息',
      displayLabel: String(Number(day.date.slice(-2))),
    };
  });

  const weekStart = startOfWeek(normalizedToday, weekStartsOn);
  const weekEnd = addDays(weekStart, 6);
  const fourWeekStart = addDays(weekStart, -21);
  const monthStart = `${calendarMonth}-01`;
  const monthEnd = calendar.days[calendar.days.length - 1]?.date || monthStart;
  const trainedDaysCount = calendarDays.filter((day) => day.hasTraining).length;
  const issueHintCount = Math.max(dataHealthIssueCount, calendarDays.filter((day) => day.hasIssueHint).length);

  return {
    calendarDays,
    selectedDaySummary: selectedDaySummary(sessions, normalizedSelectedDate),
    thisWeekTrainingDays: countUniqueTrainingDaysInRange(sessions, weekStart, weekEnd),
    thisMonthTrainingDays: countUniqueTrainingDaysInRange(sessions, monthStart, monthEnd),
    recentFourWeekAverage: countUniqueTrainingDaysInRange(sessions, fourWeekStart, weekEnd) / 4,
    currentStreak: currentStreakFrom(countedTrainingDates, normalizedToday),
    trainedDaysCount,
    restDaysCount: Math.max(0, calendarDays.length - trainedDaysCount),
    prDaysCount: calendarDays.filter((day) => day.hasPr || day.hasE1rmChange).length,
    issueHintCount,
    prQuickAccessItems: buildQuickAccess(sessions, majorLiftNames),
    recentSessions: listSessionHistory(sessions, 'normal').slice(0, 5),
    dataHealthHint: issueHintCount > 0 ? `有 ${issueHintCount} 条记录建议检查` : '没有明显异常',
    sourceOfTruthChanged: false,
    trainingAlgorithmChanged: false,
  };
};
