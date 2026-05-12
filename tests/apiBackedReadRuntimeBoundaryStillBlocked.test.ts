import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { collectSrcRuntimeFiles, readSource, relativePath, repoRoot } from './runtimeBoundaryTestHelpers';

const stripComments = (source: string) =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

describe('API-backed read runtime boundary remains constrained', () => {
  it('does not add source switch or storage implementation files before the approved runtime tasks', () => {
    for (const path of [
      'src/storage/runtimeSourceSelector.ts',
      'src/storage/runtimeSourceConfig.ts',
      'src/storage/bootFromApiSnapshot.ts',
      'src/storage/apiWriteThroughRuntime.ts',
    ]) {
      expect(existsSync(resolve(repoRoot(), path)), `${path} should not exist yet`).toBe(false);
    }
    expect(existsSync(resolve(repoRoot(), 'src/storage/apiStorageAdapter.ts')), 'Task 5.24 adapter may exist default-off').toBe(true);
  });

  it('keeps browser source free of source-switch/storage implementation and Node-only runtime tokens', () => {
    const forbidden = [
      'node:http',
      'node:sqlite',
      'devLauncher',
      'httpRuntimeAdapter',
      'serverAdapter',
      'sqliteRepository',
      'devApiRunner',
      'devDbRecovery',
      'api-primary-dev',
      'replaceLocalStorage',
      'apiStorageAdapter',
      'apiWriteThroughRuntime',
    ];

    for (const file of collectSrcRuntimeFiles()) {
      const path = relativePath(file);
      const source = stripComments(readFileSync(file, 'utf8'));
      const allowed = path === 'src/storage/apiStorageAdapter.ts' ? ['api-primary-dev', 'apiStorageAdapter'] : [];
      expect(forbidden.filter((token) => source.includes(token) && !allowed.includes(token)), `${path} boundary`).toEqual([]);
    }
  });

  it('keeps docs from instructing read runtime implementation now', () => {
    const docs = [
      'docs/API_BACKED_READ_RUNTIME_PLAN.md',
      'docs/OFFLINE_PWA_CONFLICT_STRATEGY.md',
      'API_CONTRACT.md',
      'FULL_STACK_REFACTOR_PLAN.md',
    ].map(readSource).join('\n');

    for (const pattern of [
      /implement API-backed read runtime now/i,
      /enable api-readonly now/i,
      /add POST writes now/i,
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

