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
import { clamp, clone, createMesocyclePlan, hydrateTemplates, number, reconcileScreeningProfile, sanitizeMesocyclePlan } from '../engines/trainingEngine';

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

const LOAD_FEEDBACK_VALUES = ['too_light', 'good', 'too_heavy'] as const;

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
  return {
    ...raw,
    id: rawId,
    baseId: pickString(raw.baseId, rawId),
    canonicalExerciseId: pickString(raw.canonicalExerciseId, raw.replacedFromId ? rawId : pickString(raw.baseId, rawId)),
    originalName: pickString(raw.originalName, pickString(raw.name)),
    techniqueStandard: {
      ...(isPlainObject(raw.techniqueStandard) ? raw.techniqueStandard : {}),
      ...(typeof raw.rom === 'string' ? { rom: raw.rom } : {}),
      ...(typeof raw.tempo === 'string' ? { tempo: raw.tempo } : {}),
      ...(typeof raw.stopRule === 'string' ? { stopRule: raw.stopRule } : {}),
    },
    sets: Array.isArray(raw.sets)
      ? raw.sets.map((set, index) => migrateLegacySet(set, `${rawId}-${index + 1}`))
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
    primaryGoal: pickEnum(raw.primaryGoal, PRIMARY_GOALS, DEFAULT_USER_PROFILE.primaryGoal),
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
    primaryGoal: pickEnum(raw.primaryGoal, PRIMARY_GOALS, DEFAULT_PROGRAM_TEMPLATE.primaryGoal),
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

const sanitizeSet = (set: unknown, fallbackId: string) => {
  const raw = pickRecord(set);
  return {
    id: pickString(raw.id, fallbackId),
    type: pickString(raw.type, 'straight'),
    weight: Math.max(0, number(raw.weight)),
    reps: Math.max(0, number(raw.reps)),
    rpe: raw.rpe ?? '',
    rir: raw.rir ?? '',
    note: pickString(raw.note),
    painFlag: Boolean(raw.painFlag),
    painArea: pickString(raw.painArea),
    painSeverity: Math.max(0, Math.min(5, number(raw.painSeverity) || 0)),
    techniqueQuality: pickString(raw.techniqueQuality, 'acceptable'),
    done: Boolean(raw.done),
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
  return {
    ...raw,
    id: rawId,
    baseId: pickString(raw.baseId, rawId),
    canonicalExerciseId: pickString(raw.canonicalExerciseId, raw.replacedFromId ? rawId : pickString(raw.baseId, rawId)),
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
      ? raw.sets.map((set, index) => sanitizeSet(set, `${rawId}-${index + 1}`))
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

const ADJUSTMENT_STATUSES = ['draft', 'previewed', 'applied', 'rolled_back', 'dismissed'] as const;
const ADJUSTMENT_CHANGE_TYPES = ['add_sets', 'remove_sets', 'swap_exercise', 'reduce_support', 'increase_support', 'keep'] as const;

const sanitizeAdjustmentChange = (entry: unknown, fallbackId: string) => {
  const raw = pickRecord(entry);
  return {
    id: pickString(raw.id, fallbackId),
    type: pickEnum(raw.type, ADJUSTMENT_CHANGE_TYPES, 'keep'),
    dayTemplateId: pickString(raw.dayTemplateId) || undefined,
    exerciseId: pickString(raw.exerciseId) || undefined,
    replacementExerciseId: pickString(raw.replacementExerciseId) || undefined,
    muscleId: pickString(raw.muscleId) || undefined,
    setsDelta: Number.isFinite(number(raw.setsDelta)) ? Math.round(number(raw.setsDelta)) : undefined,
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
        selectedRecommendationIds: pickStringArray(raw.selectedRecommendationIds),
        changes: pickArray(raw.changes).map((change, index) => sanitizeAdjustmentChange(change, `${id}-change-${index + 1}`)),
        rollbackAvailable: Boolean(raw.rollbackAvailable) && !raw.rolledBackAt,
        rolledBackAt: pickString(raw.rolledBackAt) || undefined,
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
    trainingMode: pickEnum(raw.trainingMode, TRAINING_MODES, 'hybrid'),
    status: sanitizeTodayStatus(raw.status),
    exercises: raw.exercises.map(sanitizeExerciseLog),
    correctionBlock: pickArray(raw.correctionBlock),
    functionalBlock: pickArray(raw.functionalBlock),
    supportExerciseLogs: pickArray(raw.supportExerciseLogs).map(sanitizeSupportExerciseLog).filter(Boolean) as SupportExerciseLog[],
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
  const trainingMode = pickEnum(migrated.trainingMode, TRAINING_MODES, 'hybrid');
  const programAdjustmentDrafts = sanitizeProgramAdjustmentDrafts(migrated.programAdjustmentDrafts);
  const programAdjustmentHistory = sanitizeProgramAdjustmentHistory(migrated.programAdjustmentHistory);
  const sanitized: AppData = {
    schemaVersion: STORAGE_VERSION,
    templates,
    history,
    bodyWeights: sanitizeBodyWeights(migrated.bodyWeights),
    activeSession: activeSession?.completed ? null : activeSession,
    selectedTemplateId,
    trainingMode,
    todayStatus: sanitizeTodayStatus(migrated.todayStatus),
    userProfile: sanitizeUserProfile(migrated.userProfile),
    screeningProfile: sanitizeScreeningProfile(migrated.screeningProfile, history),
    programTemplate: sanitizeProgramTemplate(migrated.programTemplate),
    mesocyclePlan: sanitizeMesocyclePlan(migrated.mesocyclePlan as MesocyclePlan | undefined),
    programAdjustmentDrafts,
    programAdjustmentHistory,
    activeProgramTemplateId,
    settings: {
      ...pickRecord(migrated.settings),
      schemaVersion: STORAGE_VERSION,
      selectedTemplateId,
      trainingMode,
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
    sanitized.activeProgramTemplateId = sanitized.templates.some((template) => template.id === sanitized.activeProgramTemplateId)
      ? sanitized.activeProgramTemplateId
      : sanitized.selectedTemplateId;
    sanitized.settings = {
      ...pickRecord(sanitized.settings),
      schemaVersion: STORAGE_VERSION,
      selectedTemplateId: sanitized.selectedTemplateId,
      trainingMode: sanitized.trainingMode,
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
    todayStatus: DEFAULT_STATUS,
    userProfile: DEFAULT_USER_PROFILE,
    screeningProfile: DEFAULT_SCREENING_PROFILE,
    programTemplate: DEFAULT_PROGRAM_TEMPLATE,
    mesocyclePlan: DEFAULT_MESOCYCLE_PLAN,
    programAdjustmentDrafts: [],
    programAdjustmentHistory: [],
    activeProgramTemplateId: undefined,
    settings: {},
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
          programAdjustmentDrafts: pickRecord(settings).programAdjustmentDrafts,
          programAdjustmentHistory: pickRecord(settings).programAdjustmentHistory,
          activeProgramTemplateId: pickRecord(settings).activeProgramTemplateId,
          selectedTemplateId: pickRecord(settings).selectedTemplateId,
          trainingMode: pickRecord(settings).trainingMode,
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
  localStorage.setItem(
    STORAGE_KEYS.settings,
    JSON.stringify({
      ...(sanitized.settings || {}),
      schemaVersion: STORAGE_VERSION,
      selectedTemplateId: sanitized.selectedTemplateId,
      trainingMode: sanitized.trainingMode,
      activeProgramTemplateId: sanitized.activeProgramTemplateId,
      programAdjustmentDrafts: sanitized.programAdjustmentDrafts || [],
      programAdjustmentHistory: sanitized.programAdjustmentHistory || [],
    })
  );
};
