import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { API_BACKED_READ_ROUTES } from '../src/devApi/apiBackedReadClient';
import { collectSrcRuntimeFiles, readSource, relativePath, repoRoot } from './runtimeBoundaryTestHelpers';

const stripComments = (source: string) =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

const blockedNodeOnlyTokens = [
  'node:http',
  'node:sqlite',
  'devLauncher',
  'httpRuntimeAdapter',
  'serverAdapter',
  'sqliteRepository',
  'devApiRunner',
  'devDbRecovery',
];

describe('API-backed read manual App acceptance boundary', () => {
  it('keeps read prototype GET-only and leaves source-switch implementation absent', () => {
    expect(API_BACKED_READ_ROUTES).toEqual([
      '/health',
      '/app-data/summary',
      '/sessions/summary',
      '/history',
      '/history/:id',
      '/data-health/summary',
    ]);

    for (const path of [
      'src/storage/runtimeSourceSelector.ts',
      'src/storage/runtimeSourceConfig.ts',
      'src/storage/bootFromApiSnapshot.ts',
      'src/storage/apiWriteThroughRuntime.ts',
      'src/devApi/devApiMutationClient.ts',
    ]) {
      expect(existsSync(resolve(repoRoot(), path)), `${path} should not exist`).toBe(false);
    }

    expect(
      existsSync(resolve(repoRoot(), 'src/storage/apiStorageAdapter.ts')),
      'Task 5.24 API storage adapter may exist default-off',
    ).toBe(true);
  });

  it('keeps browser source free of Node-only runtime tokens and read client free of POST writes', () => {
    for (const file of collectSrcRuntimeFiles()) {
      const source = stripComments(readFileSync(file, 'utf8'));
      const offenders = blockedNodeOnlyTokens.filter((token) => source.includes(token));
      expect(offenders, `${relativePath(file)} should stay browser-safe`).toEqual([]);
    }

    const readClient = stripComments(readSource('src/devApi/apiBackedReadClient.ts'));
    expect(readClient).not.toMatch(/method\s*:\s*['"`](POST|PUT|PATCH|DELETE)['"`]/);
    expect(readClient).not.toMatch(/\/sessions\/active|\/data-health\/repair|\/backup\/|\/reset\/|\/recovery\//);
  });

  it('keeps package scripts and dependencies unchanged for manual acceptance', () => {
    const packageJson = JSON.parse(readSource('package.json')) as {
      scripts?: Record<string, string>;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };

    expect(Object.keys(packageJson.scripts || {}).sort()).toEqual([
      'api:dev',
      'api:dev:build',
      'build',
      'build:size-check',
      'build:stats',
      'dev',
      'predeploy:check',
      'preview',
      'test',
      'test:watch',
      'typecheck',
    ]);

    const deps = { ...(packageJson.dependencies || {}), ...(packageJson.devDependencies || {}) };
    expect(Object.keys(deps).filter((name) =>
      /auth|sync|cloud|monitoring|playwright|cypress|mutation-client/i.test(name),
    )).toEqual([]);
  });
});
