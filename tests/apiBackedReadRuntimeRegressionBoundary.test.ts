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

describe('API-backed read runtime regression boundary', () => {
  it('locks API-backed read routes to GET-only diagnostics', () => {
    expect(API_BACKED_READ_ROUTES).toEqual([
      '/health',
      '/app-data/summary',
      '/sessions/summary',
      '/history',
      '/history/:id',
      '/data-health/summary',
    ]);

    const source = stripComments(readSource('src/devApi/apiBackedReadClient.ts'));
    expect(source).not.toMatch(/method\s*:\s*['"`](POST|PUT|PATCH|DELETE)['"`]/);
    expect(source).not.toMatch(/\/sessions\/start|\/sessions\/active|\/history\/:id\/edit|\/data-health\/repair|\/backup\/|\/reset\/|\/recovery\//);
  });

  it('keeps source switch and API storage implementation absent', () => {
    for (const path of [
      'src/storage/runtimeSourceSelector.ts',
      'src/storage/runtimeSourceConfig.ts',
      'src/storage/apiStorageAdapter.ts',
      'src/storage/bootFromApiSnapshot.ts',
      'src/storage/apiWriteThroughRuntime.ts',
    ]) {
      expect(existsSync(resolve(repoRoot(), path)), `${path} should not exist`).toBe(false);
    }
  });

  it('keeps browser source free of Node-only runtime tokens', () => {
    for (const file of collectSrcRuntimeFiles()) {
      const source = stripComments(readFileSync(file, 'utf8'));
      const offenders = blockedNodeOnlyTokens.filter((token) => source.includes(token));
      expect(offenders, `${relativePath(file)} should stay browser-safe`).toEqual([]);
    }
  });

  it('keeps package and storage boundaries unchanged', () => {
    const packageJson = JSON.parse(readSource('package.json')) as {
      scripts?: Record<string, string>;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const deps = { ...(packageJson.dependencies || {}), ...(packageJson.devDependencies || {}) };

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
    expect(Object.keys(deps).filter((name) =>
      /auth|sync|cloud|monitoring|playwright|cypress|mutation-client/i.test(name),
    )).toEqual([]);

    const storage = readSource('src/storage/localStorageAdapter.ts') + readSource('src/storage/persistence.ts');
    expect(storage).not.toContain('fetch(');
    expect(storage).not.toContain('api-readonly');
  });
});
