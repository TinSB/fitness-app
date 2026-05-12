import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readSource, repoRoot } from './runtimeBoundaryTestHelpers';

describe('localStorage to SQLite migration apply boundary', () => {
  it('adds only the apply helper and does not wire App.tsx or persistence', () => {
    expect(existsSync(resolve(repoRoot(), 'src/storage/localStorageToSqliteMigrationDryRun.ts'))).toBe(true);
    expect(existsSync(resolve(repoRoot(), 'src/storage/localStorageToSqliteMigrationApply.ts'))).toBe(true);
    expect(existsSync(resolve(repoRoot(), 'src/storage/migrationRollback.ts'))).toBe(false);
    expect(existsSync(resolve(repoRoot(), 'src/storage/offlineMutationQueue.ts'))).toBe(false);

    const app = readSource('src/App.tsx');
    const persistence = readSource('src/storage/persistence.ts');
    expect(app).not.toMatch(/localStorageToSqliteMigrationApply|VITE_IRONPATH_MIGRATION_APPLY|api-primary-dev/);
    expect(persistence).not.toMatch(/localStorageToSqliteMigrationApply|localStorageToSqliteMigrationDryRun|api-primary-dev/);
  });

  it('keeps apply helper browser-safe, route-free, and localStorage-delete-free', () => {
    const source = readSource('src/storage/localStorageToSqliteMigrationApply.ts');

    expect(source).not.toMatch(/from ['"`]node:|node:http|node:sqlite|devLauncher|httpRuntimeAdapter|serverAdapter|sqliteRepository|devApiRunner|devDbRecovery/);
    expect(source).not.toMatch(/localStorage\.(setItem|removeItem|clear)|window\.localStorage|globalThis\.localStorage|writeAppDataToLocalStorage|saveData|deleteLocalStorage|replaceLocalStorage/);
    expect(source).not.toMatch(/method\s*:\s*['"`](POST|PUT|PATCH|DELETE)['"`]|fetch\(|\/data-health\/repair\/apply|\/backup\/import|\/backup\/export|\/reset\/|\/recovery\//);
    expect(source).not.toMatch(/\b(auth|oauth|sync|cloud|deploy)\b|productionReady:\s*true/i);
  });

  it('keeps package scripts and dependencies unchanged', () => {
    const packageJson = JSON.parse(readSource('package.json')) as {
      scripts?: Record<string, string>;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    expect(Object.keys(packageJson.scripts || {}).filter((script) => /migration|sqlite|auth|sync|cloud/i.test(script))).toEqual([]);
    const deps = { ...(packageJson.dependencies || {}), ...(packageJson.devDependencies || {}) };
    expect(Object.keys(deps).filter((name) => /sqlite|auth|sync|cloud|playwright|cypress/i.test(name))).toEqual([]);
  });
});
