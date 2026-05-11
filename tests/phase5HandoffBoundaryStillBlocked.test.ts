import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { collectSrcRuntimeFiles, readSource, relativePath } from './runtimeBoundaryTestHelpers';

const stripComments = (source: string) =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

describe('Phase 5 handoff boundary remains blocked', () => {
  it('keeps browser runtime free of Phase 5 implementation and Node-only tokens', () => {
    const forbidden = [
      'apiBackedRuntime',
      'makeApiSourceOfTruth',
      'replaceLocalStorage',
      'dualWrite',
      'offlineMutationQueue',
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

  it('keeps docs from instructing Phase 5 implementation now', () => {
    const docs = [
      'docs/PHASE5_HANDOFF_PLAN.md',
      'docs/PHASE4_EXIT_REGRESSION_LOCK.md',
      'API_CONTRACT.md',
      'FULL_STACK_REFACTOR_PLAN.md',
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
