import type {
  AdaptiveCalibrationEntry,
  AdaptiveCalibrationState,
  AdaptiveDayState,
  AdaptiveObservation,
  AdaptiveOutcome,
  AdaptiveRepBand,
  ExercisePrescription,
  ReadinessSignal,
  RecommendationAcceptance,
  RecommendationRecord,
  TrainingSession,
  TrainingSetLog,
} from '../models/training-model';
import { isCompletedSet, number } from './engineUtils';

const BIAS_MIN = 0.85;
const BIAS_MAX = 1.15;
const BIAS_MIN_OBSERVATIONS_TO_APPLY = 2;
const FORGET_AFTER_DAYS = 21;
const FROZEN_DAYS_ON_PAIN = 14;
const FROZEN_DAYS_ON_TECH = 7;
const MAX_SAMPLES_PER_ENTRY = 6;
const MAX_RECOMMENDATION_LOG = 240;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const TOLERANCE_LOAD = 0.04;
const TOLERANCE_REPS = 1;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const safe = (value: unknown, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const todayIso = () => new Date().toISOString();

export const createEmptyAdaptiveCalibrationState = (): AdaptiveCalibrationState => ({
  version: 1,
  entries: [],
  recommendationLog: [],
  lastUpdated: '',
});

export const resolveAdaptiveCalibrationState = (
  state: AdaptiveCalibrationState | null | undefined,
): AdaptiveCalibrationState => {
  if (!state) return createEmptyAdaptiveCalibrationState();
  return {
    version: 1,
    entries: Array.isArray(state.entries) ? state.entries : [],
    recommendationLog: Array.isArray(state.recommendationLog) ? state.recommendationLog : [],
    lastUpdated: state.lastUpdated || '',
  };
};

export const getRepBand = (repMin: number, repMax: number): AdaptiveRepBand => {
  const mid = (number(repMin) + number(repMax)) / 2;
  if (mid <= 5) return 'low';
  if (mid <= 10) return 'moderate';
  return 'high';
};

export const getDayState = (input?: ReadinessSignal | { level?: string } | null): AdaptiveDayState => {
  const level = input?.level;
  if (level === 'red') return 'red';
  if (level === 'yellow') return 'yellow';
  return 'green';
};

export const makeEntryKey = (exerciseId: string, repBand: AdaptiveRepBand, dayState: AdaptiveDayState) =>
  `${exerciseId}::${repBand}::${dayState}`;

const findEntry = (state: AdaptiveCalibrationState, exerciseId: string, repBand: AdaptiveRepBand, dayState: AdaptiveDayState) =>
  state.entries.find(
    (entry) => entry.exerciseId === exerciseId && entry.repBand === repBand && entry.dayState === dayState,
  );

const daysBetween = (fromIso: string, toIso: string) => {
  if (!fromIso || !toIso) return 0;
  const from = Date.parse(fromIso);
  const to = Date.parse(toIso);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return 0;
  return Math.max(0, (to - from) / MS_PER_DAY);
};

const isFrozen = (entry: AdaptiveCalibrationEntry, nowIso: string) => {
  if (!entry.frozenUntil) return false;
  const until = Date.parse(entry.frozenUntil);
  const now = Date.parse(nowIso);
  if (!Number.isFinite(until) || !Number.isFinite(now)) return false;
  return until > now;
};

const decayedBias = (entry: AdaptiveCalibrationEntry, nowIso: string) => {
  const days = daysBetween(entry.lastUpdated || '', nowIso);
  if (days <= FORGET_AFTER_DAYS) return entry.loadBias;
  const decay = clamp((days - FORGET_AFTER_DAYS) / 30, 0, 1);
  return entry.loadBias + (1 - entry.loadBias) * decay;
};

export interface LoadBiasResult {
  bias: number;
  applied: boolean;
  frozen: boolean;
  observationCount: number;
  reasonHints: string[];
}

export const getLoadBias = (
  state: AdaptiveCalibrationState | null | undefined,
  exerciseId: string,
  repBand: AdaptiveRepBand,
  dayState: AdaptiveDayState,
  nowIso = todayIso(),
): LoadBiasResult => {
  const resolved = resolveAdaptiveCalibrationState(state);
  const entry = findEntry(resolved, exerciseId, repBand, dayState);
  if (!entry) {
    return { bias: 1, applied: false, frozen: false, observationCount: 0, reasonHints: [] };
  }

  if (isFrozen(entry, nowIso)) {
    return {
      bias: Math.min(1, entry.loadBias),
      applied: true,
      frozen: true,
      observationCount: entry.observationCount,
      reasonHints: entry.reasonHints || [],
    };
  }

  const bias = clamp(decayedBias(entry, nowIso), BIAS_MIN, BIAS_MAX);
  const applied = entry.observationCount >= BIAS_MIN_OBSERVATIONS_TO_APPLY;
  return {
    bias: applied ? bias : 1,
    applied,
    frozen: false,
    observationCount: entry.observationCount,
    reasonHints: entry.reasonHints || [],
  };
};

const isMainWorkingSet = (set: TrainingSetLog | undefined | null) => {
  if (!set) return false;
  const type = String(set.type || '').toLowerCase();
  return !['warmup', 'corrective', 'correction', 'functional', 'support'].includes(type);
};

const setKg = (set: TrainingSetLog) => safe(set.actualWeightKg ?? set.weight, 0);

export interface BuildRecommendationSnapshotOptions {
  sessionId: string;
  date: string;
  trainingMode: string;
  dayState: AdaptiveDayState;
  appliedBias?: number;
}

export const buildRecommendationSnapshotsForExercise = (
  exercise: ExercisePrescription,
  options: BuildRecommendationSnapshotOptions,
): RecommendationRecord[] => {
  const sets = Array.isArray(exercise.sets) ? exercise.sets : [];
  if (!sets.length) return [];
  const baseId = exercise.baseId || exercise.id;
  const exerciseId = exercise.canonicalExerciseId || baseId;
  const repBand = getRepBand(exercise.repMin, exercise.repMax);
  const records: RecommendationRecord[] = [];

  sets.forEach((set, index) => {
    if (!isMainWorkingSet(set)) return;
    const recommendedKg = safe(set.weight, 0);
    const recommendedReps = safe(set.reps, exercise.repMin);
    if (recommendedKg <= 0 || recommendedReps <= 0) return;
    records.push({
      id: `${options.sessionId}::${exerciseId}::${index}`,
      sessionId: options.sessionId,
      date: options.date,
      exerciseId,
      baseId,
      setIndex: index,
      setType: set.type,
      repBand,
      dayState: options.dayState,
      trainingMode: options.trainingMode,
      recommendedKg,
      recommendedReps,
      recommendedRir: set.targetRir || exercise.targetRir,
      appliedBias: options.appliedBias ?? 1,
    });
  });

  return records;
};

export const buildRecommendationSnapshotsForSession = (
  session: TrainingSession,
  options: { dayState: AdaptiveDayState; appliedBias?: (exerciseId: string) => number } = { dayState: 'green' },
): RecommendationRecord[] => {
  const exercises = Array.isArray(session.exercises) ? session.exercises : [];
  return exercises.flatMap((exercise) =>
    buildRecommendationSnapshotsForExercise(exercise, {
      sessionId: session.id,
      date: session.date,
      trainingMode: session.trainingMode,
      dayState: options.dayState,
      appliedBias: options.appliedBias ? options.appliedBias(exercise.canonicalExerciseId || exercise.baseId || exercise.id) : 1,
    }),
  );
};

const classifyOutcome = (
  recommendedKg: number,
  recommendedReps: number,
  recommendedRir: [number, number] | undefined,
  actualKg: number,
  actualReps: number,
  actualRir: number | undefined,
  painFlag: boolean,
  technique?: 'good' | 'acceptable' | 'poor',
): { outcome: AdaptiveOutcome; loadDeltaRatio: number } => {
  const loadDeltaRatio = recommendedKg > 0 ? (actualKg - recommendedKg) / recommendedKg : 0;

  if (painFlag) return { outcome: 'pain', loadDeltaRatio };
  if (technique === 'poor') return { outcome: 'technique_breakdown', loadDeltaRatio };
  if (recommendedReps > 0 && actualReps > 0 && actualReps < recommendedReps - TOLERANCE_REPS) {
    return { outcome: 'failed', loadDeltaRatio };
  }

  const target = recommendedRir?.[0];
  if (actualRir !== undefined && target !== undefined && actualRir <= Math.max(0, target - 2) && actualReps < recommendedReps) {
    return { outcome: 'too_heavy', loadDeltaRatio };
  }

  if (loadDeltaRatio <= -TOLERANCE_LOAD) return { outcome: 'too_heavy', loadDeltaRatio };
  if (loadDeltaRatio >= TOLERANCE_LOAD) return { outcome: 'too_light', loadDeltaRatio };

  const maxRir = recommendedRir?.[1];
  if (actualRir !== undefined && maxRir !== undefined && actualRir >= maxRir + 2 && actualReps >= recommendedReps) {
    return { outcome: 'too_light', loadDeltaRatio };
  }

  return { outcome: 'on_target', loadDeltaRatio };
};

const biasFromOutcome = (outcome: AdaptiveOutcome, loadDeltaRatio: number): number => {
  switch (outcome) {
    case 'too_light':
      return 1 + clamp(Math.abs(loadDeltaRatio) * 0.4 + 0.012, 0.012, 0.025);
    case 'too_heavy':
      return 1 - clamp(Math.abs(loadDeltaRatio) * 0.4 + 0.012, 0.012, 0.025);
    case 'failed':
      return 0.97;
    case 'pain':
      return 0.95;
    case 'technique_breakdown':
      return 0.985;
    case 'on_target':
    default:
      return 1;
  }
};

const learningRate = (observationCount: number) => {
  if (observationCount <= 1) return 0.5;
  if (observationCount <= 3) return 0.35;
  if (observationCount <= 6) return 0.22;
  return 0.15;
};

const summarizeReason = (outcome: AdaptiveOutcome, loadDeltaRatio: number): string => {
  const pct = Math.round(Math.abs(loadDeltaRatio) * 100);
  switch (outcome) {
    case 'too_light':
      return `近期推荐偏轻 ${pct || 2}%，下次会略向上修正。`;
    case 'too_heavy':
      return `近期推荐偏重 ${pct || 2}%，下次会略向下修正。`;
    case 'failed':
      return '近期未能完成计划次数，下次降一点重量。';
    case 'pain':
      return '近期出现不适，先冻结自动加重一段时间。';
    case 'technique_breakdown':
      return '近期动作质量较差，先压一点重量。';
    case 'on_target':
    default:
      return '近期实际与推荐基本一致。';
  }
};

export interface ReconcileSessionResult {
  state: AdaptiveCalibrationState;
  reconciledRecords: RecommendationRecord[];
  observations: AdaptiveObservation[];
}

export const reconcileRecommendationRecords = (
  records: RecommendationRecord[] | undefined,
  session: TrainingSession,
): { records: RecommendationRecord[]; observations: AdaptiveObservation[] } => {
  const list = Array.isArray(records) ? records : [];
  if (!list.length) return { records: [], observations: [] };

  const exerciseById = new Map<string, ExercisePrescription>();
  (session.exercises || []).forEach((exercise) => {
    const baseId = exercise.baseId || exercise.id;
    const canonicalId = exercise.canonicalExerciseId || baseId;
    exerciseById.set(canonicalId, exercise);
    exerciseById.set(baseId, exercise);
    exerciseById.set(exercise.id, exercise);
  });

  const observations: AdaptiveObservation[] = [];
  const reconciledAt = todayIso();

  const reconciledRecords = list.map<RecommendationRecord>((record) => {
    const exercise = exerciseById.get(record.exerciseId) || exerciseById.get(record.baseId || '');
    if (!exercise) {
      return { ...record, acceptance: record.acceptance || 'unknown', outcome: record.outcome || 'on_target', reconciledAt };
    }
    const sets = Array.isArray(exercise.sets) ? exercise.sets : [];
    const set = sets[record.setIndex];
    if (!set || !isMainWorkingSet(set)) {
      return { ...record, acceptance: 'skipped', outcome: record.outcome || 'on_target', reconciledAt };
    }
    if (!isCompletedSet(set)) {
      return { ...record, acceptance: 'skipped', outcome: record.outcome || 'failed', reconciledAt };
    }

    const actualKg = setKg(set);
    const actualReps = safe(set.reps, 0);
    const actualRir = set.rir !== undefined && set.rir !== '' ? safe(set.rir, undefined as unknown as number) : undefined;
    const painFlag = Boolean(set.painFlag);
    const technique = set.techniqueQuality;
    const { outcome, loadDeltaRatio } = classifyOutcome(
      record.recommendedKg,
      record.recommendedReps,
      record.recommendedRir,
      actualKg,
      actualReps,
      Number.isFinite(actualRir as number) ? (actualRir as number) : undefined,
      painFlag,
      technique,
    );

    const acceptance: RecommendationAcceptance =
      Math.abs(actualKg - record.recommendedKg) < 0.1
        ? 'accepted'
        : actualKg > record.recommendedKg
          ? 'overridden_up'
          : 'overridden_down';

    const bias = biasFromOutcome(outcome, loadDeltaRatio);
    observations.push({
      date: record.date,
      sessionId: record.sessionId,
      exerciseId: record.exerciseId,
      recommendedKg: record.recommendedKg,
      actualKg,
      plannedReps: record.recommendedReps,
      actualReps,
      actualRir: Number.isFinite(actualRir as number) ? (actualRir as number) : undefined,
      techniqueQuality: technique,
      painFlag,
      outcome,
      loadDeltaRatio,
      bias,
    });

    return {
      ...record,
      actualKg,
      actualReps,
      actualRir: Number.isFinite(actualRir as number) ? (actualRir as number) : undefined,
      techniqueQuality: technique,
      painFlag,
      acceptance,
      outcome,
      outcomeReason: summarizeReason(outcome, loadDeltaRatio),
      reconciledAt,
    };
  });

  return { records: reconciledRecords, observations };
};

const updateEntry = (
  prev: AdaptiveCalibrationEntry | undefined,
  exerciseId: string,
  repBand: AdaptiveRepBand,
  dayState: AdaptiveDayState,
  observation: AdaptiveObservation,
  nowIso: string,
): AdaptiveCalibrationEntry => {
  const existing: AdaptiveCalibrationEntry = prev || {
    exerciseId,
    repBand,
    dayState,
    loadBias: 1,
    observationCount: 0,
    recentSamples: [],
    lastUpdated: nowIso,
    reasonHints: [],
  };
  const decayed = decayedBias(existing, nowIso);
  const observationCount = existing.observationCount + 1;
  const alpha = learningRate(observationCount);
  const target = decayed * observation.bias;
  const blended = clamp(decayed * (1 - alpha) + target * alpha, BIAS_MIN, BIAS_MAX);
  const samples = [observation, ...(existing.recentSamples || [])].slice(0, MAX_SAMPLES_PER_ENTRY);

  let frozenUntil = existing.frozenUntil;
  if (observation.outcome === 'pain') {
    const until = new Date(Date.parse(nowIso) + FROZEN_DAYS_ON_PAIN * MS_PER_DAY).toISOString();
    if (!frozenUntil || frozenUntil < until) frozenUntil = until;
  } else if (observation.outcome === 'technique_breakdown') {
    const until = new Date(Date.parse(nowIso) + FROZEN_DAYS_ON_TECH * MS_PER_DAY).toISOString();
    if (!frozenUntil || frozenUntil < until) frozenUntil = until;
  } else if (frozenUntil && Date.parse(frozenUntil) < Date.parse(nowIso)) {
    frozenUntil = undefined;
  }

  const reasonHint = summarizeReason(observation.outcome, observation.loadDeltaRatio);
  const reasonHints = [reasonHint, ...(existing.reasonHints || [])].filter(Boolean).slice(0, 3);

  return {
    ...existing,
    loadBias: blended,
    observationCount,
    recentSamples: samples,
    lastUpdated: nowIso,
    frozenUntil,
    reasonHints,
  };
};

export const applyCompletedSessionToCalibration = (
  state: AdaptiveCalibrationState | null | undefined,
  session: TrainingSession,
  nowIso = todayIso(),
): ReconcileSessionResult => {
  const resolved = resolveAdaptiveCalibrationState(state);
  const records = session.recommendationSnapshots;
  const { records: reconciledRecords, observations } = reconcileRecommendationRecords(records, session);

  if (!observations.length) {
    const log = mergeRecommendationLog(resolved.recommendationLog, reconciledRecords);
    return {
      state: { ...resolved, recommendationLog: log, lastUpdated: nowIso || resolved.lastUpdated },
      reconciledRecords,
      observations,
    };
  }

  const entryMap = new Map<string, AdaptiveCalibrationEntry>();
  resolved.entries.forEach((entry) => entryMap.set(makeEntryKey(entry.exerciseId, entry.repBand, entry.dayState), entry));

  reconciledRecords.forEach((record) => {
    const observation = observations.find((item) => item.sessionId === record.sessionId && item.exerciseId === record.exerciseId && item.date === record.date && item.recommendedKg === record.recommendedKg && item.plannedReps === record.recommendedReps);
    if (!observation || !record.outcome) return;
    const key = makeEntryKey(record.exerciseId, record.repBand, record.dayState);
    const updated = updateEntry(entryMap.get(key), record.exerciseId, record.repBand, record.dayState, observation, nowIso);
    entryMap.set(key, updated);
  });

  const log = mergeRecommendationLog(resolved.recommendationLog, reconciledRecords);

  return {
    state: {
      version: 1,
      entries: Array.from(entryMap.values()),
      recommendationLog: log,
      lastUpdated: nowIso,
    },
    reconciledRecords,
    observations,
  };
};

const mergeRecommendationLog = (existing: RecommendationRecord[], incoming: RecommendationRecord[]): RecommendationRecord[] => {
  if (!incoming.length) return existing.slice(0, MAX_RECOMMENDATION_LOG);
  const byId = new Map<string, RecommendationRecord>();
  existing.forEach((record) => byId.set(record.id, record));
  incoming.forEach((record) => byId.set(record.id, record));
  return Array.from(byId.values())
    .sort((left, right) => (right.date || '').localeCompare(left.date || ''))
    .slice(0, MAX_RECOMMENDATION_LOG);
};

export const summarizeAdaptiveCalibration = (
  state: AdaptiveCalibrationState | null | undefined,
  exerciseId: string,
): { entries: AdaptiveCalibrationEntry[]; recentRecords: RecommendationRecord[] } => {
  const resolved = resolveAdaptiveCalibrationState(state);
  return {
    entries: resolved.entries.filter((entry) => entry.exerciseId === exerciseId),
    recentRecords: resolved.recommendationLog.filter((record) => record.exerciseId === exerciseId).slice(0, 10),
  };
};
