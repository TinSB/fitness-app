import type { AppData } from '../models/training-model';
import type { RepairTrigger } from './appDataRepairTypes';

const DB_NAME = 'ironpath_data_health';
const STORE_NAME = 'ironpath_auto_repair_backups';
const DB_VERSION = 1;
const MAX_BACKUPS = 5;
const LOCAL_STORAGE_PREFIX = 'ironpath_auto_repair_backup_inline_';

export interface AutoRepairBackupRecord {
  id: string;
  createdAt: string;
  triggeredBy: RepairTrigger;
  appDataHashBefore: string;
  repairIdScope: string[];
  payloadSize: number;
  storage: 'indexeddb' | 'localstorage' | 'memory';
}

export interface AutoRepairBackupAdapter {
  snapshot: (params: {
    appData: AppData;
    triggeredBy: RepairTrigger;
    appDataHashBefore: string;
    repairIdScope: string[];
  }) => Promise<AutoRepairBackupRecord>;
  list: () => Promise<AutoRepairBackupRecord[]>;
}

const inMemoryBackups: AutoRepairBackupRecord[] = [];
const inMemoryPayloads = new Map<string, string>();

const safeIndexedDb = (): IDBFactory | undefined => {
  if (typeof globalThis === 'undefined') return undefined;
  const candidate = (globalThis as unknown as { indexedDB?: IDBFactory }).indexedDB;
  return candidate;
};

const safeLocalStorage = (): Storage | undefined => {
  if (typeof globalThis === 'undefined') return undefined;
  const candidate = (globalThis as unknown as { localStorage?: Storage }).localStorage;
  return candidate;
};

const openDb = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const factory = safeIndexedDb();
    if (!factory) {
      reject(new Error('indexeddb_unavailable'));
      return;
    }
    const request = factory.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('indexeddb_open_failed'));
  });

const idbRun = async <T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> => {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    const store = tx.objectStore(STORE_NAME);
    const request = fn(store);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('indexeddb_tx_failed'));
  });
};

const writeIndexedDb = async (record: AutoRepairBackupRecord, payload: string): Promise<void> => {
  await idbRun('readwrite', (store) => store.put({ ...record, payload }));
  const all = (await idbRun('readonly', (store) => store.getAll())) as Array<
    AutoRepairBackupRecord & { payload?: string }
  >;
  if (all.length <= MAX_BACKUPS) return;
  const sorted = all.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const toRemove = sorted.slice(0, sorted.length - MAX_BACKUPS);
  for (const stale of toRemove) {
    await idbRun('readwrite', (store) => store.delete(stale.id));
  }
};

const writeLocalStorage = (record: AutoRepairBackupRecord, payload: string): boolean => {
  const ls = safeLocalStorage();
  if (!ls) return false;
  try {
    ls.setItem(`${LOCAL_STORAGE_PREFIX}${record.id}`, JSON.stringify({ ...record, payload }));
    const keys: string[] = [];
    for (let i = 0; i < ls.length; i++) {
      const key = ls.key(i);
      if (key && key.startsWith(LOCAL_STORAGE_PREFIX)) keys.push(key);
    }
    if (keys.length > MAX_BACKUPS) {
      keys.sort();
      keys.slice(0, keys.length - MAX_BACKUPS).forEach((key) => ls.removeItem(key));
    }
    return true;
  } catch (_error) {
    return false;
  }
};

const storeInMemory = (record: AutoRepairBackupRecord, payload: string): void => {
  inMemoryBackups.push(record);
  inMemoryPayloads.set(record.id, payload);
  while (inMemoryBackups.length > MAX_BACKUPS) {
    const dropped = inMemoryBackups.shift();
    if (dropped) inMemoryPayloads.delete(dropped.id);
  }
};

const listIndexedDbRecords = async (): Promise<AutoRepairBackupRecord[]> => {
  try {
    const all = (await idbRun('readonly', (store) => store.getAll())) as Array<
      AutoRepairBackupRecord & { payload?: string }
    >;
    return all.map(({ payload: _omit, ...rest }) => rest);
  } catch {
    return [];
  }
};

const listLocalStorageRecords = (): AutoRepairBackupRecord[] => {
  const ls = safeLocalStorage();
  if (!ls) return [];
  const records: AutoRepairBackupRecord[] = [];
  for (let i = 0; i < ls.length; i++) {
    const key = ls.key(i);
    if (!key || !key.startsWith(LOCAL_STORAGE_PREFIX)) continue;
    const raw = ls.getItem(key);
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw) as AutoRepairBackupRecord & { payload?: string };
      const { payload: _omit, ...rest } = parsed;
      records.push(rest);
    } catch {
      // skip malformed entry
    }
  }
  return records;
};

export const createAutoRepairBackupAdapter = (): AutoRepairBackupAdapter => ({
  async snapshot({ appData, triggeredBy, appDataHashBefore, repairIdScope }) {
    const payload = JSON.stringify(appData);
    const record: AutoRepairBackupRecord = {
      id: `ironpath_auto_repair_backup_${Date.now()}_${appDataHashBefore.slice(-8)}`,
      createdAt: new Date().toISOString(),
      triggeredBy,
      appDataHashBefore,
      repairIdScope: [...repairIdScope],
      payloadSize: payload.length,
      storage: 'memory',
    };
    try {
      await writeIndexedDb(record, payload);
      return { ...record, storage: 'indexeddb' };
    } catch (_indexedDbError) {
      if (writeLocalStorage(record, payload)) {
        return { ...record, storage: 'localstorage' };
      }
      storeInMemory(record, payload);
      return { ...record, storage: 'memory' };
    }
  },
  async list() {
    const indexed = await listIndexedDbRecords();
    if (indexed.length > 0) return indexed;
    const localRecords = listLocalStorageRecords();
    if (localRecords.length > 0) return localRecords;
    return [...inMemoryBackups];
  },
});

let cachedAdapter: AutoRepairBackupAdapter | null = null;

export const getDefaultAutoRepairBackupAdapter = (): AutoRepairBackupAdapter => {
  if (!cachedAdapter) cachedAdapter = createAutoRepairBackupAdapter();
  return cachedAdapter;
};

export const __test_clearInMemoryBackups = (): void => {
  inMemoryBackups.length = 0;
  inMemoryPayloads.clear();
};
