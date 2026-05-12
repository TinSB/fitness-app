import { describe, expect, it } from 'vitest';
import {
  discardSessionViaDevApi,
  DEV_API_SESSION_DISCARD_METHOD,
  DEV_API_SESSION_DISCARD_ROUTE,
  DEV_API_SESSION_DISCARD_SOURCE_SNAPSHOT_VERSION,
  validateSessionDiscardMetadata,
  type DevApiSessionDiscardFetch,
  type DevApiSessionDiscardMetadata,
} from '../src/devApi/devApiSessionDiscardClient';
import type { DevApiSessionDiscardEnabledConfig } from '../src/devApi/devApiSessionDiscardConfig';
import { expectNoRawStack, readSource } from './runtimeBoundaryTestHelpers';

const config: DevApiSessionDiscardEnabledConfig = {
  enabled: true,
  status: 'enabled',
  experiment: 'session-discard',
  baseUrl: 'http://127.0.0.1:8787',
  timeoutMs: 20,
};

const metadata: DevApiSessionDiscardMetadata = {
  activeSessionId: 'active-1',
  sourceSnapshotHash: 'session-discard-source',
  sourceSnapshotVersion: DEV_API_SESSION_DISCARD_SOURCE_SNAPSHOT_VERSION,
  mutationId: 'mutation-1',
  idempotencyKey: 'key-1',
  requestFingerprint: 'request-1',
  confirmed: true,
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
    snapshotId: 'snapshot-1',
    schemaVersion: 1,
    createdAt: '2026-05-12T00:00:00.000Z',
  },
};

describe('Dev API session discard client', () => {
  it('exposes only the session discard mutation route and method', () => {
    expect(DEV_API_SESSION_DISCARD_METHOD).toBe('POST');
    expect(DEV_API_SESSION_DISCARD_ROUTE).toBe('/sessions/active/discard');
    expect(DEV_API_SESSION_DISCARD_SOURCE_SNAPSHOT_VERSION).toBe('phase5-session-discard-v1');

    const source = readSource('src/devApi/devApiSessionDiscardClient.ts');
    expect(source).not.toMatch(/\/data-health\/repair\/apply|\/backup|\/reset|\/recovery/i);
    expect(source).not.toMatch(/\bPUT\b|\bPATCH\b|\bDELETE\b/);
    expect(source).not.toMatch(/method\s*:\s*['"`](POST|PUT|PATCH|DELETE)['"`]/);
    expect(source).not.toMatch(/saveData|loadData|localStorageAdapter|node:http|node:sqlite|serverAdapter|sqliteRepository/);
  });

  it('requires source snapshot, idempotency metadata, and strong confirmation before request', async () => {
    expect(validateSessionDiscardMetadata(metadata)).toMatchObject({ ok: true, metadata });

    for (const badMetadata of [
      undefined,
      { ...metadata, confirmed: false },
      { ...metadata, confirmDiscard: false },
      { ...metadata, activeSessionId: '' },
      { ...metadata, sourceSnapshotHash: '' },
      { ...metadata, sourceSnapshotVersion: '' },
      { ...metadata, mutationId: '' },
      { ...metadata, idempotencyKey: '' },
      { ...metadata, requestFingerprint: '' },
    ]) {
      expect(validateSessionDiscardMetadata(badMetadata)).toMatchObject({ ok: false });
    }

    let calls = 0;
    const result = await discardSessionViaDevApi({
      activeSessionId: 'active-1',
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

  it('uses only POST session discard with constrained body', async () => {
    const calls: Array<{ url: string; method?: string; body?: string }> = [];
    const fetchImpl: DevApiSessionDiscardFetch = async (input, init) => {
      calls.push({ url: String(input), method: init?.method, body: String(init?.body) });
      return new Response(JSON.stringify(successBody), { status: 200 });
    };

    const result = await discardSessionViaDevApi({
      activeSessionId: 'active-1',
      config,
      metadata,
      fetchImpl,
    });

    expect(result.ok).toBe(true);
    expect(calls).toEqual([{
      url: 'http://127.0.0.1:8787/sessions/active/discard',
      method: 'POST',
      body: JSON.stringify({
        activeSessionId: 'active-1',
        sourceSnapshotHash: metadata.sourceSnapshotHash,
        sourceSnapshotVersion: metadata.sourceSnapshotVersion,
        mutationId: metadata.mutationId,
        idempotencyKey: metadata.idempotencyKey,
        requestFingerprint: metadata.requestFingerprint,
        confirmed: true,
        confirmDiscard: true,
      }),
    }]);
  });

  it('requires strict success shape and snapshot metadata', async () => {
    await expect(discardSessionViaDevApi({
      activeSessionId: 'active-1',
      config,
      metadata,
      fetchImpl: async () => new Response(JSON.stringify({ result: successBody.result }), { status: 200 }),
    })).resolves.toMatchObject({
      ok: false,
      error: { code: 'dev_mutation_missing_snapshot' },
    });

    for (const testCase of [
      { status: 409, result: { ok: false, changed: false, status: 'conflict', reasonCode: 'no_active_session', message: 'missing' }, serverCode: 'no_active_session' },
      { status: 409, result: { ok: false, changed: false, status: 'requires_confirmation', reasonCode: 'discard_requires_confirmation', message: 'confirm', requiresConfirmation: true }, serverCode: 'discard_requires_confirmation' },
      { status: 200, result: { ok: true, changed: false, status: 'no_change', reasonCode: 'no_change', message: 'same' }, serverCode: 'no_change' },
      { status: 500, result: { ok: false, changed: false, status: 'failed', reasonCode: 'write_failed', message: 'write failed' }, serverCode: 'write_failed' },
      { status: 500, result: { ok: false, changed: false, status: 'failed', reasonCode: 'transaction_failed', message: 'transaction failed' }, serverCode: 'transaction_failed' },
      { status: 500, result: { ok: false, changed: false, status: 'failed', reasonCode: 'database_closed', message: 'closed' }, serverCode: 'database_closed' },
      { status: 404, result: { ok: false, changed: false, status: 'unsupported', reasonCode: 'unsupported_route', message: 'unsupported' }, serverCode: 'unsupported_route' },
    ]) {
      await expect(discardSessionViaDevApi({
        activeSessionId: 'active-1',
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
    await expect(discardSessionViaDevApi({
      activeSessionId: 'active-1',
      config,
      metadata,
      fetchImpl: async () => {
        throw new Error('offline');
      },
    })).resolves.toMatchObject({ ok: false, error: { code: 'dev_mutation_unavailable' } });

    await expect(discardSessionViaDevApi({
      activeSessionId: 'active-1',
      config: { ...config, timeoutMs: 1 },
      metadata,
      fetchImpl: (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
        }),
    })).resolves.toMatchObject({ ok: false, error: { code: 'dev_mutation_timeout' } });

    await expect(discardSessionViaDevApi({
      activeSessionId: 'active-1',
      config,
      metadata,
      fetchImpl: async () => new Response('not json', { status: 200 }),
    })).resolves.toMatchObject({ ok: false, error: { code: 'dev_mutation_invalid_response' } });

    await expect(discardSessionViaDevApi({
      activeSessionId: 'active-1',
      config,
      metadata,
      fetchImpl: async () => new Response(JSON.stringify({ error: { code: 'write_failed', message: 'Error: stack at file' } }), { status: 500 }),
    })).resolves.toMatchObject({ ok: false, error: { code: 'dev_mutation_error_response', serverCode: 'write_failed' } });

    const abort = new AbortController();
    abort.abort();
    await expect(discardSessionViaDevApi({
      activeSessionId: 'active-1',
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
    const result = await discardSessionViaDevApi({
      activeSessionId: 'active-1',
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
