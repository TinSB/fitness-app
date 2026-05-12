import { describe, expect, it } from 'vitest';
import { STORAGE_KEYS } from '../src/data/trainingData';
import { runLocalStorageToSqliteMigrationDryRun } from '../src/storage/localStorageToSqliteMigrationDryRun';
import { sanitizeData } from '../src/storage/persistence';
import { makeAppData, makeSession } from './fixtures';

const createStorage = (entries: Record<string, string | null>) => ({
  getItem: (key: string) => entries[key] ?? null,
  setItem: () => {
    throw new Error('dry-run must not write');
  },
});

const appData = sanitizeData(makeAppData({
  history: [
    makeSession({
      id: 'dry-run-session',
      date: '2026-05-12',
      templateId: 'push-a',
      exerciseId: 'bench-press',
      setSpecs: [{ weight: 100, reps: 5, rir: 2 }],
    }),
  ],
  selectedTemplateId: 'push-a',
}));

const splitStorage = createStorage({
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
});

describe('localStorage to SQLite migration dry-run', () => {
  it('validates localStorage AppData and returns a no-write summary', async () => {
    await expect(runLocalStorageToSqliteMigrationDryRun({
      storage: splitStorage,
    })).resolves.toMatchObject({
      ok: true,
      found: true,
      canApplyAfterBackup: true,
      summary: {
        schemaVersion: appData.schemaVersion,
        historyCount: 1,
        templateCount: appData.templates.length,
        activeSessionPresent: false,
        settingsPresent: true,
      },
      shouldWriteSqlite: false,
      shouldWriteLocalStorage: false,
      shouldSwitchSource: false,
      productionReady: false,
    });
  });

  it('reports warning-only API summary mismatches without writing or switching source', async () => {
    const result = await runLocalStorageToSqliteMigrationDryRun({
      storage: splitStorage,
      readApiSnapshotSummary: async () => ({
        schemaVersion: 999,
        historyCount: 999,
      }),
    });

    expect(result).toMatchObject({
      ok: true,
      found: true,
      shouldWriteSqlite: false,
      shouldWriteLocalStorage: false,
      shouldSwitchSource: false,
    });
    expect(result.warnings.map((warning) => warning.code)).toEqual(expect.arrayContaining([
      'api_snapshot_schema_mismatch',
      'api_snapshot_count_mismatch',
    ]));
  });

  it('returns visible no-write results for empty and unreadable localStorage', async () => {
    await expect(runLocalStorageToSqliteMigrationDryRun({
      storage: createStorage({}),
    })).resolves.toMatchObject({
      ok: true,
      found: false,
      canApplyAfterBackup: false,
      warnings: [{ code: 'local_storage_empty' }],
      shouldWriteSqlite: false,
      shouldWriteLocalStorage: false,
      shouldSwitchSource: false,
    });

    await expect(runLocalStorageToSqliteMigrationDryRun({
      storage: {
        getItem: () => {
          throw new Error('read failed');
        },
        setItem: () => {
          throw new Error('dry-run must not write');
        },
      },
    })).resolves.toMatchObject({
      ok: false,
      error: { code: 'local_storage_read_failed' },
      shouldWriteSqlite: false,
      shouldWriteLocalStorage: false,
      shouldSwitchSource: false,
    });
  });
});
