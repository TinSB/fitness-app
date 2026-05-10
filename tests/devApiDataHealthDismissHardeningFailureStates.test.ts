import { describe, expect, it, vi } from 'vitest';
import {
  createDataHealthDismissMetadata,
  createDataHealthDismissSourceContext,
} from '../src/devApi/DevApiDataHealthDismissPrototype';
import {
  dismissDataHealthIssueViaDevApi,
  type DevApiDataHealthDismissFetch,
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
const metadata = createDataHealthDismissMetadata({
  issueId: sourceContext.issueId,
  sourceFingerprint: sourceContext.sourceFingerprint,
  nowIso: '2026-05-10T00:00:00.000Z',
});

const snapshot = {
  snapshotId: 'snapshot-failure-hardening',
  schemaVersion: 1,
  createdAt: '2026-05-10T00:00:00.000Z',
};

const response = (body: unknown, status = 200) =>
  new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });

const runDismiss = (fetchImpl: DevApiDataHealthDismissFetch, timeoutMs = 20) =>
  dismissDataHealthIssueViaDevApi({
    issueId: sourceContext.issueId,
    config: { ...config, timeoutMs },
    metadata,
    fetchImpl,
  });

const withTrackedLocalStorage = async (run: (calls: string[]) => Promise<void>) => {
  const calls: string[] = [];
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
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

describe('DataHealth dismiss hardening failure states', () => {
  it('normalizes unavailable, timeout, abort, and malformed responses without retrying', async () => {
    await withTrackedLocalStorage(async (calls) => {
      let unavailableCalls = 0;
      const unavailable = await runDismiss(async () => {
        unavailableCalls += 1;
        throw new Error('network stack should not leak');
      });

      let timeoutCalls = 0;
      const timeout = await runDismiss(
        (_input, init) => {
          timeoutCalls += 1;
          return new Promise((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => reject(new Error('aborted stack')), { once: true });
          });
        },
        1,
      );

      const parentController = new AbortController();
      parentController.abort();
      let abortCalls = 0;
      const aborted = await dismissDataHealthIssueViaDevApi({
        issueId: sourceContext.issueId,
        config,
        metadata,
        signal: parentController.signal,
        fetchImpl: (_input, init) => {
          abortCalls += 1;
          return new Promise((_resolve, reject) => {
            if (init?.signal?.aborted) {
              reject(new Error('aborted by parent'));
              return;
            }
            init?.signal?.addEventListener('abort', () => reject(new Error('aborted by parent')), { once: true });
          });
        },
      });

      const malformed = await runDismiss(async () => response('not-json'));

      expect(unavailable).toMatchObject({ ok: false, error: { code: 'dev_mutation_unavailable' } });
      expect(timeout).toMatchObject({ ok: false, error: { code: 'dev_mutation_timeout' } });
      expect(aborted).toMatchObject({ ok: false, error: { code: 'dev_mutation_unavailable' } });
      expect(malformed).toMatchObject({ ok: false, error: { code: 'dev_mutation_invalid_response' } });
      expect(unavailableCalls).toBe(1);
      expect(timeoutCalls).toBe(1);
      expect(abortCalls).toBe(1);
      expect(calls).toEqual([]);
      expectNoRawStack(unavailable);
      expectNoRawStack(timeout);
      expectNoRawStack(aborted);
      expectNoRawStack(malformed);
    });
  });

  it.each([
    ['issue not found', 'issue_not_found', 'not_found', 404],
    ['requires confirmation', 'requiresConfirmation', 'requires_confirmation', 409],
    ['unsupported route', 'unsupported_route', 'unsupported_route', 404],
    ['database closed', 'database_closed', 'database_closed', 503],
    ['write failed', 'write_failed', 'write_failed', 500],
    ['transaction failed', 'transaction_failed', 'transaction_failed', 500],
  ])('%s remains a visible failure diagnostic', async (_label, reasonCode, statusText, status) => {
    await withTrackedLocalStorage(async (calls) => {
      const result = await runDismiss(async () => response({
        result: {
          ok: false,
          changed: false,
          status: statusText,
          reasonCode,
          message: `${reasonCode} message`,
          requiresConfirmation: reasonCode === 'requiresConfirmation' ? true : undefined,
        },
        snapshot,
      }, status));

      expect(result).toMatchObject({
        ok: false,
        status,
        error: {
          code: 'dev_mutation_not_successful',
          serverCode: reasonCode,
        },
      });
      expect(calls).toEqual([]);
      expectNoRawStack(result);
    });
  });

  it('server error shape maps repository failures without raw stack', async () => {
    const result = await runDismiss(async () => response({
      error: {
        code: 'database_closed',
        message: 'Repository is closed.',
      },
    }, 503));

    expect(result).toMatchObject({
      ok: false,
      error: {
        code: 'dev_mutation_error_response',
        serverCode: 'database_closed',
      },
    });
    expectNoRawStack(result);
  });
});
