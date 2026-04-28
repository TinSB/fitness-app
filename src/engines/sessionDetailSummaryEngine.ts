import type { ExercisePrescription, SupportExerciseLog, TrainingSession, TrainingSetLog, UnitSettings } from '../models/training-model';
import { formatDataFlag } from '../i18n/formatters';
import { buildEffectiveVolumeSummary } from './effectiveSetEngine';
import { number, setVolume } from './engineUtils';
import { formatTrainingVolume } from './unitConversionEngine';

export type SessionSetCategory = 'warmup' | 'working' | 'uncategorized';

export type SessionSetEntry = {
  exercise: ExercisePrescription;
  exerciseId: string;
  set: TrainingSetLog;
  setIndex: number;
  category: SessionSetCategory;
  inferred: boolean;
  source: 'exercise' | 'focusWarmup';
};

export type SessionExerciseSetGroup = {
  exercise: ExercisePrescription;
  exerciseId: string;
  warmupSets: SessionSetEntry[];
  workingSets: SessionSetEntry[];
  uncategorizedSets: SessionSetEntry[];
};

export type GroupedSessionSets = {
  exerciseGroups: SessionExerciseSetGroup[];
  warmupSets: SessionSetEntry[];
  workingSets: SessionSetEntry[];
  uncategorizedSets: SessionSetEntry[];
  supportSets: SupportExerciseLog[];
};

const DEFAULT_UNIT_SETTINGS: UnitSettings = {
  weightUnit: 'kg',
  defaultIncrementKg: 2.5,
  defaultIncrementLb: 5,
  customIncrementsKg: [],
  customIncrementsLb: [],
};

const WORKING_SET_TYPES = new Set(['working', 'work', 'top', 'backoff', 'straight']);
const SUPPORT_SET_TYPES = new Set(['support', 'corrective', 'correction', 'functional']);

const setTypeText = (set: TrainingSetLog) =>
  String(
    (set as TrainingSetLog & { setType?: unknown; stepType?: unknown }).setType ||
      (set as TrainingSetLog & { setType?: unknown; stepType?: unknown }).stepType ||
      set.type ||
      '',
  )
    .trim()
    .toLowerCase();

const exerciseIdentity = (exercise: ExercisePrescription) =>
  new Set(
    [exercise.id, exercise.actualExerciseId, exercise.replacementExerciseId, exercise.originalExerciseId, exercise.baseId, exercise.canonicalExerciseId]
      .filter(Boolean)
      .map(String),
  );

const parseWarmupExerciseId = (set: TrainingSetLog) => {
  const explicit = String((set as TrainingSetLog & { exerciseId?: unknown }).exerciseId || '').trim();
  if (explicit) return explicit;
  const match = String(set.id || '').match(/^main:([^:]+):warmup:/);
  return match?.[1] || '';
};

const classifySet = (set: TrainingSetLog, source: SessionSetEntry['source']): { category: SessionSetCategory; inferred: boolean } => {
  const rawType = setTypeText(set);
  if (source === 'focusWarmup' || rawType === 'warmup' || Boolean((set as TrainingSetLog & { isWarmup?: unknown }).isWarmup) || String(set.id || '').includes(':warmup:')) {
    return { category: 'warmup', inferred: source === 'exercise' && rawType !== 'warmup' };
  }
  if (WORKING_SET_TYPES.has(rawType)) return { category: 'working', inferred: false };
  if (SUPPORT_SET_TYPES.has(rawType)) return { category: 'uncategorized', inferred: false };
  if (!rawType && source === 'exercise') return { category: 'working', inferred: true };
  return { category: 'uncategorized', inferred: false };
};

const isCompletedDisplaySet = (set: TrainingSetLog) => set.done !== false && number(set.actualWeightKg ?? set.weight) > 0 && number(set.reps) > 0;

const completedVolume = (items: SessionSetEntry[]) =>
  items.filter((item) => isCompletedDisplaySet(item.set)).reduce((sum, item) => sum + setVolume(item.set), 0);

const completedCount = (items: SessionSetEntry[]) => items.filter((item) => isCompletedDisplaySet(item.set)).length;

export const groupSessionSetsByType = (session: TrainingSession): GroupedSessionSets => {
  const groups = (session.exercises || []).map<SessionExerciseSetGroup>((exercise) => ({
    exercise,
    exerciseId: exercise.actualExerciseId || exercise.replacementExerciseId || exercise.id,
    warmupSets: [],
    workingSets: [],
    uncategorizedSets: [],
  }));

  const byIdentity = new Map<string, SessionExerciseSetGroup>();
  groups.forEach((group) => {
    exerciseIdentity(group.exercise).forEach((id) => byIdentity.set(id, group));
  });

  groups.forEach((group) => {
    const sets = Array.isArray(group.exercise.sets) ? group.exercise.sets : [];
    sets.forEach((set, index) => {
      const classified = classifySet(set, 'exercise');
      const entry: SessionSetEntry = {
        exercise: group.exercise,
        exerciseId: group.exerciseId,
        set: classified.category === 'warmup' ? { ...set, type: 'warmup' } : set,
        setIndex: index,
        category: classified.category,
        inferred: classified.inferred,
        source: 'exercise',
      };
      if (entry.category === 'warmup') group.warmupSets.push(entry);
      else if (entry.category === 'working') group.workingSets.push(entry);
      else group.uncategorizedSets.push(entry);
    });
  });

  (Array.isArray(session.focusWarmupSetLogs) ? session.focusWarmupSetLogs : []).forEach((set, index) => {
    const exerciseId = parseWarmupExerciseId(set);
    const group = byIdentity.get(exerciseId) || groups[0];
    if (!group) return;
    if (group.warmupSets.some((item) => item.set.id === set.id)) return;
    group.warmupSets.push({
      exercise: group.exercise,
      exerciseId: group.exerciseId,
      set: { ...set, type: 'warmup', done: set.done !== false },
      setIndex: index,
      category: 'warmup',
      inferred: false,
      source: 'focusWarmup',
    });
  });

  return {
    exerciseGroups: groups,
    warmupSets: groups.flatMap((group) => group.warmupSets),
    workingSets: groups.flatMap((group) => group.workingSets),
    uncategorizedSets: groups.flatMap((group) => group.uncategorizedSets),
    supportSets: Array.isArray(session.supportExerciseLogs) ? session.supportExerciseLogs : [],
  };
};

export const getSessionWarmupSets = (session: TrainingSession) => groupSessionSetsByType(session).warmupSets;

export const getSessionWorkingSets = (session: TrainingSession) => groupSessionSetsByType(session).workingSets;

export const getSessionSupportSets = (session: TrainingSession) => groupSessionSetsByType(session).supportSets;

export const buildWorkingOnlySession = (session: TrainingSession): TrainingSession => {
  const grouped = groupSessionSetsByType(session);
  return {
    ...session,
    dataFlag: 'normal',
    focusWarmupSetLogs: [],
    exercises: grouped.exerciseGroups.map((group) => ({
      ...group.exercise,
      sets: group.workingSets.map((item) => ({ ...item.set, type: item.set.type || 'straight' })),
    })),
  };
};

export const buildSessionDetailSummary = (session: TrainingSession, unitSettings: UnitSettings = DEFAULT_UNIT_SETTINGS) => {
  const grouped = groupSessionSetsByType(session);
  const workingOnlySession = buildWorkingOnlySession(session);
  const effectiveSummary = buildEffectiveVolumeSummary([workingOnlySession]);
  const workingVolumeKg = completedVolume(grouped.workingSets);
  const warmupVolumeKg = completedVolume(grouped.warmupSets);
  const supportSetCount = grouped.supportSets.reduce((sum, item) => sum + Math.max(0, number(item.completedSets)), 0);

  return {
    warmupSetCount: completedCount(grouped.warmupSets),
    workingSetCount: completedCount(grouped.workingSets),
    supportSetCount,
    effectiveSetCount: effectiveSummary.effectiveSets,
    workingVolumeKg,
    warmupVolumeKg,
    totalDisplayVolume: formatTrainingVolume(workingVolumeKg, unitSettings),
    dataFlagLabel: formatDataFlag(session.dataFlag || 'normal'),
    effectiveSummary,
    groupedSets: grouped,
  };
};
