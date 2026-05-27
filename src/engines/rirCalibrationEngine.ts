import type { TrainingSession, TrainingSetLog } from '../models/training-model';
import { clamp, number } from './engineUtils';

// Feature #4: Calibrate per-user RIR self-report bias. Each user is biased
// in their own direction — some routinely report RIR=2 on sets they actually
// hit failure on (over-reporting), others call true RPE 8 sets RIR=0
// (under-reporting). When the user logs a set that they marked as
// "to failure" (RIR === 0), we compare the actual reps achieved to the
// reps the Epley curve predicts for their recent working e1RM. The
// systematic gap is the bias, which downstream engines subtract from any
// reported RIR before feeding it into recommendation math.

const MIN_SAMPLES = 4;
const WINDOW_WEEKS = 12;
const MAX_BIAS = 1.5;
const epley = (weightKg: number, reps: number) => weightKg * (1 + reps / 30);

export type RirCalibrationInput = {
  history: TrainingSession[];
  asOfDate?: string;
  windowWeeks?: number;
};

export type RirCalibrationResult = {
  userRirBias: number;
  confidence: 'low' | 'medium' | 'high';
  sampleSize: number;
  reason?: 'insufficient_samples';
};

type FailureSample = {
  weight: number;
  reps: number;
  recentE1rmKg: number;
};

const parseRir = (value: unknown) => {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const isToFailure = (set: TrainingSetLog) => {
  const rir = parseRir(set.rir);
  return rir === 0 && set.completionStatus !== 'draft' && number(set.weight) > 0 && number(set.reps) > 0;
};

const isWorkingSet = (set: TrainingSetLog) =>
  set.type !== 'warmup' && number(set.weight) > 0 && number(set.reps) > 0;

// Bias formula: a user who reports RIR=0 but the math says they had
// ~2 reps left has bias +2 (over-reports RIR=0 too early). A user who
// blows past the predicted curve has negative bias.
const computeBias = (samples: FailureSample[]) => {
  if (!samples.length) return 0;
  const biases = samples.map((s) => {
    const predictedRepsAtZeroRir = Math.max(1, 30 * (s.recentE1rmKg / s.weight - 1));
    return predictedRepsAtZeroRir - s.reps;
  });
  biases.sort((a, b) => a - b);
  const median = biases[Math.floor(biases.length / 2)];
  return clamp(median, -MAX_BIAS, MAX_BIAS);
};

export const buildRirCalibration = (input: RirCalibrationInput): RirCalibrationResult => {
  const window = Math.max(2, input.windowWeeks ?? WINDOW_WEEKS);
  const asOf = input.asOfDate ? new Date(input.asOfDate) : new Date();
  if (Number.isNaN(asOf.getTime())) {
    return { userRirBias: 0, confidence: 'low', sampleSize: 0, reason: 'insufficient_samples' };
  }
  const windowStart = new Date(asOf.getTime() - window * 7 * 24 * 60 * 60 * 1000);

  const samplesByExercise = new Map<string, { failureSets: TrainingSetLog[]; workingSets: TrainingSetLog[] }>();
  for (const session of input.history) {
    if (!session?.date) continue;
    const sessionDate = new Date(session.date);
    if (Number.isNaN(sessionDate.getTime())) continue;
    if (sessionDate < windowStart || sessionDate > asOf) continue;
    for (const exercise of session.exercises ?? []) {
      const key = exercise.actualExerciseId || exercise.baseId || exercise.id;
      if (!key) continue;
      const bucket = samplesByExercise.get(key) ?? { failureSets: [], workingSets: [] };
      for (const set of (exercise.sets as TrainingSetLog[] | undefined) ?? []) {
        if (!isWorkingSet(set)) continue;
        if (isToFailure(set)) bucket.failureSets.push(set);
        else bucket.workingSets.push(set);
      }
      samplesByExercise.set(key, bucket);
    }
  }

  const failureSamples: FailureSample[] = [];
  for (const [, { failureSets, workingSets }] of samplesByExercise) {
    if (!failureSets.length || workingSets.length < 2) continue;
    const e1rmEstimates = workingSets
      .map((set) => {
        const rir = parseRir(set.rir) ?? 1;
        const adjustedReps = number(set.reps) + clamp(rir, 0, 4);
        return epley(number(set.weight), adjustedReps);
      })
      .filter((value) => Number.isFinite(value) && value > 0);
    if (!e1rmEstimates.length) continue;
    e1rmEstimates.sort((a, b) => a - b);
    const recentE1rmKg = e1rmEstimates[Math.floor(e1rmEstimates.length * 0.75)];
    for (const set of failureSets) {
      failureSamples.push({
        weight: number(set.weight),
        reps: number(set.reps),
        recentE1rmKg,
      });
    }
  }

  if (failureSamples.length < MIN_SAMPLES) {
    return {
      userRirBias: 0,
      confidence: 'low',
      sampleSize: failureSamples.length,
      reason: 'insufficient_samples',
    };
  }

  const bias = computeBias(failureSamples);
  const confidence: RirCalibrationResult['confidence'] =
    failureSamples.length >= 12 ? 'high' : failureSamples.length >= 6 ? 'medium' : 'low';
  return { userRirBias: Math.round(bias * 10) / 10, confidence, sampleSize: failureSamples.length };
};
