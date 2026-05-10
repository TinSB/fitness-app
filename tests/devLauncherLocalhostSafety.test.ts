import { describe, expect, it } from 'vitest';
import {
  createDevLocalApiLauncher,
  DevLocalApiLauncherError,
} from '../apps/api/src/node';
import { expectNoRawStack } from './runtimeBoundaryTestHelpers';
import { makeTempDevDb } from './devLauncherTestHelpers';

const expectLauncherError = async (operation: Promise<unknown>, code: string) => {
  try {
    await operation;
    throw new Error('Expected dev launcher error.');
  } catch (error) {
    expect(error).toBeInstanceOf(DevLocalApiLauncherError);
    expect((error as DevLocalApiLauncherError).code).toBe(code);
    expectNoRawStack({ code: (error as DevLocalApiLauncherError).code, message: (error as Error).message });
  }
};

describe('dev local API launcher localhost safety', () => {
  it('defaults to 127.0.0.1', async () => {
    const temp = makeTempDevDb();
    const launcher = createDevLocalApiLauncher({ dbFile: temp.dbFile, port: 0 });
    try {
      const started = await launcher.start();
      expect(started.host).toBe('127.0.0.1');
      expect(started.url).toBe(`http://127.0.0.1:${started.port}`);
    } finally {
      await launcher.close();
      temp.cleanup();
    }
  });

  it('rejects LAN-exposed hosts unless network access is explicit', async () => {
    const wildcard = makeTempDevDb();
    try {
      await expectLauncherError(
        createDevLocalApiLauncher({ dbFile: wildcard.dbFile, host: '0.0.0.0', port: 0 }).start(),
        'dev_launcher_network_access_denied',
      );
    } finally {
      wildcard.cleanup();
    }

    const nonLocal = makeTempDevDb();
    try {
      await expectLauncherError(
        createDevLocalApiLauncher({ dbFile: nonLocal.dbFile, host: '192.0.2.10', port: 0 }).start(),
        'dev_launcher_network_access_denied',
      );
    } finally {
      nonLocal.cleanup();
    }
  });

  it('allows explicit non-local bind only when allowNetworkAccess is true', async () => {
    const temp = makeTempDevDb();
    const launcher = createDevLocalApiLauncher({
      dbFile: temp.dbFile,
      host: '0.0.0.0',
      port: 0,
      allowNetworkAccess: true,
    });
    try {
      const started = await launcher.start();
      expect(started.host).toBe('0.0.0.0');
      expect(started.url).toBe(`http://127.0.0.1:${started.port}`);
    } finally {
      await launcher.close();
      temp.cleanup();
    }
  });
});
