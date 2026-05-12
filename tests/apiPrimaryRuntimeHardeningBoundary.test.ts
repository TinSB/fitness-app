import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES } from '../src/storage/apiStorageAdapter';
import { readSource, repoRoot } from './runtimeBoundaryTestHelpers';

describe('API primary runtime hardening boundary', () => {
  it('adds hardening docs/tests without App.tsx or persistence wiring', () => {
    expect(existsSync(resolve(repoRoot(), 'docs/API_PRIMARY_RUNTIME_HARDENING.md'))).toBe(true);

    const app = readSource('src/App.tsx');
    const persistence = readSource('src/storage/persistence.ts');
    expect(app).not.toMatch(/apiWriteThroughRuntime|bootFromApiSnapshot|apiStorageAdapter|VITE_IRONPATH_RUNTIME_SOURCE|api-primary-dev/);
    expect(persistence).not.toMatch(/apiWriteThroughRuntime|bootFromApiSnapshot|apiStorageAdapter|api-primary-dev/);
  });

  it('keeps accepted browser mutation routes at exactly seven', () => {
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
      expect(source).not.toMatch(/devApiMutationClient|broadMutationClient|writeAnyMutation/);
    }
  });

  it('keeps package, production, and Node-only browser boundaries unchanged', () => {
    for (const file of [
      'src/storage/apiStorageAdapter.ts',
      'src/storage/apiWriteThroughRuntime.ts',
      'src/storage/bootFromApiSnapshot.ts',
    ]) {
      const source = readSource(file);
      expect(source).not.toMatch(/from ['"`]node:|node:http|node:sqlite|devLauncher|httpRuntimeAdapter|serverAdapter|sqliteRepository|devApiRunner|devDbRecovery/);
      expect(source).not.toMatch(/\b(auth|oauth|sync|cloud|deploy)\b|productionReady:\s*true/i);
    }

    const packageJson = JSON.parse(readSource('package.json')) as {
      scripts?: Record<string, string>;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    expect(Object.keys(packageJson.scripts || {}).filter((script) => /api-primary|hardening|auth|sync|cloud/i.test(script))).toEqual([]);
    const deps = { ...(packageJson.dependencies || {}), ...(packageJson.devDependencies || {}) };
    expect(Object.keys(deps).filter((name) => /auth|sync|cloud|monitoring|playwright|cypress|mutation-client/i.test(name))).toEqual([]);
  });
});
