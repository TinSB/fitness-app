import { describe, expect, it } from 'vitest';
import { handleProductionRuntimeRoute } from '../apps/api/src/node/productionRuntimeRoutes';
import { API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES } from '../src/storage/apiStorageAdapter';
import { createRuntimeSourceSelector } from '../src/storage/runtimeSourceSelector';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('production health and capability endpoint', () => {
  it('handles GET /health without making runtime source-of-truth', () => {
    expect(handleProductionRuntimeRoute({ method: 'GET', path: '/health', requestId: 'health-1' })).toEqual({
      ok: true,
      status: 200,
      requestId: 'health-1',
      body: {
        route: '/health',
        status: 'ok',
        runtimeAvailable: false,
        sourceOfTruth: false,
      },
    });
  });

  it('handles GET /capabilities with disabled production features', () => {
    expect(handleProductionRuntimeRoute({ method: 'GET', path: '/capabilities' })).toMatchObject({
      ok: true,
      status: 200,
      body: {
        route: '/capabilities',
        capabilities: {
          runtimeAvailable: false,
          sourceOfTruth: false,
          auth: false,
          cloudSync: false,
          deploymentReady: false,
          monitoringReady: false,
          readContract: 'unsupported',
          writeContract: false,
          localStorageRole: 'default_fallback_migration_emergency',
        },
      },
    });
  });

  it('rejects unsupported paths and methods with stable errors', () => {
    expect(handleProductionRuntimeRoute({ method: 'GET', path: '/history' })).toMatchObject({
      ok: false,
      status: 404,
      error: { code: 'production_route_not_found' },
    });
    expect(handleProductionRuntimeRoute({ method: 'POST', path: '/health' })).toMatchObject({
      ok: false,
      status: 405,
      error: { code: 'production_route_method_not_allowed' },
    });
  });

  it('does not expose server startup behavior or browser-facing exports', () => {
    const source = readSource('apps/api/src/node/productionRuntimeRoutes.ts');

    for (const forbidden of ['listen(', 'createServer', 'from "fastify"', "from 'fastify'"]) {
      expect(source).not.toContain(forbidden);
    }
    expect(readSource('apps/api/src/index.ts')).not.toContain('productionRuntimeRoutes');
  });

  it('preserves runtime source and browser mutation route boundaries', () => {
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
});
