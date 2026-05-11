import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { collectSrcRuntimeFiles, readSource, relativePath } from './runtimeBoundaryTestHelpers';

const stripComments = (source: string) =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

describe('API client runtime boundary remains blocked', () => {
  it('keeps browser source free of broad mutation client and Node-only tokens', () => {
    const forbidden = [
      'node:http',
      'node:sqlite',
      'devLauncher',
      'httpRuntimeAdapter',
      'serverAdapter',
      'sqliteRepository',
      'devApiRunner',
      'devDbRecovery',
      'request(method',
      'method: string',
      'arbitraryPost',
      'broadMutationClient',
      'makeApiSourceOfTruth',
      'replaceLocalStorage',
      'offlineMutationQueue',
    ];

    for (const file of collectSrcRuntimeFiles()) {
      const source = stripComments(readFileSync(file, 'utf8'));
      expect(forbidden.filter((token) => source.includes(token)), `${relativePath(file)} boundary`).toEqual([]);
    }
  });

  it('keeps blocked route families out of browser runtime source', () => {
    const blockedRoutes = [
      '/data-health/repair/apply',
      '/backup/import',
      '/backup/export',
      '/reset/',
      '/recovery/',
      '/auth/',
      '/sync/',
      '/cloud/',
    ];

    for (const file of collectSrcRuntimeFiles()) {
      const source = stripComments(readFileSync(file, 'utf8'));
      expect(blockedRoutes.filter((token) => source.includes(token)), `${relativePath(file)} blocked routes`).toEqual([]);
    }
  });

  it('keeps docs from instructing implementation now', () => {
    const docs = [
      'docs/API_CLIENT_RUNTIME_STRATEGY.md',
      'docs/APPDATA_OWNERSHIP_MATRIX.md',
      'API_CONTRACT.md',
      'FULL_STACK_REFACTOR_PLAN.md',
    ].map(readSource).join('\n');

    for (const pattern of [
      /implement API clients now/i,
      /add a broad mutation client now/i,
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

