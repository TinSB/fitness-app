import { describe, expect, it } from 'vitest';
import { PRODUCTION_WRITE_SHADOW_ALLOWED_ROUTE_IDS } from '../src/productionApi/productionWriteShadowMode';
import { API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES } from '../src/storage/apiStorageAdapter';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('phase 9 route surface still locked', () => {
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

  it('keeps backend-primary mutation candidate mapped to existing route ids only', () => {
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

    const mutationCandidateSource = readSource('src/productionCutover/backendPrimaryMutationCandidate.ts');
    for (const route of API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES) {
      expect(mutationCandidateSource).not.toContain(route);
    }
  });

  it('documents blocked route expansion', () => {
    const doc = readSource('docs/BACKEND_PRIMARY_REGRESSION_LOCK.md');

    for (const expected of [
      'no eighth browser mutation route',
      'POST /data-health/repair/apply',
      'backup/import/export over HTTP',
      'reset/recovery over HTTP',
    ]) {
      expect(doc).toContain(expected);
    }
  });
});
