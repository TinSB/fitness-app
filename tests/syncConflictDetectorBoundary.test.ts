import { describe, expect, it } from 'vitest';
import { API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES } from '../src/storage/apiStorageAdapter';
import { createRuntimeSourceSelector } from '../src/storage/runtimeSourceSelector';
import { collectSrcRuntimeFiles, expectSourceNotToContain, readSource, relativePath } from './runtimeBoundaryTestHelpers';

describe('sync conflict detector boundary', () => {
  it('keeps broad browser runtime free of sync runtime and forbidden route behavior', () => {
    for (const file of collectSrcRuntimeFiles().filter((path) =>
      relativePath(path) !== 'src/sync/syncConflictDetector.ts',
    )) {
      expectSourceNotToContain(file, [
        '/sync',
        '/cloud',
        'remoteWriteQueue',
        'backgroundSync',
        'conflictMerge',
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

  it('keeps the sync detector pure and local', () => {
    const source = readSource('src/sync/syncConflictDetector.ts');
    expect(source).toContain('canAutoApply: false');
    expect(source).not.toContain('fetch(');
    expect(source).not.toContain('localStorage');
    expect(source).not.toContain('node:http');
    expect(source).not.toContain('node:sqlite');
  });
});
