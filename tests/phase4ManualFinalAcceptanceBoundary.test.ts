import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { collectSrcRuntimeFiles, readSource, relativePath } from './runtimeBoundaryTestHelpers';

const stripComments = (source: string) =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

describe('Phase 4 manual final acceptance boundary', () => {
  it('keeps final manual runbook scoped to four accepted routes and blocked follow-up routes', () => {
    const doc = readSource('docs/PHASE4_MANUAL_FINAL_ACCEPTANCE.md');

    for (const expected of [
      'No other browser mutation route is accepted.',
      'This does not approve a fifth mutation.',
      'This does not implement API-backed runtime.',
      'This does not replace localStorage.',
      'POST /data-health/issues/:issueId/dismiss',
      'POST /history/:id/data-flag',
      'POST /history/:id/edit',
      'POST /sessions/start',
      'POST /sessions/active/patches',
      'POST /sessions/active/complete',
      'POST /sessions/active/discard',
      'POST /data-health/repair/apply',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('keeps browser runtime free of blocked routes and Node-only tokens', () => {
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
});
