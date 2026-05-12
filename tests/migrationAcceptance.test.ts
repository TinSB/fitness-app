import { describe, expect, it } from 'vitest';
import { STORAGE_KEY, STORAGE_KEYS } from '../src/data/trainingData';
import {
  MIGRATION_APPLY_FLAG_VALUE,
  runLocalStorageToSqliteMigrationApply,
} from '../src/storage/localStorageToSqliteMigrationApply';
import { runLocalStorageToSqliteMigrationDryRun } from '../src/storage/localStorageToSqliteMigrationDryRun';
import { sanitizeData } from '../src/storage/persistence';
import { makeAppData, makeSession } from './fixtures';

const appData = sanitizeData(makeAppData({
  history: [
    makeSession({
      id: 'migration-acceptance-session',
      date: '2026-05-12',
      templateId: 'push-a',
      exerciseId: 'bench-press',
      setSpecs: [{ weight: 100, reps: 5, rir: 2 }],
    }),
  ],
  selectedTemplateId: 'push-a',
}));

const backup = {
  backupId: 'backup-acceptance-1',
  createdAt: '2026-05-12T00:00:00.000Z',
  localStorageSnapshot: { safe: true },
};

const env = {
  DEV: true,
  VITE_IRONPATH_MIGRATION_APPLY: MIGRATION_APPLY_FLAG_VALUE,
};

const splitStorage = {
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
    throw new Error('migration acceptance must not write localStorage');
  },
};

describe('migration acceptance', () => {
  it('accepts valid localStorage dry-run and apply with SQLite snapshot metadata', async () => {
    await expect(runLocalStorageToSqliteMigrationDryRun({
      storage: splitStorage,
    })).resolves.toMatchObject({
      ok: true,
      found: true,
      summary: { historyCount: 1, templateCount: appData.templates.length },
      shouldWriteSqlite: false,
      shouldWriteLocalStorage: false,
      shouldSwitchSource: false,
    });

    await expect(runLocalStorageToSqliteMigrationApply(env, {
      storage: splitStorage,
      confirmApply: true,
      backup,
      writeSqliteSnapshot: async (input) => ({
        snapshotId: 'sqlite-acceptance-1',
        createdAt: '2026-05-12T00:01:00.000Z',
        schemaVersion: input.summary.schemaVersion,
      }),
    })).resolves.toMatchObject({
      ok: true,
      sqliteSnapshot: { snapshotId: 'sqlite-acceptance-1', schemaVersion: appData.schemaVersion },
      shouldDeleteLocalStorage: false,
      shouldWriteLocalStorage: false,
      shouldSwitchSource: false,
    });
  });

  it('covers invalid localStorage and backup-required failure paths', async () => {
    await expect(runLocalStorageToSqliteMigrationDryRun({
      storage: {
        getItem: () => {
          throw new Error('read failed');
        },
        setItem: () => undefined,
      },
    })).resolves.toMatchObject({
      ok: false,
      error: { code: 'local_storage_read_failed' },
    });

    await expect(runLocalStorageToSqliteMigrationApply(env, {
      storage: splitStorage,
      confirmApply: true,
      writeSqliteSnapshot: async () => ({ snapshotId: 'sqlite-1', createdAt: 'now', schemaVersion: 1 }),
    })).resolves.toMatchObject({
      ok: false,
      error: { code: 'migration_apply_backup_required' },
      shouldDeleteLocalStorage: false,
      shouldSwitchSource: false,
    });
  });

  it('covers legacy monolith localStorage payloads without source switching', async () => {
    const legacyStorage = {
      getItem: (key: string) => key === STORAGE_KEY ? JSON.stringify(appData) : null,
      setItem: () => {
        throw new Error('migration acceptance must not write localStorage');
      },
    };

    await expect(runLocalStorageToSqliteMigrationDryRun({
      storage: legacyStorage,
    })).resolves.toMatchObject({
      ok: true,
      found: true,
      summary: { historyCount: 1 },
      shouldWriteSqlite: false,
      shouldWriteLocalStorage: false,
      shouldSwitchSource: false,
    });
  });
});
