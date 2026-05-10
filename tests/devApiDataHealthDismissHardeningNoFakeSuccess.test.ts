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

const sourceContext = createDataHealthDismissSourceContext(makeRepairableWeightData())!;

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
  snapshotId: 'snapshot-hardening',
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

describe('DataHealth dismiss hardening no-fake-success behavior', () => {
  it.each([
    ['missing snapshot metadata', { result: successResult }, 200, 'dev_mutation_missing_snapshot'],
    ['missing snapshot id', { result: successResult, snapshot: { schemaVersion: 1, createdAt: snapshot.createdAt } }, 200, 'dev_mutation_missing_snapshot'],
    ['ok false', { result: { ...successResult, ok: false, changed: false, status: 'write_failed', reasonCode: 'write_failed' }, snapshot }, 500, 'dev_mutation_not_successful'],
    ['changed false', { result: { ...successResult, changed: false, status: 'no_change', reasonCode: 'no_change' }, snapshot }, 200, 'dev_mutation_not_successful'],
    ['status not success', { result: { ...successResult, status: 'pending', reasonCode: 'pending_write' }, snapshot }, 200, 'dev_mutation_not_successful'],
    ['snapshot validation failed', { result: { ...successResult, ok: false, changed: false, status: 'snapshot_validation_failed', reasonCode: 'snapshot_validation_failed' }, snapshot }, 500, 'dev_mutation_not_successful'],
    ['repository schema mismatch', { result: { ...successResult, ok: false, changed: false, status: 'repository_schema_mismatch', reasonCode: 'repository_schema_mismatch' }, snapshot }, 500, 'dev_mutation_not_successful'],
  ])('%s is failure, not success', async (_name, body, status, code) => {
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

  it('only the full accepted shape returns success', async () => {
    const result = await runDismiss(async () => response({ result: successResult, snapshot }, 200));

    expect(result).toMatchObject({
      ok: true,
      status: 200,
      result: successResult,
      snapshot,
    });
  });

  it('failure panel never renders success copy', () => {
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
        error: {
          code: 'dev_mutation_missing_snapshot',
          message: 'DataHealth dismiss did not return snapshot metadata.',
        },
      },
    }));

    expect(markup).toContain('Failure');
    expect(markup).toContain('dev_mutation_missing_snapshot');
    expect(markup).not.toContain('Snapshot recorded');
    expect(markup).not.toContain('Success</dd>');
  });
});
