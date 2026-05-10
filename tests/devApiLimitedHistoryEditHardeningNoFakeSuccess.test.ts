import { describe, expect, it } from 'vitest';
import {
  updateHistorySetEditViaDevApi,
  type DevApiHistorySetEditMetadata,
} from '../src/devApi/devApiHistorySetEditClient';
import type { DevApiHistorySetEditEnabledConfig } from '../src/devApi/devApiHistorySetEditConfig';
import { expectNoRawStack } from './runtimeBoundaryTestHelpers';

const config: DevApiHistorySetEditEnabledConfig = {
  enabled: true,
  status: 'enabled',
  experiment: 'limited-history-edit',
  baseUrl: 'http://127.0.0.1:8787',
  timeoutMs: 10,
};

const metadata: DevApiHistorySetEditMetadata = {
  sessionId: 'session-1',
  exerciseId: 'exercise-1',
  setId: 'set-1',
  changedFields: ['note'],
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

const snapshot = {
  snapshotId: 'snapshot-1',
  schemaVersion: 1,
  createdAt: '2026-05-10T00:00:00.000Z',
};

const request = (body: unknown, status = 200) =>
  updateHistorySetEditViaDevApi({
    sessionId: 'session-1',
    exerciseId: 'exercise-1',
    setId: 'set-1',
    patch: { note: 'checked' },
    config,
    metadata,
    fetchImpl: async () => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status }),
  });

describe('limited history edit hardening no-fake-success', () => {
  it('treats missing or malformed success shape as failure', async () => {
    for (const body of [
      {},
      { result: { ...successResult, ok: 'true' } },
      { result: { ...successResult, changed: 'true' } },
      { result: { ...successResult, status: true } },
      { result: successResult },
      'not-json',
    ]) {
      await expect(request(body)).resolves.toMatchObject({ ok: false });
    }
  });

  it('normalizes explicit server and route failures without raw stack', async () => {
    const cases = [
      { status: 404, reasonCode: 'record_not_found', serverStatus: 'not_found' },
      { status: 404, reasonCode: 'exercise_not_found', serverStatus: 'not_found' },
      { status: 404, reasonCode: 'set_not_found', serverStatus: 'not_found' },
      { status: 400, reasonCode: 'record_edit_invalid', serverStatus: 'invalid' },
      { status: 409, reasonCode: 'record_edit_requires_confirmation', serverStatus: 'requires_confirmation' },
      { status: 409, reasonCode: 'source_snapshot_mismatch', serverStatus: 'invalid' },
      { status: 500, reasonCode: 'write_failed', serverStatus: 'failed' },
      { status: 500, reasonCode: 'transaction_failed', serverStatus: 'failed' },
      { status: 503, reasonCode: 'database_closed', serverStatus: 'failed' },
      { status: 404, reasonCode: 'unsupported_route', serverStatus: 'unsupported' },
    ];

    for (const testCase of cases) {
      const response = await request({
        result: {
          ok: false,
          changed: false,
          status: testCase.serverStatus,
          reasonCode: testCase.reasonCode,
          message: 'Error: stack at repo',
        },
      }, testCase.status);

      expect(response).toMatchObject({
        ok: false,
        error: { code: 'dev_mutation_not_successful', serverCode: testCase.reasonCode },
      });
      expectNoRawStack(response);
    }
  });

  it('requires source fingerprint before request and never auto-retries', async () => {
    let calls = 0;
    const response = await updateHistorySetEditViaDevApi({
      sessionId: 'session-1',
      exerciseId: 'exercise-1',
      setId: 'set-1',
      patch: { note: 'checked' },
      config,
      metadata: { ...metadata, sourceFingerprint: '' },
      fetchImpl: async () => {
        calls += 1;
        return new Response(JSON.stringify({ result: successResult, snapshot }), { status: 200 });
      },
    });

    expect(response).toMatchObject({ ok: false, error: { code: 'dev_mutation_source_fingerprint_missing' } });
    expect(calls).toBe(0);
  });
});
