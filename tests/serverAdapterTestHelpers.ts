import { expect } from 'vitest';
import {
  createServerAdapter,
  createSqliteRepository,
  type ServerAdapterResponse,
} from '../apps/api/src/node';
import type { AppData } from '../src/models/training-model';
import { makeAppData } from './fixtures';
import { snapshotCount } from './sqliteRepositoryTestHelpers';

export const SERVER_NOW = '2026-05-09T12:00:00.000Z';

export const seedAdapter = (data: AppData = makeAppData(), snapshotId = 'server-adapter-seed') => {
  const repository = createSqliteRepository();
  repository.writeSnapshot(data, {
    snapshotId,
    createdAt: '2026-05-09T10:00:00.000Z',
    label: 'seed',
  });
  const adapter = createServerAdapter({ repository, clock: () => SERVER_NOW });
  return { repository, adapter };
};

export const expectNoSnapshotWrite = (
  repository: ReturnType<typeof createSqliteRepository>,
  beforeCount: number,
  response: ServerAdapterResponse,
) => {
  expect(snapshotCount(repository.database)).toBe(beforeCount);
  expect(response.snapshot).toBeUndefined();
};

export const expectSnapshotWrite = (
  repository: ReturnType<typeof createSqliteRepository>,
  beforeCount: number,
  response: ServerAdapterResponse,
) => {
  expect(response.error).toBeUndefined();
  expect(response.snapshot).toBeDefined();
  expect(response.snapshot?.createdAt).toBe(SERVER_NOW);
  expect(snapshotCount(repository.database)).toBe(beforeCount + 1);
};
