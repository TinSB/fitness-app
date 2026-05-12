import { describe, expect, it } from 'vitest';
import { STORAGE_KEYS } from '../src/data/trainingData';
import {
  MIGRATION_APPLY_FLAG_VALUE,
  runLocalStorageToSqliteMigrationApply,
} from '../src/storage/localStorageToSqliteMigrationApply';
import { sanitizeData } from '../src/storage/persistence';
import { makeAppData, makeSession } from './fixtures';

const env = {
  DEV: true,
  VITE_IRONPATH_MIGRATION_APPLY: MIGRATION_APPLY_FLAG_VALUE,
};

const backup = {
  backupId: 'backup-1',
  createdAt: '2026-05-12T00:00:00.000Z',
  localStorageSnapshot: { safe: true },
};

const appData = sanitizeData(makeAppData({
  history: [
    makeSession({
      id: 'apply-session',
      date: '2026-05-12',
      templateId: 'push-a',
      exerciseId: 'bench-press',
      setSpecs: [{ weight: 100, reps: 5, rir: 2 }],
    }),
  ],
  selectedTemplateId: 'push-a',
}));

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
    [STORAGE_KEYS.settings]: JSON.stringify({
      ...appData.settings,
      schemaVersion: appData.schemaVersion,
      selectedTemplateId: appData.selectedTemplateId,
      trainingMode: appData.trainingMode,
      unitSettings: appData.unitSettings,
      activeProgramTemplateId: appData.activeProgramTemplateId,
    }),
  })[key] ?? null,
  setItem: () => {
    throw new Error('apply helper must not write localStorage');
  },
};

describe('localStorage to SQLite migration apply prototype', () => {
  it('writes SQLite snapshot only after dev flag, confirmation, backup, and dry-run gates', async () => {
    const calls: unknown[] = [];

    const result = await runLocalStorageToSqliteMigrationApply(env, {
      storage,
      confirmApply: true,
      backup,
      writeSqliteSnapshot: async (input) => {
        calls.push(input);
        return {
          snapshotId: 'sqlite-snapshot-1',
          createdAt: '2026-05-12T00:01:00.000Z',
          schemaVersion: input.summary.schemaVersion,
        };
      },
    });

    expect(result).toMatchObject({
      ok: true,
      status: 'success',
      sqliteSnapshot: { snapshotId: 'sqlite-snapshot-1' },
      backup,
      shouldDeleteLocalStorage: false,
      shouldWriteLocalStorage: false,
      shouldSwitchSource: false,
      productionReady: false,
    });
    expect(calls).toHaveLength(1);
  });

  it('blocks without dev flag, confirmation, backup, writer, or localStorage data', async () => {
    await expect(runLocalStorageToSqliteMigrationApply({ DEV: true }, {
      storage,
      confirmApply: true,
      backup,
      writeSqliteSnapshot: async () => ({ snapshotId: 'x', createdAt: 'now', schemaVersion: 1 }),
    })).resolves.toMatchObject({ ok: false, error: { code: 'migration_apply_disabled' } });

    await expect(runLocalStorageToSqliteMigrationApply(env, {
      storage,
      backup,
      writeSqliteSnapshot: async () => ({ snapshotId: 'x', createdAt: 'now', schemaVersion: 1 }),
    })).resolves.toMatchObject({ ok: false, error: { code: 'migration_apply_confirmation_required' } });

    await expect(runLocalStorageToSqliteMigrationApply(env, {
      storage,
      confirmApply: true,
      writeSqliteSnapshot: async () => ({ snapshotId: 'x', createdAt: 'now', schemaVersion: 1 }),
    })).resolves.toMatchObject({ ok: false, error: { code: 'migration_apply_backup_required' } });

    await expect(runLocalStorageToSqliteMigrationApply(env, {
      storage,
      confirmApply: true,
      backup,
    })).resolves.toMatchObject({ ok: false, error: { code: 'migration_apply_writer_missing' } });

    await expect(runLocalStorageToSqliteMigrationApply(env, {
      storage: { getItem: () => null, setItem: () => undefined },
      confirmApply: true,
      backup,
      writeSqliteSnapshot: async () => ({ snapshotId: 'x', createdAt: 'now', schemaVersion: 1 }),
    })).resolves.toMatchObject({ ok: false, error: { code: 'migration_apply_no_local_storage_data' } });
  });
});
