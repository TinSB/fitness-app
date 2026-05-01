import type { E1RMProfile, EstimatedOneRepMax, EstimateConfidence, TrainingSession, TrainingSetLog } from '../models/training-model';
import { completedSets, isCompletedSet, number } from './engineUtils';
import { filterAnalyticsHistory } from './sessionHistoryEngine';

type SourceCandidate = {
  sessionId: string;
  date: string;
  exerciseId: string;
  sourceExerciseId: string;
  canonicalExerciseId?: string;
  set: TrainingSetLog;
  e1rmKg: number;
};

const roundToHalfKg = (value: number) => Math.round(value * 2) / 2;
const roundToPlate = (value: number) => Math.round(value / 2.5) * 2.5;

const parseRir = (value: unknown) => {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const epley = (weightKg: number, reps: number) => weightKg * (1 + reps / 30);

const isWorkSet = (set: TrainingSetLog) => set.type !== 'warmup' && number(set.weight) > 0 && number(set.reps) > 0 && isCompletedSet(set);

export const getExerciseRecordPoolId = (
  exercise: Pick<TrainingSession['exercises'][number], 'id' | 'baseId' | 'replacedFromId'> & {
    actualExerciseId?: string;
    replacementExerciseId?: string;
    canonicalExerciseId?: string;
  }
) => exercise.actualExerciseId || exercise.replacementExerciseId || exercise.canonicalExerciseId || (exercise.replacedFromId ? exercise.id : exercise.baseId || exercise.id);

const matchesExercise = (exercise: TrainingSession['exercises'][number], exerciseId: string) => getExerciseRecordPoolId(exercise) === exerciseId || exercise.id === exerciseId;

const isCurrentQualityCandidate = (candidate: SourceCandidate) => {
  const rir = parseRir(candidate.set.rir);
  return (
    candidate.set.techniqueQuality !== 'poor' &&
    !candidate.set.painFlag &&
    number(candidate.set.reps) >= 3 &&
    number(candidate.set.reps) <= 12 &&
    rir !== undefined &&
    rir <= 3
  );
};

const median = (values: number[]) => {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  if (!sorted.length) return 0;
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

const nearestCandidate = (candidates: SourceCandidate[], targetValue: number) =>
  [...candidates].sort((left, right) => Math.abs(left.e1rmKg - targetValue) - Math.abs(right.e1rmKg - targetValue))[0];

const buildEstimate = (
  candidate: SourceCandidate,
  candidatesForConfidence: SourceCandidate[],
  profileNote: string,
  overrideE1rmKg?: number,
  forceConfidence?: EstimateConfidence,
): EstimatedOneRepMax => {
  const sourceSet = {
    sessionId: candidate.sessionId,
    date: candidate.date,
    weightKg: number(candidate.set.weight),
    reps: number(candidate.set.reps),
    rir: parseRir(candidate.set.rir),
    techniqueQuality: candidate.set.techniqueQuality,
    painFlag: candidate.set.painFlag,
  };

  const recent = candidatesForConfidence.slice(0, 5).map((item) => ({
    weightKg: number(item.set.weight),
    reps: number(item.set.reps),
    rir: parseRir(item.set.rir),
    techniqueQuality: item.set.techniqueQuality,
    painFlag: item.set.painFlag,
  }));

  const notes: string[] = [profileNote];
  if (sourceSet.techniqueQuality === 'poor') notes.push('来源组动作质量较差，置信度下调。');
  if (sourceSet.painFlag) notes.push('来源组记录了不适，置信度下调。');
  if (sourceSet.rir !== undefined && sourceSet.rir >= 4) notes.push('来源组距离力竭较远，估算可能偏低。');
  if (sourceSet.reps > 12) notes.push('来源组次数较高，不适合推断精确最大力量。');
  if (forceConfidence === 'low') notes.push('近期高质量记录不足，当前估算仅作低置信参考。');

  return {
    exerciseId: candidate.exerciseId,
    e1rmKg: roundToHalfKg(overrideE1rmKg ?? candidate.e1rmKg),
    formula: 'epley',
    confidence: forceConfidence ?? getE1RMConfidence(sourceSet, recent),
    sourceSet,
    notes,
  };
};

const collectCandidates = (history: TrainingSession[], exerciseId: string): SourceCandidate[] =>
  filterAnalyticsHistory(history)
    .flatMap((session) =>
      (session.exercises || [])
        .filter((exercise) => matchesExercise(exercise, exerciseId))
        .flatMap((exercise) => {
          const poolId = getExerciseRecordPoolId(exercise);
          return completedSets(exercise)
            .filter(isWorkSet)
            .map((set) => ({
              sessionId: session.id,
              date: session.date,
              exerciseId: poolId,
              sourceExerciseId: exercise.id,
              canonicalExerciseId: exercise.canonicalExerciseId,
              set,
              e1rmKg: roundToHalfKg(epley(number(set.weight), number(set.reps))),
            }));
        })
    )
    .sort((left, right) => right.date.localeCompare(left.date));

export const getE1RMConfidence = (
  sourceSet: Pick<EstimatedOneRepMax['sourceSet'], 'reps' | 'rir' | 'techniqueQuality' | 'painFlag'>,
  recentSets: Array<Pick<EstimatedOneRepMax['sourceSet'], 'reps' | 'rir' | 'techniqueQuality' | 'painFlag' | 'weightKg'>>
): EstimateConfidence => {
  const notes: EstimateConfidence[] = [];
  if (sourceSet.techniqueQuality === 'poor') notes.push('low');
  if (sourceSet.painFlag) notes.push('low');
  if (number(sourceSet.reps) > 12) notes.push('low');
  if (sourceSet.rir !== undefined && sourceSet.rir >= 4) notes.push('low');

  if (notes.includes('low')) return 'low';

  const stableHighQualitySets = recentSets.filter(
    (set) =>
      set.techniqueQuality !== 'poor' &&
      !set.painFlag &&
      number(set.reps) >= 3 &&
      number(set.reps) <= 10 &&
      (set.rir === undefined || set.rir <= 3)
  );

  const weights = stableHighQualitySets.map((set) => number(set.weightKg)).filter(Boolean);
  const spread = weights.length >= 2 ? Math.max(...weights) - Math.min(...weights) : Number.POSITIVE_INFINITY;

  if (stableHighQualitySets.length >= 3 && spread <= Math.max(5, Math.max(...weights) * 0.08)) return 'high';
  if (number(sourceSet.reps) >= 3 && number(sourceSet.reps) <= 12) return 'medium';
  return 'low';
};

export const estimateOneRepMaxForExercise = (history: TrainingSession[], exerciseId: string): EstimatedOneRepMax | null => {
  const profile = buildE1RMProfile(history, exerciseId);
  return profile.current || profile.best || null;
};

export const buildE1RMProfile = (history: TrainingSession[], exerciseId: string): E1RMProfile => {
  const candidates = collectCandidates(history, exerciseId);
  const recentHighQuality = candidates.slice(0, 5).filter(isCurrentQualityCandidate);
  const recentValues = recentHighQuality.map((candidate) => roundToHalfKg(candidate.e1rmKg));
  const stableCurrentValue = recentValues.length >= 3 ? median(recentValues) : recentValues.length ? Math.min(...recentValues) : undefined;
  const currentCandidate = stableCurrentValue === undefined ? undefined : nearestCandidate(recentHighQuality, stableCurrentValue);
  const bestCandidate = [...candidates]
    .filter((candidate) => {
      const estimate = buildEstimate(candidate, candidates, '历史最高可信估算。');
      return estimate.confidence !== 'low';
    })
    .sort((left, right) => right.e1rmKg - left.e1rmKg)[0];
  const method =
    recentValues.length >= 3
      ? 'median_recent'
      : recentValues.length
        ? 'single_recent_low_confidence'
        : undefined;

  return {
    exerciseId,
    current: currentCandidate && stableCurrentValue !== undefined
      ? buildEstimate(
        currentCandidate,
        recentHighQuality,
        recentValues.length >= 3
          ? '训练建议使用近期稳定估算，而不是历史最高记录。'
          : '近期高质量记录不足，本次仅作低置信参考，不输出精确训练重量。',
        stableCurrentValue,
        recentValues.length >= 3 ? undefined : 'low',
      )
      : undefined,
    best: bestCandidate
      ? buildEstimate(bestCandidate, candidates, '历史最高可信估算，仅用于进度回看。')
      : candidates[0]
        ? buildEstimate(candidates[0], candidates, '历史记录置信度较低，仅作低置信参考。')
        : undefined,
    recentValues,
    method,
  };
};

export const estimateLoadFromE1RM = (e1rmKg: number, percentRange: [number, number]) => {
  const [rawMin, rawMax] = percentRange;
  const minPercent = rawMin > 1 ? rawMin / 100 : rawMin;
  const maxPercent = rawMax > 1 ? rawMax / 100 : rawMax;
  return {
    minKg: Math.max(0, roundToPlate(e1rmKg * minPercent)),
    maxKg: Math.max(0, roundToPlate(e1rmKg * maxPercent)),
  };
};

export const parsePercentRange = (value?: string): [number, number] | null => {
  if (!value) return null;
  const matches = value.match(/\d+(?:\.\d+)?/g)?.map(Number) || [];
  if (matches.length < 2) return null;
  return [matches[0], matches[1]];
};
