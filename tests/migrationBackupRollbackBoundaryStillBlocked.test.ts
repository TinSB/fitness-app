import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { collectSrcRuntimeFiles, readSource, relativePath, repoRoot } from './runtimeBoundaryTestHelpers';

const stripComments = (source: string) =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

describe('migration backup and rollback boundary remains blocked', () => {
  it('does not add migration implementation files in Task 5.5', () => {
    for (const path of [
      'src/storage/localStorageToSqliteMigrationDryRun.ts',
      'src/storage/localStorageToSqliteMigrationApply.ts',
      'src/storage/migrationRollback.ts',
      'src/storage/migrationBackup.ts',
      'src/storage/apiStorageAdapter.ts',
      'src/storage/runtimeSourceSelector.ts',
    ]) {
      expect(existsSync(resolve(repoRoot(), path)), `${path} should not exist yet`).toBe(false);
    }
  });

  it('keeps browser source free of migration implementation and Node-only runtime tokens', () => {
    const forbidden = [
      'node:http',
      'node:sqlite',
      'devLauncher',
      'httpRuntimeAdapter',
      'serverAdapter',
      'sqliteRepository',
      'devApiRunner',
      'devDbRecovery',
      'localStorageToSqliteMigration',
      'migrationApply',
      'migrationRollback',
      'replaceLocalStorage',
      'offlineMutationQueue',
    ];

    for (const file of collectSrcRuntimeFiles()) {
      const source = stripComments(readFileSync(file, 'utf8'));
      expect(forbidden.filter((token) => source.includes(token)), `${relativePath(file)} boundary`).toEqual([]);
    }
  });

  it('keeps docs from instructing migration implementation now', () => {
    const docs = [
      'docs/MIGRATION_BACKUP_ROLLBACK_STRATEGY.md',
      'docs/RUNTIME_SOURCE_SWITCH_FEATURE_FLAG_PLAN.md',
      'API_CONTRACT.md',
      'FULL_STACK_REFACTOR_PLAN.md',
    ].map(readSource).join('\n');

    for (const pattern of [
      /run migration apply now/i,
      /write SQLite snapshot now/i,
      /delete localStorage now/i,
      /switch source of truth now/i,
      /replace localStorage now/i,
      /enable production backend now/i,
      /enable auth now/i,
      /enable sync now/i,
    ]) {
      expect(docs).not.toMatch(pattern);
    }
  });
});
