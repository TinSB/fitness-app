import type {
  AppData,
  DataRepairLogEntry,
  ExercisePrescription,
  TrainingSession,
  TrainingSetLog,
  UnitSettings,
  WeightUnit,
} from '../models/training-model';
import { clone, number } from './engineUtils';
import { hasInvalidExerciseIdentity, isSyntheticReplacementExerciseId } from './replacementEngine';
import { DEFAULT_UNIT_SETTINGS, convertKgToDisplayWeight, formatWeight } from './unitConversionEngine';

export type DataHealthRepairResult = {
  repairedData: AppData;
  repairedCount: number;
  needsReviewCount: number;
  repairLog: DataRepairLogEntry[];
  warnings: string[];
};

export type LegacyDisplayWeightRepairOptions = {
  repairedAt?: string;
  maxRepairLogEntries?: number;
};

export type LegacyDisplayWeightRepairScope = {
  repairableCount: number;
  needsReviewCount: number;
};

type MutableSet = TrainingSetLog & Record<string, unknown>;
type SetVisit = {
  session: TrainingSession;
  exercise?: ExercisePrescription;
  set: MutableSet;
  setIndex: number;
  source: 'working' | 'warmup' | 'support';
};

const VALID_DISPLAY_UNITS = new Set<WeightUnit>(['kg', 'lb']);

const hasFiniteNumber = (value: unknown) =>
  value !== undefined && value !== null && String(value).trim() !== '' && Number.isFinite(Number(value));

const hasActualWeightKg = (set: TrainingSetLog) => hasFiniteNumber(set.actualWeightKg);

const hasDisplayFields = (set: TrainingSetLog) =>
  set.displayWeight !== undefined || set.displayUnit !== undefined;

const isValidDisplayUnit = (value: unknown): value is WeightUnit =>
  value === 'kg' || value === 'lb';

const hasUnsafeIdentity = (exercise: ExercisePrescription | undefined, set: TrainingSetLog) =>
  Boolean(
    (exercise && hasInvalidExerciseIdentity(exercise)) ||
      set.identityInvalid ||
      isSyntheticReplacementExerciseId(set.exerciseId) ||
      isSyntheticReplacementExerciseId(set.actualExerciseId) ||
      isSyntheticReplacementExerciseId(set.originalExerciseId),
  );

const shouldRepairDisplayFields = (set: TrainingSetLog, unitSettings: UnitSettings) => {
  if (!hasDisplayFields(set) || !hasActualWeightKg(set)) return false;
  if (!isValidDisplayUnit(set.displayUnit) || !hasFiniteNumber(set.displayWeight)) return false;

  const displayWeight = number(set.displayWeight);
  const expectedForStoredUnit = convertKgToDisplayWeight(set.actualWeightKg, set.displayUnit);
  const isMismatch = Math.abs(expectedForStoredUnit - displayWeight) > 1.1;
  const hasLbDecimal = set.displayUnit === 'lb' && !Number.isInteger(displayWeight);
  const currentUnitMismatch = set.displayUnit !== unitSettings.weightUnit;
  return isMismatch || hasLbDecimal || currentUnitMismatch;
};

const shouldKeepForReview = (exercise: ExercisePrescription | undefined, set: TrainingSetLog) =>
  hasDisplayFields(set) && (!hasActualWeightKg(set) || !isValidDisplayUnit(set.displayUnit) || hasUnsafeIdentity(exercise, set));

const setLabel = (visit: SetVisit) => {
  const sourceLabel = visit.source === 'warmup' ? '热身组' : visit.source === 'support' ? '辅助记录' : '正式组';
  return `${visit.session.id} ${sourceLabel} ${visit.setIndex + 1}`;
};

const beforeSummary = (visit: SetVisit) => {
  const set = visit.set;
  const actualText = hasActualWeightKg(set) ? formatWeight(set.actualWeightKg, { weightUnit: 'kg' }) : '缺少真实重量来源';
  const displayText =
    set.displayWeight !== undefined && set.displayUnit
      ? `${set.displayWeight}${set.displayUnit}`
      : '无旧显示重量';
  return `${setLabel(visit)}：旧显示 ${displayText}，真实重量 ${actualText}`;
};

const afterSummary = (visit: SetVisit) => {
  const set = visit.set;
  const actualText = hasActualWeightKg(set) ? formatWeight(set.actualWeightKg, { weightUnit: 'kg' }) : '缺少真实重量来源';
  return `${setLabel(visit)}：已移除旧显示字段，真实重量仍为 ${actualText}`;
};

const affectedIds = (visit: SetVisit) => {
  const ids = [visit.session.id, visit.exercise?.id, visit.set.id].filter(Boolean).map(String);
  return [...new Set(ids)];
};

const visitSessionSets = (sessions: TrainingSession[], visitor: (visit: SetVisit) => void) => {
  sessions.forEach((session) => {
    (session.exercises || []).forEach((exercise) => {
      const sets = Array.isArray(exercise.sets) ? exercise.sets : [];
      sets.forEach((set, setIndex) => visitor({ session, exercise, set: set as MutableSet, setIndex, source: 'working' }));
    });

    (session.focusWarmupSetLogs || []).forEach((set, setIndex) =>
      visitor({ session, exercise: session.exercises?.[0], set: set as MutableSet, setIndex, source: 'warmup' }),
    );

    (session.supportExerciseLogs || []).forEach((log, setIndex) => {
      const raw = log as unknown as MutableSet;
      if (!hasDisplayFields(raw) && !hasActualWeightKg(raw)) return;
      visitor({ session, exercise: undefined, set: raw, setIndex, source: 'support' });
    });
  });
};

export const analyzeLegacyDisplayWeightRepairScope = (appData: Partial<AppData>): LegacyDisplayWeightRepairScope => {
  const unitSettings = appData.unitSettings || DEFAULT_UNIT_SETTINGS;
  let repairableCount = 0;
  let needsReviewCount = 0;

  visitSessionSets(appData.history || [], ({ exercise, set }) => {
    if (shouldKeepForReview(exercise, set)) {
      needsReviewCount += 1;
      return;
    }
    if (!hasUnsafeIdentity(exercise, set) && shouldRepairDisplayFields(set, unitSettings)) {
      repairableCount += 1;
    }
  });

  return { repairableCount, needsReviewCount };
};

export const repairLegacyDisplayWeights = (
  appData: AppData,
  options: LegacyDisplayWeightRepairOptions = {},
): DataHealthRepairResult => {
  const repairedAt = options.repairedAt || new Date().toISOString();
  const maxRepairLogEntries = Math.max(1, options.maxRepairLogEntries || 200);
  const repairedData = clone(appData);
  const unitSettings = repairedData.unitSettings || DEFAULT_UNIT_SETTINGS;
  const repairLog: DataRepairLogEntry[] = [];
  const warnings: string[] = [];
  let repairedCount = 0;
  let needsReviewCount = 0;

  visitSessionSets(repairedData.history || [], (visit) => {
    const { exercise, set } = visit;
    if (shouldKeepForReview(exercise, set)) {
      needsReviewCount += 1;
      return;
    }
    if (hasUnsafeIdentity(exercise, set) || !shouldRepairDisplayFields(set, unitSettings)) return;

    const actualWeightBefore = set.actualWeightKg;
    const repairId = `repair-legacy-display-weight-${visit.session.id}-${set.id || `${visit.source}-${visit.setIndex + 1}`}`;
    repairLog.push({
      id: repairId,
      repairId,
      createdAt: repairedAt,
      repairedAt,
      category: 'unit',
      action: '清理历史显示重量',
      affectedIds: affectedIds(visit),
      beforeSummary: beforeSummary(visit),
      afterSummary: afterSummary(visit),
    });

    delete set.displayWeight;
    delete set.displayUnit;
    set.actualWeightKg = actualWeightBefore;
    repairedCount += 1;
  });

  if (needsReviewCount > 0) warnings.push('部分记录缺少真实重量来源，已保留为需要复核。');

  repairedData.settings = {
    ...repairedData.settings,
    dataRepairLogs: [
      ...(repairedData.settings?.dataRepairLogs || []),
      ...repairLog,
    ].slice(-maxRepairLogEntries),
  };

  return {
    repairedData,
    repairedCount,
    needsReviewCount,
    repairLog,
    warnings,
  };
};
