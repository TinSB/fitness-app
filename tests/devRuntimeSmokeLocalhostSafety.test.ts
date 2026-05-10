import { describe, expect, it } from 'vitest';
import { createDevLocalApiLauncher, DevLocalApiLauncherError } from '../apps/api/src/node';
import {
  DEV_RUNTIME_SMOKE_NOW,
  fetchJsonWithTimeout,
  makeTempDevRuntimeDb,
} from './devRuntimeSmokeTestHelpers';

const expectStableLauncherError = (error: unknown, code: string) => {
  expect(error).toBeInstanceOf(DevLocalApiLauncherError);
  expect(error).toMatchObject({ code, message: expect.any(String) });
  const serialized = JSON.stringify(error);
  expect(serialized).not.toContain('stack');
  expect(serialized).not.toContain('cause');
};

describe('dev runtime smoke localhost safety', () => {
  it('uses 127.0.0.1 by default and allows localhost', async () => {
    const defaultTemp = makeTempDevRuntimeDb();
    const defaultLauncher = createDevLocalApiLauncher({
      dbFile: defaultTemp.dbFile,
      port: 0,
      clock: () => DEV_RUNTIME_SMOKE_NOW,
    });
    try {
      const started = await defaultLauncher.start();
      expect(started.host).toBe('127.0.0.1');
      expect((await fetchJsonWithTimeout(`${started.url}/health`)).status).toBe(200);
    } finally {
      await defaultLauncher.close();
      defaultTemp.cleanup();
    }

    const localhostTemp = makeTempDevRuntimeDb();
    const localhostLauncher = createDevLocalApiLauncher({
      dbFile: localhostTemp.dbFile,
      host: 'localhost',
      port: 0,
      clock: () => DEV_RUNTIME_SMOKE_NOW,
    });
    try {
      const started = await localhostLauncher.start();
      expect(started.host).toBe('localhost');
      expect((await fetchJsonWithTimeout(`${started.url}/health`)).status).toBe(200);
    } finally {
      await localhostLauncher.close();
      localhostTemp.cleanup();
    }
  });

  it('treats ::1 as local-safe when the environment supports binding it', async () => {
    const temp = makeTempDevRuntimeDb();
    const launcher = createDevLocalApiLauncher({
      dbFile: temp.dbFile,
      host: '::1',
      port: 0,
      clock: () => DEV_RUNTIME_SMOKE_NOW,
    });

    try {
      const started = await launcher.start();
      expect(started.host).toBe('::1');
      expect((await fetchJsonWithTimeout(`${started.url}/health`)).status).toBe(200);
    } catch (error) {
      expectStableLauncherError(error, 'dev_launcher_start_failed');
    } finally {
      await launcher.close();
      temp.cleanup();
    }
  });

  it('requires explicit opt-in for non-localhost binds', async () => {
    const denied = makeTempDevRuntimeDb();
    const deniedLauncher = createDevLocalApiLauncher({
      dbFile: denied.dbFile,
      host: '0.0.0.0',
      port: 0,
      clock: () => DEV_RUNTIME_SMOKE_NOW,
    });
    try {
      let error: unknown;
      try {
        await deniedLauncher.start();
      } catch (caught) {
        error = caught;
      }
      expectStableLauncherError(error, 'dev_launcher_network_access_denied');
    } finally {
      await deniedLauncher.close();
      denied.cleanup();
    }

    const nonLocal = makeTempDevRuntimeDb();
    const nonLocalLauncher = createDevLocalApiLauncher({
      dbFile: nonLocal.dbFile,
      host: '192.0.2.10',
      port: 0,
      clock: () => DEV_RUNTIME_SMOKE_NOW,
    });
    try {
      let error: unknown;
      try {
        await nonLocalLauncher.start();
      } catch (caught) {
        error = caught;
      }
      expectStableLauncherError(error, 'dev_launcher_network_access_denied');
    } finally {
      await nonLocalLauncher.close();
      nonLocal.cleanup();
    }

    const allowed = makeTempDevRuntimeDb();
    const allowedLauncher = createDevLocalApiLauncher({
      dbFile: allowed.dbFile,
      host: '0.0.0.0',
      allowNetworkAccess: true,
      port: 0,
      clock: () => DEV_RUNTIME_SMOKE_NOW,
    });
    try {
      const started = await allowedLauncher.start();
      expect(started.host).toBe('0.0.0.0');
      expect(started.url).toContain('127.0.0.1');
      expect((await fetchJsonWithTimeout(`${started.url}/health`)).status).toBe(200);
    } finally {
      await allowedLauncher.close();
      allowed.cleanup();
    }
  });
});
