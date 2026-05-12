import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readSource, repoRoot } from './runtimeBoundaryTestHelpers';

describe('boot from API snapshot boundary', () => {
  it('adds only the boot helper and does not wire App.tsx or persistence', () => {
    expect(existsSync(resolve(repoRoot(), 'src/storage/bootFromApiSnapshot.ts'))).toBe(true);
    expect(existsSync(resolve(repoRoot(), 'src/storage/apiWriteThroughRuntime.ts')), 'Task 5.27 write-through helper may exist default-off').toBe(true);

    const app = readSource('src/App.tsx');
    const persistence = readSource('src/storage/persistence.ts');
    expect(app).not.toMatch(/bootFromApiSnapshot|VITE_IRONPATH_RUNTIME_SOURCE|api-primary-dev/);
    expect(persistence).not.toMatch(/bootFromApiSnapshot|apiStorageAdapter|runtimeSourceSelector|api-primary-dev/);
  });

  it('keeps the boot helper browser-safe, localStorage-write-free, and production-free', () => {
    const source = readSource('src/storage/bootFromApiSnapshot.ts');

    expect(source).not.toMatch(/from ['"`]node:|node:http|node:sqlite|devLauncher|httpRuntimeAdapter|serverAdapter|sqliteRepository|devApiRunner|devDbRecovery/);
    expect(source).not.toMatch(/localStorage\.(getItem|setItem|removeItem|clear)|window\.localStorage|globalThis\.localStorage/);
    expect(source).not.toMatch(/saveData|loadData|writeAppDataToLocalStorage|readStoredAppDataFromLocalStorage/);
    expect(source).not.toMatch(/method\s*:\s*['"`](POST|PUT|PATCH|DELETE)['"`]|\/data-health\/repair\/apply|\/backup\/import|\/backup\/export|\/reset\/|\/recovery\//);
    expect(source).not.toMatch(/\b(auth|oauth|sync|cloud|deploy)\b|productionReady:\s*true/i);
  });

  it('does not add package scripts, dependencies, broad mutation clients, or production runtime files', () => {
    for (const path of [
      'src/devApi/devApiMutationClient.ts',
      'src/mutationClient.ts',
      'src/services/mutationClient.ts',
      'src/hooks/useMutationApi.ts',
      'src/api/mutations.ts',
      'src/storage/localStorageToSqliteMigrationApply.ts',
    ]) {
      expect(existsSync(resolve(repoRoot(), path)), `${path} should not exist`).toBe(false);
    }

    const packageJson = JSON.parse(readSource('package.json')) as {
      scripts?: Record<string, string>;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    expect(Object.keys(packageJson.scripts || {}).filter((script) => /api-primary|boot|snapshot|auth|sync|cloud/i.test(script))).toEqual([]);
    const deps = { ...(packageJson.dependencies || {}), ...(packageJson.devDependencies || {}) };
    expect(Object.keys(deps).filter((name) => /api-primary|auth|sync|cloud|playwright|cypress/i.test(name))).toEqual([]);
  });
});
