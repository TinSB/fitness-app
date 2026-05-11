import { describe, expect, it } from 'vitest';
import { startSessionViaDevApi, type DevApiSessionStartMetadata } from '../src/devApi/devApiSessionStartClient';
import type { DevApiSessionStartEnabledConfig } from '../src/devApi/devApiSessionStartConfig';
import { makeAppData } from './fixtures';

const config: DevApiSessionStartEnabledConfig = {
  enabled: true,
  status: 'enabled',
  experiment: 'session-start',
  baseUrl: 'http://127.0.0.1:8787',
  timeoutMs: 20,
};

const metadata: DevApiSessionStartMetadata = {
  templateId: 'push-a',
  sourceSnapshotHash: 'source',
  sourceSnapshotVersion: 'phase4-active-session-v1',
  mutationId: 'mutation',
  idempotencyKey: 'idempotency',
  requestFingerprint: 'fingerprint',
  confirmed: true,
};

const snapshot = { snapshotId: 'snapshot-1', schemaVersion: 1, createdAt: '2026-05-11T00:00:00.000Z' };
const result = { ok: true, changed: true, status: 'success', reasonCode: 'session_started', message: 'started' };

describe('Session Start hardening no-fake-success', () => {
  it('accepts only the full success shape', async () => {
    await expect(startSessionViaDevApi({
      templateId: 'push-a',
      config,
      metadata,
      fetchImpl: async () => new Response(JSON.stringify({ result, snapshot }), { status: 200 }),
    })).resolves.toMatchObject({ ok: true, snapshot });

    for (const body of [
      { result },
      { result: { ...result, ok: false }, snapshot },
      { result: { ...result, changed: false }, snapshot },
      { result: { ...result, status: 'success_pending' }, snapshot },
    ]) {
      await expect(startSessionViaDevApi({
        templateId: 'push-a',
        config,
        metadata,
        fetchImpl: async () => new Response(JSON.stringify(body), { status: 200 }),
      })).resolves.toMatchObject({ ok: false });
    }
  });

  it('keeps known server failure states non-success and local data unchanged', async () => {
    const data = makeAppData();
    const before = JSON.stringify(data);
    const cases = ['active_session_exists', 'template_not_found', 'write_failed', 'transaction_failed', 'database_closed', 'unsupported_route'];

    for (const reasonCode of cases) {
      await expect(startSessionViaDevApi({
        templateId: 'push-a',
        config,
        metadata,
        fetchImpl: async () => new Response(JSON.stringify({
          result: { ok: false, changed: false, status: 'failed', reasonCode, message: reasonCode },
          snapshot,
        }), { status: reasonCode === 'template_not_found' ? 404 : 409 }),
      })).resolves.toMatchObject({ ok: false, error: { serverCode: reasonCode } });
    }

    expect(JSON.stringify(data)).toBe(before);
  });

  it('rejects missing source fingerprint, idempotency, target mismatch, unavailable, timeout, abort, and malformed response', async () => {
    await expect(startSessionViaDevApi({ templateId: 'push-a', config, metadata: { ...metadata, sourceSnapshotHash: '' } }))
      .resolves.toMatchObject({ ok: false, error: { code: 'dev_mutation_source_snapshot_missing' } });
    await expect(startSessionViaDevApi({ templateId: 'push-a', config, metadata: { ...metadata, requestFingerprint: '' } }))
      .resolves.toMatchObject({ ok: false, error: { code: 'dev_mutation_idempotency_missing' } });
    await expect(startSessionViaDevApi({ templateId: 'pull-a', config, metadata }))
      .resolves.toMatchObject({ ok: false, error: { code: 'dev_mutation_invalid_target' } });
    await expect(startSessionViaDevApi({
      templateId: 'push-a',
      config,
      metadata,
      fetchImpl: async () => { throw new Error('offline'); },
    })).resolves.toMatchObject({ ok: false, error: { code: 'dev_mutation_unavailable' } });
    await expect(startSessionViaDevApi({
      templateId: 'push-a',
      config: { ...config, timeoutMs: 1 },
      metadata,
      fetchImpl: (_input, init) => new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
      }),
    })).resolves.toMatchObject({ ok: false, error: { code: 'dev_mutation_timeout' } });

    const abort = new AbortController();
    abort.abort();
    await expect(startSessionViaDevApi({
      templateId: 'push-a',
      config,
      metadata,
      signal: abort.signal,
      fetchImpl: async () => { throw new Error('aborted'); },
    })).resolves.toMatchObject({ ok: false, error: { code: 'dev_mutation_aborted' } });

    await expect(startSessionViaDevApi({
      templateId: 'push-a',
      config,
      metadata,
      fetchImpl: async () => new Response('not json', { status: 200 }),
    })).resolves.toMatchObject({ ok: false, error: { code: 'dev_mutation_invalid_response' } });
  });
});
