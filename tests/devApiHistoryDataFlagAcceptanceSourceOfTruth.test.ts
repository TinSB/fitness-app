import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  createHistoryDataFlagSourceContext,
  DevApiHistoryDataFlagPrototype,
  DevApiHistoryDataFlagPrototypePanel,
} from '../src/devApi/DevApiHistoryDataFlagPrototype';
import { updateHistoryDataFlagViaDevApi, type DevApiHistoryDataFlagMetadata } from '../src/devApi/devApiHistoryDataFlagClient';
import type { DevApiHistoryDataFlagConfig, DevApiHistoryDataFlagEnabledConfig } from '../src/devApi/devApiHistoryDataFlagConfig';
import { makeRecordData } from './recordDataHealthMutationFixtures';
import { readSource } from './runtimeBoundaryTestHelpers';

const enabledConfig: DevApiHistoryDataFlagConfig & DevApiHistoryDataFlagEnabledConfig = {
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

describe('History data-flag acceptance source-of-truth integrity', () => {
  it('does not mutate AppData while deriving context or rendering success/failure states', () => {
    const data = makeRecordData();
    const before = JSON.stringify(data);
    const sourceContext = createHistoryDataFlagSourceContext(data)!;

    renderToStaticMarkup(createElement(DevApiHistoryDataFlagPrototype, {
      data,
      config: enabledConfig,
    }));
    renderToStaticMarkup(createElement(DevApiHistoryDataFlagPrototypePanel, {
      config: enabledConfig,
      confirmed: false,
      pending: false,
      selectedSessionId: sourceContext.sessionId,
      sourceContext,
      targetDataFlag: sourceContext.targetDataFlag,
      state: {
        status: 'success',
        sessionId: sourceContext.sessionId,
        targetDataFlag: sourceContext.targetDataFlag,
        snapshot: successBody.snapshot,
      },
    }));
    renderToStaticMarkup(createElement(DevApiHistoryDataFlagPrototypePanel, {
      config: enabledConfig,
      confirmed: false,
      pending: false,
      selectedSessionId: sourceContext.sessionId,
      sourceContext,
      targetDataFlag: sourceContext.targetDataFlag,
      state: {
        status: 'failure',
        sessionId: sourceContext.sessionId,
        targetDataFlag: sourceContext.targetDataFlag,
        error: {
          code: 'dev_mutation_not_successful',
          serverCode: 'record_no_change',
          message: 'already set',
        },
      },
    }));

    expect(JSON.stringify(data)).toBe(before);
  });

  it('does not write localStorage on successful or failed client calls', async () => {
    const spy = installLocalStorageSpy();
    try {
      await expect(updateHistoryDataFlagViaDevApi({
        sessionId: 'record-mutation-session',
        targetDataFlag: 'excluded',
        config: enabledConfig,
        metadata,
        fetchImpl: async () => new Response(JSON.stringify(successBody), { status: 200 }),
      })).resolves.toMatchObject({ ok: true });

      await expect(updateHistoryDataFlagViaDevApi({
        sessionId: 'record-mutation-session',
        targetDataFlag: 'excluded',
        config: enabledConfig,
        metadata,
        fetchImpl: async () => new Response(JSON.stringify({
          result: {
            ok: false,
            changed: false,
            status: 'failed',
            reasonCode: 'write_failed',
            message: 'write failed',
          },
        }), { status: 500 }),
      })).resolves.toMatchObject({ ok: false });

      expect(spy.calls).toEqual([]);
    } finally {
      spy.restore();
    }
  });

  it('does not store snapshot metadata or merge API result into AppData', async () => {
    const data = makeRecordData();
    const before = JSON.stringify(data);
    const result = await updateHistoryDataFlagViaDevApi({
      sessionId: 'record-mutation-session',
      targetDataFlag: 'excluded',
      config: enabledConfig,
      metadata,
      fetchImpl: async () => new Response(JSON.stringify(successBody), { status: 200 }),
    });

    expect(result).toMatchObject({ ok: true, snapshot: successBody.snapshot });
    expect(JSON.stringify(data)).toBe(before);
    expect(JSON.stringify(data)).not.toContain('snapshot-1');
  });

  it('keeps read-only comparison separate from the mutation prototype', () => {
    const readOnlySource = readSource('src/devApi/devApiReadOnlyClient.ts');
    const mutationSource = readSource('src/devApi/devApiHistoryDataFlagClient.ts');

    expect(readOnlySource).not.toContain('/history/:id/data-flag');
    expect(readOnlySource).not.toMatch(/method\s*:\s*['"`]POST['"`]/);
    expect(mutationSource).not.toMatch(/saveData|loadData|localStorageAdapter|localStorage\./);
  });
});
