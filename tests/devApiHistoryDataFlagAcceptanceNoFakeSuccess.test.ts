import { describe, expect, it } from 'vitest';
import {
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

const successResult = {
  ok: true,
  changed: true,
  status: 'success',
  reasonCode: 'record_updated',
  message: 'updated',
};

const successSnapshot = {
  snapshotId: 'snapshot-1',
  schemaVersion: 1,
  createdAt: '2026-05-10T00:00:00.000Z',
};

const callClient = (body: unknown, status = 200) =>
  updateHistoryDataFlagViaDevApi({
    sessionId: 'session-1',
    targetDataFlag: 'excluded',
    config,
    metadata,
    fetchImpl: async () => new Response(JSON.stringify(body), { status }),
  });

describe('History data-flag acceptance no-fake-success contract', () => {
  it('accepts success only for HTTP success, successful mutation result, changed=true, status=success, and snapshot metadata', async () => {
    await expect(callClient({ result: successResult, snapshot: successSnapshot }, 200)).resolves.toMatchObject({
      ok: true,
      status: 200,
      result: {
        ok: true,
        changed: true,
        status: 'success',
      },
      snapshot: successSnapshot,
    });
  });

  it('treats every missing success condition as failure', async () => {
    const cases: Array<[string, unknown, number, string]> = [
      ['HTTP error with success-like body', { result: successResult, snapshot: successSnapshot }, 500, 'dev_mutation_not_successful'],
      ['missing snapshot', { result: successResult }, 200, 'dev_mutation_missing_snapshot'],
      ['ok false', { result: { ...successResult, ok: false, reasonCode: 'write_failed' }, snapshot: successSnapshot }, 200, 'dev_mutation_not_successful'],
      ['changed false', { result: { ...successResult, changed: false, reasonCode: 'record_no_change' }, snapshot: successSnapshot }, 200, 'dev_mutation_not_successful'],
      ['status mismatch', { result: { ...successResult, status: 'done' }, snapshot: successSnapshot }, 200, 'dev_mutation_not_successful'],
      ['malformed result', { result: { ok: true }, snapshot: successSnapshot }, 200, 'dev_mutation_invalid_response'],
    ];

    for (const [label, body, status, code] of cases) {
      const result = await callClient(body, status);
      expect(result, label).toMatchObject({ ok: false, error: { code } });
      expectNoRawStack(result);
    }
  });

  it('keeps no_change, record_not_found, invalid flag, requiresConfirmation, and unsupported_route non-successful', async () => {
    const cases = [
      { reasonCode: 'record_no_change', status: 'no_change', message: 'already dismissed', ok: true, changed: false },
      { reasonCode: 'record_not_found', status: 'not_found', message: 'missing', ok: false, changed: false },
      { reasonCode: 'record_edit_invalid', status: 'invalid', message: 'bad flag', ok: false, changed: false },
      { reasonCode: 'requiresConfirmation', status: 'blocked', message: 'confirmation required', ok: false, changed: false },
      { reasonCode: 'unsupported_route', status: 'unsupported_route', message: 'unsupported route', ok: false, changed: false },
    ];

    for (const mutationResult of cases) {
      await expect(callClient({ result: mutationResult }, 400)).resolves.toMatchObject({
        ok: false,
        error: {
          code: 'dev_mutation_not_successful',
          serverCode: mutationResult.reasonCode,
        },
      });
    }
  });

  it('keeps write and repository failures non-successful without raw stack text', async () => {
    for (const reasonCode of ['write_failed', 'transaction_failed', 'database_closed', 'snapshot_validation_failed', 'repository_schema_mismatch']) {
      const result = await callClient({
        result: {
          ok: false,
          changed: false,
          status: 'failed',
          reasonCode,
          message: `Error: ${reasonCode} stack at repository`,
        },
      }, 500);

      expect(result).toMatchObject({
        ok: false,
        error: {
          code: 'dev_mutation_not_successful',
          serverCode: reasonCode,
        },
      });
      expectNoRawStack(result);
    }
  });

  it('rejects invalid dataFlag before request and never fakes success', async () => {
    let calls = 0;
    const fetchImpl: DevApiHistoryDataFlagFetch = async () => {
      calls += 1;
      return new Response(JSON.stringify({ result: successResult, snapshot: successSnapshot }), { status: 200 });
    };

    await expect(updateHistoryDataFlagViaDevApi({
      sessionId: 'session-1',
      targetDataFlag: 'archived',
      config,
      metadata,
      fetchImpl,
    })).resolves.toMatchObject({
      ok: false,
      error: { code: 'dev_mutation_invalid_data_flag' },
    });
    expect(calls).toBe(0);
  });
});
