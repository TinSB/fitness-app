import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { fetchJsonWithTimeout } from './devRuntimeSmokeTestHelpers';
import {
  makeTempRunnerDb,
  npmArgs,
  npmCommand,
  npmSpawnOptions,
  spawnApiDev,
  terminateRunner,
  terminateRunnerProcessTree,
  terminateRunnerProcessesForDb,
  waitForReadyLine,
} from './devApiRunnerTestHelpers';

const terminateWithRequiredCleanup = async (child: ReturnType<typeof spawnApiDev>) => {
  try {
    await terminateRunner(child, 5_000);
  } catch (error) {
    await terminateRunnerProcessTree(child).catch(() => undefined);
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Dev API runner did not exit after SIGTERM; killed process tree. ${message}`);
  }
};

describe('dev API runner manual acceptance smoke', () => {
  it('builds and drives the real npm runner through health, read, and failure smoke', async () => {
    const build = spawnSync(npmCommand(), npmArgs(['run', 'api:dev:build']), {
      ...npmSpawnOptions(),
      encoding: 'utf8',
    });
    expect(build.status, `${build.stdout}\n${build.stderr}`).toBe(0);

    const temp = makeTempRunnerDb();
    const child = spawnApiDev(['--port', '0', '--seed-empty', '--db', temp.dbFile]);

    try {
      const ready = await waitForReadyLine(child);
      expect(ready.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);

      const health = await fetchJsonWithTimeout(`${ready.url}/health`, {}, 1_000);
      expect(health.status).toBe(200);
      expect(health.body).toHaveProperty('result');

      const summary = await fetchJsonWithTimeout(`${ready.url}/app-data/summary`, {}, 1_000);
      expect(summary.status).toBe(200);
      expect(summary.body).toHaveProperty('result');

      const malformed = await fetchJsonWithTimeout(
        `${ready.url}/sessions/start`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{',
        },
        1_000,
      );
      expect(malformed.status).toBe(400);
      expect(malformed.body).toMatchObject({ error: { code: 'invalid_json', message: expect.any(String) } });

      const unknown = await fetchJsonWithTimeout(`${ready.url}/missing`, {}, 1_000);
      expect(unknown.status).toBe(404);
      expect(unknown.body).toMatchObject({ result: { reasonCode: 'unsupported_route' } });

      await terminateWithRequiredCleanup(child);
    } finally {
      if (child.exitCode === null && child.signalCode === null) {
        await terminateRunnerProcessTree(child);
      }
      terminateRunnerProcessesForDb(temp.dbFile);
      temp.cleanup();
    }
  });
});
