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

  it('allows Task 5.25 selector/config and keeps later runtime implementation absent', () => {
    expect(existsSync(resolve(repoRoot(), 'src/storage/runtimeSourceSelector.ts')), 'Task 5.25 selector may exist default-off').toBe(true);
    expect(existsSync(resolve(repoRoot(), 'src/storage/runtimeSourceConfig.ts')), 'Task 5.25 config may exist default-off').toBe(true);
    expect(existsSync(resolve(repoRoot(), 'src/storage/bootFromApiSnapshot.ts')), 'Task 5.26 boot helper may exist default-off').toBe(true);
    expect(existsSync(resolve(repoRoot(), 'src/storage/apiWriteThroughRuntime.ts')), 'Task 5.27 write-through helper may exist default-off').toBe(true);
    expect(existsSync(resolve(repoRoot(), 'src/storage/apiStorageAdapter.ts')), 'Task 5.24 adapter may exist default-off').toBe(true);
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
