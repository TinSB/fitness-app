import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES } from '../src/storage/apiStorageAdapter';
import { readSource, repoRoot } from './runtimeBoundaryTestHelpers';

describe('API primary runtime acceptance boundary', () => {
  it('adds acceptance coverage without new runtime files or App.tsx wiring', () => {
    expect(existsSync(resolve(repoRoot(), 'docs/API_PRIMARY_RUNTIME_ACCEPTANCE.md'))).toBe(true);
    expect(existsSync(resolve(repoRoot(), 'src/storage/apiWriteThroughRuntime.ts'))).toBe(true);

    const app = readSource('src/App.tsx');
    expect(app).not.toMatch(/apiWriteThroughRuntime|bootFromApiSnapshot|apiStorageAdapter|VITE_IRONPATH_RUNTIME_SOURCE|api-primary-dev/);
  });

  it('keeps the accepted write route allowlist exactly seven routes', () => {
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
      expect(source).not.toMatch(/\/sessions\/active\/archive|\/sessions\/active\/restore/);
    }
  });

  it('keeps localStorage, package, production, and browser-build boundaries intact', () => {
    for (const file of [
      'src/storage/apiStorageAdapter.ts',
      'src/storage/apiWriteThroughRuntime.ts',
      'src/storage/bootFromApiSnapshot.ts',
    ]) {
      const source = readSource(file);
      expect(source).not.toMatch(/localStorage\.(setItem|removeItem|clear)|window\.localStorage|globalThis\.localStorage/);
      expect(source).not.toMatch(/\b(auth|oauth|sync|cloud|deploy)\b|productionReady:\s*true/i);
      expect(source).not.toMatch(/from ['"`]node:|node:http|node:sqlite|devLauncher|httpRuntimeAdapter|serverAdapter|sqliteRepository|devApiRunner|devDbRecovery/);
    }

    const packageJson = JSON.parse(readSource('package.json')) as {
      scripts?: Record<string, string>;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    expect(Object.keys(packageJson.scripts || {}).filter((script) => /api-primary|production|auth|sync|cloud/i.test(script))).toEqual([]);
    const deps = { ...(packageJson.dependencies || {}), ...(packageJson.devDependencies || {}) };
    expect(Object.keys(deps).filter((name) => /api-primary|auth|sync|cloud|playwright|cypress/i.test(name))).toEqual([]);
  });
});
