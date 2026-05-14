import { describe, expect, it } from 'vitest';
import { PRODUCTION_WRITE_SHADOW_ALLOWED_ROUTE_IDS } from '../src/productionApi/productionWriteShadowMode';
import { API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES } from '../src/storage/apiStorageAdapter';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('phase 10 route surface still locked', () => {
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

  it('keeps production write candidates mapped to existing route ids only', () => {
    expect(PRODUCTION_WRITE_SHADOW_ALLOWED_ROUTE_IDS).toEqual([
      'dataHealthDismiss',
      'historyDataFlag',
      'historyEdit',
      'sessionStart',
      'activeSessionPatches',
      'activeSessionComplete',
      'activeSessionDiscard',
    ]);
    expect(PRODUCTION_WRITE_SHADOW_ALLOWED_ROUTE_IDS).toHaveLength(API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES.length);
  });

  it('documents blocked route expansion in the regression lock', () => {
    const doc = readSource('docs/CLOUD_PRODUCTION_REGRESSION_LOCK.md');

    for (const expected of [
      'No eighth browser mutation route is authorized.',
      'POST /data-health/repair/apply',
      'Backup/import/export over HTTP remains blocked.',
      'Reset/recovery over HTTP remains blocked.',
    ]) {
      expect(doc).toContain(expected);
    }
  });
});
