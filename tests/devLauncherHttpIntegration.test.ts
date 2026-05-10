import { describe, expect, it } from 'vitest';
import { createServerAdapter, createSqliteRepository } from '../apps/api/src/node';
import { wrapAdapterResponse } from './httpRuntimeAdapterTestHelpers';
import { fetchLauncherJson, makeTempDevDb, startDevLauncher } from './devLauncherTestHelpers';
import { snapshotCount } from './sqliteRepositoryTestHelpers';

const countSnapshots = (dbFile: string) => {
  const repo = createSqliteRepository({ filename: dbFile });
  try {
    return snapshotCount(repo.database);
  } finally {
    repo.close();
  }
};

describe('dev local API launcher HTTP integration', () => {
  it('matches direct serverAdapter reads for AppData summary', async () => {
    const temp = makeTempDevDb();
    const { launcher, started } = await startDevLauncher({ dbFile: temp.dbFile, seedEmpty: true });
    try {
      const viaHttp = await fetchLauncherJson(`${started.url}/app-data/summary`);
      const repo = createSqliteRepository({ filename: temp.dbFile });
      try {
        const direct = createServerAdapter({ repository: repo }).handleRequest({ method: 'GET', path: '/app-data/summary' });
        expect(viaHttp.status).toBe(direct.status);
        expect(viaHttp.body).toEqual(wrapAdapterResponse(direct));
      } finally {
        repo.close();
      }
    } finally {
      await launcher.close();
      temp.cleanup();
    }
  });

  it('writes snapshots only for successful mutations', async () => {
    const temp = makeTempDevDb();
    const { launcher, started } = await startDevLauncher({ dbFile: temp.dbFile, seedEmpty: true });
    try {
      expect(countSnapshots(temp.dbFile)).toBe(1);

      const start = await fetchLauncherJson(`${started.url}/sessions/start`, { method: 'POST' });
      expect(start.status).toBe(200);
      expect(start.body).toHaveProperty('snapshot');
      expect(countSnapshots(temp.dbFile)).toBe(2);

      const requiresConfirmation = await fetchLauncherJson(`${started.url}/sessions/active/complete`, { method: 'POST' });
      expect(requiresConfirmation.status).toBe(409);
      expect(requiresConfirmation.body).not.toHaveProperty('snapshot');
      expect(countSnapshots(temp.dbFile)).toBe(2);

      const invalid = await fetchLauncherJson(`${started.url}/history/missing/edit`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      });
      expect(invalid.status).toBe(404);
      expect(invalid.body).not.toHaveProperty('snapshot');
      expect(countSnapshots(temp.dbFile)).toBe(2);
    } finally {
      await launcher.close();
      temp.cleanup();
    }
  });

  it('does not write snapshots for malformed JSON', async () => {
    const temp = makeTempDevDb();
    const { launcher, started } = await startDevLauncher({ dbFile: temp.dbFile, seedEmpty: true });
    try {
      const beforeCount = countSnapshots(temp.dbFile);
      const malformed = await fetchLauncherJson(`${started.url}/sessions/start`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{bad',
      });

      expect(malformed.status).toBe(400);
      expect(malformed.body).toMatchObject({ error: { code: 'invalid_json' } });
      expect(countSnapshots(temp.dbFile)).toBe(beforeCount);
    } finally {
      await launcher.close();
      temp.cleanup();
    }
  });
});
