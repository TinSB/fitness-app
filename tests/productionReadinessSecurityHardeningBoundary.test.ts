import { describe, expect, it } from 'vitest';
import { API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES } from '../src/storage/apiStorageAdapter';
import { createRuntimeSourceSelector } from '../src/storage/runtimeSourceSelector';
import { collectSrcRuntimeFiles, expectSourceNotToContain, readSource, relativePath } from './runtimeBoundaryTestHelpers';

describe('production readiness security hardening boundary', () => {
  it('keeps broad browser runtime free of forbidden routes and Node-only tokens', () => {
    for (const file of collectSrcRuntimeFiles().filter((path) =>
      !['src/observability/redaction.ts', 'src/config/environmentValidation.ts'].includes(relativePath(path)),
    )) {
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

  it('keeps security skeletons free of network, storage writes, and deployment behavior', () => {
    const source = [
      readSource('src/config/environmentValidation.ts'),
      readSource('src/observability/redaction.ts'),
    ].join('\n');

    for (const forbidden of [
      'fetch(',
      'XMLHttpRequest',
      'localStorage.setItem',
      'localStorage.removeItem',
      'sessionStorage.setItem',
      'navigator.sendBeacon',
      'node:http',
      'node:sqlite',
      'createServer',
      'listen(',
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });
});
