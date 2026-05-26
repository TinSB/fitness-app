import type { TrainingSession } from '../models/training-model';
import { completedSets, getPrimaryMuscles, number, setVolume } from './engineUtils';

export interface MuscleBalanceEntry {
  muscle: string;
  effectiveSets: number;
  estimatedVolumeKg: number;
  share: number;
}

export interface WeeklyMuscleBalance {
  weekStartKey: string;
  totalEffectiveSets: number;
  totalEstimatedVolumeKg: number;
  entries: MuscleBalanceEntry[];
  overworkedMuscles: string[];
  underworkedMuscles: string[];
  balanceScore: number; // 0..100
  headline: string;
}

export interface WeeklyMuscleBalanceOptions {
  nowIso?: string;
  weekStartDayOfWeek?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  focusMuscles?: string[];
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

const DEFAULT_FOCUS_MUSCLES = ['胸', '背', '腿', '肩', '手臂', '核心'];

export const computeWeeklyMuscleBalance = (
  history: TrainingSession[] = [],
  options: WeeklyMuscleBalanceOptions = {},
): WeeklyMuscleBalance => {
  const nowIso = options.nowIso || new Date().toISOString();
  const nowMs = safeDate(nowIso) ?? Date.now();
  const weekStartDow = options.weekStartDayOfWeek ?? 1;
  const weekStartMs = startOfWeekUtc(nowMs, weekStartDow);
  const weekStartKey = weekKey(nowMs, weekStartDow);
  const focusMuscles = options.focusMuscles?.length ? options.focusMuscles : DEFAULT_FOCUS_MUSCLES;

  const effectiveSetsByMuscle = new Map<string, number>();
  const volumeByMuscle = new Map<string, number>();

  for (const session of history) {
    if (!isAnalyticsSession(session)) continue;
    const ts = safeDate(session.finishedAt) ?? safeDate(session.startedAt) ?? safeDate(session.date);
    if (ts === null || ts < weekStartMs || ts > nowMs) continue;

    for (const exercise of session.exercises || []) {
      const sets = completedSets(exercise);
      if (!sets.length) continue;
      const primaryMuscles = getPrimaryMuscles(exercise);
      const contribution = (exercise as { muscleContribution?: Record<string, number> }).muscleContribution;
      const allocations: Array<[string, number]> = [];
      if (contribution && Object.keys(contribution).length) {
        Object.entries(contribution).forEach(([muscle, weight]) => {
          if (!muscle) return;
          const value = number(weight);
          if (value > 0) allocations.push([muscle, value]);
        });
      } else {
        primaryMuscles.forEach((muscle, index) => {
          if (!muscle) return;
          allocations.push([muscle, index === 0 ? 1 : 0.5]);
        });
      }
      if (!allocations.length) continue;

      const setVolumeTotal = sets.reduce((sum, set) => sum + setVolume(set), 0);
      const effectiveSetCount = sets.length;
      allocations.forEach(([muscle, weight]) => {
        effectiveSetsByMuscle.set(muscle, (effectiveSetsByMuscle.get(muscle) || 0) + effectiveSetCount * weight);
        volumeByMuscle.set(muscle, (volumeByMuscle.get(muscle) || 0) + setVolumeTotal * weight);
      });
    }
  }

  const allMuscles = Array.from(new Set([...focusMuscles, ...effectiveSetsByMuscle.keys()]));
  const totalEffectiveSets = Array.from(effectiveSetsByMuscle.values()).reduce((sum, value) => sum + value, 0);
  const totalVolume = Array.from(volumeByMuscle.values()).reduce((sum, value) => sum + value, 0);
  const entries: MuscleBalanceEntry[] = allMuscles
    .map((muscle) => {
      const effectiveSets = Number((effectiveSetsByMuscle.get(muscle) || 0).toFixed(2));
      const volume = Math.round(volumeByMuscle.get(muscle) || 0);
      const share = totalEffectiveSets > 0 ? Number(((effectiveSets / totalEffectiveSets) * 100).toFixed(1)) : 0;
      return { muscle, effectiveSets, estimatedVolumeKg: volume, share };
    })
    .filter((entry) => focusMuscles.includes(entry.muscle) || entry.effectiveSets > 0)
    .sort((left, right) => right.effectiveSets - left.effectiveSets);

  const focusEntries = entries.filter((entry) => focusMuscles.includes(entry.muscle));
  let balanceScore = 100;
  let overworked: string[] = [];
  let underworked: string[] = [];

  if (focusEntries.length >= 2 && totalEffectiveSets > 0) {
    const targetShare = 100 / focusEntries.length;
    const deviations = focusEntries.map((entry) => entry.share - targetShare);
    const maxDeviation = Math.max(...deviations.map(Math.abs));
    balanceScore = Math.max(0, Math.round(100 - maxDeviation * 2));
    overworked = focusEntries.filter((entry) => entry.share - targetShare >= 12).map((entry) => entry.muscle);
    underworked = focusEntries.filter((entry, index) => deviations[index] <= -12 || entry.effectiveSets === 0).map((entry) => entry.muscle);
  } else if (totalEffectiveSets === 0) {
    balanceScore = 0;
  }

  const headline = totalEffectiveSets === 0
    ? '本周尚无训练数据，平衡评分不可用。'
    : overworked.length || underworked.length
      ? `本周肌群平衡：${overworked.length ? `${overworked.join(' / ')} 偏多` : ''}${overworked.length && underworked.length ? '，' : ''}${underworked.length ? `${underworked.join(' / ')} 偏少` : ''}。`
      : '本周肌群训练量分布均衡。';

  return {
    weekStartKey,
    totalEffectiveSets: Number(totalEffectiveSets.toFixed(2)),
    totalEstimatedVolumeKg: Math.round(totalVolume),
    entries,
    overworkedMuscles: overworked,
    underworkedMuscles: underworked,
    balanceScore,
    headline,
  };
};
