import { describe, expect, it } from 'vitest';
import {
  MIGRATION_ROLLBACK_FLAG_VALUE,
  runMigrationRollbackRecovery,
} from '../src/storage/migrationRollbackRecovery';
import { sanitizeData } from '../src/storage/persistence';
import { makeAppData } from './fixtures';

const env = {
  DEV: true,
  VITE_IRONPATH_MIGRATION_ROLLBACK: MIGRATION_ROLLBACK_FLAG_VALUE,
};

const appData = sanitizeData(makeAppData());

const localStorageBackup = {
  backupId: 'backup-local-1',
  createdAt: '2026-05-12T00:00:00.000Z',
  appData,
};

const devDbBackup = {
  backupId: 'backup-db-1',
  createdAt: '2026-05-12T00:00:00.000Z',
  sqliteSnapshot: {
    snapshotId: 'sqlite-backup-1',
    createdAt: '2026-05-12T00:00:00.000Z',
    schemaVersion: appData.schemaVersion,
  },
};

describe('migration rollback and recovery hardening', () => {
  it('restores localStorage backup through an injected restore callback', async () => {
    const calls: unknown[] = [];

    await expect(runMigrationRollbackRecovery(env, {
      target: 'localStorageBackup',
      confirmRestore: true,
      backup: localStorageBackup,
      restoreLocalStorageBackup: async (input) => {
        calls.push(input);
      },
    })).resolves.toMatchObject({
      ok: true,
      status: 'success',
      target: 'localStorageBackup',
      failureStateCleared: true,
      shouldDeleteLocalStorage: false,
      shouldSwitchSource: false,
      productionReady: false,
    });
    expect(calls).toHaveLength(1);
  });

  it('restores dev DB backup through an injected restore callback', async () => {
    await expect(runMigrationRollbackRecovery(env, {
      target: 'devDbBackup',
      confirmRestore: true,
      backup: devDbBackup,
      restoreDevDbBackup: async ({ sqliteSnapshot }) => sqliteSnapshot,
    })).resolves.toMatchObject({
      ok: true,
      status: 'success',
      target: 'devDbBackup',
      restoredSqliteSnapshot: { snapshotId: 'sqlite-backup-1' },
      failureStateCleared: true,
      shouldDeleteLocalStorage: false,
      shouldSwitchSource: false,
    });
  });

  it('blocks corrupt snapshots, schema mismatch, missing restore callbacks, and disabled rollback', async () => {
    await expect(runMigrationRollbackRecovery({ DEV: true }, {
      target: 'localStorageBackup',
      confirmRestore: true,
      backup: localStorageBackup,
      restoreLocalStorageBackup: async () => undefined,
    })).resolves.toMatchObject({
      ok: false,
      error: { code: 'migration_rollback_disabled' },
      failureStateCleared: false,
    });

    await expect(runMigrationRollbackRecovery(env, {
      target: 'localStorageBackup',
      confirmRestore: true,
      backup: localStorageBackup,
    })).resolves.toMatchObject({
      ok: false,
      error: { code: 'migration_rollback_restore_missing' },
    });

    await expect(runMigrationRollbackRecovery(env, {
      target: 'localStorageBackup',
      confirmRestore: true,
      backup: { backupId: 'bad', createdAt: '2026-05-12T00:00:00.000Z', appData: null },
      restoreLocalStorageBackup: async () => undefined,
    })).resolves.toMatchObject({
      ok: false,
      error: { code: 'migration_rollback_corrupt_backup' },
    });

    await expect(runMigrationRollbackRecovery(env, {
      target: 'devDbBackup',
      confirmRestore: true,
      backup: { backupId: 'bad-db', createdAt: '2026-05-12T00:00:00.000Z', sqliteSnapshot: { snapshotId: '' } },
      restoreDevDbBackup: async () => ({ snapshotId: 'x', createdAt: 'now', schemaVersion: 1 }),
    })).resolves.toMatchObject({
      ok: false,
      error: { code: 'migration_rollback_corrupt_backup' },
    });
  });

  it('surfaces restore failures with clear failure state', async () => {
    await expect(runMigrationRollbackRecovery(env, {
      target: 'devDbBackup',
      confirmRestore: true,
      backup: devDbBackup,
      restoreDevDbBackup: async () => {
        throw new Error('restore failed');
      },
    })).resolves.toMatchObject({
      ok: false,
      status: 'failed',
      error: { code: 'migration_rollback_restore_failed' },
      failureStateCleared: false,
      shouldDeleteLocalStorage: false,
      shouldSwitchSource: false,
    });
  });
});
