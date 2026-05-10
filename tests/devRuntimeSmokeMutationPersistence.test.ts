import { describe, expect, it } from 'vitest';
import { createDevLocalApiLauncher } from '../apps/api/src/node';
import { makeAppData } from './fixtures';
import {
  DEV_RUNTIME_SMOKE_NOW,
  countSnapshotsInFile,
  fetchJsonWithTimeout,
  makeTempDevRuntimeDb,
  readLatestAppDataFromFile,
  seedStartableAppDataSnapshot,
} from './devRuntimeSmokeTestHelpers';

describe('dev runtime smoke mutation persistence', () => {
  it('persists a real HTTP session start from pre-seeded startable AppData', async () => {
    const temp = makeTempDevRuntimeDb();
    seedStartableAppDataSnapshot(temp.dbFile, makeAppData({ selectedTemplateId: 'push-a' }));

    const launcher = createDevLocalApiLauncher({
      dbFile: temp.dbFile,
      port: 0,
      seedEmpty: false,
      clock: () => DEV_RUNTIME_SMOKE_NOW,
    });

    try {
      const started = await launcher.start();
      expect(countSnapshotsInFile(temp.dbFile)).toBe(1);

      const start = await fetchJsonWithTimeout(`${started.url}/sessions/start`, { method: 'POST' });
      expect(start.status).toBe(200);
      expect(start.body).toMatchObject({
        result: { ok: true, changed: true, reasonCode: 'session_started' },
        snapshot: {
          snapshotId: expect.any(String),
          schemaVersion: expect.any(Number),
          createdAt: DEV_RUNTIME_SMOKE_NOW,
        },
      });
      expect(countSnapshotsInFile(temp.dbFile)).toBe(2);
      expect(readLatestAppDataFromFile(temp.dbFile).activeSession).toBeTruthy();

      await launcher.close();

      const reopened = createDevLocalApiLauncher({
        dbFile: temp.dbFile,
        port: 0,
        seedEmpty: false,
        clock: () => DEV_RUNTIME_SMOKE_NOW,
      });
      try {
        const restarted = await reopened.start();
        const sessions = await fetchJsonWithTimeout(`${restarted.url}/sessions/summary`);
        expect(sessions.status).toBe(200);
        expect(sessions.body).toMatchObject({
          result: {
            activeSession: {
              templateId: 'push-a',
            },
          },
        });
      } finally {
        await reopened.close();
      }
    } finally {
      await launcher.close();
      temp.cleanup();
    }
  });
});
