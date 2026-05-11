import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { collectSrcRuntimeFiles, readSource, relativePath } from './runtimeBoundaryTestHelpers';

const stripComments = (source: string) =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

describe('Phase 4 final data safety boundary', () => {
  it('keeps browser source free of blocked routes and Node-only runtime tokens', () => {
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

  it('keeps storage and docs from implementing source-of-truth migration', () => {
    const storage = stripComments(readSource('src/storage/localStorageAdapter.ts'));
    expect(storage).not.toContain('fetch(');
    expect(storage).not.toContain('apiBacked');
    expect(storage).not.toContain('dualWrite');

    const docs = [
      'docs/PHASE4_FINAL_DATA_SAFETY_AUDIT.md',
      'docs/API_BACKED_RUNTIME_STRATEGY_PLAN.md',
      'docs/PHASE4_SOURCE_OF_TRUTH_MIGRATION_READINESS_AUDIT.md',
    ].map(readSource).join('\n');

    expect(docs).not.toMatch(/switch source of truth now/i);
    expect(docs).not.toMatch(/replace localStorage now/i);
    expect(docs).not.toMatch(/enable production backend now/i);
  });
});
