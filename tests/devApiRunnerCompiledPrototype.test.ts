import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fetchJsonWithTimeout } from './devRuntimeSmokeTestHelpers';
import {
  ensureIronpathSiblingArtifacts,
  expectRunnerHealth,
  makeTempRunnerDb,
  npmSpawnOptions,
  runApiDevBuild,
  spawnApiDev,
  terminateRunner,
  terminateRunnerProcessTree,
  waitForReadyLine,
} from './devApiRunnerTestHelpers';
import { repoRoot } from './runtimeBoundaryTestHelpers';
import { spawn } from 'node:child_process';

describe('compiled dev API runner prototype', () => {
  it('builds only into .ironpath/dev-api-runner and preserves sibling DB artifacts', () => {
    const preserved = ensureIronpathSiblingArtifacts();
    try {
      const build = runApiDevBuild();

      expect(build.status, `${build.stdout}\n${build.stderr}`).toBe(0);
      expect(existsSync(resolve(repoRoot(), '.ironpath/dev-api-runner/devApiRunner.js'))).toBe(true);
      preserved.files.forEach((file) => expect(existsSync(file), file).toBe(true));
    } finally {
      preserved.cleanup();
    }
  });

  it('runs through npm script arg passthrough, prints ready URL, serves health, seeds, and shuts down', async () => {
    const temp = makeTempRunnerDb();
    const child = spawnApiDev(['--port', '0', '--seed-empty', '--db', temp.dbFile]);

    try {
      const ready = await waitForReadyLine(child);
      expect(ready.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);

      await expectRunnerHealth(ready.url);
      const summary = await fetchJsonWithTimeout(`${ready.url}/app-data/summary`, {}, 1_000);
      expect(summary.status).toBe(200);
      expect(summary.body).toHaveProperty('result');
    } finally {
      if (child.exitCode === null && child.signalCode === null) {
        await terminateRunnerProcessTree(child);
      }
      temp.cleanup();
    }
  });

  it('compiled runner exits after SIGTERM without leaving the temp DB locked', async () => {
    const temp = makeTempRunnerDb();
    const compiledRunner = resolve(repoRoot(), '.ironpath/dev-api-runner/devApiRunner.js');
    const build = runApiDevBuild();
    expect(build.status, `${build.stdout}\n${build.stderr}`).toBe(0);

    const child = spawn(
      process.execPath,
      [compiledRunner, '--port', '0', '--seed-empty', '--db', temp.dbFile],
      {
        ...npmSpawnOptions(),
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );

    try {
      const ready = await waitForReadyLine(child);
      await expectRunnerHealth(ready.url);

      await terminateRunner(child);
      expect(child.exitCode ?? 0).toBe(0);
    } finally {
      if (child.exitCode === null && child.signalCode === null) {
        await terminateRunnerProcessTree(child);
      }
      temp.cleanup();
    }
  });
});
