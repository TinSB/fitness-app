import { describe, expect, it } from 'vitest';
import { PRODUCTION_WRITE_SHADOW_ALLOWED_ROUTE_IDS } from '../src/productionApi/productionWriteShadowMode';
import { API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES } from '../src/storage/apiStorageAdapter';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('phase 8 route surface still locked', () => {
  it('keeps browser mutation routes exactly seven', () => {
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

  it('keeps write shadow IDs mapped to accepted route count without new route strings in runtime source', () => {
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

    const source = readSource('src/productionApi/productionWriteShadowMode.ts');
    for (const route of API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES) {
      expect(source).not.toContain(route);
    }
  });
});
