import { describe, expect, it } from 'vitest';
import {
  createSessionDiscardMetadata,
  createSessionDiscardSourceContext,
  createSessionDiscardSubmitLock,
} from '../src/devApi/DevApiSessionDiscardPrototype';
import { discardSessionViaDevApi, type DevApiSessionDiscardMetadata } from '../src/devApi/devApiSessionDiscardClient';
import type { DevApiSessionDiscardEnabledConfig } from '../src/devApi/devApiSessionDiscardConfig';
import { makeAppData } from './fixtures';
import { makeExercise, makeFocusSession } from './focusModeFixtures';
import { expectNoRawStack, readSource } from './runtimeBoundaryTestHelpers';

const config: DevApiSessionDiscardEnabledConfig = {
  enabled: true,
  status: 'enabled',
  experiment: 'session-discard',
  baseUrl: 'http://127.0.0.1:8787',
  timeoutMs: 20,
};

const makeMetadata = () => {
  const context = createSessionDiscardSourceContext(makeAppData({
    activeSession: makeFocusSession([makeExercise('bench-press', 2, 1)]),
  }))!;
  return {
    context,
    metadata: createSessionDiscardMetadata({
      sourceContext: context,
      nowIso: '2026-05-12T00:00:00.000Z',
    }),
  };
};

const successBody = {
  result: {
    ok: true,
    changed: true,
    status: 'success',
    reasonCode: 'session_discarded',
    message: 'discarded',
  },
  snapshot: {
    snapshotId: 'snapshot-discard-1',
    schemaVersion: 1,
    createdAt: '2026-05-12T00:00:00.000Z',
  },
};

describe('Dev API session discard hardening', () => {
  it('blocks stale target metadata and missing idempotency before fetch', async () => {
    const { context, metadata } = makeMetadata();
    let calls = 0;
    const fetchImpl = async () => {
      calls += 1;
      return new Response(JSON.stringify(successBody), { status: 200 });
    };

    await expect(discardSessionViaDevApi({
      activeSessionId: 'different-session',
      config,
      metadata,
      fetchImpl,
    })).resolves.toMatchObject({ ok: false, error: { code: 'dev_mutation_invalid_target' } });

    await expect(discardSessionViaDevApi({
      activeSessionId: context.activeSessionId,
      config,
      metadata: { ...metadata, idempotencyKey: '' } as DevApiSessionDiscardMetadata,
      fetchImpl,
    })).resolves.toMatchObject({ ok: false, error: { code: 'dev_mutation_idempotency_missing' } });

    await expect(discardSessionViaDevApi({
      activeSessionId: context.activeSessionId,
      config,
      metadata: { ...metadata, sourceSnapshotHash: '' } as DevApiSessionDiscardMetadata,
      fetchImpl,
    })).resolves.toMatchObject({ ok: false, error: { code: 'dev_mutation_source_snapshot_missing' } });

    await expect(discardSessionViaDevApi({
      activeSessionId: context.activeSessionId,
      config,
      metadata: { ...metadata, confirmDiscard: false } as unknown as DevApiSessionDiscardMetadata,
      fetchImpl,
    })).resolves.toMatchObject({ ok: false, error: { code: 'dev_mutation_source_snapshot_missing' } });

    expect(calls).toBe(0);
  });

  it('requires snapshot metadata and treats known server non-success states as failure', async () => {
    const { context, metadata } = makeMetadata();

    await expect(discardSessionViaDevApi({
      activeSessionId: context.activeSessionId,
      config,
      metadata,
      fetchImpl: async () => new Response(JSON.stringify({ result: successBody.result }), { status: 200 }),
    })).resolves.toMatchObject({ ok: false, error: { code: 'dev_mutation_missing_snapshot' } });

    for (const serverCode of [
      'no_active_session',
      'discard_requires_confirmation',
      'no_change',
      'write_failed',
      'transaction_failed',
      'database_closed',
      'unsupported_route',
    ]) {
      await expect(discardSessionViaDevApi({
        activeSessionId: context.activeSessionId,
        config,
        metadata,
        fetchImpl: async () => new Response(JSON.stringify({
          result: {
            ok: serverCode === 'no_change',
            changed: false,
            status: serverCode === 'discard_requires_confirmation'
              ? 'requires_confirmation'
              : serverCode === 'no_change'
                ? 'no_change'
                : 'failed',
            reasonCode: serverCode,
            message: `${serverCode} failed`,
            ...(serverCode === 'discard_requires_confirmation' ? { requiresConfirmation: true } : {}),
          },
          snapshot: successBody.snapshot,
        }), { status: serverCode === 'no_change' ? 200 : 500 }),
      })).resolves.toMatchObject({
        ok: false,
        error: { code: 'dev_mutation_not_successful', serverCode },
      });
    }
  });

  it('normalizes timeout, unavailable, malformed response, and raw error text', async () => {
    const { context, metadata } = makeMetadata();

    await expect(discardSessionViaDevApi({
      activeSessionId: context.activeSessionId,
      config: { ...config, timeoutMs: 1 },
      metadata,
      fetchImpl: (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
        }),
    })).resolves.toMatchObject({ ok: false, error: { code: 'dev_mutation_timeout' } });

    await expect(discardSessionViaDevApi({
      activeSessionId: context.activeSessionId,
      config,
      metadata,
      fetchImpl: async () => {
        throw new Error('offline');
      },
    })).resolves.toMatchObject({ ok: false, error: { code: 'dev_mutation_unavailable' } });

    await expect(discardSessionViaDevApi({
      activeSessionId: context.activeSessionId,
      config,
      metadata,
      fetchImpl: async () => new Response('not json', { status: 200 }),
    })).resolves.toMatchObject({ ok: false, error: { code: 'dev_mutation_invalid_response' } });

    const raw = await discardSessionViaDevApi({
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

  it('locks duplicate submit behavior, confirmation reset code, cancel behavior, and no local persistence imports', () => {
    const lock = createSessionDiscardSubmitLock();
    expect(lock.acquire()).toBe(true);
    expect(lock.acquire()).toBe(false);
    lock.release();
    expect(lock.acquire()).toBe(true);

    const prototype = readSource('src/devApi/DevApiSessionDiscardPrototype.tsx');
    expect(prototype).toContain('setConfirmed(false)');
    expect(prototype).toContain("status: 'pending'");
    expect(prototype).toContain('duplicateSubmitBlocked');
    expect(prototype).toContain('const cancel');

    const source = [
      readSource('src/devApi/devApiSessionDiscardClient.ts'),
      prototype,
      readSource('src/devApi/devApiSessionDiscardConfig.ts'),
    ].join('\n');

    expect(source).not.toMatch(/setData|saveData|loadData|localStorageAdapter/);
    expect(source).not.toMatch(/localStorage\.(getItem|setItem|removeItem|clear)|window\.localStorage|globalThis\.localStorage/);
    expect(source).not.toMatch(/autoRetry|retry\(|retryPolicy/);
  });
});
