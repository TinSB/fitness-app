import { describe, expect, it } from 'vitest';
import { handleSessionMutationRequest } from '../apps/api/src/sessionMutation';
import { DEV_API_SESSION_COMPLETE_ROUTE } from '../src/devApi/devApiSessionCompleteClient';
import { makeAppData } from './fixtures';
import { makeExercise, makeFocusSession } from './focusModeFixtures';

describe('Dev API session complete server parity', () => {
  it('matches the existing server-side session complete route', () => {
    const activeSession = makeFocusSession([makeExercise('bench-press', 1, 1)]);
    const response = handleSessionMutationRequest(makeAppData({ activeSession }), {
      method: 'POST',
      path: DEV_API_SESSION_COMPLETE_ROUTE,
      body: {
        activeSessionId: activeSession.id,
        sourceSnapshotHash: 'source',
        sourceSnapshotVersion: 'phase5-session-complete-v1',
        mutationId: 'mutation',
        idempotencyKey: 'key',
        requestFingerprint: 'request',
        confirmed: true,
      },
      nowIso: '2026-05-11T01:00:00.000Z',
    });

    expect(DEV_API_SESSION_COMPLETE_ROUTE).toBe('/sessions/active/complete');
    expect(response.status).toBe(200);
    expect(response.result).toMatchObject({
      ok: true,
      changed: true,
      status: 'success',
      reasonCode: 'session_completed',
    });
    expect(response.nextData?.activeSession).toBeNull();
    expect(response.nextData?.history[0]).toMatchObject({
      id: activeSession.id,
      completed: true,
    });
  });

  it('maps missing active session and incomplete main work to non-success', () => {
    expect(handleSessionMutationRequest(makeAppData({ activeSession: null }), {
      method: 'POST',
      path: DEV_API_SESSION_COMPLETE_ROUTE,
    })).toMatchObject({
      status: 409,
      result: { ok: false, changed: false, reasonCode: 'no_active_session' },
    });

    expect(handleSessionMutationRequest(makeAppData({
      activeSession: makeFocusSession([makeExercise('bench-press', 2, 1)]),
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
  });
});
