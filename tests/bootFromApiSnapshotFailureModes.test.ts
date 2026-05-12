import { describe, expect, it } from 'vitest';
import { bootFromApiSnapshot } from '../src/storage/bootFromApiSnapshot';
import { sanitizeData } from '../src/storage/persistence';
import { makeAppData } from './fixtures';

const validAppData = sanitizeData(makeAppData());
const snapshot = {
  snapshotId: 'snapshot-boot-failure',
  createdAt: '2026-05-12T00:00:00.000Z',
};

describe('boot from API snapshot failure modes', () => {
  it('falls back to localStorage unless api-primary-dev is explicitly selected', async () => {
    await expect(bootFromApiSnapshot({})).resolves.toMatchObject({
      ok: false,
      source: 'localStorage',
      error: { code: 'boot_api_snapshot_disabled' },
      shouldWriteLocalStorage: false,
    });

    await expect(bootFromApiSnapshot({
      DEV: true,
      VITE_IRONPATH_RUNTIME_SOURCE: 'api-readonly',
    })).resolves.toMatchObject({
      ok: false,
      source: 'localStorage',
      error: { code: 'boot_api_snapshot_disabled' },
    });
  });

  it('requires an explicit snapshot reader and visible API failure fallback', async () => {
    const env = { DEV: true, VITE_IRONPATH_RUNTIME_SOURCE: 'api-primary-dev' };

    await expect(bootFromApiSnapshot(env)).resolves.toMatchObject({
      ok: false,
      source: 'localStorage',
      error: { code: 'boot_api_snapshot_reader_missing' },
      localStorageFallbackAvailable: true,
    });

    await expect(bootFromApiSnapshot(env, {
      readSnapshot: async () => {
        throw new Error('network down');
      },
    })).resolves.toMatchObject({
      ok: false,
      source: 'localStorage',
      error: { code: 'boot_api_snapshot_unavailable' },
    });
  });

  it('rejects malformed response shapes and missing snapshot metadata', async () => {
    const env = { DEV: true, VITE_IRONPATH_RUNTIME_SOURCE: 'api-primary-dev' };

    await expect(bootFromApiSnapshot(env, {
      readSnapshot: async () => ({ result: { historyCount: 1 }, snapshot }),
    })).resolves.toMatchObject({
      ok: false,
      error: { code: 'boot_api_snapshot_invalid_response' },
    });

    await expect(bootFromApiSnapshot(env, {
      readSnapshot: async () => ({ result: { appData: validAppData } }),
    })).resolves.toMatchObject({
      ok: false,
      error: { code: 'boot_api_snapshot_missing_metadata' },
    });
  });

  it('rejects AppData-shaped payloads that fail schema validation', async () => {
    const env = { DEV: true, VITE_IRONPATH_RUNTIME_SOURCE: 'api-primary-dev' };

    await expect(bootFromApiSnapshot(env, {
      readSnapshot: async () => ({
        result: {
          appData: {
            ...validAppData,
            schemaVersion: 1,
            history: [{ id: 1 }],
            settings: {},
          },
        },
        snapshot,
      }),
    })).resolves.toMatchObject({
      ok: false,
      error: { code: 'boot_api_snapshot_schema_invalid' },
    });
  });
});
