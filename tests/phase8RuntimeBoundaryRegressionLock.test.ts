import { describe, expect, it } from 'vitest';
import { createProductionRuntimeSkeleton } from '../apps/api/src/node/productionRuntimeSkeleton';
import { createProductionApiClient } from '../src/productionApi/productionApiClient';
import { compareProductionDualRead } from '../src/productionApi/productionDualReadComparison';
import { runProductionWriteShadowMode, type ProductionWriteShadowRouteId } from '../src/productionApi/productionWriteShadowMode';
import { API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES } from '../src/storage/apiStorageAdapter';
import { createRuntimeSourceSelector } from '../src/storage/runtimeSourceSelector';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('phase 8 runtime boundary regression lock', () => {
  it('keeps source-of-truth and skeleton boundaries disabled', async () => {
    expect(createRuntimeSourceSelector({ DEV: true })).toMatchObject({
      mode: 'localStorage',
      sourceOfTruth: 'localStorage',
      apiWriteEnabled: false,
    });
    expect(createProductionRuntimeSkeleton()).toMatchObject({
      autoListen: false,
      capabilities: { sourceOfTruth: false, auth: false, cloudSync: false },
    });
    expect(createProductionApiClient().enabled).toBe(false);
    await expect(compareProductionDualRead({
      localValue: { synthetic: true },
      productionRead: async () => ({ ok: true, value: { synthetic: true } }),
    })).resolves.toMatchObject({ status: 'disabled', diagnosticOnly: true, mutatedLocal: false });
    await expect(runProductionWriteShadowMode({
      request: { routeId: 'historyEdit' as ProductionWriteShadowRouteId, payload: { synthetic: true } },
    })).resolves.toMatchObject({ status: 'disabled', sourceOfTruth: false, localStorageMutated: false });
  });

  it('keeps route inventory exactly seven and blocked capabilities documented', () => {
    const doc = readSource('docs/PHASE8_RUNTIME_BOUNDARY_REGRESSION_LOCK.md');

    expect(API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES).toEqual([
      '/data-health/issues/:issueId/dismiss',
      '/history/:id/data-flag',
      '/history/:id/edit',
      '/sessions/start',
      '/sessions/active/patches',
      '/sessions/active/complete',
      '/sessions/active/discard',
    ]);
    for (const expected of [
      'no eighth browser mutation route',
      'POST /data-health/repair/apply',
      'backup/import/export over HTTP',
      'reset/recovery over HTTP',
      'no auth/user accounts/cloud sync/deployment/monitoring runtime',
      'no normalized tables',
      'no destructive migration',
      'no real personal data fixtures',
    ]) {
      expect(doc).toContain(expected);
    }
  });
});
