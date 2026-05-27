import type { MuscleGroup, TrainingSession, TrainingSetLog } from '../models/training-model';
import { number } from './engineUtils';

// Feature #22: Suggest a ±1 weekly frequency change per muscle group when
// observed weekly volume drifts outside the user's target band. The engine
// is conservative — it only fires when the last 4 weeks consistently sit
// below the floor or above the ceiling, and never proposes more than one
// step per call so the user is not pushed from 2x → 4x in a single
// recommendation.

const PER_MUSCLE_VOLUME_FLOOR_SETS = 10;
const PER_MUSCLE_VOLUME_CEILING_SETS = 22;
const WINDOW_WEEKS = 4;
const REQUIRED_STREAK = 3;

export type WeeklyMuscleVolume = {
  weekKey: string;
  muscleSets: Record<MuscleGroup, number>;
};

export type MuscleFrequencyAdjustmentInput = {
  history: TrainingSession[];
  currentFrequencyByMuscle: Partial<Record<MuscleGroup, number>>;
  asOfDate?: string;
  windowWeeks?: number;
};

export type MuscleFrequencyAdjustmentEntry = {
  muscle: MuscleGroup;
  currentFrequencyPerWeek: number;
  recommendedFrequencyPerWeek: number;
  delta: -1 | 0 | 1;
  reason:
    | 'volume_floor_breached'
    | 'volume_ceiling_breached'
    | 'within_band'
    | 'insufficient_history';
};

export type MuscleFrequencyAdjustmentResult = {
  entries: MuscleFrequencyAdjustmentEntry[];
  weeklyVolume: WeeklyMuscleVolume[];
};

const weekKeyOf = (date: string) => {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  const sinceEpoch = Math.floor(d.getTime() / (24 * 60 * 60 * 1000));
  return `w${Math.floor(sinceEpoch / 7)}`;
};

const isWorkSet = (set: TrainingSetLog) =>
  set.type !== 'warmup' && number(set.weight) > 0 && number(set.reps) > 0;

export const buildMuscleFrequencyAdjustment = (
  input: MuscleFrequencyAdjustmentInput,
): MuscleFrequencyAdjustmentResult => {
  const window = Math.max(2, input.windowWeeks ?? WINDOW_WEEKS);
  const asOf = input.asOfDate ? new Date(input.asOfDate) : new Date();
  if (Number.isNaN(asOf.getTime())) {
    return { entries: [], weeklyVolume: [] };
  }
  const windowStart = new Date(asOf.getTime() - window * 7 * 24 * 60 * 60 * 1000);

  const weekly: Map<string, Record<MuscleGroup, number>> = new Map();
  for (const session of input.history) {
    if (!session?.date) continue;
    const sessionDate = new Date(session.date);
    if (Number.isNaN(sessionDate.getTime())) continue;
    if (sessionDate < windowStart || sessionDate > asOf) continue;
    const key = weekKeyOf(session.date);
    if (!key) continue;
    const bucket = weekly.get(key) ?? ({} as Record<MuscleGroup, number>);
    for (const exercise of session.exercises ?? []) {
      const muscle = exercise.muscle as MuscleGroup | undefined;
      if (!muscle) continue;
      const sets = (exercise.sets as TrainingSetLog[] | undefined)?.filter(isWorkSet) ?? [];
      if (!sets.length) continue;
      bucket[muscle] = (bucket[muscle] ?? 0) + sets.length;
    }
    weekly.set(key, bucket);
  }

  const weeklyVolume: WeeklyMuscleVolume[] = [...weekly.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([weekKey, muscleSets]) => ({ weekKey, muscleSets }));

  const muscles: MuscleGroup[] = ['胸', '背', '腿', '肩', '手臂'];
  const entries: MuscleFrequencyAdjustmentEntry[] = [];

  for (const muscle of muscles) {
    const currentFreq = input.currentFrequencyByMuscle[muscle] ?? 0;
    const observed = weeklyVolume.map((w) => w.muscleSets[muscle] ?? 0);
    if (observed.length < REQUIRED_STREAK) {
      entries.push({
        muscle,
        currentFrequencyPerWeek: currentFreq,
        recommendedFrequencyPerWeek: currentFreq,
        delta: 0,
        reason: 'insufficient_history',
      });
      continue;
    }
    const recent = observed.slice(-REQUIRED_STREAK);
    const consistentlyLow = recent.every((v) => v < PER_MUSCLE_VOLUME_FLOOR_SETS);
    const consistentlyHigh = recent.every((v) => v > PER_MUSCLE_VOLUME_CEILING_SETS);

    if (consistentlyLow && currentFreq < 5) {
      entries.push({
        muscle,
        currentFrequencyPerWeek: currentFreq,
        recommendedFrequencyPerWeek: currentFreq + 1,
        delta: 1,
        reason: 'volume_floor_breached',
      });
    } else if (consistentlyHigh && currentFreq > 1) {
      entries.push({
        muscle,
        currentFrequencyPerWeek: currentFreq,
        recommendedFrequencyPerWeek: currentFreq - 1,
        delta: -1,
        reason: 'volume_ceiling_breached',
      });
    } else {
      entries.push({
        muscle,
        currentFrequencyPerWeek: currentFreq,
        recommendedFrequencyPerWeek: currentFreq,
        delta: 0,
        reason: 'within_band',
      });
    }
  }

  return { entries, weeklyVolume };
};
