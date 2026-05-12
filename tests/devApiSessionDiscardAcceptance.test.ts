import { describe, expect, it } from 'vitest';
import { handleSessionMutationRequest } from '../apps/api/src/sessionMutation';
import { createSessionDiscardMetadata, createSessionDiscardSourceContext } from '../src/devApi/DevApiSessionDiscardPrototype';
import { discardSessionViaDevApi, DEV_API_SESSION_DISCARD_ROUTE } from '../src/devApi/devApiSessionDiscardClient';
import type { DevApiSessionDiscardEnabledConfig } from '../src/devApi/devApiSessionDiscardConfig';
import { makeAppData } from './fixtures';
import { makeExercise, makeFocusSession } from './focusModeFixtures';

const config: DevApiSessionDiscardEnabledConfig = {
  enabled: true,
  status: 'enabled',
  experiment: 'session-discard',
  baseUrl: 'http://127.0.0.1:8787',
  timeoutMs: 50,
};

const makeDiscardData = () => makeAppData({
  activeSession: makeFocusSession([makeExercise('bench-press', 2, 1)]),
  history: [],
});

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

describe('Dev API session discard acceptance', () => {
  it('accepts the happy path only with active session, metadata, confirmation, and snapshot', async () => {
    const data = makeDiscardData();
    const context = createSessionDiscardSourceContext(data)!;
    const metadata = createSessionDiscardMetadata({
      sourceContext: context,
      nowIso: '2026-05-12T00:00:00.000Z',
    });
    const calls: Array<{ url: string; method?: string; body?: string }> = [];

    const result = await discardSessionViaDevApi({
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
      snapshot: { snapshotId: 'snapshot-discard-1' },
    });
    expect(calls).toEqual([{
      url: 'http://127.0.0.1:8787/sessions/active/discard',
      method: 'POST',
      body: JSON.stringify({
        activeSessionId: 'session-focus',
        sourceSnapshotHash: metadata.sourceSnapshotHash,
        sourceSnapshotVersion: metadata.sourceSnapshotVersion,
        mutationId: metadata.mutationId,
        idempotencyKey: metadata.idempotencyKey,
        requestFingerprint: metadata.requestFingerprint,
        confirmed: true,
        confirmDiscard: true,
      }),
    }]);
  });

  it('keeps missing active session, missing confirmation, and no-change states non-success', async () => {
    expect(createSessionDiscardSourceContext(makeAppData({ activeSession: null }))).toBeNull();

    expect(handleSessionMutationRequest(makeAppData({ activeSession: null }), {
      method: 'POST',
      path: DEV_API_SESSION_DISCARD_ROUTE,
      body: { confirmDiscard: true },
    })).toMatchObject({
      status: 409,
      result: { ok: false, changed: false, reasonCode: 'no_active_session' },
    });

    expect(handleSessionMutationRequest(makeDiscardData(), {
      method: 'POST',
      path: DEV_API_SESSION_DISCARD_ROUTE,
      body: {},
    })).toMatchObject({
      status: 409,
      result: {
        ok: false,
        changed: false,
        requiresConfirmation: true,
        reasonCode: 'discard_requires_confirmation',
      },
    });

    const context = createSessionDiscardSourceContext(makeDiscardData())!;
    const metadata = createSessionDiscardMetadata({
      sourceContext: context,
      nowIso: '2026-05-12T00:00:00.000Z',
    });
    await expect(discardSessionViaDevApi({
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
    const data = makeDiscardData();
    const before = JSON.stringify(data);
    const context = createSessionDiscardSourceContext(data)!;
    const metadata = createSessionDiscardMetadata({
      sourceContext: context,
      nowIso: '2026-05-12T00:00:00.000Z',
    });
    const localStorageBefore = 'localStorage' in globalThis ? JSON.stringify(globalThis.localStorage) : 'unavailable';

    await discardSessionViaDevApi({
      activeSessionId: context.activeSessionId,
      config,
      metadata,
      fetchImpl: async () => new Response(JSON.stringify(successBody), { status: 200 }),
    });

    expect(JSON.stringify(data)).toBe(before);
    expect('localStorage' in globalThis ? JSON.stringify(globalThis.localStorage) : 'unavailable').toBe(localStorageBefore);
  });

  it('server discard does not write history and remains explicit confirmation only', () => {
    const activeSession = makeFocusSession([makeExercise('bench-press', 2, 1)]);
    const source = makeAppData({ activeSession, history: [] });

    const response = handleSessionMutationRequest(source, {
      method: 'POST',
      path: DEV_API_SESSION_DISCARD_ROUTE,
      body: { activeSessionId: activeSession.id, confirmDiscard: true },
    });

    expect(response.status).toBe(200);
    expect(response.result).toMatchObject({ ok: true, changed: true, reasonCode: 'session_discarded' });
    expect(response.nextData?.activeSession).toBeNull();
    expect(response.nextData?.history).toEqual([]);
    expect(source.activeSession).toEqual(activeSession);
  });
});
