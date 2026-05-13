import { describe, expect, it } from 'vitest';
import {
  createProductionRuntimeCapabilities,
  createProductionRuntimeSkeleton,
} from '../apps/api/src/node/productionRuntimeSkeleton';
import { API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES } from '../src/storage/apiStorageAdapter';
import { createRuntimeSourceSelector } from '../src/storage/runtimeSourceSelector';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('production runtime skeleton boundary', () => {
  it('creates an inert Node-only skeleton with disabled capabilities', () => {
    const skeleton = createProductionRuntimeSkeleton();

    expect(skeleton).toEqual({
      kind: 'production-runtime-skeleton-boundary',
      status: 'disabled',
      autoListen: false,
      capabilities: {
        status: 'disabled',
        runtimeAvailable: false,
        autoListen: false,
        sourceOfTruth: false,
        auth: false,
        cloudSync: false,
        deploymentReady: false,
        monitoringReady: false,
        readContract: 'unsupported',
        writeContract: false,
        localStorageRole: 'default_fallback_migration_emergency',
      },
    });
    expect(createProductionRuntimeCapabilities('scaffold_only')).toMatchObject({
      status: 'scaffold_only',
      sourceOfTruth: false,
    });
  });

  it('does not start or expose a server from the skeleton source', () => {
    const source = readSource('apps/api/src/node/productionRuntimeSkeleton.ts');

    for (const forbidden of ['listen(', 'createServer', 'Fastify', 'Express', 'Koa', 'Hono']) {
      expect(source).not.toContain(forbidden);
    }
  });

  it('keeps the skeleton out of browser-facing exports and App runtime', () => {
    expect(readSource('apps/api/src/index.ts')).not.toContain('productionRuntimeSkeleton');
    expect(readSource('src/App.tsx')).not.toContain('productionRuntimeSkeleton');
  });

  it('preserves source-of-truth and route boundaries', () => {
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
