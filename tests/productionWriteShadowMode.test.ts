import { describe, expect, it } from 'vitest';
import {
  createInMemoryProductionWriteShadowAdapter,
  PRODUCTION_WRITE_SHADOW_ALLOWED_ROUTE_IDS,
  runProductionWriteShadowMode,
  type ProductionWriteShadowRouteId,
} from '../src/productionApi/productionWriteShadowMode';
import { API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES } from '../src/storage/apiStorageAdapter';
import { createRuntimeSourceSelector } from '../src/storage/runtimeSourceSelector';
import { readSource } from './runtimeBoundaryTestHelpers';

const request = {
  routeId: 'historyEdit' as ProductionWriteShadowRouteId,
  payload: Object.freeze({ synthetic: true }),
  operationId: 'synthetic-operation-1',
};

describe('production write shadow mode', () => {
  it('is disabled by default and does not mutate local state', async () => {
    await expect(runProductionWriteShadowMode({ request })).resolves.toMatchObject({
      status: 'disabled',
      sourceOfTruth: false,
      localStorageMutated: false,
      routeId: 'historyEdit',
    });
  });

  it('requires explicit adapter acceptance and handles duplicate rejection', async () => {
    await expect(runProductionWriteShadowMode({ enabled: true, request })).resolves.toMatchObject({
      status: 'unsupported',
      reason: 'shadow_adapter_required',
    });

    const adapter = createInMemoryProductionWriteShadowAdapter();
    await expect(runProductionWriteShadowMode({ enabled: true, request, adapter })).resolves.toMatchObject({
      status: 'accepted_shadow',
      sourceOfTruth: false,
      localStorageMutated: false,
    });
    await expect(runProductionWriteShadowMode({ enabled: true, request, adapter })).resolves.toMatchObject({
      status: 'rejected',
      reason: 'duplicate_operation',
    });
  });

  it('reports adapter failure without local mutation', async () => {
    await expect(runProductionWriteShadowMode({
      enabled: true,
      request,
      adapter: {
        submitShadow: async () => ({ ok: false, reason: 'synthetic_failure' }),
      },
    })).resolves.toMatchObject({
      status: 'failed',
      reason: 'synthetic_failure',
      sourceOfTruth: false,
      localStorageMutated: false,
    });
  });

  it('keeps shadow route IDs exactly aligned with accepted browser routes in tests', () => {
    const routeIdToAcceptedRoute = {
      dataHealthDismiss: '/data-health/issues/:issueId/dismiss',
      historyDataFlag: '/history/:id/data-flag',
      historyEdit: '/history/:id/edit',
      sessionStart: '/sessions/start',
      activeSessionPatches: '/sessions/active/patches',
      activeSessionComplete: '/sessions/active/complete',
      activeSessionDiscard: '/sessions/active/discard',
    } as const;

    expect(PRODUCTION_WRITE_SHADOW_ALLOWED_ROUTE_IDS.map((routeId) => routeIdToAcceptedRoute[routeId])).toEqual(
      API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES,
    );
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

  it('does not add blocked routes, backend writes, or source-of-truth behavior', () => {
    const source = readSource('src/productionApi/productionWriteShadowMode.ts');

    for (const forbidden of [
      '/data-health/issues/',
      '/history/:id/data-flag',
      '/history/:id/edit',
      '/sessions/start',
      '/sessions/active/patches',
      '/sessions/active/complete',
      '/sessions/active/discard',
      '/data-health/repair/apply',
      '/backup/import',
      '/backup/export',
      '/reset',
      '/recovery',
      'localStorage.setItem',
      'saveData(',
      'sourceOfTruth: true',
      'apps/api/src/node',
      'node:http',
      'node:sqlite',
    ]) {
      expect(source).not.toContain(forbidden);
    }
    expect(createRuntimeSourceSelector({ DEV: true })).toMatchObject({
      mode: 'localStorage',
      sourceOfTruth: 'localStorage',
      apiWriteEnabled: false,
    });
  });
});
