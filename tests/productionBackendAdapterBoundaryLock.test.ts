import { describe, expect, it } from 'vitest';
import { API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES } from '../src/storage/apiStorageAdapter';
import { createRuntimeSourceSelector } from '../src/storage/runtimeSourceSelector';
import { collectSrcRuntimeFiles, expectSourceNotToContain, readSource } from './runtimeBoundaryTestHelpers';

describe('production backend adapter boundary lock', () => {
  it('keeps adapter out of browser-facing modules and runtime source', () => {
    expect(readSource('apps/api/src/index.ts')).not.toContain('productionBackendAdapter');
    expect(readSource('src/App.tsx')).not.toContain('productionBackendAdapter');

    for (const file of collectSrcRuntimeFiles()) {
      expectSourceNotToContain(file, [
        'productionBackendAdapter',
        '/data-health/repair/apply',
        '/backup/import',
        '/backup/export',
        '/reset/',
        '/recovery/',
        '/auth',
        '/login',
        '/signup',
        '/sync',
        '/cloud',
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

  it('keeps localStorage default and accepted browser write routes unchanged', () => {
    expect(API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES).toEqual([
      '/data-health/issues/:issueId/dismiss',
      '/history/:id/data-flag',
      '/history/:id/edit',
      '/sessions/start',
      '/sessions/active/patches',
      '/sessions/active/complete',
      '/sessions/active/discard',
    ]);
    expect(createRuntimeSourceSelector({ DEV: true })).toMatchObject({
      mode: 'localStorage',
      sourceOfTruth: 'localStorage',
      apiWriteEnabled: false,
    });
  });

  it('keeps auth, deployment, database migration, and production data behavior absent', () => {
    const source = readSource('apps/api/src/node/productionBackendAdapter.ts');

    for (const forbidden of [
      'OAuth',
      'password',
      'user table',
      'token storage',
      'deploy',
      'node:sqlite',
      'sqliteRepository',
      'migration apply',
      'production data',
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });
});
