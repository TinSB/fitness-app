import { describe, expect, it } from 'vitest';
import { createSqliteRepository } from '../apps/api/src/node';
import { makeAppData } from './fixtures';
import { DEV_LAUNCHER_NOW, fetchLauncherJson, makeTempDevDb, startDevLauncher } from './devLauncherTestHelpers';
import { latestSnapshotLabel, snapshotCount } from './sqliteRepositoryTestHelpers';

describe('dev local API launcher file-backed DB behavior', () => {
  it('does not auto-create a snapshot when seedEmpty is false', async () => {
    const temp = makeTempDevDb();
    const { launcher, started } = await startDevLauncher({ dbFile: temp.dbFile, seedEmpty: false });
    try {
      expect((await fetchLauncherJson(`${started.url}/health`)).status).toBe(200);
    } finally {
      await launcher.close();
    }

    const repo = createSqliteRepository({ filename: temp.dbFile });
    try {
      expect(snapshotCount(repo.database)).toBe(0);
      expect(() => repo.readSnapshot()).toThrow();
    } finally {
      repo.close();
      temp.cleanup();
    }
  });

  it('seeds empty AppData only when requested and labels the seed snapshot', async () => {
    const temp = makeTempDevDb();
    const { launcher } = await startDevLauncher({ dbFile: temp.dbFile, seedEmpty: true });
    await launcher.close();

    const repo = createSqliteRepository({ filename: temp.dbFile });
    try {
      expect(snapshotCount(repo.database)).toBe(1);
      expect(latestSnapshotLabel(repo.database)).toBe('dev-launcher:seed-empty');
      expect(repo.readSnapshot().history).toEqual([]);
    } finally {
      repo.close();
      temp.cleanup();
    }
  });

  it('does not seed again when a latest snapshot already exists', async () => {
    const temp = makeTempDevDb();
    const seeded = createSqliteRepository({ filename: temp.dbFile });
    seeded.writeSnapshot(makeAppData({ selectedTemplateId: 'pull-a' }), {
      snapshotId: 'existing',
      createdAt: DEV_LAUNCHER_NOW,
      label: 'existing-snapshot',
    });
    seeded.close();

    const { launcher } = await startDevLauncher({ dbFile: temp.dbFile, seedEmpty: true });
    await launcher.close();

    const repo = createSqliteRepository({ filename: temp.dbFile });
    try {
      expect(snapshotCount(repo.database)).toBe(1);
      expect(latestSnapshotLabel(repo.database)).toBe('existing-snapshot');
      expect(repo.readSnapshot().selectedTemplateId).toBe('pull-a');
    } finally {
      repo.close();
      temp.cleanup();
    }
  });

  it('persists successful HTTP mutations to the file-backed SQLite repository', async () => {
    const temp = makeTempDevDb();
    const { launcher, started } = await startDevLauncher({ dbFile: temp.dbFile, seedEmpty: true });
    try {
      const response = await fetchLauncherJson(`${started.url}/sessions/start`, { method: 'POST' });
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('snapshot');
    } finally {
      await launcher.close();
    }

    const repo = createSqliteRepository({ filename: temp.dbFile });
    try {
      expect(snapshotCount(repo.database)).toBe(2);
      expect(repo.readSnapshot().activeSession).toBeTruthy();
    } finally {
      repo.close();
      temp.cleanup();
    }
  });
});
