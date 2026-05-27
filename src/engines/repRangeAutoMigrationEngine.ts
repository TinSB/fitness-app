import type { TrainingSession, TrainingSetLog } from '../models/training-model';
import { number } from './engineUtils';
import { getExerciseRecordPoolId } from './e1rmEngine';

// Feature #3: When the user's 4-week e1RM growth on a given exercise slips
// below 1 %, the current rep range has likely run out of room. Propose a
// step down to the next intensity range so the user spends time at heavier
// loads / fewer reps. The recommendation is conservative — it only fires
// when the trend is consistently flat AND the user is hitting the top of
// the existing range.
//
// Ranges form a ladder (loose → tight). Migrating down means moving from
// e.g. 12-15 → 10-12, then 8-10, etc. Migrating up (loosening the range)
// is intentionally not handled here — that decision belongs to a separate
// "user wants more hypertrophy" trigger.

const epley = (weightKg: number, reps: number) => weightKg * (1 + reps / 30);
const MIN_SESSIONS = 4;
const WINDOW_WEEKS = 4;
const STALL_GROWTH_THRESHOLD_PCT = 1;

const RANGE_LADDER: ReadonlyArray<[number, number]> = [
  [15, 20],
  [12, 15],
  [10, 12],
  [8, 12],
  [6, 10],
  [5, 8],
  [3, 6],
  [1, 5],
];

export type RepRangeMigrationInput = {
  history: TrainingSession[];
  exerciseId: string;
  baseExerciseId?: string;
  currentRepMin: number;
  currentRepMax: number;
  asOfDate?: string;
  windowWeeks?: number;
};

export type RepRangeMigrationResult = {
  shouldMigrate: boolean;
  recommendedRepMin: number | null;
  recommendedRepMax: number | null;
  rationale:
    | 'insufficient_history'
    | 'growth_within_limits'
    | 'range_floor_reached'
    | 'top_of_range_not_hit'
    | 'stall_detected';
  metrics: {
    sessionsAnalyzed: number;
    e1rmGrowthPct: number;
    hitTopOfRangeRatio: number;
  };
};

const findNextRange = (currentMin: number, currentMax: number) => {
  const idx = RANGE_LADDER.findIndex(([min, max]) => min === currentMin && max === currentMax);
  if (idx < 0) {
    // Default heuristic: drop both bounds by ~2 reps, clamp at 1.
    const nextMin = Math.max(1, currentMin - 2);
    const nextMax = Math.max(nextMin + 2, currentMax - 2);
    return [nextMin, nextMax] as const;
  }
  if (idx === RANGE_LADDER.length - 1) return null;
  return RANGE_LADDER[idx + 1];
};

const isWorkSet = (set: TrainingSetLog) =>
  set.type !== 'warmup' &&
  number(set.weight) > 0 &&
  number(set.reps) > 0 &&
  set.completionStatus !== 'draft';

export const buildRepRangeMigration = (
  input: RepRangeMigrationInput,
): RepRangeMigrationResult => {
  const window = Math.max(2, input.windowWeeks ?? WINDOW_WEEKS);
  const asOf = input.asOfDate ? new Date(input.asOfDate) : new Date();
  const windowStart = new Date(asOf.getTime() - window * 7 * 24 * 60 * 60 * 1000);
  const targetIds = new Set([input.exerciseId, input.baseExerciseId].filter(Boolean) as string[]);

  const samples: { date: string; e1rmKg: number; hitTop: boolean }[] = [];
  for (const session of input.history) {
    if (!session?.date) continue;
    const sessionDate = new Date(session.date);
    if (Number.isNaN(sessionDate.getTime())) continue;
    if (sessionDate < windowStart || sessionDate > asOf) continue;
    for (const exercise of session.exercises ?? []) {
      const poolId = getExerciseRecordPoolId(exercise);
      if (!targetIds.has(exercise.id) && (!poolId || !targetIds.has(poolId))) continue;
      const sets = (exercise.sets as TrainingSetLog[] | undefined)?.filter(isWorkSet) ?? [];
      if (!sets.length) continue;
      const top = sets.reduce((max, s) => Math.max(max, epley(number(s.weight), number(s.reps))), 0);
      const hitTop = sets.some((s) => number(s.reps) >= input.currentRepMax);
      samples.push({ date: session.date, e1rmKg: top, hitTop });
    }
  }

  if (samples.length < MIN_SESSIONS) {
    return {
      shouldMigrate: false,
      recommendedRepMin: null,
      recommendedRepMax: null,
      rationale: 'insufficient_history',
      metrics: { sessionsAnalyzed: samples.length, e1rmGrowthPct: 0, hitTopOfRangeRatio: 0 },
    };
  }

  samples.sort((a, b) => a.date.localeCompare(b.date));
  const baseline = samples[0].e1rmKg;
  const recent = samples[samples.length - 1].e1rmKg;
  const growthPct = baseline > 0 ? ((recent - baseline) / baseline) * 100 : 0;
  const hitTopRatio = samples.filter((s) => s.hitTop).length / samples.length;

  if (growthPct >= STALL_GROWTH_THRESHOLD_PCT) {
    return {
      shouldMigrate: false,
      recommendedRepMin: null,
      recommendedRepMax: null,
      rationale: 'growth_within_limits',
      metrics: { sessionsAnalyzed: samples.length, e1rmGrowthPct: Math.round(growthPct * 10) / 10, hitTopOfRangeRatio: hitTopRatio },
    };
  }
  if (hitTopRatio < 0.5) {
    return {
      shouldMigrate: false,
      recommendedRepMin: null,
      recommendedRepMax: null,
      rationale: 'top_of_range_not_hit',
      metrics: { sessionsAnalyzed: samples.length, e1rmGrowthPct: Math.round(growthPct * 10) / 10, hitTopOfRangeRatio: hitTopRatio },
    };
  }

  const next = findNextRange(input.currentRepMin, input.currentRepMax);
  if (!next) {
    return {
      shouldMigrate: false,
      recommendedRepMin: null,
      recommendedRepMax: null,
      rationale: 'range_floor_reached',
      metrics: { sessionsAnalyzed: samples.length, e1rmGrowthPct: Math.round(growthPct * 10) / 10, hitTopOfRangeRatio: hitTopRatio },
    };
  }

  return {
    shouldMigrate: true,
    recommendedRepMin: next[0],
    recommendedRepMax: next[1],
    rationale: 'stall_detected',
    metrics: {
      sessionsAnalyzed: samples.length,
      e1rmGrowthPct: Math.round(growthPct * 10) / 10,
      hitTopOfRangeRatio: Math.round(hitTopRatio * 100) / 100,
    },
  };
};
