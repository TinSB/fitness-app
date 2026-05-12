import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES } from '../src/storage/apiStorageAdapter';
import { collectSrcRuntimeFiles, expectSourceNotToContain, readSource, repoRoot } from './runtimeBoundaryTestHelpers';

const migrationFiles = [
  'src/storage/localStorageToSqliteMigrationDryRun.ts',
  'src/storage/localStorageToSqliteMigrationApply.ts',
  'src/storage/migrationRollbackRecovery.ts',
];

describe('migration regression boundary lock', () => {
  it('keeps migration regression lock docs present and App.tsx unwired', () => {
    expect(existsSync(resolve(repoRoot(), 'docs/MIGRATION_REGRESSION_LOCK.md'))).toBe(true);
    const app = readSource('src/App.tsx');
    expect(app).not.toMatch(/localStorageToSqliteMigration|migrationRollbackRecovery|VITE_IRONPATH_MIGRATION_APPLY|VITE_IRONPATH_MIGRATION_ROLLBACK/);
  });

  it('locks exact seven accepted browser mutation routes and no migration route', () => {
    expect(API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES).toEqual([
      '/data-health/issues/:issueId/dismiss',
      '/history/:id/data-flag',
      '/history/:id/edit',
      '/sessions/start',
      '/sessions/active/patches',
      '/sessions/active/complete',
      '/sessions/active/discard',
    ]);

    for (const file of migrationFiles) {
      const source = readSource(file);
      expect(source).not.toMatch(/fetch\s*\(|XMLHttpRequest|\/migration|\/backup\/import|\/backup\/export|\/reset\/|\/recovery\//);
      expect(source).not.toMatch(/\/data-health\/repair\/apply|\/sessions\/active\/archive|\/sessions\/active\/restore/);
      expect(source).not.toMatch(/broadMutationClient|devApiMutationClient|writeAnyMutation/);
    }
  });

  it('keeps migration helpers non-destructive and browser-runtime safe', () => {
    for (const file of migrationFiles) {
      const source = readSource(file);
      expect(source).not.toMatch(/localStorage\.(setItem|removeItem|clear)\s*\(/);
      expect(source).not.toMatch(/from ['"`]node:|node:http|node:sqlite|devLauncher|httpRuntimeAdapter|serverAdapter|sqliteRepository|devApiRunner|devDbRecovery/);
      expect(source).not.toMatch(/\b(auth|oauth|sync|cloud|deploy)\b|productionReady:\s*true/i);
    }

    for (const file of collectSrcRuntimeFiles()) {
      expectSourceNotToContain(file, ['node:http', 'node:sqlite', 'devLauncher', 'httpRuntimeAdapter', 'serverAdapter', 'sqliteRepository', 'devApiRunner', 'devDbRecovery']);
    }
  });

  it('keeps package scripts and dependencies unchanged for migration lock scope', () => {
    const packageJson = JSON.parse(readSource('package.json')) as {
      scripts?: Record<string, string>;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    expect(Object.keys(packageJson.scripts || {}).filter((script) => /migration|sqlite|rollback|auth|sync|cloud/i.test(script))).toEqual([]);
    const deps = { ...(packageJson.dependencies || {}), ...(packageJson.devDependencies || {}) };
    expect(Object.keys(deps).filter((name) => /sqlite|auth|sync|cloud|monitoring|playwright|cypress|mutation-client/i.test(name))).toEqual([]);
  });
});
