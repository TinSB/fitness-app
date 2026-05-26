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

  // Bug #8 修复：原先 13 个 setItem 顺序写入，且 version 第一个写。中途失败会留下
  // "新 version + 旧 templates" 这种不一致组合。这里先把所有 payload 序列化到内存，
  // 任何 JSON.stringify 异常都在写入前抛出，避免污染 storage；然后按 "数据先、version 最后"
  // 的顺序写入，让 version 充当 commit marker —— 中途失败时旧 version 仍指向上一致状态。
  let payload: Record<string, string>;
  try {
    payload = {
      [STORAGE_KEYS.templates]: JSON.stringify(sanitized.templates || []),
      [STORAGE_KEYS.history]: JSON.stringify(sanitized.history || []),
      [STORAGE_KEYS.activeSession]: JSON.stringify(sanitized.activeSession || null),
      [STORAGE_KEYS.todayStatus]: JSON.stringify(sanitized.todayStatus || DEFAULT_STATUS),
      [STORAGE_KEYS.bodyWeights]: JSON.stringify(sanitized.bodyWeights || []),
      [STORAGE_KEYS.userProfile]: JSON.stringify(sanitized.userProfile || DEFAULT_USER_PROFILE),
      [STORAGE_KEYS.screeningProfile]: JSON.stringify(sanitized.screeningProfile || DEFAULT_SCREENING_PROFILE),
      [STORAGE_KEYS.programTemplate]: JSON.stringify(sanitized.programTemplate || DEFAULT_PROGRAM_TEMPLATE),
      [STORAGE_KEYS.mesocyclePlan]: JSON.stringify(sanitized.mesocyclePlan || DEFAULT_MESOCYCLE_PLAN),
      [STORAGE_KEYS.healthMetricSamples]: JSON.stringify(sanitized.healthMetricSamples || []),
      [STORAGE_KEYS.importedWorkoutSamples]: JSON.stringify(sanitized.importedWorkoutSamples || []),
      [STORAGE_KEYS.healthImportBatches]: JSON.stringify(sanitized.healthImportBatches || []),
      [STORAGE_KEYS.settings]: JSON.stringify({
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
    };
  } catch (error) {
    return { ok: false, error };
  }

  try {
    for (const [key, value] of Object.entries(payload)) {
      storage.setItem(key, value);
    }
    // version 最后写：写到这里表明 12 个数据 key 都成功落盘。若中途 QuotaExceeded，
    // version 保持旧值（指向旧数据快照），下次读取时不会把混合状态当成新数据。
    storage.setItem(STORAGE_KEYS.version, String(STORAGE_VERSION));
    return { ok: true };
  } catch (error) {
    return { ok: false, error };
  }
};
