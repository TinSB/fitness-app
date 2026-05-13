import { describe, expect, it } from 'vitest';
import { API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES } from '../src/storage/apiStorageAdapter';
import { createRuntimeSourceSelector } from '../src/storage/runtimeSourceSelector';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('phase 9 cutover boundary still blocked', () => {
  it('keeps localStorage default and api-primary-dev non-production', () => {
    expect(createRuntimeSourceSelector({ DEV: true })).toMatchObject({
      mode: 'localStorage',
      sourceOfTruth: 'localStorage',
      apiWriteEnabled: false,
    });
    expect(createRuntimeSourceSelector({
      DEV: false,
      VITE_IRONPATH_RUNTIME_SOURCE: 'api-primary-dev',
      VITE_IRONPATH_API_BASE_URL: 'https://example.invalid',
    })).toMatchObject({
      mode: 'localStorage',
      sourceOfTruth: 'localStorage',
      apiWriteEnabled: false,
    });
  });

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

  it('documents blocked cutover capabilities and route expansion', () => {
    const doc = readSource('docs/PHASE9_PRODUCTION_SOURCE_OF_TRUTH_CUTOVER_ENTRY_GATE.md');

    for (const expected of [
      'backup/import/export over HTTP',
      'reset/recovery over HTTP',
      'POST /data-health/repair/apply',
      'eighth browser mutation route',
      'normalized tables',
      'destructive migration',
      'real personal training data',
      'package dependency, package script, or lockfile changes',
      '`localStorage` remains fallback, migration source, and emergency backup.',
    ]) {
      expect(doc).toContain(expected);
    }
  });
});
