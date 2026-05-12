import { describe, expect, it, vi } from 'vitest';
import { STORAGE_KEYS } from '../src/data/trainingData';
import {
  MIGRATION_APPLY_FLAG_VALUE,
  runLocalStorageToSqliteMigrationApply,
} from '../src/storage/localStorageToSqliteMigrationApply';
import { sanitizeData } from '../src/storage/persistence';
import { makeAppData } from './fixtures';
import { readSource } from './runtimeBoundaryTestHelpers';

const env = {
  DEV: true,
  VITE_IRONPATH_MIGRATION_APPLY: MIGRATION_APPLY_FLAG_VALUE,
};

const backup = {
  backupId: 'backup-1',
  createdAt: '2026-05-12T00:00:00.000Z',
  localStorageSnapshot: { safe: true },
};

const appData = sanitizeData(makeAppData());

const storage = {
  getItem: (key: string) => ({
    [STORAGE_KEYS.version]: String(appData.schemaVersion),
    [STORAGE_KEYS.templates]: JSON.stringify(appData.templates),
    [STORAGE_KEYS.history]: JSON.stringify(appData.history),
    [STORAGE_KEYS.activeSession]: JSON.stringify(appData.activeSession),
    [STORAGE_KEYS.todayStatus]: JSON.stringify(appData.todayStatus),
    [STORAGE_KEYS.bodyWeights]: JSON.stringify(appData.bodyWeights),
    [STORAGE_KEYS.userProfile]: JSON.stringify(appData.userProfile),
    [STORAGE_KEYS.screeningProfile]: JSON.stringify(appData.screeningProfile),
    [STORAGE_KEYS.programTemplate]: JSON.stringify(appData.programTemplate),
    [STORAGE_KEYS.mesocyclePlan]: JSON.stringify(appData.mesocyclePlan),
    [STORAGE_KEYS.healthMetricSamples]: JSON.stringify(appData.healthMetricSamples),
    [STORAGE_KEYS.importedWorkoutSamples]: JSON.stringify(appData.importedWorkoutSamples),
    [STORAGE_KEYS.healthImportBatches]: JSON.stringify(appData.healthImportBatches),
    [STORAGE_KEYS.settings]: JSON.stringify({ ...appData.settings, schemaVersion: appData.schemaVersion }),
  })[key] ?? null,
  setItem: vi.fn(),
};

describe('localStorage to SQLite migration apply safety', () => {
  it('does not delete or write localStorage on success or writer failure', async () => {
    const setItem = vi.fn();
    const removeItem = vi.fn();
    const clear = vi.fn();
    vi.stubGlobal('localStorage', { setItem, removeItem, clear });

    await runLocalStorageToSqliteMigrationApply(env, {
      storage,
      confirmApply: true,
      backup,
      writeSqliteSnapshot: async (input) => ({
        snapshotId: 'sqlite-snapshot-1',
        createdAt: '2026-05-12T00:01:00.000Z',
        schemaVersion: input.summary.schemaVersion,
      }),
    });

    await runLocalStorageToSqliteMigrationApply(env, {
      storage,
      confirmApply: true,
      backup,
      writeSqliteSnapshot: async () => {
        throw new Error('write failed');
      },
    });

    expect(setItem).not.toHaveBeenCalled();
    expect(removeItem).not.toHaveBeenCalled();
    expect(clear).not.toHaveBeenCalled();
    expect(storage.setItem).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('surfaces writer failure and malformed snapshot without source switching', async () => {
    await expect(runLocalStorageToSqliteMigrationApply(env, {
      storage,
      confirmApply: true,
      backup,
      writeSqliteSnapshot: async () => {
        throw new Error('write failed');
      },
    })).resolves.toMatchObject({
      ok: false,
      status: 'failed',
      error: { code: 'migration_apply_write_failed' },
      shouldDeleteLocalStorage: false,
      shouldWriteLocalStorage: false,
      shouldSwitchSource: false,
    });

    await expect(runLocalStorageToSqliteMigrationApply(env, {
      storage,
      confirmApply: true,
      backup,
      writeSqliteSnapshot: async () => ({ snapshotId: '', createdAt: '', schemaVersion: 1 }),
    })).resolves.toMatchObject({
      ok: false,
      status: 'failed',
      error: { code: 'migration_apply_invalid_snapshot' },
      shouldSwitchSource: false,
    });
  });

  it('documents backup-first, confirmation, no deletion, and next task', () => {
    const doc = readSource('docs/LOCALSTORAGE_TO_SQLITE_MIGRATION_APPLY_PROTOTYPE.md');

    for (const expected of [
      'backup-first',
      'explicit confirmation',
      'injected SQLite snapshot writer',
      'does not delete localStorage',
      'does not auto-switch source of truth',
      'Task 5.34 Migration Acceptance / Manual Acceptance V1',
    ]) {
      expect(doc).toContain(expected);
    }
  });
});
