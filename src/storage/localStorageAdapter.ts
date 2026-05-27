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
  // Notify in-process listeners (e.g. the settings list row that shows
  // "已开启" / "未开启" next to "账号与同步"). This MUST run even if the
  // setItem above threw — a quota error doesn't mean the in-memory state
  // diverged; subscribers re-read via the same loader and will simply pick
  // up whatever is currently persisted.
  notifyCloudSyncFlowStateChange();
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
  notifyCloudSyncFlowStateChange();
};

export const isEmptyCloudSyncFlowState = (state: CloudSyncFlowPersistedState): boolean =>
  state.backupExportConfirmed === false &&
  state.dryRunRequested === false &&
  state.backupJson === null &&
  state.syncedAppDataHash === null;

// Lightweight helper that returns just the boolean the settings list needs.
// Returning a plain string|null primitive (not a fresh object) is critical:
// the row label hook below uses `useSyncExternalStore`, which compares
// snapshots with Object.is — handing back a new object reference on every
// render would force the row to re-render on every parent render even
// though the persisted state did not change.
export const readPersistedCloudSyncEnabledReceipt = (
  options: { storage?: CloudSyncFlowStorageLike | null } = {},
): string | null => loadCloudSyncFlowState(options).syncedAppDataHash;

// ── Cloud sync flow state in-process change subscription ─────────────────
//
// The settings list row "账号与同步" sits OUTSIDE CloudSyncPolishSettingsPanel
// (in src/features/ProfileView.tsx, fed by SettingsNavigationStack). Before
// this subscription existed the row's value was a hardcoded literal "未开启"
// that never reflected reality: after the user signed in, backed up, and
// flipped the toggle to 已开启 inside the panel, leaving the panel and
// coming back showed "未开启" next to "账号与同步" — the user-reported V1
// regression. The panel itself rehydrates from this same envelope on every
// mount (see useState lazy initializers in CloudSyncPolishSettingsPanel),
// so the failure was specifically in the settings *list* surface.
//
// We notify subscribers from `saveCloudSyncFlowState` and
// `clearCloudSyncFlowState`. The `storage` event handler covers cross-tab
// writes (e.g. PWA in two windows). For same-document writes the storage
// event does NOT fire — that's why the in-process Set is necessary.

type CloudSyncFlowStateChangeListener = () => void;
const cloudSyncFlowStateChangeListeners = new Set<CloudSyncFlowStateChangeListener>();

const notifyCloudSyncFlowStateChange = (): void => {
  if (cloudSyncFlowStateChangeListeners.size === 0) return;
  // Snapshot first: a listener could mutate the set via unsubscribe.
  for (const listener of [...cloudSyncFlowStateChangeListeners]) {
    try {
      listener();
    } catch {
      // A subscriber throwing must never break the writer. Each subscriber
      // is responsible for its own error handling.
    }
  }
};

export const subscribeToCloudSyncFlowStateChanges = (
  listener: CloudSyncFlowStateChangeListener,
): (() => void) => {
  cloudSyncFlowStateChangeListeners.add(listener);
  let storageHandler: ((event: StorageEvent) => void) | null = null;
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    storageHandler = (event: StorageEvent) => {
      // event.key === null fires on `localStorage.clear()` from another tab.
      if (event.key === CLOUD_SYNC_FLOW_STORAGE_KEY || event.key === null) {
        try { listener(); } catch { /* see notifyCloudSyncFlowStateChange */ }
      }
    };
    window.addEventListener('storage', storageHandler);
  }
  return () => {
    cloudSyncFlowStateChangeListeners.delete(listener);
    if (storageHandler && typeof window !== 'undefined') {
      window.removeEventListener('storage', storageHandler);
    }
  };
};

// Diagnostic dump for parity_failed events. Lives here (not in the panel)
// because the panel is forbidden from touching localStorage directly by
// the Settings runtime boundary. The payload is small (a single JSON
// blob of the failed parity summary + blockers + timestamp) so we don't
// bother with quota tracking; if writing fails we drop silently — it is
// a best-effort diagnostic surface and is never on the retry path.
const LAST_PARITY_FAILURE_KEY = 'ironpath_last_parity_failure_v1';

export type LastParityFailurePayload = {
  ts: string;
  status: string;
  blockers: string[];
  parity: unknown;
  cloudFailureDetail: string | null;
};

export const writeLastParityFailureDiagnostic = (
  payload: LastParityFailurePayload,
  storage: CloudSyncFlowStorageLike | null = getDefaultCloudSyncFlowStorage(),
): void => {
  if (!storage) return;
  try {
    storage.setItem(LAST_PARITY_FAILURE_KEY, JSON.stringify(payload));
  } catch {
    /* QuotaExceeded / privacy mode — diagnostic is best-effort only. */
  }
};

export const readLastParityFailureDiagnostic = (
  storage: CloudSyncFlowStorageLike | null = getDefaultCloudSyncFlowStorage(),
): LastParityFailurePayload | null => {
  if (!storage) return null;
  try {
    const raw = storage.getItem(LAST_PARITY_FAILURE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LastParityFailurePayload> | null;
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      ts: typeof parsed.ts === 'string' ? parsed.ts : '',
      status: typeof parsed.status === 'string' ? parsed.status : '',
      blockers: Array.isArray(parsed.blockers) ? parsed.blockers.filter((b) => typeof b === 'string') : [],
      parity: parsed.parity ?? null,
      cloudFailureDetail:
        typeof parsed.cloudFailureDetail === 'string' ? parsed.cloudFailureDetail : null,
    };
  } catch {
    return null;
  }
};
