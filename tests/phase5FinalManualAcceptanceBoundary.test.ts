import { describe, expect, it } from 'vitest';
import { API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES } from '../src/storage/apiStorageAdapter';
import { collectSrcRuntimeFiles, expectSourceNotToContain, readSource } from './runtimeBoundaryTestHelpers';

describe('Phase 5 final manual acceptance boundary', () => {
  it('keeps manual acceptance as docs-only without App.tsx wiring changes', () => {
    const app = readSource('src/App.tsx');
    expect(app).not.toMatch(/PHASE5_FINAL_MANUAL_ACCEPTANCE|api-primary-dev|localStorageToSqliteMigration|migrationRollbackRecovery/);
  });

  it('keeps exact seven accepted browser mutation routes', () => {
    expect(API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES).toEqual([
      '/data-health/issues/:issueId/dismiss',
      '/history/:id/data-flag',
      '/history/:id/edit',
      '/sessions/start',
      '/sessions/active/patches',
      '/sessions/active/complete',
      '/sessions/active/discard',
    ]);
  });

  it('keeps browser runtime free of blocked routes and Node-only tokens', () => {
    for (const file of collectSrcRuntimeFiles()) {
      expectSourceNotToContain(file, [
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
      ]);
    }
  });

  it('does not instruct production rollout or destructive data handling', () => {
    const docs = [
      'docs/PHASE5_FINAL_MANUAL_ACCEPTANCE.md',
      'docs/PHASE5_FINAL_SOURCE_OF_TRUTH_AUDIT.md',
      'API_CONTRACT.md',
      'FULL_STACK_REFACTOR_PLAN.md',
    ].map(readSource).join('\n');

    for (const pattern of [
      /require real personal training data/i,
      /delete daily-use localStorage/i,
      /make API primary production default now/i,
      /enable production backend now/i,
      /enable auth now/i,
      /enable sync now/i,
      /enable cloud/i,
      /enable eighth browser mutation route/i,
    ]) {
      expect(docs).not.toMatch(pattern);
    }
  });
});
