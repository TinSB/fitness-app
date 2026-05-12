import { describe, expect, it, vi } from 'vitest';
import { bootFromApiSnapshot } from '../src/storage/bootFromApiSnapshot';
import { createApiWriteThroughRuntime } from '../src/storage/apiWriteThroughRuntime';
import { createRuntimeSourceSelector } from '../src/storage/runtimeSourceSelector';
import { sanitizeData } from '../src/storage/persistence';
import { makeAppData } from './fixtures';

const env = {
  DEV: true,
  VITE_IRONPATH_RUNTIME_SOURCE: 'api-primary-dev',
  VITE_IRONPATH_DEV_API_BASE_URL: 'http://127.0.0.1:8787',
};

const metadata = {
  sourceSnapshotHash: 'source-hash',
  sourceSnapshotVersion: 'phase5-api-primary-regression-lock-v1',
  mutationId: 'mutation-1',
  idempotencyKey: 'idempotency-1',
  requestFingerprint: 'fingerprint-1',
  confirmed: true as const,
};

describe('API primary runtime regression lock', () => {
  it('locks runtime source selector modes and fallback behavior', () => {
    expect(createRuntimeSourceSelector({ DEV: true })).toMatchObject({
      mode: 'localStorage',
      sourceOfTruth: 'localStorage',
      appWriteTarget: 'localStorage',
      apiWriteEnabled: false,
    });
    expect(createRuntimeSourceSelector({
      DEV: true,
      VITE_IRONPATH_RUNTIME_SOURCE: 'api-readonly',
    })).toMatchObject({
      mode: 'api-readonly',
      sourceOfTruth: 'localStorage',
      appWriteTarget: 'localStorage',
      apiReadEnabled: true,
      apiWriteEnabled: false,
    });
    expect(createRuntimeSourceSelector(env)).toMatchObject({
      mode: 'api-primary-dev',
      sourceOfTruth: 'api-primary-dev',
      appBootSource: 'api-primary-dev',
      appWriteTarget: 'api-primary-dev',
      apiReadEnabled: true,
      apiWriteEnabled: true,
      productionReady: false,
    });
    expect(createRuntimeSourceSelector({
      DEV: false,
      VITE_IRONPATH_RUNTIME_SOURCE: 'api-primary-dev',
    })).toMatchObject({ mode: 'localStorage' });
  });

  it('locks boot success and fallback without localStorage pollution', async () => {
    const setItem = vi.fn();
    const removeItem = vi.fn();
    vi.stubGlobal('localStorage', { setItem, removeItem });

    const appData = sanitizeData(makeAppData());
    await expect(bootFromApiSnapshot(env, {
      readSnapshot: async () => ({
        result: { appData },
        snapshot: {
          snapshotId: 'snapshot-regression-lock',
          createdAt: '2026-05-12T00:00:00.000Z',
        },
      }),
    })).resolves.toMatchObject({
      ok: true,
      source: 'api-primary-dev',
      shouldWriteLocalStorage: false,
      productionReady: false,
    });

    await expect(bootFromApiSnapshot(env, {
      readSnapshot: async () => {
        throw new Error('offline');
      },
    })).resolves.toMatchObject({
      ok: false,
      source: 'localStorage',
      shouldWriteLocalStorage: false,
      localStorageFallbackAvailable: true,
    });

    expect(setItem).not.toHaveBeenCalled();
    expect(removeItem).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('locks write-through no-fake-success and localStorage fallback', async () => {
    const runtime = createApiWriteThroughRuntime(env, async () =>
      new Response(JSON.stringify({
        result: { ok: true, changed: false, status: 'no_change', reasonCode: 'no_change', message: 'no change' },
        snapshot: {
          snapshotId: 'snapshot-write-lock',
          createdAt: '2026-05-12T00:00:00.000Z',
        },
      }), { status: 200 }),
    );

    await expect(runtime.writeHistoryDataFlag({
      ...metadata,
      historyId: 'history-1',
      dataFlag: 'excluded',
    })).resolves.toMatchObject({
      ok: false,
      source: 'localStorage',
      error: {
        code: 'api_write_through_failed',
        adapterError: { code: 'api_storage_write_not_successful' },
      },
      shouldWriteLocalStorage: false,
      localStorageFallbackAvailable: true,
      productionReady: false,
    });
  });
});
