import type { ExercisePrescription, TrainingSession, TrainingSetLog } from '../models/training-model';
import { isCompletedSet, number } from './engineUtils';

export interface RecentPRDeltaEntry {
  exerciseId: string;
  exerciseName: string;
  windowDays: number;
  currentBestKg: number;
  currentBestReps: number;
  currentBestDate: string;
  previousBestKg?: number;
  previousBestReps?: number;
  previousBestDate?: string;
  deltaKg?: number;
  deltaPercent?: number;
  direction: 'up' | 'flat' | 'down' | 'new';
}

export interface RecentPRDeltaOptions {
  windowDays?: number;
  nowIso?: string;
  limit?: number;
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

const exerciseKey = (exercise: ExercisePrescription) => exercise.canonicalExerciseId || exercise.baseId || exercise.id;

const bestSet = (sets: TrainingSetLog[]) => {
  let bestWeight = 0;
  let bestReps = 0;
  for (const set of sets) {
    if (!isCompletedSet(set)) continue;
    const weight = number(set.actualWeightKg ?? set.weight);
    const reps = number(set.reps);
    if (weight <= 0 || reps <= 0) continue;
    if (weight > bestWeight || (weight === bestWeight && reps > bestReps)) {
      bestWeight = weight;
      bestReps = reps;
    }
  }
  return bestWeight > 0 ? { weight: bestWeight, reps: bestReps } : null;
};

interface ExerciseObservation {
  exerciseName: string;
  weight: number;
  reps: number;
  date: string;
  timestamp: number;
}

const collectObservations = (history: TrainingSession[]): Map<string, ExerciseObservation[]> => {
  const map = new Map<string, ExerciseObservation[]>();
  for (const session of history) {
    if (!isAnalyticsSession(session)) continue;
    const ts = safeDate(session.finishedAt) ?? safeDate(session.startedAt) ?? safeDate(session.date);
    if (ts === null) continue;
    for (const exercise of session.exercises || []) {
      const sets = Array.isArray(exercise.sets) ? exercise.sets : [];
      const best = bestSet(sets);
      if (!best) continue;
      const key = exerciseKey(exercise);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push({
        exerciseName: exercise.name || exercise.id,
        weight: best.weight,
        reps: best.reps,
        date: session.date,
        timestamp: ts,
      });
    }
  }
  return map;
};

const pickBest = (observations: ExerciseObservation[]) => {
  let best: ExerciseObservation | undefined;
  for (const observation of observations) {
    if (!best || observation.weight > best.weight || (observation.weight === best.weight && observation.reps > best.reps)) {
      best = observation;
    }
  }
  return best;
};

export const computeRecentPRDeltas = (
  history: TrainingSession[] = [],
  options: RecentPRDeltaOptions = {},
): RecentPRDeltaEntry[] => {
  const windowDays = options.windowDays ?? 14;
  const limit = options.limit ?? 6;
  const nowIso = options.nowIso || new Date().toISOString();
  const nowMs = safeDate(nowIso) ?? Date.now();
  const cutoffMs = nowMs - windowDays * MS_PER_DAY;

  const observations = collectObservations(history);
  const results: RecentPRDeltaEntry[] = [];

  observations.forEach((entries, key) => {
    const inside = entries.filter((entry) => entry.timestamp >= cutoffMs && entry.timestamp <= nowMs);
    const outside = entries.filter((entry) => entry.timestamp < cutoffMs);
    if (!inside.length) return;

    const currentBest = pickBest(inside)!;
    const previousBest = pickBest(outside);

    let direction: RecentPRDeltaEntry['direction'] = 'new';
    let deltaKg: number | undefined;
    let deltaPercent: number | undefined;

    if (previousBest) {
      deltaKg = Number((currentBest.weight - previousBest.weight).toFixed(2));
      deltaPercent = previousBest.weight > 0
        ? Number((((currentBest.weight - previousBest.weight) / previousBest.weight) * 100).toFixed(1))
        : undefined;
      direction = deltaKg > 0 ? 'up' : deltaKg < 0 ? 'down' : 'flat';
    }

    results.push({
      exerciseId: key,
      exerciseName: currentBest.exerciseName,
      windowDays,
      currentBestKg: currentBest.weight,
      currentBestReps: currentBest.reps,
      currentBestDate: currentBest.date,
      previousBestKg: previousBest?.weight,
      previousBestReps: previousBest?.reps,
      previousBestDate: previousBest?.date,
      deltaKg,
      deltaPercent,
      direction,
    });
  });

  results.sort((left, right) => {
    const leftDelta = left.deltaKg ?? Number.POSITIVE_INFINITY;
    const rightDelta = right.deltaKg ?? Number.POSITIVE_INFINITY;
    if (left.direction === 'new' && right.direction !== 'new') return -1;
    if (right.direction === 'new' && left.direction !== 'new') return 1;
    return rightDelta - leftDelta;
  });

  return results.slice(0, limit);
};
