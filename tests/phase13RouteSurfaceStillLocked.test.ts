import { describe, expect, it } from 'vitest';
import { API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES } from '../src/storage/apiStorageAdapter';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('phase 13 route surface still locked', () => {
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

  it('keeps blocked repair reset recovery import and export routes absent from browser adapter routes', () => {
    const routes = API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES.join('\n');

    for (const forbidden of [
      '/data-health/repair/apply',
      '/backup',
      '/import',
      '/export',
      '/reset',
      '/recovery',
      '/cloud/sync',
      '/deploy',
      '/monitoring',
    ]) {
      expect(routes).not.toContain(forbidden);
    }
  });

  it('does not add production deployment or monitoring routes to route docs lock', () => {
    const doc = readSource('docs/PRODUCTION_RELEASE_REGRESSION_LOCK.md');

    for (const expected of [
      'POST /data-health/repair/apply remains blocked',
      'backup/import/export over HTTP remains blocked',
      'reset/recovery over HTTP remains blocked',
      'no eighth browser mutation route',
    ]) {
      expect(doc).toContain(expected);
    }
  });
});
