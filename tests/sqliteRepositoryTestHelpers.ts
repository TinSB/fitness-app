import { expect } from 'vitest';
import type { AppData, TrainingSetLog } from '../src/models/training-model';
import { exportAppData } from '../src/storage/backup';
import { sanitizeData } from '../src/storage/persistence';

export const canonicalAppData = (data: AppData) => sanitizeData(JSON.parse(exportAppData(data)));

export const expectAppDataParity = (actual: AppData, expected: AppData) => {
  expect(actual).toEqual(canonicalAppData(expected));
};

export const collectActualWeightSnapshots = (data: AppData) =>
  (data.history || []).flatMap((session) => [
    ...(session.exercises || []).flatMap((exercise) =>
      (Array.isArray(exercise.sets) ? exercise.sets : []).map((set, setIndex) => ({
        path: `${session.id}/${exercise.id}/${set.id || setIndex}`,
        actualWeightKg: (set as TrainingSetLog).actualWeightKg,
      })),
    ),
    ...((session.focusWarmupSetLogs || []).map((set, setIndex) => ({
      path: `${session.id}/warmup/${set.id || setIndex}`,
      actualWeightKg: set.actualWeightKg,
    })) || []),
  ]);

export const expectSummaryOnlyRepairLogs = (data: AppData) => {
  const serialized = JSON.stringify(data.settings?.dataRepairLogs || []);
  expect(serialized).not.toMatch(/"history"\s*:/);
  expect(serialized).not.toMatch(/"session"\s*:/);
  expect(serialized).not.toMatch(/"exercises"\s*:/);
  expect(serialized).not.toMatch(/"sets"\s*:/);
};

export const snapshotCount = (database: { prepare: (sql: string) => { get: (...params: unknown[]) => unknown } }) =>
  Number((database.prepare('SELECT COUNT(*) AS count FROM app_data_snapshots').get() as { count: number }).count);

export const appMetaValue = (
  database: { prepare: (sql: string) => { get: (...params: unknown[]) => unknown } },
  key: string,
) => (database.prepare('SELECT value FROM app_meta WHERE key = ?').get(key) as { value?: string } | undefined)?.value;

export const snapshotExists = (
  database: { prepare: (sql: string) => { get: (...params: unknown[]) => unknown } },
  snapshotId: string,
) =>
  Boolean(
    database.prepare('SELECT id FROM app_data_snapshots WHERE id = ? LIMIT 1').get(snapshotId) as
      | { id: string }
      | undefined,
  );
