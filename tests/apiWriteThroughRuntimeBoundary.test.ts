import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES } from '../src/storage/apiStorageAdapter';
import { readSource, repoRoot } from './runtimeBoundaryTestHelpers';

describe('API write-through runtime boundary', () => {
  it('adds only the write-through helper and does not wire App.tsx or persistence', () => {
    expect(existsSync(resolve(repoRoot(), 'src/storage/apiWriteThroughRuntime.ts'))).toBe(true);

    const app = readSource('src/App.tsx');
    const persistence = readSource('src/storage/persistence.ts');
    expect(app).not.toMatch(/apiWriteThroughRuntime|createApiWriteThroughRuntime|VITE_IRONPATH_RUNTIME_SOURCE|api-primary-dev/);
    expect(persistence).not.toMatch(/apiWriteThroughRuntime|createApiWriteThroughRuntime|apiStorageAdapter|api-primary-dev/);
  });

  it('keeps write-through constrained to the seven accepted routes', () => {
    expect(API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES).toEqual([
      '/data-health/issues/:issueId/dismiss',
      '/history/:id/data-flag',
      '/history/:id/edit',
      '/sessions/start',
      '/sessions/active/patches',
      '/sessions/active/complete',
      '/sessions/active/discard',
    ]);

    const source = readSource('src/storage/apiWriteThroughRuntime.ts');
    expect(source).not.toMatch(/\/data-health\/repair\/apply|\/backup\/import|\/backup\/export|\/reset\/|\/recovery\//);
    expect(source).not.toMatch(/devApiMutationClient|writeAcceptedMutation|mutationClient/);
  });

  it('keeps browser-safe, localStorage-free, production-free, and package-clean boundaries', () => {
    const source = readSource('src/storage/apiWriteThroughRuntime.ts');
    expect(source).not.toMatch(/from ['"`]node:|node:http|node:sqlite|devLauncher|httpRuntimeAdapter|serverAdapter|sqliteRepository|devApiRunner|devDbRecovery/);
    expect(source).not.toMatch(/localStorage\.(getItem|setItem|removeItem|clear)|window\.localStorage|globalThis\.localStorage/);
    expect(source).not.toMatch(/saveData|loadData|writeAppDataToLocalStorage|readStoredAppDataFromLocalStorage/);
    expect(source).not.toMatch(/\b(auth|oauth|sync|cloud|deploy)\b|productionReady:\s*true/i);

    const packageJson = JSON.parse(readSource('package.json')) as {
      scripts?: Record<string, string>;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    expect(Object.keys(packageJson.scripts || {}).filter((script) => /api-primary|write-through|auth|sync|cloud/i.test(script))).toEqual([]);
    const deps = { ...(packageJson.dependencies || {}), ...(packageJson.devDependencies || {}) };
    expect(Object.keys(deps).filter((name) => /api-primary|auth|sync|cloud|playwright|cypress/i.test(name))).toEqual([]);
  });
});
