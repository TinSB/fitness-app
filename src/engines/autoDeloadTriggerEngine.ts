import type { TrainingSession, TrainingSetLog } from '../models/training-model';
import { number } from './engineUtils';

// Feature #19: When the user has shipped a positive e1RM PR in each of the
// last 4 weeks AND their composite fatigue score is in the upper bucket
// (≥ 80 / 100), propose that next week be a deload. This is the
// "auto-Deload" trigger that ProfileView surfaces as a chip with a single
// "采用 Deload 周" action.
//
// The deload itself is built by adaptiveFeedbackEngine.buildAdaptiveDeloadDecision;
// this engine is the *gate* — it tells the UI whether to surface the
// affordance at all.

const epley = (weightKg: number, reps: number) => weightKg * (1 + reps / 30);
const WEEKS_REQUIRED = 4;
const FATIGUE_THRESHOLD = 80;

export type AutoDeloadTriggerInput = {
  history: TrainingSession[];
  fatigueScore0to100: number;
  asOfDate?: string;
};

export type AutoDeloadTriggerResult = {
  shouldProposeDeload: boolean;
  consecutiveWeeklyPrs: number;
  fatigueScore: number;
  rationale:
    | 'pr_streak_short'
    | 'fatigue_below_threshold'
    | 'insufficient_history'
    | 'streak_and_fatigue_triggered';
};

type WeekBucket = {
  weekKey: string;
  topE1rmKg: number;
};

const weekKey = (date: string) => {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  const dayMs = 24 * 60 * 60 * 1000;
  const sinceEpoch = Math.floor(d.getTime() / dayMs);
  const weekIndex = Math.floor(sinceEpoch / 7);
  return `w${weekIndex}`;
};

const isWorkSet = (set: TrainingSetLog) =>
  set.type !== 'warmup' &&
  number(set.weight) > 0 &&
  number(set.reps) > 0 &&
  set.completionStatus !== 'draft';

export const buildAutoDeloadTrigger = (
  input: AutoDeloadTriggerInput,
): AutoDeloadTriggerResult => {
  const asOf = input.asOfDate ? new Date(input.asOfDate) : new Date();
  if (Number.isNaN(asOf.getTime())) {
    return {
      shouldProposeDeload: false,
      consecutiveWeeklyPrs: 0,
      fatigueScore: input.fatigueScore0to100,
      rationale: 'insufficient_history',
    };
  }
  const windowStart = new Date(asOf.getTime() - (WEEKS_REQUIRED + 2) * 7 * 24 * 60 * 60 * 1000);

  const buckets = new Map<string, WeekBucket>();
  for (const session of input.history) {
    if (!session?.date) continue;
    const sessionDate = new Date(session.date);
    if (Number.isNaN(sessionDate.getTime())) continue;
    if (sessionDate < windowStart || sessionDate > asOf) continue;
    const key = weekKey(session.date);
    if (!key) continue;
    let top = 0;
    for (const exercise of session.exercises ?? []) {
      for (const set of (exercise.sets as TrainingSetLog[] | undefined) ?? []) {
        if (!isWorkSet(set)) continue;
        top = Math.max(top, epley(number(set.weight), number(set.reps)));
      }
    }
    if (top <= 0) continue;
    const existing = buckets.get(key);
    if (!existing || existing.topE1rmKg < top) {
      buckets.set(key, { weekKey: key, topE1rmKg: top });
    }
  }

  if (buckets.size < WEEKS_REQUIRED) {
    return {
      shouldProposeDeload: false,
      consecutiveWeeklyPrs: 0,
      fatigueScore: input.fatigueScore0to100,
      rationale: 'insufficient_history',
    };
  }

  const sorted = [...buckets.values()].sort((a, b) => a.weekKey.localeCompare(b.weekKey));
  const recent = sorted.slice(-WEEKS_REQUIRED);
  let streak = 0;
  for (let i = 1; i < recent.length; i += 1) {
    if (recent[i].topE1rmKg > recent[i - 1].topE1rmKg) streak += 1;
    else streak = 0;
  }
  // A run of 4 weeks where weeks 2/3/4 each beat the previous week => streak 3.
  // We require all the latest WEEKS_REQUIRED - 1 deltas to be positive.
  const allPositive = recent.slice(1).every((w, idx) => w.topE1rmKg > recent[idx].topE1rmKg);

  const consecutive = allPositive ? recent.length : streak;
  if (!allPositive) {
    return {
      shouldProposeDeload: false,
      consecutiveWeeklyPrs: consecutive,
      fatigueScore: input.fatigueScore0to100,
      rationale: 'pr_streak_short',
    };
  }
  if (input.fatigueScore0to100 < FATIGUE_THRESHOLD) {
    return {
      shouldProposeDeload: false,
      consecutiveWeeklyPrs: consecutive,
      fatigueScore: input.fatigueScore0to100,
      rationale: 'fatigue_below_threshold',
    };
  }

  return {
    shouldProposeDeload: true,
    consecutiveWeeklyPrs: consecutive,
    fatigueScore: input.fatigueScore0to100,
    rationale: 'streak_and_fatigue_triggered',
  };
};
