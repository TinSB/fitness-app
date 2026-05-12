import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES } from '../src/storage/apiStorageAdapter';
import { readSource, repoRoot } from './runtimeBoundaryTestHelpers';

describe('API primary runtime manual acceptance boundary', () => {
  it('keeps manual acceptance docs-only and leaves App.tsx unwired', () => {
    expect(existsSync(resolve(repoRoot(), 'docs/API_PRIMARY_RUNTIME_MANUAL_ACCEPTANCE.md'))).toBe(true);
    expect(existsSync(resolve(repoRoot(), 'src/storage/apiWriteThroughRuntime.ts'))).toBe(true);

    const app = readSource('src/App.tsx');
    expect(app).not.toMatch(/apiWriteThroughRuntime|bootFromApiSnapshot|apiStorageAdapter|VITE_IRONPATH_RUNTIME_SOURCE|api-primary-dev/);
  });

  it('keeps accepted route list at seven and blocked routes absent from runtime helpers', () => {
    expect(API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES).toEqual([
      '/data-health/issues/:issueId/dismiss',
      '/history/:id/data-flag',
      '/history/:id/edit',
      '/sessions/start',
      '/sessions/active/patches',
      '/sessions/active/complete',
      '/sessions/active/discard',
    ]);

    for (const file of [
      'src/storage/apiStorageAdapter.ts',
      'src/storage/apiWriteThroughRuntime.ts',
      'src/storage/bootFromApiSnapshot.ts',
    ]) {
      const source = readSource(file);
      expect(source).not.toMatch(/\/data-health\/repair\/apply|\/backup\/import|\/backup\/export|\/reset\/|\/recovery\//);
    }
  });

  it('keeps package and production boundaries unchanged', () => {
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
    expect(Object.keys(deps).filter((name) => /auth|sync|cloud|monitoring|playwright|cypress|mutation-client/i.test(name))).toEqual([]);
  });
});
