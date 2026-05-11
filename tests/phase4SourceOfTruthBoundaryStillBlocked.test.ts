import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { collectSrcRuntimeFiles, readSource, relativePath, repoRoot } from './runtimeBoundaryTestHelpers';

const stripComments = (source: string) =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

describe('Phase 4 source-of-truth migration boundary remains blocked', () => {
  it('does not add API-backed storage, dual-write, or offline mutation queue files', () => {
    for (const path of [
      'src/storage/apiBackedStorageAdapter.ts',
      'src/storage/apiBackedLocalStorageAdapter.ts',
      'src/storage/dualWriteAdapter.ts',
      'src/storage/offlineMutationQueue.ts',
      'src/api/runtimePersistence.ts',
      'src/services/sourceOfTruthMigration.ts',
    ]) {
      expect(existsSync(resolve(repoRoot(), path)), `${path} should not exist`).toBe(false);
    }
  });

  it('keeps browser source free of source-of-truth migration and Node-only runtime tokens', () => {
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
    ];

    for (const file of collectSrcRuntimeFiles()) {
      const source = stripComments(readFileSync(file, 'utf8'));
      expect(forbidden.filter((token) => source.includes(token)), `${relativePath(file)} boundary`).toEqual([]);
    }
  });

  it('keeps docs from instructing implementation now', () => {
    const docs = [
      'docs/PHASE4_SOURCE_OF_TRUTH_MIGRATION_READINESS_AUDIT.md',
      'API_CONTRACT.md',
      'FULL_STACK_REFACTOR_PLAN.md',
    ].map(readSource).join('\n');

    for (const pattern of [
      /implement source-of-truth migration now/i,
      /replace localStorage now/i,
      /make API source of truth now/i,
      /enable production backend now/i,
      /enable auth now/i,
      /enable sync now/i,
    ]) {
      expect(docs).not.toMatch(pattern);
    }
  });
});
