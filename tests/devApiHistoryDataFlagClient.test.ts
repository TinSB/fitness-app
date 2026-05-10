import { describe, expect, it } from 'vitest';
import {
  DEV_API_HISTORY_DATA_FLAG_ROUTE,
  isHistoryDataFlagValue,
  updateHistoryDataFlagViaDevApi,
  type DevApiHistoryDataFlagFetch,
  type DevApiHistoryDataFlagMetadata,
} from '../src/devApi/devApiHistoryDataFlagClient';
import type { DevApiHistoryDataFlagEnabledConfig } from '../src/devApi/devApiHistoryDataFlagConfig';
import { expectNoRawStack, readSource } from './runtimeBoundaryTestHelpers';

const config: DevApiHistoryDataFlagEnabledConfig = {
  enabled: true,
  status: 'enabled',
  experiment: 'history-data-flag',
  baseUrl: 'http://127.0.0.1:8787',
  timeoutMs: 20,
};

const metadata: DevApiHistoryDataFlagMetadata = {
  sessionId: 'session-1',
  targetDataFlag: 'excluded',
  mutationId: 'mutation-1',
  idempotencyKey: 'key-1',
  requestFingerprint: 'request-1',
  sourceFingerprint: 'source-1',
  confirmed: true,
};

const successBody = {
  result: {
    ok: true,
    changed: true,
    status: 'success',
    reasonCode: 'record_updated',
    message: 'updated',
  },
  snapshot: {
    snapshotId: 'snapshot-1',
    schemaVersion: 1,
    createdAt: '2026-05-10T00:00:00.000Z',
  },
};

describe('Dev API History data-flag client', () => {
  it('declares only the approved History data-flag route', () => {
    expect(DEV_API_HISTORY_DATA_FLAG_ROUTE).toBe('/history/:id/data-flag');
    expect(isHistoryDataFlagValue('normal')).toBe(true);
    expect(isHistoryDataFlagValue('test')).toBe(true);
    expect(isHistoryDataFlagValue('excluded')).toBe(true);
    expect(isHistoryDataFlagValue('archived')).toBe(false);

    const source = readSource('src/devApi/devApiHistoryDataFlagClient.ts');
    expect(source).toContain('/history/');
    expect(source).toContain('/data-flag');
    expect(source).not.toMatch(/\/sessions\/|\/history\/:id\/edit|\/data-health\/repair\/apply|\/backup|\/reset|\/recovery/i);
    expect(source).not.toMatch(/\bPUT\b|\bPATCH\b|\bDELETE\b/);
    expect(source.match(/\bPOST\b/g)?.length).toBe(1);
    expect(source).not.toMatch(/saveData|loadData|localStorageAdapter|node:http|node:sqlite|serverAdapter|sqliteRepository/);
  });

  it('uses POST only for the approved history data-flag path and accepted body shape', async () => {
    const calls: Array<{ url: string; method?: string; body?: string }> = [];
    const fetchImpl: DevApiHistoryDataFlagFetch = async (input, init) => {
      calls.push({ url: String(input), method: init?.method, body: String(init?.body) });
      return new Response(JSON.stringify(successBody), { status: 200 });
    };

    const result = await updateHistoryDataFlagViaDevApi({
      sessionId: 'session/one',
      targetDataFlag: 'excluded',
      config,
      metadata: { ...metadata, sessionId: 'session/one' },
      fetchImpl,
    });

    expect(result.ok).toBe(true);
    expect(calls).toEqual([{
      url: 'http://127.0.0.1:8787/history/session%2Fone/data-flag',
      method: 'POST',
      body: JSON.stringify({ dataFlag: 'excluded' }),
    }]);
  });

  it('rejects invalid dataFlag before request', async () => {
    let calls = 0;
    const result = await updateHistoryDataFlagViaDevApi({
      sessionId: 'session-1',
      targetDataFlag: 'archived',
      config,
      metadata,
      fetchImpl: async () => {
        calls += 1;
        return new Response(JSON.stringify(successBody), { status: 200 });
      },
    });

    expect(result).toMatchObject({
      ok: false,
      error: { code: 'dev_mutation_invalid_data_flag' },
    });
    expect(calls).toBe(0);
  });

  it('requires snapshot metadata for success', async () => {
    const fetchImpl: DevApiHistoryDataFlagFetch = async () =>
      new Response(JSON.stringify({ result: successBody.result }), { status: 200 });

    await expect(updateHistoryDataFlagViaDevApi({
      sessionId: 'session-1',
      targetDataFlag: 'excluded',
      config,
      metadata,
      fetchImpl,
    })).resolves.toMatchObject({
      ok: false,
      error: { code: 'dev_mutation_missing_snapshot' },
    });
  });

  it('does not fake success for no-change, not-found, invalid, or write failures', async () => {
    const cases = [
      {
        status: 200,
        result: { ok: true, changed: false, status: 'no_change', reasonCode: 'record_no_change', message: 'already set' },
        serverCode: 'record_no_change',
      },
      {
        status: 404,
        result: { ok: false, changed: false, status: 'not_found', reasonCode: 'record_not_found', message: 'missing' },
        serverCode: 'record_not_found',
      },
      {
        status: 400,
        result: { ok: false, changed: false, status: 'invalid', reasonCode: 'record_edit_invalid', message: 'bad flag' },
        serverCode: 'record_edit_invalid',
      },
      {
        status: 500,
        result: { ok: false, changed: false, status: 'failed', reasonCode: 'write_failed', message: 'write failed' },
        serverCode: 'write_failed',
      },
    ];

    for (const testCase of cases) {
      await expect(updateHistoryDataFlagViaDevApi({
        sessionId: 'session-1',
        targetDataFlag: 'excluded',
        config,
        metadata,
        fetchImpl: async () => new Response(JSON.stringify({ result: testCase.result }), { status: testCase.status }),
      })).resolves.toMatchObject({
        ok: false,
        error: { code: 'dev_mutation_not_successful', serverCode: testCase.serverCode },
      });
    }
  });

  it('normalizes unavailable, timeout, malformed, aborted, and repository errors', async () => {
    await expect(updateHistoryDataFlagViaDevApi({
      sessionId: 'session-1',
      targetDataFlag: 'excluded',
      config,
      metadata,
      fetchImpl: async () => {
        throw new Error('offline');
      },
    })).resolves.toMatchObject({ ok: false, error: { code: 'dev_mutation_unavailable' } });

    await expect(updateHistoryDataFlagViaDevApi({
      sessionId: 'session-1',
      targetDataFlag: 'excluded',
      config: { ...config, timeoutMs: 1 },
      metadata,
      fetchImpl: (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
        }),
    })).resolves.toMatchObject({ ok: false, error: { code: 'dev_mutation_timeout' } });

    await expect(updateHistoryDataFlagViaDevApi({
      sessionId: 'session-1',
      targetDataFlag: 'excluded',
      config,
      metadata,
      fetchImpl: async () => new Response('not json', { status: 200 }),
    })).resolves.toMatchObject({ ok: false, error: { code: 'dev_mutation_invalid_response' } });

    const abort = new AbortController();
    abort.abort();
    await expect(updateHistoryDataFlagViaDevApi({
      sessionId: 'session-1',
      targetDataFlag: 'excluded',
      config,
      metadata,
      signal: abort.signal,
      fetchImpl: async (_input, init) => {
        if (init?.signal?.aborted) throw new Error('aborted');
        return new Response(JSON.stringify(successBody), { status: 200 });
      },
    })).resolves.toMatchObject({ ok: false, error: { code: 'dev_mutation_aborted' } });

    const repositoryError = await updateHistoryDataFlagViaDevApi({
      sessionId: 'session-1',
      targetDataFlag: 'excluded',
      config,
      metadata,
      fetchImpl: async () => new Response(JSON.stringify({
        error: { code: 'database_closed', message: 'Error: SQLite repository is closed. stack at repo' },
      }), { status: 503 }),
    });

    expect(repositoryError).toMatchObject({
      ok: false,
      error: { code: 'dev_mutation_error_response', serverCode: 'database_closed' },
    });
    expectNoRawStack(repositoryError);
  });

  it('blocks when source fingerprint is missing', async () => {
    const result = await updateHistoryDataFlagViaDevApi({
      sessionId: 'session-1',
      targetDataFlag: 'excluded',
      config,
      metadata: { ...metadata, sourceFingerprint: '' },
      fetchImpl: async () => new Response(JSON.stringify(successBody), { status: 200 }),
    });

    expect(result).toMatchObject({
      ok: false,
      error: { code: 'dev_mutation_source_fingerprint_missing' },
    });
  });
});
