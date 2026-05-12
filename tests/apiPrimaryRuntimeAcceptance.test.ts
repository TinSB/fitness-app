import { describe, expect, it } from 'vitest';
import { bootFromApiSnapshot } from '../src/storage/bootFromApiSnapshot';
import {
  API_STORAGE_ADAPTER_RUNTIME_SOURCE,
  createApiStorageAdapter,
  type ApiStorageAdapterEnabledConfig,
} from '../src/storage/apiStorageAdapter';
import { createApiWriteThroughRuntime } from '../src/storage/apiWriteThroughRuntime';
import { sanitizeData } from '../src/storage/persistence';
import { makeAppData, makeSession } from './fixtures';

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
  sourceSnapshotVersion: 'phase5-api-primary-acceptance-v1',
  mutationId: 'mutation-1',
  idempotencyKey: 'idempotency-1',
  requestFingerprint: 'fingerprint-1',
  confirmed: true as const,
};

const snapshot = {
  snapshotId: 'snapshot-api-primary-acceptance',
  createdAt: '2026-05-12T00:00:00.000Z',
  schemaVersion: 1,
};

const mutationSuccess = {
  result: {
    ok: true,
    changed: true,
    status: 'success',
    reasonCode: 'accepted',
    message: 'accepted',
  },
  snapshot,
};

describe('API primary runtime acceptance', () => {
  it('accepts boot from a validated API snapshot without writing localStorage', async () => {
    const appData = sanitizeData(makeAppData({
      history: [
        makeSession({
          id: 'api-primary-boot-session',
          date: '2026-05-12',
          templateId: 'push-a',
          exerciseId: 'bench-press',
          setSpecs: [{ weight: 80, reps: 5, rir: 2 }],
        }),
      ],
      selectedTemplateId: 'push-a',
    }));

    await expect(bootFromApiSnapshot(env, {
      readSnapshot: async () => ({ result: { appData }, snapshot }),
    })).resolves.toMatchObject({
      ok: true,
      source: 'api-primary-dev',
      snapshot,
      shouldWriteLocalStorage: false,
      localStorageFallbackAvailable: true,
      productionReady: false,
    });
  });

  it('accepts API primary reads as route-specific diagnostics', async () => {
    const adapter = createApiStorageAdapter(config, async (input, init) => {
      expect(String(input)).toBe('http://127.0.0.1:8787/app-data/summary');
      expect(init?.method).toBe('GET');
      return new Response(JSON.stringify({
        result: { schemaVersion: 1, historyCount: 2, templateCount: 1 },
        snapshot,
      }), { status: 200 });
    });

    await expect(adapter.readAppDataSummary()).resolves.toMatchObject({
      ok: true,
      status: 200,
      snapshotMetadataPresent: true,
      result: { historyCount: 2 },
    });
  });

  it('accepts all seven route-specific write-through operations with strict snapshot success', async () => {
    const calls: Array<{ url: string; method?: string }> = [];
    const runtime = createApiWriteThroughRuntime(env, async (input, init) => {
      calls.push({ url: String(input), method: init?.method });
      return new Response(JSON.stringify(mutationSuccess), { status: 200 });
    });

    await expect(runtime.writeDataHealthDismiss({ ...metadata, issueId: 'issue-1' })).resolves.toMatchObject({ ok: true, route: '/data-health/issues/:issueId/dismiss' });
    await expect(runtime.writeHistoryDataFlag({ ...metadata, historyId: 'history-1', dataFlag: 'test' })).resolves.toMatchObject({ ok: true, route: '/history/:id/data-flag' });
    await expect(runtime.writeHistorySetEdit({ ...metadata, historyId: 'history-1', exerciseId: 'exercise-1', setId: 'set-1', actualWeightKg: 100, actualReps: 5 })).resolves.toMatchObject({ ok: true, route: '/history/:id/edit' });
    await expect(runtime.writeSessionStart({ ...metadata, templateId: 'template-1' })).resolves.toMatchObject({ ok: true, route: '/sessions/start' });
    await expect(runtime.writeSessionPatch({ ...metadata, activeSessionId: 'active-1', pendingPatchId: 'patch-1', patches: [{ op: 'replace' }] })).resolves.toMatchObject({ ok: true, route: '/sessions/active/patches' });
    await expect(runtime.writeSessionComplete({ ...metadata, activeSessionId: 'active-1' })).resolves.toMatchObject({ ok: true, route: '/sessions/active/complete' });
    await expect(runtime.writeSessionDiscard({ ...metadata, activeSessionId: 'active-1', confirmDiscard: true })).resolves.toMatchObject({ ok: true, route: '/sessions/active/discard' });

    expect(calls).toEqual([
      { url: 'http://127.0.0.1:8787/data-health/issues/issue-1/dismiss', method: 'POST' },
      { url: 'http://127.0.0.1:8787/history/history-1/data-flag', method: 'POST' },
      { url: 'http://127.0.0.1:8787/history/history-1/edit', method: 'POST' },
      { url: 'http://127.0.0.1:8787/sessions/start', method: 'POST' },
      { url: 'http://127.0.0.1:8787/sessions/active/patches', method: 'POST' },
      { url: 'http://127.0.0.1:8787/sessions/active/complete', method: 'POST' },
      { url: 'http://127.0.0.1:8787/sessions/active/discard', method: 'POST' },
    ]);
  });

  it('keeps API unavailable and no-fake-success failures visible with localStorage fallback', async () => {
    await expect(bootFromApiSnapshot(env, {
      readSnapshot: async () => {
        throw new Error('offline');
      },
    })).resolves.toMatchObject({
      ok: false,
      source: 'localStorage',
      error: { code: 'boot_api_snapshot_unavailable' },
      shouldWriteLocalStorage: false,
      localStorageFallbackAvailable: true,
    });

    const readAdapter = createApiStorageAdapter(config, async () => {
      throw new Error('offline');
    });
    await expect(readAdapter.readAppDataSummary()).resolves.toMatchObject({
      ok: false,
      error: { code: 'api_storage_unavailable' },
    });

    const writeRuntime = createApiWriteThroughRuntime(env, async () =>
      new Response(JSON.stringify({
        result: { ok: true, changed: false, status: 'no_change', reasonCode: 'no_change', message: 'no change' },
        snapshot,
      }), { status: 200 }),
    );
    await expect(writeRuntime.writeSessionComplete({ ...metadata, activeSessionId: 'active-1' })).resolves.toMatchObject({
      ok: false,
      source: 'localStorage',
      error: {
        code: 'api_write_through_failed',
        adapterError: { code: 'api_storage_write_not_successful' },
      },
      shouldWriteLocalStorage: false,
      localStorageFallbackAvailable: true,
    });
  });
});
