import type { TrainingSession } from '../models/training-model';

export interface TrainingStreakResult {
  currentWeekStreak: number;
  longestWeekStreak: number;
  currentMonthStreak: number;
  longestMonthStreak: number;
  totalAnalyticsSessions: number;
  lastActiveWeekKey?: string;
  reason: string;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const safeDate = (value?: string) => {
  if (!value) return null;
  const direct = value.match(/^\d{4}-\d{2}-\d{2}/);
  const iso = direct ? `${direct[0]}T12:00:00.000Z` : value;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
};

const isAnalyticsSession = (session: TrainingSession) =>
  session.completed !== false && session.dataFlag !== 'test' && session.dataFlag !== 'excluded';

const startOfWeekUtc = (timestamp: number, weekStartDow: number): number => {
  const date = new Date(timestamp);
  const day = date.getUTCDay();
  const diff = (day - weekStartDow + 7) % 7;
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - diff * MS_PER_DAY;
};

const weekKey = (timestamp: number, weekStartDow: number): string => {
  const ms = startOfWeekUtc(timestamp, weekStartDow);
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
};

const monthKey = (timestamp: number): string => {
  const d = new Date(timestamp);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
};

const computeRunLength = (
  currentKey: string,
  sortedKeys: string[],
  previousKey: (key: string) => string,
): { current: number; longest: number; lastActiveKey?: string } => {
  if (!sortedKeys.length) return { current: 0, longest: 0 };
  const set = new Set(sortedKeys);
  const lastActiveKey = sortedKeys[sortedKeys.length - 1];

  // current streak: walk backward from currentKey while keys exist.
  let current = 0;
  let cursor = currentKey;
  while (set.has(cursor)) {
    current += 1;
    cursor = previousKey(cursor);
  }

  // longest streak: walk sortedKeys (ascending) and detect consecutive runs.
  let longest = 0;
  let run = 0;
  for (let i = 0; i < sortedKeys.length; i += 1) {
    if (i === 0) {
      run = 1;
    } else {
      const expected = previousKey(sortedKeys[i]); // previous of current must equal previous key
      run = sortedKeys[i - 1] === expected ? run + 1 : 1;
    }
    if (run > longest) longest = run;
  }

  return { current, longest, lastActiveKey };
};

const prevWeekKey = (key: string, weekStartDow: number): string => {
  const ms = Date.parse(`${key}T12:00:00.000Z`);
  return weekKey(ms - 7 * MS_PER_DAY, weekStartDow);
};

const prevMonthKey = (key: string): string => {
  const [year, month] = key.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 2, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
};

export interface TrainingStreakOptions {
  nowIso?: string;
  weekStartDayOfWeek?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
}

export const computeTrainingStreak = (
  history: TrainingSession[] = [],
  options: TrainingStreakOptions = {},
): TrainingStreakResult => {
  const nowIso = options.nowIso || new Date().toISOString();
  const nowMs = safeDate(nowIso) ?? Date.now();
  const weekStartDow = options.weekStartDayOfWeek ?? 1;

  const weekKeys = new Set<string>();
  const monthKeys = new Set<string>();
  let total = 0;

  for (const session of history) {
    if (!isAnalyticsSession(session)) continue;
    const ts = safeDate(session.finishedAt) ?? safeDate(session.startedAt) ?? safeDate(session.date);
    if (ts === null) continue;
    weekKeys.add(weekKey(ts, weekStartDow));
    monthKeys.add(monthKey(ts));
    total += 1;
  }

  const sortedWeeks = [...weekKeys].sort();
  const sortedMonths = [...monthKeys].sort();
  const currentWeek = weekKey(nowMs, weekStartDow);
  const currentMonth = monthKey(nowMs);

  const weekRun = computeRunLength(currentWeek, sortedWeeks, (key) => prevWeekKey(key, weekStartDow));
  const monthRun = computeRunLength(currentMonth, sortedMonths, prevMonthKey);

  // current streak interpretation: if the user hasn't trained THIS week yet,
  // we still want to keep the streak alive if they trained last week. So
  // check from `currentWeek` AND from `prevWeekKey(currentWeek)`.
  let currentWeekStreak = weekRun.current;
  if (currentWeekStreak === 0 && weekKeys.has(prevWeekKey(currentWeek, weekStartDow))) {
    let cursor = prevWeekKey(currentWeek, weekStartDow);
    while (weekKeys.has(cursor)) {
      currentWeekStreak += 1;
      cursor = prevWeekKey(cursor, weekStartDow);
    }
  }

  let currentMonthStreak = monthRun.current;
  if (currentMonthStreak === 0 && monthKeys.has(prevMonthKey(currentMonth))) {
    let cursor = prevMonthKey(currentMonth);
    while (monthKeys.has(cursor)) {
      currentMonthStreak += 1;
      cursor = prevMonthKey(cursor);
    }
  }

  const reason = total === 0
    ? '尚无训练记录，开始第一次训练就会建立连续记录。'
    : currentWeekStreak === 0
      ? `连续训练已中断（最近一次：${sortedWeeks[sortedWeeks.length - 1] ?? '未知'} 周）。`
      : `当前已连续训练 ${currentWeekStreak} 周；历史最长 ${weekRun.longest} 周。`;

  return {
    currentWeekStreak,
    longestWeekStreak: weekRun.longest,
    currentMonthStreak,
    longestMonthStreak: monthRun.longest,
    totalAnalyticsSessions: total,
    lastActiveWeekKey: sortedWeeks[sortedWeeks.length - 1],
    reason,
  };
};
