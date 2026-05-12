import { describe, expect, it } from 'vitest';
import { API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES } from '../src/storage/apiStorageAdapter';
import { createRuntimeSourceSelector } from '../src/storage/runtimeSourceSelector';
import { collectSrcRuntimeFiles, expectSourceNotToContain, readSource } from './runtimeBoundaryTestHelpers';

describe('Phase 5 exit boundary lock', () => {
  it('keeps accepted runtime modes default-localStorage and dev/local only', () => {
    expect(createRuntimeSourceSelector({ DEV: true })).toMatchObject({ mode: 'localStorage' });
    expect(createRuntimeSourceSelector({ DEV: true, VITE_IRONPATH_RUNTIME_SOURCE: 'api-readonly' })).toMatchObject({
      mode: 'api-readonly',
      sourceOfTruth: 'localStorage',
      apiWriteEnabled: false,
    });
    expect(createRuntimeSourceSelector({
      DEV: true,
      VITE_IRONPATH_RUNTIME_SOURCE: 'api-primary-dev',
      VITE_IRONPATH_DEV_API_BASE_URL: 'http://127.0.0.1:8787',
    })).toMatchObject({
      mode: 'api-primary-dev',
      sourceOfTruth: 'api-primary-dev',
      productionReady: false,
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

  it('keeps docs from entering Phase 6 implementation', () => {
    const docs = [
      'docs/PHASE5_EXIT_REGRESSION_LOCK.md',
      'docs/PHASE5_FINAL_MANUAL_ACCEPTANCE.md',
      'docs/PHASE5_FINAL_SOURCE_OF_TRUTH_AUDIT.md',
    ].map(readSource).join('\n');

    for (const pattern of [
      /implement Phase 6 now/i,
      /make API primary production default now/i,
      /delete localStorage now/i,
      /replace localStorage now/i,
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
