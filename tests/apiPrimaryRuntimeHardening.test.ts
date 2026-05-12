import { describe, expect, it, vi } from 'vitest';
import { bootFromApiSnapshot } from '../src/storage/bootFromApiSnapshot';
import {
  API_STORAGE_ADAPTER_RUNTIME_SOURCE,
  createApiStorageAdapter,
  type ApiStorageAdapterEnabledConfig,
} from '../src/storage/apiStorageAdapter';
import { createApiWriteThroughRuntime } from '../src/storage/apiWriteThroughRuntime';
import { sanitizeData } from '../src/storage/persistence';
import { makeAppData } from './fixtures';

const env = {
  DEV: true,
  VITE_IRONPATH_RUNTIME_SOURCE: 'api-primary-dev',
  VITE_IRONPATH_DEV_API_BASE_URL: 'http://127.0.0.1:8787',
};

const config: ApiStorageAdapterEnabledConfig = {
  enabled: true,
  status: 'enabled',
  runtimeSource: API_STORAGE_ADAPTER_RUNTIME_SOURCE,
  baseUrl: 'http://127.0.0.1:8787',
  timeoutMs: 25,
};

const metadata = {
  sourceSnapshotHash: 'source-hash',
  sourceSnapshotVersion: 'phase5-api-primary-hardening-v1',
  mutationId: 'mutation-1',
  idempotencyKey: 'idempotency-1',
  requestFingerprint: 'fingerprint-1',
  confirmed: true as const,
};

const snapshot = {
  snapshotId: 'snapshot-api-primary-hardening',
  createdAt: '2026-05-12T00:00:00.000Z',
  schemaVersion: 1,
};

describe('API primary runtime hardening', () => {
  it('keeps startup race and unavailable boot failures on localStorage fallback', async () => {
    await expect(bootFromApiSnapshot({ DEV: true })).resolves.toMatchObject({
      ok: false,
      source: 'localStorage',
      error: { code: 'boot_api_snapshot_disabled' },
      shouldWriteLocalStorage: false,
      localStorageFallbackAvailable: true,
    });

    await expect(bootFromApiSnapshot(env)).resolves.toMatchObject({
      ok: false,
      source: 'localStorage',
      error: { code: 'boot_api_snapshot_reader_missing' },
      shouldWriteLocalStorage: false,
    });

    await expect(bootFromApiSnapshot(env, {
      readSnapshot: async () => {
        throw new Error('offline');
      },
    })).resolves.toMatchObject({
      ok: false,
      source: 'localStorage',
      error: { code: 'boot_api_snapshot_unavailable' },
    });
  });

  it('rejects snapshot mismatch and stale write success shapes without fake success', async () => {
    const appData = sanitizeData(makeAppData());

    await expect(bootFromApiSnapshot(env, {
      readSnapshot: async () => ({ result: { appData } }),
    })).resolves.toMatchObject({
      ok: false,
      source: 'localStorage',
      error: { code: 'boot_api_snapshot_missing_metadata' },
    });

    const runtime = createApiWriteThroughRuntime(env, async () =>
      new Response(JSON.stringify({
        result: { ok: true, changed: true, status: 'success', reasonCode: 'missing_snapshot', message: 'missing snapshot' },
      }), { status: 200 }),
    );

    await expect(runtime.writeSessionPatch({
      ...metadata,
      activeSessionId: 'active-1',
      pendingPatchId: 'patch-1',
      patches: [{ op: 'replace' }],
    })).resolves.toMatchObject({
      ok: false,
      source: 'localStorage',
      error: {
        code: 'api_write_through_failed',
        adapterError: { code: 'api_storage_missing_snapshot' },
      },
      shouldWriteLocalStorage: false,
    });
  });

  it('keeps read unavailable and malformed response failures non-mutating', async () => {
    const unavailable = createApiStorageAdapter(config, async () => {
      throw new Error('offline');
    });
    await expect(unavailable.readAppDataSummary()).resolves.toMatchObject({
      ok: false,
      error: { code: 'api_storage_unavailable' },
    });

    const malformed = createApiStorageAdapter(config, async () =>
      new Response('not-json', { status: 200 }),
    );
    await expect(malformed.readAppDataSummary()).resolves.toMatchObject({
      ok: false,
      error: { code: 'api_storage_invalid_response' },
    });
  });

  it('does not silently read, write, or delete localStorage during failure rollback paths', async () => {
    const getItem = vi.fn();
    const setItem = vi.fn();
    const removeItem = vi.fn();
    const clear = vi.fn();
    vi.stubGlobal('localStorage', { getItem, setItem, removeItem, clear });

    await bootFromApiSnapshot(env, {
      readSnapshot: async () => {
        throw new Error('offline');
      },
    });

    await createApiWriteThroughRuntime(env, async () =>
      new Response(JSON.stringify({
        result: { ok: true, changed: false, status: 'no_change', reasonCode: 'no_change', message: 'no change' },
        snapshot,
      }), { status: 200 }),
    ).writeSessionDiscard({
      ...metadata,
      activeSessionId: 'active-1',
      confirmDiscard: true,
    });

    expect(getItem).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
    expect(removeItem).not.toHaveBeenCalled();
    expect(clear).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
