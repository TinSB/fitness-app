import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { collectSrcRuntimeFiles, readSource, relativePath, repoRoot } from './runtimeBoundaryTestHelpers';

const stripComments = (source: string) =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

describe('AppData ownership boundary remains blocked', () => {
  it('does not add runtime source or API ownership implementation files in Task 5.2', () => {
    for (const path of [
      'src/storage/apiStorageAdapter.ts',
      'src/storage/runtimeSourceSelector.ts',
      'src/storage/runtimeSourceConfig.ts',
      'src/storage/appDataOwnership.ts',
      'src/storage/dualWriteAdapter.ts',
      'src/storage/offlineMutationQueue.ts',
    ]) {
      expect(existsSync(resolve(repoRoot(), path)), `${path} should not exist yet`).toBe(false);
    }
  });

  it('keeps browser source free of ownership migration and Node-only runtime tokens', () => {
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
      'appDataOwnership',
    ];

    for (const file of collectSrcRuntimeFiles()) {
      const source = stripComments(readFileSync(file, 'utf8'));
      expect(forbidden.filter((token) => source.includes(token)), `${relativePath(file)} boundary`).toEqual([]);
    }
  });

  it('keeps docs from instructing implementation now', () => {
    const docs = [
      'docs/APPDATA_OWNERSHIP_MATRIX.md',
      'docs/SOURCE_OF_TRUTH_MIGRATION_ARCHITECTURE_GATE.md',
      'API_CONTRACT.md',
      'FULL_STACK_REFACTOR_PLAN.md',
    ].map(readSource).join('\n');

    for (const pattern of [
      /implement API-backed runtime now/i,
      /switch source of truth now/i,
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

