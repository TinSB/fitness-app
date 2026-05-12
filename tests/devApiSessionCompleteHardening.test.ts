import { describe, expect, it } from 'vitest';
import {
  createSessionCompleteMetadata,
  createSessionCompleteSourceContext,
  createSessionCompleteSubmitLock,
} from '../src/devApi/DevApiSessionCompletePrototype';
import { completeSessionViaDevApi, type DevApiSessionCompleteMetadata } from '../src/devApi/devApiSessionCompleteClient';
import type { DevApiSessionCompleteEnabledConfig } from '../src/devApi/devApiSessionCompleteConfig';
import { makeAppData } from './fixtures';
import { makeExercise, makeFocusSession } from './focusModeFixtures';
import { expectNoRawStack, readSource } from './runtimeBoundaryTestHelpers';

const config: DevApiSessionCompleteEnabledConfig = {
  enabled: true,
  status: 'enabled',
  experiment: 'session-complete',
  baseUrl: 'http://127.0.0.1:8787',
  timeoutMs: 20,
};

const makeMetadata = () => {
  const context = createSessionCompleteSourceContext(makeAppData({
    activeSession: makeFocusSession([makeExercise('bench-press', 3, 3)]),
  }))!;
  return {
    context,
    metadata: createSessionCompleteMetadata({
      sourceContext: context,
      nowIso: '2026-05-11T00:00:00.000Z',
    }),
  };
};

const successBody = {
  result: {
    ok: true,
    changed: true,
    status: 'success',
    reasonCode: 'session_completed',
    message: 'completed',
  },
  snapshot: {
    snapshotId: 'snapshot-complete-1',
    schemaVersion: 1,
    createdAt: '2026-05-11T00:00:00.000Z',
  },
};

describe('Dev API session complete hardening', () => {
  it('blocks stale target metadata and missing idempotency before fetch', async () => {
    const { context, metadata } = makeMetadata();
    let calls = 0;
    const fetchImpl = async () => {
      calls += 1;
      return new Response(JSON.stringify(successBody), { status: 200 });
    };

    await expect(completeSessionViaDevApi({
      activeSessionId: 'different-session',
      config,
      metadata,
      fetchImpl,
    })).resolves.toMatchObject({ ok: false, error: { code: 'dev_mutation_invalid_target' } });

    await expect(completeSessionViaDevApi({
      activeSessionId: context.activeSessionId,
      config,
      metadata: { ...metadata, idempotencyKey: '' } as DevApiSessionCompleteMetadata,
      fetchImpl,
    })).resolves.toMatchObject({ ok: false, error: { code: 'dev_mutation_idempotency_missing' } });

    await expect(completeSessionViaDevApi({
      activeSessionId: context.activeSessionId,
      config,
      metadata: { ...metadata, sourceSnapshotHash: '' } as DevApiSessionCompleteMetadata,
      fetchImpl,
    })).resolves.toMatchObject({ ok: false, error: { code: 'dev_mutation_source_snapshot_missing' } });

    expect(calls).toBe(0);
  });

  it('requires snapshot metadata and treats known server non-success states as failure', async () => {
    const { context, metadata } = makeMetadata();

    await expect(completeSessionViaDevApi({
      activeSessionId: context.activeSessionId,
      config,
      metadata,
      fetchImpl: async () => new Response(JSON.stringify({ result: successBody.result }), { status: 200 }),
    })).resolves.toMatchObject({ ok: false, error: { code: 'dev_mutation_missing_snapshot' } });

    for (const serverCode of [
      'no_active_session',
      'incomplete_main_work_requires_confirmation',
      'write_failed',
      'transaction_failed',
      'database_closed',
      'unsupported_route',
    ]) {
      await expect(completeSessionViaDevApi({
        activeSessionId: context.activeSessionId,
        config,
        metadata,
        fetchImpl: async () => new Response(JSON.stringify({
          result: {
            ok: false,
            changed: false,
            status: serverCode === 'incomplete_main_work_requires_confirmation' ? 'requires_confirmation' : 'failed',
            reasonCode: serverCode,
            message: `${serverCode} failed`,
            ...(serverCode === 'incomplete_main_work_requires_confirmation' ? { requiresConfirmation: true } : {}),
          },
          snapshot: successBody.snapshot,
        }), { status: 500 }),
      })).resolves.toMatchObject({
        ok: false,
        error: { code: 'dev_mutation_not_successful', serverCode },
      });
    }
  });

  it('normalizes timeout, unavailable, malformed response, and raw error text', async () => {
    const { context, metadata } = makeMetadata();

    await expect(completeSessionViaDevApi({
      activeSessionId: context.activeSessionId,
      config: { ...config, timeoutMs: 1 },
      metadata,
      fetchImpl: (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
        }),
    })).resolves.toMatchObject({ ok: false, error: { code: 'dev_mutation_timeout' } });

    await expect(completeSessionViaDevApi({
      activeSessionId: context.activeSessionId,
      config,
      metadata,
      fetchImpl: async () => {
        throw new Error('offline');
      },
    })).resolves.toMatchObject({ ok: false, error: { code: 'dev_mutation_unavailable' } });

    await expect(completeSessionViaDevApi({
      activeSessionId: context.activeSessionId,
      config,
      metadata,
      fetchImpl: async () => new Response('not json', { status: 200 }),
    })).resolves.toMatchObject({ ok: false, error: { code: 'dev_mutation_invalid_response' } });

    const raw = await completeSessionViaDevApi({
      activeSessionId: context.activeSessionId,
      config,
      metadata,
      fetchImpl: async () => new Response(JSON.stringify({
        error: {
          code: 'write_failed',
          message: 'RepositoryError: stack at /tmp/file with AppData localStorage SQLite',
        },
      }), { status: 500 }),
    });
    expect(raw.ok).toBe(false);
    if (!raw.ok) expectNoRawStack(raw.error.message);
  });

  it('locks duplicate submit behavior, confirmation reset code, and no local persistence imports', () => {
    const lock = createSessionCompleteSubmitLock();
    expect(lock.acquire()).toBe(true);
    expect(lock.acquire()).toBe(false);
    lock.release();
    expect(lock.acquire()).toBe(true);

    const prototype = readSource('src/devApi/DevApiSessionCompletePrototype.tsx');
    expect(prototype).toContain('setConfirmed(false)');
    expect(prototype).toContain("status: 'pending'");
    expect(prototype).toContain('duplicateSubmitBlocked');

    const source = [
      readSource('src/devApi/devApiSessionCompleteClient.ts'),
      prototype,
      readSource('src/devApi/devApiSessionCompleteConfig.ts'),
    ].join('\n');

    expect(source).not.toMatch(/setData|saveData|loadData|localStorageAdapter/);
    expect(source).not.toMatch(/localStorage\.(getItem|setItem|removeItem|clear)|window\.localStorage|globalThis\.localStorage/);
    expect(source).not.toMatch(/autoRetry|retry\(|retryPolicy/);
  });
});
