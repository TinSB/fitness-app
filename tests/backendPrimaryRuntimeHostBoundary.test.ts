import { describe, expect, it } from 'vitest';
import {
  createBackendPrimaryRuntimeHost,
  getBackendPrimaryRuntimeHostCapabilities,
  handleBackendPrimaryRuntimeRequest,
} from '../apps/api/src/node/backendPrimaryRuntimeHost';
import { createRuntimeSourceSelector } from '../src/storage/runtimeSourceSelector';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('backend primary runtime host boundary', () => {
  it('is disabled by default and not source-of-truth', () => {
    expect(createBackendPrimaryRuntimeHost()).toMatchObject({
      kind: 'backend-primary-runtime-host-boundary',
      status: 'disabled',
      enabled: false,
      sourceOfTruth: false,
      autoListen: false,
      capabilities: {
        nodeOnly: true,
        sourceOfTruth: false,
        auth: false,
        cloudSync: false,
        deploymentReady: false,
        monitoringReady: false,
        localStorageRole: 'default_fallback_migration_emergency',
      },
    });
  });

  it('reports candidate capabilities without promoting dev runtime', () => {
    expect(getBackendPrimaryRuntimeHostCapabilities('candidate')).toEqual({
      status: 'candidate',
      nodeOnly: true,
      autoListen: false,
      sourceOfTruth: false,
      auth: false,
      cloudSync: false,
      deploymentReady: false,
      monitoringReady: false,
      localStorageRole: 'default_fallback_migration_emergency',
      apiPrimaryDevPromoted: false,
      devRuntimeRunnerHosted: false,
      sqliteSnapshotRepositoryPromoted: false,
    });
  });

  it('handles only route-like capability requests and never listens', () => {
    const disabledHost = createBackendPrimaryRuntimeHost();
    expect(handleBackendPrimaryRuntimeRequest(disabledHost, {
      method: 'GET',
      path: '/capabilities',
      requestId: 'host-disabled',
    })).toMatchObject({
      ok: false,
      status: 501,
      requestId: 'host-disabled',
      sourceOfTruth: false,
      error: { code: 'backend_primary_host_disabled' },
    });

    const candidateHost = createBackendPrimaryRuntimeHost({ enabled: true });
    expect(handleBackendPrimaryRuntimeRequest(candidateHost, {
      method: 'GET',
      path: '/capabilities',
    })).toMatchObject({
      ok: true,
      status: 200,
      sourceOfTruth: false,
      capabilities: { status: 'candidate', autoListen: false },
    });
    expect(handleBackendPrimaryRuntimeRequest(candidateHost, {
      method: 'GET',
      path: '/sessions/start',
    })).toMatchObject({
      ok: false,
      status: 404,
      sourceOfTruth: false,
      error: { code: 'backend_primary_host_route_not_found' },
    });
  });

  it('keeps browser-facing exports and runtime source boundaries unchanged', () => {
    const browserApiIndex = readSource('apps/api/src/index.ts');
    const app = readSource('src/App.tsx');
    const source = readSource('apps/api/src/node/backendPrimaryRuntimeHost.ts');

    expect(browserApiIndex).not.toContain('backendPrimaryRuntimeHost');
    expect(app).not.toContain('backendPrimaryRuntimeHost');
    expect(source).not.toContain('listen(');
    expect(source).not.toContain('node:sqlite');
    expect(source).not.toContain('devApiRunner');
    expect(createRuntimeSourceSelector({ DEV: true })).toMatchObject({
      mode: 'localStorage',
      sourceOfTruth: 'localStorage',
      apiWriteEnabled: false,
    });
  });

  it('documents Task 9.2 boundaries and next task', () => {
    const doc = readSource('docs/BACKEND_PRIMARY_RUNTIME_HOST_BOUNDARY.md');

    for (const expected of [
      'Task 9.2 Backend-Primary Runtime Host Boundary V1',
      'Node-only backend-primary runtime host boundary',
      'The default host status is `disabled`.',
      'no auto-listen',
      'no HTTP server startup',
      'no source-of-truth behavior',
      'api-primary-dev is not promoted',
      'devApiRunner is not hosted as production backend',
      'Recommended next task: Task 9.3 Backend AppData Repository Candidate V1.',
    ]) {
      expect(doc).toContain(expected);
    }
  });
});
