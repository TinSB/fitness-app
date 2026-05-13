import { describe, expect, it } from 'vitest';
import { createInMemoryProductionPersistenceAdapter, type ProductionPersistenceAdapter } from '../apps/api/src/node/productionPersistence';
import { handleProductionReadContract } from '../apps/api/src/node/productionReadContract';
import { API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES } from '../src/storage/apiStorageAdapter';
import { createRuntimeSourceSelector } from '../src/storage/runtimeSourceSelector';
import { readSource } from './runtimeBoundaryTestHelpers';

const adapter = createInMemoryProductionPersistenceAdapter({
  appDataSummary: {
    snapshotId: 'synthetic-read-snapshot',
    generatedFrom: 'synthetic-fixture',
    workouts: 3,
    activeSession: true,
  },
  sessionsSummary: {
    activeSession: true,
    completedSessions: 3,
  },
  history: [
    { id: 'synthetic-history-1', completedAt: '2026-01-01T00:00:00.000Z', title: 'Synthetic Push Day' },
  ],
  dataHealthSummary: {
    issueCount: 1,
    dismissedIssueCount: 0,
  },
});

describe('production read contract implementation', () => {
  it('handles allowed read routes through the persistence adapter', () => {
    expect(handleProductionReadContract({ method: 'GET', path: '/app-data/summary' }, adapter)).toMatchObject({
      ok: true,
      status: 200,
      route: '/app-data/summary',
      sourceOfTruth: false,
      value: { snapshotId: 'synthetic-read-snapshot' },
    });
    expect(handleProductionReadContract({ method: 'GET', path: '/sessions/summary' }, adapter)).toMatchObject({
      ok: true,
      route: '/sessions/summary',
      value: { completedSessions: 3 },
    });
    expect(handleProductionReadContract({ method: 'GET', path: '/history' }, adapter)).toMatchObject({
      ok: true,
      route: '/history',
    });
    expect(handleProductionReadContract({ method: 'GET', path: '/history/synthetic-history-1' }, adapter)).toMatchObject({
      ok: true,
      route: '/history/:id',
      value: { title: 'Synthetic Push Day' },
    });
    expect(handleProductionReadContract({ method: 'GET', path: '/data-health/summary' }, adapter)).toMatchObject({
      ok: true,
      route: '/data-health/summary',
      value: { issueCount: 1 },
    });
  });

  it('returns stable not-found, method, route, and unsupported errors', () => {
    expect(handleProductionReadContract({ method: 'GET', path: '/history/missing' }, adapter)).toMatchObject({
      ok: false,
      status: 404,
      error: { code: 'production_read_not_found' },
    });
    expect(handleProductionReadContract({ method: 'POST', path: '/history' }, adapter)).toMatchObject({
      ok: false,
      status: 405,
      error: { code: 'production_read_method_not_allowed' },
    });
    expect(handleProductionReadContract({ method: 'GET', path: '/unknown' }, adapter)).toMatchObject({
      ok: false,
      status: 404,
      error: { code: 'production_read_route_not_found' },
    });

    const unsupportedAdapter: ProductionPersistenceAdapter = {
      ...adapter,
      readHistory: () => ({
        ok: false,
        error: {
          code: 'production_persistence_unsupported',
          message: 'unsupported fixture',
        },
      }),
    };
    expect(handleProductionReadContract({ method: 'GET', path: '/history' }, unsupportedAdapter)).toMatchObject({
      ok: false,
      status: 501,
      error: { code: 'production_read_unsupported' },
    });
  });

  it('keeps read contract Node-only and out of browser-facing exports', () => {
    const source = readSource('apps/api/src/node/productionReadContract.ts');

    for (const forbidden of ['listen(', 'createServer', 'localStorage', "from '../../../src/App", 'POST']) {
      expect(source).not.toContain(forbidden);
    }
    expect(readSource('apps/api/src/index.ts')).not.toContain('productionReadContract');
  });

  it('preserves source-of-truth and browser mutation route boundaries', () => {
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
