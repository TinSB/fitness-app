import { describe, expect, it } from 'vitest';
import {
  API_STORAGE_ADAPTER_RUNTIME_SOURCE,
  createApiStorageAdapter,
  type ApiStorageAdapterEnabledConfig,
  type ApiStorageSessionDiscardBody,
} from '../src/storage/apiStorageAdapter';
import { expectNoRawStack } from './runtimeBoundaryTestHelpers';

const enabledConfig: ApiStorageAdapterEnabledConfig = {
  enabled: true,
  status: 'enabled',
  runtimeSource: API_STORAGE_ADAPTER_RUNTIME_SOURCE,
  baseUrl: 'http://127.0.0.1:8787',
  timeoutMs: 20,
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

const successResult = {
  ok: true,
  changed: true,
  status: 'success',
  reasonCode: 'session_discarded',
  message: 'discarded',
};

const snapshot = {
  snapshotId: 'snapshot-api-storage-1',
  schemaVersion: 1,
  createdAt: '2026-05-12T00:00:00.000Z',
};

describe('API storage adapter error handling', () => {
  it('stays disabled without the feature flag and does not fetch', async () => {
    let calls = 0;
    const adapter = createApiStorageAdapter({ enabled: false, status: 'disabled', reason: 'runtime_source_off' }, async () => {
      calls += 1;
      return new Response('{}');
    });

    await expect(adapter.readAppDataSummary()).resolves.toMatchObject({
      ok: false,
      error: { code: 'api_storage_disabled' },
    });
    await expect(adapter.writeSessionDiscard(discardBody)).resolves.toMatchObject({
      ok: false,
      error: { code: 'api_storage_disabled' },
    });
    expect(calls).toBe(0);
  });

  it('blocks invalid route targets before fetch', async () => {
    let calls = 0;
    const adapter = createApiStorageAdapter(enabledConfig, async () => {
      calls += 1;
      return new Response(JSON.stringify({ result: successResult, snapshot }), { status: 200 });
    });

    await expect(adapter.writeHistoryDataFlag({
      ...sourceMetadata,
      historyId: '',
      dataFlag: 'test',
    })).resolves.toMatchObject({
      ok: false,
      error: { code: 'api_storage_invalid_target' },
    });
    expect(calls).toBe(0);
  });

  it('requires snapshot metadata and strict mutation success shape', async () => {
    await expect(createApiStorageAdapter(enabledConfig, async () =>
      new Response(JSON.stringify({ result: successResult }), { status: 200 }),
    ).writeSessionDiscard(discardBody)).resolves.toMatchObject({
      ok: false,
      error: { code: 'api_storage_missing_snapshot' },
    });

    await expect(createApiStorageAdapter(enabledConfig, async () =>
      new Response(JSON.stringify({
        result: { ok: true, changed: false, status: 'no_change', reasonCode: 'no_change', message: 'no change' },
        snapshot,
      }), { status: 200 }),
    ).writeSessionDiscard(discardBody)).resolves.toMatchObject({
      ok: false,
      error: { code: 'api_storage_write_not_successful', serverCode: 'no_change' },
    });
  });

  it('normalizes timeout, unavailable, malformed, abort, and server error responses', async () => {
    await expect(createApiStorageAdapter({ ...enabledConfig, timeoutMs: 1 }, (_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
      }),
    ).readAppDataSummary()).resolves.toMatchObject({
      ok: false,
      error: { code: 'api_storage_timeout' },
    });

    await expect(createApiStorageAdapter(enabledConfig, async () => {
      throw new Error('offline');
    }).readAppDataSummary()).resolves.toMatchObject({
      ok: false,
      error: { code: 'api_storage_unavailable' },
    });

    await expect(createApiStorageAdapter(enabledConfig, async () =>
      new Response('not json', { status: 200 }),
    ).readAppDataSummary()).resolves.toMatchObject({
      ok: false,
      error: { code: 'api_storage_invalid_response' },
    });

    const abort = new AbortController();
    abort.abort();
    await expect(createApiStorageAdapter(enabledConfig, async (_input, init) => {
      if (init?.signal?.aborted) throw new Error('aborted');
      return new Response(JSON.stringify({ result: { schemaVersion: 1 } }), { status: 200 });
    }).readAppDataSummary(abort.signal)).resolves.toMatchObject({
      ok: false,
      error: { code: 'api_storage_aborted' },
    });

    const raw = await createApiStorageAdapter(enabledConfig, async () =>
      new Response(JSON.stringify({
        error: {
          code: 'write_failed',
          message: 'RepositoryError: stack at /tmp/file with AppData localStorage SQLite',
        },
      }), { status: 500 }),
    ).writeSessionDiscard(discardBody);
    expect(raw.ok).toBe(false);
    if (!raw.ok) {
      expect(raw.error).toMatchObject({ code: 'api_storage_error_response', serverCode: 'write_failed' });
      expectNoRawStack(raw.error.message);
    }
  });
});
