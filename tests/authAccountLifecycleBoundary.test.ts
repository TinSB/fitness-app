import { describe, expect, it } from 'vitest';
import { API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES } from '../src/storage/apiStorageAdapter';
import { createRuntimeSourceSelector } from '../src/storage/runtimeSourceSelector';
import { collectSrcRuntimeFiles, expectSourceNotToContain, readSource, relativePath } from './runtimeBoundaryTestHelpers';

describe('auth account lifecycle boundary', () => {
  it('keeps login/signup, token/session, and auth routes absent from browser runtime', () => {
    for (const file of collectSrcRuntimeFiles().filter((path) => !relativePath(path).startsWith('src/auth/'))) {
      expectSourceNotToContain(file, [
        '/auth',
        '/login',
        '/signup',
        '/users',
        'OAuth',
        'password',
        'token storage',
        'document.cookie',
        '/data-health/repair/apply',
        '/backup/import',
        '/backup/export',
        '/reset/',
        '/recovery/',
      ]);
    }
  });

  it('keeps auth skeleton pure and unavailable', () => {
    const source = [
      readSource('src/auth/authProviderTypes.ts'),
      readSource('src/auth/authBoundary.ts'),
    ].join('\n');

    for (const forbidden of [
      'localStorage.setItem',
      'sessionStorage.setItem',
      'document.cookie',
      'OAuth',
      'password',
      'Bearer',
      '/login',
      '/signup',
      'fetch(',
      'window.location',
    ]) {
      expect(source).not.toContain(forbidden);
    }
    expect(source).toContain('auth_runtime_not_implemented');
  });

  it('keeps exact accepted routes and localStorage default', () => {
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
});
