import { describe, expect, it } from 'vitest';
import {
  createSessionPatchMetadata,
  createSessionPatchSourceContext,
  createSessionPatchSubmitLock,
} from '../src/devApi/DevApiSessionPatchPrototype';
import { applySessionPatchViaDevApi, type DevApiSessionPatchMetadata } from '../src/devApi/devApiSessionPatchClient';
import type { DevApiSessionPatchEnabledConfig } from '../src/devApi/devApiSessionPatchConfig';
import type { PendingSessionPatch } from '../src/models/training-model';
import { makeAppData } from './fixtures';
import { makeExercise, makeFocusSession } from './focusModeFixtures';
import { expectNoRawStack, readSource } from './runtimeBoundaryTestHelpers';

const config: DevApiSessionPatchEnabledConfig = {
  enabled: true,
  status: 'enabled',
  experiment: 'session-patch',
  baseUrl: 'http://127.0.0.1:8787',
  timeoutMs: 20,
};

const pendingPatch: PendingSessionPatch = {
  id: 'pending-main-only',
  createdAt: '2026-05-11T00:00:00.000Z',
  sourceFingerprint: 'hardening-main-only',
  targetTemplateId: 'push-a',
  status: 'pending',
  patches: [{
    id: 'patch-main-only',
    type: 'main_only',
    title: 'Main work only',
    description: 'Keep main lifts only.',
    reason: 'Fatigue',
    reversible: true,
  }],
};

const makeMetadata = () => {
  const context = createSessionPatchSourceContext(makeAppData({
    activeSession: makeFocusSession([makeExercise('bench-press', 3, 0)]),
    pendingSessionPatches: [pendingPatch],
    settings: { pendingSessionPatches: [pendingPatch] },
  }))!;
  return {
    context,
    metadata: createSessionPatchMetadata({
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
    reasonCode: 'session_patches_applied',
    message: 'applied',
  },
  snapshot: {
    snapshotId: 'snapshot-1',
    schemaVersion: 1,
    createdAt: '2026-05-11T00:00:00.000Z',
  },
};

describe('Dev API session patch hardening', () => {
  it('blocks stale target metadata and invalid patch targets before fetch', async () => {
    const { context, metadata } = makeMetadata();
    let calls = 0;
    const fetchImpl = async () => {
      calls += 1;
      return new Response(JSON.stringify(successBody), { status: 200 });
    };

    await expect(applySessionPatchViaDevApi({
      activeSessionId: 'different-session',
      pendingPatchId: context.pendingPatchId,
      config,
      metadata,
      fetchImpl,
    })).resolves.toMatchObject({ ok: false, error: { code: 'dev_mutation_invalid_target' } });

    await expect(applySessionPatchViaDevApi({
      activeSessionId: context.activeSessionId,
      pendingPatchId: '',
      patches: [],
      config,
      metadata: { ...metadata, pendingPatchId: undefined } as DevApiSessionPatchMetadata,
      fetchImpl,
    })).resolves.toMatchObject({ ok: false, error: { code: 'dev_mutation_invalid_target' } });

    expect(calls).toBe(0);
  });

  it('requires snapshot metadata and treats server non-success states as failure', async () => {
    const { context, metadata } = makeMetadata();

    await expect(applySessionPatchViaDevApi({
      activeSessionId: context.activeSessionId,
      pendingPatchId: context.pendingPatchId,
      config,
      metadata,
      fetchImpl: async () => new Response(JSON.stringify({ result: successBody.result }), { status: 200 }),
    })).resolves.toMatchObject({ ok: false, error: { code: 'dev_mutation_missing_snapshot' } });

    for (const serverCode of [
      'pending_patch_not_found',
      'no_active_session',
      'write_failed',
      'transaction_failed',
      'database_closed',
      'unsupported_route',
    ]) {
      await expect(applySessionPatchViaDevApi({
        activeSessionId: context.activeSessionId,
        pendingPatchId: context.pendingPatchId,
        config,
        metadata,
        fetchImpl: async () => new Response(JSON.stringify({
          result: { ok: false, changed: false, status: 'failed', reasonCode: serverCode, message: `${serverCode} failed` },
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

    await expect(applySessionPatchViaDevApi({
      activeSessionId: context.activeSessionId,
      pendingPatchId: context.pendingPatchId,
      config: { ...config, timeoutMs: 1 },
      metadata,
      fetchImpl: (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
        }),
    })).resolves.toMatchObject({ ok: false, error: { code: 'dev_mutation_timeout' } });

    await expect(applySessionPatchViaDevApi({
      activeSessionId: context.activeSessionId,
      pendingPatchId: context.pendingPatchId,
      config,
      metadata,
      fetchImpl: async () => {
        throw new Error('offline');
      },
    })).resolves.toMatchObject({ ok: false, error: { code: 'dev_mutation_unavailable' } });

    await expect(applySessionPatchViaDevApi({
      activeSessionId: context.activeSessionId,
      pendingPatchId: context.pendingPatchId,
      config,
      metadata,
      fetchImpl: async () => new Response('not json', { status: 200 }),
    })).resolves.toMatchObject({ ok: false, error: { code: 'dev_mutation_invalid_response' } });

    const raw = await applySessionPatchViaDevApi({
      activeSessionId: context.activeSessionId,
      pendingPatchId: context.pendingPatchId,
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

  it('locks duplicate submit behavior and no local persistence imports', () => {
    const lock = createSessionPatchSubmitLock();
    expect(lock.acquire()).toBe(true);
    expect(lock.acquire()).toBe(false);
    lock.release();
    expect(lock.acquire()).toBe(true);

    const source = [
      readSource('src/devApi/devApiSessionPatchClient.ts'),
      readSource('src/devApi/DevApiSessionPatchPrototype.tsx'),
      readSource('src/devApi/devApiSessionPatchConfig.ts'),
    ].join('\n');

    expect(source).not.toMatch(/setData|saveData|loadData|localStorageAdapter/);
    expect(source).not.toMatch(/localStorage\.(getItem|setItem|removeItem|clear)|window\.localStorage|globalThis\.localStorage/);
    expect(source).not.toMatch(/autoRetry|retry\(|retryPolicy/);
  });
});
