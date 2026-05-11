import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { collectSrcRuntimeFiles, readSource, relativePath, repoRoot } from './runtimeBoundaryTestHelpers';

const stripComments = (source: string) =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

describe('Phase 4 completion boundary remains blocked', () => {
  it('keeps Phase 4 archive docs and handoff docs present', () => {
    for (const path of [
      'docs/PHASE4_COMPLETION_ARCHIVE.md',
      'docs/PHASE5_HANDOFF_PLAN.md',
      'docs/PHASE4_EXIT_REGRESSION_LOCK.md',
      'tests/phase5HandoffPlan.test.ts',
      'tests/phase5HandoffBoundaryStillBlocked.test.ts',
    ]) {
      expect(existsSync(resolve(repoRoot(), path)), `${path} should exist`).toBe(true);
    }
  });

  it('keeps browser source free of blocked Phase 5 and mutation-expansion tokens', () => {
    const forbidden = [
      '/sessions/active/patches',
      '/sessions/active/complete',
      '/sessions/active/discard',
      '/data-health/repair/apply',
      '/backup/import',
      '/backup/export',
      '/reset/',
      '/recovery/',
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

  it('keeps docs aligned on final archive without starting Phase 5', () => {
    const docs = [
      'docs/PHASE4_COMPLETION_ARCHIVE.md',
      'docs/PHASE5_HANDOFF_PLAN.md',
      'API_CONTRACT.md',
      'FULL_STACK_REFACTOR_PLAN.md',
      'docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md',
    ].map(readSource).join('\n');

    for (const expected of [
      'Task 4.75 Phase 4 Completion & Archive V1',
      'Phase 4 is complete.',
      'Do not start Phase 5 automatically.',
      'POST /data-health/issues/:issueId/dismiss',
      'POST /history/:id/data-flag',
      'POST /history/:id/edit',
      'POST /sessions/start',
      'localStorage remains source of truth',
      'API results never overwrite AppData',
      'Task 5.1 Source-of-truth Migration Architecture Gate V1',
    ]) {
      expect(docs).toContain(expected);
    }

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
