import { describe, expect, it } from 'vitest';
import { API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES } from '../src/storage/apiStorageAdapter';
import { createRuntimeSourceSelector } from '../src/storage/runtimeSourceSelector';
import { readSource } from './runtimeBoundaryTestHelpers';

const docPath = 'docs/PHASE7_COMPLETION_ARCHIVE.md';

describe('phase 7 completion boundary still blocked', () => {
  it('keeps accepted browser mutation routes exactly unchanged', () => {
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

  it('keeps localStorage default and api-primary-dev non-production boundary', () => {
    expect(createRuntimeSourceSelector({ DEV: true })).toMatchObject({
      mode: 'localStorage',
      sourceOfTruth: 'localStorage',
      apiWriteEnabled: false,
    });
    expect(createRuntimeSourceSelector({ DEV: false })).toMatchObject({
      mode: 'localStorage',
      sourceOfTruth: 'localStorage',
      apiWriteEnabled: false,
    });
  });

  it('documents final blocked capabilities', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'POST /data-health/repair/apply',
      'backup/import/export over HTTP',
      'reset/recovery over HTTP',
      'eighth browser mutation route',
      'production backend runtime',
      'auth/user accounts runtime',
      'cloud sync runtime',
      'deployment runtime',
      'monitoring runtime',
      'production source-of-truth switch',
      'normalized tables/schema migration',
      'destructive real-data migration',
      'api-primary-dev production promotion',
      'real personal training data in tests, docs examples, fixtures, or acceptance evidence',
    ]) {
      expect(doc).toContain(expected);
    }
  });
});
