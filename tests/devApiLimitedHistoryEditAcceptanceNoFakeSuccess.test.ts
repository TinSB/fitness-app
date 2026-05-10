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

const result = (overrides: Record<string, unknown>) => ({
  ok: true,
  changed: true,
  status: 'success',
  reasonCode: 'record_updated',
  message: 'updated',
  ...overrides,
});

const snapshot = {
  snapshotId: 'snapshot-1',
  schemaVersion: 1,
  createdAt: '2026-05-10T00:00:00.000Z',
};

describe('limited history edit acceptance no-fake-success', () => {
  it('shows success only for HTTP success, ok=true, changed=true, status success, and snapshot metadata', async () => {
    await expect(updateHistorySetEditViaDevApi({
      sessionId: 'session-1',
      exerciseId: 'exercise-1',
      setId: 'set-1',
      patch: { note: 'checked' },
      config,
      metadata,
      fetchImpl: async () => new Response(JSON.stringify({ result: result({}), snapshot }), { status: 200 }),
    })).resolves.toMatchObject({ ok: true, snapshot });

    for (const testCase of [
      { httpStatus: 500, body: { result: result({}) } },
      { httpStatus: 200, body: { result: result({ ok: false, reasonCode: 'record_edit_invalid' }), snapshot } },
      { httpStatus: 200, body: { result: result({ changed: false, status: 'no_change', reasonCode: 'record_no_change' }), snapshot } },
      { httpStatus: 200, body: { result: result({ status: 'requires_confirmation', reasonCode: 'record_edit_requires_confirmation' }), snapshot } },
      { httpStatus: 200, body: { result: result({}), snapshot: undefined } },
    ]) {
      await expect(updateHistorySetEditViaDevApi({
        sessionId: 'session-1',
        exerciseId: 'exercise-1',
        setId: 'set-1',
        patch: { note: 'checked' },
        config,
        metadata,
        fetchImpl: async () => new Response(JSON.stringify(testCase.body), { status: testCase.httpStatus }),
      })).resolves.toMatchObject({ ok: false });
    }
  });

  it('normalizes failure states without raw stack and without retrying', async () => {
    const failures = [
      { status: 404, result: result({ ok: false, changed: false, status: 'not_found', reasonCode: 'record_not_found' }) },
      { status: 400, result: result({ ok: false, changed: false, status: 'invalid', reasonCode: 'record_edit_invalid' }) },
      { status: 409, result: result({ ok: false, changed: false, status: 'requires_confirmation', reasonCode: 'record_edit_requires_confirmation' }) },
      { status: 409, result: result({ ok: false, changed: false, status: 'invalid', reasonCode: 'source_snapshot_mismatch' }) },
      { status: 500, result: result({ ok: false, changed: false, status: 'failed', reasonCode: 'write_failed' }) },
      { status: 500, result: result({ ok: false, changed: false, status: 'failed', reasonCode: 'transaction_failed' }) },
      { status: 503, result: result({ ok: false, changed: false, status: 'failed', reasonCode: 'database_closed' }) },
      { status: 404, result: result({ ok: false, changed: false, status: 'unsupported', reasonCode: 'unsupported_route' }) },
    ];

    for (const failure of failures) {
      let calls = 0;
      const response = await updateHistorySetEditViaDevApi({
        sessionId: 'session-1',
        exerciseId: 'exercise-1',
        setId: 'set-1',
        patch: { note: 'checked' },
        config,
        metadata,
        fetchImpl: async () => {
          calls += 1;
          return new Response(JSON.stringify({ result: failure.result }), { status: failure.status });
        },
      });

      expect(response).toMatchObject({ ok: false, error: { code: 'dev_mutation_not_successful' } });
      expect(calls).toBe(1);
      expectNoRawStack(response);
    }
  });

  it('does not write localStorage during success or failure normalization', async () => {
    const original = globalThis.localStorage;
    const writes: string[] = [];
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: () => null,
        setItem: (key: string) => writes.push(key),
        removeItem: (key: string) => writes.push(key),
        clear: () => writes.push('clear'),
      },
    });

    try {
      await updateHistorySetEditViaDevApi({
        sessionId: 'session-1',
        exerciseId: 'exercise-1',
        setId: 'set-1',
        patch: { note: 'checked' },
        config,
        metadata,
        fetchImpl: async () => new Response(JSON.stringify({ result: result({}), snapshot }), { status: 200 }),
      });
      await updateHistorySetEditViaDevApi({
        sessionId: 'session-1',
        exerciseId: 'exercise-1',
        setId: 'set-1',
        patch: { note: 'checked' },
        config,
        metadata,
        fetchImpl: async () => new Response(JSON.stringify({ result: result({ changed: false, status: 'no_change' }) }), { status: 200 }),
      });
    } finally {
      Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: original });
    }

    expect(writes).toEqual([]);
  });
});
