import { describe, expect, it } from 'vitest';
import {
  API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES,
  API_STORAGE_ADAPTER_RUNTIME_SOURCE,
  createApiStorageAdapter,
  DEFAULT_API_STORAGE_ADAPTER_BASE_URL,
  resolveApiStorageAdapterConfig,
  type ApiStorageAdapterEnabledConfig,
  type ApiStorageSessionDiscardBody,
} from '../src/storage/apiStorageAdapter';

const enabledConfig: ApiStorageAdapterEnabledConfig = {
  enabled: true,
  status: 'enabled',
  runtimeSource: API_STORAGE_ADAPTER_RUNTIME_SOURCE,
  baseUrl: 'http://127.0.0.1:8787',
  timeoutMs: 50,
};

const sourceMetadata = {
  sourceSnapshotHash: 'source-hash',
  sourceSnapshotVersion: 'phase5-api-storage-v1',
  mutationId: 'mutation-1',
  idempotencyKey: 'idempotency-1',
  requestFingerprint: 'fingerprint-1',
  confirmed: true as const,
};

const discardBody: ApiStorageSessionDiscardBody = {
  ...sourceMetadata,
  activeSessionId: 'active-1',
  confirmDiscard: true,
};

const successBody = {
  result: {
    ok: true,
    changed: true,
    status: 'success',
    reasonCode: 'session_discarded',
    message: 'discarded',
  },
  snapshot: {
    snapshotId: 'snapshot-api-storage-1',
    schemaVersion: 1,
    createdAt: '2026-05-12T00:00:00.000Z',
  },
};

describe('API storage adapter prototype', () => {
  it('is default-off and requires dev/local api-primary-dev runtime source', () => {
    expect(resolveApiStorageAdapterConfig({ DEV: false })).toMatchObject({
      enabled: false,
      status: 'disabled',
      reason: 'not_dev',
    });
    expect(resolveApiStorageAdapterConfig({ DEV: true })).toMatchObject({
      enabled: false,
      status: 'disabled',
      reason: 'runtime_source_off',
    });
    expect(resolveApiStorageAdapterConfig({
      DEV: true,
      VITE_IRONPATH_RUNTIME_SOURCE: API_STORAGE_ADAPTER_RUNTIME_SOURCE,
    })).toMatchObject({
      enabled: true,
      status: 'enabled',
      baseUrl: DEFAULT_API_STORAGE_ADAPTER_BASE_URL,
      timeoutMs: 1500,
    });
    expect(resolveApiStorageAdapterConfig({
      DEV: true,
      VITE_IRONPATH_RUNTIME_SOURCE: API_STORAGE_ADAPTER_RUNTIME_SOURCE,
      VITE_IRONPATH_DEV_API_BASE_URL: 'https://example.com',
    })).toMatchObject({
      enabled: false,
      status: 'invalid',
      error: { code: 'api_storage_non_localhost_base_url' },
    });
  });

  it('locks the accepted write-route allowlist to seven routes', () => {
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

  it('reads AppData summary with GET and does not require snapshot metadata for read diagnostics', async () => {
    const calls: Array<{ url: string; method?: string; body?: string }> = [];
    const adapter = createApiStorageAdapter(enabledConfig, async (input, init) => {
      calls.push({ url: String(input), method: init?.method, body: init?.body ? String(init.body) : undefined });
      return new Response(JSON.stringify({
        result: {
          schemaVersion: 1,
          historyCount: 2,
          templateCount: 3,
        },
      }), { status: 200 });
    });

    await expect(adapter.readAppDataSummary()).resolves.toMatchObject({
      ok: true,
      status: 200,
      snapshotMetadataPresent: false,
      result: { historyCount: 2 },
    });
    expect(calls).toEqual([{
      url: 'http://127.0.0.1:8787/app-data/summary',
      method: 'GET',
      body: undefined,
    }]);
  });

  it('writes only route-specific accepted mutations and requires snapshot metadata for success', async () => {
    const calls: Array<{ url: string; method?: string; body?: string }> = [];
    const adapter = createApiStorageAdapter(enabledConfig, async (input, init) => {
      calls.push({ url: String(input), method: init?.method, body: String(init?.body) });
      return new Response(JSON.stringify(successBody), { status: 200 });
    });

    await expect(adapter.writeSessionDiscard(discardBody)).resolves.toMatchObject({
      ok: true,
      route: '/sessions/active/discard',
      snapshot: { snapshotId: 'snapshot-api-storage-1' },
    });

    expect(calls).toEqual([{
      url: 'http://127.0.0.1:8787/sessions/active/discard',
      method: 'POST',
      body: JSON.stringify(discardBody),
    }]);
  });

  it('does not touch localStorage during read or write calls', async () => {
    const adapter = createApiStorageAdapter(enabledConfig, async (input) => {
      if (String(input).endsWith('/app-data/summary')) {
        return new Response(JSON.stringify({ result: { schemaVersion: 1 } }), { status: 200 });
      }
      return new Response(JSON.stringify(successBody), { status: 200 });
    });
    const before = 'localStorage' in globalThis ? JSON.stringify(globalThis.localStorage) : 'unavailable';

    await adapter.readAppDataSummary();
    await adapter.writeSessionDiscard(discardBody);

    expect('localStorage' in globalThis ? JSON.stringify(globalThis.localStorage) : 'unavailable').toBe(before);
  });
});
