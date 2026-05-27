import type { TrainingSession, TrainingSetLog } from '../models/training-model';
import { number, clamp } from './engineUtils';
import { getExerciseRecordPoolId } from './e1rmEngine';

// Feature #1: Fine-tune the recommended weight for the next set by fitting a
// linear trend through the recent e1RM history for the same exercise within
// the same target rep range. Output a 2.5 kg-rounded weight that, given the
// projected e1RM, lands the target rep count somewhere inside [repMin, repMax].
//
// This is a pure helper consumed by progressionRulesEngine; it is intentionally
// conservative — when the data is too sparse or noisy we hand back the most
// recent working weight unchanged so callers can keep their old behaviour.

const PLATE_KG = 2.5;
const MIN_SAMPLES = 3;
const DEFAULT_WINDOW_WEEKS = 8;
const MAX_WEEKLY_GROWTH = 0.04;

const epley = (weightKg: number, reps: number) => weightKg * (1 + reps / 30);
const roundToPlate = (value: number) => Math.round(value / PLATE_KG) * PLATE_KG;
const parseRir = (value: unknown) => {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

export type SetWeightFineTuneInput = {
  history: TrainingSession[];
  exerciseId: string;
  baseExerciseId?: string;
  targetReps: number;
  repMin: number;
  repMax: number;
  windowWeeks?: number;
  asOfDate?: string;
};

export type SetWeightFineTuneResult = {
  suggestedWeightKg: number;
  basis: {
    samplesUsed: number;
    windowWeeks: number;
    currentE1rmKg: number | null;
    projectedE1rmKg: number | null;
    weeklySlopeKg: number;
    fallbackReason?: 'insufficient_history' | 'rep_range_invalid' | 'noisy_trend';
  };
};

type Sample = {
  date: string;
  weekIndex: number;
  e1rmKg: number;
  weight: number;
  reps: number;
};

const matchesExercise = (
  exercise: TrainingSession['exercises'][number],
  targetIds: ReadonlySet<string>,
) => {
  if (targetIds.has(exercise.id)) return true;
  const poolId = getExerciseRecordPoolId(exercise);
  return poolId ? targetIds.has(poolId) : false;
};

const isWorkSet = (set: TrainingSetLog) =>
  set.type !== 'warmup' &&
  number(set.weight) > 0 &&
  number(set.reps) > 0 &&
  set.completionStatus !== 'draft';

const linearSlope = (samples: Sample[]) => {
  if (samples.length < 2) return 0;
  const n = samples.length;
  const meanX = samples.reduce((sum, s) => sum + s.weekIndex, 0) / n;
  const meanY = samples.reduce((sum, s) => sum + s.e1rmKg, 0) / n;
  let num = 0;
  let den = 0;
  for (const s of samples) {
    num += (s.weekIndex - meanX) * (s.e1rmKg - meanY);
    den += (s.weekIndex - meanX) ** 2;
  }
  return den === 0 ? 0 : num / den;
};

const dateToWeekIndex = (date: string, anchor: Date) => {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return 0;
  const diffMs = d.getTime() - anchor.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24 * 7));
};

export const buildSetWeightFineTune = (
  input: SetWeightFineTuneInput,
): SetWeightFineTuneResult => {
  const window = Math.max(2, input.windowWeeks ?? DEFAULT_WINDOW_WEEKS);
  const repMin = Math.max(1, input.repMin);
  const repMax = Math.max(repMin, input.repMax);
  const target = clamp(input.targetReps, repMin, repMax);
  const targetIds = new Set([input.exerciseId, input.baseExerciseId].filter(Boolean) as string[]);

  const fallback: SetWeightFineTuneResult = {
    suggestedWeightKg: 0,
    basis: {
      samplesUsed: 0,
      windowWeeks: window,
      currentE1rmKg: null,
      projectedE1rmKg: null,
      weeklySlopeKg: 0,
      fallbackReason: 'insufficient_history',
    },
  };

  if (repMax < repMin) {
    return { ...fallback, basis: { ...fallback.basis, fallbackReason: 'rep_range_invalid' } };
  }

  const asOf = input.asOfDate ? new Date(input.asOfDate) : new Date();
  if (Number.isNaN(asOf.getTime())) return fallback;
  const windowStart = new Date(asOf.getTime() - window * 7 * 24 * 60 * 60 * 1000);

  const samples: Sample[] = [];
  for (const session of input.history) {
    if (!session?.date) continue;
    const sessionDate = new Date(session.date);
    if (Number.isNaN(sessionDate.getTime())) continue;
    if (sessionDate < windowStart || sessionDate > asOf) continue;
    for (const exercise of session.exercises ?? []) {
      if (!matchesExercise(exercise, targetIds)) continue;
      if (!Array.isArray(exercise.sets)) continue;
      for (const set of exercise.sets as TrainingSetLog[]) {
        if (!isWorkSet(set)) continue;
        const reps = number(set.reps);
        if (reps < repMin - 2 || reps > repMax + 2) continue;
        const rir = parseRir(set.rir);
        if (rir !== undefined && rir > 4) continue;
        const weight = number(set.weight);
        const e1rmKg = epley(weight, reps);
        if (!Number.isFinite(e1rmKg) || e1rmKg <= 0) continue;
        samples.push({
          date: session.date,
          weekIndex: dateToWeekIndex(session.date, windowStart),
          e1rmKg,
          weight,
          reps,
        });
      }
    }
  }

  if (samples.length < MIN_SAMPLES) {
    const last = samples[samples.length - 1];
    return {
      suggestedWeightKg: last ? roundToPlate(last.weight) : 0,
      basis: {
        ...fallback.basis,
        samplesUsed: samples.length,
        currentE1rmKg: last ? last.e1rmKg : null,
      },
    };
  }

  samples.sort((a, b) => a.weekIndex - b.weekIndex);
  const sortedE1rm = [...samples].map((s) => s.e1rmKg).sort((a, b) => a - b);
  const median = sortedE1rm[Math.floor(sortedE1rm.length / 2)];
  const trimmed = samples.filter((s) => s.e1rmKg >= median * 0.7 && s.e1rmKg <= median * 1.3);
  const effective = trimmed.length >= MIN_SAMPLES ? trimmed : samples;

  const slope = linearSlope(effective);
  const lastSample = effective[effective.length - 1];
  const currentE1rm = lastSample.e1rmKg;
  const projected = currentE1rm + slope;
  const cappedProjected = clamp(projected, currentE1rm * 0.95, currentE1rm * (1 + MAX_WEEKLY_GROWTH));
  const weightForTarget = cappedProjected / (1 + target / 30);
  const rounded = roundToPlate(weightForTarget);

  const noisy = Math.abs(slope) > currentE1rm * 0.1;
  return {
    suggestedWeightKg: rounded,
    basis: {
      samplesUsed: effective.length,
      windowWeeks: window,
      currentE1rmKg: currentE1rm,
      projectedE1rmKg: cappedProjected,
      weeklySlopeKg: slope,
      fallbackReason: noisy ? 'noisy_trend' : undefined,
    },
  };
};
