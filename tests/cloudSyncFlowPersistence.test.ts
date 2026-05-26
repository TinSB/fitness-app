import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  CLOUD_SYNC_FLOW_STORAGE_KEY,
  clearCloudSyncFlowState,
  isEmptyCloudSyncFlowState,
  loadCloudSyncFlowState,
  saveCloudSyncFlowState,
} from '../src/storage/localStorageAdapter';

class MemoryStorage implements Storage {
  private store = new Map<string, string>();
  get length() { return this.store.size; }
  clear(): void { this.store.clear(); }
  getItem(key: string): string | null { return this.store.has(key) ? this.store.get(key)! : null; }
  key(index: number): string | null { return Array.from(this.store.keys())[index] ?? null; }
  removeItem(key: string): void { this.store.delete(key); }
  setItem(key: string, value: string): void { this.store.set(key, value); }
}

const installMemoryStorage = () => {
  const storage = new MemoryStorage();
  (globalThis as { localStorage?: Storage }).localStorage = storage;
  return storage;
};

const uninstallStorage = () => {
  delete (globalThis as { localStorage?: Storage }).localStorage;
};

describe('cloudSyncFlowPersistence', () => {
  let storage: MemoryStorage;

  beforeEach(() => {
    storage = installMemoryStorage();
  });

  afterEach(() => {
    uninstallStorage();
  });

  it('returns an empty state when storage is empty', () => {
    const state = loadCloudSyncFlowState();
    expect(state.backupExportConfirmed).toBe(false);
    expect(state.dryRunRequested).toBe(false);
    expect(state.backupJson).toBeNull();
    expect(isEmptyCloudSyncFlowState(state)).toBe(true);
  });

  it('round-trips a confirmed backup state', () => {
    saveCloudSyncFlowState(
      {
        backupExportConfirmed: true,
        dryRunRequested: true,
        backupJson: '{"hello":"world"}',
      },
      { appDataSnapshotHash: 'hash-A', nowIso: '2026-05-26T12:00:00.000Z' },
    );

    const state = loadCloudSyncFlowState({ expectedAppDataSnapshotHash: 'hash-A' });
    expect(state.backupExportConfirmed).toBe(true);
    expect(state.dryRunRequested).toBe(true);
    expect(state.backupJson).toBe('{"hello":"world"}');
  });

  it('treats persisted state as stale when the AppData hash has drifted', () => {
    saveCloudSyncFlowState(
      { backupExportConfirmed: true, dryRunRequested: true, backupJson: 'json' },
      { appDataSnapshotHash: 'hash-A' },
    );
    const state = loadCloudSyncFlowState({ expectedAppDataSnapshotHash: 'hash-B' });
    expect(state.backupExportConfirmed).toBe(false);
    expect(state.dryRunRequested).toBe(false);
    expect(state.backupJson).toBeNull();
  });

  it('still returns the persisted state when no expected hash is supplied (diagnostic mode)', () => {
    saveCloudSyncFlowState(
      { backupExportConfirmed: true, dryRunRequested: false, backupJson: null },
      { appDataSnapshotHash: 'hash-X' },
    );
    const state = loadCloudSyncFlowState();
    expect(state.backupExportConfirmed).toBe(true);
  });

  it('clearCloudSyncFlowState removes the key', () => {
    saveCloudSyncFlowState({ backupExportConfirmed: true, dryRunRequested: true, backupJson: null });
    expect(storage.getItem(CLOUD_SYNC_FLOW_STORAGE_KEY)).not.toBeNull();
    clearCloudSyncFlowState();
    expect(storage.getItem(CLOUD_SYNC_FLOW_STORAGE_KEY)).toBeNull();
  });

  it('survives corrupted JSON without throwing', () => {
    storage.setItem(CLOUD_SYNC_FLOW_STORAGE_KEY, 'not json at all');
    const state = loadCloudSyncFlowState();
    expect(isEmptyCloudSyncFlowState(state)).toBe(true);
  });

  it('ignores future schema versions', () => {
    storage.setItem(CLOUD_SYNC_FLOW_STORAGE_KEY, JSON.stringify({
      schemaVersion: 999,
      backupExportConfirmed: true,
      dryRunRequested: true,
      backupJson: 'old',
    }));
    const state = loadCloudSyncFlowState();
    expect(isEmptyCloudSyncFlowState(state)).toBe(true);
  });

  it('is a no-op when localStorage is unavailable', () => {
    uninstallStorage();
    expect(() => saveCloudSyncFlowState({ backupExportConfirmed: true, dryRunRequested: true, backupJson: null })).not.toThrow();
    expect(() => clearCloudSyncFlowState()).not.toThrow();
    const state = loadCloudSyncFlowState();
    expect(isEmptyCloudSyncFlowState(state)).toBe(true);
  });
});
