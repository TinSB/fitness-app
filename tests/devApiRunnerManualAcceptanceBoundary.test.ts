import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  collectSrcRuntimeFiles,
  expectSourceNotToContain,
  readSource,
  repoRoot,
} from './runtimeBoundaryTestHelpers';

const allowedScriptNames = new Set([
  'dev',
  'api:dev:build',
  'api:dev',
  'build',
  'build:stats',
  'build:size-check',
  'predeploy:check',
  'preview',
  'typecheck',
  'test',
  'test:watch',
]);

const forbiddenDependencyNames = [
  'tsx',
  'ts-node',
  'fastify',
  'express',
  'koa',
  'hono',
  '@trpc/server',
  'trpc',
  'graphql',
  'passport',
  'jsonwebtoken',
  'next-auth',
  'auth.js',
  'supabase',
  'firebase',
];

const nodeOnlyTokens = [
  'devApiRunner',
  'devLauncher',
  'httpRuntimeAdapter',
  'serverAdapter',
  'sqliteRepository',
  'node:http',
  'node:sqlite',
];

describe('dev API runner manual acceptance boundaries', () => {
  it('keeps package scripts limited to the Task 4.15 dev-only runner scripts', () => {
    const packageJson = JSON.parse(readFileSync(resolve(repoRoot(), 'package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    };

    expect(packageJson.scripts['api:dev:build']).toContain('--outDir .ironpath/dev-api-runner');
    expect(packageJson.scripts['api:dev']).toContain('npm run api:dev:build');

    const unexpectedScripts = Object.entries(packageJson.scripts).filter(([name, value]) => {
      if (allowedScriptNames.has(name)) return false;
      return /api:|runner|local-api|production|prod|deploy|auth|sync/i.test(`${name} ${value}`);
    });
    expect(unexpectedScripts).toEqual([]);
  });

  it('keeps dependencies and lockfile route free of runner frameworks and auth/sync tooling', () => {
    const packageJson = JSON.parse(readFileSync(resolve(repoRoot(), 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const deps = {
      ...(packageJson.dependencies || {}),
      ...(packageJson.devDependencies || {}),
    };

    forbiddenDependencyNames.forEach((name) => expect(deps).not.toHaveProperty(name));
  });

  it('keeps generated runner output and dev DB artifacts ignored and untracked', () => {
    const gitignore = readSource('.gitignore');
    expect(gitignore).toContain('.ironpath/');
    expect(gitignore).toContain('*.sqlite');
    expect(gitignore).toContain('*.sqlite-wal');
    expect(gitignore).toContain('*.sqlite-shm');

    const ignored = spawnSync('git', ['check-ignore', '.ironpath/dev-api-runner/devApiRunner.js'], {
      cwd: repoRoot(),
      encoding: 'utf8',
    });
    expect(ignored.status, ignored.stderr).toBe(0);

    const trackedGenerated = spawnSync('git', ['ls-files', '.ironpath/dev-api-runner'], {
      cwd: repoRoot(),
      encoding: 'utf8',
    });
    expect(trackedGenerated.stdout.trim()).toBe('');
  });

  it('keeps browser-facing runtime source free of the runner and Node-only stack', () => {
    collectSrcRuntimeFiles().forEach((file) => expectSourceNotToContain(file, nodeOnlyTokens));
    expectSourceNotToContain(resolve(repoRoot(), 'apps/api/src/index.ts'), nodeOnlyTokens);
  });
});
