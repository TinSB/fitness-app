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

// ── Cloud sync onboarding flow persistence ──────────────────────────────
//
// Backup / dry-run confirmation state used to live in a single React
// useState inside CloudSyncPolishSettingsPanel, which meant closing the
// PWA reset the user back to "create backup -> view contents" every time
// even though they had completed those steps minutes earlier. Persisting
// the flow state across mounts is a UI concern, but the actual storage
// access has to stay inside this adapter to keep the
// "localStorageAdapter is the only place that touches localStorage"
// boundary clean (enforced by tests/localStorageAdapter.test.ts and
// tests/runtimeBoundaryPersistenceCompatibility.test.ts).
//
// We also stash the AppData snapshot hash that was current at save time.
// On load, the caller passes the live hash; if it has drifted (user
// trained / edited data since pressing "创建备份"), we treat the persisted
// state as stale and force a re-backup so we never silently ship an
// outdated backup.

export interface CloudSyncFlowPersistedState {
  backupExportConfirmed: boolean;
  dryRunRequested: boolean;
  backupJson: string | null;
  // When the user successfully completes the first full-acceptance upload
  // (status === 'accepted'), we stash the AppData hash that landed in the
  // cloud. On next mount, if this hash still matches the live local hash,
  // we treat sync as "already on" without forcing the user to re-toggle —
  // this is the only persistence path for the otherwise-in-memory
  // productionSyncApplyState. mount-time reconciliation against the cloud
  // can still demote this to off if the cloud row has been deleted.
  syncedAppDataHash: string | null;
  syncedOwnerUserId: string | null;
  syncedAt: string | null;
}

interface CloudSyncFlowEnvelope extends CloudSyncFlowPersistedState {
  schemaVersion: 2;
  appDataSnapshotHash: string | null;
  savedAt: string;
}

export const CLOUD_SYNC_FLOW_STORAGE_KEY = 'ironpath_cloud_sync_flow_state_v1';
const CLOUD_SYNC_FLOW_SCHEMA_VERSION = 2;
// v1 envelopes (without sync-on tracking fields) are still accepted —
// users who confirmed a backup before this upgrade should not have to
// re-confirm it after deploy. Their syncedAppDataHash just starts as null.
const CLOUD_SYNC_FLOW_LEGACY_SCHEMA_VERSION = 1;

const EMPTY_CLOUD_SYNC_FLOW_STATE: CloudSyncFlowPersistedState = {
  backupExportConfirmed: false,
  dryRunRequested: false,
  backupJson: null,
  syncedAppDataHash: null,
  syncedOwnerUserId: null,
  syncedAt: null,
};

const parseCloudSyncFlowEnvelope = (raw: string | null): CloudSyncFlowEnvelope | null => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<CloudSyncFlowEnvelope> | null;
    if (!parsed || typeof parsed !== 'object') return null;
    if (
      parsed.schemaVersion !== CLOUD_SYNC_FLOW_SCHEMA_VERSION &&
      parsed.schemaVersion !== CLOUD_SYNC_FLOW_LEGACY_SCHEMA_VERSION
    ) {
      return null;
    }
    return {
      schemaVersion: CLOUD_SYNC_FLOW_SCHEMA_VERSION,
      backupExportConfirmed: parsed.backupExportConfirmed === true,
      dryRunRequested: parsed.dryRunRequested === true,
      backupJson: typeof parsed.backupJson === 'string' ? parsed.backupJson : null,
      syncedAppDataHash:
        typeof parsed.syncedAppDataHash === 'string' ? parsed.syncedAppDataHash : null,
      syncedOwnerUserId:
        typeof parsed.syncedOwnerUserId === 'string' ? parsed.syncedOwnerUserId : null,
      syncedAt: typeof parsed.syncedAt === 'string' ? parsed.syncedAt : null,
      appDataSnapshotHash:
        typeof parsed.appDataSnapshotHash === 'string' ? parsed.appDataSnapshotHash : null,
      savedAt: typeof parsed.savedAt === 'string' ? parsed.savedAt : '',
    };
  } catch {
    return null;
  }
};

type CloudSyncFlowStorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const getDefaultCloudSyncFlowStorage = (): CloudSyncFlowStorageLike | null => {
  if (typeof localStorage === 'undefined') return null;
  return localStorage;
};

export const loadCloudSyncFlowState = (
  options: { expectedAppDataSnapshotHash?: string | null; storage?: CloudSyncFlowStorageLike | null } = {},
): CloudSyncFlowPersistedState => {
  const storage = options.storage !== undefined ? options.storage : getDefaultCloudSyncFlowStorage();
  if (!storage) return EMPTY_CLOUD_SYNC_FLOW_STATE;
  let raw: string | null = null;
  try {
    raw = storage.getItem(CLOUD_SYNC_FLOW_STORAGE_KEY);
  } catch {
    return EMPTY_CLOUD_SYNC_FLOW_STATE;
  }
  const parsed = parseCloudSyncFlowEnvelope(raw);
  if (!parsed) return EMPTY_CLOUD_SYNC_FLOW_STATE;
  if (
    options.expectedAppDataSnapshotHash !== undefined &&
    options.expectedAppDataSnapshotHash !== null &&
    parsed.appDataSnapshotHash !== options.expectedAppDataSnapshotHash
  ) {
    return EMPTY_CLOUD_SYNC_FLOW_STATE;
  }
  return {
    backupExportConfirmed: parsed.backupExportConfirmed,
    dryRunRequested: parsed.dryRunRequested,
    backupJson: parsed.backupJson,
    syncedAppDataHash: parsed.syncedAppDataHash,
    syncedOwnerUserId: parsed.syncedOwnerUserId,
    syncedAt: parsed.syncedAt,
  };
};

export const saveCloudSyncFlowState = (
  state: CloudSyncFlowPersistedState,
  options: { appDataSnapshotHash?: string | null; nowIso?: string; storage?: CloudSyncFlowStorageLike | null } = {},
): void => {
  const storage = options.storage !== undefined ? options.storage : getDefaultCloudSyncFlowStorage();
  if (!storage) return;
  const envelope: CloudSyncFlowEnvelope = {
    schemaVersion: CLOUD_SYNC_FLOW_SCHEMA_VERSION,
    backupExportConfirmed: Boolean(state.backupExportConfirmed),
    dryRunRequested: Boolean(state.dryRunRequested),
    backupJson: state.backupJson ?? null,
    syncedAppDataHash: state.syncedAppDataHash ?? null,
    syncedOwnerUserId: state.syncedOwnerUserId ?? null,
    syncedAt: state.syncedAt ?? null,
    appDataSnapshotHash: options.appDataSnapshotHash ?? null,
    savedAt: options.nowIso ?? new Date().toISOString(),
  };
  try {
    storage.setItem(CLOUD_SYNC_FLOW_STORAGE_KEY, JSON.stringify(envelope));
  } catch {
    // QuotaExceeded / privacy mode — fall closed, the in-memory state stays
    // authoritative for the current session.
  }
};

export const clearCloudSyncFlowState = (
  options: { storage?: CloudSyncFlowStorageLike | null } = {},
): void => {
  const storage = options.storage !== undefined ? options.storage : getDefaultCloudSyncFlowStorage();
  if (!storage) return;
  try {
    storage.removeItem(CLOUD_SYNC_FLOW_STORAGE_KEY);
  } catch {
    // ignore
  }
};

export const isEmptyCloudSyncFlowState = (state: CloudSyncFlowPersistedState): boolean =>
  state.backupExportConfirmed === false &&
  state.dryRunRequested === false &&
  state.backupJson === null &&
  state.syncedAppDataHash === null;
