import { existsSync, rmSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  createDevLocalApiLauncher,
  DevLocalApiLauncherError,
} from '../apps/api/src/node';
import { expectNoRawStack } from './runtimeBoundaryTestHelpers';
import { fetchLauncherJson, makeTempDevDb, occupyLocalPort } from './devLauncherTestHelpers';

describe('dev local API launcher startup failure cleanup', () => {
  it('cleans opened resources when listen fails after repository creation and can retry', async () => {
    const temp = makeTempDevDb();
    const occupied = await occupyLocalPort();
    const launcher = createDevLocalApiLauncher({
      dbFile: temp.dbFile,
      port: occupied.port,
      clock: () => '2026-05-10T12:00:00.000Z',
    });

    try {
      try {
        await launcher.start();
        throw new Error('Expected launcher start failure.');
      } catch (error) {
        expect(error).toBeInstanceOf(DevLocalApiLauncherError);
        expect((error as DevLocalApiLauncherError).code).toBe('dev_launcher_start_failed');
        expectNoRawStack({ code: (error as DevLocalApiLauncherError).code, message: (error as Error).message });
      }

      if (existsSync(temp.dbFile)) rmSync(temp.dbFile);
      await occupied.close();

      const started = await launcher.start();
      const health = await fetchLauncherJson(`${started.url}/health`);
      expect(health.status).toBe(200);
    } finally {
      await occupied.close();
      await launcher.close();
      temp.cleanup();
    }
  });
});
