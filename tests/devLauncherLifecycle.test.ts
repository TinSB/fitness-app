import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createDevLocalApiLauncher } from '../apps/api/src/node';
import { snapshotCount } from './sqliteRepositoryTestHelpers';
import { createSqliteRepository } from '../apps/api/src/node';
import { fetchLauncherJson, makeTempDevDb, startDevLauncher } from './devLauncherTestHelpers';

describe('dev local API launcher lifecycle', () => {
  it('does not open resources or create DB files until start is called', async () => {
    const temp = makeTempDevDb();
    try {
      const launcher = createDevLocalApiLauncher({ dbFile: temp.dbFile, port: 0 });
      expect(existsSync(temp.dbFile)).toBe(false);
      await launcher.close();
      expect(existsSync(temp.dbFile)).toBe(false);
    } finally {
      temp.cleanup();
    }
  });

  it('starts an explicit ephemeral localhost server and serves health JSON', async () => {
    const temp = makeTempDevDb();
    const { launcher, started } = await startDevLauncher({ dbFile: temp.dbFile, seedEmpty: false });
    try {
      expect(started.host).toBe('127.0.0.1');
      expect(started.port).toBeGreaterThan(0);
      expect(started.url).toBe(`http://127.0.0.1:${started.port}`);

      const health = await fetchLauncherJson(`${started.url}/health`);
      expect(health.status).toBe(200);
      expect(health.headers.get('content-type')).toContain('application/json');
      expect(health.body).toMatchObject({
        result: {
          ok: true,
          service: 'ironpath-server-adapter',
          runtimeServer: false,
        },
      });
    } finally {
      await launcher.close();
      temp.cleanup();
    }
  });

  it('returns the existing running instance on repeated start without duplicate seeds', async () => {
    const temp = makeTempDevDb();
    const launcher = createDevLocalApiLauncher({ dbFile: temp.dbFile, port: 0, seedEmpty: true });
    try {
      const first = await launcher.start();
      const second = await launcher.start();
      expect(second).toEqual(first);

      await launcher.close();
      const repo = createSqliteRepository({ filename: temp.dbFile });
      try {
        expect(snapshotCount(repo.database)).toBe(1);
      } finally {
        repo.close();
      }
    } finally {
      await launcher.close();
      temp.cleanup();
    }
  });

  it('has idempotent close behavior', async () => {
    const temp = makeTempDevDb();
    const { launcher } = await startDevLauncher({ dbFile: temp.dbFile });
    try {
      await launcher.close();
      await launcher.close();
    } finally {
      temp.cleanup();
    }
  });
});
