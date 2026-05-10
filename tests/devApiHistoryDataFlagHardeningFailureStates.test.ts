import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  createHistoryDataFlagSourceContext,
  DevApiHistoryDataFlagPrototypePanel,
  getHistoryDataFlagRecoveryNote,
} from '../src/devApi/DevApiHistoryDataFlagPrototype';
import {
  sanitizeHistoryDataFlagMessage,
  updateHistoryDataFlagViaDevApi,
  type DevApiHistoryDataFlagFetch,
  type DevApiHistoryDataFlagMetadata,
} from '../src/devApi/devApiHistoryDataFlagClient';
import type { DevApiHistoryDataFlagConfig, DevApiHistoryDataFlagEnabledConfig } from '../src/devApi/devApiHistoryDataFlagConfig';
import { makeRecordData } from './recordDataHealthMutationFixtures';
import { expectNoRawStack } from './runtimeBoundaryTestHelpers';

const config: DevApiHistoryDataFlagConfig & DevApiHistoryDataFlagEnabledConfig = {
  enabled: true,
  status: 'enabled',
  experiment: 'history-data-flag',
  baseUrl: 'http://127.0.0.1:8787',
  timeoutMs: 15,
};

const metadata: DevApiHistoryDataFlagMetadata = {
  sessionId: 'record-mutation-session',
  targetDataFlag: 'excluded',
  mutationId: 'mutation-1',
  idempotencyKey: 'key-1',
  requestFingerprint: 'request-1',
  sourceFingerprint: 'source-1',
  confirmed: true,
};

const failureResult = (reasonCode: string, message = reasonCode) => ({
  ok: false,
  changed: false,
  status: reasonCode === 'record_no_change' ? 'no_change' : 'failed',
  reasonCode,
  message,
});

const installLocalStorageSpy = () => {
  const calls: string[] = [];
  const previousDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => {
        calls.push(`get:${key}`);
        return null;
      },
      setItem: (key: string) => {
        calls.push(`set:${key}`);
      },
      removeItem: (key: string) => {
        calls.push(`remove:${key}`);
      },
      clear: () => {
        calls.push('clear');
      },
    },
  });
  return {
    calls,
    restore: () => {
      if (previousDescriptor) {
        Object.defineProperty(globalThis, 'localStorage', previousDescriptor);
      } else {
        delete (globalThis as { localStorage?: Storage }).localStorage;
      }
    },
  };
};

describe('History data-flag hardening failure states', () => {
  it('normalizes unavailable, timeout, abort, malformed response, and server error without raw stacks', async () => {
    await expect(updateHistoryDataFlagViaDevApi({
      sessionId: 'record-mutation-session',
      targetDataFlag: 'excluded',
      config,
      metadata,
      fetchImpl: async () => {
        throw new Error('offline');
      },
    })).resolves.toMatchObject({ ok: false, error: { code: 'dev_mutation_unavailable' } });

    await expect(updateHistoryDataFlagViaDevApi({
      sessionId: 'record-mutation-session',
      targetDataFlag: 'excluded',
      config: { ...config, timeoutMs: 1 },
      metadata,
      fetchImpl: (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('timeout')), { once: true });
        }),
    })).resolves.toMatchObject({ ok: false, error: { code: 'dev_mutation_timeout' } });

    const abort = new AbortController();
    abort.abort();
    await expect(updateHistoryDataFlagViaDevApi({
      sessionId: 'record-mutation-session',
      targetDataFlag: 'excluded',
      config,
      metadata,
      signal: abort.signal,
      fetchImpl: async (_input, init) => {
        if (init?.signal?.aborted) throw new Error('aborted');
        return new Response('{}', { status: 200 });
      },
    })).resolves.toMatchObject({ ok: false, error: { code: 'dev_mutation_aborted' } });

    await expect(updateHistoryDataFlagViaDevApi({
      sessionId: 'record-mutation-session',
      targetDataFlag: 'excluded',
      config,
      metadata,
      fetchImpl: async () => new Response('not json', { status: 200 }),
    })).resolves.toMatchObject({ ok: false, error: { code: 'dev_mutation_invalid_response' } });

    const serverError = await updateHistoryDataFlagViaDevApi({
      sessionId: 'record-mutation-session',
      targetDataFlag: 'excluded',
      config,
      metadata,
      fetchImpl: async () => new Response(JSON.stringify({
        error: { code: 'database_closed', message: 'Error: database closed stack at repository' },
      }), { status: 503 }),
    });
    expect(serverError).toMatchObject({
      ok: false,
      error: { code: 'dev_mutation_error_response', serverCode: 'database_closed' },
    });
    expectNoRawStack(serverError);
  });

  it('keeps known business failures visible, non-successful, and single-attempt', async () => {
    const spy = installLocalStorageSpy();
    try {
      for (const reasonCode of [
        'record_not_found',
        'record_edit_invalid',
        'record_no_change',
        'requiresConfirmation',
        'unsupported_route',
        'database_closed',
        'write_failed',
        'transaction_failed',
      ]) {
        let calls = 0;
        const fetchImpl: DevApiHistoryDataFlagFetch = async () => {
          calls += 1;
          return new Response(JSON.stringify({
            result: failureResult(reasonCode, `Error: ${reasonCode} stack at repository`),
          }), { status: reasonCode === 'record_not_found' ? 404 : 409 });
        };

        const result = await updateHistoryDataFlagViaDevApi({
          sessionId: 'record-mutation-session',
          targetDataFlag: 'excluded',
          config,
          metadata,
          fetchImpl,
        });

        expect(result, reasonCode).toMatchObject({
          ok: false,
          error: {
            code: 'dev_mutation_not_successful',
            serverCode: reasonCode,
          },
        });
        expectNoRawStack(result);
        expect(calls).toBe(1);
      }

      expect(spy.calls).toEqual([]);
    } finally {
      spy.restore();
    }
  });

  it('rejects invalid target dataFlag before request and surfaces invalid server responses as failures', async () => {
    let invalidCalls = 0;
    await expect(updateHistoryDataFlagViaDevApi({
      sessionId: 'record-mutation-session',
      targetDataFlag: 'archived',
      config,
      metadata,
      fetchImpl: async () => {
        invalidCalls += 1;
        return new Response('{}', { status: 200 });
      },
    })).resolves.toMatchObject({
      ok: false,
      error: { code: 'dev_mutation_invalid_data_flag' },
    });
    expect(invalidCalls).toBe(0);

    await expect(updateHistoryDataFlagViaDevApi({
      sessionId: 'record-mutation-session',
      targetDataFlag: 'excluded',
      config,
      metadata,
      fetchImpl: async () => new Response(JSON.stringify({ result: { ok: false } }), { status: 400 }),
    })).resolves.toMatchObject({
      ok: false,
      error: { code: 'dev_mutation_invalid_response' },
    });
  });

  it('renders safe failure diagnostics and recovery notes without raw response dumps', () => {
    const sourceContext = createHistoryDataFlagSourceContext(makeRecordData())!;
    const markup = renderToStaticMarkup(createElement(DevApiHistoryDataFlagPrototypePanel, {
      config,
      confirmed: false,
      pending: false,
      selectedSessionId: sourceContext.sessionId,
      sourceContext,
      targetDataFlag: 'excluded',
      state: {
        status: 'failure',
        sessionId: sourceContext.sessionId,
        targetDataFlag: 'excluded',
        error: {
          code: 'dev_mutation_error_response',
          serverCode: 'database_closed',
          message: sanitizeHistoryDataFlagMessage('Error: database closed stack at repository { "raw": true }'),
        },
      },
    }));

    expect(markup).toContain('Failure');
    expect(markup).toContain('database_closed');
    expect(markup).toContain('Safe recovery note');
    expect(markup).toContain(getHistoryDataFlagRecoveryNote({ code: 'dev_mutation_error_response', serverCode: 'database_closed', message: 'database closed' }));
    expect(markup).not.toContain('Success');
    expect(markup).not.toContain('stack');
    expect(markup).not.toContain('"raw"');
  });
});
