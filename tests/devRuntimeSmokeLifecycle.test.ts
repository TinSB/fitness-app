import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createDevLocalApiLauncher } from '../apps/api/src/node';
import {
  DEV_RUNTIME_SMOKE_NOW,
  expectShortHttpFailure,
  fetchJsonWithTimeout,
  makeTempDevRuntimeDb,
} from './devRuntimeSmokeTestHelpers';

describe('dev runtime smoke lifecycle', () => {
  it('starts only on demand, reuses repeated start, and closes cleanly', async () => {
    const temp = makeTempDevRuntimeDb();
    const launcher = createDevLocalApiLauncher({
      dbFile: temp.dbFile,
      port: 0,
      clock: () => DEV_RUNTIME_SMOKE_NOW,
    });

    expect(existsSync(temp.dbFile)).toBe(false);

    try {
      const first = await launcher.start();
      expect(existsSync(temp.dbFile)).toBe(true);
      expect(first.host).toBe('127.0.0.1');
      expect(first.port).toBeGreaterThan(0);

      const health = await fetchJsonWithTimeout(`${first.url}/health`);
      expect(health.status).toBe(200);
      expect(health.headers.get('content-type')).toContain('application/json');
      expect(health.body).toMatchObject({ result: { ok: true } });

      const second = await launcher.start();
      expect(second).toEqual(first);

      await launcher.close();
      await launcher.close();
      await expectShortHttpFailure(`${first.url}/health`);
    } finally {
      await launcher.close();
      temp.cleanup();
    }
  });
});
