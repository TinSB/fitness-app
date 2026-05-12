import { describe, expect, it } from 'vitest';
import { API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES } from '../src/storage/apiStorageAdapter';
import { createRuntimeSourceSelector } from '../src/storage/runtimeSourceSelector';
import { collectSrcRuntimeFiles, expectSourceNotToContain, readSource } from './runtimeBoundaryTestHelpers';

describe('Phase 5 completion boundary still blocked', () => {
  it('keeps completion archive as docs-only without Phase 6 App wiring', () => {
    const app = readSource('src/App.tsx');
    expect(app).not.toMatch(/PHASE5_COMPLETION_ARCHIVE|PHASE6_HANDOFF_PLAN|production backend|auth provider|cloud sync|monitoring|deployment/i);
  });

  it('keeps runtime modes default-localStorage and API primary dev/local only', () => {
    expect(createRuntimeSourceSelector({ DEV: true })).toMatchObject({ mode: 'localStorage' });
    expect(createRuntimeSourceSelector({ DEV: true, VITE_IRONPATH_RUNTIME_SOURCE: 'api-readonly' })).toMatchObject({
      mode: 'api-readonly',
      sourceOfTruth: 'localStorage',
      apiWriteEnabled: false,
    });
    expect(createRuntimeSourceSelector({
      DEV: false,
      VITE_IRONPATH_RUNTIME_SOURCE: 'api-primary-dev',
      VITE_IRONPATH_DEV_API_BASE_URL: 'http://127.0.0.1:8787',
    })).toMatchObject({ mode: 'localStorage' });
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

  it('does not instruct automatic Phase 6 or production rollout', () => {
    const docs = [
      'docs/PHASE5_COMPLETION_ARCHIVE.md',
      'docs/PHASE6_HANDOFF_PLAN.md',
      'docs/PHASE5_EXIT_REGRESSION_LOCK.md',
      'API_CONTRACT.md',
      'FULL_STACK_REFACTOR_PLAN.md',
    ].map(readSource).join('\n');

    for (const pattern of [
      /start Phase 6 automatically now/i,
      /start Task 6\.1 automatically now/i,
      /implement production backend now/i,
      /implement auth now/i,
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
