import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import {
  createDataHealthDismissMetadata,
  createDataHealthDismissSourceContext,
  DevApiDataHealthDismissPrototypePanel,
} from '../src/devApi/DevApiDataHealthDismissPrototype';
import {
  dismissDataHealthIssueViaDevApi,
  type DevApiDataHealthDismissFetch,
  type DevApiDataHealthDismissMetadata,
} from '../src/devApi/devApiDataHealthDismissClient';
import type { DevApiDataHealthDismissEnabledConfig } from '../src/devApi/devApiDataHealthDismissConfig';
import { makeRepairableWeightData } from './recordDataHealthMutationFixtures';
import { expectNoRawStack } from './runtimeBoundaryTestHelpers';

const config: DevApiDataHealthDismissEnabledConfig = {
  enabled: true,
  status: 'enabled',
  experiment: 'datahealth-dismiss',
  baseUrl: 'http://127.0.0.1:8787',
  timeoutMs: 20,
};

const appData = makeRepairableWeightData();
const sourceContext = createDataHealthDismissSourceContext(appData)!;
const metadata: DevApiDataHealthDismissMetadata = createDataHealthDismissMetadata({
  issueId: sourceContext.issueId,
  sourceFingerprint: sourceContext.sourceFingerprint,
  nowIso: '2026-05-10T00:00:00.000Z',
});

const successResult = {
  ok: true,
  changed: true,
  status: 'success',
  reasonCode: 'data_health_issue_dismissed',
  message: 'dismissed',
};

const snapshot = {
  snapshotId: 'snapshot-regression-lock',
  schemaVersion: 1,
  createdAt: '2026-05-10T00:00:00.000Z',
};

const response = (body: unknown, status = 200) =>
  new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });

const runDismiss = (fetchImpl: DevApiDataHealthDismissFetch) =>
  dismissDataHealthIssueViaDevApi({
    issueId: sourceContext.issueId,
    config,
    metadata,
    fetchImpl,
  });

const withTrackedLocalStorage = async (run: (calls: string[]) => Promise<void>) => {
  const calls: string[] = [];
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: vi.fn((key: string) => calls.push(`get:${key}`)),
      setItem: vi.fn((key: string) => calls.push(`set:${key}`)),
      removeItem: vi.fn((key: string) => calls.push(`remove:${key}`)),
      clear: vi.fn(() => calls.push('clear')),
    },
  });

  try {
    await run(calls);
  } finally {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
};

describe('DataHealth dismiss regression success/no-fake-success contract', () => {
  it('accepts only the complete persisted success shape', async () => {
    const result = await runDismiss(async () => response({ result: successResult, snapshot }, 200));

    expect(result).toMatchObject({
      ok: true,
      status: 200,
      result: successResult,
      snapshot,
    });
  });

  it.each([
    ['missing snapshot metadata', { result: successResult }, 200, 'dev_mutation_missing_snapshot'],
    ['empty snapshot id', { result: successResult, snapshot: { ...snapshot, snapshotId: '' } }, 200, 'dev_mutation_missing_snapshot'],
    ['ok false', { result: { ...successResult, ok: false, reasonCode: 'write_failed', message: 'write failed' }, snapshot }, 500, 'dev_mutation_not_successful'],
    ['changed false', { result: { ...successResult, changed: false, status: 'no_change', reasonCode: 'no_change' }, snapshot }, 200, 'dev_mutation_not_successful'],
    ['status not success', { result: { ...successResult, status: 'pending', reasonCode: 'pending_write' }, snapshot }, 200, 'dev_mutation_not_successful'],
    ['HTTP error with result body', { result: successResult, snapshot }, 500, 'dev_mutation_not_successful'],
    ['malformed response', 'not-json', 200, 'dev_mutation_invalid_response'],
  ])('%s remains failure and does not mutate local state', async (_label, body, status, code) => {
    await withTrackedLocalStorage(async (calls) => {
      const data = makeRepairableWeightData();
      const before = JSON.stringify(data);
      const result = await runDismiss(async () => response(body, status));

      expect(result).toMatchObject({ ok: false, error: { code } });
      expect(JSON.stringify(data)).toBe(before);
      expect(calls).toEqual([]);
      expectNoRawStack(result);
    });
  });

  it('server and repository errors never render success copy', async () => {
    const result = await runDismiss(async () => response({
      error: {
        code: 'write_failed',
        message: 'SqliteRepositoryError: raw stack should not leak',
      },
    }, 500));

    expect(result).toMatchObject({
      ok: false,
      error: {
        code: 'dev_mutation_error_response',
        serverCode: 'write_failed',
      },
    });
    expectNoRawStack(result);

    const markup = renderToStaticMarkup(createElement(DevApiDataHealthDismissPrototypePanel, {
      config,
      sourceContext,
      selectedIssueId: sourceContext.issueId,
      confirmed: false,
      pending: false,
      state: {
        status: 'failure',
        issueId: sourceContext.issueId,
        metadata,
        error: result.ok ? undefined : result.error,
      },
    }));

    expect(markup).toContain('Failure');
    expect(markup).toContain('write_failed');
    expect(markup).not.toContain('Snapshot recorded');
    expect(markup).not.toContain('Success</dd>');
    expect(markup).not.toContain('SqliteRepositoryError');
  });
});
