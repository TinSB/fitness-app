import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES } from '../src/storage/apiStorageAdapter';
import { readSource, repoRoot } from './runtimeBoundaryTestHelpers';

describe('runtime source selector boundary', () => {
  it('adds only selector/config files and does not wire App.tsx or persistence', () => {
    expect(existsSync(resolve(repoRoot(), 'src/storage/runtimeSourceConfig.ts'))).toBe(true);
    expect(existsSync(resolve(repoRoot(), 'src/storage/runtimeSourceSelector.ts'))).toBe(true);
    expect(existsSync(resolve(repoRoot(), 'src/storage/bootFromApiSnapshot.ts'))).toBe(false);
    expect(existsSync(resolve(repoRoot(), 'src/storage/apiWriteThroughRuntime.ts'))).toBe(false);

    const app = readSource('src/App.tsx');
    const persistence = readSource('src/storage/persistence.ts');
    expect(app).not.toMatch(/runtimeSourceSelector|runtimeSourceConfig|VITE_IRONPATH_RUNTIME_SOURCE|api-primary-dev/);
    expect(persistence).not.toMatch(/runtimeSourceSelector|runtimeSourceConfig|apiStorageAdapter|api-primary-dev/);
  });

  it('keeps the selector localStorage-safe, production-free, and browser-safe', () => {
    const combined = `${readSource('src/storage/runtimeSourceConfig.ts')}\n${readSource('src/storage/runtimeSourceSelector.ts')}`;

    expect(combined).not.toMatch(/from ['"`]node:|node:http|node:sqlite|devLauncher|httpRuntimeAdapter|serverAdapter|sqliteRepository|devApiRunner|devDbRecovery/);
    expect(combined).not.toMatch(/localStorage\.(getItem|setItem|removeItem|clear)|window\.localStorage|globalThis\.localStorage/);
    expect(combined).not.toMatch(/saveData|loadData|writeAppDataToLocalStorage|readStoredAppDataFromLocalStorage/);
    expect(combined).not.toMatch(/auth|oauth|sync|cloud|deploy|productionReady:\s*true/i);
    expect(combined).not.toMatch(/\/data-health\/repair\/apply|\/backup\/import|\/backup\/export|\/reset\/|\/recovery\//);
  });

  it('does not expand the accepted write-route allowlist', () => {
    expect(API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES).toEqual([
      '/data-health/issues/:issueId/dismiss',
      '/history/:id/data-flag',
      '/history/:id/edit',
      '/sessions/start',
      '/sessions/active/patches',
      '/sessions/active/complete',
      '/sessions/active/discard',
    ]);
  });

  it('does not add package dependency, script, broad mutation client, or production runtime mode', () => {
    for (const path of [
      'src/devApi/devApiMutationClient.ts',
      'src/mutationClient.ts',
      'src/services/mutationClient.ts',
      'src/hooks/useMutationApi.ts',
      'src/api/mutations.ts',
    ]) {
      expect(existsSync(resolve(repoRoot(), path)), `${path} should not exist`).toBe(false);
    }

    const packageJson = JSON.parse(readSource('package.json')) as {
      scripts?: Record<string, string>;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    expect(Object.keys(packageJson.scripts || {}).filter((script) => /runtime-source|api-primary|auth|sync|cloud/i.test(script))).toEqual([]);
    const deps = { ...(packageJson.dependencies || {}), ...(packageJson.devDependencies || {}) };
    expect(Object.keys(deps).filter((name) => /runtime-source|auth|sync|cloud|playwright|cypress/i.test(name))).toEqual([]);
  });
});
