import { PRIMARY_GOALS, TRAINING_MODES, type AppData } from '../models/training-model';
import { number } from '../engines/engineUtils';
import { isKnownExerciseId, isSyntheticReplacementExerciseId } from '../engines/replacementEngine';

export const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const parseJsonSafely = <T>(value: string | null, fallback: T): T => {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

export const pickString = (value: unknown, fallback = '') => (typeof value === 'string' ? value : fallback);
export const pickArray = <T>(value: unknown, fallback: T[] = []): T[] => (Array.isArray(value) ? value : fallback);
export const pickRecord = (value: unknown) => (isPlainObject(value) ? value : {});
export const pickStringArray = (value: unknown, fallback: string[] = []) => pickArray<unknown>(value, fallback).map((item) => String(item));
export const pickStringRecord = (value: unknown) =>
  Object.fromEntries(
    Object.entries(pickRecord(value))
      .filter(([, entry]) => typeof entry === 'string')
      .map(([key, entry]) => [key, String(entry)])
  ) as Record<string, string>;
export const pickDoseRecord = (value: unknown) =>
  Object.fromEntries(
    Object.entries(pickRecord(value))
      .filter(([, entry]) => entry === 'taper' || entry === 'baseline' || entry === 'boost')
      .map(([key, entry]) => [key, entry])
  ) as Record<string, 'taper' | 'baseline' | 'boost'>;
export const pickNumberRecord = (value: unknown) =>
  Object.fromEntries(
    Object.entries(pickRecord(value))
      .map(([key, entry]) => [key, number(entry)])
      .filter(([, entry]) => Number.isFinite(entry))
  ) as Record<string, number>;
export const editAffectedStats = ['volume', 'effectiveSet', 'PR', 'e1RM', 'calendar', 'sessionQuality', 'none'] as const;
export const sessionEditTypes = ['working_set', 'warmup_set', 'data_flag', 'note', 'mixed'] as const;
export const pickEnum = <T extends readonly string[]>(value: unknown, allowed: T, fallback: T[number]): T[number] =>
  typeof value === 'string' && allowed.includes(value) ? value : fallback;
export const finiteNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

export const sanitizeSessionEditSummarySnapshot = (value: unknown) => {
  const raw = pickRecord(value);
  if (!Object.keys(raw).length) return undefined;
  return {
    plannedWorkingSets: number(raw.plannedWorkingSets),
    completedWorkingSets: number(raw.completedWorkingSets),
    effectiveSets: number(raw.effectiveSets),
    warmupSets: number(raw.warmupSets),
    incompleteSets: number(raw.incompleteSets),
    workingVolume: number(raw.workingVolume),
    warmupVolume: number(raw.warmupVolume),
    dataFlag: pickEnum(raw.dataFlag, ['normal', 'test', 'excluded'] as const, 'normal'),
    excludedFromStatsReason: pickString(raw.excludedFromStatsReason) || undefined,
  };
};

export const normalizePrimaryGoal = (value: unknown, fallback: AppData['programTemplate']['primaryGoal'] = 'hypertrophy'): AppData['programTemplate']['primaryGoal'] => {
  const text = String(value || '').trim();
  const normalized = text.toLowerCase().replace(/[\s-]+/g, '_');
  if (text === '???' || text === '?????' || normalized === 'hypertrophy' || normalized === 'muscle_gain' || normalized === 'musclegrowth' || normalized === 'muscle_growth') return 'hypertrophy';
  if (text === '???' || normalized === 'strength') return 'strength';
  if (text === '???' || normalized === 'fat_loss' || normalized === 'fatloss') return 'fat_loss';
  return pickEnum(value, PRIMARY_GOALS, fallback);
};

export const normalizeTrainingMode = (value: unknown, fallback: AppData['trainingMode'] = 'hybrid'): AppData['trainingMode'] => {
  const text = String(value || '').trim();
  const normalized = text.toLowerCase().replace(/[\s-]+/g, '_');
  if (text === '???' || text === '?????' || normalized === 'hypertrophy' || normalized === 'muscle_gain' || normalized === 'musclegrowth' || normalized === 'muscle_growth') return 'hypertrophy';
  if (text === '???' || normalized === 'strength') return 'strength';
  if (text === '???' || normalized === 'hybrid') return 'hybrid';
  return pickEnum(value, TRAINING_MODES, fallback);
};

export const normalizeExerciseIdentity = (raw: Record<string, unknown>, rawId: string) => {
  const rawBaseId = pickString(raw.baseId);
  const strippedSyntheticBase = rawId.split('__auto_alt')[0].split('__alt_')[0];
  const baseId = rawBaseId || (isKnownExerciseId(strippedSyntheticBase) ? strippedSyntheticBase : rawId);
  const explicitOriginalId = pickString(raw.originalExerciseId || raw.replacedFromId);
  const originalExerciseId = explicitOriginalId
    ? (isKnownExerciseId(explicitOriginalId) ? explicitOriginalId : '')
    : (isKnownExerciseId(baseId) ? baseId : '');
  const rawReplacementId = pickString(raw.replacementExerciseId);
  const explicitActualId = pickString(raw.actualExerciseId);
  const rawActualId = explicitActualId || rawReplacementId || rawId;
  const validReplacementId = isKnownExerciseId(rawReplacementId) ? rawReplacementId : '';
  const validActualId = isKnownExerciseId(rawActualId) ? rawActualId : '';
  const hasSyntheticId = [rawId, rawActualId, rawReplacementId].some(isSyntheticReplacementExerciseId);
  const invalidActualId = Boolean(explicitActualId && !isKnownExerciseId(explicitActualId)) || isSyntheticReplacementExerciseId(rawActualId);
  const invalidReplacementId = Boolean(rawReplacementId && !isKnownExerciseId(rawReplacementId));
  const invalidOriginalId = Boolean(explicitOriginalId && !isKnownExerciseId(explicitOriginalId));
  const identityInvalid = Boolean(raw.identityInvalid) || invalidActualId || invalidReplacementId || invalidOriginalId || hasSyntheticId;
  const legacyActualExerciseId =
    pickString(raw.legacyActualExerciseId) ||
    (invalidActualId && rawActualId ? rawActualId : '');
  const legacyReplacementExerciseId =
    pickString(raw.legacyReplacementExerciseId) ||
    (invalidReplacementId && rawReplacementId ? rawReplacementId : '');
  const legacyOriginalExerciseId =
    pickString(raw.legacyOriginalExerciseId) ||
    (invalidOriginalId && explicitOriginalId ? explicitOriginalId : '');
  const actualExerciseId = identityInvalid ? undefined : (validActualId || validReplacementId || (isKnownExerciseId(rawId) ? rawId : undefined));
  const replacementExerciseId = identityInvalid ? undefined : (validReplacementId || (validActualId && validActualId !== originalExerciseId ? validActualId : undefined));
  const reviewReasons = [
    pickString(raw.identityReviewReason),
    invalidActualId ? 'invalid_actual_exercise_id' : '',
    invalidReplacementId ? 'invalid_replacement_exercise_id' : '',
    invalidOriginalId ? 'invalid_original_exercise_id' : '',
    hasSyntheticId ? 'synthetic_replacement_id' : '',
  ].filter(Boolean);
  const warning = identityInvalid
    ? [pickString(raw.warning), '动作身份需要检查，已保留原始记录但不会用于 PR、e1RM 或有效组。'].filter(Boolean).join(' / ')
    : pickString(raw.warning);

  // Bug #3 修复：canonicalExerciseId 的 fallback 链原先会回退到 rawId（可能是 __auto_alt_xxx 合成 ID）
  // 或未知的 baseId，导致合成/无效 ID 污染 PR / e1RM / effectiveSet 统计。
  // 这里仅允许已通过有效性校验的 ID 作为 fallback，identityInvalid 时不再硬塞回退值。
  const safeCanonicalFallback =
    (actualExerciseId && isKnownExerciseId(actualExerciseId) ? actualExerciseId : undefined) ||
    (originalExerciseId && isKnownExerciseId(originalExerciseId) ? originalExerciseId : undefined) ||
    (baseId && isKnownExerciseId(baseId) ? baseId : undefined);
  const explicitCanonical = pickString(raw.canonicalExerciseId);
  const safeCanonical = explicitCanonical && isKnownExerciseId(explicitCanonical)
    ? explicitCanonical
    : safeCanonicalFallback;

  return {
    id: rawId,
    baseId,
    canonicalExerciseId: safeCanonical,
    originalExerciseId,
    actualExerciseId,
    legacyActualExerciseId: legacyActualExerciseId || undefined,
    legacyReplacementExerciseId: legacyReplacementExerciseId || undefined,
    legacyOriginalExerciseId: legacyOriginalExerciseId || undefined,
    replacementExerciseId,
    identityInvalid: identityInvalid || undefined,
    identityReviewReason: reviewReasons[0] || undefined,
    warning,
  };
};

export const LOAD_FEEDBACK_VALUES = ['too_light', 'good', 'too_heavy'] as const;
export const SESSION_DATA_FLAGS = ['normal', 'test', 'excluded'] as const;
export const WEIGHT_UNITS = ['kg', 'lb'] as const;
export const HEALTH_DATA_SOURCES = ['apple_health_export', 'apple_watch_workout', 'third_party_csv', 'manual_import', 'unknown'] as const;
export const HEALTH_METRIC_TYPES = [
  'sleep_duration',
  'resting_heart_rate',
  'hrv',
  'heart_rate',
  'steps',
  'active_energy',
  'exercise_minutes',
  'body_weight',
  'body_fat',
  'vo2max',
  'workout',
] as const;

export const LEGACY_TEXT_MAP: Record<string, string> = {
  poor: '??',
  ok: '????',
  good: '??',
  low: '??',
  medium: '??',
  high: '??',
};

export const normalizeTextValue = (value: unknown) => {
  const text = typeof value === 'string' ? value : '';
  return LEGACY_TEXT_MAP[text] || text;
};

export const coerceSchemaVersion = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;
};
