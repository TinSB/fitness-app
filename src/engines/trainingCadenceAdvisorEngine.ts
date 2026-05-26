import type { TrainingSession, UserProfile } from '../models/training-model';
import { buildTrainingLapseSignal } from './trainingLapseEngine';

export type CadenceAdvice = 'rebuild' | 'maintain' | 'extend';

export interface CadenceAdvisorOptions {
  nowIso?: string;
  weekStartDayOfWeek?: 0 | 1 | 2 | 3 | 4 | 5 | 6; // default Monday=1
}

export interface CadenceAdvisor {
  targetSessionsPerWeek: number;
  baselineSessionsPerWeek: number;
  sessionsCompletedThisWeek: number;
  remainingThisWeek: number;
  advice: CadenceAdvice;
  reason: string;
  cap?: number;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const safeDate = (value?: string) => {
  if (!value) return null;
  const direct = value.match(/^\d{4}-\d{2}-\d{2}/);
  const iso = direct ? `${direct[0]}T12:00:00.000Z` : value;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
};

const startOfWeekUtc = (timestamp: number, weekStartDow: number): number => {
  const date = new Date(timestamp);
  const day = date.getUTCDay();
  const diff = (day - weekStartDow + 7) % 7;
  const startMs = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - diff * MS_PER_DAY;
  return startMs;
};

const isAnalyticsSession = (session: TrainingSession) =>
  session.completed !== false && session.dataFlag !== 'test' && session.dataFlag !== 'excluded';

const countSessionsInWeek = (history: TrainingSession[], weekStartMs: number, nowMs: number): number => {
  let count = 0;
  for (const session of history) {
    if (!isAnalyticsSession(session)) continue;
    const ts = safeDate(session.finishedAt) ?? safeDate(session.startedAt) ?? safeDate(session.date);
    if (ts === null) continue;
    if (ts >= weekStartMs && ts <= nowMs) count += 1;
  }
  return count;
};

export const recommendWeeklyCadence = (
  profile: UserProfile | undefined,
  history: TrainingSession[] = [],
  options: CadenceAdvisorOptions = {},
): CadenceAdvisor => {
  const baseline = Math.max(1, Math.min(7, Number(profile?.weeklyTrainingDays) || 3));
  const nowIso = options.nowIso || new Date().toISOString();
  const nowMs = safeDate(nowIso) ?? Date.now();
  const weekStartDow = options.weekStartDayOfWeek ?? 1;
  const weekStartMs = startOfWeekUtc(nowMs, weekStartDow);
  const sessionsCompletedThisWeek = countSessionsInWeek(history, weekStartMs, nowMs);

  const lapse = buildTrainingLapseSignal(history, nowIso);

  let target = baseline;
  let advice: CadenceAdvice = 'maintain';
  let reason = `按设定的每周 ${baseline} 次维持节奏。`;
  let cap: number | undefined;

  if (!lapse.hasHistory) {
    target = Math.min(baseline, 2);
    advice = 'rebuild';
    reason = '尚无训练历史，本周先从 1-2 次开始建立基线。';
    cap = 2;
  } else if (lapse.stage === 'dormant') {
    target = Math.min(baseline, 2);
    advice = 'rebuild';
    reason = `距离上次训练 ${lapse.daysSinceLastSession} 天，本周先恢复 1-2 次轻松训练。`;
    cap = 2;
  } else if (lapse.stage === 'long_lapsed') {
    target = Math.min(baseline, 3);
    advice = 'rebuild';
    reason = `距离上次训练 ${lapse.daysSinceLastSession} 天，本周建议先回到 2-3 次，避免一次塞太多。`;
    cap = 3;
  } else if (lapse.stage === 'lapsed') {
    target = Math.max(2, baseline - 1);
    advice = 'rebuild';
    reason = `距离上次训练 ${lapse.daysSinceLastSession} 天，本周比常规少 1 次，把节奏先稳住。`;
  } else if (sessionsCompletedThisWeek >= baseline) {
    target = baseline;
    advice = 'extend';
    reason = `本周已完成 ${sessionsCompletedThisWeek} 次，达到目标；如果状态好可以再补 1 次低强度。`;
  } else if (sessionsCompletedThisWeek === 0) {
    target = baseline;
    advice = 'maintain';
    reason = `本周尚未训练，按目标完成 ${baseline} 次。`;
  } else {
    target = baseline;
    advice = 'maintain';
    reason = `本周已完成 ${sessionsCompletedThisWeek} / ${baseline} 次。`;
  }

  const remaining = Math.max(0, target - sessionsCompletedThisWeek);
  return {
    targetSessionsPerWeek: target,
    baselineSessionsPerWeek: baseline,
    sessionsCompletedThisWeek,
    remainingThisWeek: remaining,
    advice,
    reason,
    cap,
  };
};
