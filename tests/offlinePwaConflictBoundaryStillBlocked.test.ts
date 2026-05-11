import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { collectSrcRuntimeFiles, readSource, relativePath, repoRoot } from './runtimeBoundaryTestHelpers';

const stripComments = (source: string) =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

describe('offline/PWA conflict boundary remains blocked', () => {
  it('does not add offline queue or runtime source implementation files in Task 5.6', () => {
    for (const path of [
      'src/storage/offlineMutationQueue.ts',
      'src/storage/offlineReplay.ts',
      'src/storage/backgroundSync.ts',
      'src/storage/runtimeSourceSelector.ts',
      'src/storage/apiStorageAdapter.ts',
    ]) {
      expect(existsSync(resolve(repoRoot(), path)), `${path} should not exist yet`).toBe(false);
    }
  });

  it('keeps browser source free of offline queue and Node-only runtime tokens', () => {
    const forbidden = [
      'node:http',
      'node:sqlite',
      'devLauncher',
      'httpRuntimeAdapter',
      'serverAdapter',
      'sqliteRepository',
      'devApiRunner',
      'devDbRecovery',
      'offlineMutationQueue',
      'offlineReplay',
      'backgroundSync',
      'makeApiSourceOfTruth',
      'replaceLocalStorage',
    ];

    for (const file of collectSrcRuntimeFiles()) {
      const source = stripComments(readFileSync(file, 'utf8'));
      expect(forbidden.filter((token) => source.includes(token)), `${relativePath(file)} boundary`).toEqual([]);
    }
  });

  it('keeps docs from instructing queue or source switch implementation now', () => {
    const docs = [
      'docs/OFFLINE_PWA_CONFLICT_STRATEGY.md',
      'docs/MIGRATION_BACKUP_ROLLBACK_STRATEGY.md',
      'API_CONTRACT.md',
      'FULL_STACK_REFACTOR_PLAN.md',
    ].map(readSource).join('\n');

    for (const pattern of [
      /implement offline mutation queue now/i,
      /enable background sync now/i,
      /replay queued writes now/i,
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

