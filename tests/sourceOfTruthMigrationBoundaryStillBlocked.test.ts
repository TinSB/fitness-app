import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { collectSrcRuntimeFiles, readSource, relativePath, repoRoot } from './runtimeBoundaryTestHelpers';

const stripComments = (source: string) =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

describe('source-of-truth migration boundary remains blocked', () => {
  it('does not add migration implementation files beyond the Task 5.24 adapter and Task 5.25 selector', () => {
    expect(existsSync(resolve(repoRoot(), 'src/storage/runtimeSourceSelector.ts'))).toBe(true);
    expect(existsSync(resolve(repoRoot(), 'src/storage/runtimeSourceConfig.ts'))).toBe(true);
    for (const path of [
      'src/storage/localStorageToSqliteMigration.ts',
      'src/storage/offlineMutationQueue.ts',
      'src/services/sourceOfTruthMigration.ts',
    ]) {
      expect(existsSync(resolve(repoRoot(), path)), `${path} should not exist yet`).toBe(false);
    }

    expect(
      existsSync(resolve(repoRoot(), 'src/storage/apiStorageAdapter.ts')),
      'Task 5.24 API storage adapter may exist default-off',
    ).toBe(true);
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
      'makeApiSourceOfTruth',
      'replaceLocalStorage',
      'dualWrite',
      'offlineMutationQueue',
      'localStorageToSqliteMigration',
    ];

    for (const file of collectSrcRuntimeFiles()) {
      const source = stripComments(readFileSync(file, 'utf8'));
      expect(forbidden.filter((token) => source.includes(token)), `${relativePath(file)} boundary`).toEqual([]);
    }
  });

  it('keeps docs from instructing migration implementation now', () => {
    const docs = [
      'docs/SOURCE_OF_TRUTH_MIGRATION_ARCHITECTURE_GATE.md',
      'docs/PHASE4_COMPLETION_ARCHIVE.md',
      'docs/PHASE5_HANDOFF_PLAN.md',
      'API_CONTRACT.md',
      'FULL_STACK_REFACTOR_PLAN.md',
    ].map(readSource).join('\n');

    for (const pattern of [
      /implement source-of-truth migration now/i,
      /switch source of truth now/i,
      /replace localStorage now/i,
      /make API source of truth now/i,
      /enable production backend now/i,
      /enable auth now/i,
      /enable sync now/i,
      /deploy production now/i,
    ]) {
      expect(docs).not.toMatch(pattern);
    }
  });
});
