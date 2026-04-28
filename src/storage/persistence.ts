import Ajv2020 from 'ajv/dist/2020';
import schema from '../models/training-program.schema.json';
import appDataSchema from '../models/training-data.schema.json';
import {
  CORRECTION_MODULES,
  DEFAULT_MESOCYCLE_PLAN,
  DEFAULT_PROGRAM_TEMPLATE,
  DEFAULT_SCREENING_PROFILE,
  DEFAULT_STATUS,
  DEFAULT_USER_PROFILE,
  FUNCTIONAL_ADDONS,
  INITIAL_TEMPLATES,
  STORAGE_KEY,
  STORAGE_KEYS,
  STORAGE_VERSION,
  SUPPORT_EXERCISE_LIBRARY,
  TRAINING_MODE_META,
  validateSupportExerciseReferences,
} from '../data/trainingData';
import {
  CORRECTION_STRATEGIES,
  ENERGY_STATES,
  FUNCTIONAL_STRATEGIES,
  PRIMARY_GOALS,
  SEX_OPTIONS,
  SLEEP_STATES,
  SPLIT_TYPES,
  TRAINING_LEVELS,
  TRAINING_MODES,
  type AppData,
  type HealthIntegrationSettings,
  type HealthImportBatch,
  type HealthMetricSample,
  type ImportedWorkoutSample,
  type LoadFeedback,
  type MesocyclePlan,
  type ProgramAdjustmentDraft,
  type ProgramAdjustmentHistoryItem,
  type ProgramTemplate,
  type RestTimerState,
  type ScreeningProfile,
  type SupportExerciseLog,
  type TodayStatus,
  type TrainingSession,
  type UserProfile,
} from '../models/training-model';
import { clamp, clone, hydrateTemplates, number } from '../engines/engineUtils';
import { reconcileScreeningProfile } from '../engines/adaptiveFeedbackEngine';
import { createMesocyclePlan, sanitizeMesocyclePlan } from '../engines/mesocycleEngine';
import { isSyntheticReplacementExerciseId, validateReplacementExerciseId } from '../engines/replacementEngine';
import { DEFAULT_UNIT_SETTINGS, sanitizeUnitSettings } from '../engines/unitConversionEngine';

const ajv = new Ajv2020({ allErrors: true, allowUnionTypes: true });
export const validateProgramSchema = ajv.compile(schema);
export const validateAppDataSchema = ajv.compile(appDataSchema);

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const parseJson = <T>(value: string | null, fallback: T): T => {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

const pickString = (value: unknown, fallback = '') => (typeof value === 'string' ? value : fallback);
const pickArray = <T>(value: unknown, fallback: T[] = []): T[] => (Array.isArray(value) ? value : fallback);
const pickRecord = (value: unknown) => (isPlainObject(value) ? value : {});
const pickStringArray = (value: unknown, fallback: string[] = []) => pickArray<unknown>(value, fallback).map((item) => String(item));
const pickStringRecord = (value: unknown) =>
  Object.fromEntries(
    Object.entries(pickRecord(value))
      .filter(([, entry]) => typeof entry === 'string')
      .map(([key, entry]) => [key, String(entry)])
  ) as Record<string, string>;
const pickDoseRecord = (value: unknown) =>
  Object.fromEntries(
    Object.entries(pickRecord(value))
      .filter(([, entry]) => entry === 'taper' || entry === 'baseline' || entry === 'boost')
      .map(([key, entry]) => [key, entry])
  ) as Record<string, 'taper' | 'baseline' | 'boost'>;
const pickNumberRecord = (value: unknown) =>
  Object.fromEntries(
    Object.entries(pickRecord(value))
      .map(([key, entry]) => [key, number(entry)])
      .filter(([, entry]) => Number.isFinite(entry))
  ) as Record<string, number>;
const pickEnum = <T extends readonly string[]>(value: unknown, allowed: T, fallback: T[number]): T[number] =>
  typeof value === 'string' && allowed.includes(value) ? value : fallback;
const finiteNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const normalizePrimaryGoal = (value: unknown, fallback: AppData['programTemplate']['primaryGoal'] = 'hypertrophy'): AppData['programTemplate']['primaryGoal'] => {
  const text = String(value || '').trim();
  const normalized = text.toLowerCase().replace(/[\s-]+/g, '_');
  if (text === '增肌' || text === '肌肥大' || normalized === 'hypertrophy' || normalized === 'muscle_gain' || normalized === 'musclegrowth' || normalized === 'muscle_growth') return 'hypertrophy';
  if (text === '力量' || normalized === 'strength') return 'strength';
  if (text === '减脂' || normalized === 'fat_loss' || normalized === 'fatloss') return 'fat_loss';
  return pickEnum(value, PRIMARY_GOALS, fallback);
};

const normalizeTrainingMode = (value: unknown, fallback: AppData['trainingMode'] = 'hybrid'): AppData['trainingMode'] => {
  const text = String(value || '').trim();
  const normalized = text.toLowerCase().replace(/[\s-]+/g, '_');
  if (text === '增肌' || text === '肌肥大' || normalized === 'hypertrophy' || normalized === 'muscle_gain' || normalized === 'musclegrowth' || normalized === 'muscle_growth') return 'hypertrophy';
  if (text === '力量' || normalized === 'strength') return 'strength';
  if (text === '综合' || normalized === 'hybrid') return 'hybrid';
  return pickEnum(value, TRAINING_MODES, fallback);
};

const normalizeExerciseIdentity = (raw: Record<string, unknown>, rawId: string) => {
  const baseId = pickString(raw.baseId, rawId.split('__auto_alt')[0] || rawId);
  const originalExerciseId = pickString(raw.originalExerciseId, pickString(raw.replacedFromId, baseId));
  const rawReplacementId = pickString(raw.replacementExerciseId);
  const rawActualId = pickString(raw.actualExerciseId, rawReplacementId || rawId);
  const validReplacementId = validateReplacementExerciseId(rawReplacementId) ? rawReplacementId : '';
  const validActualId = validateReplacementExerciseId(rawActualId) ? rawActualId : '';
  const hasSyntheticId = [rawId, rawActualId, rawReplacementId].some(isSyntheticReplacementExerciseId);
  const fallbackActualId = originalExerciseId || baseId || rawId;
  const actualExerciseId = validActualId || validReplacementId || (hasSyntheticId ? fallbackActualId : rawActualId || fallbackActualId);
  const replacementExerciseId = validReplacementId || (validActualId && validActualId !== originalExerciseId ? validActualId : '');
  const id = hasSyntheticId ? actualExerciseId : rawId;
  const warning = hasSyntheticId ? [pickString(raw.warning), '已修复无效替代动作 ID，避免继续使用合成动作 ID。'].filter(Boolean).join(' / ') : pickString(raw.warning);

  return {
    id,
    baseId,
    canonicalExerciseId: pickString(raw.canonicalExerciseId, actualExerciseId || id),
    originalExerciseId,
    actualExerciseId,
    replacementExerciseId,
    warning,
  };
};

export const sanitizeHealthIntegrationSettings = (settings: unknown): HealthIntegrationSettings => {
  const raw = pickRecord(settings);
  return {
    useHealthDataForReadiness:
      typeof raw.useHealthDataForReadiness === 'boolean'
        ? raw.useHealthDataForReadiness
        : DEFAULT_HEALTH_INTEGRATION_SETTINGS.useHealthDataForReadiness,
    showExternalWorkoutsInCalendar:
      typeof raw.showExternalWorkoutsInCalendar === 'boolean'
        ? raw.showExternalWorkoutsInCalendar
        : DEFAULT_HEALTH_INTEGRATION_SETTINGS.showExternalWorkoutsInCalendar,
  };
};

const LOAD_FEEDBACK_VALUES = ['too_light', 'good', 'too_heavy'] as const;
const SESSION_DATA_FLAGS = ['normal', 'test', 'excluded'] as const;
const WEIGHT_UNITS = ['kg', 'lb'] as const;
const HEALTH_DATA_SOURCES = ['apple_health_export', 'apple_watch_workout', 'third_party_csv', 'manual_import', 'unknown'] as const;
const HEALTH_METRIC_TYPES = [
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

export const DEFAULT_HEALTH_INTEGRATION_SETTINGS: HealthIntegrationSettings = {
  useHealthDataForReadiness: true,
  showExternalWorkoutsInCalendar: true,
};

const LEGACY_TEXT_MAP: Record<string, string> = {
  poor: '差',
  ok: '一般',
  good: '好',
  low: '低',
  medium: '中',
  high: '高',
};

const normalizeTextValue = (value: unknown) => {
  const text = typeof value === 'string' ? value : '';
  return LEGACY_TEXT_MAP[text] || text;
};

const coerceSchemaVersion = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;
};

const migrateLegacySet = (set: unknown, fallbackId: string) => {
  const raw = pickRecord(set);
  return {
    id: pickString(raw.id, fallbackId),
    type: pickString(raw.type, 'straight'),
    weight: Math.max(0, number(raw.weight)),
    actualWeightKg: Number.isFinite(number(raw.actualWeightKg)) ? Math.max(0, number(raw.actualWeightKg)) : undefined,
    displayWeight: Number.isFinite(number(raw.displayWeight)) ? Math.max(0, number(raw.displayWeight)) : undefined,
    displayUnit: pickEnum(raw.displayUnit, WEIGHT_UNITS, 'kg'),
    reps: Math.max(0, number(raw.reps)),
    rpe: raw.rpe ?? '',
    rir: raw.rir ?? '',
    note: pickString(raw.note),
    painFlag: Boolean(raw.painFlag),
    done: Boolean(raw.done),
    completedAt: pickString(raw.completedAt),
  };
};

const migrateLegacyExercise = (exercise: unknown) => {
  const raw = pickRecord(exercise);
  const rawId = pickString(raw.id) || pickString(raw.baseId) || `exercise-${Date.now()}`;
  const identity = normalizeExerciseIdentity(raw, rawId);
  return {
    ...raw,
    ...identity,
    sameTemplateSlot: Boolean(raw.sameTemplateSlot) || Boolean(identity.replacementExerciseId),
    replacementReason: pickString(raw.replacementReason),
    prIndependent: Boolean(raw.prIndependent) || Boolean(identity.replacementExerciseId),
    originalName: pickString(raw.originalName, pickString(raw.name)),
    techniqueStandard: {
      ...(isPlainObject(raw.techniqueStandard) ? raw.techniqueStandard : {}),
      ...(typeof raw.rom === 'string' ? { rom: raw.rom } : {}),
      ...(typeof raw.tempo === 'string' ? { tempo: raw.tempo } : {}),
      ...(typeof raw.stopRule === 'string' ? { stopRule: raw.stopRule } : {}),
    },
    sets: Array.isArray(raw.sets)
      ? raw.sets.map((set, index) => migrateLegacySet(set, `${identity.id}-${index + 1}`))
      : raw.sets,
  };
};

const migrateLegacySession = (session: unknown) => {
  if (!isPlainObject(session)) return null;
  return {
    ...session,
    templateId: pickString(session.templateId, pickString(pickRecord(session.template).id)),
    templateName: pickString(session.templateName, pickString(pickRecord(session.template).name, pickString(session.template))),
    status: pickRecord(session.status).sleep || pickRecord(session.status).energy ? session.status : session.todayStatus ?? session.preSessionCheck ?? {},
    exercises: pickArray(session.exercises).map(migrateLegacyExercise),
  };
};

const migrateToV1 = (raw: Record<string, unknown>) => {
  const settings = pickRecord(raw.settings);
  return {
    ...raw,
    activeSession: raw.activeSession ?? raw.currentSession ?? null,
    todayStatus: raw.todayStatus ?? raw.status ?? raw.readiness ?? {},
    bodyWeights: raw.bodyWeights ?? raw.weightHistory ?? raw.weights ?? [],
    userProfile: raw.userProfile ?? raw.profile ?? null,
    screeningProfile: raw.screeningProfile ?? raw.screening ?? null,
    programTemplate: raw.programTemplate ?? raw.program ?? null,
    selectedTemplateId: raw.selectedTemplateId ?? raw.selectedTemplate ?? settings.selectedTemplateId ?? 'push-a',
    trainingMode: raw.trainingMode ?? raw.mode ?? settings.trainingMode ?? 'hybrid',
    settings,
    schemaVersion: 1,
  };
};

const migrateToV2 = (raw: Record<string, unknown>) => ({
  ...raw,
  history: pickArray(raw.history).map(migrateLegacySession).filter(Boolean),
  activeSession: migrateLegacySession(raw.activeSession),
  schemaVersion: 2,
});

const migrateToV3 = (raw: Record<string, unknown>) => {
  const screening = pickRecord(raw.screeningProfile);
  const adaptive = pickRecord(screening.adaptiveState);

  return {
    ...raw,
    screeningProfile: {
      ...screening,
      adaptiveState: {
      ...adaptive,
        issueScores: pickNumberRecord(adaptive.issueScores),
        painByExercise: pickNumberRecord(adaptive.painByExercise),
        performanceDrops: pickStringArray(adaptive.performanceDrops),
        improvingIssues: pickStringArray(adaptive.improvingIssues),
        moduleDose: pickDoseRecord(adaptive.moduleDose),
        lastUpdated: pickString(adaptive.lastUpdated),
      },
    },
    schemaVersion: 3,
  };
};

const migrateToV4 = (raw: Record<string, unknown>) => ({
  ...raw,
  settings: {
    ...pickRecord(raw.settings),
    selectedTemplateId: raw.selectedTemplateId ?? pickRecord(raw.settings).selectedTemplateId,
    trainingMode: raw.trainingMode ?? pickRecord(raw.settings).trainingMode,
  },
  schemaVersion: 4,
});

const migrateToV5 = (raw: Record<string, unknown>) => ({
  ...raw,
  schemaVersion: STORAGE_VERSION,
  settings: {
    ...pickRecord(raw.settings),
    schemaVersion: STORAGE_VERSION,
  },
});

const migrateToV6 = (raw: Record<string, unknown>) => ({
  ...raw,
  history: pickArray(raw.history).map((session) => {
    const sessionRecord = pickRecord(session);
    return {
      ...sessionRecord,
      supportExerciseLogs: Array.isArray(sessionRecord.supportExerciseLogs) ? sessionRecord.supportExerciseLogs : [],
      restTimerState: null,
    };
  }),
  activeSession: isPlainObject(raw.activeSession)
    ? {
        ...raw.activeSession,
        supportExerciseLogs: Array.isArray(pickRecord(raw.activeSession).supportExerciseLogs)
          ? pickRecord(raw.activeSession).supportExerciseLogs
          : [],
        restTimerState: pickRecord(raw.activeSession).restTimerState ?? null,
      }
    : raw.activeSession,
  mesocyclePlan: raw.mesocyclePlan ?? createMesocyclePlan(),
  programAdjustmentDrafts: Array.isArray(raw.programAdjustmentDrafts) ? raw.programAdjustmentDrafts : [],
  programAdjustmentHistory: Array.isArray(raw.programAdjustmentHistory) ? raw.programAdjustmentHistory : [],
  activeProgramTemplateId: typeof raw.activeProgramTemplateId === 'string' ? raw.activeProgramTemplateId : pickRecord(raw.settings).activeProgramTemplateId,
  schemaVersion: STORAGE_VERSION,
  settings: {
    ...pickRecord(raw.settings),
    schemaVersion: STORAGE_VERSION,
  },
});

export const migrateTrainingData = (rawInput: unknown) => {
  let migrated = isPlainObject(rawInput) ? clone(rawInput) : {};
  let version = coerceSchemaVersion(migrated.schemaVersion ?? pickRecord(migrated.settings).schemaVersion);

  if (version < 1) {
    migrated = migrateToV1(migrated);
    version = 1;
  }
  if (version < 2) {
    migrated = migrateToV2(migrated);
    version = 2;
  }
  if (version < 3) {
    migrated = migrateToV3(migrated);
    version = 3;
  }
  if (version < 4) {
    migrated = migrateToV4(migrated);
    version = 4;
  }
  if (version < 5) {
    migrated = migrateToV5(migrated);
    version = 5;
  }
  if (version < STORAGE_VERSION) {
    migrated = migrateToV6(migrated);
  }

  return migrated;
};

export const validateSupportLibraryShape = () => {
  const problems: string[] = [];

  CORRECTION_MODULES.forEach((module) => {
    if (!module.id || !module.targetIssue || !Array.isArray(module.exercises) || !module.exercises.length) {
      problems.push(`correction:${module.id || 'unknown'}`);
    }
  });

  FUNCTIONAL_ADDONS.forEach((addon) => {
    if (!addon.id || !addon.targetAbility || !Array.isArray(addon.exercises) || !addon.exercises.length) {
      problems.push(`functional:${addon.id || 'unknown'}`);
    }
  });

  if (problems.length) {
    console.warn('IronPath support library validation warnings:', problems.join(', '));
  }
};

export const validateSupportLibraryReferences = () => {
  const missing = validateSupportExerciseReferences([...CORRECTION_MODULES, ...FUNCTIONAL_ADDONS]);
  if (!SUPPORT_EXERCISE_LIBRARY.length) {
    console.warn('IronPath support exercise library is empty.');
  }
  return missing;
};

export const sanitizeUserProfile = (profile: unknown): UserProfile => {
  const raw = pickRecord(profile);
  return {
    ...DEFAULT_USER_PROFILE,
    ...raw,
    sex: pickEnum(raw.sex, SEX_OPTIONS, DEFAULT_USER_PROFILE.sex),
    age: clamp(number(raw.age) || DEFAULT_USER_PROFILE.age, 14, 90),
    heightCm: clamp(number(raw.heightCm) || DEFAULT_USER_PROFILE.heightCm, 100, 240),
    weightKg: clamp(number(raw.weightKg) || DEFAULT_USER_PROFILE.weightKg, 30, 250),
    trainingLevel: pickEnum(raw.trainingLevel, TRAINING_LEVELS, DEFAULT_USER_PROFILE.trainingLevel),
    primaryGoal: normalizePrimaryGoal(raw.primaryGoal, DEFAULT_USER_PROFILE.primaryGoal),
    weeklyTrainingDays: clamp(number(raw.weeklyTrainingDays) || DEFAULT_USER_PROFILE.weeklyTrainingDays, 1, 7),
    sessionDurationMin: clamp(number(raw.sessionDurationMin) || DEFAULT_USER_PROFILE.sessionDurationMin, 20, 180),
    secondaryPreferences: pickStringArray(raw.secondaryPreferences, DEFAULT_USER_PROFILE.secondaryPreferences) as UserProfile['secondaryPreferences'],
    equipmentAccess: pickStringArray(raw.equipmentAccess, DEFAULT_USER_PROFILE.equipmentAccess) as UserProfile['equipmentAccess'],
    injuryFlags: pickStringArray(raw.injuryFlags),
    painNotes: pickStringArray(raw.painNotes),
  };
};

const repairProgramTemplateCandidate = (programTemplate: unknown): ProgramTemplate => {
  const raw = pickRecord(programTemplate);
  return {
    ...DEFAULT_PROGRAM_TEMPLATE,
    ...raw,
    primaryGoal: normalizePrimaryGoal(raw.primaryGoal, DEFAULT_PROGRAM_TEMPLATE.primaryGoal),
    splitType: pickEnum(raw.splitType, SPLIT_TYPES, DEFAULT_PROGRAM_TEMPLATE.splitType),
    daysPerWeek: clamp(number(raw.daysPerWeek) || DEFAULT_PROGRAM_TEMPLATE.daysPerWeek, 1, 7),
    correctionStrategy: pickEnum(raw.correctionStrategy, CORRECTION_STRATEGIES, DEFAULT_PROGRAM_TEMPLATE.correctionStrategy),
    functionalStrategy: pickEnum(raw.functionalStrategy, FUNCTIONAL_STRATEGIES, DEFAULT_PROGRAM_TEMPLATE.functionalStrategy),
    weeklyMuscleTargets: {
      ...DEFAULT_PROGRAM_TEMPLATE.weeklyMuscleTargets,
      ...pickNumberRecord(raw.weeklyMuscleTargets),
    },
    dayTemplates: pickArray(raw.dayTemplates),
  };
};

export const sanitizeProgramTemplate = (programTemplate: unknown): ProgramTemplate => {
  const candidate = repairProgramTemplateCandidate(programTemplate);

  if (validateProgramSchema(candidate)) return candidate;

  const repaired = repairProgramTemplateCandidate(candidate);
  if (validateProgramSchema(repaired)) {
    console.warn('IronPath program template schema validation required repair.', validateProgramSchema.errors);
    return repaired;
  }

  console.warn('IronPath program template schema validation still failed after repair.', validateProgramSchema.errors);
  return {
    ...DEFAULT_PROGRAM_TEMPLATE,
    ...repaired,
    weeklyMuscleTargets: {
      ...DEFAULT_PROGRAM_TEMPLATE.weeklyMuscleTargets,
      ...repaired.weeklyMuscleTargets,
    },
    dayTemplates: pickArray(repaired.dayTemplates),
  };
};

export const sanitizeScreeningProfile = (screening: unknown, history: TrainingSession[]): ScreeningProfile => {
  const raw = pickRecord(screening);
  const merged = {
    ...DEFAULT_SCREENING_PROFILE,
    ...raw,
    postureFlags: { ...DEFAULT_SCREENING_PROFILE.postureFlags, ...pickRecord(raw.postureFlags) },
    movementFlags: { ...DEFAULT_SCREENING_PROFILE.movementFlags, ...pickRecord(raw.movementFlags) },
    painTriggers: pickStringArray(raw.painTriggers),
    restrictedExercises: pickStringArray(raw.restrictedExercises),
    correctionPriority: pickStringArray(raw.correctionPriority, DEFAULT_SCREENING_PROFILE.correctionPriority),
    adaptiveState: {
      ...DEFAULT_SCREENING_PROFILE.adaptiveState,
      ...pickRecord(raw.adaptiveState),
      issueScores: pickNumberRecord(pickRecord(raw.adaptiveState).issueScores),
      painByExercise: pickNumberRecord(pickRecord(raw.adaptiveState).painByExercise),
      performanceDrops: pickStringArray(pickRecord(raw.adaptiveState).performanceDrops),
      improvingIssues: pickStringArray(pickRecord(raw.adaptiveState).improvingIssues),
      moduleDose: pickDoseRecord(pickRecord(raw.adaptiveState).moduleDose),
      lastUpdated: pickString(pickRecord(raw.adaptiveState).lastUpdated),
    },
  };

  return reconcileScreeningProfile(merged, history);
};

const sanitizeSet = (set: unknown, fallbackId: string, fallbackType = 'straight') => {
  const raw = pickRecord(set);
  const weight = Math.max(0, number(raw.actualWeightKg ?? raw.weight));
  const reps = Math.max(0, number(raw.reps));
  const done = typeof raw.done === 'boolean' ? raw.done : weight > 0 && reps > 0;
  return {
    id: pickString(raw.id, fallbackId),
    type: pickString(raw.type || raw.setType || raw.stepType, fallbackType),
    weight,
    actualWeightKg: Number.isFinite(number(raw.actualWeightKg ?? raw.weight)) ? weight : undefined,
    displayWeight: Number.isFinite(number(raw.displayWeight)) ? Math.max(0, number(raw.displayWeight)) : undefined,
    displayUnit: pickEnum(raw.displayUnit, WEIGHT_UNITS, 'kg'),
    reps,
    rpe: raw.rpe ?? '',
    rir: raw.rir ?? '',
    note: pickString(raw.note),
    painFlag: Boolean(raw.painFlag),
    painArea: pickString(raw.painArea),
    painSeverity: Math.max(0, Math.min(5, number(raw.painSeverity) || 0)),
    techniqueQuality: pickString(raw.techniqueQuality, 'acceptable'),
    done,
    completedAt: pickString(raw.completedAt),
  };
};

const sanitizeSupportExerciseLog = (entry: unknown): SupportExerciseLog | null => {
  const raw = pickRecord(entry);
  const moduleId = pickString(raw.moduleId);
  const exerciseId = pickString(raw.exerciseId);
  if (!moduleId || !exerciseId) return null;

  return {
    moduleId,
    exerciseId,
    exerciseName: pickString(raw.exerciseName),
    blockType: pickString(raw.blockType, 'correction') as SupportExerciseLog['blockType'],
    plannedSets: Math.max(0, number(raw.plannedSets)),
    completedSets: Math.max(0, number(raw.completedSets)),
    skippedReason: pickString(raw.skippedReason) as SupportExerciseLog['skippedReason'],
    notes: pickString(raw.notes),
  };
};

const sanitizeExerciseLog = (exercise: unknown) => {
  const raw = pickRecord(exercise);
  const rawId = pickString(raw.id) || pickString(raw.baseId) || 'exercise';
  const identity = normalizeExerciseIdentity(raw, rawId);
  return {
    ...raw,
    ...identity,
    sameTemplateSlot: Boolean(raw.sameTemplateSlot) || Boolean(identity.replacementExerciseId),
    replacementReason: pickString(raw.replacementReason),
    prIndependent: Boolean(raw.prIndependent) || Boolean(identity.replacementExerciseId),
    name: pickString(raw.name),
    muscle: pickString(raw.muscle),
    kind: pickString(raw.kind, 'compound'),
    repMin: Math.max(1, number(raw.repMin || 6)),
    repMax: Math.max(number(raw.repMin || 6), number(raw.repMax || 8)),
    rest: Math.max(30, number(raw.rest || 90)),
    startWeight: Math.max(0, number(raw.startWeight || 0)),
    muscleContribution: isPlainObject(raw.muscleContribution)
      ? Object.fromEntries(Object.entries(raw.muscleContribution).map(([key, value]) => [key, Math.max(0, number(value))]))
      : undefined,
    sets: Array.isArray(raw.sets)
      ? raw.sets.map((set, index) => sanitizeSet(set, `${identity.id}-${index + 1}`))
      : raw.sets,
  };
};

const sanitizeDeloadDecision = (decision: unknown) => {
  const raw = pickRecord(decision);
  if (!Object.keys(raw).length) return undefined;
  return {
    level: pickString(raw.level, 'none'),
    triggered: Boolean(raw.triggered),
    reasons: pickArray(raw.reasons),
    title: pickString(raw.title),
    strategy: pickString(raw.strategy, 'none'),
    volumeMultiplier: Math.max(0.4, Math.min(1, number(raw.volumeMultiplier) || 1)),
    options: pickArray(raw.options),
    autoSwitchTemplateId: pickString(raw.autoSwitchTemplateId),
  };
};

const sanitizeLoadFeedback = (entry: unknown): LoadFeedback | null => {
  const raw = pickRecord(entry);
  const exerciseId = pickString(raw.exerciseId);
  const sessionId = pickString(raw.sessionId);
  const date = pickString(raw.date);
  if (!exerciseId || !sessionId || !date) return null;

  return {
    exerciseId,
    sessionId,
    date,
    feedback: pickEnum(raw.feedback, LOAD_FEEDBACK_VALUES, 'good'),
    note: pickString(raw.note),
  };
};

const sanitizeRestTimerState = (timer: unknown): RestTimerState | null => {
  const raw = pickRecord(timer);
  const exerciseId = pickString(raw.exerciseId);
  const startedAt = pickString(raw.startedAt);
  if (!exerciseId || !startedAt) return null;

  return {
    exerciseId,
    setIndex: Math.max(0, Math.floor(number(raw.setIndex))),
    startedAt,
    durationSec: Math.max(0, Math.round(number(raw.durationSec))),
    isRunning: Boolean(raw.isRunning),
    pausedRemainingSec: Math.max(0, Math.round(number(raw.pausedRemainingSec))),
    label: pickString(raw.label),
  };
};

const ADJUSTMENT_STATUSES = ['draft', 'previewed', 'applied', 'rolled_back', 'dismissed', 'stale'] as const;
const ADJUSTMENT_CHANGE_TYPES = ['add_sets', 'remove_sets', 'add_new_exercise', 'swap_exercise', 'reduce_support', 'increase_support', 'keep'] as const;

const sanitizeAdjustmentChange = (entry: unknown, fallbackId: string) => {
  const raw = pickRecord(entry);
  return {
    id: pickString(raw.id, fallbackId),
    type: pickEnum(raw.type, ADJUSTMENT_CHANGE_TYPES, 'keep'),
    dayTemplateId: pickString(raw.dayTemplateId) || undefined,
    dayTemplateName: pickString(raw.dayTemplateName) || undefined,
    exerciseId: pickString(raw.exerciseId) || undefined,
    exerciseName: pickString(raw.exerciseName) || undefined,
    replacementExerciseId: pickString(raw.replacementExerciseId) || undefined,
    replacementExerciseName: pickString(raw.replacementExerciseName) || undefined,
    muscleId: pickString(raw.muscleId) || undefined,
    setsDelta: Number.isFinite(number(raw.setsDelta)) ? Math.round(number(raw.setsDelta)) : undefined,
    sets: Number.isFinite(number(raw.sets)) ? Math.max(1, Math.round(number(raw.sets))) : undefined,
    repMin: Number.isFinite(number(raw.repMin)) ? Math.max(1, Math.round(number(raw.repMin))) : undefined,
    repMax: Number.isFinite(number(raw.repMax)) ? Math.max(1, Math.round(number(raw.repMax))) : undefined,
    restSec: Number.isFinite(number(raw.restSec)) ? Math.max(30, Math.round(number(raw.restSec))) : undefined,
    insertAfterExerciseId: pickString(raw.insertAfterExerciseId) || undefined,
    insertPositionLabel: pickString(raw.insertPositionLabel) || undefined,
    previewNote: pickString(raw.previewNote) || undefined,
    skipped: Boolean(raw.skipped),
    skipReason: pickString(raw.skipReason) || undefined,
    reason: pickString(raw.reason),
    sourceRecommendationId: pickString(raw.sourceRecommendationId) || undefined,
  };
};

const sanitizeProgramAdjustmentDrafts = (drafts: unknown): ProgramAdjustmentDraft[] =>
  pickArray(drafts).map((draft, draftIndex) => {
    const raw = pickRecord(draft);
    const id = pickString(raw.id, `adjustment-draft-${draftIndex + 1}`);
    return {
      id,
      createdAt: pickString(raw.createdAt, new Date().toISOString()),
      status: pickEnum(raw.status, ADJUSTMENT_STATUSES, 'draft'),
      sourceProgramTemplateId: pickString(raw.sourceProgramTemplateId),
      experimentalProgramTemplateId: pickString(raw.experimentalProgramTemplateId) || undefined,
      sourceTemplateSnapshotHash: pickString(raw.sourceTemplateSnapshotHash) || undefined,
      sourceTemplateUpdatedAt: pickString(raw.sourceTemplateUpdatedAt) || undefined,
      title: pickString(raw.title, '下周实验调整'),
      summary: pickString(raw.summary),
      selectedRecommendationIds: pickStringArray(raw.selectedRecommendationIds),
      changes: pickArray(raw.changes).map((change, index) => sanitizeAdjustmentChange(change, `${id}-change-${index + 1}`)),
      confidence: pickEnum(raw.confidence, ['low', 'medium', 'high'] as const, 'low'),
      notes: pickStringArray(raw.notes),
    };
  });

const sanitizeProgramAdjustmentHistory = (history: unknown): ProgramAdjustmentHistoryItem[] =>
  pickArray(history)
    .map((item, itemIndex) => {
      const raw = pickRecord(item);
      const sourceProgramTemplateId = pickString(raw.sourceProgramTemplateId);
      const experimentalProgramTemplateId = pickString(raw.experimentalProgramTemplateId);
      if (!sourceProgramTemplateId || !experimentalProgramTemplateId) return null;
      const id = pickString(raw.id, `adjustment-history-${itemIndex + 1}`);
      return {
        id,
        appliedAt: pickString(raw.appliedAt, new Date().toISOString()),
        sourceProgramTemplateId,
        experimentalProgramTemplateId,
        sourceProgramTemplateName: pickString(raw.sourceProgramTemplateName) || undefined,
        experimentalProgramTemplateName: pickString(raw.experimentalProgramTemplateName) || undefined,
        mainChangeSummary: pickString(raw.mainChangeSummary) || undefined,
        selectedRecommendationIds: pickStringArray(raw.selectedRecommendationIds),
        changes: pickArray(raw.changes).map((change, index) => sanitizeAdjustmentChange(change, `${id}-change-${index + 1}`)),
        rollbackAvailable: Boolean(raw.rollbackAvailable) && !raw.rolledBackAt,
        rolledBackAt: pickString(raw.rolledBackAt) || undefined,
        sourceProgramSnapshot: isPlainObject(raw.sourceProgramSnapshot) ? sanitizeProgramTemplate(raw.sourceProgramSnapshot) : undefined,
        effectReview: isPlainObject(raw.effectReview)
          ? (() => {
              const effect = pickRecord(raw.effectReview);
              const metrics = pickRecord(effect.metrics);
              return {
                historyItemId: pickString(effect.historyItemId, id),
                status: pickString(effect.status, 'neutral') as NonNullable<ProgramAdjustmentHistoryItem['effectReview']>['status'],
                confidence: pickString(effect.confidence, 'low') as NonNullable<ProgramAdjustmentHistoryItem['effectReview']>['confidence'],
                summary: pickString(effect.summary),
                metrics: {
                  targetMuscleChange: Number.isFinite(number(metrics.targetMuscleChange)) ? number(metrics.targetMuscleChange) : undefined,
                  adherenceChange: Number.isFinite(number(metrics.adherenceChange)) ? number(metrics.adherenceChange) : undefined,
                  painSignalChange: Number.isFinite(number(metrics.painSignalChange)) ? number(metrics.painSignalChange) : undefined,
                  effectiveVolumeChange: Number.isFinite(number(metrics.effectiveVolumeChange)) ? number(metrics.effectiveVolumeChange) : undefined,
                  beforeSessionCount: Number.isFinite(number(metrics.beforeSessionCount)) ? number(metrics.beforeSessionCount) : undefined,
                  afterSessionCount: Number.isFinite(number(metrics.afterSessionCount)) ? number(metrics.afterSessionCount) : undefined,
                },
                recommendation: pickString(effect.recommendation, 'collect_more_data') as NonNullable<ProgramAdjustmentHistoryItem['effectReview']>['recommendation'],
              };
            })()
          : undefined,
      };
    })
    .filter(Boolean) as ProgramAdjustmentHistoryItem[];

export const sanitizeSessionLog = (session: unknown): TrainingSession | null => {
  const raw = pickRecord(session);
  if (!Object.keys(raw).length) return null;
  if (!Array.isArray(raw.exercises)) return null;

  return {
    ...raw,
    id: pickString(raw.id, `session-${Date.now()}`),
    date: pickString(raw.date),
    templateId: pickString(raw.templateId),
    templateName: pickString(raw.templateName),
    programTemplateId: pickString(raw.programTemplateId) || pickString(raw.templateId) || undefined,
    programTemplateName: pickString(raw.programTemplateName) || pickString(raw.templateName) || undefined,
    isExperimentalTemplate: Boolean(raw.isExperimentalTemplate),
    dataFlag: pickEnum(raw.dataFlag, SESSION_DATA_FLAGS, 'normal'),
    trainingMode: normalizeTrainingMode(raw.trainingMode, 'hybrid'),
    status: sanitizeTodayStatus(raw.status),
    exercises: raw.exercises.map(sanitizeExerciseLog),
    correctionBlock: pickArray(raw.correctionBlock),
    functionalBlock: pickArray(raw.functionalBlock),
    supportExerciseLogs: pickArray(raw.supportExerciseLogs).map(sanitizeSupportExerciseLog).filter(Boolean) as SupportExerciseLog[],
    focusWarmupSetLogs: pickArray(raw.focusWarmupSetLogs).map((set, index) => sanitizeSet(set, `warmup-${index + 1}`, 'warmup')),
    focusCompletedWarmupPatterns: pickStringArray(raw.focusCompletedWarmupPatterns),
    focusCompletedStepIds: pickStringArray(raw.focusCompletedStepIds),
    focusSkippedStepIds: pickStringArray(raw.focusSkippedStepIds),
    loadFeedback: pickArray(raw.loadFeedback).map(sanitizeLoadFeedback).filter(Boolean) as LoadFeedback[],
    restTimerState: sanitizeRestTimerState(raw.restTimerState),
    feedbackSummary: isPlainObject(raw.feedbackSummary)
      ? {
          painExercises: pickArray(raw.feedbackSummary.painExercises),
          performanceDrops: pickArray(raw.feedbackSummary.performanceDrops),
          improvingIssues: pickArray(raw.feedbackSummary.improvingIssues),
        }
      : { painExercises: [], performanceDrops: [], improvingIssues: [] },
    deloadDecision: sanitizeDeloadDecision(raw.deloadDecision),
    explanations: pickArray(raw.explanations).map(String),
    editedAt: pickString(raw.editedAt) || undefined,
    editHistory: pickArray(raw.editHistory)
      .map((item) => {
        const entry = pickRecord(item);
        const editedAt = pickString(entry.editedAt);
        if (!editedAt) return null;
        return {
          editedAt,
          fields: pickArray(entry.fields).map(String).filter(Boolean),
          note: pickString(entry.note) || undefined,
        };
      })
      .filter(Boolean) as TrainingSession['editHistory'],
  } as TrainingSession;
};

const sanitizeTemplates = (templates: unknown) => {
  const source = Array.isArray(templates) && templates.length ? templates : INITIAL_TEMPLATES;
  const defaultsByTemplate = new Map(INITIAL_TEMPLATES.map((template) => [template.id, template]));
  const normalized = source.map((template) => {
    const raw = pickRecord(template);
    const defaultTemplate = defaultsByTemplate.get(pickString(raw.id));
    if (!defaultTemplate) return raw;
    const defaultsByExercise = new Map(defaultTemplate.exercises.map((exercise) => [exercise.id, exercise]));
    return {
      ...raw,
      name: defaultTemplate.name,
      focus: defaultTemplate.focus,
      note: defaultTemplate.note,
      sourceTemplateId: pickString(raw.sourceTemplateId) || undefined,
      sourceTemplateName: pickString(raw.sourceTemplateName) || undefined,
      updatedAt: pickString(raw.updatedAt) || undefined,
      appliedAt: pickString(raw.appliedAt) || undefined,
      adjustmentSummary: pickString(raw.adjustmentSummary) || undefined,
      isExperimentalTemplate: Boolean(raw.isExperimentalTemplate),
      exercises: pickArray(raw.exercises, defaultTemplate.exercises).map((exercise) => {
        const exerciseRaw = pickRecord(exercise);
        const clean = defaultsByExercise.get(pickString(exerciseRaw.id));
        return clean
          ? {
              ...exerciseRaw,
              name: clean.name,
              alias: clean.alias,
              muscle: clean.muscle,
              alternatives: clean.alternatives,
              alternativeIds: clean.alternativeIds,
              alternativePriorities: clean.alternativePriorities,
            }
          : exerciseRaw;
      }),
    };
  });
  return hydrateTemplates(normalized as never);
};

const sanitizeBodyWeights = (entries: unknown) =>
  pickArray(entries)
    .map((entry) => {
      const raw = pickRecord(entry);
      return {
        date: pickString(raw.date),
        value: Math.max(0, number(raw.value)),
      };
    })
    .filter((entry) => entry.date && entry.value)
    .sort((a, b) => b.date.localeCompare(a.date));

const sanitizeHealthMetricSamples = (entries: unknown): HealthMetricSample[] =>
  pickArray(entries)
    .map((entry, index) => {
      const raw = pickRecord(entry);
      const metricType = pickString(raw.metricType);
      const value = finiteNumber(raw.value);
      if (!HEALTH_METRIC_TYPES.includes(metricType as (typeof HEALTH_METRIC_TYPES)[number]) || value === undefined) return null;
      const startDate = pickString(raw.startDate);
      if (!startDate) return null;
      return {
        id: pickString(raw.id, `health-sample-${index}`),
        source: pickEnum(raw.source, HEALTH_DATA_SOURCES, 'unknown'),
        sourceName: pickString(raw.sourceName) || undefined,
        deviceSourceName: pickString(raw.deviceSourceName) || undefined,
        metricType: metricType as HealthMetricSample['metricType'],
        startDate,
        endDate: pickString(raw.endDate) || undefined,
        value: Math.max(0, value),
        unit: pickString(raw.unit, ''),
        importedAt: pickString(raw.importedAt, startDate),
        batchId: pickString(raw.batchId) || undefined,
        dataFlag: pickEnum(raw.dataFlag, SESSION_DATA_FLAGS, 'normal'),
        raw: raw.raw,
      };
    })
    .filter(Boolean) as HealthMetricSample[];

const sanitizeImportedWorkoutSamples = (entries: unknown): ImportedWorkoutSample[] =>
  pickArray(entries)
    .map((entry, index) => {
      const raw = pickRecord(entry);
      const startDate = pickString(raw.startDate);
      const endDate = pickString(raw.endDate, startDate);
      const durationMin = finiteNumber(raw.durationMin);
      if (!startDate || !endDate || durationMin === undefined) return null;
      return {
        id: pickString(raw.id, `health-workout-${index}`),
        source: pickEnum(raw.source, HEALTH_DATA_SOURCES, 'unknown'),
        sourceName: pickString(raw.sourceName) || undefined,
        deviceSourceName: pickString(raw.deviceSourceName) || undefined,
        workoutType: pickString(raw.workoutType, '外部活动'),
        startDate,
        endDate,
        durationMin: Math.max(0, durationMin),
        activeEnergyKcal: finiteNumber(raw.activeEnergyKcal),
        avgHeartRate: finiteNumber(raw.avgHeartRate),
        maxHeartRate: finiteNumber(raw.maxHeartRate),
        distanceMeters: finiteNumber(raw.distanceMeters),
        importedAt: pickString(raw.importedAt, startDate),
        batchId: pickString(raw.batchId) || undefined,
        dataFlag: pickEnum(raw.dataFlag, SESSION_DATA_FLAGS, 'normal'),
        raw: raw.raw,
      };
    })
    .filter(Boolean) as ImportedWorkoutSample[];

const sanitizeHealthImportBatches = (entries: unknown): HealthImportBatch[] =>
  pickArray(entries)
    .map((entry, index) => {
      const raw = pickRecord(entry);
      const importedAt = pickString(raw.importedAt);
      if (!importedAt) return null;
      return {
        id: pickString(raw.id, `health-batch-${index}`),
        importedAt,
        source: pickEnum(raw.source, HEALTH_DATA_SOURCES, 'unknown'),
        fileName: pickString(raw.fileName) || undefined,
        sampleCount: Math.max(0, number(raw.sampleCount)),
        workoutCount: Math.max(0, number(raw.workoutCount)),
        newSampleCount: Math.max(0, number(raw.newSampleCount)),
        duplicateSampleCount: Math.max(0, number(raw.duplicateSampleCount)),
        skippedSampleCount: Math.max(0, number(raw.skippedSampleCount)),
        newWorkoutCount: Math.max(0, number(raw.newWorkoutCount)),
        duplicateWorkoutCount: Math.max(0, number(raw.duplicateWorkoutCount)),
        skippedWorkoutCount: Math.max(0, number(raw.skippedWorkoutCount)),
        notes: pickArray(raw.notes).map(String),
        dataFlag: pickEnum(raw.dataFlag, SESSION_DATA_FLAGS, 'normal'),
      };
    })
    .filter(Boolean) as HealthImportBatch[];

const sanitizeTodayStatus = (status: unknown): TodayStatus => {
  const raw = pickRecord(status);
  const soreness = pickArray(raw.soreness, DEFAULT_STATUS.soreness)
    .map(normalizeTextValue)
    .filter((item) => item === '无' || item === '胸' || item === '背' || item === '腿' || item === '肩' || item === '手臂') as TodayStatus['soreness'];
  return {
    ...DEFAULT_STATUS,
    ...raw,
    sleep: pickEnum(normalizeTextValue(raw.sleep), SLEEP_STATES, DEFAULT_STATUS.sleep),
    energy: pickEnum(normalizeTextValue(raw.energy), ENERGY_STATES, DEFAULT_STATUS.energy),
    soreness: soreness.length ? soreness : DEFAULT_STATUS.soreness,
    time: pickString(raw.time, DEFAULT_STATUS.time) as TodayStatus['time'],
  };
};

export const sanitizeData = (saved: unknown): AppData => {
  const migrated = migrateTrainingData(saved);
  const history = pickArray(migrated.history).map(sanitizeSessionLog).filter(Boolean) as TrainingSession[];
  const activeSession = sanitizeSessionLog(migrated.activeSession);
  const templates = sanitizeTemplates(migrated.templates);
  const selectedCandidate = pickString(migrated.selectedTemplateId, 'push-a');
  const selectedTemplateId = templates.some((template) => template.id === selectedCandidate) ? selectedCandidate : templates[0]?.id || 'push-a';
  const activeCandidate = pickString(migrated.activeProgramTemplateId, pickString(pickRecord(migrated.settings).activeProgramTemplateId));
  const activeProgramTemplateId = templates.some((template) => template.id === activeCandidate) ? activeCandidate : selectedTemplateId;
  const trainingMode = normalizeTrainingMode(migrated.trainingMode, 'hybrid');
  const unitSettings = sanitizeUnitSettings(migrated.unitSettings ?? pickRecord(migrated.settings).unitSettings ?? DEFAULT_UNIT_SETTINGS);
  const programAdjustmentDrafts = sanitizeProgramAdjustmentDrafts(migrated.programAdjustmentDrafts);
  const programAdjustmentHistory = sanitizeProgramAdjustmentHistory(migrated.programAdjustmentHistory);
  const healthMetricSamples = sanitizeHealthMetricSamples(migrated.healthMetricSamples ?? pickRecord(migrated.settings).healthMetricSamples);
  const importedWorkoutSamples = sanitizeImportedWorkoutSamples(migrated.importedWorkoutSamples ?? pickRecord(migrated.settings).importedWorkoutSamples);
  const healthImportBatches = sanitizeHealthImportBatches(migrated.healthImportBatches ?? pickRecord(migrated.settings).healthImportBatches);
  const healthIntegrationSettings = sanitizeHealthIntegrationSettings(pickRecord(migrated.settings).healthIntegrationSettings);
  const sanitized: AppData = {
    schemaVersion: STORAGE_VERSION,
    templates,
    history,
    bodyWeights: sanitizeBodyWeights(migrated.bodyWeights),
    activeSession: activeSession?.completed ? null : activeSession,
    selectedTemplateId,
    trainingMode,
    unitSettings,
    todayStatus: sanitizeTodayStatus(migrated.todayStatus),
    userProfile: sanitizeUserProfile(migrated.userProfile),
    screeningProfile: sanitizeScreeningProfile(migrated.screeningProfile, history),
    programTemplate: sanitizeProgramTemplate(migrated.programTemplate),
    mesocyclePlan: sanitizeMesocyclePlan(migrated.mesocyclePlan as MesocyclePlan | undefined),
    programAdjustmentDrafts,
    programAdjustmentHistory,
    activeProgramTemplateId,
    healthMetricSamples,
    importedWorkoutSamples,
    healthImportBatches,
    settings: {
      ...pickRecord(migrated.settings),
      schemaVersion: STORAGE_VERSION,
      selectedTemplateId,
      trainingMode,
      unitSettings,
      healthIntegrationSettings,
      activeProgramTemplateId,
    },
  };

  if (!validateAppDataSchema(sanitized)) {
    console.warn('IronPath app data schema validation required repair.', validateAppDataSchema.errors);
    sanitized.templates = sanitizeTemplates(sanitized.templates);
    sanitized.history = pickArray(sanitized.history).map(sanitizeSessionLog).filter(Boolean) as TrainingSession[];
    sanitized.activeSession = sanitizeSessionLog(sanitized.activeSession);
    sanitized.todayStatus = sanitizeTodayStatus(sanitized.todayStatus);
    sanitized.bodyWeights = sanitizeBodyWeights(sanitized.bodyWeights);
    sanitized.userProfile = sanitizeUserProfile(sanitized.userProfile);
    sanitized.screeningProfile = sanitizeScreeningProfile(sanitized.screeningProfile, sanitized.history);
    sanitized.programTemplate = sanitizeProgramTemplate(sanitized.programTemplate);
    sanitized.mesocyclePlan = sanitizeMesocyclePlan(sanitized.mesocyclePlan);
    sanitized.programAdjustmentDrafts = sanitizeProgramAdjustmentDrafts(sanitized.programAdjustmentDrafts);
    sanitized.programAdjustmentHistory = sanitizeProgramAdjustmentHistory(sanitized.programAdjustmentHistory);
    sanitized.healthMetricSamples = sanitizeHealthMetricSamples(sanitized.healthMetricSamples);
    sanitized.importedWorkoutSamples = sanitizeImportedWorkoutSamples(sanitized.importedWorkoutSamples);
    sanitized.healthImportBatches = sanitizeHealthImportBatches(sanitized.healthImportBatches);
    sanitized.settings.healthIntegrationSettings = sanitizeHealthIntegrationSettings(sanitized.settings.healthIntegrationSettings);
    sanitized.activeProgramTemplateId = sanitized.templates.some((template) => template.id === sanitized.activeProgramTemplateId)
      ? sanitized.activeProgramTemplateId
      : sanitized.selectedTemplateId;
    sanitized.settings = {
      ...pickRecord(sanitized.settings),
      schemaVersion: STORAGE_VERSION,
      selectedTemplateId: sanitized.selectedTemplateId,
      trainingMode: sanitized.trainingMode,
      unitSettings: sanitized.unitSettings,
      healthIntegrationSettings: sanitized.settings.healthIntegrationSettings,
      activeProgramTemplateId: sanitized.activeProgramTemplateId,
    };
  }

  return sanitized;
};

export const emptyData = (): AppData =>
  sanitizeData({
    schemaVersion: STORAGE_VERSION,
    templates: INITIAL_TEMPLATES,
    history: [],
    bodyWeights: [],
    activeSession: null,
    selectedTemplateId: 'push-a',
    trainingMode: 'hybrid',
    unitSettings: DEFAULT_UNIT_SETTINGS,
    todayStatus: DEFAULT_STATUS,
    userProfile: DEFAULT_USER_PROFILE,
    screeningProfile: DEFAULT_SCREENING_PROFILE,
    programTemplate: DEFAULT_PROGRAM_TEMPLATE,
    mesocyclePlan: DEFAULT_MESOCYCLE_PLAN,
    programAdjustmentDrafts: [],
    programAdjustmentHistory: [],
    activeProgramTemplateId: undefined,
    healthMetricSamples: [],
    importedWorkoutSamples: [],
    healthImportBatches: [],
    settings: { healthIntegrationSettings: DEFAULT_HEALTH_INTEGRATION_SETTINGS },
  });

export const loadData = (): AppData => {
  validateSupportLibraryShape();
  validateSupportLibraryReferences();
  if (typeof localStorage === 'undefined') return emptyData();

  try {
    const splitTemplates = localStorage.getItem(STORAGE_KEYS.templates);
    const rawMonolith = splitTemplates ? null : localStorage.getItem(STORAGE_KEY);
    if (!splitTemplates && !rawMonolith) return emptyData();

    const settings = parseJson(localStorage.getItem(STORAGE_KEYS.settings), {});
    const saved = splitTemplates
      ? {
          schemaVersion: coerceSchemaVersion(localStorage.getItem(STORAGE_KEYS.version)) || coerceSchemaVersion(pickRecord(settings).schemaVersion),
          templates: parseJson(localStorage.getItem(STORAGE_KEYS.templates), []),
          history: parseJson(localStorage.getItem(STORAGE_KEYS.history), []),
          activeSession: parseJson(localStorage.getItem(STORAGE_KEYS.activeSession), null),
          todayStatus: parseJson(localStorage.getItem(STORAGE_KEYS.todayStatus), {}),
          bodyWeights: parseJson(localStorage.getItem(STORAGE_KEYS.bodyWeights), []),
          userProfile: parseJson(localStorage.getItem(STORAGE_KEYS.userProfile), null),
          screeningProfile: parseJson(localStorage.getItem(STORAGE_KEYS.screeningProfile), null),
          programTemplate: parseJson(localStorage.getItem(STORAGE_KEYS.programTemplate), null),
          mesocyclePlan: parseJson(localStorage.getItem(STORAGE_KEYS.mesocyclePlan), null),
          healthMetricSamples: parseJson(localStorage.getItem(STORAGE_KEYS.healthMetricSamples), pickRecord(settings).healthMetricSamples || []),
          importedWorkoutSamples: parseJson(localStorage.getItem(STORAGE_KEYS.importedWorkoutSamples), pickRecord(settings).importedWorkoutSamples || []),
          healthImportBatches: parseJson(localStorage.getItem(STORAGE_KEYS.healthImportBatches), pickRecord(settings).healthImportBatches || []),
          programAdjustmentDrafts: pickRecord(settings).programAdjustmentDrafts,
          programAdjustmentHistory: pickRecord(settings).programAdjustmentHistory,
          activeProgramTemplateId: pickRecord(settings).activeProgramTemplateId,
          selectedTemplateId: pickRecord(settings).selectedTemplateId,
          trainingMode: pickRecord(settings).trainingMode,
          unitSettings: pickRecord(settings).unitSettings,
          settings,
        }
      : parseJson(rawMonolith, {});

    return sanitizeData(saved);
  } catch (error) {
    console.error('Failed to load training data', error);
    return emptyData();
  }
};

export const saveData = (data: AppData) => {
  if (typeof localStorage === 'undefined') return;
  const sanitized = sanitizeData(data);

  localStorage.setItem(STORAGE_KEYS.version, String(STORAGE_VERSION));
  localStorage.setItem(STORAGE_KEYS.templates, JSON.stringify(sanitized.templates || []));
  localStorage.setItem(STORAGE_KEYS.history, JSON.stringify(sanitized.history || []));
  localStorage.setItem(STORAGE_KEYS.activeSession, JSON.stringify(sanitized.activeSession || null));
  localStorage.setItem(STORAGE_KEYS.todayStatus, JSON.stringify(sanitized.todayStatus || DEFAULT_STATUS));
  localStorage.setItem(STORAGE_KEYS.bodyWeights, JSON.stringify(sanitized.bodyWeights || []));
  localStorage.setItem(STORAGE_KEYS.userProfile, JSON.stringify(sanitized.userProfile || DEFAULT_USER_PROFILE));
  localStorage.setItem(STORAGE_KEYS.screeningProfile, JSON.stringify(sanitized.screeningProfile || DEFAULT_SCREENING_PROFILE));
  localStorage.setItem(STORAGE_KEYS.programTemplate, JSON.stringify(sanitized.programTemplate || DEFAULT_PROGRAM_TEMPLATE));
  localStorage.setItem(STORAGE_KEYS.mesocyclePlan, JSON.stringify(sanitized.mesocyclePlan || DEFAULT_MESOCYCLE_PLAN));
  localStorage.setItem(STORAGE_KEYS.healthMetricSamples, JSON.stringify(sanitized.healthMetricSamples || []));
  localStorage.setItem(STORAGE_KEYS.importedWorkoutSamples, JSON.stringify(sanitized.importedWorkoutSamples || []));
  localStorage.setItem(STORAGE_KEYS.healthImportBatches, JSON.stringify(sanitized.healthImportBatches || []));
  localStorage.setItem(
    STORAGE_KEYS.settings,
    JSON.stringify({
      ...(sanitized.settings || {}),
      schemaVersion: STORAGE_VERSION,
      selectedTemplateId: sanitized.selectedTemplateId,
      trainingMode: sanitized.trainingMode,
      unitSettings: sanitized.unitSettings,
      healthIntegrationSettings: sanitized.settings.healthIntegrationSettings || DEFAULT_HEALTH_INTEGRATION_SETTINGS,
      activeProgramTemplateId: sanitized.activeProgramTemplateId,
      programAdjustmentDrafts: sanitized.programAdjustmentDrafts || [],
      programAdjustmentHistory: sanitized.programAdjustmentHistory || [],
    })
  );
};
