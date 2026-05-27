import type { TrainingSession, TrainingSetLog } from '../models/training-model';
import { number } from './engineUtils';
import { getExerciseRecordPoolId } from './e1rmEngine';

// Feature #26: Score each exercise by "stimulus per unit fatigue" — how
// much e1RM improvement does the user get for every tonne of tonnage on
// that movement. Movements with a poor ratio get down-weighted by the
// recommendation pipeline (their slot is candidate for rotation in
// Feature #21, or replacement in Feature #25). The ratio is normalised so
// 1.0 is "neutral" — higher is better.

const WINDOW_WEEKS = 12;
const MIN_SESSIONS = 3;
const epley = (weightKg: number, reps: number) => weightKg * (1 + reps / 30);

export type ExerciseEfficiencyInput = {
  history: TrainingSession[];
  asOfDate?: string;
  windowWeeks?: number;
};

export type ExerciseEfficiencyEntry = {
  exerciseId: string;
  efficiencyScore: number;
  e1rmGainKg: number;
  totalTonnageKg: number;
  sessionsAnalyzed: number;
  ranking: 'high' | 'normal' | 'low';
};

export type ExerciseEfficiencyResult = {
  entries: ExerciseEfficiencyEntry[];
  windowWeeks: number;
  asOf: string;
};

type SessionWindow = {
  date: string;
  e1rmKg: number;
  tonnageKg: number;
};

const isWorkSet = (set: TrainingSetLog) =>
  set.type !== 'warmup' &&
  number(set.weight) > 0 &&
  number(set.reps) > 0 &&
  set.completionStatus !== 'draft';

const collectSessionWindow = (
  history: TrainingSession[],
  windowStart: Date,
  asOf: Date,
) => {
  const perExercise = new Map<string, SessionWindow[]>();
  for (const session of history) {
    if (!session?.date) continue;
    const sessionDate = new Date(session.date);
    if (Number.isNaN(sessionDate.getTime())) continue;
    if (sessionDate < windowStart || sessionDate > asOf) continue;
    for (const exercise of session.exercises ?? []) {
      const key = getExerciseRecordPoolId(exercise);
      if (!key) continue;
      const sets = (exercise.sets as TrainingSetLog[] | undefined)?.filter(isWorkSet) ?? [];
      if (!sets.length) continue;
      const tonnage = sets.reduce((sum, set) => sum + number(set.weight) * number(set.reps), 0);
      const topE1rm = sets.reduce((max, set) => Math.max(max, epley(number(set.weight), number(set.reps))), 0);
      const bucket = perExercise.get(key) ?? [];
      bucket.push({ date: session.date, e1rmKg: topE1rm, tonnageKg: tonnage });
      perExercise.set(key, bucket);
    }
  }
  return perExercise;
};

export const buildExerciseEfficiency = (
  input: ExerciseEfficiencyInput,
): ExerciseEfficiencyResult => {
  const window = Math.max(2, input.windowWeeks ?? WINDOW_WEEKS);
  const asOf = input.asOfDate ? new Date(input.asOfDate) : new Date();
  if (Number.isNaN(asOf.getTime())) {
    return { entries: [], windowWeeks: window, asOf: new Date().toISOString() };
  }
  const windowStart = new Date(asOf.getTime() - window * 7 * 24 * 60 * 60 * 1000);
  const perExercise = collectSessionWindow(input.history, windowStart, asOf);

  const entries: ExerciseEfficiencyEntry[] = [];
  const scores: number[] = [];
  for (const [exerciseId, sessions] of perExercise) {
    if (sessions.length < MIN_SESSIONS) continue;
    sessions.sort((a, b) => a.date.localeCompare(b.date));
    const baseline = sessions[0].e1rmKg;
    const recent = sessions[sessions.length - 1].e1rmKg;
    const gain = recent - baseline;
    const tonnage = sessions.reduce((sum, s) => sum + s.tonnageKg, 0);
    const tonnesK = tonnage / 1000;
    const score = tonnesK > 0 ? gain / tonnesK : 0;
    entries.push({
      exerciseId,
      efficiencyScore: Number.isFinite(score) ? Math.round(score * 100) / 100 : 0,
      e1rmGainKg: Math.round(gain * 10) / 10,
      totalTonnageKg: Math.round(tonnage),
      sessionsAnalyzed: sessions.length,
      ranking: 'normal',
    });
    scores.push(score);
  }

  if (scores.length >= 3) {
    const sorted = [...scores].sort((a, b) => a - b);
    const lowCut = sorted[Math.floor(sorted.length * 0.25)];
    const highCut = sorted[Math.floor(sorted.length * 0.75)];
    for (const entry of entries) {
      if (entry.efficiencyScore <= lowCut) entry.ranking = 'low';
      else if (entry.efficiencyScore >= highCut) entry.ranking = 'high';
    }
  }

  entries.sort((a, b) => b.efficiencyScore - a.efficiencyScore);
  return { entries, windowWeeks: window, asOf: asOf.toISOString() };
};
