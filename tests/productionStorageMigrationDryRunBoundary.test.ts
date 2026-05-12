import { describe, expect, it } from 'vitest';
import { API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES } from '../src/storage/apiStorageAdapter';
import { createRuntimeSourceSelector } from '../src/storage/runtimeSourceSelector';
import { collectSrcRuntimeFiles, expectSourceNotToContain, readSource, relativePath } from './runtimeBoundaryTestHelpers';

describe('production storage migration dry run boundary', () => {
  it('keeps broad browser runtime free of migration writes and forbidden routes', () => {
    for (const file of collectSrcRuntimeFiles().filter((path) =>
      relativePath(path) !== 'src/storage/productionStorageMigrationDryRun.ts',
    )) {
      expectSourceNotToContain(file, [
        '/data-health/repair/apply',
        '/backup/import',
        '/backup/export',
        '/reset/',
        '/recovery/',
        'migration apply',
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

  it('keeps dry-run utility write-free', () => {
    const source = readSource('src/storage/productionStorageMigrationDryRun.ts');
    expect(source).toContain('writesPerformed: false');
    expect(source).not.toContain('localStorage');
    expect(source).not.toContain('node:sqlite');
    expect(source).not.toContain('sqliteRepository');
  });
});
