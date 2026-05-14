import { describe, expect, it } from 'vitest';
import { API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES } from '../src/storage/apiStorageAdapter';
import { createRuntimeSourceSelector } from '../src/storage/runtimeSourceSelector';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('phase 12 cloud database sync boundary still blocked', () => {
  it('keeps localStorage as the default source and route inventory at seven', () => {
    expect(createRuntimeSourceSelector({ DEV: true })).toMatchObject({
      mode: 'localStorage',
      sourceOfTruth: 'localStorage',
      apiWriteEnabled: false,
    });
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

  it('keeps default and background cloud sync blocked at entry', () => {
    const doc = readSource('docs/PHASE12_CLOUD_DATABASE_SYNC_INTEGRATION_ENTRY_GATE.md');

    for (const expected of [
      'Default cloud sync',
      'Background sync',
      'Automatic sync worker',
      'Timer or polling sync',
      'Service-worker sync',
      'Multi-device automatic sync',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('keeps prohibited cloud production capabilities blocked', () => {
    const doc = readSource('docs/PHASE12_CLOUD_DATABASE_SYNC_INTEGRATION_ENTRY_GATE.md');

    for (const expected of [
      'Production deployment runtime',
      'External monitoring upload',
      'SaaS/multi-user runtime',
      'Normalized training tables',
      'Destructive migration',
      'Real personal training data',
      'Service role key in browser',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('keeps package dependency and runtime implementation absent in Task 12.1', () => {
    const packageJson = JSON.parse(readSource('package.json')) as { dependencies: Record<string, string> };
    const doc = readSource('docs/PHASE12_CLOUD_DATABASE_SYNC_INTEGRATION_ENTRY_GATE.md');

    expect(packageJson.dependencies).not.toHaveProperty('@supabase/supabase-js');
    expect(doc).toContain('It does not connect to Supabase, add dependencies, build tables, write cloud data, pull cloud data, or sync data.');
  });
});
