import { describe, expect, it } from 'vitest';
import { createDevLocalApiLauncher } from '../apps/api/src/node';
import {
  DEV_RUNTIME_SMOKE_NOW,
  countSnapshotsInFile,
  expectStableHttpErrorBody,
  fetchJsonWithTimeout,
  latestSnapshotLabelInFile,
  makeTempDevRuntimeDb,
  readLatestAppDataFromFile,
} from './devRuntimeSmokeTestHelpers';

const readRoutes = ['/app-data/summary', '/sessions/summary', '/history', '/data-health/summary'];

describe('dev runtime smoke seed and read behavior', () => {
  it('keeps seedEmpty=false empty and reports snapshot_not_found for data routes', async () => {
    const temp = makeTempDevRuntimeDb();
    const launcher = createDevLocalApiLauncher({
      dbFile: temp.dbFile,
      port: 0,
      seedEmpty: false,
      clock: () => DEV_RUNTIME_SMOKE_NOW,
    });

    try {
      const started = await launcher.start();
      expect(countSnapshotsInFile(temp.dbFile)).toBe(0);

      const health = await fetchJsonWithTimeout(`${started.url}/health`);
      expect(health.status).toBe(200);

      const summary = await fetchJsonWithTimeout(`${started.url}/app-data/summary`);
      expect(summary.status).toBe(404);
      expect(summary.body).toMatchObject({ error: { code: 'snapshot_not_found' } });
      expectStableHttpErrorBody(summary.body);
      expect(countSnapshotsInFile(temp.dbFile)).toBe(0);
    } finally {
      await launcher.close();
      temp.cleanup();
    }
  });

  it('seeds once, serves read routes, and preserves latest after close/reopen', async () => {
    const temp = makeTempDevRuntimeDb();
    const launcher = createDevLocalApiLauncher({
      dbFile: temp.dbFile,
      port: 0,
      seedEmpty: true,
      clock: () => DEV_RUNTIME_SMOKE_NOW,
    });

    try {
      const started = await launcher.start();
      expect(countSnapshotsInFile(temp.dbFile)).toBe(1);
      expect(latestSnapshotLabelInFile(temp.dbFile)).toBe('dev-launcher:seed-empty');

      for (const route of readRoutes) {
        const beforeCount = countSnapshotsInFile(temp.dbFile);
        const response = await fetchJsonWithTimeout(`${started.url}${route}`);
        expect(response.status, route).toBe(200);
        expect(response.body).toHaveProperty('result');
        expect(countSnapshotsInFile(temp.dbFile), route).toBe(beforeCount);
      }

      await launcher.close();
      expect(readLatestAppDataFromFile(temp.dbFile).history).toEqual([]);

      const reopened = createDevLocalApiLauncher({
        dbFile: temp.dbFile,
        port: 0,
        seedEmpty: true,
        clock: () => DEV_RUNTIME_SMOKE_NOW,
      });
      try {
        const restarted = await reopened.start();
        expect(countSnapshotsInFile(temp.dbFile)).toBe(1);
        expect((await fetchJsonWithTimeout(`${restarted.url}/app-data/summary`)).status).toBe(200);
      } finally {
        await reopened.close();
      }
    } finally {
      await launcher.close();
      temp.cleanup();
    }
  });
});
