import {
  DEFAULT_MESOCYCLE_PLAN,
  DEFAULT_PROGRAM_TEMPLATE,
  DEFAULT_SCREENING_PROFILE,
  DEFAULT_STATUS,
  DEFAULT_USER_PROFILE,
  STORAGE_KEY,
  STORAGE_KEYS,
  STORAGE_VERSION,
} from '../data/trainingData';
import type { AppData } from '../models/training-model';
import { DEFAULT_HEALTH_INTEGRATION_SETTINGS } from './appDataSanitize';
import { coerceSchemaVersion, parseJsonSafely, pickRecord } from './appDataStorageUtils';

export type AppDataStorageLike = Pick<Storage, 'getItem' | 'setItem'>;

export type LocalStorageReadResult =
  | { ok: true; found: true; rawData: unknown }
  | { ok: true; found: false; rawData: null }
  | { ok: false; found: false; rawData: null; error: unknown };

export type LocalStorageWriteResult =
  | { ok: true }
  | { ok: false; error: unknown };

const getDefaultStorage = (): AppDataStorageLike | null => {
  if (typeof localStorage === 'undefined') return null;
  return localStorage;
};

export const readStoredAppDataFromLocalStorage = (
  storage: AppDataStorageLike | null = getDefaultStorage(),
): LocalStorageReadResult => {
  if (!storage) return { ok: true, found: false, rawData: null };

  try {
    const splitTemplates = storage.getItem(STORAGE_KEYS.templates);
    const rawMonolith = splitTemplates ? null : storage.getItem(STORAGE_KEY);
    if (!splitTemplates && !rawMonolith) return { ok: true, found: false, rawData: null };

    const settings = parseJsonSafely(storage.getItem(STORAGE_KEYS.settings), {});
    const rawData = splitTemplates
      ? {
          schemaVersion: coerceSchemaVersion(storage.getItem(STORAGE_KEYS.version)) || coerceSchemaVersion(pickRecord(settings).schemaVersion),
          templates: parseJsonSafely(storage.getItem(STORAGE_KEYS.templates), []),
          history: parseJsonSafely(storage.getItem(STORAGE_KEYS.history), []),
          activeSession: parseJsonSafely(storage.getItem(STORAGE_KEYS.activeSession), null),
          todayStatus: parseJsonSafely(storage.getItem(STORAGE_KEYS.todayStatus), {}),
          bodyWeights: parseJsonSafely(storage.getItem(STORAGE_KEYS.bodyWeights), []),
          userProfile: parseJsonSafely(storage.getItem(STORAGE_KEYS.userProfile), null),
          screeningProfile: parseJsonSafely(storage.getItem(STORAGE_KEYS.screeningProfile), null),
          programTemplate: parseJsonSafely(storage.getItem(STORAGE_KEYS.programTemplate), null),
          mesocyclePlan: parseJsonSafely(storage.getItem(STORAGE_KEYS.mesocyclePlan), null),
          healthMetricSamples: parseJsonSafely(storage.getItem(STORAGE_KEYS.healthMetricSamples), pickRecord(settings).healthMetricSamples || []),
          importedWorkoutSamples: parseJsonSafely(storage.getItem(STORAGE_KEYS.importedWorkoutSamples), pickRecord(settings).importedWorkoutSamples || []),
          healthImportBatches: parseJsonSafely(storage.getItem(STORAGE_KEYS.healthImportBatches), pickRecord(settings).healthImportBatches || []),
          programAdjustmentDrafts: pickRecord(settings).programAdjustmentDrafts,
          programAdjustmentHistory: pickRecord(settings).programAdjustmentHistory,
          dismissedCoachActions: pickRecord(settings).dismissedCoachActions,
          dismissedDataHealthIssues: pickRecord(settings).dismissedDataHealthIssues,
          pendingSessionPatches: pickRecord(settings).pendingSessionPatches,
          activeProgramTemplateId: pickRecord(settings).activeProgramTemplateId,
          selectedTemplateId: pickRecord(settings).selectedTemplateId,
          trainingMode: pickRecord(settings).trainingMode,
          unitSettings: pickRecord(settings).unitSettings,
          settings,
        }
      : parseJsonSafely(rawMonolith, {});

    return { ok: true, found: true, rawData };
  } catch (error) {
    return { ok: false, found: false, rawData: null, error };
  }
};

export const writeAppDataToLocalStorage = (
  sanitized: AppData,
  storage: AppDataStorageLike | null = getDefaultStorage(),
): LocalStorageWriteResult => {
  if (!storage) return { ok: true };

  try {
    storage.setItem(STORAGE_KEYS.version, String(STORAGE_VERSION));
    storage.setItem(STORAGE_KEYS.templates, JSON.stringify(sanitized.templates || []));
    storage.setItem(STORAGE_KEYS.history, JSON.stringify(sanitized.history || []));
    storage.setItem(STORAGE_KEYS.activeSession, JSON.stringify(sanitized.activeSession || null));
    storage.setItem(STORAGE_KEYS.todayStatus, JSON.stringify(sanitized.todayStatus || DEFAULT_STATUS));
    storage.setItem(STORAGE_KEYS.bodyWeights, JSON.stringify(sanitized.bodyWeights || []));
    storage.setItem(STORAGE_KEYS.userProfile, JSON.stringify(sanitized.userProfile || DEFAULT_USER_PROFILE));
    storage.setItem(STORAGE_KEYS.screeningProfile, JSON.stringify(sanitized.screeningProfile || DEFAULT_SCREENING_PROFILE));
    storage.setItem(STORAGE_KEYS.programTemplate, JSON.stringify(sanitized.programTemplate || DEFAULT_PROGRAM_TEMPLATE));
    storage.setItem(STORAGE_KEYS.mesocyclePlan, JSON.stringify(sanitized.mesocyclePlan || DEFAULT_MESOCYCLE_PLAN));
    storage.setItem(STORAGE_KEYS.healthMetricSamples, JSON.stringify(sanitized.healthMetricSamples || []));
    storage.setItem(STORAGE_KEYS.importedWorkoutSamples, JSON.stringify(sanitized.importedWorkoutSamples || []));
    storage.setItem(STORAGE_KEYS.healthImportBatches, JSON.stringify(sanitized.healthImportBatches || []));
    storage.setItem(
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
        dismissedCoachActions: sanitized.dismissedCoachActions || [],
        dismissedDataHealthIssues: sanitized.dismissedDataHealthIssues || [],
        pendingSessionPatches: sanitized.pendingSessionPatches || [],
        dataRepairLogs: sanitized.settings.dataRepairLogs || [],
      }),
    );
    return { ok: true };
  } catch (error) {
    return { ok: false, error };
  }
};
