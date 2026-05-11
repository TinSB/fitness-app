import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { collectSrcRuntimeFiles, readSource, relativePath, repoRoot } from './runtimeBoundaryTestHelpers';

const stripComments = (source: string) =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

describe('API-backed runtime strategy boundary remains blocked', () => {
  it('does not add API-backed runtime, dual-write, or offline queue files', () => {
    for (const path of [
      'src/runtime/apiBackedRuntime.ts',
      'src/runtime/apiBackedAppDataLoader.ts',
      'src/storage/apiBackedStorageAdapter.ts',
      'src/storage/dualWriteAdapter.ts',
      'src/storage/offlineMutationQueue.ts',
      'src/services/apiBackedRuntimeStrategy.ts',
    ]) {
      expect(existsSync(resolve(repoRoot(), path)), `${path} should not exist`).toBe(false);
    }
  });

  it('keeps browser source free of API-backed runtime and Node-only tokens', () => {
    const forbidden = [
      'node:http',
      'node:sqlite',
      'devLauncher',
      'httpRuntimeAdapter',
      'serverAdapter',
      'sqliteRepository',
      'devApiRunner',
      'devDbRecovery',
      'apiBackedRuntime',
      'apiBackedStorage',
      'makeApiSourceOfTruth',
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
      'docs/API_BACKED_RUNTIME_STRATEGY_PLAN.md',
      'docs/PHASE4_SOURCE_OF_TRUTH_MIGRATION_READINESS_AUDIT.md',
      'API_CONTRACT.md',
      'FULL_STACK_REFACTOR_PLAN.md',
    ].map(readSource).join('\n');

    for (const pattern of [
      /implement API-backed runtime now/i,
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
