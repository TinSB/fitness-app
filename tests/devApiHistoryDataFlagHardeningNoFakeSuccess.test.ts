import { describe, expect, it } from 'vitest';
import {
  updateHistoryDataFlagViaDevApi,
  type DevApiHistoryDataFlagMetadata,
} from '../src/devApi/devApiHistoryDataFlagClient';
import type { DevApiHistoryDataFlagEnabledConfig } from '../src/devApi/devApiHistoryDataFlagConfig';
import { makeRecordData } from './recordDataHealthMutationFixtures';
import { expectNoRawStack } from './runtimeBoundaryTestHelpers';

const config: DevApiHistoryDataFlagEnabledConfig = {
  enabled: true,
  status: 'enabled',
  experiment: 'history-data-flag',
  baseUrl: 'http://127.0.0.1:8787',
  timeoutMs: 20,
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
    sessionId: 'record-mutation-session',
    targetDataFlag: 'excluded',
    config,
    metadata,
    fetchImpl: async () => new Response(JSON.stringify(body), { status }),
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

describe('History data-flag hardening no-fake-success contract', () => {
  it('accepts only the full strict success shape', async () => {
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
    const cases: Array<[string, unknown, number, string, string | undefined]> = [
      ['HTTP error with success body', { result: successResult, snapshot: successSnapshot }, 500, 'dev_mutation_not_successful', 'record_updated'],
      ['missing snapshot metadata', { result: successResult }, 200, 'dev_mutation_missing_snapshot', undefined],
      ['ok false', { result: { ...successResult, ok: false, reasonCode: 'write_failed' }, snapshot: successSnapshot }, 200, 'dev_mutation_not_successful', 'write_failed'],
      ['changed false', { result: { ...successResult, changed: false, status: 'no_change', reasonCode: 'record_no_change' }, snapshot: successSnapshot }, 200, 'dev_mutation_not_successful', 'record_no_change'],
      ['status mismatch', { result: { ...successResult, status: 'done' }, snapshot: successSnapshot }, 200, 'dev_mutation_not_successful', 'record_updated'],
      ['malformed mutation result', { result: { ok: true }, snapshot: successSnapshot }, 200, 'dev_mutation_invalid_response', undefined],
    ];

    for (const [label, body, status, code, serverCode] of cases) {
      const result = await callClient(body, status);
      expect(result, label).toMatchObject({
        ok: false,
        error: {
          code,
          ...(serverCode ? { serverCode } : {}),
        },
      });
      expectNoRawStack(result);
    }
  });

  it('keeps no_change for already-current normal, test, and excluded targets non-successful', async () => {
    for (const targetDataFlag of ['normal', 'test', 'excluded'] as const) {
      await expect(updateHistoryDataFlagViaDevApi({
        sessionId: 'record-mutation-session',
        targetDataFlag,
        config,
        metadata: { ...metadata, targetDataFlag },
        fetchImpl: async () => new Response(JSON.stringify({
          result: {
            ok: true,
            changed: false,
            status: 'no_change',
            reasonCode: 'record_no_change',
            message: `already ${targetDataFlag}`,
          },
          snapshot: successSnapshot,
        }), { status: 200 }),
      })).resolves.toMatchObject({
        ok: false,
        error: {
          code: 'dev_mutation_not_successful',
          serverCode: 'record_no_change',
        },
      });
    }
  });

  it('keeps write and repository failures non-successful without localStorage or AppData mutation', async () => {
    const data = makeRecordData();
    const before = JSON.stringify(data);
    const spy = installLocalStorageSpy();
    try {
      for (const reasonCode of ['write_failed', 'transaction_failed', 'database_closed', 'snapshot_validation_failed', 'repository_schema_mismatch']) {
        const result = await callClient({
          result: {
            ok: false,
            changed: false,
            status: 'failed',
            reasonCode,
            message: `Error: ${reasonCode} stack at repository`,
          },
          snapshot: successSnapshot,
        }, 500);

        expect(result, reasonCode).toMatchObject({
          ok: false,
          error: {
            code: 'dev_mutation_not_successful',
            serverCode: reasonCode,
          },
        });
        expectNoRawStack(result);
      }

      expect(spy.calls).toEqual([]);
      expect(JSON.stringify(data)).toBe(before);
    } finally {
      spy.restore();
    }
  });
});
