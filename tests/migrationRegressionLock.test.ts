import { describe, expect, it, vi } from 'vitest';
import { runLocalStorageToSqliteMigrationApply } from '../src/storage/localStorageToSqliteMigrationApply';
import { runLocalStorageToSqliteMigrationDryRun } from '../src/storage/localStorageToSqliteMigrationDryRun';
import {
  MIGRATION_ROLLBACK_FLAG_VALUE,
  runMigrationRollbackRecovery,
} from '../src/storage/migrationRollbackRecovery';
import { makeAppData } from './fixtures';

const migrationApplyEnv = {
  DEV: true,
  VITE_IRONPATH_MIGRATION_APPLY: 'localstorage-to-sqlite-apply',
};

const migrationRollbackEnv = {
  DEV: true,
  VITE_IRONPATH_MIGRATION_ROLLBACK: MIGRATION_ROLLBACK_FLAG_VALUE,
};

const storage = {
  getItem: vi.fn(() => JSON.stringify(makeAppData())),
  setItem: vi.fn(),
  removeItem: vi.fn(),
};

const backup = {
  backupId: 'backup-regression-lock',
  createdAt: '2026-05-12T00:00:00.000Z',
  localStorageSnapshot: { key: 'ironpath-app-data' },
};

describe('migration regression lock', () => {
  it('locks dry-run as warning-only and no-write', async () => {
    const result = await runLocalStorageToSqliteMigrationDryRun({
      storage,
      readApiSnapshotSummary: async () => ({ historyCount: 999 }),
    });

    expect(result).toMatchObject({
      ok: true,
      found: true,
      canApplyAfterBackup: true,
      shouldWriteSqlite: false,
      shouldWriteLocalStorage: false,
      shouldSwitchSource: false,
      productionReady: false,
    });
    expect(result.warnings.map((warning) => warning.code)).toContain('api_snapshot_count_mismatch');
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(storage.removeItem).not.toHaveBeenCalled();
  });

  it('locks apply as backup-first, confirmation-gated, and non-destructive', async () => {
    await expect(runLocalStorageToSqliteMigrationApply(migrationApplyEnv, {
      storage,
      confirmApply: true,
      writeSqliteSnapshot: async () => ({
        snapshotId: 'snapshot-without-backup',
        createdAt: '2026-05-12T00:00:00.000Z',
        schemaVersion: 1,
      }),
    })).resolves.toMatchObject({
      ok: false,
      error: { code: 'migration_apply_backup_required' },
      shouldDeleteLocalStorage: false,
      shouldWriteLocalStorage: false,
      shouldSwitchSource: false,
      productionReady: false,
    });

    const writeSqliteSnapshot = vi.fn(async () => ({
      snapshotId: 'snapshot-regression-lock',
      createdAt: '2026-05-12T00:00:00.000Z',
      schemaVersion: 1,
    }));

    await expect(runLocalStorageToSqliteMigrationApply(migrationApplyEnv, {
      storage,
      confirmApply: true,
      backup,
      writeSqliteSnapshot,
    })).resolves.toMatchObject({
      ok: true,
      status: 'success',
      shouldDeleteLocalStorage: false,
      shouldWriteLocalStorage: false,
      shouldSwitchSource: false,
      productionReady: false,
    });
    expect(writeSqliteSnapshot).toHaveBeenCalledTimes(1);
    expect(storage.removeItem).not.toHaveBeenCalled();
  });

  it('locks rollback as explicit, callback-only, and source-safe', async () => {
    const restoreLocalStorageBackup = vi.fn(async () => undefined);
    const restoreDevDbBackup = vi.fn(async () => ({
      snapshotId: 'restored-snapshot',
      createdAt: '2026-05-12T00:00:00.000Z',
      schemaVersion: 1,
    }));

    await expect(runMigrationRollbackRecovery(migrationRollbackEnv, {
      target: 'localStorageBackup',
      confirmRestore: true,
      backup: {
        backupId: 'rollback-local',
        createdAt: '2026-05-12T00:00:00.000Z',
        appData: makeAppData(),
      },
      restoreLocalStorageBackup,
    })).resolves.toMatchObject({
      ok: true,
      failureStateCleared: true,
      shouldDeleteLocalStorage: false,
      shouldSwitchSource: false,
      productionReady: false,
    });

    await expect(runMigrationRollbackRecovery(migrationRollbackEnv, {
      target: 'devDbBackup',
      confirmRestore: true,
      backup: {
        backupId: 'rollback-dev-db',
        createdAt: '2026-05-12T00:00:00.000Z',
        sqliteSnapshot: {
          snapshotId: 'snapshot-before-restore',
          createdAt: '2026-05-12T00:00:00.000Z',
          schemaVersion: 1,
        },
      },
      restoreDevDbBackup,
    })).resolves.toMatchObject({
      ok: true,
      failureStateCleared: true,
      shouldDeleteLocalStorage: false,
      shouldSwitchSource: false,
      productionReady: false,
    });

    expect(restoreLocalStorageBackup).toHaveBeenCalledTimes(1);
    expect(restoreDevDbBackup).toHaveBeenCalledTimes(1);
  });
});
