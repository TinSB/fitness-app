import { describe, expect, it } from 'vitest';
import {
  DEV_API_SESSION_START_METHOD,
  DEV_API_SESSION_START_ROUTE,
  DEV_API_SESSION_START_SOURCE_SNAPSHOT_VERSION,
  startSessionViaDevApi,
  validateSessionStartMetadata,
  type DevApiSessionStartFetch,
  type DevApiSessionStartMetadata,
} from '../src/devApi/devApiSessionStartClient';
import type { DevApiSessionStartEnabledConfig } from '../src/devApi/devApiSessionStartConfig';
import { expectNoRawStack, readSource } from './runtimeBoundaryTestHelpers';

const config: DevApiSessionStartEnabledConfig = {
  enabled: true,
  status: 'enabled',
  experiment: 'session-start',
  baseUrl: 'http://127.0.0.1:8787',
  timeoutMs: 20,
};

const metadata: DevApiSessionStartMetadata = {
  templateId: 'push-a',
  sourceSnapshotHash: 'session-start-source',
  sourceSnapshotVersion: DEV_API_SESSION_START_SOURCE_SNAPSHOT_VERSION,
  mutationId: 'mutation-1',
  idempotencyKey: 'key-1',
  requestFingerprint: 'request-1',
  confirmed: true,
};

const successBody = {
  result: {
    ok: true,
    changed: true,
    status: 'success',
    reasonCode: 'session_started',
    message: 'started',
  },
  snapshot: {
    snapshotId: 'snapshot-1',
    schemaVersion: 1,
    createdAt: '2026-05-11T00:00:00.000Z',
  },
};

describe('Dev API session start client', () => {
  it('exposes only the session-start mutation route and method', () => {
    expect(DEV_API_SESSION_START_METHOD).toBe('POST');
    expect(DEV_API_SESSION_START_ROUTE).toBe('/sessions/start');
    expect(DEV_API_SESSION_START_SOURCE_SNAPSHOT_VERSION).toBe('phase4-active-session-v1');

    const source = readSource('src/devApi/devApiSessionStartClient.ts');
    expect(source).not.toMatch(/\/sessions\/active\/patches|\/sessions\/active\/complete|\/sessions\/active\/discard/);
    expect(source).not.toMatch(/\/data-health\/repair\/apply|\/backup|\/reset|\/recovery/i);
    expect(source).not.toMatch(/\bPUT\b|\bPATCH\b|\bDELETE\b/);
    expect(source).not.toMatch(/method\s*:\s*['"`](POST|PUT|PATCH|DELETE)['"`]/);
    expect(source).not.toMatch(/saveData|loadData|localStorageAdapter|node:http|node:sqlite|serverAdapter|sqliteRepository/);
  });

  it('requires source snapshot and idempotency metadata before request', async () => {
    expect(validateSessionStartMetadata(metadata)).toMatchObject({ ok: true, metadata });

    for (const badMetadata of [
      undefined,
      { ...metadata, confirmed: false },
      { ...metadata, sourceSnapshotHash: '' },
      { ...metadata, sourceSnapshotVersion: '' },
      { ...metadata, mutationId: '' },
      { ...metadata, idempotencyKey: '' },
      { ...metadata, requestFingerprint: '' },
    ]) {
      expect(validateSessionStartMetadata(badMetadata)).toMatchObject({ ok: false });
    }

    let calls = 0;
    const result = await startSessionViaDevApi({
      templateId: 'push-a',
      config,
      metadata: undefined,
      fetchImpl: async () => {
        calls += 1;
        return new Response(JSON.stringify(successBody), { status: 200 });
      },
    });
    expect(result).toMatchObject({ ok: false, error: { code: 'dev_mutation_source_snapshot_missing' } });
    expect(calls).toBe(0);
  });

  it('uses only POST session start with constrained body', async () => {
    const calls: Array<{ url: string; method?: string; body?: string }> = [];
    const fetchImpl: DevApiSessionStartFetch = async (input, init) => {
      calls.push({ url: String(input), method: init?.method, body: String(init?.body) });
      return new Response(JSON.stringify(successBody), { status: 200 });
    };

    const result = await startSessionViaDevApi({
      templateId: 'push-a',
      config,
      metadata,
      fetchImpl,
    });

    expect(result.ok).toBe(true);
    expect(calls).toEqual([{
      url: 'http://127.0.0.1:8787/sessions/start',
      method: 'POST',
      body: JSON.stringify({
        templateId: 'push-a',
        sourceSnapshotHash: metadata.sourceSnapshotHash,
        sourceSnapshotVersion: metadata.sourceSnapshotVersion,
        mutationId: metadata.mutationId,
        idempotencyKey: metadata.idempotencyKey,
        requestFingerprint: metadata.requestFingerprint,
        confirmed: true,
      }),
    }]);
  });

  it('requires strict success shape and snapshot metadata', async () => {
    await expect(startSessionViaDevApi({
      templateId: 'push-a',
      config,
      metadata,
      fetchImpl: async () => new Response(JSON.stringify({ result: successBody.result }), { status: 200 }),
    })).resolves.toMatchObject({
      ok: false,
      error: { code: 'dev_mutation_missing_snapshot' },
    });

    const cases = [
      { status: 409, result: { ok: false, changed: false, status: 'conflict', reasonCode: 'active_session_exists', message: 'exists' }, serverCode: 'active_session_exists' },
      { status: 404, result: { ok: false, changed: false, status: 'not_found', reasonCode: 'template_not_found', message: 'missing' }, serverCode: 'template_not_found' },
      { status: 200, result: { ok: true, changed: false, status: 'no_change', reasonCode: 'no_change', message: 'same' }, serverCode: 'no_change' },
      { status: 409, result: { ok: false, changed: false, status: 'requires_confirmation', reasonCode: 'requiresConfirmation', message: 'confirm' }, serverCode: 'requiresConfirmation' },
      { status: 500, result: { ok: false, changed: false, status: 'failed', reasonCode: 'write_failed', message: 'write failed' }, serverCode: 'write_failed' },
      { status: 500, result: { ok: false, changed: false, status: 'failed', reasonCode: 'transaction_failed', message: 'transaction failed' }, serverCode: 'transaction_failed' },
      { status: 500, result: { ok: false, changed: false, status: 'failed', reasonCode: 'database_closed', message: 'closed' }, serverCode: 'database_closed' },
      { status: 404, result: { ok: false, changed: false, status: 'unsupported', reasonCode: 'unsupported_route', message: 'unsupported' }, serverCode: 'unsupported_route' },
    ];

    for (const testCase of cases) {
      await expect(startSessionViaDevApi({
        templateId: 'push-a',
        config,
        metadata,
        fetchImpl: async () => new Response(JSON.stringify({ result: testCase.result, snapshot: successBody.snapshot }), { status: testCase.status }),
      })).resolves.toMatchObject({
        ok: false,
        error: { code: 'dev_mutation_not_successful', serverCode: testCase.serverCode },
      });
    }
  });

  it('normalizes unavailable, timeout, malformed, abort, and error response failures', async () => {
    await expect(startSessionViaDevApi({
      templateId: 'push-a',
      config,
      metadata,
      fetchImpl: async () => {
        throw new Error('offline');
      },
    })).resolves.toMatchObject({ ok: false, error: { code: 'dev_mutation_unavailable' } });

    await expect(startSessionViaDevApi({
      templateId: 'push-a',
      config: { ...config, timeoutMs: 1 },
      metadata,
      fetchImpl: (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
        }),
    })).resolves.toMatchObject({ ok: false, error: { code: 'dev_mutation_timeout' } });

    await expect(startSessionViaDevApi({
      templateId: 'push-a',
      config,
      metadata,
      fetchImpl: async () => new Response('not json', { status: 200 }),
    })).resolves.toMatchObject({ ok: false, error: { code: 'dev_mutation_invalid_response' } });

    await expect(startSessionViaDevApi({
      templateId: 'push-a',
      config,
      metadata,
      fetchImpl: async () => new Response(JSON.stringify({ error: { code: 'write_failed', message: 'Error: stack at file' } }), { status: 500 }),
    })).resolves.toMatchObject({ ok: false, error: { code: 'dev_mutation_error_response', serverCode: 'write_failed' } });

    const abort = new AbortController();
    abort.abort();
    await expect(startSessionViaDevApi({
      templateId: 'push-a',
      config,
      metadata,
      signal: abort.signal,
      fetchImpl: async (_input, init) => {
        if (init?.signal?.aborted) throw new Error('aborted');
        return new Response(JSON.stringify(successBody), { status: 200 });
      },
    })).resolves.toMatchObject({ ok: false, error: { code: 'dev_mutation_aborted' } });
  });

  it('sanitizes unsafe error text', async () => {
    const result = await startSessionViaDevApi({
      templateId: 'push-a',
      config,
      metadata,
      fetchImpl: async () => new Response(JSON.stringify({
        error: {
          code: 'write_failed',
          message: 'RepositoryError: stack at /tmp/file with AppData localStorage SQLite',
        },
      }), { status: 500 }),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expectNoRawStack(result.error.message);
  });
});
