import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement, useEffect, useState } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  CLOUD_SYNC_FLOW_STORAGE_KEY,
  clearCloudSyncFlowState,
  saveCloudSyncFlowState,
  subscribeToCloudSyncFlowStateChanges,
  readPersistedCloudSyncEnabledReceipt,
} from '../src/storage/localStorageAdapter';
import {
  CLOUD_SYNC_LIST_ROW_LABEL_ENABLED,
  CLOUD_SYNC_LIST_ROW_LABEL_NOT_ENABLED,
  useCloudSyncListRowEnabled,
} from '../src/uiOs/settings/useCloudSyncListRowState';

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

describe('cloud sync flow state subscription', () => {
  beforeEach(() => {
    installMemoryStorage();
  });

  afterEach(() => {
    uninstallStorage();
  });

  it('readPersistedCloudSyncEnabledReceipt returns null when nothing is persisted', () => {
    expect(readPersistedCloudSyncEnabledReceipt()).toBeNull();
  });

  it('readPersistedCloudSyncEnabledReceipt returns the synced hash after save', () => {
    saveCloudSyncFlowState(
      {
        backupExportConfirmed: true,
        dryRunRequested: true,
        backupJson: null,
        syncedAppDataHash: 'phase19b-receipt',
        syncedOwnerUserId: 'user-1',
        syncedAt: '2026-05-27T00:00:00.000Z',
      },
      { appDataSnapshotHash: 'phase19b-receipt' },
    );
    expect(readPersistedCloudSyncEnabledReceipt()).toBe('phase19b-receipt');
  });

  it('notifies in-process subscribers when saveCloudSyncFlowState writes', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToCloudSyncFlowStateChanges(listener);

    saveCloudSyncFlowState(
      {
        backupExportConfirmed: false,
        dryRunRequested: false,
        backupJson: null,
        syncedAppDataHash: 'phase19b-receipt',
        syncedOwnerUserId: 'user-1',
        syncedAt: null,
      },
      {},
    );

    expect(listener).toHaveBeenCalledTimes(1);

    saveCloudSyncFlowState(
      {
        backupExportConfirmed: true,
        dryRunRequested: false,
        backupJson: null,
        syncedAppDataHash: 'phase19b-receipt',
        syncedOwnerUserId: 'user-1',
        syncedAt: null,
      },
      {},
    );

    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    saveCloudSyncFlowState(
      {
        backupExportConfirmed: false,
        dryRunRequested: false,
        backupJson: null,
        syncedAppDataHash: null,
        syncedOwnerUserId: null,
        syncedAt: null,
      },
      {},
    );

    // After unsubscribe, no further notifications.
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('notifies subscribers when clearCloudSyncFlowState wipes the envelope', () => {
    saveCloudSyncFlowState(
      {
        backupExportConfirmed: true,
        dryRunRequested: true,
        backupJson: null,
        syncedAppDataHash: 'phase19b-receipt',
        syncedOwnerUserId: 'user-1',
        syncedAt: null,
      },
      {},
    );

    const listener = vi.fn();
    const unsubscribe = subscribeToCloudSyncFlowStateChanges(listener);
    clearCloudSyncFlowState();
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it('does not throw when a subscriber callback itself throws', () => {
    const ok = vi.fn();
    const bad = vi.fn(() => {
      throw new Error('listener fault');
    });
    const unsubOk = subscribeToCloudSyncFlowStateChanges(ok);
    const unsubBad = subscribeToCloudSyncFlowStateChanges(bad);
    expect(() =>
      saveCloudSyncFlowState(
        {
          backupExportConfirmed: false,
          dryRunRequested: false,
          backupJson: null,
          syncedAppDataHash: 'phase19b-receipt',
          syncedOwnerUserId: 'user-1',
          syncedAt: null,
        },
        {},
      ),
    ).not.toThrow();
    expect(ok).toHaveBeenCalledTimes(1);
    expect(bad).toHaveBeenCalledTimes(1);
    unsubOk();
    unsubBad();
  });

  it('an unsubscribe call during dispatch does not skip other subscribers', () => {
    const callOrder: string[] = [];
    const unsubMid = subscribeToCloudSyncFlowStateChanges(() => {
      callOrder.push('mid');
      unsubMid();
    });
    const unsubAfter = subscribeToCloudSyncFlowStateChanges(() => {
      callOrder.push('after');
    });

    saveCloudSyncFlowState(
      {
        backupExportConfirmed: false,
        dryRunRequested: false,
        backupJson: null,
        syncedAppDataHash: 'phase19b-receipt',
        syncedOwnerUserId: 'user-1',
        syncedAt: null,
      },
      {},
    );

    expect(callOrder).toEqual(['mid', 'after']);
    unsubAfter();
  });
});

describe('useCloudSyncListRowEnabled hook (lazy initial paint)', () => {
  beforeEach(() => {
    installMemoryStorage();
  });

  afterEach(() => {
    uninstallStorage();
  });

  it('renders the enabled label when localStorage already has the receipt', () => {
    saveCloudSyncFlowState(
      {
        backupExportConfirmed: true,
        dryRunRequested: true,
        backupJson: null,
        syncedAppDataHash: 'phase19b-receipt',
        syncedOwnerUserId: 'user-1',
        syncedAt: null,
      },
      {},
    );

    function HookProbe() {
      const enabled = useCloudSyncListRowEnabled();
      return createElement('span', null, enabled
        ? CLOUD_SYNC_LIST_ROW_LABEL_ENABLED
        : CLOUD_SYNC_LIST_ROW_LABEL_NOT_ENABLED);
    }

    const markup = renderToStaticMarkup(createElement(HookProbe));
    expect(markup).toBe(`<span>${CLOUD_SYNC_LIST_ROW_LABEL_ENABLED}</span>`);
  });

  it('renders the not-enabled label when localStorage is empty', () => {
    clearCloudSyncFlowState();

    function HookProbe() {
      const enabled = useCloudSyncListRowEnabled();
      return createElement('span', null, enabled
        ? CLOUD_SYNC_LIST_ROW_LABEL_ENABLED
        : CLOUD_SYNC_LIST_ROW_LABEL_NOT_ENABLED);
    }

    const markup = renderToStaticMarkup(createElement(HookProbe));
    expect(markup).toBe(`<span>${CLOUD_SYNC_LIST_ROW_LABEL_NOT_ENABLED}</span>`);
  });
});

describe('saveCloudSyncFlowState does not destroy unrelated localStorage keys', () => {
  beforeEach(() => {
    installMemoryStorage();
  });
  afterEach(() => {
    uninstallStorage();
  });

  it('writes only the cloud-sync-flow key', () => {
    const storage = (globalThis as { localStorage: MemoryStorage }).localStorage;
    storage.setItem('ironpath_user_profile_v2', 'user-data');
    storage.setItem('ironpath_history_v1', 'history-data');

    saveCloudSyncFlowState(
      {
        backupExportConfirmed: false,
        dryRunRequested: false,
        backupJson: null,
        syncedAppDataHash: 'phase19b-receipt',
        syncedOwnerUserId: 'user-1',
        syncedAt: null,
      },
      {},
    );

    expect(storage.getItem(CLOUD_SYNC_FLOW_STORAGE_KEY)).not.toBeNull();
    expect(storage.getItem('ironpath_user_profile_v2')).toBe('user-data');
    expect(storage.getItem('ironpath_history_v1')).toBe('history-data');

    clearCloudSyncFlowState();
    expect(storage.getItem(CLOUD_SYNC_FLOW_STORAGE_KEY)).toBeNull();
    expect(storage.getItem('ironpath_user_profile_v2')).toBe('user-data');
    expect(storage.getItem('ironpath_history_v1')).toBe('history-data');
  });
});
