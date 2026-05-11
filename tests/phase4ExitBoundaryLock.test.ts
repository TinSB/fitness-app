import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { collectSrcRuntimeFiles, readSource, relativePath } from './runtimeBoundaryTestHelpers';

const stripComments = (source: string) =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

describe('Phase 4 exit boundary lock', () => {
  it('keeps browser source free of blocked routes and Node-only tokens', () => {
    const forbidden = [
      '/sessions/active/patches',
      '/sessions/active/complete',
      '/sessions/active/discard',
      '/data-health/repair/apply',
      '/backup/import',
      '/backup/export',
      '/reset/',
      '/recovery/',
      'node:http',
      'node:sqlite',
      'devLauncher',
      'httpRuntimeAdapter',
      'serverAdapter',
      'sqliteRepository',
      'devApiRunner',
      'devDbRecovery',
    ];

    for (const file of collectSrcRuntimeFiles()) {
      const source = stripComments(readFileSync(file, 'utf8'));
      expect(forbidden.filter((token) => source.includes(token)), `${relativePath(file)} boundary`).toEqual([]);
    }
  });

  it('keeps docs from entering Phase 5 implementation', () => {
    const docs = [
      'docs/PHASE4_EXIT_REGRESSION_LOCK.md',
      'docs/PHASE4_MANUAL_FINAL_ACCEPTANCE.md',
      'docs/API_BACKED_RUNTIME_STRATEGY_PLAN.md',
    ].map(readSource).join('\n');

    for (const pattern of [
      /implement Phase 5 now/i,
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
