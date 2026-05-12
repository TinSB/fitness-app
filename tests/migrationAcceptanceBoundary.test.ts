import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readSource, repoRoot } from './runtimeBoundaryTestHelpers';

describe('migration acceptance boundary', () => {
  it('adds manual acceptance docs without new runtime wiring', () => {
    expect(existsSync(resolve(repoRoot(), 'docs/MIGRATION_ACCEPTANCE_MANUAL.md'))).toBe(true);
    expect(existsSync(resolve(repoRoot(), 'src/storage/localStorageToSqliteMigrationDryRun.ts'))).toBe(true);
    expect(existsSync(resolve(repoRoot(), 'src/storage/localStorageToSqliteMigrationApply.ts'))).toBe(true);

    const app = readSource('src/App.tsx');
    const persistence = readSource('src/storage/persistence.ts');
    expect(app).not.toMatch(/MIGRATION_ACCEPTANCE|localStorageToSqliteMigrationApply|VITE_IRONPATH_MIGRATION_APPLY/);
    expect(persistence).not.toMatch(/localStorageToSqliteMigrationApply|localStorageToSqliteMigrationDryRun|api-primary-dev/);
  });

  it('keeps migration helpers route-free, browser-safe, and localStorage-delete-free', () => {
    for (const file of [
      'src/storage/localStorageToSqliteMigrationDryRun.ts',
      'src/storage/localStorageToSqliteMigrationApply.ts',
    ]) {
      const source = readSource(file);
      expect(source).not.toMatch(/from ['"`]node:|node:http|node:sqlite|devLauncher|httpRuntimeAdapter|serverAdapter|sqliteRepository|devApiRunner|devDbRecovery/);
      expect(source).not.toMatch(/localStorage\.(setItem|removeItem|clear)|window\.localStorage|globalThis\.localStorage|writeAppDataToLocalStorage|saveData|deleteLocalStorage|replaceLocalStorage/);
      expect(source).not.toMatch(/method\s*:\s*['"`](POST|PUT|PATCH|DELETE)['"`]|fetch\(|\/data-health\/repair\/apply|\/backup\/import|\/backup\/export|\/reset\/|\/recovery\//);
      expect(source).not.toMatch(/\b(auth|oauth|sync|cloud|deploy)\b|productionReady:\s*true/i);
    }
  });
});
