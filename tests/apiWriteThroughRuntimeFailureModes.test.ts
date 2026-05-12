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

describe('API write-through runtime failure modes', () => {
  it('returns visible failure when runtime source is not api-primary-dev', async () => {
    const runtime = createApiWriteThroughRuntime({ DEV: true });

    await expect(runtime.writeSessionDiscard(discardBody)).resolves.toMatchObject({
      ok: false,
      route: '/sessions/active/discard',
      source: 'localStorage',
      error: { code: 'api_write_through_disabled' },
      shouldWriteLocalStorage: false,
      localStorageFallbackAvailable: true,
    });
  });

  it('returns visible failure when adapter config is invalid', async () => {
    const runtime = createApiWriteThroughRuntime({
      DEV: true,
      VITE_IRONPATH_RUNTIME_SOURCE: 'api-primary-dev',
      VITE_IRONPATH_DEV_API_TIMEOUT_MS: '0',
    });

    await expect(runtime.writeSessionDiscard(discardBody)).resolves.toMatchObject({
      ok: false,
      route: '/sessions/active/discard',
      error: { code: 'api_write_through_adapter_disabled' },
    });
  });

  it('maps adapter failures without fake success', async () => {
    const runtime = createApiWriteThroughRuntime(
      {
        DEV: true,
        VITE_IRONPATH_RUNTIME_SOURCE: 'api-primary-dev',
      },
      async () => new Response(JSON.stringify({
        result: {
          ok: true,
          changed: true,
          status: 'success',
          reasonCode: 'missing_snapshot',
          message: 'missing snapshot',
        },
      }), { status: 200 }),
    );

    await expect(runtime.writeSessionDiscard(discardBody)).resolves.toMatchObject({
      ok: false,
      route: '/sessions/active/discard',
      error: {
        code: 'api_write_through_failed',
        adapterError: { code: 'api_storage_missing_snapshot' },
      },
      source: 'localStorage',
      shouldWriteLocalStorage: false,
    });
  });
});
