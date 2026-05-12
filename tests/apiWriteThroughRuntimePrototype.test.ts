import { describe, expect, it } from 'vitest';
import { createApiWriteThroughRuntime } from '../src/storage/apiWriteThroughRuntime';
import type { ApiStorageSessionDiscardBody } from '../src/storage/apiStorageAdapter';

const metadata = {
  sourceSnapshotHash: 'source-hash',
  sourceSnapshotVersion: 'phase5-write-through-v1',
  mutationId: 'mutation-1',
  idempotencyKey: 'idempotency-1',
  requestFingerprint: 'fingerprint-1',
  confirmed: true as const,
};

const discardBody: ApiStorageSessionDiscardBody = {
  ...metadata,
  activeSessionId: 'active-1',
  confirmDiscard: true,
};

const successResponse = {
  result: {
    ok: true,
    changed: true,
    status: 'success',
    reasonCode: 'session_discarded',
    message: 'discarded',
  },
  snapshot: {
    snapshotId: 'snapshot-write-through-1',
    createdAt: '2026-05-12T00:00:00.000Z',
    schemaVersion: 1,
  },
};

describe('API write-through runtime prototype', () => {
  it('is default-off unless api-primary-dev is explicitly selected', () => {
    expect(createApiWriteThroughRuntime({ DEV: true }).enabled).toBe(false);
    expect(createApiWriteThroughRuntime({
      DEV: true,
      VITE_IRONPATH_RUNTIME_SOURCE: 'api-readonly',
    }).enabled).toBe(false);
    expect(createApiWriteThroughRuntime({
      DEV: true,
      VITE_IRONPATH_RUNTIME_SOURCE: 'api-primary-dev',
    }).enabled).toBe(true);
  });

  it('routes accepted writes through the API storage adapter with strict snapshot success', async () => {
    const calls: Array<{ url: string; method?: string; body?: string }> = [];
    const runtime = createApiWriteThroughRuntime(
      {
        DEV: true,
        VITE_IRONPATH_RUNTIME_SOURCE: 'api-primary-dev',
        VITE_IRONPATH_DEV_API_BASE_URL: 'http://127.0.0.1:8787',
      },
      async (input, init) => {
        calls.push({ url: String(input), method: init?.method, body: String(init?.body) });
        return new Response(JSON.stringify(successResponse), { status: 200 });
      },
    );

    await expect(runtime.writeSessionDiscard(discardBody)).resolves.toMatchObject({
      ok: true,
      route: '/sessions/active/discard',
      status: 200,
      source: 'api-primary-dev',
      snapshot: { snapshotId: 'snapshot-write-through-1' },
      shouldWriteLocalStorage: false,
      localStorageFallbackAvailable: true,
      productionReady: false,
    });
    expect(calls).toEqual([{
      url: 'http://127.0.0.1:8787/sessions/active/discard',
      method: 'POST',
      body: JSON.stringify(discardBody),
    }]);
  });
});
