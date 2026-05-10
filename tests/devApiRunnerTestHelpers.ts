import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn, spawnSync, type ChildProcessWithoutNullStreams, type SpawnOptionsWithoutStdio } from 'node:child_process';
import { expect } from 'vitest';
import { fetchJsonWithTimeout } from './devRuntimeSmokeTestHelpers';
import { repoRoot } from './runtimeBoundaryTestHelpers';

export const DEV_API_READY_PREFIX = 'IronPath dev API ready: ';

export const npmCommand = () => process.execPath;

const npmExecCandidates = () =>
  [
    process.env.npm_execpath,
    process.platform === 'win32' ? 'C:\\Program Files\\nodejs\\node_modules\\npm\\bin\\npm-cli.js' : undefined,
    '/usr/local/lib/node_modules/npm/bin/npm-cli.js',
    '/usr/lib/node_modules/npm/bin/npm-cli.js',
  ].filter((candidate): candidate is string => Boolean(candidate));

export const npmArgs = (args: string[]) => {
  const npmExecPath = npmExecCandidates().find((candidate) => existsSync(candidate));
  if (!npmExecPath) throw new Error('npm executable path is required for npm runner tests.');
  return [npmExecPath, ...args];
};

export const npmSpawnOptions = (): SpawnOptionsWithoutStdio => ({
  cwd: repoRoot(),
  env: {
    ...process.env,
    FORCE_COLOR: '0',
    NO_COLOR: '1',
  },
});

export const makeTempRunnerDb = () => {
  const dir = mkdtempSync(join(tmpdir(), 'ironpath-dev-api-runner-'));
  const dbFile = join(dir, 'runner.sqlite');
  const cleanup = () => {
    if (existsSync(dir)) rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 });
  };
  return { dir, dbFile, cleanup };
};

export const ensureIronpathSiblingArtifacts = () => {
  const ironpath = resolve(repoRoot(), '.ironpath');
  mkdirSync(ironpath, { recursive: true });
  const files = [
    join(ironpath, 'dev-api.sqlite'),
    join(ironpath, 'dev-api.sqlite-wal'),
    join(ironpath, 'dev-api.sqlite-shm'),
    join(ironpath, 'sibling-artifact.txt'),
  ];
  const originals = new Map<string, Buffer | null>();
  files.forEach((file) => {
    originals.set(file, existsSync(file) ? readFileSync(file) : null);
    if (!existsSync(file)) writeFileSync(file, 'preserve', 'utf8');
  });
  const cleanup = () => {
    originals.forEach((original, file) => {
      if (original === null) {
        if (existsSync(file)) unlinkSync(file);
        return;
      }
      writeFileSync(file, original);
    });
  };

  return { files, cleanup };
};

export const waitForReadyLine = (
  child: ChildProcessWithoutNullStreams,
  timeoutMs = 20_000,
): Promise<{ url: string; stdout: string; stderr: string }> =>
  new Promise((resolveWait, rejectWait) => {
    let stdout = '';
    let stderr = '';
    const timeout = setTimeout(() => {
      cleanup();
      rejectWait(new Error(`Timed out waiting for dev API ready line. stdout=${stdout} stderr=${stderr}`));
    }, timeoutMs);

    const cleanup = () => {
      clearTimeout(timeout);
      child.stdout.off('data', onStdout);
      child.stderr.off('data', onStderr);
      child.off('exit', onExit);
      child.off('error', onError);
    };
    const onStdout = (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
      const line = stdout.split(/\r?\n/).find((item) => item.includes(DEV_API_READY_PREFIX));
      if (!line) return;
      cleanup();
      resolveWait({
        url: line.slice(line.indexOf(DEV_API_READY_PREFIX) + DEV_API_READY_PREFIX.length).trim(),
        stdout,
        stderr,
      });
    };
    const onStderr = (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    };
    const onExit = (code: number | null, signal: NodeJS.Signals | null) => {
      cleanup();
      rejectWait(new Error(`Runner exited before ready. code=${code} signal=${signal} stdout=${stdout} stderr=${stderr}`));
    };
    const onError = (error: Error) => {
      cleanup();
      rejectWait(error);
    };

    child.stdout.on('data', onStdout);
    child.stderr.on('data', onStderr);
    child.once('exit', onExit);
    child.once('error', onError);
  });

export const terminateRunner = async (child: ChildProcessWithoutNullStreams, timeoutMs = 5_000) => {
  if (child.exitCode !== null || child.signalCode !== null) return;

  const exitPromise = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolveExit) => {
    child.once('exit', (code, signal) => resolveExit({ code, signal }));
  });
  child.kill('SIGTERM');

  let timeout: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => reject(new Error('Dev API runner did not exit after SIGTERM.')), timeoutMs);
  });

  try {
    await Promise.race([exitPromise, timeoutPromise]);
  } catch (error) {
    if (process.platform === 'win32' && child.pid) {
      spawnSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    }
    child.kill('SIGKILL');
    throw error;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
};

export const terminateRunnerProcessTree = async (child: ChildProcessWithoutNullStreams, timeoutMs = 5_000) => {
  if (child.exitCode !== null || child.signalCode !== null) return;

  const exitPromise = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolveExit) => {
    child.once('exit', (code, signal) => resolveExit({ code, signal }));
  });

  if (process.platform === 'win32' && child.pid) {
    spawnSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  } else {
    child.kill('SIGKILL');
  }

  let timeout: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => reject(new Error('Dev API runner process tree did not exit after forced termination.')), timeoutMs);
  });

  try {
    await Promise.race([exitPromise, timeoutPromise]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
};

export const spawnApiDev = (args: string[]) =>
  spawn(npmCommand(), npmArgs(['run', 'api:dev', '--', ...args]), {
    ...npmSpawnOptions(),
    stdio: ['ignore', 'pipe', 'pipe'],
  });

export const expectRunnerHealth = async (url: string) => {
  const health = await fetchJsonWithTimeout(`${url}/health`, {}, 1_000);
  expect(health.status).toBe(200);
  expect(health.body).toMatchObject({ result: { ok: true } });
};
