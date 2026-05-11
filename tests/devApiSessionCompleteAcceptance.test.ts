import { describe, expect, it } from 'vitest';
import { handleSessionMutationRequest } from '../apps/api/src/sessionMutation';
import { createSessionCompleteMetadata, createSessionCompleteSourceContext } from '../src/devApi/DevApiSessionCompletePrototype';
import { completeSessionViaDevApi, DEV_API_SESSION_COMPLETE_ROUTE } from '../src/devApi/devApiSessionCompleteClient';
import type { DevApiSessionCompleteEnabledConfig } from '../src/devApi/devApiSessionCompleteConfig';
import { makeAppData } from './fixtures';
import { makeExercise, makeFocusSession } from './focusModeFixtures';

const config: DevApiSessionCompleteEnabledConfig = {
  enabled: true,
  status: 'enabled',
  experiment: 'session-complete',
  baseUrl: 'http://127.0.0.1:8787',
  timeoutMs: 50,
};

const makeCompleteData = () => makeAppData({
  activeSession: makeFocusSession([makeExercise('bench-press', 3, 3)]),
});

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

describe('Dev API session complete acceptance', () => {
  it('accepts the happy path only with active session, metadata, and snapshot', async () => {
    const data = makeCompleteData();
    const context = createSessionCompleteSourceContext(data)!;
    const metadata = createSessionCompleteMetadata({
      sourceContext: context,
      nowIso: '2026-05-11T00:00:00.000Z',
    });
    const calls: Array<{ url: string; method?: string; body?: string }> = [];

    const result = await completeSessionViaDevApi({
      activeSessionId: context.activeSessionId,
      config,
      metadata,
      fetchImpl: async (input, init) => {
        calls.push({ url: String(input), method: init?.method, body: String(init?.body) });
        return new Response(JSON.stringify(successBody), { status: 200 });
      },
    });

    expect(result).toMatchObject({
      ok: true,
      activeSessionId: 'session-focus',
      snapshot: { snapshotId: 'snapshot-complete-1' },
    });
    expect(calls).toEqual([{
      url: 'http://127.0.0.1:8787/sessions/active/complete',
      method: 'POST',
      body: JSON.stringify({
        activeSessionId: 'session-focus',
        sourceSnapshotHash: metadata.sourceSnapshotHash,
        sourceSnapshotVersion: metadata.sourceSnapshotVersion,
        mutationId: metadata.mutationId,
        idempotencyKey: metadata.idempotencyKey,
        requestFingerprint: metadata.requestFingerprint,
        confirmed: true,
      }),
    }]);
  });

  it('keeps missing active session, incomplete main work, and no-change states non-success', async () => {
    expect(createSessionCompleteSourceContext(makeAppData({ activeSession: null }))).toBeNull();

    expect(handleSessionMutationRequest(makeAppData({ activeSession: null }), {
      method: 'POST',
      path: DEV_API_SESSION_COMPLETE_ROUTE,
    })).toMatchObject({
      status: 409,
      result: { ok: false, changed: false, reasonCode: 'no_active_session' },
    });

    expect(handleSessionMutationRequest(makeAppData({
      activeSession: makeFocusSession([makeExercise('bench-press', 3, 1)]),
    }), {
      method: 'POST',
      path: DEV_API_SESSION_COMPLETE_ROUTE,
    })).toMatchObject({
      status: 409,
      result: {
        ok: false,
        changed: false,
        requiresConfirmation: true,
        reasonCode: 'incomplete_main_work_requires_confirmation',
      },
    });

    const context = createSessionCompleteSourceContext(makeCompleteData())!;
    const metadata = createSessionCompleteMetadata({
      sourceContext: context,
      nowIso: '2026-05-11T00:00:00.000Z',
    });
    await expect(completeSessionViaDevApi({
      activeSessionId: context.activeSessionId,
      config,
      metadata,
      fetchImpl: async () => new Response(JSON.stringify({
        result: { ok: true, changed: false, status: 'no_change', reasonCode: 'no_change', message: 'no change' },
        snapshot: successBody.snapshot,
      }), { status: 200 }),
    })).resolves.toMatchObject({
      ok: false,
      error: { code: 'dev_mutation_not_successful', serverCode: 'no_change' },
    });
  });

  it('does not mutate local AppData or localStorage during accepted client calls', async () => {
    const data = makeCompleteData();
    const before = JSON.stringify(data);
    const context = createSessionCompleteSourceContext(data)!;
    const metadata = createSessionCompleteMetadata({
      sourceContext: context,
      nowIso: '2026-05-11T00:00:00.000Z',
    });
    const localStorageBefore = 'localStorage' in globalThis ? JSON.stringify(globalThis.localStorage) : 'unavailable';

    await completeSessionViaDevApi({
      activeSessionId: context.activeSessionId,
      config,
      metadata,
      fetchImpl: async () => new Response(JSON.stringify(successBody), { status: 200 }),
    });

    expect(JSON.stringify(data)).toBe(before);
    expect('localStorage' in globalThis ? JSON.stringify(globalThis.localStorage) : 'unavailable').toBe(localStorageBefore);
  });
});
