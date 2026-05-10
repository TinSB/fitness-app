import {
  closeSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  rmSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn, spawnSync, type ChildProcessWithoutNullStreams, type SpawnOptionsWithoutStdio } from 'node:child_process';
import { expect } from 'vitest';
import { fetchJsonWithTimeout } from './devRuntimeSmokeTestHelpers';
import { repoRoot } from './runtimeBoundaryTestHelpers';

export const DEV_API_READY_PREFIX = 'IronPath dev API ready: ';

type RunnerProcess = ChildProcessWithoutNullStreams & {
  releaseRunnerBuildLock?: () => void;
};

const runnerBuildLockFile = join(tmpdir(), 'ironpath-dev-api-runner-build.lock');
const sleepSync = (ms: number) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

const acquireRunnerBuildLock = (timeoutMs = 30_000) => {
  const startedAt = Date.now();

  while (true) {
    try {
      const fd = openSync(runnerBuildLockFile, 'wx');
      let released = false;
      return () => {
        if (released) return;
        released = true;
        try {
          closeSync(fd);
        } catch {
          // Best-effort cleanup for a test-only interprocess lock.
        }
        try {
          unlinkSync(runnerBuildLockFile);
        } catch {
          // Best-effort cleanup for a test-only interprocess lock.
        }
      };
    } catch (error) {
      const code = error instanceof Error && 'code' in error ? (error as NodeJS.ErrnoException).code : undefined;
      if (code !== 'EEXIST') throw error;

      try {
        const ageMs = Date.now() - statSync(runnerBuildLockFile).mtimeMs;
        if (ageMs > 120_000) unlinkSync(runnerBuildLockFile);
      } catch {
        // If the stale-lock check races with another worker, retry acquisition.
      }

      if (Date.now() - startedAt > timeoutMs) {
        throw new Error(`Timed out waiting for dev API runner build lock: ${runnerBuildLockFile}`);
      }
      sleepSync(50);
    }
  }
};

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
    terminateRunnerProcessesForDb(dbFile);
    for (let attempt = 0; attempt < 10; attempt += 1) {
      try {
        if (existsSync(dir)) rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 });
        return;
      } catch (error) {
        if (attempt === 9) throw error;
        sleepSync(250);
      }
    }
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
    const releaseRunnerBuildLock = () => {
      const runner = child as RunnerProcess;
      runner.releaseRunnerBuildLock?.();
      delete runner.releaseRunnerBuildLock;
    };
    let stdout = '';
    let stderr = '';
    const timeout = setTimeout(() => {
      cleanup();
      releaseRunnerBuildLock();
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
      releaseRunnerBuildLock();
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
      releaseRunnerBuildLock();
      rejectWait(new Error(`Runner exited before ready. code=${code} signal=${signal} stdout=${stdout} stderr=${stderr}`));
    };
    const onError = (error: Error) => {
      cleanup();
      releaseRunnerBuildLock();
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

export const terminateRunnerProcessesForDb = (dbFile: string) => {
  if (process.platform !== 'win32') return;
  const escapedDbFile = dbFile.replaceAll("'", "''");
  spawnSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-Command',
      [
        `$needle = '${escapedDbFile}'`,
        "Get-CimInstance Win32_Process | Where-Object { $_.ProcessId -ne $PID -and $_.CommandLine -like \"*$needle*\" -and ($_.Name -match 'node|npm|cmd') } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }",
      ].join('; '),
    ],
    { stdio: 'ignore' },
  );
};

export const runApiDevBuild = () => {
  const releaseLock = acquireRunnerBuildLock();
  try {
    return spawnSync(npmCommand(), npmArgs(['run', 'api:dev:build']), {
      ...npmSpawnOptions(),
      encoding: 'utf8',
    });
  } finally {
    releaseLock();
  }
};

export const spawnApiDev = (args: string[]) => {
  const releaseLock = acquireRunnerBuildLock();
  const child = spawn(npmCommand(), npmArgs(['run', 'api:dev', '--', ...args]), {
    ...npmSpawnOptions(),
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  (child as RunnerProcess).releaseRunnerBuildLock = releaseLock;
  child.once('exit', releaseLock);
  child.once('error', releaseLock);
  return child;
};

export const expectRunnerHealth = async (url: string) => {
  const health = await fetchJsonWithTimeout(`${url}/health`, {}, 1_000);
  expect(health.status).toBe(200);
  expect(health.body).toMatchObject({ result: { ok: true } });
};
