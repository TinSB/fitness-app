import { describe, expect, it } from 'vitest';
import {
  sanitizeHistoryDataFlagMessage,
  updateHistoryDataFlagViaDevApi,
  type DevApiHistoryDataFlagFetch,
  type DevApiHistoryDataFlagMetadata,
} from '../src/devApi/devApiHistoryDataFlagClient';
import type { DevApiHistoryDataFlagEnabledConfig } from '../src/devApi/devApiHistoryDataFlagConfig';
import { expectNoRawStack } from './runtimeBoundaryTestHelpers';

const config: DevApiHistoryDataFlagEnabledConfig = {
  enabled: true,
  status: 'enabled',
  experiment: 'history-data-flag',
  baseUrl: 'http://127.0.0.1:8787',
  timeoutMs: 15,
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

const failureResult = (reasonCode: string, message = reasonCode) => ({
  ok: false,
  changed: false,
  status: reasonCode === 'record_no_change' ? 'no_change' : 'failed',
  reasonCode,
  message,
});

describe('History data-flag acceptance failure states', () => {
  it('normalizes API unavailable, timeout, abort, malformed response, and server error shapes', async () => {
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
          init?.signal?.addEventListener('abort', () => reject(new Error('timeout')), { once: true });
        }),
    })).resolves.toMatchObject({ ok: false, error: { code: 'dev_mutation_timeout' } });

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
        return new Response('{}', { status: 200 });
      },
    })).resolves.toMatchObject({ ok: false, error: { code: 'dev_mutation_aborted' } });

    await expect(updateHistoryDataFlagViaDevApi({
      sessionId: 'session-1',
      targetDataFlag: 'excluded',
      config,
      metadata,
      fetchImpl: async () => new Response('not json', { status: 200 }),
    })).resolves.toMatchObject({ ok: false, error: { code: 'dev_mutation_invalid_response' } });

    const serverError = await updateHistoryDataFlagViaDevApi({
      sessionId: 'session-1',
      targetDataFlag: 'excluded',
      config,
      metadata,
      fetchImpl: async () => new Response(JSON.stringify({
        error: { code: 'database_closed', message: 'Error: database closed stack at repo' },
      }), { status: 503 }),
    });
    expect(serverError).toMatchObject({
      ok: false,
      error: { code: 'dev_mutation_error_response', serverCode: 'database_closed' },
    });
    expectNoRawStack(serverError);
  });

  it('keeps all known business failure codes non-successful without auto retry', async () => {
    const reasonCodes = [
      'record_not_found',
      'record_edit_invalid',
      'record_no_change',
      'requiresConfirmation',
      'source_snapshot_mismatch',
      'write_failed',
      'transaction_failed',
      'database_closed',
      'unsupported_route',
      'snapshot_validation_failed',
      'repository_schema_mismatch',
    ];

    for (const reasonCode of reasonCodes) {
      let calls = 0;
      const fetchImpl: DevApiHistoryDataFlagFetch = async () => {
        calls += 1;
        return new Response(JSON.stringify({
          result: failureResult(reasonCode, `Error: ${reasonCode} stack at repository`),
        }), { status: 409 });
      };

      const result = await updateHistoryDataFlagViaDevApi({
        sessionId: 'session-1',
        targetDataFlag: reasonCode === 'record_edit_invalid' ? 'test' : 'excluded',
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
      expect(calls, `${reasonCode} should not auto-retry`).toBe(1);
    }
  });

  it('treats missing snapshot metadata as a visible failure even when the mutation body looks successful', async () => {
    const result = await updateHistoryDataFlagViaDevApi({
      sessionId: 'session-1',
      targetDataFlag: 'excluded',
      config,
      metadata,
      fetchImpl: async () => new Response(JSON.stringify({
        result: {
          ok: true,
          changed: true,
          status: 'success',
          reasonCode: 'record_updated',
          message: 'updated',
        },
      }), { status: 200 }),
    });

    expect(result).toMatchObject({
      ok: false,
      error: { code: 'dev_mutation_missing_snapshot' },
    });
  });

  it('sanitizes failure text and does not expose raw stack wording', () => {
    const message = sanitizeHistoryDataFlagMessage('Error: SqliteRepositoryError: boom stack at repo { "raw": true }');

    expect(message).not.toContain('Error:');
    expect(message).not.toContain('SqliteRepositoryError');
    expect(message).not.toContain('stack');
    expect(message).not.toContain('"raw"');
  });
});
