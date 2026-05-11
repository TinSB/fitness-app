import { describe, expect, it } from 'vitest';
import { handleSessionMutationRequest } from '../apps/api/src/sessionMutation';
import { DEV_API_SESSION_PATCH_ROUTE } from '../src/devApi/devApiSessionPatchClient';
import type { PendingSessionPatch } from '../src/models/training-model';
import { makeAppData } from './fixtures';
import { makeExercise, makeFocusSession } from './focusModeFixtures';

const pendingPatch: PendingSessionPatch = {
  id: 'pending-main-only',
  createdAt: '2026-05-11T00:00:00.000Z',
  sourceFingerprint: 'server-parity-main-only',
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

describe('Dev API session patch server parity', () => {
  it('matches the existing server-side session patch route', () => {
    expect(DEV_API_SESSION_PATCH_ROUTE).toBe('/sessions/active/patches');

    const activeSession = makeFocusSession([makeExercise('bench-press', 3, 0)]);
    const response = handleSessionMutationRequest(makeAppData({
      activeSession,
      pendingSessionPatches: [pendingPatch],
      settings: { pendingSessionPatches: [pendingPatch] },
    }), {
      method: 'POST',
      path: DEV_API_SESSION_PATCH_ROUTE,
      body: {
        activeSessionId: activeSession.id,
        pendingPatchId: pendingPatch.id,
        sourceSnapshotHash: 'source',
        sourceSnapshotVersion: 'phase5-session-patch-v1',
        mutationId: 'mutation',
        idempotencyKey: 'key',
        requestFingerprint: 'request',
        confirmed: true,
      },
      nowIso: '2026-05-11T00:00:00.000Z',
    });

    expect(response.status).toBe(200);
    expect(response.result).toMatchObject({
      ok: true,
      changed: true,
      status: 'success',
      reasonCode: 'session_patches_applied',
    });
    expect(response.nextData?.activeSession?.appliedCoachActions?.map((item) => item.id)).toContain('patch-main-only');
  });

  it('maps missing active session and missing patch to non-success', () => {
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
  });
});
