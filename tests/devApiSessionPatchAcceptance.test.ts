import { describe, expect, it } from 'vitest';
import { handleSessionMutationRequest } from '../apps/api/src/sessionMutation';
import { createSessionPatchMetadata, createSessionPatchSourceContext } from '../src/devApi/DevApiSessionPatchPrototype';
import { applySessionPatchViaDevApi, DEV_API_SESSION_PATCH_ROUTE } from '../src/devApi/devApiSessionPatchClient';
import type { DevApiSessionPatchEnabledConfig } from '../src/devApi/devApiSessionPatchConfig';
import type { PendingSessionPatch } from '../src/models/training-model';
import { makeAppData } from './fixtures';
import { makeExercise, makeFocusSession } from './focusModeFixtures';

const config: DevApiSessionPatchEnabledConfig = {
  enabled: true,
  status: 'enabled',
  experiment: 'session-patch',
  baseUrl: 'http://127.0.0.1:8787',
  timeoutMs: 50,
};

const pendingPatch: PendingSessionPatch = {
  id: 'pending-main-only',
  createdAt: '2026-05-11T00:00:00.000Z',
  sourceFingerprint: 'acceptance-main-only',
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

const makeTargetData = () => makeAppData({
  activeSession: makeFocusSession([makeExercise('bench-press', 3, 0)]),
  pendingSessionPatches: [pendingPatch],
  settings: { pendingSessionPatches: [pendingPatch] },
});

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

describe('Dev API session patch acceptance', () => {
  it('accepts the happy path only with active session, pending patch, metadata, and snapshot', async () => {
    const data = makeTargetData();
    const context = createSessionPatchSourceContext(data)!;
    const metadata = createSessionPatchMetadata({
      sourceContext: context,
      nowIso: '2026-05-11T00:00:00.000Z',
    });
    const calls: Array<{ url: string; method?: string; body?: string }> = [];

    const result = await applySessionPatchViaDevApi({
      activeSessionId: context.activeSessionId,
      pendingPatchId: context.pendingPatchId,
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
      pendingPatchId: 'pending-main-only',
      snapshot: { snapshotId: 'snapshot-1' },
    });
    expect(calls).toEqual([{
      url: 'http://127.0.0.1:8787/sessions/active/patches',
      method: 'POST',
      body: JSON.stringify({
        activeSessionId: 'session-focus',
        pendingPatchId: 'pending-main-only',
        sourceSnapshotHash: metadata.sourceSnapshotHash,
        sourceSnapshotVersion: metadata.sourceSnapshotVersion,
        mutationId: metadata.mutationId,
        idempotencyKey: metadata.idempotencyKey,
        requestFingerprint: metadata.requestFingerprint,
        confirmed: true,
      }),
    }]);
  });

  it('keeps no active session, missing pending patch, and no-change states non-success', async () => {
    expect(createSessionPatchSourceContext(makeAppData({
      activeSession: null,
      pendingSessionPatches: [pendingPatch],
      settings: { pendingSessionPatches: [pendingPatch] },
    }))).toBeNull();

    expect(handleSessionMutationRequest(makeAppData({ activeSession: null }), {
      method: 'POST',
      path: DEV_API_SESSION_PATCH_ROUTE,
      body: { pendingPatchId: pendingPatch.id },
    })).toMatchObject({
      status: 409,
      result: { ok: false, changed: false, reasonCode: 'no_active_session' },
    });

    expect(handleSessionMutationRequest(makeAppData({
      activeSession: makeFocusSession([makeExercise('bench-press', 3, 0)]),
    }), {
      method: 'POST',
      path: DEV_API_SESSION_PATCH_ROUTE,
      body: { pendingPatchId: 'missing-patch' },
    })).toMatchObject({
      status: 404,
      result: { ok: false, changed: false, reasonCode: 'pending_patch_not_found' },
    });

    const context = createSessionPatchSourceContext(makeTargetData())!;
    const metadata = createSessionPatchMetadata({
      sourceContext: context,
      nowIso: '2026-05-11T00:00:00.000Z',
    });
    await expect(applySessionPatchViaDevApi({
      activeSessionId: context.activeSessionId,
      pendingPatchId: context.pendingPatchId,
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
    const data = makeTargetData();
    const before = JSON.stringify(data);
    const context = createSessionPatchSourceContext(data)!;
    const metadata = createSessionPatchMetadata({
      sourceContext: context,
      nowIso: '2026-05-11T00:00:00.000Z',
    });
    const localStorageBefore = 'localStorage' in globalThis ? JSON.stringify(globalThis.localStorage) : 'unavailable';

    await applySessionPatchViaDevApi({
      activeSessionId: context.activeSessionId,
      pendingPatchId: context.pendingPatchId,
      config,
      metadata,
      fetchImpl: async () => new Response(JSON.stringify(successBody), { status: 200 }),
    });

    expect(JSON.stringify(data)).toBe(before);
    expect('localStorage' in globalThis ? JSON.stringify(globalThis.localStorage) : 'unavailable').toBe(localStorageBefore);
  });
});
