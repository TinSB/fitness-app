import { describe, expect, it } from 'vitest';
import { API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES } from '../src/storage/apiStorageAdapter';
import { createRuntimeSourceSelector } from '../src/storage/runtimeSourceSelector';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('phase 8 completion boundary still blocked', () => {
  it('keeps accepted browser mutation routes exactly seven', () => {
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

  it('keeps localStorage and api-primary-dev boundaries', () => {
    expect(createRuntimeSourceSelector({ DEV: true })).toMatchObject({
      mode: 'localStorage',
      sourceOfTruth: 'localStorage',
      apiWriteEnabled: false,
    });
    expect(createRuntimeSourceSelector({
      DEV: false,
      VITE_IRONPATH_RUNTIME_SOURCE: 'api-primary-dev',
      VITE_IRONPATH_API_BASE_URL: 'https://api.ironpath.example',
    })).toMatchObject({
      mode: 'localStorage',
      sourceOfTruth: 'localStorage',
      apiWriteEnabled: false,
    });
  });

  it('documents final blocked production capabilities', () => {
    const doc = readSource('docs/PHASE8_COMPLETION_ARCHIVE.md');

    for (const expected of [
      'Full production backend remains unimplemented.',
      'Auth/user accounts remain unimplemented.',
      'Cloud sync remains unimplemented.',
      'Deployment runtime remains unimplemented.',
      'Monitoring runtime remains unimplemented.',
      'Production source-of-truth switch remains unimplemented.',
      'No normalized tables were added.',
      'No destructive migration was added.',
      'No real personal training data appeared in Phase 8 artifacts.',
      'No package dependency, package script, or lockfile change was introduced by Phase 8.',
      'POST /data-health/repair/apply',
      'backup/import/export over HTTP',
      'reset/recovery over HTTP',
      'eighth browser mutation route',
    ]) {
      expect(doc).toContain(expected);
    }
  });
});
