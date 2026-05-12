import { describe, expect, it } from 'vitest';
import { API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES } from '../src/storage/apiStorageAdapter';
import { collectSrcRuntimeFiles, expectSourceNotToContain, readSource } from './runtimeBoundaryTestHelpers';

describe('Phase 6 handoff boundary still blocked', () => {
  it('keeps Phase 6 handoff as docs-only without App.tsx production wiring', () => {
    const app = readSource('src/App.tsx');
    expect(app).not.toMatch(/PHASE6_HANDOFF_PLAN|production backend|auth provider|cloud sync|monitoring|deployment/i);
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

  it('keeps browser runtime free of blocked routes and production/auth/sync/deployment tokens', () => {
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

  it('does not instruct Phase 6 implementation before Phase 5 completion archive', () => {
    const docs = [
      'docs/PHASE6_HANDOFF_PLAN.md',
      'docs/PHASE5_EXIT_REGRESSION_LOCK.md',
      'API_CONTRACT.md',
      'FULL_STACK_REFACTOR_PLAN.md',
    ].map(readSource).join('\n');

    for (const pattern of [
      /implement production backend now/i,
      /implement auth now/i,
      /implement user accounts now/i,
      /implement cloud sync now/i,
      /deploy production now/i,
      /enable monitoring now/i,
      /make API primary production default now/i,
      /enable eighth browser mutation route/i,
    ]) {
      expect(docs).not.toMatch(pattern);
    }
  });
});
