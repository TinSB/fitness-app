import { STORAGE_VERSION } from '../data/trainingData';
import { clone, number } from '../engines/engineUtils';
import { createMesocyclePlan } from '../engines/mesocycleEngine';
import {
  WEIGHT_UNITS,
  coerceSchemaVersion,
  isPlainObject,
  normalizeExerciseIdentity,
  pickArray,
  pickDoseRecord,
  pickEnum,
  pickNumberRecord,
  pickRecord,
  pickString,
  pickStringArray,
} from './appDataStorageUtils';

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